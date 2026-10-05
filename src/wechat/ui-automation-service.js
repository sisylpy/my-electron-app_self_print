const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const ACCEPTED_RESULT_CODES = new Set(['SUCCESS', 'SCAN_LIMIT_REACHED', 'NO_UNREAD']);

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

function normalizeCurrentConversationInput(input) {
  if (input == null) return [];
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('当前微信会话识别参数无效');
  }
  const keys = Object.keys(input);
  if (keys.some((key) => key !== 'allowedTitles' && key !== 'requireForeground')) {
    throw new Error('当前微信会话识别包含未允许的参数');
  }
  if (input.requireForeground !== undefined && typeof input.requireForeground !== 'boolean') {
    throw new Error('当前微信前台识别参数无效');
  }
  // Older renderers may still send allowedTitles. Validate them, but title
  // extraction no longer depends on loading every customer's binding first.
  if (input.allowedTitles !== undefined) return normalizeAllowedTitles(input);
  return [];
}

function normalizeConversationTitle(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('微信会话切换参数无效');
  }
  if (Object.keys(input).some(key => key !== 'title')) {
    throw new Error('微信会话切换包含未允许的参数');
  }
  const [title] = normalizeAllowedTitles({ allowedTitles: [input.title] });
  return title;
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

function resolveWindowsCurrentConversationScript(options = {}) {
  const existsSync = options.existsSync || fs.existsSync;
  const moduleDir = options.moduleDir || __dirname;
  const script = path.join(
    moduleDir,
    'ui-automation',
    'windows',
    'current-conversation.ps1'
  );
  if (!existsSync(script)) {
    throw new Error('安装包内未找到 Windows 当前微信会话识别组件');
  }
  return script;
}

function resolveWindowsFocusConversationScript(options = {}) {
  const existsSync = options.existsSync || fs.existsSync;
  const moduleDir = options.moduleDir || __dirname;
  const script = path.join(
    moduleDir,
    'ui-automation',
    'windows',
    'focus-conversation.ps1'
  );
  if (!existsSync(script)) {
    throw new Error('安装包内未找到 Windows 微信会话切换组件');
  }
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
  const selectedTitle = typeof payload.selectedTitle === 'string'
    && allowed.has(payload.selectedTitle.trim())
    ? payload.selectedTitle.trim()
    : '';
  const candidateTitles = [...openedTitles];
  if (selectedTitle && !openedSeen.has(selectedTitle)) candidateTitles.push(selectedTitle);

  return {
    code: payload.code,
    message: typeof payload.message === 'string' ? payload.message : '',
    metrics: payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : {},
    openedTitles,
    candidateTitles,
  };
}

function parseUnreadSummaryOutput(stdout, allowedTitles) {
  let payload;
  try {
    payload = JSON.parse(String(stdout || '').trim());
  } catch {
    throw new Error('微信未读统计返回了无效结果');
  }
  if (!payload || typeof payload !== 'object' || typeof payload.code !== 'string') {
    throw new Error('微信未读统计结果不完整');
  }

  const allowed = new Set(allowedTitles);
  const unreadTitles = [];
  const seen = new Set();
  const rows = Array.isArray(payload.conversations) ? payload.conversations : [];
  rows.forEach((row) => {
    if (!row || row.status !== 'UNREAD' || typeof row.title !== 'string') return;
    const title = row.title.trim();
    if (!allowed.has(title) || seen.has(title)) return;
    seen.add(title);
    unreadTitles.push(title);
  });
  return {
    code: payload.code,
    message: typeof payload.message === 'string' ? payload.message : '',
    metrics: payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : {},
    unreadCount: unreadTitles.length,
    unreadTitles,
    selectedTitle: typeof payload.selectedTitle === 'string'
      ? payload.selectedTitle.trim()
      : '',
  };
}

