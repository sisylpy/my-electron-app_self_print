// src/main.js
const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  dialog,
  shell,
  Menu,
  safeStorage,
  systemPreferences,
  session: electronSession,
  desktopCapturer,
} = require('electron');
const path = require('path')
const fs = require('fs')
const packageMetadata = require('../package.json');
const {
  PRODUCTION_API_BASE_URL,
  TEST_API_BASE_URL,
  normalizeNongxinleApiBaseUrl,
} = require('./api-runtime');

const isDev = !app.isPackaged;
// 打包版必须保持 .app 内容只读；Python 默认生成的 __pycache__ 会破坏代码签名封印。
if (!isDev) process.env.PYTHONDONTWRITEBYTECODE = '1';

function resolveRuntimeMode() {
  const requestedMode = String(process.env.GRAIN_RUNTIME_MODE || '').trim();
  if (isDev) {
    if (requestedMode && requestedMode !== 'development') {
      throw new Error(`本地开发只允许 development 模式，收到：${requestedMode}`);
    }
    return 'development';
  }
  const packagedMode = String(packageMetadata.grainRuntimeMode || '').trim();
  if (!['test', 'production'].includes(packagedMode)) {
    throw new Error(`安装包缺少有效的 grainRuntimeMode：${packagedMode || '空'}`);
  }
  if (requestedMode && requestedMode !== packagedMode) {
    throw new Error(`安装包运行模式不可由环境变量覆盖：${packagedMode} != ${requestedMode}`);
  }
  return packagedMode;
}

const runtimeMode = resolveRuntimeMode();
// 运行环境是安全边界，不是页面展示选项：
// - 本地 Electron 源码只允许 development + 测试服务器 + 粒子-dev；
// - GrainPrint-Test 安装包只允许 test + 测试服务器 + 粒子-test；
// - 正式安装包只允许 production + 正式服务器 + 粒子。
// 测试用户 ID 登录只在前两种模式开放。不要按页面 URL、NODE_ENV 或已有登录状态
// 动态推断环境，否则会再次造成开发版误连正式服务器或隐藏测试登录入口。
const runtimeProfile = Object.freeze({
  development: {
    appName: '粒子-dev',
    userDataDirectory: '粒子-dev',
    apiBaseUrl: TEST_API_BASE_URL,
    allowsTestLogin: true,
  },
  test: {
    appName: '粒子测试版',
    userDataDirectory: '粒子-test',
    apiBaseUrl: TEST_API_BASE_URL,
    allowsTestLogin: true,
  },
  production: {
    appName: '粒子',
    userDataDirectory: '粒子',
    apiBaseUrl: PRODUCTION_API_BASE_URL,
    allowsTestLogin: false,
  },
}[runtimeMode]);

const runtimeApiBaseUrl = normalizeNongxinleApiBaseUrl(
  runtimeProfile.apiBaseUrl,
  `${runtimeMode} 运行环境 API`
);
for (const variableName of [
  'NXL_DISPATCH_API_BASE_URL',
  'NXL_ORDER_API_BASE_URL',
  'GRAIN_API_URL',
]) {
  const configuredValue = process.env[variableName];
  if (configuredValue
      && normalizeNongxinleApiBaseUrl(configuredValue, variableName) !== runtimeApiBaseUrl) {
    throw new Error(`${variableName} 与 ${runtimeMode} 运行环境不匹配`);
  }
  process.env[variableName] = runtimeApiBaseUrl;
}
process.env.GRAIN_RUNTIME_MODE = runtimeMode;
app.setName(runtimeProfile.appName);
app.setPath('userData', path.join(app.getPath('appData'), runtimeProfile.userDataDirectory));

const appLogger = require('./appLogger')
const {
  PRINT_RUNTIME_CONFIG,
  createCalibrationPrintOptions,
  createSilentPrintOptions,
  getDriverManagedDpiOptions,
} = require('./print/config');
const {
  assertDeviceConfigResponse,
  assertPrintMetadata,
  sanitizePrinterProfile,
} = require('./print/validation');
// 暂时禁用 @nut-tree 模块以避免打包问题
// let mouse, keyboard, Key;
// try {
//   const nutJs = require('@nut-tree/nut-js');
//   mouse = nutJs.mouse;
//   keyboard = nutJs.keyboard;
//   Key = nutJs.Key;
// } catch (error) {
//   console.warn('@nut-tree/nut-js not available:', error.message);
//   // 提供默认的空实现
//   mouse = { click: () => {}, move: () => {} };
//   keyboard = { pressKey: () => {}, releaseKey: () => {} };
//   Key = { Enter: 'Enter' };
// }

// 提供默认的空实现
const mouse = { click: () => {}, move: () => {} };
const keyboard = { pressKey: () => {}, releaseKey: () => {} };
const Key = { Enter: 'Enter' };
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const { pathToFileURL } = require('url');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const axios = require('axios');
const { createDispatchGateway } = require('./dispatch/dispatch-gateway');
const { createOrderWriteGateway } = require('./order/order-write-gateway');
const { createOrderSessionGateway } = require('./order/order-session-gateway');
const { createWechatReaderService, shutdownReader } = require('./wechat/reader-service');
const { createWechatUiAutomationService } = require('./wechat/ui-automation-service');
const { createWechatWorkspaceWindowService } = require('./wechat/workspace-window-service');
const { createWechatAutoReadScheduler } = require('./wechat/auto-read-scheduler');
const { detectWechatProcessOpen } = require('./wechat/process-state');
const { detectWechatLoginStateWithoutReader } = require('./wechat/login-state-probe');
const { createMacKeychainEducation } = require('./security/mac-keychain-education');
const {
  pushMcpPrintTaskToRenderer,
  acknowledgeMcpPrintTask,
  clearMcpPrintDeliveriesForWebContents
} = require('./mcp-print-push');
// ===== 3011 本地安全桥客户端（grain-print-mcp 连接器）=====
// 只做「连接/查询/订单预览」拉取与执行端防重复；真实出纸仍由既有渲染链路完成。
const mcpBridgeClient = require('./mcp-bridge-client');
const taskRunner = require('./mcp-task-runner');

let mainWindowRef = null; // 保存 mainWindow 引用供 MCP 使用
/** 3011 桥轮询定时器，需在 will-quit 中清理 */
let bridgePollingInterval = null;

// 注意：当前使用 HTTP API（一句话识别），不需要 WebSocket
// 如果需要实时流式识别，可以后续添加 WebSocket 支持

// 移除顶部的静态require，改为动态加载


const VUE3_DEVTOOLS_ID = 'ljjemllljcmogpfapbkkighbhhppjdbg';


let mainWindow;
let dispatchGateway = null;
let orderWriteGateway = null;
let orderSessionGateway = null;
let wechatReaderService = null;
let wechatUiAutomationService = null;
let wechatWorkspaceWindowService = null;
let wechatAutoReadScheduler = null;
let macKeychainEducation = null;
let macAccessibilityPromptRequested = false;
let wechatWorkspaceNativeCloseInProgress = false;
let windowsWechatSelectionObservationTimer = null;
let windowsWechatSelectionObservationRunning = false;
let windowsWechatSelectionObservationGeneration = 0;
let windowsWechatSelectionObservationLastTitle = '';
let windowsWechatVerifiedConversationTitle = '';
let windowsWechatSelectionObservationDeadline = 0;
let windowsWechatProgrammaticConversationFocusDepth = 0;
let quitAfterReaderShutdown = false;
let beforeQuitReaderPromise = null;
const selectedFolderCapabilities = new Set();
const saveFileCapabilities = new Set();
const pendingPrintedOrderSaves = new Map();
const PRINTED_ORDER_SAVE_TIMEOUT_MS = 60 * 1000;

function assertSuccessfulWriteResponse(response, operationName) {
  const responseData = response && response.data;
  if (responseData && Number(responseData.code) !== 0) {
    const error = new Error(responseData.msg || `${operationName}失败`);
    error.response = response;
    throw error;
  }
  return responseData;
}

function settlePrintedOrderSave(saveRequestId, error, result) {
  if (!saveRequestId) return;
  const pending = pendingPrintedOrderSaves.get(saveRequestId);
  if (!pending) return;
  pendingPrintedOrderSaves.delete(saveRequestId);
  clearTimeout(pending.timeoutId);
  if (error) {
    pending.reject(error);
  } else {
    pending.resolve(result);
  }
}

function requestPrintedOrderSave(printParams) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return savePrintBill(
      printParams.depFatherId,
      printParams.depId,
      printParams.tradeNo,
      printParams.userId,
      printParams.paperCount,
      printParams.orderIds
    );
  }

  const saveRequestId = crypto.randomUUID();
  const correlatedParams = { ...printParams, saveRequestId };
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingPrintedOrderSaves.delete(saveRequestId);
      reject(new Error('订单保存超时，请检查服务器连接后重试'));
    }, PRINTED_ORDER_SAVE_TIMEOUT_MS);
    pendingPrintedOrderSaves.set(saveRequestId, { resolve, reject, timeoutId });
    mainWindow.webContents.send('check-device-config-for-print', correlatedParams);
  });
}

function trustedRendererUrl(url) {
  if (typeof url !== 'string') return false;
  if (isDev) {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(parsed.hostname) &&
        parsed.port === '3000'
      );
    } catch {
      return false;
    }
  }
  try {
    const expectedUrl = pathToFileURL(
      path.join(__dirname, '../dist/vue/index.html')
    );
    const parsed = new URL(url);
    return (
      parsed.protocol === 'file:' &&
      parsed.origin === expectedUrl.origin &&
      parsed.pathname === expectedUrl.pathname
    );
  } catch {
    return false;
  }
}

function assertTrustedRendererEvent(event) {
  const sender = event && event.sender;
  const expected = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;
  const senderUrl =
    (event && event.senderFrame && event.senderFrame.url) ||
    (sender && !sender.isDestroyed() ? sender.getURL() : '');
  if (!expected || !sender || sender.id !== expected.id || !trustedRendererUrl(senderUrl)) {
    throw new Error('拒绝来自非可信渲染进程的 IPC 调用');
  }
}

function assertPrintHtml(printData) {
  if (typeof printData !== 'string' || printData.length === 0) {
    throw new Error('打印内容必须是非空 HTML 字符串');
  }
  if (Buffer.byteLength(printData, 'utf8') > PRINT_RUNTIME_CONFIG.maxHtmlBytes) {
    throw new Error('打印内容超过 50MB 限制');
  }
}

function serializePrintError(error) {
  if (!error) return '未知打印错误';
  if (typeof error === 'string') return error;
  return error.error || error.message || String(error);
}

function publishPrintJobStatus(status) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('print-job-status', {
    timestamp: new Date().toISOString(),
    ...status,
  });
}

async function runTrackedPrintJob(label, work) {
  const jobId = crypto.randomUUID();
  publishPrintJobStatus({ jobId, label, state: 'printing', message: `${label}正在发送到打印机` });
  try {
    const result = await work();
    publishPrintJobStatus({ jobId, label, state: 'success', message: `${label}已提交` });
    return result;
  } catch (error) {
    const printed = Boolean(error && error.printed);
    publishPrintJobStatus({
      jobId,
      label,
      state: 'failed',
      printed,
      retryable: !printed,
      message: printed
        ? `打印已提交，但订单保存失败：${serializePrintError(error)}`
        : `${label}失败：${serializePrintError(error)}`,
    });
    throw error;
  }
}

function getDispatchGateway() {
  if (!dispatchGateway) {
    dispatchGateway = createDispatchGateway({
      app,
      safeStorage,
      axios,
      isDev,
      renewDispatchSession: async () => {
        const result = await getOrderSessionGateway().refreshSession();
        // 续期失败时把失败结果带回网关：网络不可达（status 0）不能等同于登录失效，
        // 只有令牌确实失效才提示重新登录。
        return result.ok ? result.data?.dispatchAuth || null : result;
      },
    });
  }
  return dispatchGateway;
}

function getMacKeychainEducation() {
  if (!macKeychainEducation) {
    macKeychainEducation = createMacKeychainEducation({
      app,
      BrowserWindow,
      getParentWindow: () => mainWindow,
    });
  }
  return macKeychainEducation;
}

async function allowMacSecureStorage(intent) {
  const result = await getMacKeychainEducation().ensure(intent);
  if (result.ok) return null;
  return {
    ok: false,
    status: 499,
    errorCode: 'MAC_KEYCHAIN_EXPLANATION_CANCELLED',
    message: '尚未读取本机安全登录信息；需要时可重新进入此页面继续操作',
  };
}

function getOrderWriteGateway() {
  if (!orderWriteGateway) {
    orderWriteGateway = createOrderWriteGateway({
      axios,
      appLogger,
      apiBaseUrl: runtimeApiBaseUrl,
    });
  }
  return orderWriteGateway;
}

function getOrderSessionGateway() {
  if (!orderSessionGateway) {
    orderSessionGateway = createOrderSessionGateway({
      axios,
      apiBaseUrl: runtimeApiBaseUrl,
      cookieStore: electronSession.defaultSession.cookies,
      rememberTokenStore: getRememberTokenStore(),
      rememberEnabled: () => {
        try {
          return fs.readFileSync(getRememberPrinterUserFlagPath(), 'utf8').trim() === '1';
        } catch {
          return false;
        }
      },
    });
  }
  return orderSessionGateway;
}

function getWechatReaderService() {
  if (!wechatReaderService) {
    wechatReaderService = createWechatReaderService(appLogger);
  }
  return wechatReaderService;
}

function isMacAccessibilityTrusted(prompt = false) {
  if (process.platform !== 'darwin') return true;
  const shouldPrompt = prompt === true && !macAccessibilityPromptRequested;
  if (shouldPrompt) macAccessibilityPromptRequested = true;
  return systemPreferences.isTrustedAccessibilityClient(shouldPrompt);
}

function getWechatUiAutomationService() {
  if (!wechatUiAutomationService) {
    wechatUiAutomationService = createWechatUiAutomationService({
      artifactRoot: path.join(app.getPath('userData'), 'wechat-ui-private-artifacts'),
      ensureMacAccessibility: () => isMacAccessibilityTrusted(true),
      getMacScreenAccessStatus: () => systemPreferences.getMediaAccessStatus('screen'),
    });
  }
  return wechatUiAutomationService;
}

async function shutdownWechatUiAutomation() {
  const service = wechatUiAutomationService;
  if (!service) return;
  wechatUiAutomationService = null;
  await service.dispose();
}

function getWechatWorkspaceWindowService() {
  if (!wechatWorkspaceWindowService) {
    wechatWorkspaceWindowService = createWechatWorkspaceWindowService({
      screen,
      desktopCapturer,
      execFileAsync,
      getMainWindow: () => mainWindow,
      ensureMacAccessibility: prompt => isMacAccessibilityTrusted(prompt),
    });
  }
  return wechatWorkspaceWindowService;
}

async function shutdownWechatWorkspaceWindow() {
  const service = wechatWorkspaceWindowService;
  if (!service) return;
  wechatWorkspaceWindowService = null;
  await service.dispose();
}

function rememberWindowsWechatConversationTitle(value) {
  if (process.platform !== 'win32') return '';
  const title = String(value || '').trim();
  if (title) windowsWechatSelectionObservationLastTitle = title;
  return title;
}

function stopWindowsWechatSelectionObservation({ resetTitle = false } = {}) {
  windowsWechatSelectionObservationGeneration += 1;
  windowsWechatSelectionObservationDeadline = 0;
  if (windowsWechatSelectionObservationTimer) {
    clearTimeout(windowsWechatSelectionObservationTimer);
    windowsWechatSelectionObservationTimer = null;
  }
  if (resetTitle) {
    windowsWechatSelectionObservationLastTitle = '';
    windowsWechatVerifiedConversationTitle = '';
  }
}

function scheduleWindowsWechatSelectionObservation(delayMs = 220) {
  if (process.platform !== 'win32'
      || !windowsWechatSelectionObservationDeadline
      || Date.now() >= windowsWechatSelectionObservationDeadline) return;
  if (windowsWechatSelectionObservationTimer) {
    clearTimeout(windowsWechatSelectionObservationTimer);
  }
  const generation = windowsWechatSelectionObservationGeneration;
  windowsWechatSelectionObservationTimer = setTimeout(async () => {
    windowsWechatSelectionObservationTimer = null;
    if (generation !== windowsWechatSelectionObservationGeneration
        || !mainWindow
        || mainWindow.isDestroyed()) return;
    if (mainWindow.isFocused()) {
      scheduleWindowsWechatSelectionObservation(450);
      return;
    }
    if (windowsWechatSelectionObservationRunning) {
      scheduleWindowsWechatSelectionObservation(180);
      return;
    }
    windowsWechatSelectionObservationRunning = true;
    try {
      const result = await getWechatUiAutomationService().currentConversation({
        requireForeground: true,
      });
      const title = String(result?.result?.title || '').trim();
      if (generation !== windowsWechatSelectionObservationGeneration
          || !result?.ok
          || !title
          || !mainWindow
          || mainWindow.isDestroyed()) return;
      const previousTitle = windowsWechatSelectionObservationLastTitle;
      const selectionChanged = !previousTitle || previousTitle !== title;
      windowsWechatSelectionObservationLastTitle = title;

      // The first foreground observation is also a real selection: the app
      // may have opened inactive (or been restarted while Weixin stayed in
      // front), in which case Electron never receives a blur event. Treat that
      // first visible title as changed so the right-hand page and focus both
      // recover without requiring an extra click.
      if (selectionChanged) {
        appLogger.append('info', 'wechat-ui', 'observed Windows Weixin conversation', {
          previousTitle,
          title,
          selectionChanged,
        });
        mainWindow.webContents.send('wechat-ui-conversation-changed', {
          title,
          avatarDataUrl: '',
          selectionChanged,
        });
        windowsWechatSelectionObservationDeadline = 0;
      }
    } catch {
      // Losing focus to another desktop app is normal. Only a foreground
      // Weixin window produces a selection event; all other blur events are
      // deliberately ignored without bringing Weixin forward.
    } finally {
      windowsWechatSelectionObservationRunning = false;
      // A blur event fires only once when focus moves from GrainPrint to
      // Weixin. The user may then click several different Weixin rows without
      // another blur event, so keep observing until GrainPrint is focused
      // again or the side-by-side workspace closes.
      if (generation === windowsWechatSelectionObservationGeneration
          && mainWindow
          && !mainWindow.isDestroyed()
          && Date.now() < windowsWechatSelectionObservationDeadline) {
        scheduleWindowsWechatSelectionObservation(mainWindow.isFocused() ? 450 : 260);
      }
    }
  }, delayMs);
  windowsWechatSelectionObservationTimer.unref?.();
}

function beginWindowsWechatSelectionObservation() {
  if (process.platform !== 'win32' || windowsWechatProgrammaticConversationFocusDepth > 0) return;
  // Weixin can briefly report the old row while it is repainting a manual
  // click. Keep a bounded retry window instead of relying on the workspace
  // service's in-memory session, which may be absent after app/task recovery.
  windowsWechatSelectionObservationDeadline = Date.now() + 12000;
  scheduleWindowsWechatSelectionObservation();
}

function getCustomerFoldersConfigPath() {
  return path.join(app.getPath('userData'), 'customer-folders.json');
}

function normalizeAbsolutePath(candidatePath) {
  if (typeof candidatePath !== 'string' || candidatePath.length === 0 || candidatePath.length > 4096) {
    throw new Error('文件路径无效');
  }
  return path.resolve(candidatePath);
}

function realPathIfExists(candidatePath) {
  const absolutePath = normalizeAbsolutePath(candidatePath);
  if (!fs.existsSync(absolutePath)) return absolutePath;
  return fs.realpathSync.native ? fs.realpathSync.native(absolutePath) : fs.realpathSync(absolutePath);
}

