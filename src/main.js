// src/main.js
const { app, BrowserWindow, ipcMain, screen, dialog, shell, Menu, safeStorage } = require('electron');
const path = require('path')
const fs = require('fs')
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
const http = require('http');
const { pathToFileURL } = require('url');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const axios = require('axios');
const { createDispatchGateway } = require('./dispatch/dispatch-gateway');
const { createOrderWriteGateway } = require('./order/order-write-gateway');
const { PRODUCTION_API_BASE_URL } = require('./api-runtime');

// MCP 服务器模块
let mcpServer = null;
const mcpModule = require('./mcp-server');
const {
  pushMcpPrintTaskToRenderer,
  acknowledgeMcpPrintTask,
  clearMcpPrintDeliveriesForWebContents
} = require('./mcp-print-push');
const {
  readOrCreateToken,
  getMcpCliBridgeTokenPath,
  readOrCreateMcpCliBridgeToken
} = require('./mcp-auth');
let mainWindowRef = null; // 保存 mainWindow 引用供 MCP 使用
/** Stdio MCP（mcp-server-cli.js）打印任务轮询定时器，需在 will-quit 中清理 */
let mcpCliPollingInterval = null;

// 注意：当前使用 HTTP API（一句话识别），不需要 WebSocket
// 如果需要实时流式识别，可以后续添加 WebSocket 支持

// 移除顶部的静态require，改为动态加载


const VUE3_DEVTOOLS_ID = 'ljjemllljcmogpfapbkkighbhhppjdbg';


const electron = require('electron');
const isDev = !electron.app.isPackaged; // 使用 app.isPackaged 来检测开发模式
let mainWindow;
let mcpSessionUser = null;
let dispatchGateway = null;
let orderWriteGateway = null;
const selectedFolderCapabilities = new Set();
const saveFileCapabilities = new Set();

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
    publishPrintJobStatus({
      jobId,
      label,
      state: 'failed',
      retryable: true,
      message: `${label}失败：${serializePrintError(error)}`,
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
    });
  }
  return dispatchGateway;
}

function getOrderWriteGateway() {
  if (!orderWriteGateway) {
    orderWriteGateway = createOrderWriteGateway({ axios, appLogger });
  }
  return orderWriteGateway;
}

function sanitizeMcpSessionUser(value) {
  if (!value || typeof value !== 'object') return null;
  const rawId = value.nxDiuDistributerId;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const distributorName =
    value.nxDistributerEntity &&
    typeof value.nxDistributerEntity.nxDistributerName === 'string'
      ? value.nxDistributerEntity.nxDistributerName.slice(0, 100)
      : '';
  return {
    nxDiuDistributerId: id,
    nxDistributerEntity: {
      nxDistributerName: distributorName
    }
  };
}

function getEmbeddedMcpTokenPath() {
  return path.join(app.getPath('userData'), 'mcp-auth-token');
}

function getEmbeddedMcpToken() {
  return readOrCreateToken(getEmbeddedMcpTokenPath());
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

const MCP_BACKEND_ROUTES = [
  {
    method: 'GET',
    pattern: /^nxdepartmentorders\/webNxDisGetTodayOrderCustomer\/\d+$/
  },
  {
    method: 'POST',
    pattern: /^nxdepartmentorders\/phoneGetToFillDepOrders$/
  }
];

async function callMcpBackendApi(apiPath, method = 'GET', data = null) {
  const normalizedMethod = String(method || 'GET').toUpperCase();
  const normalizedPath = String(apiPath || '');
  const allowed = MCP_BACKEND_ROUTES.some(
    (route) => route.method === normalizedMethod && route.pattern.test(normalizedPath)
  );
  if (!allowed) {
    throw new Error('MCP 后端接口不在白名单中');
  }

  const config = mcpModule.loadMcpConfig();
  const requestUrl = new URL(normalizedPath, config.backendUrl).toString();
  const cookieList =
    mainWindow && !mainWindow.isDestroyed()
      ? await mainWindow.webContents.session.cookies.get({ url: requestUrl })
      : [];
  const cookieHeader = cookieList
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  const headers = cookieHeader ? { Cookie: cookieHeader } : {};

  if (normalizedMethod === 'GET') {
    const response = await axios.get(requestUrl, {
      headers,
      timeout: 15000,
      maxRedirects: 0
    });
    return response.data;
  }

  const form = new URLSearchParams();
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const [key, value] of Object.entries(data)) {
      if (value == null) continue;
      form.append(key, String(value));
    }
  }
  const response = await axios.post(requestUrl, form.toString(), {
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    timeout: 15000,
    maxRedirects: 0
  });
  return response.data;
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

