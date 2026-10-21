const { spawn } = require('child_process');
const fs = require('fs');
const { NdjsonFramer, encodeLine } = require('./ndjson');
const {
  ReaderRuntimeConfigError,
  resolveReaderRuntime,
  resolveReaderMaterialEnv,
  resolveReaderChildEnv,
} = require('./reader-runtime-resolver');
const { ReaderError, transportError, TRANSPORT_ERROR } = require('./reader-errors');

const DEFAULTS = Object.freeze({
  startTimeoutMs: 15_000,
  requestTimeoutMs: 60_000,
  maxConsecutiveFailures: 3,
  malformedThreshold: 3,
  shutdownGraceMs: 3_000,
});
const REQUIRED_BRIDGE_VERSION = 2;

function sanitizeDiagnosticText(raw) {
  return String(raw || '')
    .replace(/wxid_[A-Za-z0-9_-]+/gi, '[REDACTED_WXID]')
    .replace(/((?:db_?key|key|password|passphrase|token|secret)\s*[:=]\s*)[^\s,;\]}]+/gi, '$1[REDACTED]')
    .replace(/\b[0-9a-f]{32,}\b/gi, '[REDACTED_HEX]')
    .replace(/\b[A-Za-z0-9+]{48,}={0,2}\b/g, '[REDACTED_BLOB]')
    .slice(0, 8192);
}

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function waitForExit(child, timeoutMs) {
  if (hasExited(child)) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener('exit', onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(hasExited(child)), timeoutMs);
    child.once('exit', onExit);
    if (hasExited(child)) finish(true);
  });
}

class ReaderBridge {
  constructor({ appLogger, ...options } = {}) {
    this.options = { ...DEFAULTS, ...options };
    this.appLogger = appLogger;
    this.child = null;
    this.framer = new NdjsonFramer();
    this.pending = new Map();
    this.nextId = 1;
    this.startPromise = null;
    this.readyWaiter = null;
    this.ready = false;
    this.shuttingDown = false;
    this.disposePromise = null;
    this.consecutiveFailures = 0;
    this.malformedCount = 0;
    // 性能测量：用“单调递增的启动序号”标识每一次真实的 Reader 启动。
    // 只用序号判断“是否发生过新启动”，绝不用耗时大小比较（新一次启动可能更快）。
    // 仅存储数值与只读标记，不影响任何业务行为。
    this.startGeneration = 0;      // 已发起的启动次数（单调递增，永不回退）
    this.pendingStartGeneration = 0; // 当前正在进行的启动序号
    this.lastStartGeneration = 0;  // 最近一次「就绪」的启动序号
    this.lastStartMs = 0;          // 最近一次「就绪」的启动耗时
    this.coldStartStartedAt = 0;
    this.coldStartMs = null;
    // 注意：这里刻意不保存「最近一次请求的角色」。角色属于单次请求，若存在全局
    // 可变字段，并发请求会互相覆盖（预热/用户读取交错时尤其明显）。角色改为随
    // request() 的返回值一起给出，详见 request() 内的 start 快照。
  }

  /**
   * 只读：最近一次「就绪」的启动序号、该次启动耗时，以及已发起的启动总数。
   * 全部为单调递增/只增不覆盖的数值，可被并发读取而不会互相污染。
   * 单次请求的角色（active/shared/warm）请使用该次 request() 返回的 start。
   */
  lastColdStart() {
    return {
      generation: this.lastStartGeneration,
      startMs: this.lastStartMs,
      totalStarts: this.startGeneration,
    };
  }

  log(level, message) {
    const safeMessage = sanitizeDiagnosticText(message);
    this.appLogger?.append(level, 'wechat-reader', safeMessage);
    if (!this.appLogger) console.log(`[wechat-reader:${level}] ${safeMessage}`);
  }

  isRunning() {
    return Boolean(this.child && this.child.exitCode === null && this.ready);
  }