function isPathWithin(candidatePath, rootPath) {
  const candidate = realPathIfExists(candidatePath);
  const root = realPathIfExists(rootPath);
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function getConfiguredCustomerRoots() {
  try {
    const configPath = getCustomerFoldersConfigPath();
    if (!fs.existsSync(configPath)) return [];
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return Object.values(config)
      .filter((value) => typeof value === 'string' && path.isAbsolute(value))
      .map((value) => realPathIfExists(value));
  } catch (error) {
    console.warn('[文件权限] 客户文件夹配置读取失败:', error.message);
    return [];
  }
}

function assertAuthorizedCustomerPath(candidatePath) {
  const roots = [
    ...selectedFolderCapabilities,
    ...getConfiguredCustomerRoots()
  ];
  if (!roots.some((root) => isPathWithin(candidatePath, root))) {
    throw new Error('文件路径不在已授权的客户文件夹内');
  }
}

// 低内存优化：生产环境下启用 Chromium 内存节省开关（客户电脑内存不足时减少卡顿）
if (!isDev && process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-background-networking');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  app.commandLine.appendSwitch('disable-background-timer-throttling');
  app.commandLine.appendSwitch('disable-extensions');
  app.commandLine.appendSwitch('disable-features', 'TranslateUI');
  // 可选：--disable-gpu 在部分老旧显卡上可减少显存，若出现花屏可注释
  // app.commandLine.appendSwitch('disable-gpu');
}

// 创建中文菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '取消自动登录',
          click: () => {
            clearAutoLoginFromMenu().catch((err) => console.error('[取消自动登录]', err));
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: '切换开发者工具', accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '切换全屏', accelerator: process.platform === 'darwin' ? 'Ctrl+Cmd+F' : 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: '窗口',
      submenu: [
        { label: '最小化', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: '关闭', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '打开日志文件夹',
          click: () => {
            const dir = appLogger.getLogDir();
            shell.openPath(dir);
          }
        },
        { type: 'separator' },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: '订单管理系统',
              detail: '版本 1.0.0'
            });
          }
        }
      ]
    }
  ];

  // macOS 特殊处理
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { label: '关于 ' + app.getName(), role: 'about' },
        { type: 'separator' },
        { label: '服务', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: '隐藏 ' + app.getName(), accelerator: 'Command+H', role: 'hide' },
        { label: '隐藏其他', accelerator: 'Command+Shift+H', role: 'hideOthers' },
        { label: '显示全部', role: 'unhide' },
        { type: 'separator' },
        { label: '退出', accelerator: 'Command+Q', click: () => app.quit() }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function getRememberPrinterUserFlagPath() {
  return path.join(app.getPath('userData'), 'remember-printer-user.flag');
}

function getRememberTokenPath() {
  return path.join(app.getPath('userData'), 'desktop-remember-token.json');
}

let rememberTokenStore = null;

/** 自动登录令牌只存主进程 userData，文件权限 600，渲染进程永远读不到。 */
function getRememberTokenStore() {
  if (rememberTokenStore) return rememberTokenStore;
  const file = getRememberTokenPath();
  rememberTokenStore = {
    async read() {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return typeof parsed?.token === 'string' && parsed.token ? parsed.token : null;
      } catch {
        return null;
      }
    },
    async write(token) {
      try {
        fs.writeFileSync(file, JSON.stringify({ token, savedAt: new Date().toISOString() }),
          { mode: 0o600 });
        try { fs.chmodSync(file, 0o600); } catch { /* 已存在的文件沿用受限权限 */ }
      } catch (e) {
        console.error('[自动登录令牌] 写入失败', e);
      }
    },
    async clear() {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch (e) {
        console.error('[自动登录令牌] 清除失败', e);
      }
    },
  };
  return rememberTokenStore;
}

function getWechatAutoReadConfigPath() {
  return path.join(app.getPath('userData'), 'wechat-auto-read.json');
}

function serializeWechatAutoReadConfig(config) {
  return {
    enabled: config?.enabled === true,
    times: (Array.isArray(config?.times) ? config.times : []).map(time => String(time)),
  };
}

async function deliverScheduledWechatAutoRead(trigger) {
  let target = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  if (!target) {
    await createWindow();
    // 页面加载完成后由下一次调度 tick 再投递，避免事件早于 preload/App 监听器。
    return false;
  }
  if (target.webContents.isDestroyed() || target.webContents.isLoading()) return false;
  target.webContents.send('wechat-auto-read-trigger', trigger);
  return true;
}

function getLaunchAtLoginState() {
  const platformSupported = process.platform === 'darwin' || process.platform === 'win32';
  if (!platformSupported) {
    return {
      ok: true,
      supported: false,
      enabled: false,
      message: '当前系统不支持开机自启设置',
    };
  }
  if (!app.isPackaged) {
    return {
      ok: true,
      supported: false,
      enabled: false,
      message: '安装后的正式桌面客户端支持开机自启',
    };
  }
  const settings = app.getLoginItemSettings();
  return {
    ok: true,
    supported: true,
    enabled: Boolean(settings.openAtLogin),
    message: '',
  };
}

async function clearAutoLoginFromMenu() {
  try {
    const p = getRememberPrinterUserFlagPath();
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
    // 菜单取消自动登录同样清掉本机长会话令牌。
    await getRememberTokenStore().clear();
  } catch (e) {
    console.error('[取消自动登录] 删除标志文件失败', e);
  }

  const win = BrowserWindow.getFocusedWindow() || mainWindow;
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send('clear-remember-printer-user');
    } catch (e) {
      console.error('[取消自动登录] 渲染进程清理失败', e);
    }
  }

  dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, {
    type: 'info',
    title: '已取消自动登录',
    message: '已关闭「记住用户」自动进入账单。',
    detail: '下次启动应用后需从轮播页进入并扫码登录。当前窗口可继续使用。',
    buttons: ['确定'],
  });
}