async function clearAutoLoginFromMenu() {
  try {
    const p = getRememberPrinterUserFlagPath();
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
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
  // 订单写请求由主进程发送，避免 Electron 渲染层的 file/localhost Origin 被服务端拒绝。
  // 这里只开放经过校验的“保存粘贴订单”，不提供任意 URL 或任意 HTTP 代理。
  ipcMain.handle('order-write-save-paste-orders', async (event, payload) => {
    assertTrustedRendererEvent(event);
    return getOrderWriteGateway().savePasteOrders(payload);
  });

  // 桌面调度：token 只存在主进程，渲染进程仅能调用以下白名单能力。
  ipcMain.handle('dispatch-auth-get-session', async (event) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().getSession();
  });
  ipcMain.handle('dispatch-auth-adopt-login-session', async (event, auth, options) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().adoptLoginSession(auth, options);
  });
  ipcMain.handle('dispatch-auth-begin-login', async (event, options) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().beginLogin(options);
  });
  ipcMain.handle('dispatch-auth-poll-login', async (event) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().pollLogin();
  });
  ipcMain.handle('dispatch-auth-cancel-login', async (event) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().cancelLogin();
  });
  ipcMain.handle('dispatch-auth-logout', async (event) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().logout();
  });
  ipcMain.handle('user-session-logout', async (event) => {
    assertTrustedRendererEvent(event);
    const cleanupWarnings = [];
    const rememberFlagPath = getRememberPrinterUserFlagPath();
    try {
      if (fs.existsSync(rememberFlagPath)) {
        fs.unlinkSync(rememberFlagPath);
      }
    } catch (error) {
      cleanupWarnings.push(error?.message || '自动登录标志清理失败');
      appLogger.append('warn', 'logout', 'remember-user-flag-clear-failed', {
        message: error?.message,
      });
    }
    mcpSessionUser = null;

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
  ipcMain.handle('dispatch-map-load-tile', async (event, tile) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadMapTile(tile);
  });
  ipcMain.handle('dispatch-map-load-config', async (event) => {
    assertTrustedRendererEvent(event);
    return getDispatchGateway().loadMapConfig();
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

  ipcMain.on('mcp-session-user', (event, user) => {
    assertTrustedRendererEvent(event);
    mcpSessionUser = sanitizeMcpSessionUser(user);
  });
  
  // 获取 MCP 服务器状态
  ipcMain.handle('get-mcp-status', async (event) => {
    assertTrustedRendererEvent(event);
    const config = mcpModule.loadMcpConfig();
    return {
      running: mcpServer !== null,
      port: config.port,
      host: config.host,
      authRequired: true,
      tokenFile: getEmbeddedMcpTokenPath()
    };
  });
  
  // 更新 MCP 配置
  ipcMain.handle('update-mcp-config', async (event, config) => {
    assertTrustedRendererEvent(event);
    const normalized = mcpModule.saveMcpConfig(config);
    return {
      success: true,
      config: normalized,
      restartRequired: true
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
  ipcMain.on('remember-printer-user-set-sync', (event, enabled) => {
    try {
      assertTrustedRendererEvent(event);
      const p = getRememberPrinterUserFlagPath();
      if (enabled) {
        fs.writeFileSync(p, '1', 'utf8');
      } else if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    } catch (e) {
      console.error('[remember-printer-user-set-sync]', e);
    }
  });

  /** 异步写入 userData 标志，不阻塞渲染进程（勾选「记住用户」须用此通道，勿用 sendSync） */
  ipcMain.on('remember-printer-user-set-async', (event, enabled) => {
    try {
      assertTrustedRendererEvent(event);
      const p = getRememberPrinterUserFlagPath();
      if (enabled) {
        fs.writeFileSync(p, '1', 'utf8');
      } else if (fs.existsSync(p)) {
        fs.unlinkSync(p);
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
  mainWindow.on('closed', () => {
    clearMcpPrintDeliveriesForWebContents(mainWindowWebContentsId);
    mainWindow = null;
    mainWindowRef = null;
    mcpSessionUser = null;
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
function printContentToWindowWithCallback(printContent, depFatherId, depId, tradeNo, userId, paperCount, shouldSave = true, isHistoryOrder = false, orderIds) {
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
        const printOptions = createSilentPrintOptions(finalPrinterName);
        
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
        
        printWindow.webContents.print(printOptions, (success, error) => {
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
            
            // 历史订单打印：跳过保存接口和刷新客户列表
            if (isHistoryOrder) {
              console.log('⏭️ [IPC回执] 历史订单打印，跳过保存接口');
            } else if (shouldSave) {
              console.log('💾 [IPC回执] 需要保存打印记录，paperCount:', paperCount);
              if (mainWindow) {
                console.log('💾 [IPC回执] 发送设备配置检查请求到渲染进程');
                mainWindow.webContents.send('check-device-config-for-print', {
                  depFatherId, depId, tradeNo, userId, paperCount, orderIds
                });
              } else {
                console.log('💾 [IPC回执] 主窗口不存在，直接调用保存接口');
                savePrintBill(depFatherId, depId, tradeNo, userId, paperCount, orderIds);
              }
            } else {
              console.log('⏭️ [IPC回执] 跳过保存，非最后一页');
            }
            
            resolve({ success: true, tradeNo });
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

function savePrintBill(depFatherId, depId, tradeNo, userId, paperCount, orderIds) {
  console.log('💾 [savePrintBill] 开始保存订单:', {
    depFatherId, depId, tradeNo, userId, paperCount
  });

  const apiUrl = `${PRODUCTION_API_BASE_URL}nxdepartmentbill/saveAccountBillPrinter/`;

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

  axios.post(apiUrl, postData, {
    headers: {
      // 'Content-Type': 'application/json',  // 正确设置请求头
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
  .then(response => {
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
  })
  .catch(error => {
    console.error('❌ [savePrintBill] 保存失败:', error.message);
    console.error('❌ [savePrintBill] 错误详情:', error.response?.data);
    console.error('❌ [savePrintBill] 状态码:', error.response?.status);
    console.error('❌ [savePrintBill] 完整错误:', error);
  });
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
  
  const apiUrl = `${PRODUCTION_API_BASE_URL}machine/print/record`;

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
ipcMain.on('device-config-response-for-merge', (event, deviceConfig, printParams) => {
  assertTrustedRendererEvent(event);
  assertDeviceConfigResponse(deviceConfig, printParams);
  console.log('📱 收到设备配置 (合并接口):', deviceConfig);
  console.log('📋 收到printParams (合并接口):', printParams);
  
  const apiUrl = `${PRODUCTION_API_BASE_URL}nxdepartmentbill/saveAccountBillPrinterSelf`;

  // 构建合并接口的请求数据
  const mergeData = {
    depFatherId: parseInt(printParams.depFatherId || 0),
    depId: parseInt(printParams.depId || 0),
    tradeNo: printParams.tradeNo || '',
    userId: parseInt(printParams.userId || 0),
    deviceId: parseInt(deviceConfig?.selectedDevice?.nxPdId || 0),
    pricePerSheet: '0.00', // 默认价格，可以根据需要调整
    marketId: parseInt(deviceConfig?.deviceAdminInfo?.marketId || 0),
    paperCount: Math.max(1, parseInt(printParams.paperCount || 1)),
    orderIds: Array.isArray(printParams.orderIds) && printParams.orderIds.length
      ? printParams.orderIds.join(',')
      : undefined
  };

  console.log('📤 发送合并接口数据:', mergeData);

  // 使用 form 格式发送请求
  const formData = new URLSearchParams();
  Object.keys(mergeData).forEach(key => {
    const value = mergeData[key];
    if (value !== null && value !== undefined && value !== '') {
      formData.append(key, value.toString());
    }
  });

  axios.post(apiUrl, formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })
  .then(response => {
    console.log('✅ 合并接口调用成功:', response.data);
    
    if (mainWindow) {      
      mainWindow.webContents.send('refresh-customer-list');
    }
  })
  .catch(error => {
    console.error('❌ 合并接口调用失败:', error.message);
    console.error('❌ 错误详情:', error.response?.data);
    console.error('❌ 状态码:', error.response?.status);
  });
});

// 监听设备配置检查结果 - 决定使用哪个保存接口
ipcMain.on('device-config-check-result', (event, hasDeviceConfig, printParams) => {
  assertTrustedRendererEvent(event);
  if (typeof hasDeviceConfig !== 'boolean') {
    throw new TypeError('hasDeviceConfig 必须是布尔值');
  }
  assertPrintMetadata(printParams);
  console.log('📋 [主进程] 收到设备配置检查结果:', hasDeviceConfig);
  console.log('📋 [主进程] 打印参数:', JSON.stringify(printParams, null, 2));
  
  if (hasDeviceConfig) {
    console.log('✅ [主进程] 有设备配置，使用新接口 saveAccountBillPrinterSelf');
    // 使用新接口 - 先请求设备配置，然后调用合并接口
    if (mainWindow) {
      console.log('📤 [主进程] 发送设备配置合并请求到渲染进程');
      mainWindow.webContents.send('get-device-config-for-merge', printParams);
    } else {
      console.error('❌ [主进程] 主窗口不存在，无法调用新接口');
    }
  } else {
    console.log('⚠️ [主进程] 没有设备配置，使用老接口 savePrintBill');
    console.log('📞 [主进程] 开始调用 savePrintBill:', {
      depFatherId: printParams.depFatherId,
      depId: printParams.depId,
      tradeNo: printParams.tradeNo,
      userId: printParams.userId,
      paperCount: printParams.paperCount
    });
    // 使用老接口
    savePrintBill(
      printParams.depFatherId, 
      printParams.depId, 
      printParams.tradeNo, 
      printParams.userId, 
      printParams.paperCount,
      printParams.orderIds
    );
  }
});

function savePrintBillGb(gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount) {
  console.log('GB订单保存:', gbDepFatherId, gbDepId, tradeNo, userId, nxDisId);

  const apiUrl = `${PRODUCTION_API_BASE_URL}nxdepartmentbill/saveAccountBillPrinterGb/`;

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

  const apiUrl = `${PRODUCTION_API_BASE_URL}gbdistributerpurchasebatch/nxDisPrintGbPurBatch/`;
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


// 设置应用名称为"粒子"
app.setName('粒子');

app.whenReady().then(async () => {
  // 日志目录、会话头、主进程异常、渲染进程 app-log IPC
  appLogger.init(ipcMain, shell, assertTrustedRendererEvent);
  // 创建中文菜单
  createMenu();
  // IPC handlers 只注册一次，避免 createWindow 多次调用时重复注册报错
  setupIpcHandlers();
  
  createWindow();
  
  // 启动 MCP HTTP 服务器
  try {
    const mcpConfig = mcpModule.loadMcpConfig();
    const mcpAuthToken = getEmbeddedMcpToken();
    mcpServer = await mcpModule.createMcpServer(mcpConfig.port, mcpConfig.host, {
      authToken: mcpAuthToken,
      backendUrl: mcpConfig.backendUrl,
      getDisUser: async () => mcpSessionUser,
      callBackendApi: callMcpBackendApi,
      sendPrintTask: (task) => {
        const target =
          mainWindow && !mainWindow.isDestroyed()
            ? mainWindow
            : BrowserWindow.getAllWindows()[0];
        if (!target || target.isDestroyed()) {
          return { ok: false, error: '无法找到应用窗口，请确保应用正在运行' };
        }
        return pushMcpPrintTaskToRenderer(target.webContents, task)
          ? { ok: true }
          : { ok: false, error: '打印任务投递失败' };
      }
    });
    console.log(`[MCP] 服务器已启动，监听 http://${mcpConfig.host}:${mcpConfig.port}`);
    console.log('[MCP] 鉴权令牌文件:', getEmbeddedMcpTokenPath());
  } catch (error) {
    console.error('[MCP] 启动失败:', error);
  }

  // 轮询 Stdio MCP（mcp-server-cli.js）的 HTTP 队列，端口 3002；用 127.0.0.1 避免与 localhost → IPv6 绑定不一致
  const MCP_CLI_PRINT_TASKS_URL = 'http://127.0.0.1:3002/print-tasks';
  const mcpCliBridgeToken = readOrCreateMcpCliBridgeToken();
  console.log('[MCP] Stdio 打印桥鉴权令牌文件:', getMcpCliBridgeTokenPath());
  let mcpCliPollConnectWarned = false;

  function pollMcpCliPrintTasks() {
    const target =
      mainWindow && !mainWindow.isDestroyed()
        ? mainWindow
        : BrowserWindow.getAllWindows()[0];
    if (!target || target.isDestroyed()) {
      return;
    }
    const req = http.get(
      MCP_CLI_PRINT_TASKS_URL,
      {
        headers: {
          Authorization: `Bearer ${mcpCliBridgeToken}`
        }
      },
      (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return;
        }
        mcpCliPollConnectWarned = false;
        try {
          const parsed = JSON.parse(data);
          const tasks = parsed.tasks;
          if (!Array.isArray(tasks) || tasks.length === 0) {
            return;
          }
          console.log(
            '[MCP] 收到来自 CodeBuddy 的打印任务:',
            tasks.length,
            tasks.map((t) => ({
              taskId: t.taskId,
              departmentId: t.departmentId,
              name: t.departmentName
            }))
          );
          tasks.forEach((task) => {
            const wc = target.webContents;
            const payload = JSON.stringify(task);
            console.log('[MCP] ── 即将 IPC mcp-print-trigger 到渲染进程 ──');
            console.log('[MCP] webContents.id=', wc.id, 'url=', wc.getURL());
            console.log('[MCP] 任务 JSON:', payload);
            console.log('[MCP] 使用 IPC + ack 投递；终端中应出现 [MCP] App 收到(ipc)。');
            pushMcpPrintTaskToRenderer(wc, task);
            console.log(
              '[MCP] 已派发任务（含后援）',
              task.taskId,
              task.departmentName,
              'depId=',
              task.departmentId,
              'type=',
              task.type
            );
          });
        } catch (e) {
          console.warn('[MCP] CLI 轮询响应解析失败:', e.message);
        }
      });
      }
    );
    req.on('error', (err) => {
      if (!mcpCliPollConnectWarned) {
        console.warn(
          '[MCP] 无法连接 127.0.0.1:3002（请确认 Cursor/WorkBuddy 已启动 grain-print MCP: mcp-server-cli.js）',
          err.code || err.message
        );
        mcpCliPollConnectWarned = true;
      }
    });
    req.setTimeout(1500, () => req.destroy());
  }

  pollMcpCliPrintTasks();
  mcpCliPollingInterval = setInterval(pollMcpCliPrintTasks, 2000);

  // 对于 macOS，当所有窗口关闭时重新激活应用的处理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();

  });
});

// 应用退出时关闭 MCP 服务器
app.on('will-quit', () => {
  if (dispatchGateway) {
    dispatchGateway.dispose();
    dispatchGateway = null;
  }
  if (mcpCliPollingInterval) {
    clearInterval(mcpCliPollingInterval);
    console.log('[MCP] 轮询已停止');
  }
  if (mcpServer) {
    mcpServer.close();
    console.log('[MCP] 服务器已关闭');
  }
});

app.on('window-all-closed', () => {
  // 对于 Windows 和 Linux，在所有窗口关闭后退出应用
  if (process.platform !== 'darwin') app.quit();
});