function parseCurrentConversationOutput(stdout, allowedTitles = []) {
  let payload;
  try {
    payload = JSON.parse(String(stdout || '').trim());
  } catch {
    throw new Error('当前微信会话识别返回了无效结果');
  }
  if (!payload || typeof payload !== 'object' || typeof payload.code !== 'string') {
    throw new Error('当前微信会话识别结果不完整');
  }
  const title = typeof payload.conversationTitle === 'string'
    ? payload.conversationTitle
      .normalize('NFKC')
      .trim()
      .replace(/\s*\(\s*\d+\s*\)\s*$/u, '')
      .trim()
    : '';
  if (payload.code === 'SUCCESS' && !title) throw new Error('当前微信会话名称为空');
  if (title && allowedTitles.length && !new Set(allowedTitles).has(title)) {
    throw new Error('当前微信会话不在客户绑定范围内');
  }
  return {
    code: payload.code,
    message: typeof payload.message === 'string' ? payload.message : '',
    title,
  };
}

function createWechatUiAutomationService(options = {}) {
  const platform = options.platform || process.platform;
  const spawnProcess = options.spawnProcess || spawn;
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const artifactRoot = options.artifactRoot;
  let activeChild = null;
  let activePromise = null;
  let currentConversationPromise = null;
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
          const parseOutput = processOptions.parseOutput || parseAutomationOutput;
          const result = parseOutput(stdout, allowedTitles);
          if (processOptions.mapOpenedCountToAllowedTitles) {
            const openedCount = Number(result.metrics?.openedCount || 0);
            result.openedTitles = openedCount > 0 ? [...allowedTitles] : [];
            // The Windows helper does not yet return exact opened titles. Keep
            // its conservative reconciliation behavior until it does.
            result.candidateTitles = [...allowedTitles];
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
    const args = [
      script,
      '--max-pages',
      String(Math.min(200, Math.max(8, allowedTitles.length))),
      '--dwell-seconds',
      '0.5',
    ];
    allowedTitles.forEach((title) => args.push('--include-title', title));
    if (artifactRoot) args.push('--artifact-root', artifactRoot);
    return runProcess(python, args, root, allowedTitles, {
      classifyEmptyOutput: classifyMacPythonFailure,
    });
  }

  function runMacUnreadSummary(root, allowedTitles) {
    const script = path.join(root, 'scripts', 'inspect_unread.py');
    if (!fs.existsSync(script)) {
      return Promise.resolve({
        ok: false,
        error: { code: 'UNREAD_SUMMARY_SCRIPT_MISSING', message: '安装包内未找到微信未读统计组件' },
      });
    }
    const python = resolveMacPythonCommand(options);
    const args = [script];
    allowedTitles.forEach((title) => args.push('--include-title', title));
    if (artifactRoot) args.push('--artifact-root', artifactRoot);
    return runProcess(python, args, root, allowedTitles, {
      classifyEmptyOutput: classifyMacPythonFailure,
      parseOutput: parseUnreadSummaryOutput,
    });
  }

  function runMacFocus(root, title) {
    const script = path.join(root, 'scripts', 'focus_conversation.py');
    if (!fs.existsSync(script)) {
      return Promise.resolve({
        ok: false,
        error: { code: 'FOCUS_SCRIPT_MISSING', message: '安装包内未找到微信会话切换组件' },
      });
    }
    const python = resolveMacPythonCommand(options);
    const args = [script, '--title', title];
    if (artifactRoot) args.push('--artifact-root', artifactRoot);
    return runProcess(python, args, root, [title], {
      classifyEmptyOutput: classifyMacPythonFailure,
    });
  }

  function runMacCurrentConversation(root, legacyAllowedTitles = []) {
    const script = path.join(root, 'scripts', 'current_conversation.py');
    if (!fs.existsSync(script)) {
      return Promise.resolve({
        ok: false,
        error: { code: 'CURRENT_CONVERSATION_SCRIPT_MISSING', message: '安装包内未找到当前微信会话识别组件' },
      });
    }
    const python = resolveMacPythonCommand(options);
    const args = [script];
    legacyAllowedTitles.forEach((title) => args.push('--include-title', title));
    if (artifactRoot) args.push('--artifact-root', artifactRoot);
    return runProcess(python, args, root, legacyAllowedTitles, {
      classifyEmptyOutput: classifyMacPythonFailure,
      parseOutput: parseCurrentConversationOutput,
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
      '200',
      '-DwellMilliseconds',
      '1000',
    ];
    return runProcess(powershell, args, path.dirname(script), allowedTitles, {
      mapOpenedCountToAllowedTitles: true,
      missingRuntimeCode: 'POWERSHELL_NOT_FOUND',
      missingRuntimeMessage: '未找到 Windows PowerShell，无法读取微信未读会话',
    });
  }

  function runWindowsCurrentConversation(
    script,
    legacyAllowedTitles = [],
    { requireForeground = false } = {}
  ) {
    const powershell = options.powershell || process.env.JCYX_WECHAT_UI_POWERSHELL || 'powershell.exe';
    const args = [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      script,
    ];
    if (artifactRoot) args.push('-ArtifactRoot', artifactRoot);
    if (requireForeground) args.push('-RequireForeground');
    return runProcess(powershell, args, path.dirname(script), legacyAllowedTitles, {
      parseOutput: parseCurrentConversationOutput,
      missingRuntimeCode: 'POWERSHELL_NOT_FOUND',
      missingRuntimeMessage: '未找到 Windows PowerShell，无法识别当前微信会话',
    });
  }

  function runWindowsFocusConversation(script, title) {
    const powershell = options.powershell || process.env.JCYX_WECHAT_UI_POWERSHELL || 'powershell.exe';
    const currentConversationScript = resolveWindowsCurrentConversationScript(options);
    const args = [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      script,
      '-Title',
      title,
      '-CurrentConversationScript',
      currentConversationScript,
    ];
    return runProcess(powershell, args, path.dirname(script), [title], {
      missingRuntimeCode: 'POWERSHELL_NOT_FOUND',
      missingRuntimeMessage: '未找到 Windows PowerShell，无法切换微信会话',
    });
  }

  return Object.freeze({
    async inspectUnread(input) {
      if (platform !== 'darwin') {
        return {
          ok: false,
          error: { code: 'UNSUPPORTED_PLATFORM', message: '当前系统暂不支持预览微信未读客户数' },
        };
      }
      if (activePromise) {
        return { ok: false, error: { code: 'BUSY', message: '微信界面自动化正在运行' } };
      }
      try {
        const allowedTitles = normalizeAllowedTitles(input);
        if (typeof options.ensureMacAccessibility === 'function'
            && !options.ensureMacAccessibility()) {
          return {
            ok: false,
            error: {
              code: 'MAC_ACCESSIBILITY_PERMISSION_REQUIRED',
              message: '请在“系统设置 → 隐私与安全性 → 辅助功能”中允许 GrainPrint 控制电脑',
            },
          };
        }
        if (typeof options.getMacScreenAccessStatus === 'function') {
          const status = String(options.getMacScreenAccessStatus() || 'unknown');
          if (status === 'denied' || status === 'restricted') {
            return {
              ok: false,
              error: {
                code: 'MAC_SCREEN_RECORDING_PERMISSION_REQUIRED',
                message: '请在“系统设置 → 隐私与安全性 → 屏幕录制”中允许 GrainPrint',
              },
            };
          }
        }
        return await runMacUnreadSummary(resolveMacAutomationRoot(options), allowedTitles);
      } catch (error) {
        return { ok: false, error: { code: 'INVALID_REQUEST', message: error.message } };
      }
    },
    async currentConversation(input) {
      if (platform !== 'darwin' && platform !== 'win32') {
        return {
          ok: false,
          error: { code: 'UNSUPPORTED_PLATFORM', message: '当前系统暂不支持识别所选微信好友' },
        };
      }
      // The Windows choice page performs a background title refresh as soon as
      // the docked workspace opens. If the user immediately presses button 2,
      // both calls ask for the exact same live WeChat header. Reuse the
      // in-flight read instead of reporting BUSY or launching a second helper.
      if (currentConversationPromise) return currentConversationPromise;
      if (activePromise) {
        return { ok: false, error: { code: 'BUSY', message: '微信界面自动化正在运行' } };
      }
      try {
        const legacyAllowedTitles = normalizeCurrentConversationInput(input);
        if (platform === 'win32') {
          currentConversationPromise = runWindowsCurrentConversation(
            resolveWindowsCurrentConversationScript(options),
            legacyAllowedTitles,
            { requireForeground: input?.requireForeground === true }
          );
          return await currentConversationPromise;
        }
        if (typeof options.ensureMacAccessibility === 'function'
            && !options.ensureMacAccessibility()) {
          return {
            ok: false,
            error: {
              code: 'MAC_ACCESSIBILITY_PERMISSION_REQUIRED',
              message: '请在“系统设置 → 隐私与安全性 → 辅助功能”中允许 GrainPrint 控制电脑',
            },
          };
        }
        if (typeof options.getMacScreenAccessStatus === 'function') {
          const status = String(options.getMacScreenAccessStatus() || 'unknown');
          if (status === 'denied' || status === 'restricted') {
            return {
              ok: false,
              error: {
                code: 'MAC_SCREEN_RECORDING_PERMISSION_REQUIRED',
                message: '请在“系统设置 → 隐私与安全性 → 屏幕录制”中允许 GrainPrint',
              },
            };
          }
        }
        currentConversationPromise = runMacCurrentConversation(
          resolveMacAutomationRoot(options),
          legacyAllowedTitles
        );
        return await currentConversationPromise;
      } catch (error) {
        return { ok: false, error: { code: 'INVALID_ARGUMENT', message: error.message } };
      } finally {
        currentConversationPromise = null;
      }
    },
    async focusConversation(input) {
      if (platform !== 'darwin' && platform !== 'win32') {
        return {
          ok: false,
          error: { code: 'UNSUPPORTED_PLATFORM', message: '当前系统暂不支持自动切换微信会话' },
        };
      }
      if (activePromise) {
        return { ok: false, error: { code: 'BUSY', message: '微信界面自动化正在运行' } };
      }
      try {
        const title = normalizeConversationTitle(input);
        if (platform === 'win32') {
          return await runWindowsFocusConversation(
            resolveWindowsFocusConversationScript(options),
            title
          );
        }
        if (typeof options.ensureMacAccessibility === 'function'
            && !options.ensureMacAccessibility()) {
          return {
            ok: false,
            error: {
              code: 'MAC_ACCESSIBILITY_PERMISSION_REQUIRED',
              message: '请在“系统设置 → 隐私与安全性 → 辅助功能”中允许 GrainPrint 控制电脑',
            },
          };
        }
        if (typeof options.getMacScreenAccessStatus === 'function') {
          const status = String(options.getMacScreenAccessStatus() || 'unknown');
          if (status === 'denied' || status === 'restricted') {
            return {
              ok: false,
              error: {
                code: 'MAC_SCREEN_RECORDING_PERMISSION_REQUIRED',
                message: '请在“系统设置 → 隐私与安全性 → 屏幕录制”中允许 GrainPrint',
              },
            };
          }
        }
        return await runMacFocus(resolveMacAutomationRoot(options), title);
      } catch (error) {
        return { ok: false, error: { code: 'INVALID_ARGUMENT', message: error.message } };
      }
    },
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
        if (platform === 'darwin' && typeof options.ensureMacAccessibility === 'function') {
          let accessibilityGranted = false;
          try {
            accessibilityGranted = Boolean(options.ensureMacAccessibility());
          } catch {
            accessibilityGranted = false;
          }
          if (!accessibilityGranted) {
            return {
              ok: false,
              error: {
                code: 'MAC_ACCESSIBILITY_PERMISSION_REQUIRED',
                message: '请在“系统设置 → 隐私与安全性 → 辅助功能”中允许 GrainPrint 控制电脑，然后重新点击“读取微信订单”',
              },
            };
          }
        }
        if (platform === 'darwin' && typeof options.getMacScreenAccessStatus === 'function') {
          let screenAccessStatus = 'unknown';
          try {
            screenAccessStatus = String(options.getMacScreenAccessStatus() || 'unknown');
          } catch {
            screenAccessStatus = 'unknown';
          }
          if (screenAccessStatus === 'denied' || screenAccessStatus === 'restricted') {
            return {
              ok: false,
              error: {
                code: 'MAC_SCREEN_RECORDING_PERMISSION_REQUIRED',
                message: '请在“系统设置 → 隐私与安全性 → 屏幕录制”中允许 GrainPrint，完全退出 GrainPrint 后重新打开',
              },
            };
          }
        }
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
  normalizeCurrentConversationInput,
  normalizeConversationTitle,
  parseAutomationOutput,
  parseUnreadSummaryOutput,
  parseCurrentConversationOutput,
  classifyMacPythonFailure,
  resolveMacAutomationRoot,
  resolveMacPythonCommand,
  resolveWindowsAutomationScript,
  resolveWindowsCurrentConversationScript,
  resolveWindowsFocusConversationScript,
};