/** 注册 IPC handlers（只执行一次，避免 createWindow 多次调用时重复注册导致报错） */
function setupIpcHandlers() {
  ipcMain.handle('app-launch-at-login-get', async (event) => {
    assertTrustedRendererEvent(event);
    return getLaunchAtLoginState();
  });
  ipcMain.handle('app-launch-at-login-set', async (event, enabled) => {
    assertTrustedRendererEvent(event);
    const current = getLaunchAtLoginState();
    if (!current.supported) return current;
    app.setLoginItemSettings({ openAtLogin: enabled === true });
    return getLaunchAtLoginState();
  });

  ipcMain.handle('wechat-auto-read-config-get', async (event) => {
    assertTrustedRendererEvent(event);
    return { ok: true, ...serializeWechatAutoReadConfig(wechatAutoReadScheduler.getConfig()) };
  });
  ipcMain.handle('wechat-auto-read-config-set', async (event, input) => {
    assertTrustedRendererEvent(event);
    const saved = wechatAutoReadScheduler.setConfig(serializeWechatAutoReadConfig(input));
    return { ok: true, ...serializeWechatAutoReadConfig(saved) };
  });
  ipcMain.handle('wechat-auto-read-customer-get', async (event, input) => {
    assertTrustedRendererEvent(event);
    return {
      ok: true,
      participates: wechatAutoReadScheduler.getCustomerParticipation(
        input?.distributerId,
        input?.customerId
      ),
    };
  });
  ipcMain.handle('wechat-auto-read-customer-set', async (event, input) => {
    assertTrustedRendererEvent(event);
    return {
      ok: true,
      participates: wechatAutoReadScheduler.setCustomerParticipation(
        input?.distributerId,
        input?.customerId,
        input?.participates === true
      ),
    };
  });
  ipcMain.handle('wechat-auto-read-finish', async (event, runId) => {
    assertTrustedRendererEvent(event);
    return { ok: wechatAutoReadScheduler.finish(runId) };
  });

  // 正式包的 file:// 页面不直接持有跨站订单会话；只暴露扫码轮询和两条固定订单读取接口。
  ipcMain.handle('order-session-test-login', async (event, userId) => {
    assertTrustedRendererEvent(event);
    if (!runtimeProfile.allowsTestLogin) {
      return { ok: false, status: 403, message: '测试 ID 登录仅在开发版或测试安装版可用' };
    }
    return getOrderSessionGateway().testLogin(userId);
  });
  ipcMain.handle('order-session-poll-login', async (event, sessionId) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理登录' };
    return getOrderSessionGateway().pollLogin(sessionId);
  });
  ipcMain.handle('order-session-today-customers', async (event, disId) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理读取订单' };
    return getOrderSessionGateway().todayCustomers(disId);
  });
  ipcMain.handle('order-session-workbench-overview', async (event, disId) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理读取订单' };
    return getOrderSessionGateway().orderWorkbenchOverview(disId);
  });
  ipcMain.handle('order-session-pick-list-categories', async (event, input) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理读取订单' };
    return getOrderSessionGateway().pickListCategories(input);
  });
  ipcMain.handle('order-session-pick-list-category-goods', async (event, input) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理读取订单' };
    return getOrderSessionGateway().pickListCategoryGoods(input);
  });
  ipcMain.handle('order-session-pick-list-shelves', async (event, input) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理读取订单' };
    return getOrderSessionGateway().pickListShelves(input);
  });
  ipcMain.handle('order-session-pick-list-shelf-goods', async (event, input) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理读取订单' };
    return getOrderSessionGateway().pickListShelfGoods(input);
  });
  ipcMain.handle('order-session-pick-list-finish-order', async (event, input) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理写入订单' };
    return getOrderSessionGateway().pickListFinishOrder(input);
  });
  ipcMain.handle('order-session-ocr-task-status', async (event, taskId) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理读取订单' };
    return getOrderSessionGateway().ocrTaskStatus(taskId);
  });
  ipcMain.handle('order-session-phone-orders', async (event, input) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理读取订单' };
    return getOrderSessionGateway().phoneOrders(input);
  });
  ipcMain.handle('order-session-recognize-qwen', async (event, input) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理识别订单' };
    return getOrderSessionGateway().recognizeOrderQwen(input);
  });
  ipcMain.handle('order-session-refresh', async (event) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理登录' };
    return getOrderSessionGateway().refreshSession();
  });
  ipcMain.handle('order-session-issue-token', async (event) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理登录' };
    return getOrderSessionGateway().issueRememberToken();
  });
  ipcMain.handle('order-session-recognize-async', async (event, input) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理识别订单' };
    return getOrderSessionGateway().recognizeOrderAsync(input);
  });
  ipcMain.handle('order-session-logout', async (event, options) => {
    assertTrustedRendererEvent(event);
    if (isDev) return { ok: false, status: 403, message: '开发态请使用同源代理退出登录' };
    return getOrderSessionGateway().logout(options);
  });

  // 订单写请求由主进程发送，避免 Electron 渲染层的 file/localhost Origin 被服务端拒绝。
  // 这里只开放经过校验的“保存粘贴订单”，不提供任意 URL 或任意 HTTP 代理。
  ipcMain.handle('order-write-save-paste-orders', async (event, payload) => {
    assertTrustedRendererEvent(event);
    return getOrderWriteGateway().savePasteOrders(payload);
  });

  // 本地微信 Reader：只开放有限 DTO 方法；路径、子进程、密钥材料均不跨 preload。
  ipcMain.handle('wechat-reader-diagnose', async (event) => {
    assertTrustedRendererEvent(event);
    return getWechatReaderService().diagnose();
  });
  ipcMain.handle('wechat-reader-list-accounts', async (event) => {
    assertTrustedRendererEvent(event);
    return getWechatReaderService().listAccounts();
  });
  ipcMain.handle('wechat-reader-warm-up', async (event) => {
    assertTrustedRendererEvent(event);
    return getWechatReaderService().warmUp();
  });
  ipcMain.handle('wechat-reader-find-conversation', async (event, input) => {
    assertTrustedRendererEvent(event);
    return getWechatReaderService().findConversation(input);
  });
  ipcMain.handle('wechat-reader-get-participants', async (event, input) => {
    assertTrustedRendererEvent(event);
    return getWechatReaderService().getParticipants(input);
  });
  ipcMain.handle('wechat-reader-get-self-participant', async (event, input) => {
    assertTrustedRendererEvent(event);
    return getWechatReaderService().getSelfParticipant(input);
  });
  ipcMain.handle('wechat-reader-get-messages', async (event, input) => {
    assertTrustedRendererEvent(event);
    return getWechatReaderService().getMessages(input);
  });
  ipcMain.handle('wechat-reader-get-attachment', async (event, input) => {
    assertTrustedRendererEvent(event);
    return getWechatReaderService().getAttachment(input);
  });
  ipcMain.handle('wechat-reader-last-cold-start', async (event) => {
    assertTrustedRendererEvent(event);
    return getWechatReaderService().lastColdStart();
  });
  ipcMain.handle('wechat-ui-inspect-unread', async (event, input) => {
    assertTrustedRendererEvent(event);
    try {
      return await getWechatUiAutomationService().inspectUnread(input);
    } finally {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  ipcMain.handle('wechat-ui-read-unread', async (event, input) => {
    assertTrustedRendererEvent(event);
    try {
      return await getWechatUiAutomationService().readUnread(input);
    } finally {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  ipcMain.handle('wechat-ui-current-conversation', async (event, input) => {
    assertTrustedRendererEvent(event);
    // includeAvatar is a main-process presentation option. Keep it out of the
    // strict automation request whitelist so title recognition retains its
    // existing input contract and continues rejecting every unknown field.
    const { includeAvatar = true, ...automationInput } = input || {};
    const result = await getWechatUiAutomationService().currentConversation(automationInput);
    if (!result?.ok || !result.result) return result;
    rememberWindowsWechatConversationTitle(result.result.title);
    if (includeAvatar !== false) {
      try {
        const avatarDataUrl = await wechatWorkspaceWindowService
          ?.captureSelectedConversationAvatar?.();
        if (avatarDataUrl) result.result.avatarDataUrl = avatarDataUrl;
      } catch {
        // Avatar is presentation-only; title/order reading must still succeed.
      }
    }
    // This read is also used as a passive Windows observer while the user is
    // clicking Weixin. Do not steal focus here: the renderer returns focus to
    // GrainPrint only after it has confirmed and applied a different title.
    return result;
  });
  ipcMain.handle('wechat-ui-focus-conversation', async (event, input) => {
    assertTrustedRendererEvent(event);
    const resumeConversationWatcher = await getWechatWorkspaceWindowService()
      .suspendConversationWatcher?.() || (() => {});
    const focusStartedAt = Date.now();
    let automationFinishedAt = 0;
    let automationOk = false;
    let automationMetrics = {};
    let automationDetails = [];
    let requestedTitle = '';
    let needsWorkspaceFocus = true;
    windowsWechatProgrammaticConversationFocusDepth += 1;
    stopWindowsWechatSelectionObservation();
    try {
      requestedTitle = String(input?.title || '').normalize('NFKC').trim();
      let result = null;
      // If GrainPrint never lost focus after the last exact switch, Weixin
      // cannot have been changed by the user. Re-clicking that same task is a
      // no-op and should not flash a several-second switching mask.
      if (process.platform === 'win32'
          && input?.forceReselect !== true
          && requestedTitle
          && mainWindow?.isFocused?.()
          && windowsWechatVerifiedConversationTitle === requestedTitle) {
        result = {
          ok: true,
          result: {
            code: 'SUCCESS',
            message: `微信会话“${requestedTitle}”已经打开`,
            metrics: {
              platform: 'win32',
              method: 'verified-foreground-title-reused',
              totalMs: 0,
            },
            openedTitles: [requestedTitle],
            candidateTitles: [requestedTitle],
            details: ['VERIFIED_FOREGROUND_TITLE_REUSED'],
          },
        };
        needsWorkspaceFocus = false;
      }
      // Most task-card clicks target the conversation that is already open on
      // the left. Use the observer's last title only as a hint, then verify the
      // visible Weixin header before skipping the expensive search. A stale
      // hint therefore costs one check but can never open/read the wrong chat.
      if (!result
          && process.platform === 'win32'
          && input?.forceReselect !== true
          && requestedTitle
          && windowsWechatSelectionObservationLastTitle === requestedTitle) {
        const verifyStartedAt = Date.now();
        const current = await getWechatUiAutomationService().currentConversation({
          requireForeground: false,
        });
        if (current?.ok && current.result?.title === requestedTitle) {
          const verifyMs = Date.now() - verifyStartedAt;
          result = {
            ok: true,
            result: {
              code: 'SUCCESS',
              message: `微信会话“${requestedTitle}”已经打开`,
              metrics: {
                platform: 'win32',
                method: 'visible-header-already-matched',
                totalMs: verifyMs,
              },
              openedTitles: [requestedTitle],
              candidateTitles: [requestedTitle],
              details: ['VISIBLE_HEADER_ALREADY_MATCHED'],
            },
          };
        }
      }
      if (!result) {
        result = await getWechatUiAutomationService().focusConversation(input);
      }
      automationFinishedAt = Date.now();
      automationOk = result?.ok === true;
      automationMetrics = result?.result?.metrics || {};
      automationDetails = Array.isArray(result?.result?.details)
        ? result.result.details
        : [];
      if (result?.ok) rememberWindowsWechatConversationTitle(input?.title);
      return result;
    } finally {
      if (!automationFinishedAt) automationFinishedAt = Date.now();
      windowsWechatProgrammaticConversationFocusDepth = Math.max(
        0,
        windowsWechatProgrammaticConversationFocusDepth - 1
      );
      // Searching/clicking a conversation necessarily activates WeChat. The
      // two windows remain visible side by side, but GrainPrint must become the
      // active app again or macOS consumes the user's next click merely to
      // activate Electron instead of pressing the intended button.
      try {
        if (mainWindow && !mainWindow.isDestroyed() && needsWorkspaceFocus) {
          // A plain BrowserWindow.focus() is not enough after a PowerShell UIA
          // helper activates Weixin on Windows: the first click would only
          // reactivate Electron. The workspace service performs the native HWND
          // foreground hand-off and falls back to Electron focus elsewhere.
          await getWechatWorkspaceWindowService().focus();
        }
      } finally {
        // Resume only after GrainPrint is frontmost again. Otherwise the Mac
        // observer can race the final exact-title verification and rebuild the
        // same accessibility tree in a second osascript process.
        resumeConversationWatcher();
      }
      if (automationOk && requestedTitle) {
        windowsWechatVerifiedConversationTitle = requestedTitle;
      }
      appLogger.append('info', 'wechat-ui', 'conversation focus timing', {
        automationOk,
        automationMs: automationFinishedAt - focusStartedAt,
        automationReportedMs: Number(automationMetrics.totalMs || 0),
        automationDetails,
        appFocusMs: Date.now() - automationFinishedAt,
        totalMs: Date.now() - focusStartedAt,
      });
    }
  });
  ipcMain.handle('wechat-ui-workspace-open', async (event) => {
    assertTrustedRendererEvent(event);
    const startedAt = Date.now();
    const result = await getWechatWorkspaceWindowService().open();
    appLogger.append(result?.ok ? 'info' : 'warn', 'wechat-ui', 'workspace open', {
      durationMs: Date.now() - startedAt,
      mode: result?.result?.mode || '',
      layout: result?.result?.app || null,
      actualBounds: mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : null,
      errorCode: result?.error?.code || '',
      errorDetails: result?.error?.details || '',
    });
    return result;
  });
  ipcMain.handle('wechat-ui-workspace-focus', async (event) => {
    assertTrustedRendererEvent(event);
    return getWechatWorkspaceWindowService().focus();
  });
  ipcMain.handle('wechat-ui-workspace-close', async (event) => {
    assertTrustedRendererEvent(event);
    stopWindowsWechatSelectionObservation({ resetTitle: true });
    return getWechatWorkspaceWindowService().close();
  });

  // 桌面调度：token 只存在主进程，渲染进程仅能调用以下白名单能力。
  ipcMain.handle('dispatch-auth-get-session', async (event) => {
    assertTrustedRendererEvent(event);
    const blocked = await allowMacSecureStorage('read');
    if (blocked) return blocked;
    return getDispatchGateway().getSession();
  });
  ipcMain.handle('dispatch-auth-adopt-login-session', async (event, auth, options) => {
    assertTrustedRendererEvent(event);
    if (options?.persistSession !== false) {
      const blocked = await allowMacSecureStorage('write');
      if (blocked) return blocked;
    }
    return getDispatchGateway().adoptLoginSession(auth, options);
  });
  ipcMain.handle('user-session-logout', async (event, options) => {
    assertTrustedRendererEvent(event);
    const cleanupWarnings = [];
    if (!isDev) {
      try {
        // 「记住用户」是设置里明确开启的偏好：退出登录只结束当前会话，
        // 不撤销自动登录令牌，否则下次启动又要求扫码，偏好形同虚设。
        const orderSessionLogout = await getOrderSessionGateway()
          .logout({ keepRememberToken: true });
        if (!orderSessionLogout.ok) cleanupWarnings.push(orderSessionLogout.message);
      } catch (error) {
        cleanupWarnings.push(error?.message || '订单会话清理失败');
      }
    }
    if (options?.clearRememberPreference === true) {
      const rememberFlagPath = getRememberPrinterUserFlagPath();
      try {
        if (fs.existsSync(rememberFlagPath)) {
          fs.unlinkSync(rememberFlagPath);
        }
        await getRememberTokenStore().clear();
      } catch (error) {
        cleanupWarnings.push(error?.message || '自动登录标志清理失败');
        appLogger.append('warn', 'logout', 'remember-user-flag-clear-failed', {
          message: error?.message,
        });
      }
    }

    let dispatchResult = { ok: true };
    try {
      dispatchResult = await getDispatchGateway().logout();
    } catch (error) {
      dispatchResult = {
        ok: false,
        message: error?.message || '派单登录缓存清理失败',
      };
      cleanupWarnings.push(dispatchResult.message);
    }

    const rendererSession = event.sender?.session;
    if (rendererSession) {
      const storageResults = await Promise.allSettled([
        rendererSession.clearStorageData({ storages: ['cookies'] }),
        rendererSession.clearCache(),
      ]);
      storageResults.forEach((result) => {
        if (result.status === 'rejected') {
          cleanupWarnings.push(result.reason?.message || '浏览器登录缓存清理失败');
        }
      });
    }
    return {
      ok: cleanupWarnings.length === 0,
      dispatchSessionCleared: dispatchResult?.ok !== false,
      message: cleanupWarnings.join('；'),
    };
  });
  ipcMain.handle('user-session-test-login', async (event, userId) => {
    assertTrustedRendererEvent(event);
    if (!runtimeProfile.allowsTestLogin) {
      return { ok: false, status: 403, message: '测试 ID 登录仅在开发版或测试安装版可用' };
    }
    return getDispatchGateway().testLogin(userId);
  });
  ipcMain.handle('dispatch-get-capabilities', async (event) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().capabilities();
  });
  ipcMain.handle('dispatch-create-idempotency-key', async (event) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().createId();
  });
  ipcMain.handle('dispatch-confirm-stop', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().confirmStop(command);
  });
  ipcMain.handle('dispatch-preview-route', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().previewRoute(command);
  });
  ipcMain.handle('dispatch-preview-route-expansion', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().previewRouteExpansion(command);
  });
  ipcMain.handle('dispatch-release-route-preview', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().releaseRoutePreview(command);
  });
  ipcMain.handle('dispatch-load-route-edit-page', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadRouteEditPage(command);
  });
  ipcMain.handle('dispatch-confirm-route', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().confirmRoute(command);
  });
  ipcMain.handle('dispatch-lock-planning-stop', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().lockPlanningStop(command);
  });
  ipcMain.handle('dispatch-unlock-planning-stop', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().unlockPlanningStop(command);
  });
  ipcMain.handle('dispatch-update-driver-employment', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().updateDriverEmployment(command);
  });
  ipcMain.handle('dispatch-driver-duty-on', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().checkInDriver(command);
  });
  ipcMain.handle('dispatch-driver-duty-off', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().checkOutDriver(command);
  });
  ipcMain.handle('dispatch-update-stop-time-window', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().updateStopTimeWindow(command);
  });
  ipcMain.handle('dispatch-return-stop-to-sandbox', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().returnStopToSandbox(command);
  });
  ipcMain.handle('dispatch-load-manual-driver-panorama', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadManualDispatchPanorama(command);
  });
  ipcMain.handle('dispatch-depart-driver', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().departDriver(command);
  });
  ipcMain.handle('dispatch-complete-delivery-stop', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().completeDeliveryStop(command);
  });
  ipcMain.handle('dispatch-return-delivery-stop-to-sandbox', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().returnDeliveryStopToSandbox(command);
  });
  ipcMain.handle('dispatch-preview-route-reassignment', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().previewRouteReassignment(command);
  });
  ipcMain.handle('dispatch-confirm-route-reassignment', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().confirmRouteReassignment(command);
  });
  ipcMain.handle('dispatch-map-load-tile', async (event, tile) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadMapTile(tile);
  });
  ipcMain.handle('dispatch-map-load-config', async (event) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadMapConfig();
  });
  ipcMain.handle('customer-history-load-months', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadCustomerHistory(command);
  });
  ipcMain.handle('commercial-entitlement-load', async (event) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadCommercialEntitlement();
  });
  ipcMain.handle('customer-ocr-training-list', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().listCustomerOcrTasks(command);
  });
  ipcMain.handle('customer-ocr-training-detail', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadCustomerOcrTask(command);
  });
  ipcMain.handle('customer-ocr-training-create', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().createCustomerOcrTraining(command);
  });
  ipcMain.handle('customer-ocr-training-update-item', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().updateCustomerOcrTrainingItem(command);
  });
  ipcMain.handle('customer-ocr-training-delete-item', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().deleteCustomerOcrTrainingItem(command);
  });
  ipcMain.handle('customer-ocr-training-delete', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().deleteCustomerOcrTraining(command);
  });
  ipcMain.handle('customer-ocr-training-complete', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().completeCustomerOcrTraining(command);
  });
  ipcMain.handle('customer-wechat-binding-load', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadCustomerWechatBinding(command);
  });
  ipcMain.handle('customer-wechat-binding-save', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().saveCustomerWechatBinding(command);
  });
  ipcMain.handle('customer-wechat-binding-clear', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().clearCustomerWechatBinding(command);
  });
  ipcMain.handle('customer-wechat-scan-v2-commit', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().commitReliableWechatScan(command);
  });
  ipcMain.handle('customer-wechat-task-v2-claim', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().claimWechatTask(command);
  });
  ipcMain.handle('customer-wechat-task-v2-pending', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadPendingWechatTasks(command);
  });
  ipcMain.handle('customer-wechat-task-v2-discard', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().discardWechatTasks(command);
  });
  ipcMain.handle('customer-wechat-task-v2-ignore', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().ignoreWechatTasks(command);
  });
  ipcMain.handle('customer-wechat-messages-v2-pending', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadPendingWechatMessages(command);
  });
  ipcMain.handle('customer-wechat-task-v2-draft', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().updateWechatTaskDraft(command);
  });
  ipcMain.handle('customer-wechat-attachment-v2-report', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().reportWechatAttachment(command);
  });
  ipcMain.handle('customer-wechat-mixed-image-v2-ack', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().acknowledgeWechatMixedImage(command);
  });
  ipcMain.handle('sales-analysis-load-overview', async (event, range) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadSalesAnalysisOverview(range);
  });
  ipcMain.handle('sales-analysis-load-category', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadSalesAnalysisCategory(command);
  });
  ipcMain.handle('sales-analysis-load-product-customers', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadSalesAnalysisProductCustomers(command);
  });
  ipcMain.handle('sales-analysis-load-category-customers', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadSalesAnalysisCategoryCustomers(command);
  });
  ipcMain.handle('sales-analysis-load-category-customer-products', async (event, command) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadSalesAnalysisCategoryCustomerProducts(command);
  });

  // 连接器凭证：仅暴露生成、查询本人授权、撤销本人全部授权。
  // 配送商/用户归属完全由主进程持有的 dispatch Bearer 会话及后台决定，
  // 渲染进程不可传入 disId/userId 或任意 token。
  ipcMain.handle('connector-credential-issue', async (event, input) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().issueConnectorCredential(input);
  });
  ipcMain.handle('connector-credential-list', async (event) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().listConnectorCredentials();
  });
  ipcMain.handle('connector-credential-revoke-all', async (event) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().revokeConnectorCredential();
  });

  // MCP 打印请求：只接受主窗口通过白名单 preload 发起的请求。
  ipcMain.on('mcp-print-request', (event, printParams) => {
    assertTrustedRendererEvent(event);
    console.log('[MCP] ipcMain 收到渲染进程转发的 mcp-print-request（极少使用）:', printParams);
    if (mainWindow && !mainWindow.isDestroyed()) {
      pushMcpPrintTaskToRenderer(mainWindow.webContents, printParams);
      console.log('[MCP] 已推送到渲染进程（IPC + ack）');
    }
  });

  ipcMain.on('mcp-print-ack', (event, taskId) => {
    assertTrustedRendererEvent(event);
    acknowledgeMcpPrintTask(event.sender.id, taskId);
  });

  // R2 结果回传（main 侧）：渲染端 OrderPrint 组件实际出纸完成后，由 Bills 经此 IPC 回传 3011 taskId + success。
  // 注意：仅回传「真实出纸结果」；受理(accept)≠完成，执行结果未知时不自动重打。
  // 渲染端→main 的 taskId 透传（Bills.vue runMcpDeliveryPrint → OrderPrint.printOnly 完成后发送）为后续打印验证步骤，
  // 本轮连接/查询/预览测试不触发打印，故该 handler 不会在本轮被实际调用。
  ipcMain.on('mcp-print-result', (event, payload) => {
    assertTrustedRendererEvent(event);
    let taskId = null;
    let success = false;
    let message = '';
    try {
      const p = typeof payload === 'string' ? JSON.parse(payload) : (payload || {});
      taskId = p.taskId != null ? String(p.taskId) : null;
      success = !!p.success;
      message = p.message || '';
    } catch (e) { /* ignore parse error */ }
    if (!taskId) {
      console.warn('[MCP-3011] mcp-print-result 缺少 taskId，忽略');
      return;
    }
    try {
      mcpBridgeClient.reportResult(taskId, success, message);
      console.log(`[MCP-3011] 已回传打印结果 taskId=${taskId} success=${success}`);
    } catch (e) {
      console.warn('[MCP-3011] 回传打印结果失败:', e && e.message);
    }
  });
  
  // 获取统一的 3011 连接器状态。
  ipcMain.handle('get-mcp-status', async (event) => {
    assertTrustedRendererEvent(event);
    const status = await mcpBridgeClient.getBridgeStatus();
    return {
      running: status.ok,
      port: mcpBridgeClient.DEFAULT_PORT,
      host: '127.0.0.1',
      authRequired: true
    };
  });
  
  // 「记住用户」与 localStorage 双写：file 协议下部分环境 localStorage 不可靠，用 userData 兜底（sendSync 供路由守卫同步读取）
  ipcMain.on('remember-printer-user-get-sync', (event) => {
    try {
      assertTrustedRendererEvent(event);
      const p = getRememberPrinterUserFlagPath();
      event.returnValue = fs.existsSync(p) && fs.readFileSync(p, 'utf8').trim() === '1' ? '1' : '0';
    } catch {
      event.returnValue = '0';
    }
  });
  ipcMain.on('remember-printer-user-set-sync', async (event, enabled) => {
    try {
      assertTrustedRendererEvent(event);
      const p = getRememberPrinterUserFlagPath();
      if (enabled) {
        fs.writeFileSync(p, '1', 'utf8');
      } else {
        if (fs.existsSync(p)) fs.unlinkSync(p);
        // 关闭自动登录必须同时清掉本机长会话令牌，否则下次启动仍能静默换回会话。
        await getRememberTokenStore().clear();
      }
    } catch (e) {
      console.error('[remember-printer-user-set-sync]', e);
    }
  });

  /** 异步写入 userData 标志，不阻塞渲染进程（勾选「记住用户」须用此通道，勿用 sendSync） */
  ipcMain.on('remember-printer-user-set-async', async (event, enabled) => {
    try {
      assertTrustedRendererEvent(event);
      const p = getRememberPrinterUserFlagPath();
      if (enabled) {
        fs.writeFileSync(p, '1', 'utf8');
      } else {
        if (fs.existsSync(p)) fs.unlinkSync(p);
        // 关闭自动登录必须同时清掉本机长会话令牌，否则下次启动仍能静默换回会话。
        await getRememberTokenStore().clear();
      }
    } catch (e) {
      console.error('[remember-printer-user-set-async]', e);
    }
  });

  /** 渲染进程 console 默认不进终端；需要时转发到主进程 stdout（便于打包后排查） */
  ipcMain.on('renderer-console-log', (event, line) => {
    try {
      assertTrustedRendererEvent(event);
      console.log(typeof line === 'string' ? line : String(line));
    } catch (e) {
      console.error('[renderer-console-log]', e);
    }
  });

  // 监听来自渲染进程的打印请求（旧接口，保持兼容）
  ipcMain.on('print-request', (event, printData, depFatherId, depId, tradeNo, userId, paperCount) => {
    assertTrustedRendererEvent(event);
    assertPrintHtml(printData);
    assertPrintMetadata({ depFatherId, depId, tradeNo, userId, paperCount });
    printContentToWindow(printData, depFatherId, depId , tradeNo, userId, paperCount);
  });

  ipcMain.on('print-request-gb', (event, printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount) => {
    assertTrustedRendererEvent(event);
    assertPrintHtml(printData);
    assertPrintMetadata({ gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount });
    printContentToWindowGb(printData, gbDepFatherId, gbDepId , tradeNo, userId, nxDisId, paperCount);
  });

  ipcMain.on('print-request-gb-batch', (event, printData, gbBatchId, paperCount) => {
    assertTrustedRendererEvent(event);
    assertPrintHtml(printData);
    assertPrintMetadata({ gbBatchId, paperCount });
    printContentToWindowGbPb(printData, gbBatchId, paperCount);
  });

  // 新的IPC handlers：支持回执的打印接口（返回Promise）
  ipcMain.handle('print-request-with-callback', async (event, printData, depFatherId, depId, tradeNo, userId, paperCount, shouldSave, isHistoryOrder, orderIds) => {
    assertTrustedRendererEvent(event);
    assertPrintHtml(printData);
    assertPrintMetadata({ depFatherId, depId, tradeNo, userId, paperCount, shouldSave, isHistoryOrder, orderIds });
    console.log('📥 [IPC Handler] 收到打印请求:', { depFatherId, depId, tradeNo, userId, paperCount, shouldSave, isHistoryOrder, orderIds });
    console.log('📥 [IPC Handler] HTML内容长度:', printData ? printData.length : 0);
    
    try {
      const result = await runTrackedPrintJob(
        '配送单打印',
        () => printContentToWindowWithCallback(printData, depFatherId, depId, tradeNo, userId, paperCount, shouldSave, isHistoryOrder, orderIds)
      );
      console.log('📤 [IPC Handler] 打印请求完成:', result);
      return result;
    } catch (error) {
      console.error('❌ [IPC Handler] 打印请求异常:', error);
      throw error;
    }
  });

  ipcMain.handle('print-request-gb-with-callback', async (event, printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount, shouldSave) => {
    assertTrustedRendererEvent(event);
    assertPrintHtml(printData);
    assertPrintMetadata({ gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount, shouldSave });
    try {
      const result = await runTrackedPrintJob(
        '国标订单打印',
        () => printContentToWindowGbWithCallback(printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount, shouldSave)
      );
      return result;
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('print-request-gb-batch-with-callback', async (event, printData, gbBatchId, paperCount, shouldSave) => {
    assertTrustedRendererEvent(event);
    assertPrintHtml(printData);
    assertPrintMetadata({ gbBatchId, paperCount, shouldSave });
    try {
      const result = await runTrackedPrintJob(
        '国标批次打印',
        () => printContentToWindowGbPbWithCallback(printData, gbBatchId, paperCount, shouldSave)
      );
      return result;
    } catch (error) {
      throw error;
    }
  });

  // 打印校准页：弹出系统打印对话框，让用户设置分辨率等并保存为默认
  ipcMain.handle('print-calibration-page', async (event, htmlContent) => {
    assertTrustedRendererEvent(event);
    assertPrintHtml(htmlContent);
    return new Promise((resolve, reject) => {
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);
      printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

      printWindow.webContents.on('did-finish-load', () => {
        printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);
        const defaultPrinter = getDefaultPrinterName();
        console.log('[校准页面] 弹出打印对话框，使用打印机:', defaultPrinter || '系统默认');

        setTimeout(() => {
          printWindow.webContents.print(createCalibrationPrintOptions(defaultPrinter), (success, error) => {
            printWindow.destroy();
            if (success) {
              console.log('[校准页面] ✅ 打印成功，用户设置已保存为默认');
              resolve({ success: true });
            } else {
              console.log('[校准页面] 用户取消或打印失败');
              resolve({ success: false, error: error || '用户取消' });
            }
          });
        }, PRINT_RUNTIME_CONFIG.renderDelayMs);
      });

      printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        printWindow.destroy();
        reject({ success: false, error: `加载失败: ${errorDescription}`, errorCode });
      });
    });
  });

  // 退货交接单/收货单预览：由主进程创建受控窗口，不放开主页面的通用弹窗权限。
  ipcMain.handle('preview-return-document', async (event, htmlContent) => {
    assertTrustedRendererEvent(event);
    assertPrintHtml(htmlContent);
    const previewWindow = new BrowserWindow({
      width: 1000,
      height: 760,
      minWidth: 720,
      minHeight: 560,
      show: false,
      autoHideMenuBar: true,
      parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
      title: '退货单预览',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    previewWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    previewWindow.webContents.on('will-navigate', (navigationEvent, navigationUrl) => {
      if (!navigationUrl.startsWith('data:text/html;charset=utf-8,')) {
        navigationEvent.preventDefault();
      }
    });

    try {
      await previewWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
      if (previewWindow.isDestroyed()) {
        return { success: false, error: '预览窗口已关闭' };
      }
      previewWindow.show();
      previewWindow.focus();
      return { success: true };
    } catch (error) {
      if (!previewWindow.isDestroyed()) previewWindow.destroy();
      return { success: false, error: `预览页面加载失败: ${serializePrintError(error)}` };
    }
  });

  // 退货交接单/收货单：必须复用配送单的正式打印链路。
  // 不在这里另建一套 webContents.print 参数，否则 Epson 针式驱动会把
  // 240x140 / 240x93 的退货纸型自动旋转，造成退货单与配送单方向相差 90°。
  ipcMain.handle('print-return-document', async (event, htmlContent) => {
    assertTrustedRendererEvent(event);
    assertPrintHtml(htmlContent);
    const configuredPrinterName = getDefaultPrinterName();
    const widthMatch = htmlContent.match(/data-print-width-mm=["'](\d+(?:\.\d+)?)["']/i);
    const heightMatch = htmlContent.match(/data-print-height-mm=["'](\d+(?:\.\d+)?)["']/i);
    const widthMm = Number(widthMatch?.[1]);
    const heightMm = Number(heightMatch?.[1]);
    const pageSize = Number.isFinite(widthMm) && Number.isFinite(heightMm)
      ? { width: Math.round(widthMm * 1000), height: Math.round(heightMm * 1000) }
      : null;
    appLogger.append('info', 'return-print', 'submit-document', {
      profile: htmlContent.match(/data-print-profile=["']([^"']+)["']/i)?.[1] || '',
      pageSize,
      printerName: configuredPrinterName || '',
    });
    try {
      const result = await runTrackedPrintJob(
        '退货单打印',
        () => printContentToWindowWithCallback(
          htmlContent,
          -1,
          -1,
          'return-document',
          0,
          1,
          false,
          true,
          [],
          pageSize ? { pageSize } : {}
        )
      );
      return {
        ...result,
        printerName: result?.printerName || configuredPrinterName || '',
        error: ''
      };
    } catch (error) {
      return {
        success: false,
        printerName: error?.printer || configuredPrinterName || '',
        error: serializePrintError(error || '打印失败')
      };
    }
  });

  // A4 拣货单打印：使用独立配置的 A4 打印机 + 固定 A4 纸型，与配送单链路互不影响
  ipcMain.handle('print-pick-list-a4', async (event, htmlContent) => {
    assertTrustedRendererEvent(event);
    assertPrintHtml(htmlContent);
    const { a4Printer } = getPickListPrintConfig();
    const pageSize = { width: 210000, height: 297000 }; // A4 纵向，单位微米
    appLogger.append('info', 'pick-list-print', 'submit-document', {
      printerName: a4Printer || '',
      pageSize,
    });
    try {
      const result = await runTrackedPrintJob(
        '拣货单打印',
        () => printContentToWindowWithCallback(
          htmlContent,
          -1,
          -1,
          'pick-list-a4',
          0,
          1,
          false,
          true,
          [],
          { deviceName: a4Printer, pageSize }
        )
      );
      return {
        ...result,
        printerName: result?.printerName || a4Printer || '',
        error: '',
      };
    } catch (error) {
      return {
        success: false,
        printerName: a4Printer || '',
        error: serializePrintError(error || '打印失败')
      };
    }
  });
}

async function createWindow() {

  const { width, height } = screen.getPrimaryDisplay().size;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    autoHideMenuBar: true,  // 隐藏菜单栏（可以通过 Alt 键显示）
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,          // 推荐关闭 Node 集成
      contextIsolation: true,          // 启用上下文隔离
      sandbox: true,
      enableRemoteModule: false
    }
    
  });

  if (isDev) {
    const devURL = 'http://localhost:3000'; // 改回localhost
    mainWindow.loadURL(devURL);

    // try {
    //   // 强制加载 Vue DevTools
    //   const extensionName = await installExtension(VUEJS3_DEVTOOLS);
    //   console.log(`已安装扩展: ${extensionName}`);
    //   mainWindow.webContents.openDevTools();
    // } catch (err) {
    //   console.error('安装扩展时出错:', err);
    // }


    // 生产环境不加载DevTools


  } else {
    const prodPath = path.join(__dirname, '../dist/vue/index.html');
    mainWindow.loadFile(prodPath);
    console.log(`Loading production file: ${prodPath}`);

  }

  // 右键菜单：在文本输入框/textarea 等可编辑区域显示粘贴、复制、剪切、全选（Electron 默认不显示系统右键菜单）
  const contextMenuTemplate = [
    { role: 'undo', label: '撤销' },
    { role: 'redo', label: '重做' },
    { type: 'separator' },
    { role: 'cut', label: '剪切' },
    { role: 'copy', label: '复制' },
    { role: 'paste', label: '粘贴' },
    { role: 'selectAll', label: '全选' }
  ];
  const contextMenu = Menu.buildFromTemplate(contextMenuTemplate);
  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (params.isEditable) {
      contextMenu.popup();
    }
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!trustedRendererUrl(navigationUrl)) {
      event.preventDefault();
      console.warn('[安全] 已阻止主窗口导航到非可信地址:', navigationUrl);
    }
  });
  const mainWindowWebContentsId = mainWindow.webContents.id;
  mainWindow.on('close', (event) => {
    const service = wechatWorkspaceWindowService;
    // While the side-by-side WeChat workspace is open, the red macOS close
    // button means "leave this workspace", not "destroy the desktop app".
    // Keep the BrowserWindow alive, restore its original layout and tell the
    // renderer to return to the ordinary order home page.
    if (quitAfterReaderShutdown || !service?.isOpen?.()) return;
    event.preventDefault();
    if (wechatWorkspaceNativeCloseInProgress) return;
    stopWindowsWechatSelectionObservation({ resetTitle: true });
    wechatWorkspaceNativeCloseInProgress = true;
    if (!mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('wechat-ui-workspace-close-requested');
    }
    void service.close()
      .catch((error) => {
        appLogger.append('error', 'wechat-ui', 'native workspace close recovery failed', {
          message: error?.message,
        });
      })
      .finally(() => {
        wechatWorkspaceNativeCloseInProgress = false;
        if (!mainWindow || mainWindow.isDestroyed()) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      });
  });
  mainWindow.on('blur', () => {
    if (windowsWechatProgrammaticConversationFocusDepth === 0) {
      windowsWechatVerifiedConversationTitle = '';
    }
    beginWindowsWechatSelectionObservation();
  });
  mainWindow.on('focus', () => {
    stopWindowsWechatSelectionObservation();
  });
  mainWindow.on('closed', () => {
    stopWindowsWechatSelectionObservation({ resetTitle: true });
    void shutdownWechatWorkspaceWindow();
    clearMcpPrintDeliveriesForWebContents(mainWindowWebContentsId);
    mainWindow = null;
    mainWindowRef = null;
    wechatAutoReadScheduler?.cancelActiveRun();
  });

  console.log('Window created');

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window loaded'); // Check if the window loaded properly
    // 生产环境不打开DevTools
  });

  console.log('Window created'); // Log here too
}

