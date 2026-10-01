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

function resolveMacAutomationRoot(options = {}) {
  const existsSync = options.existsSync || fs.existsSync;
  const moduleDir = options.moduleDir || __dirname;
  const root = path.join(moduleDir, 'ui-automation', 'mac');
  if (!existsSync(path.join(root, 'scripts', 'read_unread.py'))) {
    throw new Error('安装包内未找到 Mac 微信界面自动化组件');
  }
  return root;
}

function resolveWindowsAutomationScript(options = {}) {
  const existsSync = options.existsSync || fs.existsSync;
  const moduleDir = options.moduleDir || __dirname;
  const script = path.join(moduleDir, 'ui-automation', 'windows', 'read-unread.ps1');
  if (!existsSync(script)) throw new Error('安装包内未找到 Windows 微信界面自动化组件');
  return script;
}

function resolveMacPythonCommand(options = {}) {
  const env = options.env || process.env;
  const configured = String(options.python || env.JCYX_WECHAT_UI_PYTHON || '').trim();
  if (configured) return configured;

  const existsSync = options.existsSync || fs.existsSync;
  const arch = options.arch || process.arch;
  const homebrewCandidates = arch === 'arm64'
    ? ['/opt/homebrew/bin/python3', '/usr/local/bin/python3']
    : ['/usr/local/bin/python3', '/opt/homebrew/bin/python3'];
  const candidates = [
    ...homebrewCandidates,
    '/Library/Frameworks/Python.framework/Versions/Current/bin/python3',
  ];
  return candidates.find((candidate) => existsSync(candidate)) || 'python3';
}

function classifyMacPythonFailure(stderr, exitCode) {
  const diagnostic = String(stderr || '');
  const missingModule = diagnostic.match(
    /ModuleNotFoundError:\s*No module named\s*['"]([^'"]+)['"]/u
  );
  if (missingModule) {
    const moduleName = missingModule[1] === 'PIL' ? 'Pillow (PIL)' : missingModule[1];
    return {
      code: 'PYTHON_DEPENDENCY_MISSING',
      message: `Mac 微信自动化缺少运行组件：${moduleName}`,
    };
  }
  return {
    code: 'MAC_AUTOMATION_EXITED',
    message: exitCode === null
      ? 'Mac 微信自动化进程被中断'
      : `Mac 微信自动化进程异常退出（代码 ${exitCode}）`,
  };
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

  function runProcess(command, args, cwd, allowedTitles, processOptions = {}) {
    abortReason = '';
    activePromise = new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let stderrSize = 0;
      let outputTooLarge = false;
      let settled = false;
      const child = spawnProcess(command, args, {
        cwd,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
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
        if (Buffer.byteLength(stderr, 'utf8') < MAX_OUTPUT_BYTES) {
          stderr += chunk.toString('utf8');
        }
        if (stderrSize > MAX_OUTPUT_BYTES && !abortReason) {
          stopChild(child, '微信界面自动化诊断输出超过安全限制');
        }
      });
      child.on('error', (error) => {
        const missingRuntimeMessage = processOptions.missingRuntimeMessage
          || '未找到 Python 运行环境，无法读取微信未读会话';
        finish({
          ok: false,
          error: {
            code: error?.code === 'ENOENT'
              ? (processOptions.missingRuntimeCode || 'PYTHON_NOT_FOUND')
              : 'START_FAILED',
            message: error?.code === 'ENOENT'
              ? missingRuntimeMessage
              : '微信界面自动化启动失败',
          },
        });
      });
      child.on('close', (code) => {
        if (abortReason) {
          finish({ ok: false, error: { code: 'ABORTED', message: abortReason } });
          return;
        }
        if (!stdout.trim() && typeof processOptions.classifyEmptyOutput === 'function') {
          finish({
            ok: false,
            error: processOptions.classifyEmptyOutput(stderr, code),
          });
          return;
        }
        try {
          const result = parseAutomationOutput(stdout, allowedTitles);
          if (processOptions.checkAllAllowedTitles) {
            result.openedTitles = [...allowedTitles];
          }
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

  function runMac(root, allowedTitles) {
    const script = path.join(root, 'scripts', 'read_unread.py');
    const python = resolveMacPythonCommand(options);
    const args = [script, '--max-pages', '8', '--dwell-seconds', '1.8'];
    allowedTitles.forEach((title) => args.push('--include-title', title));
    if (artifactRoot) args.push('--artifact-root', artifactRoot);
    return runProcess(python, args, root, allowedTitles, {
      classifyEmptyOutput: classifyMacPythonFailure,
    });
  }

  function runWindows(script, allowedTitles) {
    const powershell = options.powershell || process.env.JCYX_WECHAT_UI_POWERSHELL || 'powershell.exe';
    const args = [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      script,
      '-MaxIterations',
      '50',
      '-DwellMilliseconds',
      '1000',
    ];
    return runProcess(powershell, args, path.dirname(script), allowedTitles, {
      checkAllAllowedTitles: true,
      missingRuntimeCode: 'POWERSHELL_NOT_FOUND',
      missingRuntimeMessage: '未找到 Windows PowerShell，无法读取微信未读会话',
    });
  }

  return Object.freeze({
    async readUnread(input) {
      if (platform !== 'darwin' && platform !== 'win32') {
        return {
          ok: false,
          error: { code: 'UNSUPPORTED_PLATFORM', message: '当前系统暂不支持读取微信未读会话' },
        };
      }
      if (activePromise) {
        return { ok: false, error: { code: 'BUSY', message: '微信未读会话正在扫描中' } };
      }
      try {
        const allowedTitles = normalizeAllowedTitles(input);
        if (platform === 'win32') {
          const script = resolveWindowsAutomationScript(options);
          return await runWindows(script, allowedTitles);
        }
        const root = resolveMacAutomationRoot(options);
        return await runMac(root, allowedTitles);
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
  classifyMacPythonFailure,
  resolveMacAutomationRoot,
  resolveMacPythonCommand,
  resolveWindowsAutomationScript,
};