  async ensureStarted() {
    if (this.isRunning()) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async request(method, params = {}, timeoutMs) {
    if (this.shuttingDown) {
      throw transportError(TRANSPORT_ERROR.SHUTTING_DOWN, '微信读取服务正在关闭');
    }
    const wasRunning = this.isRunning();
    // 启动已发起但尚未就绪 => 本次请求只是“共享等待”他人发起的启动（例如预热）。
    const startInFlight = !wasRunning && Boolean(this.startPromise);
    await this.ensureStarted();
    // 启动信息「随本次请求返回」，不写入任何全局可变字段：
    // 并发请求不会相互覆盖彼此的 role/generation，渲染层延迟读取也不会取到别人的数据。
    const start = {
      role: wasRunning ? 'warm' : (startInFlight ? 'shared' : 'active'),
      generation: this.lastStartGeneration,
      startMs: this.lastStartMs,
    };
    const child = this.child;
    if (!child || !child.stdin) {
      throw transportError(TRANSPORT_ERROR.CRASHED, '微信读取服务未运行', true);
    }
    const id = String(this.nextId++);
    const value = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.log('error', `reader request timeout method=${method} timeoutMs=${timeoutMs || this.options.requestTimeoutMs}`);
        reject(transportError(TRANSPORT_ERROR.REQUEST_TIMEOUT, '读取微信数据超时', true));
      }, timeoutMs || this.options.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        child.stdin.write(encodeLine({ id, method, params }));
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(transportError(TRANSPORT_ERROR.CRASHED, '写入微信读取服务失败', true));
      }
    });
    return { value, start };
  }

  async startInternal() {
    if (this.consecutiveFailures >= this.options.maxConsecutiveFailures) {
      throw transportError(TRANSPORT_ERROR.CRASHED, '微信读取服务连续启动失败', true);
    }
    // 只有真正发起一次启动时序号才 +1（同步执行，保证并发请求看到同一序号）。
    // 就绪时才把该序号记为 lastStartGeneration，失败启动不会污染已完成启动的序号。
    const generation = ++this.startGeneration;
    this.pendingStartGeneration = generation;
    let spec;
    try {
      spec = resolveReaderRuntime();
    } catch (error) {
      this.log('error', `reader runtime resolve error=${error.message}`);
      if (error instanceof ReaderRuntimeConfigError) {
        throw transportError(TRANSPORT_ERROR.NOT_CONFIGURED, '微信读取服务未正确安装');
      }
      throw error;
    }

    const material = resolveReaderMaterialEnv();
    const env = resolveReaderChildEnv(spec.kind, material.env);
    if (material.materialRoot) {
      try {
        fs.mkdirSync(material.materialRoot, { recursive: true });
      } catch (error) {
        this.log('warn', `reader material directory create failed path=${material.materialRoot} error=${error.message}`);
      }
    }
    this.coldStartStartedAt = Date.now();
    this.log('info', `reader launch kind=${spec.kind}`);
    this.log('info', `reader launch command=${spec.command}`);
    this.log('info', `reader launch args=${JSON.stringify(spec.args)}`);
    this.log('info', `reader launch cwd=${spec.cwd}`);
    this.log('info', `reader launch materialRoot=${material.materialRoot || '[none]'} source=${material.source}`);

    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      detached: false,
    });
    this.child = child;
    this.framer.reset();
    this.malformedCount = 0;
    this.ready = false;
    this.log('info', `reader spawn pid=${child.pid || '[unavailable]'}`);

    child.stdout.on('data', (chunk) => this.onStdout(chunk));
    child.stderr.on('data', (chunk) => {
      // stderr 只落本地诊断日志；先脱敏，永不回传 renderer。
      this.log('warn', `reader stderr bytes=${chunk.length} text=${sanitizeDiagnosticText(chunk.toString('utf8').trim()) || '[empty]'}`);
    });
    child.on('error', (error) => {
      this.log('error', `reader spawn error=${error.message}`);
      this.consecutiveFailures += 1;
      this.settleReady(error);
      this.failAllPending(TRANSPORT_ERROR.CRASHED, '微信读取服务无法启动');
      if (this.child === child) this.child = null;
      this.ready = false;
    });
    child.on('exit', (code, signal) => {
      this.log('info', `reader exit pid=${child.pid || '[unavailable]'} code=${code} signal=${signal}`);
      this.settleReady(new Error('reader exited before ready'));
      this.failAllPending(TRANSPORT_ERROR.CRASHED, '微信读取服务已退出');
      if (this.child === child) this.child = null;
      this.ready = false;
      if (!this.shuttingDown && code !== 0) this.consecutiveFailures += 1;
    });

    await this.awaitReady(child);
    if (this.child !== child) {
      throw transportError(TRANSPORT_ERROR.CRASHED, '微信读取服务启动被中断', true);
    }
    this.ready = true;
    this.consecutiveFailures = 0;
  }

  awaitReady(child) {
    return new Promise((resolve, reject) => {
      const waiter = {
        settled: false,
        resolve,
        reject,
        timer: null,
      };
      waiter.timer = setTimeout(() => {
        if (waiter.settled) return;
        waiter.settled = true;
        this.readyWaiter = null;
        this.consecutiveFailures += 1;
        this.log('error', `reader start timeout pid=${child.pid || '[unavailable]'} timeoutMs=${this.options.startTimeoutMs}`);
        this.stopChild(child, 'start-timeout', false).finally(() => {
          if (this.child === child) this.child = null;
          reject(transportError(TRANSPORT_ERROR.START_TIMEOUT, '微信读取服务启动超时', true));
        });
      }, this.options.startTimeoutMs);
      this.readyWaiter = waiter;
    });
  }

  settleReady(error) {
    const waiter = this.readyWaiter;
    if (!waiter || waiter.settled) return;
    waiter.settled = true;
    clearTimeout(waiter.timer);
    this.readyWaiter = null;
    if (error) waiter.reject(transportError(TRANSPORT_ERROR.CRASHED, '微信读取服务启动后立即退出', true));
    else {
      const startMs = Date.now() - this.coldStartStartedAt;
      this.coldStartMs = startMs;
      // 只有成功就绪才推进「已完成启动」的序号与耗时；每次启动独立记录。
      this.lastStartGeneration = this.pendingStartGeneration || this.startGeneration;
      this.lastStartMs = startMs;
      waiter.resolve();
    }
  }

  onStdout(chunk) {
    const frames = this.framer.push(chunk.toString('utf8'));
    // 严禁记录 stdout 原文，其中可能包含昵称和聊天内容。
    this.log('info', `reader stdout bytes=${chunk.length} frames=${frames.length}`);
    for (const frame of frames) {
      if (frame.kind === 'malformed') {
        this.malformedCount += 1;
        this.log('warn', `reader stdout malformed count=${this.malformedCount}`);
        if (this.malformedCount >= this.options.malformedThreshold) {
          this.failAllPending(TRANSPORT_ERROR.PROTOCOL_ERROR, '微信读取服务协议异常');
          this.restart();
        }
        continue;
      }
      const value = frame.value;
      if (value.event === 'ready') {
        const bridgeVersion = Number.parseInt(String(value.version || '0'), 10);
        if (!Number.isFinite(bridgeVersion) || bridgeVersion < REQUIRED_BRIDGE_VERSION) {
          this.log(
            'error',
            `reader runtime outdated version=${sanitizeDiagnosticText(value.version || '[missing]')} required=${REQUIRED_BRIDGE_VERSION}`
          );
          this.settleReady(new Error('reader runtime outdated'));
          if (this.child && !hasExited(this.child)) {
            void this.stopChild(this.child, 'outdated-runtime', false);
          }
          continue;
        }
        this.log('info', `reader stdout event=ready version=${bridgeVersion}`);
        this.settleReady();
        continue;
      }
      if (value.event === 'log') {
        this.log('info', 'reader stdout event=log payload=[redacted]');
        continue;
      }
      const id = value.id == null ? null : String(value.id);
      if (!id) continue;
      const pending = this.pending.get(id);
      if (!pending) continue;
      clearTimeout(pending.timer);
      this.pending.delete(id);
      this.log('info', `reader stdout frame=response ok=${value.ok === true}`);
      if (value.ok === true) {
        pending.resolve(value.result);
      } else {
        const remote = value.error || {};
        this.log('warn', `reader response error code=${sanitizeDiagnosticText(remote.code || 'INTERNAL_ERROR')}`);
        pending.reject(new ReaderError({
          code: String(remote.code || 'INTERNAL_ERROR'),
          message: String(remote.message || '读取本地微信数据失败'),
          retryable: Boolean(remote.retryable),
          needsReinit: Boolean(remote.needsReinit),
          needsUserAction: Boolean(remote.needsUserAction),
          userAction: remote.userAction || null,
          diagnosticId: remote.diagnosticId || null,
        }));
      }
    }
  }

  failAllPending(code, message) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(transportError(code, message, true));
    }
    this.pending.clear();
  }

  restart() {
    const child = this.child;
    this.child = null;
    this.ready = false;
    if (child && !hasExited(child)) this.stopChild(child, 'restart', false);
  }

  dispose() {
    if (!this.disposePromise) this.disposePromise = this.disposeInternal();
    else this.log('info', 'reader stop duplicate request; awaiting active dispose');
    return this.disposePromise;
  }

  async disposeInternal() {
    this.shuttingDown = true;
    const child = this.child;
    this.failAllPending(TRANSPORT_ERROR.SHUTTING_DOWN, '微信读取服务正在关闭');
    if (!child) {
      this.log('info', 'reader stop requested: no owned child');
      return;
    }
    await this.stopChild(child, 'dispose', true);
    if (this.child === child) this.child = null;
    this.ready = false;
    this.log('info', 'reader stop complete');
  }

  async stopChild(child, reason, graceful) {
    const pid = child.pid || null;
    this.log('info', `reader stop begin reason=${reason} pid=${pid || '[unavailable]'} graceful=${graceful}`);
    if (hasExited(child)) return;
    if (graceful) {
      try {
        child.stdin.write(encodeLine({ id: 'shutdown', method: 'shutdown', params: {} }));
        this.log('info', `reader stop shutdown-sent pid=${pid || '[unavailable]'}`);
      } catch (error) {
        this.log('warn', `reader stop shutdown-write-failed=${error.message}`);
      }
      if (await waitForExit(child, this.options.shutdownGraceMs)) {
        this.log('info', `reader stop graceful-exit pid=${pid || '[unavailable]'}`);
        return;
      }
      this.log('warn', `reader stop grace-timeout pid=${pid || '[unavailable]'} timeoutMs=${this.options.shutdownGraceMs}`);
    }

    await this.forceKillOwnedProcess(child);
    const exited = await waitForExit(child, 2000);
    this.log(exited ? 'info' : 'error', `reader stop force-result pid=${pid || '[unavailable]'} exited=${exited}`);
  }

  async forceKillOwnedProcess(child) {
    const pid = child.pid;
    if (process.platform === 'win32' && pid) {
      this.log('warn', `reader stop force-kill-tree pid=${pid}`);
      await new Promise((resolve) => {
        const killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
          stdio: 'ignore',
          windowsHide: true,
        });
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(finish, 2000);
        killer.once('error', (error) => {
          this.log('warn', `reader stop taskkill-error=${error.message}`);
          finish();
        });
        killer.once('exit', finish);
      });
    }
    if (!hasExited(child)) {
      try {
        child.kill('SIGKILL');
      } catch (error) {
        this.log('warn', `reader stop kill-error=${error.message}`);
      }
    }
  }
}

module.exports = { ReaderBridge, sanitizeDiagnosticText };