ipcMain.handle('get-os-info', (event) => {
  assertTrustedRendererEvent(event);
  return {
    platform: os.platform(),
    arch: os.arch(),
  };
});

ipcMain.on('trigger-enter-key', (event) => {
  assertTrustedRendererEvent(event);
  console.log('Received trigger-enter-key');
  keyboard.pressKey(Key.Enter);
  keyboard.releaseKey(Key.Enter);
});

// ========== 系统打印机管理相关 IPC ==========

// 获取系统打印机列表
ipcMain.handle('get-system-printers', async (event) => {
  try {
    assertTrustedRendererEvent(event);
    const platform = os.platform();
    let printers = [];
    let defaultPrinterName = '';
    
    console.log('[打印机] 开始获取打印机列表，平台:', platform);
    
    // 方法1: 尝试使用 Electron 的 webContents.getPrinters()（如果可用）
    if (mainWindow && !mainWindow.isDestroyed()) {
      try {
        // 检查是否有 getPrinters 方法（同步方法）
        if (typeof mainWindow.webContents.getPrinters === 'function') {
          printers = mainWindow.webContents.getPrinters();
          console.log('[打印机] ✅ 通过 webContents.getPrinters() 获取到:', printers.length, '台');
        } 
        // 检查是否有 getPrintersAsync 方法（异步方法）
        else if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
          printers = await mainWindow.webContents.getPrintersAsync();
          console.log('[打印机] ✅ 通过 webContents.getPrintersAsync() 获取到:', printers.length, '台');
        } else {
          console.warn('[打印机] ⚠️ webContents 没有 getPrinters 或 getPrintersAsync 方法');
        }
      } catch (electronError) {
        console.warn('[打印机] ⚠️ Electron API 获取失败:', electronError.message);
        console.warn('[打印机] 错误详情:', electronError);
      }
    } else {
      console.warn('[打印机] ⚠️ 主窗口不存在或已销毁');
    }
    
    // 方法2: 如果 Electron API 不可用或返回空，使用系统命令获取
    if (printers.length === 0) {
      console.log('[打印机] 🔧 使用系统命令获取打印机列表');
      
      let command;
      let commandArgs;
      let parseFunction;
      
      if (platform === 'darwin') {
        // macOS: 使用 lpstat 命令获取所有打印机
        command = 'lpstat';
        commandArgs = ['-p'];
        parseFunction = (stdout) => {
          const lines = stdout.split('\n').filter(line => line.startsWith('printer'));
          return lines.map(line => {
            const match = line.match(/printer\s+(\S+)/);
            return match ? match[1] : null;
          }).filter(name => name);
        };
        
        // 同时获取默认打印机
        try {
          const { stdout } = await execFileAsync('lpstat', ['-d']);
          const match = stdout.match(/system default destination:\s*(\S+)/);
          if (match) {
            defaultPrinterName = match[1];
            console.log('[打印机] 📌 系统默认打印机:', defaultPrinterName);
          }
        } catch (e) {
          console.warn('[打印机] 获取默认打印机失败:', e.message);
        }
      } else if (platform === 'win32') {
        // Windows: 使用 wmic 命令
        command = 'wmic';
        commandArgs = ['printer', 'get', 'name,default', '/value'];
        parseFunction = (stdout) => {
          const printers = [];
          let currentPrinter = {};
          stdout.split('\n').forEach(line => {
            if (line.startsWith('Name=')) {
              if (currentPrinter.name) {
                printers.push(currentPrinter);
              }
              currentPrinter = { name: line.replace('Name=', '').trim() };
            } else if (line.startsWith('Default=')) {
              const isDefault = line.replace('Default=', '').trim() === 'TRUE';
              currentPrinter.isDefault = isDefault;
              if (isDefault) {
                defaultPrinterName = currentPrinter.name;
              }
            }
          });
          if (currentPrinter.name) {
            printers.push(currentPrinter);
          }
          return printers.map(p => p.name).filter(name => name);
        };
      } else {
        // Linux: 使用 lpstat 命令
        command = 'lpstat';
        commandArgs = ['-p'];
        parseFunction = (stdout) => {
          const lines = stdout.split('\n').filter(line => line.startsWith('printer'));
          return lines.map(line => {
            const match = line.match(/printer\s+(\S+)/);
            return match ? match[1] : null;
          }).filter(name => name);
        };
      }
      
      try {
        console.log('[打印机] 执行命令:', command, commandArgs);
        const { stdout, stderr } = await execFileAsync(command, commandArgs, {
          timeout: 10000,
          maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        });
        
        if (stderr && !stderr.includes('No such file') && stderr.trim()) {
          console.warn('[打印机] 命令执行警告:', stderr);
        }
        
        if (stdout && stdout.trim()) {
          const printerNames = parseFunction(stdout);
          console.log('[打印机] ✅ 系统命令获取到打印机:', printerNames);
          
          // 转换为标准格式
          printers = printerNames.map((name) => ({
            name: name,
            displayName: name,
            description: '',
            status: 0, // 默认状态为空闲
            isDefault: name === defaultPrinterName
          }));
        } else {
          console.warn('[打印机] ⚠️ 命令执行成功但输出为空');
        }
      } catch (cmdError) {
        console.error('[打印机] ❌ 系统命令执行失败:', cmdError.message);
        console.error('[打印机] 错误详情:', cmdError);
        
        // 如果命令失败，尝试获取默认打印机（仅 macOS）
        if (platform === 'darwin') {
          try {
            const { stdout } = await execFileAsync('lpstat', ['-d']);
            const match = stdout.match(/system default destination:\s*(\S+)/);
            if (match && match[1]) {
              defaultPrinterName = match[1];
              printers = [{
                name: defaultPrinterName,
                displayName: defaultPrinterName,
                description: '默认打印机',
                status: 0,
                isDefault: true
              }];
              console.log('[打印机] ✅ 至少找到了默认打印机:', defaultPrinterName);
            }
          } catch (e) {
            console.error('[打印机] ❌ 获取默认打印机也失败:', e.message);
          }
        }
      }
    }
    
    // 格式化打印机信息
    const printerList = printers.map(printer => {
      // 处理不同格式的打印机对象
      const name = printer.name || printer;
      const displayName = printer.displayName || printer.name || printer;
      
      return {
        name: name,
        displayName: displayName,
        description: printer.description || '',
        status: printer.status !== undefined ? printer.status : 0,
        isDefault: printer.isDefault !== undefined ? printer.isDefault : (name === defaultPrinterName)
      };
    });
    
    console.log('[打印机] 📋 最终返回打印机列表:', printerList.length, '台');
    if (printerList.length > 0) {
      console.log('[打印机] 打印机列表:', printerList.map(p => `${p.name}${p.isDefault ? ' (默认)' : ''}`).join(', '));
    } else {
      console.warn('[打印机] ⚠️ 未找到任何打印机，请检查系统打印机设置');
    }
    
    return { success: true, printers: printerList };
  } catch (error) {
    console.error('[打印机] ❌ 获取打印机列表异常:', error);
    console.error('[打印机] 错误堆栈:', error.stack);
    return { success: false, error: error.message, printers: [] };
  }
});

// 保存默认打印机配置
ipcMain.handle('save-default-printer', async (event, printerName) => {
  try {
    assertTrustedRendererEvent(event);
    if (typeof printerName !== 'string' || printerName.length > 256) {
      throw new Error('打印机名称无效');
    }
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'printer-config.json');
    
    let config = {};
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(configData);
    }
    
    config.defaultPrinter = printerName;
    config.updatedAt = new Date().toISOString();
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    console.log('[打印机] 保存默认打印机:', printerName);
    
    return { success: true };
  } catch (error) {
    console.error('[打印机] 保存默认打印机配置失败:', error);
    return { success: false, error: error.message };
  }
});

// 读取默认打印机配置
ipcMain.handle('get-default-printer', async (event) => {
  try {
    assertTrustedRendererEvent(event);
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'printer-config.json');
    
    if (!fs.existsSync(configPath)) {
      return { success: true, printerName: null };
    }
    
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    return { success: true, printerName: config.defaultPrinter || null };
  } catch (error) {
    console.error('[打印机] 读取默认打印机配置失败:', error);
    return { success: false, error: error.message, printerName: null };
  }
});

/**
 * 拣货单打印配置：与配送单打印机共用同一个 printer-config.json，
 * 只读写 a4Printer / pickListMode 两个字段，不触碰 defaultPrinter。
 */
function readPrinterConfigFile() {
  try {
    const configPath = path.join(app.getPath('userData'), 'printer-config.json');
    if (!fs.existsSync(configPath)) return {};
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('[打印] 读取打印机配置文件失败:', error);
    return {};
  }
}

function getPickListPrintConfig() {
  const config = readPrinterConfigFile();
  return {
    a4Printer: typeof config.a4Printer === 'string' ? config.a4Printer : '',
    pickListMode: config.pickListMode === 'shelf' ? 'shelf' : 'goods',
  };
}

