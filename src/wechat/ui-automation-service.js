const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const ACCEPTED_RESULT_CODES = new Set(['SUCCESS', 'SCAN_LIMIT_REACHED']);

function normalizeAllowedTitles(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('微信会话扫描参数无效');
  }
  const keys = Object.keys(input);
  if (keys.some((key) => key !== 'allowedTitles')) {
    throw new Error('微信会话扫描包含未允许的参数');
  }
  if (!Array.isArray(input.allowedTitles)
      || input.allowedTitles.length < 1
      || input.allowedTitles.length > 200) {
    throw new Error('微信会话名称数量无效');
  }

  const unique = [];
  const seen = new Set();
  input.allowedTitles.forEach((value) => {
    if (typeof value !== 'string') throw new Error('微信会话名称无效');
    const title = value.trim();
    if (!title || title.length > 255 || /[\u0000-\u001f\u007f]/u.test(title)) {
      throw new Error('微信会话名称无效');
    }
    if (!seen.has(title)) {
      seen.add(title);
      unique.push(title);
    }
  });
  if (!unique.length) throw new Error('没有可扫描的已绑定微信会话');
  return unique;
}

function resolveAutomationRoot(options = {}) {
  const existsSync = options.existsSync || fs.existsSync;
  const env = options.env || process.env;
  const resourcesPath = options.resourcesPath || process.resourcesPath || '';
  const moduleDir = options.moduleDir || __dirname;
  const candidates = [
    env.JCYX_WECHAT_UI_HOME,
    resourcesPath ? path.join(resourcesPath, 'wechat-ui-automation') : '',
    path.resolve(moduleDir, '../../../..', 'jcyx', 'jcyx-wechat-ui-automation'),
  ].filter(Boolean);

  const root = candidates.find((candidate) => (
    existsSync(path.join(candidate, 'scripts', 'read_unread_smoke.py'))
  ));
  if (!root) throw new Error('未找到微信界面自动化运行组件');
  return root;
}

function parseAutomationOutput(stdout, allowedTitles) {
  let payload;
  try {
    payload = JSON.parse(String(stdout || '').trim());
  } catch {
    throw new Error('微信界面自动化返回了无效结果');
  }
  if (!payload || typeof payload !== 'object' || typeof payload.code !== 'string') {
    throw new Error('微信界面自动化结果不完整');
  }

  const allowed = new Set(allowedTitles);
  const openedTitles = [];
  const openedSeen = new Set();
  const rows = Array.isArray(payload.conversations) ? payload.conversations : [];
  rows.forEach((row) => {
    if (!row || row.status !== 'OPENED' || typeof row.title !== 'string') return;
    const title = row.title.trim();
    if (!allowed.has(title) || openedSeen.has(title)) return;
    openedSeen.add(title);
    openedTitles.push(title);
  });

  return {
    code: payload.code,
    message: typeof payload.message === 'string' ? payload.message : '',
    metrics: payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : {},
    openedTitles,
  };
}

function createWechatUiAutomationService(options = {}) {
  const platform = options.platform || process.platform;
  const spawnProcess = options.spawnProcess || spawn;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const artifactRoot = options.artifactRoot;
  let activeChild = null;
  let activePromise = null;
  let abortReason = '';

  function stopChild(child, reason) {
    abortReason = reason;
    child.kill('SIGTERM');
    const forceTimer = setTimeout(() => {
      if (activeChild === child) child.kill('SIGKILL');
    }, 2000);
    forceTimer.unref?.();
  }

  function runPython(root, allowedTitles) {
    const script = path.join(root, 'scripts', 'read_unread_smoke.py');
    const python = options.python || process.env.JCYX_WECHAT_UI_PYTHON || 'python3';
    const args = [script, '--max-pages', '8', '--dwell-seconds', '1.8'];
    allowedTitles.forEach((title) => args.push('--include-title', title));
    if (artifactRoot) args.push('--artifact-root', artifactRoot);

    abortReason = '';
    activePromise = new Promise((resolve) => {
      let stdout = '';
      let stderrSize = 0;
      let outputTooLarge = false;
      let settled = false;
      const child = spawnProcess(python, args, {
        cwd: root,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      activeChild = child;

      const timer = setTimeout(() => {
        stopChild(child, '微信未读会话扫描超时');
      }, timeoutMs);

      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      child.stdout.on('data', (chunk) => {
        if (outputTooLarge) return;
        stdout += chunk.toString('utf8');
        if (Buffer.byteLength(stdout, 'utf8') > MAX_OUTPUT_BYTES) {
          outputTooLarge = true;
          stopChild(child, '微信界面自动化输出超过安全限制');
        }
      });
      child.stderr.on('data', (chunk) => {
        stderrSize += chunk.length;
        if (stderrSize > MAX_OUTPUT_BYTES && !abortReason) {
          stopChild(child, '微信界面自动化诊断输出超过安全限制');
        }
      });
      child.on('error', (error) => {
        finish({
          ok: false,
          error: {
            code: error?.code === 'ENOENT' ? 'PYTHON_NOT_FOUND' : 'START_FAILED',
            message: error?.code === 'ENOENT'
              ? '未找到 Python 运行环境，无法读取微信未读会话'
              : '微信界面自动化启动失败',
          },
        });
      });
      child.on('close', () => {
        if (abortReason) {
          finish({ ok: false, error: { code: 'ABORTED', message: abortReason } });
          return;
        }
        try {
          const result = parseAutomationOutput(stdout, allowedTitles);
          if (!ACCEPTED_RESULT_CODES.has(result.code)) {
            finish({
              ok: false,
              error: {
                code: result.code || 'AUTOMATION_FAILED',
                message: result.message || '微信未读会话扫描失败',
              },
            });
            return;
          }
          finish({ ok: true, result });
        } catch (error) {
          finish({
            ok: false,
            error: { code: 'INVALID_OUTPUT', message: error.message },
          });
        }
      });
    }).finally(() => {
      activeChild = null;
      activePromise = null;
      abortReason = '';
    });
    return activePromise;
  }

  return Object.freeze({
    async readUnread(input) {
      if (platform !== 'darwin') {
        return {
          ok: false,
          error: { code: 'UNSUPPORTED_PLATFORM', message: '当前仅支持在 Mac 微信客户端读取未读会话' },
        };
      }
      if (activePromise) {
        return { ok: false, error: { code: 'BUSY', message: '微信未读会话正在扫描中' } };
      }
      try {
        const allowedTitles = normalizeAllowedTitles(input);
        const root = resolveAutomationRoot(options);
        return await runPython(root, allowedTitles);
      } catch (error) {
        return { ok: false, error: { code: 'INVALID_REQUEST', message: error.message } };
      }
    },
    async dispose() {
      if (!activeChild || !activePromise) return;
      stopChild(activeChild, '应用正在退出，微信未读会话扫描已停止');
      await activePromise;
    },
  });
}

module.exports = {
  createWechatUiAutomationService,
  normalizeAllowedTitles,
  parseAutomationOutput,
  resolveAutomationRoot,
};