ipcMain.handle('get-pick-list-print-config', async (event) => {
  try {
    assertTrustedRendererEvent(event);
    return { success: true, config: getPickListPrintConfig() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-pick-list-print-config', async (event, next) => {
  try {
    assertTrustedRendererEvent(event);
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      throw new Error('拣货单打印配置无效');
    }
    const configPath = path.join(app.getPath('userData'), 'printer-config.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      config = parsed && typeof parsed === 'object' ? parsed : {};
    }
    if (typeof next.a4Printer === 'string') {
      config.a4Printer = next.a4Printer.slice(0, 256);
    }
    if (next.pickListMode === 'shelf' || next.pickListMode === 'goods') {
      config.pickListMode = next.pickListMode;
    }
    config.updatedAt = new Date().toISOString();
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log('[打印] 保存拣货单打印配置:', { a4Printer: config.a4Printer, mode: config.pickListMode });
    return { success: true, config: getPickListPrintConfig() };
  } catch (error) {
    console.error('[打印] 保存拣货单打印配置失败:', error);
    return { success: false, error: error.message };
  }
});

// ========== 打印机配置文件持久化相关 IPC ==========

// 保存打印机配置文件（持久化到文件系统）
ipcMain.handle('save-printer-profile', async (event, deviceName, profile) => {
  try {
    assertTrustedRendererEvent(event);
    if (
      typeof deviceName !== 'string' ||
      deviceName.length === 0 ||
      deviceName.length > 256 ||
      !profile ||
      typeof profile !== 'object' ||
      Array.isArray(profile)
    ) {
      throw new Error('打印机配置参数无效');
    }
    const userDataPath = app.getPath('userData');
    const profilesPath = path.join(userDataPath, 'printer-profiles.json');
    
    let profiles = {};
    if (fs.existsSync(profilesPath)) {
      const profilesData = fs.readFileSync(profilesPath, 'utf-8');
      profiles = JSON.parse(profilesData);
    }
    
    // 只允许现场校准支持的字段和数值范围，忽略任何额外属性。
    const cleanProfile = {
      ...sanitizePrinterProfile(profile),
      updatedAt: new Date().toISOString()
    };
    
    profiles[deviceName] = cleanProfile;
    
    fs.writeFileSync(profilesPath, JSON.stringify(profiles, null, 2), 'utf-8');
    
    console.log('[打印机配置] 保存配置文件:', deviceName, cleanProfile);
    
    return { success: true };
  } catch (error) {
    console.error('[打印机配置] 保存配置文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 加载打印机配置文件（从文件系统）
ipcMain.handle('load-printer-profile', async (event, deviceName) => {
  try {
    assertTrustedRendererEvent(event);
    if (typeof deviceName !== 'string' || deviceName.length === 0 || deviceName.length > 256) {
      throw new Error('打印机名称无效');
    }
    const userDataPath = app.getPath('userData');
    const profilesPath = path.join(userDataPath, 'printer-profiles.json');
    
    if (!fs.existsSync(profilesPath)) {
      return { success: true, profile: null };
    }
    
    const profilesData = fs.readFileSync(profilesPath, 'utf-8');
    const profiles = JSON.parse(profilesData);
    
    const profile = profiles[deviceName] || null;
    
    console.log('[打印机配置] 加载配置文件:', deviceName, profile ? '找到' : '未找到');
    
    return { success: true, profile };
  } catch (error) {
    console.error('[打印机配置] 加载配置文件失败:', error);
    return { success: false, error: error.message, profile: null };
  }
});

// 加载所有打印机配置文件（用于调试和迁移）
ipcMain.handle('load-all-printer-profiles', async (event) => {
  try {
    assertTrustedRendererEvent(event);
    const userDataPath = app.getPath('userData');
    const profilesPath = path.join(userDataPath, 'printer-profiles.json');
    
    if (!fs.existsSync(profilesPath)) {
      return { success: true, profiles: {} };
    }
    
    const profilesData = fs.readFileSync(profilesPath, 'utf-8');
    const profiles = JSON.parse(profilesData);
    
    return { success: true, profiles };
  } catch (error) {
    console.error('[打印机配置] 加载所有配置文件失败:', error);
    return { success: false, error: error.message, profiles: {} };
  }
});

// ========== Windows 系统打印机配置获取（通过 PowerShell）==========

// 获取系统默认打印机的配置信息（DPI、纸张尺寸）
// 支持 Windows 和 macOS
ipcMain.handle('get-printer-system-config', async (event) => {
  try {
    assertTrustedRendererEvent(event);
    const platform = os.platform();
    
    console.log('[打印机系统配置] 当前平台:', platform);
    
    // Windows 平台：使用 PowerShell
    if (platform === 'win32') {
      // PowerShell 命令：获取默认打印机的配置信息（包括可打印区域）
      const psCommand = `
        $printer = Get-CimInstance -ClassName Win32_Printer | Where-Object { $_.Default -eq $true }
        if ($printer) {
          $config = Get-CimInstance -ClassName Win32_PrinterConfiguration | Where-Object { $_.Name -eq $printer.Name }
          if ($config) {
            # 获取纸张尺寸（单位：0.1mm）
            $paperWidthMm = [Math]::Round($config.PaperWidth / 10, 1)
            $paperHeightMm = [Math]::Round($config.PaperLength / 10, 1)
            
            # 尝试获取可打印区域（如果驱动支持）
            # 注意：Win32_PrinterConfiguration 可能不直接提供可打印区域信息
            # 可打印区域通常由打印机驱动决定
            
            $obj = [PSCustomObject]@{
              name = $printer.Name
              hDpi = $config.HorizontalResolution
              vDpi = $config.VerticalResolution
              widthMm = $paperWidthMm
              heightMm = $paperHeightMm
              # 诊断信息：计算可能的可打印区域
              # 注意：这是估算值，实际可打印区域由驱动决定
              estimatedPrintableWidth = $paperWidthMm
              note = "可打印区域由打印机驱动决定，可能需要通过实际测试确定"
            }
            $obj | ConvertTo-Json -Compress
          } else {
            '{"error": "Printer configuration not found"}'
          }
        } else {
          '{"error": "No default printer found"}'
        }
      `;
      
      console.log('[打印机系统配置] 开始执行 PowerShell 命令获取系统配置');
      
      // 使用临时文件方式执行 PowerShell 命令，避免引号转义问题
      const tempScriptDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'grain-printer-config-')
      );
      const tempScriptPath = path.join(tempScriptDir, 'read-config.ps1');
      const cleanupTempScript = () => {
        try {
          if (fs.existsSync(tempScriptPath)) {
            fs.unlinkSync(tempScriptPath);
          }
          if (fs.existsSync(tempScriptDir)) {
            fs.rmdirSync(tempScriptDir);
          }
        } catch (cleanupError) {
          console.warn('[打印机系统配置] 清理临时脚本失败:', cleanupError);
        }
      };
      
      try {
        // 将 PowerShell 命令写入临时文件
        fs.writeFileSync(tempScriptPath, psCommand.trim(), {
          encoding: 'utf8',
          mode: 0o600,
          flag: 'wx'
        });
        
        // 执行临时脚本文件
        const { stdout, stderr } = await execFileAsync(
          'powershell',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tempScriptPath],
          { encoding: 'utf8', timeout: 10000 }
        );
        
        // 清理临时文件
        cleanupTempScript();
        
        if (stderr && stderr.trim()) {
          console.warn('[打印机系统配置] PowerShell 警告:', stderr);
        }
        
        if (!stdout || stdout.trim() === '') {
          console.warn('[打印机系统配置] PowerShell 返回空结果');
          return { 
            success: false, 
            error: 'Empty result from PowerShell',
            config: null 
          };
        }
        
        // 解析 JSON 结果
        const config = JSON.parse(stdout.trim());
        
        if (config.error) {
          console.error('[打印机系统配置] PowerShell 返回错误:', config.error);
          return { 
            success: false, 
            error: config.error,
            config: null 
          };
        }
        
        console.log('[打印机系统配置] ✅ 成功获取系统配置:', config);
        
        return { 
          success: true, 
          config: {
            name: config.name,
            hDpi: config.hDpi || 300,
            vDpi: config.vDpi || 300,
            widthMm: config.widthMm || 241,
            heightMm: config.heightMm || 279
          }
        };
      } catch (execError) {
        // 确保临时文件被清理
        cleanupTempScript();
        
        // 重新抛出错误，让外层 catch 处理
        throw execError;
      }
    }
    
    // macOS 平台：使用 lpstat 和 lpoptions 命令
    else if (platform === 'darwin') {
      console.log('[打印机系统配置] 开始执行 macOS 命令获取系统配置');
      
      try {
        // 获取默认打印机名称
        console.log('[打印机系统配置] macOS: 执行命令: lpstat -d');
        let defaultPrinterOutput = '';
        let defaultPrinterStderr = '';
        
        try {
          const result = await execFileAsync('lpstat', ['-d'], { encoding: 'utf8', timeout: 5000 });
          defaultPrinterOutput = result.stdout || '';
          defaultPrinterStderr = result.stderr || '';
        } catch (lpstatError) {
          console.error('[打印机系统配置] macOS: lpstat 命令执行失败:', lpstatError);
          console.error('[打印机系统配置] macOS: 错误详情:', {
            message: lpstatError.message,
            code: lpstatError.code,
            signal: lpstatError.signal,
            stdout: lpstatError.stdout,
            stderr: lpstatError.stderr
          });
          
          // 尝试备用方法：获取所有打印机
          console.log('[打印机系统配置] macOS: 尝试备用方法，获取所有打印机列表');
          try {
            const { stdout: allPrintersOutput } = await execFileAsync(
              'lpstat',
              ['-p'],
              { encoding: 'utf8', timeout: 5000 }
            );
            console.log('[打印机系统配置] macOS: 所有打印机列表输出:', allPrintersOutput);
            
            // 解析打印机名称（格式：printer 打印机名 is idle...）
            const printerMatch = allPrintersOutput.match(/printer\s+(\S+)\s+is/i);
            if (printerMatch) {
              const printerName = printerMatch[1];
              console.log('[打印机系统配置] macOS: 从打印机列表中找到打印机:', printerName);
              // 继续使用这个打印机名称
              defaultPrinterOutput = `system default destination: ${printerName}`;
            } else {
              throw new Error('无法从打印机列表中解析打印机名称');
            }
          } catch (backupError) {
            console.error('[打印机系统配置] macOS: 备用方法也失败:', backupError);
            return { 
              success: false, 
              error: `无法获取打印机信息: ${lpstatError.message}`,
              config: null 
            };
          }
        }
        
        console.log('[打印机系统配置] macOS: lpstat -d 输出:', JSON.stringify(defaultPrinterOutput));
        console.log('[打印机系统配置] macOS: lpstat -d 错误输出:', JSON.stringify(defaultPrinterStderr));
        console.log('[打印机系统配置] macOS: 输出长度:', defaultPrinterOutput.length);
        
        // 尝试多种正则表达式匹配格式（支持中英文）
        let defaultPrinterMatch = null;
        
        // 1. 英文格式：system default destination: 打印机名
        defaultPrinterMatch = defaultPrinterOutput.match(/system\s+default\s+destination:\s*(.+)/i);
        if (defaultPrinterMatch) {
          console.log('[打印机系统配置] macOS: ✅ 匹配到英文格式');
        }
        
        // 2. 中文格式：系统默认目的位置：打印机名
        if (!defaultPrinterMatch) {
          defaultPrinterMatch = defaultPrinterOutput.match(/系统默认目的位置[：:]\s*(.+)/i);
          if (defaultPrinterMatch) {
            console.log('[打印机系统配置] macOS: ✅ 匹配到中文格式');
          }
        }
        
        // 3. 简化英文格式：default destination: 打印机名
        if (!defaultPrinterMatch) {
          defaultPrinterMatch = defaultPrinterOutput.match(/default\s+destination:\s*(.+)/i);
          if (defaultPrinterMatch) {
            console.log('[打印机系统配置] macOS: ✅ 匹配到简化英文格式');
          }
        }
        
        // 4. 如果输出只有一行且包含打印机名称（备用方案）
        if (!defaultPrinterMatch) {
          const lines = defaultPrinterOutput.split('\n').filter(line => line.trim());
          if (lines.length === 1 && lines[0].trim()) {
            // 尝试提取可能的打印机名称（排除常见的提示文字）
            const printerNameCandidate = lines[0].trim();
            if (!printerNameCandidate.match(/^(no|没有|未找到|system|系统)/i)) {
              defaultPrinterMatch = [null, printerNameCandidate];
              console.log('[打印机系统配置] macOS: ✅ 使用单行输出作为打印机名称');
            }
          }
        }
        
        if (!defaultPrinterMatch || !defaultPrinterMatch[1]) {
          console.error('[打印机系统配置] macOS: ❌ 未找到默认打印机');
          console.error('[打印机系统配置] macOS: 原始输出:', JSON.stringify(defaultPrinterOutput));
          console.error('[打印机系统配置] macOS: 尝试列出所有打印机信息');
          
          // 尝试从 lpstat -a 输出中提取打印机名称（备用方案）
          try {
            const { stdout: lpstatAll } = await execFileAsync(
              'lpstat',
              ['-a'],
              { encoding: 'utf8', timeout: 5000 }
            );
            console.log('[打印机系统配置] macOS: lpstat -a 输出:', lpstatAll);
            
            // 从 lpstat -a 输出中提取第一个打印机名称
            // 格式：EPSON_LQ_730K正在接受请求...
            const printerMatchFromA = lpstatAll.match(/^(\S+)\s+/);
            if (printerMatchFromA && printerMatchFromA[1]) {
              const printerName = printerMatchFromA[1].trim();
              console.log('[打印机系统配置] macOS: ✅ 从 lpstat -a 中提取到打印机名称:', printerName);
              // 继续使用这个打印机名称
              defaultPrinterMatch = [null, printerName];
            } else {
              throw new Error('无法从 lpstat -a 输出中提取打印机名称');
            }
          } catch (e) {
            console.error('[打印机系统配置] macOS: 无法从备用方法获取打印机:', e.message);
            return { 
              success: false, 
              error: `未找到默认打印机。lpstat -d 输出: ${defaultPrinterOutput || '(空)'}`,
              config: null 
            };
          }
        }
        
        const printerName = defaultPrinterMatch[1].trim();
        console.log('[打印机系统配置] macOS: ✅ 找到默认打印机:', printerName);
        console.log('[打印机系统配置] macOS: 打印机名称（去除空白）:', JSON.stringify(printerName));
        if (!/^[A-Za-z0-9._-]{1,255}$/.test(printerName)) {
          return {
            success: false,
            error: '系统返回的打印机队列名称包含不允许的字符',
            config: null
          };
        }
        
        // 获取打印机详细信息
        let hDpi = 300; // macOS 默认值
        let vDpi = 300;
        let widthMm = 241; // 标准连续纸宽度
        let heightMm = 279; // 标准连续纸高度
        
        console.log('[打印机系统配置] macOS: 准备获取打印机选项，打印机名称:', printerName);
        console.log('[打印机系统配置] macOS: 执行命令: lpoptions -p "' + printerName + '" -l');
        
        try {
          // 尝试获取打印机选项
          const lpoptionsResult = await execFileAsync('lpoptions', ['-p', printerName, '-l'], {
            encoding: 'utf8', 
            timeout: 5000 
          });
          
          const lpoptionsOutput = lpoptionsResult.stdout || '';
          const lpoptionsStderr = lpoptionsResult.stderr || '';
          
          console.log('[打印机系统配置] macOS: lpoptions 标准输出:', lpoptionsOutput);
          console.log('[打印机系统配置] macOS: lpoptions 错误输出:', lpoptionsStderr);
          console.log('[打印机系统配置] macOS: lpoptions 输出长度:', lpoptionsOutput.length);
          
          if (!lpoptionsOutput || lpoptionsOutput.trim() === '') {
            console.warn('[打印机系统配置] macOS: lpoptions 返回空结果，使用默认值');
          } else {
            // 解析分辨率：lpoptions -l 输出 * 标记当前默认，如 "Resolution/Resolution: 60dpi *120x60dpi 180x180dpi"
            // 优先解析 * 标记的预设值（用户存预设后 lpoptions 会更新）
            let resolutionMatch = lpoptionsOutput.match(/Resolution\/[^\n]*?\*(\d+)x(\d+)dpi/i);
            if (!resolutionMatch) {
              resolutionMatch = lpoptionsOutput.match(/Resolution\/[^]*?(\d+)x(\d+)dpi/i) ||
                lpoptionsOutput.match(/Resolution\/.*:\s*(\d+)x(\d+)/i);
            }
            if (resolutionMatch) {
              hDpi = parseInt(resolutionMatch[1]) || 300;
              vDpi = parseInt(resolutionMatch[2]) || 300;
              console.log('[打印机系统配置] macOS: ✅ 解析到分辨率:', hDpi, 'x', vDpi);
            } else {
              console.log('[打印机系统配置] macOS: ⚠️ 未找到分辨率信息，使用默认值 300x300');
              const altResolutionMatch = lpoptionsOutput.match(/resolution[:\s]+(\d+)[xX](\d+)/i);
              if (altResolutionMatch) {
                hDpi = parseInt(altResolutionMatch[1]) || 300;
                vDpi = parseInt(altResolutionMatch[2]) || 300;
                console.log('[打印机系统配置] macOS: ✅ 使用备用格式解析到分辨率:', hDpi, 'x', vDpi);
              }
            }
            
            // 解析纸张尺寸：支持 "数字x数字" 或 命名尺寸 "PageSize/...: *Letter Legal A4 ..."
            const pageSizeMatch = lpoptionsOutput.match(/PageSize\/.*:\s*(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/i);
            if (pageSizeMatch) {
              const widthInches = parseFloat(pageSizeMatch[1]) || 0;
              const heightInches = parseFloat(pageSizeMatch[2]) || 0;
              if (widthInches > 0 && heightInches > 0) {
                widthMm = Math.round(widthInches * 25.4 * 10) / 10;
                heightMm = Math.round(heightInches * 25.4 * 10) / 10;
                console.log('[打印机系统配置] macOS: ✅ 解析到纸张尺寸:', widthMm, 'x', heightMm, 'mm');
              }
            } else {
              // 命名尺寸映射（Letter/A4/Legal 等），取当前默认（* 标记）或第一个
              const pageSizeLine = lpoptionsOutput.match(/PageSize\/[^\n]+/i);
              if (pageSizeLine) {
                const line = pageSizeLine[0];
                const defaultName = line.match(/\*(\w+)/);
                const name = (defaultName && defaultName[1]) || line.match(/(?:Letter|Legal|A4|FanFoldUS)/i)?.[0] || '';
                const namedSizes = {
                  Letter: [215.9, 279.4], Legal: [215.9, 355.6], A4: [210, 297],
                  FanFoldUS: [241, 279]
                };
                const key = Object.keys(namedSizes).find(k => k.toLowerCase() === name.toLowerCase());
                if (key) {
                  widthMm = namedSizes[key][0];
                  heightMm = namedSizes[key][1];
                  console.log('[打印机系统配置] macOS: ✅ 从命名尺寸解析到纸张:', name, widthMm, 'x', heightMm, 'mm');
                } else {
                  console.log('[打印机系统配置] macOS: ⚠️ 未找到纸张尺寸信息，使用默认值 241x279mm');
                }
              } else {
                console.log('[打印机系统配置] macOS: ⚠️ 未找到纸张尺寸信息，使用默认值 241x279mm');
              }
            }
          }
        } catch (lpoptionsError) {
          console.error('[打印机系统配置] macOS: ❌ 获取打印机选项失败:', lpoptionsError);
          console.error('[打印机系统配置] macOS: 错误详情:', {
            message: lpoptionsError.message,
            code: lpoptionsError.code,
            signal: lpoptionsError.signal,
            stdout: lpoptionsError.stdout,
            stderr: lpoptionsError.stderr
          });
          console.warn('[打印机系统配置] macOS: 使用默认值（DPI: 300x300, 纸张: 241x279mm）');
        }
        
        console.log('[打印机系统配置] macOS: ✅ 成功获取系统配置');
        
        return { 
          success: true, 
          config: {
            name: printerName,
            hDpi: hDpi,
            vDpi: vDpi,
            widthMm: widthMm,
            heightMm: heightMm
          }
        };
        
      } catch (macError) {
        console.error('[打印机系统配置] macOS: ❌ 获取配置失败:', macError);
        return { 
          success: false, 
          error: macError.message,
          config: null 
        };
      }
    }
    
    // 其他平台（Linux 等）
    else {
      console.log('[打印机系统配置] 当前平台不支持:', platform);
      return { 
        success: false, 
        error: `Platform ${platform} is not supported`,
        config: null 
      };
    }
    
  } catch (error) {
    console.error('[打印机系统配置] ❌ 获取系统配置失败:', error);
    return { 
      success: false, 
      error: error.message,
      config: null 
    };
  }
});

// macOS：将分辨率设为打印机系统默认（用 lpoptions 写入，一键同步可读取）
ipcMain.handle('set-printer-resolution', async (event, hDpi, vDpi) => {
  assertTrustedRendererEvent(event);
  if (process.platform !== 'darwin') {
    return { success: false, error: '仅 macOS 支持' };
  }
  try {
    const printerName = getDefaultPrinterName();
    if (!printerName) {
      return { success: false, error: '未配置默认打印机' };
    }
    if (!/^[A-Za-z0-9._-]{1,255}$/.test(printerName)) {
      return { success: false, error: '打印机队列名称包含不允许的字符' };
    }
    const allowedResolutions = new Set(['120x60', '180x180', '360x180']);
    const resolutionPair = `${Number(hDpi)}x${Number(vDpi)}`;
    if (!allowedResolutions.has(resolutionPair)) {
      return { success: false, error: '不支持的打印分辨率' };
    }
    const resolutionValue = `${resolutionPair}dpi`;
    await execFileAsync(
      'lpoptions',
      ['-p', printerName, '-o', `Resolution=${resolutionValue}`],
      { encoding: 'utf8', timeout: 5000 }
    );
    console.log('[打印机] 已设置分辨率:', resolutionValue, '打印机:', printerName);
    return { success: true };
  } catch (error) {
    console.error('[打印机] 设置分辨率失败:', error);
    return { success: false, error: error.message };
  }
});

// ========== 文件夹和文件操作相关 IPC ==========

// 选择文件夹对话框
ipcMain.handle('select-folder', async (event) => {
  assertTrustedRendererEvent(event);
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择订单存储文件夹'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const selectedPath = realPathIfExists(result.filePaths[0]);
    selectedFolderCapabilities.add(selectedPath);
    return { success: true, path: selectedPath };
  }
  
  return { success: false, path: null };
});

// 另存为对话框（选择保存路径和文件名）
ipcMain.handle('show-save-dialog', async (event, options = {}) => {
  assertTrustedRendererEvent(event);
  const safeOptions =
    options && typeof options === 'object' && !Array.isArray(options) ? options : {};
  const result = await dialog.showSaveDialog(mainWindow, {
    title:
      typeof safeOptions.title === 'string'
        ? safeOptions.title.slice(0, 100)
        : '保存订单Excel',
    defaultPath:
      typeof safeOptions.defaultPath === 'string'
        ? safeOptions.defaultPath.slice(0, 512)
        : '订单.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }]
  });
  if (!result.canceled && result.filePath) {
    const selectedFilePath = normalizeAbsolutePath(result.filePath);
    saveFileCapabilities.add(selectedFilePath);
    return { success: true, filePath: selectedFilePath };
  }
  return { success: false, filePath: null };
});

// 将 Buffer 写入指定文件路径
ipcMain.handle('save-buffer-to-file', async (event, buffer, filePath) => {
  try {
    assertTrustedRendererEvent(event);
    const normalizedFilePath = normalizeAbsolutePath(filePath);
    if (!saveFileCapabilities.has(normalizedFilePath)) {
      throw new Error('保存路径没有有效的系统对话框授权');
    }
    const buf = Buffer.from(buffer);
    if (buf.length > 100 * 1024 * 1024) {
      throw new Error('文件超过 100MB 限制');
    }
    fs.writeFileSync(normalizedFilePath, buf);
    saveFileCapabilities.delete(normalizedFilePath);
    return { success: true };
  } catch (error) {
    console.error('保存文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 保存客户文件夹路径配置
ipcMain.handle('save-customer-folder-path', async (event, customerId, folderPath) => {
  try {
    assertTrustedRendererEvent(event);
    const normalizedCustomerId = String(customerId);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(normalizedCustomerId)) {
      throw new Error('客户标识无效');
    }
    const userDataPath = app.getPath('userData');
    const configPath = getCustomerFoldersConfigPath();
    
    let config = {};
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(configData);
    }

    if (folderPath === '') {
      delete config[normalizedCustomerId];
    } else {
      const normalizedFolderPath = realPathIfExists(folderPath);
      if (!selectedFolderCapabilities.has(normalizedFolderPath)) {
        throw new Error('客户文件夹必须由当前系统选择对话框授权');
      }
      if (!fs.existsSync(normalizedFolderPath) || !fs.statSync(normalizedFolderPath).isDirectory()) {
        throw new Error('客户文件夹不存在');
      }
      config[normalizedCustomerId] = normalizedFolderPath;
    }
    
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    return { success: true };
  } catch (error) {
    console.error('保存客户文件夹路径失败:', error);
    return { success: false, error: error.message };
  }
});

// 读取客户文件夹路径配置
ipcMain.handle('get-customer-folder-path', async (event, customerId) => {
  try {
    assertTrustedRendererEvent(event);
    const normalizedCustomerId = String(customerId);
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(normalizedCustomerId)) {
      throw new Error('客户标识无效');
    }
    const userDataPath = app.getPath('userData');
    const configPath = getCustomerFoldersConfigPath();
    
    if (!fs.existsSync(configPath)) {
      return { success: true, path: null };
    }
    
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    const configuredPath = config[normalizedCustomerId] || null;
    if (configuredPath) {
      selectedFolderCapabilities.add(realPathIfExists(configuredPath));
    }
    return { success: true, path: configuredPath };
  } catch (error) {
    console.error('读取客户文件夹路径失败:', error);
    return { success: false, error: error.message, path: null };
  }
});

// 扫描文件夹中的文件（Excel 和图片）
ipcMain.handle('scan-folder-files', async (event, folderPath, includeProcessed = false) => {
  try {
    assertTrustedRendererEvent(event);
    assertAuthorizedCustomerPath(folderPath);
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: '文件夹不存在', files: [] };
    }
    
    const result = [];
    
    // Excel 文件扩展名
    const excelExts = ['.xlsx', '.xls'];
    // 图片文件扩展名
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    
    // 扫描主文件夹
    const files = fs.readdirSync(folderPath);
    files.forEach(fileName => {
      const filePath = path.join(folderPath, fileName);
      const stat = fs.statSync(filePath);
      
      // 跳过临时文件（Excel临时文件以 ~$ 开头）
      if (fileName.startsWith('~$')) {
        return;
      }
      
      // 只处理文件，跳过文件夹和"已处理"文件夹
      if (stat.isFile() && fileName !== '已处理') {
        const ext = path.extname(fileName).toLowerCase();
        let fileType = null;
        
        if (excelExts.includes(ext)) {
          fileType = 'excel';
        } else if (imageExts.includes(ext)) {
          fileType = 'image';
        }
        
        if (fileType) {
          result.push({
            fileName,
            filePath,
            fileType,
            size: stat.size,
            modifiedTime: stat.mtime.getTime(),
            isProcessed: false // 标记为未处理
          });
        }
      }
    });
    
    // 如果 includeProcessed 为 true，同时扫描"已处理"文件夹
    if (includeProcessed) {
      const processedFolder = path.join(folderPath, '已处理');
      if (fs.existsSync(processedFolder)) {
        const processedFiles = fs.readdirSync(processedFolder);
        processedFiles.forEach(fileName => {
          // 跳过临时文件（Excel临时文件以 ~$ 开头）
          if (fileName.startsWith('~$')) {
            return;
          }
          
          const filePath = path.join(processedFolder, fileName);
          const stat = fs.statSync(filePath);
          
          // 只处理文件
          if (stat.isFile()) {
            const ext = path.extname(fileName).toLowerCase();
            let fileType = null;
            
            if (excelExts.includes(ext)) {
              fileType = 'excel';
            } else if (imageExts.includes(ext)) {
              fileType = 'image';
            }
            
            if (fileType) {
              result.push({
                fileName,
                filePath,
                fileType,
                size: stat.size,
                modifiedTime: stat.mtime.getTime(),
                isProcessed: true // 标记为已处理
              });
            }
          }
        });
      }
    }
    
    return { success: true, files: result };
  } catch (error) {
    console.error('扫描文件夹失败:', error);
    return { success: false, error: error.message, files: [] };
  }
});

// 读取文件内容（用于发送到渲染进程）
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    assertTrustedRendererEvent(event);
    assertAuthorizedCustomerPath(filePath);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在' };
    }
    
    const fileBuffer = fs.readFileSync(filePath);
    if (fileBuffer.length > 100 * 1024 * 1024) {
      return { success: false, error: '文件超过 100MB 限制' };
    }
    const base64 = fileBuffer.toString('base64');
    
    return { success: true, data: base64, fileName: path.basename(filePath) };
  } catch (error) {
    console.error('读取文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 移动文件到"已处理"文件夹
ipcMain.handle('move-file-to-processed', async (event, filePath, targetFolder) => {
  try {
    assertTrustedRendererEvent(event);
    assertAuthorizedCustomerPath(filePath);
    assertAuthorizedCustomerPath(targetFolder);
    const fileName = path.basename(filePath);
    const processedFolder = path.join(targetFolder, '已处理');
    
    // 确保"已处理"文件夹存在
    if (!fs.existsSync(processedFolder)) {
      fs.mkdirSync(processedFolder, { recursive: true });
    }
    
    const targetPath = path.join(processedFolder, fileName);
    
    // 如果目标文件已存在，添加时间戳
    let finalTargetPath = targetPath;
    if (fs.existsSync(targetPath)) {
      const ext = path.extname(fileName);
      const nameWithoutExt = path.basename(fileName, ext);
      const timestamp = new Date().getTime();
      finalTargetPath = path.join(processedFolder, `${nameWithoutExt}_${timestamp}${ext}`);
    }
    
    // 移动文件
    fs.renameSync(filePath, finalTargetPath);
    
    return { success: true, newPath: finalTargetPath };
  } catch (error) {
    console.error('移动文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 将"已处理"文件夹中的所有文件移动到"已完成"文件夹
ipcMain.handle('move-processed-to-completed', async (event, targetFolder) => {
  try {
    assertTrustedRendererEvent(event);
    assertAuthorizedCustomerPath(targetFolder);
    const processedFolder = path.join(targetFolder, '已处理');
    const completedFolder = path.join(targetFolder, '已完成');
    
    // 检查"已处理"文件夹是否存在
    if (!fs.existsSync(processedFolder)) {
      return { success: true, message: '已处理文件夹不存在，无需移动', movedCount: 0 };
    }
    
    // 确保"已完成"文件夹存在
    if (!fs.existsSync(completedFolder)) {
      fs.mkdirSync(completedFolder, { recursive: true });
    }
    
    // 读取"已处理"文件夹中的所有文件
    const files = fs.readdirSync(processedFolder);
    const fileStats = files.map(fileName => {
      const filePath = path.join(processedFolder, fileName);
      const stat = fs.statSync(filePath);
      return { fileName, filePath, isFile: stat.isFile() };
    }).filter(item => item.isFile); // 只处理文件，忽略文件夹
    
    if (fileStats.length === 0) {
      return { success: true, message: '已处理文件夹中没有文件', movedCount: 0 };
    }
    
    // 移动所有文件到"已完成"文件夹
    let movedCount = 0;
    const errors = [];
    
    for (const file of fileStats) {
      try {
        const targetPath = path.join(completedFolder, file.fileName);
        
        // 如果目标文件已存在，添加时间戳
        let finalTargetPath = targetPath;
        if (fs.existsSync(targetPath)) {
          const ext = path.extname(file.fileName);
          const nameWithoutExt = path.basename(file.fileName, ext);
          const timestamp = new Date().getTime();
          finalTargetPath = path.join(completedFolder, `${nameWithoutExt}_${timestamp}${ext}`);
        }
        
        // 移动文件
        fs.renameSync(file.filePath, finalTargetPath);
        movedCount++;
      } catch (error) {
        console.error(`移动文件 ${file.fileName} 失败:`, error);
        errors.push({ fileName: file.fileName, error: error.message });
      }
    }
    
    return { 
      success: true, 
      movedCount, 
      totalFiles: fileStats.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('移动已处理文件到已完成文件夹失败:', error);
    return { success: false, error: error.message };
  }
});

// 将"已处理"文件夹中的所有文件移回上一层文件夹（客户文件夹）
ipcMain.handle('move-processed-to-parent', async (event, targetFolder) => {
  try {
    assertTrustedRendererEvent(event);
    assertAuthorizedCustomerPath(targetFolder);
    const processedFolder = path.join(targetFolder, '已处理');
    
    // 检查"已处理"文件夹是否存在
    if (!fs.existsSync(processedFolder)) {
      return { success: true, message: '已处理文件夹不存在，无需移动', movedCount: 0 };
    }
    
    // 读取"已处理"文件夹中的所有文件
    const files = fs.readdirSync(processedFolder);
    const fileStats = files.map(fileName => {
      const filePath = path.join(processedFolder, fileName);
      const stat = fs.statSync(filePath);
      return { fileName, filePath, isFile: stat.isFile() };
    }).filter(item => item.isFile); // 只处理文件，忽略文件夹
    
    if (fileStats.length === 0) {
      return { success: true, message: '已处理文件夹中没有文件', movedCount: 0 };
    }
    
    // 移动所有文件到上一层文件夹（客户文件夹）
    let movedCount = 0;
    const errors = [];
    
    for (const file of fileStats) {
      try {
        const targetPath = path.join(targetFolder, file.fileName);
        
        // 如果目标文件已存在，添加时间戳
        let finalTargetPath = targetPath;
        if (fs.existsSync(targetPath)) {
          const ext = path.extname(file.fileName);
          const nameWithoutExt = path.basename(file.fileName, ext);
          const timestamp = new Date().getTime();
          finalTargetPath = path.join(targetFolder, `${nameWithoutExt}_${timestamp}${ext}`);
        }
        
        // 移动文件
        fs.renameSync(file.filePath, finalTargetPath);
        movedCount++;
      } catch (error) {
        console.error(`移动文件 ${file.fileName} 失败:`, error);
        errors.push({ fileName: file.fileName, error: error.message });
      }
    }
    
    return { 
      success: true, 
      movedCount, 
      totalFiles: fileStats.length,
      errors: errors.length > 0 ? errors : undefined
    };
  } catch (error) {
    console.error('移动已处理文件到上一层文件夹失败:', error);
    return { success: false, error: error.message };
  }
});

// 打开文件（用默认程序打开，如果文件已移动到"已处理"文件夹，则从"已处理"文件夹打开）
ipcMain.handle('open-file', async (event, filePath, customerFolderPath) => {
  try {
    assertTrustedRendererEvent(event);
    assertAuthorizedCustomerPath(filePath);
    if (customerFolderPath) {
      assertAuthorizedCustomerPath(customerFolderPath);
    }
    let finalFilePath = filePath;
    
    // 如果原文件不存在，检查是否在"已处理"文件夹中
    if (!fs.existsSync(filePath)) {
      if (customerFolderPath) {
        const fileName = path.basename(filePath);
        const processedFolder = path.join(customerFolderPath, '已处理');
        const processedFilePath = path.join(processedFolder, fileName);
        
        // 检查"已处理"文件夹中是否有该文件（可能带时间戳）
        if (fs.existsSync(processedFolder)) {
          const processedFiles = fs.readdirSync(processedFolder);
          // 查找匹配的文件（可能是带时间戳的）
          const matchedFile = processedFiles.find(f => {
            const nameWithoutExt = path.basename(fileName, path.extname(fileName));
            const ext = path.extname(fileName);
            return f.startsWith(nameWithoutExt) && f.endsWith(ext);
          });
          
          if (matchedFile) {
            finalFilePath = path.join(processedFolder, matchedFile);
          } else if (fs.existsSync(processedFilePath)) {
            finalFilePath = processedFilePath;
          }
        }
      }
    }
    
    if (!fs.existsSync(finalFilePath)) {
      return { success: false, error: '文件不存在' };
    }
    
    // 使用 shell.openPath 用默认程序打开文件
    const result = await shell.openPath(finalFilePath);
    
    if (result) {
      // 如果返回了错误信息，说明打开失败
      return { success: false, error: result };
    }
    
    return { success: true };
  } catch (error) {
    console.error('打开文件失败:', error);
    return { success: false, error: error.message };
  }
});

// 打开文件所在的文件夹并选中文件
ipcMain.handle('open-folder', async (event, filePath) => {
  try {
    assertTrustedRendererEvent(event);
    assertAuthorizedCustomerPath(filePath);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在' };
    }
    
    // 使用 shell.showItemInFolder 打开文件所在的文件夹并选中文件
    shell.showItemInFolder(filePath);
    
    return { success: true };
  } catch (error) {
    console.error('打开文件夹失败:', error);
    return { success: false, error: error.message };
  }
});

// ==================== 腾讯云语音识别相关功能 ====================

// 腾讯云长期凭据禁止进入 Electron；保留接口契约，等待 nongxinle-server 代理。
const DEFAULT_TENCENT_CLOUD_CONFIG = {
  secretId: '',
  secretKey: '',
  appId: '',
  engineModelType: '16k_zh',
  region: 'ap-guangzhou'
};

function loadTencentCloudConfig() {
  return { ...DEFAULT_TENCENT_CLOUD_CONFIG };
}

function getTencentCloudConfig() {
  return loadTencentCloudConfig();
}

function getTencentCloudSetupHint() {
  return '客户端腾讯云长期密钥已禁用；该语音能力需迁移到 nongxinle-server 后再启用。';
}

function isTencentCloudKeyUsable(secretId, secretKey) {
  if (!secretId || !secretKey || typeof secretId !== 'string' || typeof secretKey !== 'string') return false;
  const id = secretId.trim();
  const key = secretKey.trim();
  if (!id || !key) return false;
  if (/^YOUR_/i.test(id) || /^YOUR_/i.test(key)) return false;
  if (id.includes('YOUR_TENCENT') || key.includes('YOUR_TENCENT')) return false;
  return true;
}

function tencentCloudConfigErrorMessage(cfg) {
  if (!cfg.secretId || !cfg.secretKey) {
    return getTencentCloudSetupHint();
  }
  if (!isTencentCloudKeyUsable(cfg.secretId, cfg.secretKey)) {
    return `${getTencentCloudSetupHint()}\n\n当前检测到仍为示例占位符（如 YOUR_...），请改为控制台里的真实密钥。`;
  }
  return getTencentCloudSetupHint();
}

// 存储当前语音识别会话
let currentVoiceRecognitionSession = null;

// PCM 录音相关
let audioRecorder = null; // 录音器实例
let recordingStream = null; // 录音流

// 腾讯云 API 签名函数
function signTencentCloudRequest(secretKey, signString) {
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(signString);
  return hmac.digest('hex');
}

// 获取 UTC 日期字符串（格式：YYYY-MM-DD）
function getUTCDate(tsSeconds) {
  const d = new Date(tsSeconds * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 生成腾讯云 API 请求签名（TC3-HMAC-SHA256）
function generateTencentCloudSignature(secretId, secretKey, service, action, timestamp, requestPayload, version) {
  // 使用 UTC 日期，格式：YYYY-MM-DD（注意中间有横线）
  const date = getUTCDate(timestamp); // YYYY-MM-DD
  
  console.log('[签名] 日期:', date, '时间戳:', timestamp, '版本:', version);
  
  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${service}/tc3_request`;

  // ✅ 步骤1: 生成 SignKey（kDate 用 YYYY-MM-DD，不要用 YYYYMMDD）
  const kDate = crypto.createHmac('sha256', 'TC3' + secretKey).update(date, 'utf8').digest();
  const kService = crypto.createHmac('sha256', kDate).update(service, 'utf8').digest();
  const kSigning = crypto.createHmac('sha256', kService).update('tc3_request', 'utf8').digest();

  // 步骤2: 生成 CanonicalRequest
  const host = `${service}.tencentcloudapi.com`;
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';

  // ✅ x-tc-version 必须和请求头中的值完全一致
  const canonicalHeaders =
    `content-type:application/json\n` +
    `host:${host}\n` +
    `x-tc-action:${action.toLowerCase()}\n` +
    `x-tc-timestamp:${timestamp}\n` +
    `x-tc-version:${version}\n`;

  const signedHeaders = 'content-type;host;x-tc-action;x-tc-timestamp;x-tc-version';

  const hashedRequestPayload = crypto.createHash('sha256').update(requestPayload, 'utf8').digest('hex');

  const canonicalRequest =
    `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n` +
    `${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;

  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');

  // 步骤3: 生成 StringToSign
  const stringToSign =
    `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  // 步骤4: 计算签名
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  // 步骤5: 生成 Authorization
  const authorization =
    `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  console.log('[签名] Credential:', `${secretId}/${credentialScope}`);
  console.log('[签名] SignedHeaders:', signedHeaders);
  
  return authorization;
}

// 开始语音识别（在主进程录制 PCM）
ipcMain.handle('start-voice-recognition', async (event) => {
  try {
    assertTrustedRendererEvent(event);
    console.log('[语音识别] 开始语音识别（主进程 PCM 录音）...');
    
    const cfg = getTencentCloudConfig();
    if (!isTencentCloudKeyUsable(cfg.secretId, cfg.secretKey)) {
      return { success: false, error: tencentCloudConfigErrorMessage(cfg) };
    }
    
    // 如果已有会话，先清理
    if (currentVoiceRecognitionSession) {
      console.log('[语音识别] 清理之前的会话');
      if (audioRecorder) {
        audioRecorder.stop();
        audioRecorder = null;
      }
      if (recordingStream) {
        recordingStream = null;
      }
      currentVoiceRecognitionSession.audioBuffer = [];
    }
    
    // 尝试加载录音库
    let record;
    try {
      record = require('node-record-lpcm16');
    } catch (error) {
      console.error('[语音识别] node-record-lpcm16 未安装:', error.message);
      return { 
        success: false, 
        error: '录音库未安装，请运行: npm install node-record-lpcm16' 
      };
    }
    
    // 创建新的会话
    const session = {
      isActive: true,
      audioBuffer: [],
      startTime: Date.now()
    };
    
    currentVoiceRecognitionSession = session;
    
    // 开始录制 PCM 16kHz 单声道
    console.log('[语音识别] 开始录制 PCM 16kHz 单声道...');
    
    audioRecorder = record.record({
      sampleRateHertz: 16000,
      threshold: 0,
      verbose: false,
      recordProgram: process.platform === 'win32' ? 'sox' : 'rec', // Windows 用 sox，其他用 rec
      silence: '0.0'
    });
    
    // 监听音频数据
    audioRecorder.stream()
      .on('data', (chunk) => {
        if (currentVoiceRecognitionSession && currentVoiceRecognitionSession.isActive) {
          console.log('[语音识别] 收到 PCM 音频数据，长度:', chunk.length);
          currentVoiceRecognitionSession.audioBuffer.push(chunk);
        }
      })
      .on('error', (error) => {
        console.error('[语音识别] 录音流错误:', error);
      });
    
    recordingStream = audioRecorder.stream();
    
    console.log('[语音识别] PCM 录音已开始');
    
    return { success: true, message: 'PCM 录音已开始' };
  } catch (error) {
    console.error('[语音识别] 启动失败:', error);
    return { success: false, error: error.message };
  }
});

// 发送音频数据（PCM 模式下不需要，音频直接在主进程录制）
ipcMain.handle('send-audio-data', async (event, audioDataArray) => {
  assertTrustedRendererEvent(event);
  // PCM 模式下，音频数据直接在主进程录制，不需要从渲染进程发送
  console.log('[语音识别] send-audio-data 被调用，但 PCM 模式下不需要');
  return { success: true, message: 'PCM 模式下音频在主进程录制' };
});

// 停止语音识别并获取结果
ipcMain.handle('stop-voice-recognition', async (event) => {
  try {
    assertTrustedRendererEvent(event);
    console.log('[语音识别] 停止识别，开始处理音频...');
    
    if (!currentVoiceRecognitionSession) {
      return { success: false, error: '语音识别会话未启动' };
    }
    
    // 停止录音
    if (audioRecorder) {
      console.log('[语音识别] 停止 PCM 录音...');
      audioRecorder.stop();
      audioRecorder = null;
      recordingStream = null;
    }
    
    const session = currentVoiceRecognitionSession;
    currentVoiceRecognitionSession = null;
    
    // 合并音频缓冲区（PCM 数据）
    const audioBuffer = Buffer.concat(session.audioBuffer);
    console.log('[语音识别] PCM 音频总长度:', audioBuffer.length, '字节');
    console.log('[语音识别] PCM 格式: 16kHz, 16-bit, 单声道');
    
    // 将 PCM 音频转换为 Base64
    const audioBase64 = audioBuffer.toString('base64');
    
    // 调用腾讯云一句话识别 API（HTTP）
    const timestamp = Math.floor(Date.now() / 1000);
    const service = 'asr';
    const action = 'SentenceRecognition';
    const region = getTencentCloudConfig().region;
    
    // 构建请求参数（PCM 格式）
    const requestData = {
      ProjectId: 0,
      SubServiceType: 2,
      EngSerViceType: '16k_zh',
      SourceType: 1,
      VoiceFormat: 'pcm', // ✅ PCM 16kHz 16-bit 单声道
      UsrAudioKey: `test_${timestamp}`,
      Data: audioBase64,
      DataLen: audioBuffer.length
    };
    
    console.log('[语音识别] 使用 PCM 格式发送，采样率: 16kHz, 位深: 16-bit, 声道: 单声道');
    
    const requestBody = JSON.stringify(requestData);
    
    // 生成签名（需要请求体和版本号）
    const version = '2019-06-14'; // ASR API 版本
    const authorization = generateTencentCloudSignature(
      getTencentCloudConfig().secretId,
      getTencentCloudConfig().secretKey,
      service,
      action,
      timestamp,
      requestBody,
      version
    );
    
    // 构建请求头（版本号必须和签名中的一致）
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': authorization,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Region': region,
      'X-TC-Timestamp': timestamp.toString()
    };
    
    console.log('[语音识别] 发送请求到腾讯云...');
    console.log('[语音识别] 请求参数:', JSON.stringify({
      ...requestData,
      Data: `[Base64数据，长度: ${audioBase64.length}]`
    }, null, 2));
    console.log('[语音识别] 请求头:', JSON.stringify({
      ...headers,
      Authorization: headers.Authorization.substring(0, 100) + '...'
    }, null, 2));
    
    // 发送 HTTP POST 请求
    const response = await axios.post(
      'https://asr.tencentcloudapi.com/',
      requestBody,
      { 
        headers,
        timeout: 30000 // 30秒超时
      }
    );
    
    console.log('[语音识别] 腾讯云响应:', JSON.stringify(response.data, null, 2));
    
    // 发送识别结果到渲染进程
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('voice-recognition-result', {
        success: true,
        data: response.data
      });
    }
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[语音识别] 识别失败:', error);
    console.error('[语音识别] 错误详情:', error.response?.data || error.message);
    
    // 发送错误到渲染进程
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('voice-recognition-error', {
        success: false,
        error: error.message,
        details: error.response?.data || {}
      });
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data || {}
    };
  }
});

// ==================== 腾讯云语音合成（TTS）相关功能 ====================

// 获取默认打印机名称（从配置文件读取）
function getDefaultPrinterName() {
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'printer-config.json');
    
    console.log('[打印机] 读取默认打印机配置，路径:', configPath);
    
    if (!fs.existsSync(configPath)) {
      console.log('[打印机] 配置文件不存在，使用系统默认打印机');
      return ''; // 返回空字符串，使用系统默认打印机
    }
    
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    const printerName = config.defaultPrinter || '';
    
    if (printerName) {
      console.log('[打印机] ✅ 读取到默认打印机:', printerName);
    } else {
      console.log('[打印机] ⚠️ 配置文件中没有默认打印机，使用系统默认');
    }
    
    return printerName;
  } catch (error) {
    console.error('[打印机] ❌ 读取默认打印机失败:', error);
    console.error('[打印机] 错误详情:', error.message);
    return ''; // 出错时返回空字符串，使用系统默认打印机
  }
}

// 语音合成：将文本转换为语音
ipcMain.handle('text-to-speech', async (event, text, sessionId) => {
  try {
    assertTrustedRendererEvent(event);
    console.log('[TTS] 开始语音合成，文本:', text);
    
    if (!text || !text.trim()) {
      return { success: false, error: '文本不能为空' };
    }
    
    const cfg = getTencentCloudConfig();
    if (!isTencentCloudKeyUsable(cfg.secretId, cfg.secretKey)) {
      return { success: false, error: tencentCloudConfigErrorMessage(cfg) };
    }
    
    // 调用腾讯云 TTS API
    const timestamp = Math.floor(Date.now() / 1000);
    const service = 'tts';
    const action = 'TextToVoice';
    const region = getTencentCloudConfig().region;
    
    // 构建请求参数（使用传入的 sessionId 或生成新的）
    const finalSessionId = sessionId ? `${sessionId}_${timestamp}` : `tts_${timestamp}`;
    
    const requestData = {
      Text: text,
      SessionId: finalSessionId,
      ModelType: 1, // 1-基础音色，2-精品音色
      Volume: 0, // 音量，范围[-10, 10]，默认0
      Speed: 1, // 语速，范围[-2, 2]，默认0
      ProjectId: 0,
      VoiceType: 1001, // 音色类型，1001-智逍遥（亲和）
      PrimaryLanguage: 1, // 主语言类型，1-中文
      SampleRate: 16000 // 采样率，16000
    };
    
    const requestBody = JSON.stringify(requestData);
    
    // 生成签名（TTS API 版本是 2019-08-23）
    const version = '2019-08-23'; // TTS API 版本
    const authorization = generateTencentCloudSignature(
      getTencentCloudConfig().secretId,
      getTencentCloudConfig().secretKey,
      service,
      action,
      timestamp,
      requestBody,
      version
    );
    
    // 构建请求头（版本号必须和签名中的一致）
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': authorization,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Region': region,
      'X-TC-Timestamp': timestamp.toString()
    };
    
    console.log('[TTS] 发送请求到腾讯云...');
    console.log('[TTS] 请求参数:', JSON.stringify(requestData, null, 2));
    
    // 发送 HTTP POST 请求
    const response = await axios.post(
      'https://tts.tencentcloudapi.com/',
      requestBody,
      { 
        headers,
        timeout: 30000
      }
    );
    
    // 检查音频格式
    const audioBase64 = response.data.Response?.Audio;
    if (audioBase64) {
      console.log('[TTS] 音频 Base64 长度:', audioBase64.length);
      console.log('[TTS] 音频 Base64 前10个字符:', audioBase64.substring(0, 10));
      
      // 解码前几个字节检查格式
      try {
        const audioData = Buffer.from(audioBase64, 'base64');
        const header = audioData.slice(0, 4).toString('hex');
        console.log('[TTS] 音频文件头（hex）:', header);
        
        if (header.startsWith('52494646')) { // RIFF
          console.log('[TTS] 音频格式: WAV');
        } else if (header.startsWith('494433') || header.startsWith('fffb') || header.startsWith('fff3')) { // ID3 or MP3
          console.log('[TTS] 音频格式: MP3');
        } else {
          console.log('[TTS] 音频格式: 未知，需要测试');
        }
      } catch (e) {
        console.error('[TTS] 检查音频格式失败:', e);
      }
    }
    
    console.log('[TTS] 腾讯云响应:', JSON.stringify({
      ...response.data,
      Response: {
        ...response.data.Response,
        Audio: response.data.Response?.Audio ? '[Base64音频数据]' : null
      }
    }, null, 2));
    
    // 发送结果到渲染进程
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tts-result', {
        success: true,
        data: response.data
      });
    }
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[TTS] 合成失败:', error);
    console.error('[TTS] 错误详情:', error.response?.data || error.message);
    
    // 发送错误到渲染进程
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tts-error', {
        success: false,
        error: error.message,
        details: error.response?.data || {}
      });
    }
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data || {}
    };
  }
});

// 打印 DPI：EPSON_LQ_730K 等针式打印机系统报告为 120x60，匹配此值可减少缩放模糊
// 不传 dpi，让驱动使用系统默认。Mac 用户可通过「设为系统默认」按钮设置 lpoptions
function getPrintDpiOptions() {
  return getDriverManagedDpiOptions();
}

function printContentToWindowGbPb(printContent, gbBatchId, paperCount) {
  publishPrintJobStatus({ label: '国标批次打印', state: 'printing', message: '国标批次打印正在发送到打印机' });
  const printWindow = new BrowserWindow({
    show: false, // 不显示打印窗口
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 设置打印窗口的缩放比例，确保字体清晰
  printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);

  printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printContent));

  printWindow.webContents.on('did-finish-load', () => {
    // 确保在打印前设置正确的缩放
    printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);
    
    // 获取默认打印机名称
    const defaultPrinter = getDefaultPrinterName();
    console.log('[打印] GB批次打印，使用打印机:', defaultPrinter || '系统默认打印机');
    
    printWindow.webContents.print(createSilentPrintOptions(defaultPrinter, {
      includeLegacyMargins: true
    }), (success, error) => {
      if (success) {
        publishPrintJobStatus({ label: '国标批次打印', state: 'success', message: '国标批次打印已提交' });
        console.log('打印成功userId', gbBatchId);
        // 调用GB批次保存接口
        savePrintBillGbPb(gbBatchId, paperCount);
      } else {
        publishPrintJobStatus({
          label: '国标批次打印',
          state: 'failed',
          retryable: true,
          message: `国标批次打印失败：${serializePrintError(error)}`
        });
        console.log('打印失败userId', error, gbBatchId);
      }
    });
  });
}

// 新的GB批次打印函数：返回Promise，支持IPC回执
function printContentToWindowGbPbWithCallback(printContent, gbBatchId, paperCount, shouldSave = true) {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 设置打印窗口的缩放比例，确保字体清晰
    printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);

    printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printContent));

    printWindow.webContents.on('did-finish-load', () => {
      // 确保在打印前设置正确的缩放
      printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);
      
      // 获取默认打印机名称
      const defaultPrinter = getDefaultPrinterName();
      console.log('[打印] GB批次打印（IPC回执），使用打印机:', defaultPrinter || '系统默认打印机');
      
      printWindow.webContents.print(createSilentPrintOptions(defaultPrinter, {
        includeLegacyMargins: true
      }), (success, error) => {
        printWindow.destroy();
        
        if (success) {
          console.log('✅ [IPC回执] GB批次打印成功 gbBatchId:', gbBatchId, 'shouldSave:', shouldSave);
          
          // 只在 shouldSave=true 时保存打印记录
          if (shouldSave) {
            savePrintBillGbPb(gbBatchId, paperCount);
          } else {
            console.log('⏭️ [IPC回执] 跳过GB批次保存，非最后一页');
          }
          
          resolve({ success: true, gbBatchId });
        } else {
          console.error('❌ [IPC回执] GB批次打印失败:', error, 'gbBatchId:', gbBatchId);
          reject({ success: false, error, gbBatchId });
        }
      });
    });

    printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      printWindow.destroy();
      reject({ success: false, error: `加载失败: ${errorDescription}`, errorCode });
    });
  });
}


function printContentToWindowGb(printContent, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount) {
  publishPrintJobStatus({ label: '国标订单打印', state: 'printing', message: '国标订单打印正在发送到打印机' });
  const printWindow = new BrowserWindow({
    show: false, // 不显示打印窗口
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 设置打印窗口的缩放比例，确保字体清晰
  printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);

  printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printContent));

  printWindow.webContents.on('did-finish-load', () => {
    // 确保在打印前设置正确的缩放
    printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);
    
    // 获取默认打印机名称
    const defaultPrinter = getDefaultPrinterName();
    console.log('[打印] GB订单打印，使用打印机:', defaultPrinter || '系统默认打印机');
    
    printWindow.webContents.print(createSilentPrintOptions(defaultPrinter, {
      includeLegacyMargins: true
    }), (success, error) => {
      if (success) {
        publishPrintJobStatus({ label: '国标订单打印', state: 'success', message: '国标订单打印已提交' });
        console.log('打印成功userId', userId);
        // 调用GB订单保存接口
        savePrintBillGb(gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount);
      } else {
        publishPrintJobStatus({
          label: '国标订单打印',
          state: 'failed',
          retryable: true,
          message: `国标订单打印失败：${serializePrintError(error)}`
        });
        console.log('打印失败userId', error, userId);
      }
    });
  });
}

// 新的GB打印函数：返回Promise，支持IPC回执
function printContentToWindowGbWithCallback(printContent, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount, shouldSave = true) {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 设置打印窗口的缩放比例，确保字体清晰
    printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);

    printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printContent));

    printWindow.webContents.on('did-finish-load', () => {
      // 确保在打印前设置正确的缩放
      printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);
      
      // 获取默认打印机名称
      const defaultPrinter = getDefaultPrinterName();
      console.log('[打印] GB订单打印（IPC回执），使用打印机:', defaultPrinter || '系统默认打印机');
      
      printWindow.webContents.print(createSilentPrintOptions(defaultPrinter, {
        includeLegacyMargins: true
      }), (success, error) => {
        printWindow.destroy();
        
        if (success) {
          console.log('✅ [IPC回执] GB打印成功 userId:', userId, 'tradeNo:', tradeNo, 'shouldSave:', shouldSave);
          
          // 只在 shouldSave=true 时保存打印记录
          if (shouldSave) {
            savePrintBillGb(gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount);
          } else {
            console.log('⏭️ [IPC回执] 跳过GB保存，非最后一页');
          }
          
          resolve({ success: true, tradeNo });
        } else {
          console.error('❌ [IPC回执] GB打印失败:', error, 'userId:', userId);
          reject({ success: false, error, tradeNo });
        }
      });
    });

    printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      printWindow.destroy();
      reject({ success: false, error: `加载失败: ${errorDescription}`, errorCode });
    });
  });
}



function printContentToWindow(printContent, depFatherId, depId, tradeNo, userId, paperCount) {
  publishPrintJobStatus({ label: '配送单打印', state: 'printing', message: '配送单正在发送到打印机' });
  const printWindow = new BrowserWindow({
    show: false, // 不显示打印窗口
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 设置打印窗口的缩放比例，确保字体清晰
  printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);

  printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printContent));

  printWindow.webContents.on('did-finish-load', () => {
    // 确保在打印前设置正确的缩放
    printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);
    
    // 获取默认打印机名称
    const defaultPrinter = getDefaultPrinterName();
    console.log('[打印] 普通订单打印，使用打印机:', defaultPrinter || '系统默认打印机');
    
    printWindow.webContents.print(createSilentPrintOptions(defaultPrinter, {
      includeLegacyMargins: true
    }), (success, error) => {
      if (success) {
        publishPrintJobStatus({ label: '配送单打印', state: 'success', message: '配送单已提交' });
        console.log('打印成功userId', userId);
        
        // 检查是否有设备配置，决定使用哪个接口
        if (mainWindow) {
          console.log('🔍 检查设备配置，决定使用哪个保存接口...');
          mainWindow.webContents.send('check-device-config-for-print', {
            depFatherId, depId, tradeNo, userId, paperCount
          });
        } else {
          console.log('⚠️ 主窗口不存在，使用老接口');
          savePrintBill(depFatherId, depId, tradeNo, userId, paperCount);
        }
        console.log('✅ 已发送设备配置检查请求');
      } else {
        publishPrintJobStatus({
          label: '配送单打印',
          state: 'failed',
          retryable: true,
          message: `配送单打印失败：${serializePrintError(error)}`
        });
        console.log('打印失败userId', error, userId);
      }
    });
  });
}

// 新的打印函数：返回Promise，支持IPC回执。isHistoryOrder=true 时跳过保存接口和刷新客户列表
function printContentToWindowWithCallback(printContent, depFatherId, depId, tradeNo, userId, paperCount, shouldSave = true, isHistoryOrder = false, orderIds, printOptionOverrides = {}) {
  console.log('🚀 [printContentToWindowWithCallback] ========== 开始创建打印窗口 ==========');
  console.log('🚀 [printContentToWindowWithCallback] 参数:', { depFatherId, depId, tradeNo, userId, paperCount, shouldSave, isHistoryOrder });
  console.log('🚀 [printContentToWindowWithCallback] HTML长度:', printContent ? printContent.length : 0);
  
  return new Promise((resolve, reject) => {
    console.log('🪟 [printContentToWindowWithCallback] 创建 BrowserWindow...');
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    console.log('🪟 [printContentToWindowWithCallback] BrowserWindow 创建成功');

    // 设置打印窗口的缩放比例，确保字体清晰
    printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);

    const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(printContent);
    console.log('📄 [printContentToWindowWithCallback] 加载打印内容，URL长度:', dataUrl.length);
    console.log('📄 [printContentToWindowWithCallback] HTML内容长度:', printContent.length);
    printWindow.loadURL(dataUrl);

    // 添加超时处理，防止打印窗口一直等待
    let timeoutId = null;
    let isResolved = false;
    
    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        console.error('❌ [printContentToWindowWithCallback] 打印超时（10秒）');
        printWindow.destroy();
        isResolved = true;
        reject({ success: false, error: '打印超时', timeout: true });
      }
    }, PRINT_RUNTIME_CONFIG.requestTimeoutMs);
    
    printWindow.webContents.on('did-finish-load', () => {
      console.log('📄 [printContentToWindowWithCallback] 打印窗口加载完成，准备打印');
      console.log('📄 [printContentToWindowWithCallback] HTML内容长度:', printContent.length);
      console.log('📄 [printContentToWindowWithCallback] 打印参数:', { depFatherId, depId, tradeNo, userId, paperCount, shouldSave });
      
      // 确保在打印前设置正确的缩放
      printWindow.webContents.setZoomFactor(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor);
      
      // 添加延迟，确保内容完全渲染（根据 GPT 建议，延迟 500ms 确保 HTML/CSS/图片完全加载）
      setTimeout(async () => {
        if (isResolved) {
          console.warn('⚠️ [printContentToWindowWithCallback] 已超时，跳过打印');
          return; // 如果已经超时，不再执行打印
        }
        
        // 额外延迟，确保内容完全渲染（特别是图片和 CSS）
        // GPT 建议：在 did-finish-load 之后延迟 500ms 调用打印
        console.log('⏳ [printContentToWindowWithCallback] 等待 500ms 确保内容完全渲染...');
        await new Promise(resolve => setTimeout(resolve, PRINT_RUNTIME_CONFIG.renderDelayMs));
        
        if (isResolved) {
          console.warn('⚠️ [printContentToWindowWithCallback] 延迟期间已超时，跳过打印');
          return;
        }
        
        console.log('✅ [printContentToWindowWithCallback] 内容渲染延迟完成，准备打印');
        
        // 获取默认打印机名称
        const defaultPrinter = getDefaultPrinterName();
        console.log('[打印] 普通订单打印（IPC回执），配置的打印机:', defaultPrinter || '系统默认打印机');
        
        // 验证打印机是否存在（如果指定了打印机名称）
        let finalPrinterName = '';
        if (defaultPrinter) {
          // 获取系统打印机列表，验证打印机是否存在
          try {
            if (mainWindow && !mainWindow.isDestroyed()) {
              let systemPrinters = [];
              if (typeof mainWindow.webContents.getPrinters === 'function') {
                systemPrinters = mainWindow.webContents.getPrinters();
              } else if (typeof mainWindow.webContents.getPrintersAsync === 'function') {
                systemPrinters = await mainWindow.webContents.getPrintersAsync();
              }
              
              console.log('🔍 [打印] 系统打印机列表:', systemPrinters.map(p => ({ name: p.name, displayName: p.displayName })));
              
              // 检查打印机是否存在（支持名称和显示名称匹配）
              const printerExists = systemPrinters.some(p => 
                p.name === defaultPrinter || 
                p.displayName === defaultPrinter ||
                p.name.toLowerCase() === defaultPrinter.toLowerCase() ||
                p.displayName.toLowerCase() === defaultPrinter.toLowerCase()
              );
              
              if (printerExists) {
                // 找到匹配的打印机，使用实际名称
                const matchedPrinter = systemPrinters.find(p => 
                  p.name === defaultPrinter || 
                  p.displayName === defaultPrinter ||
                  p.name.toLowerCase() === defaultPrinter.toLowerCase() ||
                  p.displayName.toLowerCase() === defaultPrinter.toLowerCase()
                );
                // 优先使用 name，但如果 name 包含下划线而 displayName 更标准，可以尝试使用 displayName
                // 对于 Epson 打印机，displayName 通常是更标准的格式（如 "EPSON LQ-730K"）
                finalPrinterName = matchedPrinter.name; // 使用系统识别的名称
                console.log('✅ [打印] 打印机存在，使用:', finalPrinterName, '(配置名称:', defaultPrinter, ')');
                console.log('📋 [打印] 打印机详细信息:', {
                  name: matchedPrinter.name,
                  displayName: matchedPrinter.displayName,
                  description: matchedPrinter.description
                });
                
                // 检查打印机状态
                if (matchedPrinter.status !== undefined) {
                  const statusText = matchedPrinter.status === 0 ? '空闲' : 
                                   matchedPrinter.status === 1 ? '打印中' :
                                   matchedPrinter.status === 2 ? '暂停' :
                                   matchedPrinter.status === 3 ? '错误' : '未知';
                  console.log('📊 [打印] 打印机状态:', statusText, '(状态码:', matchedPrinter.status, ')');
                  
                  if (matchedPrinter.status === 2) {
                    console.warn('⚠️ [打印] 打印机处于暂停状态，打印可能失败');
                  } else if (matchedPrinter.status === 3) {
                    console.error('❌ [打印] 打印机处于错误状态，打印可能失败');
                  }
                }
              } else {
                console.warn('⚠️ [打印] 配置的打印机不存在！');
                console.warn('⚠️ [打印] 配置的打印机名称:', defaultPrinter);
                console.warn('⚠️ [打印] 可用打印机列表:');
                systemPrinters.forEach(p => console.warn('  - 名称:', p.name, '显示名称:', p.displayName));
                console.warn('⚠️ [打印] 回退到系统默认打印机');
                finalPrinterName = ''; // 使用系统默认
              }
            } else {
              console.warn('⚠️ [打印] 主窗口不可用，使用配置的打印机名称:', defaultPrinter);
              finalPrinterName = defaultPrinter;
            }
          } catch (printerCheckError) {
            console.error('❌ [打印] 检查打印机失败:', printerCheckError);
            console.warn('⚠️ [打印] 使用配置的打印机名称:', defaultPrinter);
            finalPrinterName = defaultPrinter;
          }
        } else {
          finalPrinterName = '';
          console.log('ℹ️ [打印] 未配置默认打印机，使用系统默认');
        }
        
        console.log('🖨️ [printContentToWindowWithCallback] 开始调用打印API');
        
        // 根据 GPT 建议优化打印参数：
        // 1. 使用 marginsType: 0 (默认边距)，比 'none' 更稳健
        // 2. 移除自定义 DPI，让驱动自己决定（针式打印机对 DPI 很敏感）
        // 3. 开启 printBackground 防止样式丢失
        const printOptions = createSilentPrintOptions(finalPrinterName, printOptionOverrides);
        appLogger.append('info', 'print', 'silent-print-options', {
          tradeNo,
          printerName: finalPrinterName || defaultPrinter || '',
          pageSize: printOptions.pageSize || null,
          marginsType: printOptions.marginsType,
        });
        
        console.log('🖨️ [printContentToWindowWithCallback] 打印参数:', printOptions);
        console.log('🖨️ [printContentToWindowWithCallback] 优化说明:');
        console.log('  - 使用 marginsType: 0 (默认边距)');
        console.log('  - macOS 使用 300x300 DPI，Windows 不设置让驱动决定');
        console.log('  - 开启 printBackground: true');
        console.log('  - 如果打印失败，请检查打印机是否在线、缺纸或暂停');
        
        // 监听打印错误事件
        printWindow.webContents.on('print-failed', (event, errorCode, errorDescription) => {
          console.error('❌ [打印] 打印失败事件触发');
          console.error('❌ [打印] errorCode:', errorCode);
          console.error('❌ [打印] errorDescription:', errorDescription);
        });
        
        printWindow.webContents.print(printOptions, async (success, error) => {
          console.log('🖨️ [printContentToWindowWithCallback] ========== 打印回调被调用 ==========');
          console.log('🖨️ [printContentToWindowWithCallback] success:', success);
          console.log('🖨️ [printContentToWindowWithCallback] error:', error);
          console.log('🖨️ [printContentToWindowWithCallback] error类型:', typeof error);
          console.log('🖨️ [printContentToWindowWithCallback] 打印参数:', { userId, tradeNo, shouldSave });
          console.log('🖨️ [printContentToWindowWithCallback] 使用的打印机:', finalPrinterName || '系统默认');
          
          cleanup(); // 清除超时
          
          // 关闭打印窗口
          printWindow.destroy();
          
          if (isResolved) {
            console.warn('⚠️ [printContentToWindowWithCallback] 回调执行时已超时，忽略结果');
            return; // 如果已经超时，不再处理回调
          }
          isResolved = true;
          
          if (success) {
            console.log('✅ [IPC回执] ========== 打印成功 ==========');
            console.log('✅ [IPC回执] userId:', userId);
            console.log('✅ [IPC回执] tradeNo:', tradeNo);
            console.log('✅ [IPC回执] shouldSave:', shouldSave);
            console.log('✅ [IPC回执] 打印机:', defaultPrinter || '系统默认打印机');
            
            let saved = false;
            // 历史订单打印：跳过保存接口和刷新客户列表
            if (isHistoryOrder) {
              console.log('⏭️ [IPC回执] 历史订单打印，跳过保存接口');
            } else if (shouldSave) {
              console.log('💾 [IPC回执] 需要保存打印记录，paperCount:', paperCount);
              try {
                await requestPrintedOrderSave({
                  depFatherId, depId, tradeNo, userId, paperCount, orderIds
                });
                saved = true;
                console.log('✅ [IPC回执] 打印后的订单保存已确认');
              } catch (saveError) {
                console.error('❌ [IPC回执] 打印已提交，但订单保存失败:', saveError);
                reject({
                  success: false,
                  printed: true,
                  saveFailed: true,
                  error: saveError.message || '订单保存失败',
                  tradeNo
                });
                return;
              }
            } else {
              console.log('⏭️ [IPC回执] 跳过保存，非最后一页');
            }
            
            resolve({
              success: true,
              tradeNo,
              saved,
              printerName: finalPrinterName || defaultPrinter || ''
            });
          } else {
            console.error('❌ [IPC回执] ========== 打印失败 ==========');
            console.error('❌ [IPC回执] error:', error);
            console.error('❌ [IPC回执] error类型:', typeof error);
            console.error('❌ [IPC回执] error字符串:', String(error));
            console.error('❌ [IPC回执] userId:', userId);
            console.error('❌ [IPC回执] tradeNo:', tradeNo);
            console.error('❌ [IPC回执] 使用的打印机:', finalPrinterName || defaultPrinter || '系统默认打印机');
            
            // 如果指定了打印机但打印失败，可能是打印机名称不匹配或打印机状态问题
            if (finalPrinterName || defaultPrinter) {
              console.warn('⚠️ [IPC回执] 使用了指定打印机但打印失败');
              console.warn('⚠️ [IPC回执] 可能的原因:');
              console.warn('  1. 打印机名称不匹配');
              console.warn('  2. 打印机离线或未连接');
              console.warn('  3. 打印机处于暂停或错误状态');
              console.warn('  4. 打印机驱动问题');
              console.warn('⚠️ [IPC回执] 尝试的打印机名称:', finalPrinterName || defaultPrinter);
              console.warn('💡 [IPC回执] 建议: 尝试使用系统默认打印机或检查打印机状态');
            }
            
            reject({ success: false, error: error || '打印失败', tradeNo, printer: finalPrinterName || defaultPrinter });
          }
        });
      }, 100); // 添加100ms延迟，确保内容完全渲染
    });

    // 处理加载错误
    printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('❌ [printContentToWindowWithCallback] 打印窗口加载失败');
      console.error('❌ [printContentToWindowWithCallback] errorCode:', errorCode);
      console.error('❌ [printContentToWindowWithCallback] errorDescription:', errorDescription);
      console.error('❌ [printContentToWindowWithCallback] validatedURL:', validatedURL);
      
      cleanup();
      printWindow.destroy();
      
      if (!isResolved) {
        isResolved = true;
        reject({ success: false, error: `加载失败: ${errorDescription}`, errorCode });
      }
    });
    
    // 监听打印窗口控制台消息（用于调试）
    printWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`[打印窗口控制台] [${level}] ${message} (${sourceId}:${line})`);
    });
  });
}



function saveAccountBillPrinterSelf(depFatherId, depId, tradeNo, userId, paperCount) {
  console.log('🔧 开始调用合并接口 saveAccountBillPrinterSelf:', {
    depFatherId, depId, tradeNo, userId, paperCount
  });

  // 先向渲染进程请求设备配置信息
  if (mainWindow) {
    mainWindow.webContents.send('get-device-config-for-merge', {
      depId: depId,
      depFatherId: depFatherId,
      tradeNo: tradeNo,
      userId: userId,
      printType: 'normal', // 普通订单打印
      paperCount: paperCount // 打印纸张数量
    });
  } else {
    console.warn('⚠️ 主窗口不存在，无法获取设备配置');
  }
}

async function savePrintBill(depFatherId, depId, tradeNo, userId, paperCount, orderIds) {
  console.log('💾 [savePrintBill] 开始保存订单:', {
    depFatherId, depId, tradeNo, userId, paperCount
  });

  const apiUrl = `${runtimeApiBaseUrl}nxdepartmentbill/saveAccountBillPrinter/`;

  console.log('🌐 [savePrintBill] 请求URL:', apiUrl);

  // 发起请求
  const postData = {
    depId: depId,
    depFatherId: depFatherId,
    tradeNo: tradeNo,
    userId: userId,
    orderIds: Array.isArray(orderIds) && orderIds.length ? orderIds.join(',') : undefined
  };

  console.log('📤 [savePrintBill] 请求数据:', postData);

  try {
    const response = await axios.post(apiUrl, postData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    const responseData = assertSuccessfulWriteResponse(response, '订单保存');
    console.log('✅ [savePrintBill] 保存成功:', response.data);
    
    // 保存成功后，调用设备记录接口
    recordDevicePrint({
      depId: depId,
      depFatherId: depFatherId,
      tradeNo: tradeNo,
      userId: userId,
      printType: 'normal', // 普通订单打印
      paperCount: paperCount // 打印纸张数量
    });
    
    if (mainWindow) {      
      mainWindow.webContents.send('refresh-customer-list');
    }
    return responseData;
  } catch (error) {
    console.error('❌ [savePrintBill] 保存失败:', error.message);
    console.error('❌ [savePrintBill] 错误详情:', error.response?.data);
    console.error('❌ [savePrintBill] 状态码:', error.response?.status);
    console.error('❌ [savePrintBill] 完整错误:', error);
    throw error;
  }
}

// 新增：设备打印记录接口
function recordDevicePrint(printParams) {
  console.log('🔧 开始记录设备打印信息:', printParams);
  
  // 向渲染进程请求设备配置信息
  if (mainWindow) {
    mainWindow.webContents.send('get-device-config', printParams);
  } else {
    console.warn('⚠️ 主窗口不存在，无法获取设备配置');
  }
}

// 监听来自渲染进程的设备配置信息
ipcMain.on('device-config-response', (event, deviceConfig, printParams) => {
  assertTrustedRendererEvent(event);
  assertDeviceConfigResponse(deviceConfig, printParams);
  console.log('📱 收到设备配置:', deviceConfig);
  console.log('📋 收到printParams:', printParams);
  console.log('👤 printParams.distributerName:', printParams.distributerName);
  
  // 检查是否有有效的设备配置
  const deviceId = parseInt(deviceConfig?.selectedDevice?.nxPdId || 0);
  const marketId = parseInt(deviceConfig?.deviceAdminInfo?.marketId || 0);
  
  // 如果没有设备配置或设备ID/市场ID为0，跳过设备打印记录
  if (!deviceConfig || !deviceConfig.selectedDevice || !deviceConfig.deviceAdminInfo || 
      deviceId === 0 || marketId === 0) {
    console.log('⚠️ [设备打印记录] 没有有效的设备配置，跳过设备打印记录');
    console.log('⚠️ [设备打印记录] deviceConfig:', deviceConfig);
    console.log('⚠️ [设备打印记录] deviceId:', deviceId, 'marketId:', marketId);
    return;
  }
  
  const apiUrl = `${runtimeApiBaseUrl}machine/print/record`;

  // 构建设备记录数据 - 按照后端接口要求，确保数据类型正确
  const deviceRecordData = {
    billId: parseInt(printParams.depId || printParams.gbDepId || 0), // 单据ID (Integer)
    deviceId: deviceId, // 打印机设备ID (Integer)
    marketId: marketId, // 市场ID (Integer)
    distributerId: parseInt(printParams.userId || 0), // 配送商ID (Integer)
    billTotal: null, // 单据金额（可选）
    billTradeNo: printParams.tradeNo || '', // 单据流水号（可选）
    operatorId: parseInt(printParams.userId || 0), // 操作人ID（可选）
    operatorName: printParams.distributerName || '', // 操作人姓名（配送商名称）
    paperCount: Math.max(1, parseInt(printParams.paperCount || 1)) // 打印纸张数量 (Integer，至少1张)
  };

  console.log('📤 发送设备记录数据:', deviceRecordData);

  // 尝试不同的数据格式
  console.log('📤 尝试发送设备记录数据 (form格式):', deviceRecordData);
  
  // 方法1：使用 form 格式，确保参数正确传递
  const formData = new URLSearchParams();
  Object.keys(deviceRecordData).forEach(key => {
    const value = deviceRecordData[key];
    // paperCount 是必需参数，即使为0也要发送
    if (key === 'paperCount' || (value !== null && value !== undefined && value !== '')) {
      formData.append(key, value.toString());
    }
  });
  
  console.log('📋 Form数据内容:', formData.toString());

  // 重试机制处理死锁
  const maxRetries = 3;
  let retryCount = 0;
  
  const attemptRecord = () => {
    axios.post(apiUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    .then(response => {
      console.log('✅ 设备打印记录成功:', response.data);
    })
    .catch(error => {
      console.error('❌ 设备打印记录失败 (form格式):', error.message);
      console.error('❌ 错误详情:', error.response?.data);
      console.error('❌ 状态码:', error.response?.status);
      
      // 检查是否是死锁错误
      const isDeadlock = error.response && error.response.data && 
                        error.response.data.msg && 
                        error.response.data.msg.includes('Deadlock');
      
      if (isDeadlock && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.random() * 1000 + 500; // 500-1500ms随机延迟
        console.log(`🔄 检测到死锁，${delay}ms后重试 (${retryCount}/${maxRetries})`);
        
        setTimeout(() => {
          attemptRecord();
        }, delay);
        return;
      }
      
      // 如果form格式失败且不是死锁，尝试JSON格式
      console.log('🔄 尝试JSON格式...');
      axios.post(apiUrl, deviceRecordData, {
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .then(response => {
        console.log('✅ 设备打印记录成功 (JSON格式):', response.data);
      })
      .catch(jsonError => {
        console.error('❌ 设备打印记录失败 (JSON格式):', jsonError.message);
        console.error('❌ JSON错误详情:', jsonError.response?.data);
      });
    });
  };
  
  attemptRecord();
});

// 监听来自渲染进程的设备配置信息 - 用于合并接口
ipcMain.on('device-config-response-for-merge', async (event, deviceConfig, printParams) => {
  const saveRequestId = printParams && printParams.saveRequestId;
  try {
    assertTrustedRendererEvent(event);
    assertDeviceConfigResponse(deviceConfig, printParams);
    console.log('📱 收到设备配置 (合并接口):', deviceConfig);
    console.log('📋 收到printParams (合并接口):', printParams);

    if (!deviceConfig?.selectedDevice?.nxPdId || !deviceConfig?.deviceAdminInfo?.marketId) {
      throw new Error('打印设备配置已失效，请重新选择打印设备');
    }

    const apiUrl = `${runtimeApiBaseUrl}nxdepartmentbill/saveAccountBillPrinterSelf`;
    const mergeData = {
      depFatherId: parseInt(printParams.depFatherId || 0),
      depId: parseInt(printParams.depId || 0),
      tradeNo: printParams.tradeNo || '',
      userId: parseInt(printParams.userId || 0),
      deviceId: parseInt(deviceConfig.selectedDevice.nxPdId),
      pricePerSheet: '0.00',
      marketId: parseInt(deviceConfig.deviceAdminInfo.marketId),
      paperCount: Math.max(1, parseInt(printParams.paperCount || 1)),
      orderIds: Array.isArray(printParams.orderIds) && printParams.orderIds.length
        ? printParams.orderIds.join(',')
        : undefined
    };

    console.log('📤 发送合并接口数据:', mergeData);
    const formData = new URLSearchParams();
    Object.keys(mergeData).forEach(key => {
      const value = mergeData[key];
      if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value.toString());
      }
    });

    const response = await axios.post(apiUrl, formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const responseData = assertSuccessfulWriteResponse(response, '订单及打印记录保存');
    console.log('✅ 合并接口调用成功:', responseData);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('refresh-customer-list');
    }
    settlePrintedOrderSave(saveRequestId, null, responseData);
  } catch (error) {
    console.error('❌ 合并接口调用失败:', error.message);
    console.error('❌ 错误详情:', error.response?.data);
    console.error('❌ 状态码:', error.response?.status);
    settlePrintedOrderSave(saveRequestId, error);
  }
});

// 监听设备配置检查结果 - 决定使用哪个保存接口
ipcMain.on('device-config-check-result', async (event, hasDeviceConfig, printParams) => {
  const saveRequestId = printParams && printParams.saveRequestId;
  try {
    assertTrustedRendererEvent(event);
    if (typeof hasDeviceConfig !== 'boolean') {
      throw new TypeError('hasDeviceConfig 必须是布尔值');
    }
    assertPrintMetadata(printParams);
    console.log('📋 [主进程] 收到设备配置检查结果:', hasDeviceConfig);
    console.log('📋 [主进程] 打印参数:', JSON.stringify(printParams, null, 2));

    if (hasDeviceConfig) {
      console.log('✅ [主进程] 有设备配置，使用新接口 saveAccountBillPrinterSelf');
      if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('主窗口不可用，无法读取打印设备配置');
      }
      console.log('📤 [主进程] 发送设备配置合并请求到渲染进程');
      mainWindow.webContents.send('get-device-config-for-merge', printParams);
      return;
    }

    console.log('⚠️ [主进程] 没有设备配置，使用老接口 savePrintBill');
    const responseData = await savePrintBill(
      printParams.depFatherId,
      printParams.depId,
      printParams.tradeNo,
      printParams.userId,
      printParams.paperCount,
      printParams.orderIds
    );
    settlePrintedOrderSave(saveRequestId, null, responseData);
  } catch (error) {
    settlePrintedOrderSave(saveRequestId, error);
    if (!saveRequestId) {
      console.error('❌ [主进程] 打印后保存失败:', error);
    }
  }
});

function savePrintBillGb(gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount) {
  console.log('GB订单保存:', gbDepFatherId, gbDepId, tradeNo, userId, nxDisId);

  const apiUrl = `${runtimeApiBaseUrl}nxdepartmentbill/saveAccountBillPrinterGb/`;

  // 发起请求
  const postData = {
    gbDepId: gbDepId,
    gbDepFatherId: gbDepFatherId,
    tradeNo: tradeNo,
    userId: userId,
    nxDisId: nxDisId
  };

  axios.post(apiUrl, postData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
  .then(response => {
    console.log('GB订单保存成功:', response.data);
    
    // 保存成功后，调用设备记录接口
    recordDevicePrint({
      depId: gbDepId,
      depFatherId: gbDepFatherId,
      tradeNo: tradeNo,
      userId: userId,
      nxDisId: nxDisId,
      printType: 'gb', // GB订单打印
      paperCount: paperCount // 打印纸张数量
    });
    
    if (mainWindow) {
      mainWindow.webContents.send('refresh-customer-list');
    }
  })
  .catch(error => {
    console.error('GB订单保存失败:', error.message);
  });
}

function savePrintBillGbPb(gbBatchId, paperCount) {
  console.log("gbBatchId",gbBatchId, '0000保gbBatchIdgbBatchId');

  const apiUrl = `${runtimeApiBaseUrl}gbdistributerpurchasebatch/nxDisPrintGbPurBatch/`;
    axios.get(`${apiUrl}${gbBatchId}`)
    .then(response => {
      console.log('GB批次保存成功:', response.data);
      
      // 保存成功后，调用设备记录接口
      recordDevicePrint({
        gbBatchId: gbBatchId,
        printType: 'gb-batch', // GB批次打印
        paperCount: paperCount // 打印纸张数量
      });
      
      if (mainWindow) {
        mainWindow.webContents.send('refresh-customer-list');
      }
    })
    .catch(error => {
      console.error('GB批次保存失败:', error.message);
    });
}


app.whenReady().then(async () => {
  // 日志目录、会话头、主进程异常、渲染进程 app-log IPC
  appLogger.init(ipcMain, shell, assertTrustedRendererEvent);
  appLogger.append('info', 'main', 'runtime-profile', {
    mode: runtimeMode,
    appName: runtimeProfile.appName,
    userData: app.getPath('userData'),
    apiBaseUrl: runtimeApiBaseUrl,
  });
  // 创建中文菜单
  createMenu();
  wechatAutoReadScheduler = createWechatAutoReadScheduler({
    filePath: getWechatAutoReadConfigPath(),
    onTrigger: deliverScheduledWechatAutoRead,
    logger: console,
  });
  // IPC handlers 只注册一次，避免 createWindow 多次调用时重复注册报错
  setupIpcHandlers();
  
  createWindow();
  wechatAutoReadScheduler.start();
  
  // ===== 3011 本地安全桥轮询（grain-print-mcp 连接器）=====
  // 同一任务靠 mcp-bridge-client 的持久化 markExecuted 去重，严守「同一条打印任务只走一条有效路径」。
  // 字段映射（R1）：3011 任务仅含 {id,taskId,disId,departmentId,printMode,subDepartmentId,purpose,orderVersion}，
  //   渲染端 triggerPrintDeliveryOrder 要求 task.type==='nx_delivery' 才触发（App.vue:221），
  //   并自行按 departmentId/printMode/subDepartmentId 调 phoneGetToFillDepOrders 拉明细（Bills.vue 行为），
  //   故仅补 type 常量，禁止填假值/空串/默认 0。
  // ===== 微信状态探测（用于连接器就绪自检 + 桌面端红条提示）=====
  // open：本地微信进程是否运行（macOS: WeChat；Windows: Weixin.exe/WeChat.exe）；
  // loggedIn：只根据微信进程当前打开的 db_storage 文件判断；严禁为状态探测
  // 启动 Reader 或查询聊天数据库，避免后台轮询持续占用微信的实时数据文件。
  // 结果缓存 30s，避免每个桥轮询周期都执行系统进程检查。
  let _wechatStateCache = { open: null, loggedIn: null, at: 0 };
  async function detectWechatState() {
    const now = Date.now();
    if (now - _wechatStateCache.at < 30000) return _wechatStateCache;
    const open = detectWechatProcessOpen();
    const loggedIn = open
      ? detectWechatLoginStateWithoutReader()
      : false;
    _wechatStateCache = { open, loggedIn, at: now };
    return _wechatStateCache;
  }

  // 把桥连接状态推给渲染端，用于顶部红条提示（GrainPrint 未登录 / 微信未开 / 微信未登录）。
  function sendBridgeStatus(loginDisId, wechatState) {
    const target = (mainWindow && !mainWindow.isDestroyed())
      ? mainWindow
      : (BrowserWindow.getAllWindows() || [])[0];
    if (!target || target.isDestroyed()) return;
    target.webContents.send('mcp-bridge-status', {
      grainPrintConnected: !!loginDisId,
      loginDisId: loginDisId || null,
      wechat: wechatState || { open: null, loggedIn: null },
    });
  }

  async function bridgePollTick() {
    const wechatState = await detectWechatState();
    const deps = {
      getLoggedInDisId: () => mcpBridgeClient.getLoggedInDisId(),
      markExecuted: (taskId) => mcpBridgeClient.markExecuted(taskId),
      acceptTask: (taskId) => mcpBridgeClient.acceptTask(taskId),
      reportIdentity: (disId, printerAvailable) => mcpBridgeClient.reportIdentity(disId, printerAvailable, wechatState),
      reportHeartbeat: () => mcpBridgeClient.reportHeartbeat(),
      fetchTasks: (disId) => mcpBridgeClient.fetchTasks(disId),
      getDefaultPrinterName: () => {
        try { return getDefaultPrinterName(); } catch (e) { return null; }
      },
      // R2 结果回传的 main 侧钩子已就绪（见 ipcMain.on('mcp-print-result')）；
      // 渲染端 OrderPrint 组件出纸完成后再经 IPC 回传 taskId+success，本函数只负责「受理→下发」。
      pushToRenderer: (task) => {
        const target = (mainWindow && !mainWindow.isDestroyed())
          ? mainWindow
          : (BrowserWindow.getAllWindows() || [])[0];
        if (!target || target.isDestroyed()) return { ok: false, error: 'no-window' };
        const enriched = Object.assign({}, task, {
          type: task.type || 'nx_delivery',
          taskId: task.taskId || task.id,
          id: task.id
        });
        pushMcpPrintTaskToRenderer(target.webContents, enriched);
        return { ok: true };
      }
    };
    try {
      const r = await taskRunner.pollOnce(deps);
      if (r && r.fetched) console.log('[MCP-3011] 本轮:', JSON.stringify(r));
      const loginDisId = await mcpBridgeClient.getLoggedInDisId();
      sendBridgeStatus(loginDisId, wechatState);
    } catch (e) {
      console.warn('[MCP-3011] 轮询异常:', e && e.message);
    }
  }
  bridgePollTick();
  bridgePollingInterval = setInterval(bridgePollTick, 2000);

  // 对于 macOS，当所有窗口关闭时重新激活应用的处理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();

  });
});

// 应用退出时关闭 MCP 服务器
app.on('before-quit', (event) => {
  if (quitAfterReaderShutdown) return;
  event.preventDefault();
  if (!beforeQuitReaderPromise) {
    beforeQuitReaderPromise = Promise.all([
      shutdownReader().catch((error) => {
        appLogger.append('error', 'wechat-reader', 'reader stop failed during before-quit', {
          message: error?.message,
        });
      }),
      shutdownWechatUiAutomation().catch((error) => {
        appLogger.append('error', 'wechat-ui', 'ui automation stop failed during before-quit', {
          message: error?.message,
        });
      }),
      shutdownWechatWorkspaceWindow().catch((error) => {
        appLogger.append('error', 'wechat-ui', 'workspace window restore failed during before-quit', {
          message: error?.message,
        });
      }),
    ])
      .finally(() => {
        quitAfterReaderShutdown = true;
        app.quit();
      });
  }
});

app.on('will-quit', () => {
  // before-quit 已等待 Reader；这里保留幂等兜底，禁止遗漏自身启动的 child。
  void shutdownReader();
  void shutdownWechatUiAutomation();
  void shutdownWechatWorkspaceWindow();
  if (dispatchGateway) {
    dispatchGateway.dispose();
    dispatchGateway = null;
  }
  if (bridgePollingInterval) {
    clearInterval(bridgePollingInterval);
    console.log('[MCP-3011] 桥轮询已停止');
  }
  wechatAutoReadScheduler?.stop();
});

app.on('window-all-closed', () => {
  // macOS 关闭最后一个窗口也释放 Reader 和 UI 自动化 child；下次按请求懒启动。
  Promise.all([shutdownReader(), shutdownWechatUiAutomation(), shutdownWechatWorkspaceWindow()])
    .catch((error) => {
      appLogger.append('error', 'wechat-runtime', 'wechat child stop failed after window-all-closed', {
        message: error?.message,
      });
    })
    .finally(() => {
      wechatReaderService = null;
      if (process.platform !== 'darwin') {
        quitAfterReaderShutdown = true;
        app.quit();
      }
    });
});
