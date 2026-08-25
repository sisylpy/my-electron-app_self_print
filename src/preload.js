// preload.js
const { contextBridge, ipcRenderer } = require('electron');

/**
 * 只允许下方显式登记的业务方法跨越 contextBridge。
 * 不向渲染进程暴露 ipcRenderer、invoke(channel, ...) 或 send(channel, ...)。
 */
function listen(channel, callback) {
  if (typeof callback !== 'function') {
    throw new TypeError(`${channel} listener must be a function`);
  }
  const listener = (_event, ...args) => callback(...args);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

let mcpPrintTriggerCleanup = null;

const electronAPI = Object.freeze({
  // 打印：保留现有方法名、参数顺序和返回语义，避免影响现场打印。
  sendPrintRequest: (printData, depFatherId, depId, tradeNo, userId, paperCount) =>
    ipcRenderer.send('print-request', printData, depFatherId, depId, tradeNo, userId, paperCount),
  sendPrintRequestGb: (printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount) =>
    ipcRenderer.send('print-request-gb', printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount),
  sendPrintRequestGbBatch: (printData, gbBatchId, paperCount) =>
    ipcRenderer.send('print-request-gb-batch', printData, gbBatchId, paperCount),
  sendPrintRequestWithCallback: (printData, depFatherId, depId, tradeNo, userId, paperCount, shouldSave, isHistoryOrder, orderIds) =>
    ipcRenderer.invoke(
      'print-request-with-callback',
      printData,
      depFatherId,
      depId,
      tradeNo,
      userId,
      paperCount,
      shouldSave,
      isHistoryOrder,
      orderIds
    ),
  sendPrintRequestGbWithCallback: (
    printData,
    gbDepFatherId,
    gbDepId,
    tradeNo,
    userId,
    nxDisId,
    paperCount,
    shouldSave
  ) =>
    ipcRenderer.invoke(
      'print-request-gb-with-callback',
      printData,
      gbDepFatherId,
      gbDepId,
      tradeNo,
      userId,
      nxDisId,
      paperCount,
      shouldSave
    ),
  sendPrintRequestGbBatchWithCallback: (printData, gbBatchId, paperCount, shouldSave) =>
    ipcRenderer.invoke('print-request-gb-batch-with-callback', printData, gbBatchId, paperCount, shouldSave),
  sendPrintCalibrationPage: (htmlContent) => ipcRenderer.invoke('print-calibration-page', htmlContent),
  triggerEnterKey: () => ipcRenderer.send('trigger-enter-key'),

  // 打印设备配置。
  onGetDeviceConfig: (callback) => listen('get-device-config', callback),
  sendDeviceConfig: (deviceConfig, printParams) =>
    ipcRenderer.send('device-config-response', deviceConfig, printParams),
  onCheckDeviceConfigForPrint: (callback) => listen('check-device-config-for-print', callback),
  sendDeviceConfigCheckResult: (hasDeviceConfig, printParams) =>
    ipcRenderer.send('device-config-check-result', hasDeviceConfig, printParams),
  onGetDeviceConfigForMerge: (callback) => listen('get-device-config-for-merge', callback),
  sendDeviceConfigForMerge: (deviceConfig, printParams) =>
    ipcRenderer.send('device-config-response-for-merge', deviceConfig, printParams),
  onRefreshCustomerList: (callback) => listen('refresh-customer-list', callback),

  getOSInfo: () => ipcRenderer.invoke('get-os-info'),
  getSystemPrinters: () => ipcRenderer.invoke('get-system-printers'),
  saveDefaultPrinter: (printerName, displayName) =>
    ipcRenderer.invoke('save-default-printer', printerName, displayName),
  getDefaultPrinter: () => ipcRenderer.invoke('get-default-printer'),
  savePrinterProfile: (deviceName, profile) =>
    ipcRenderer.invoke('save-printer-profile', deviceName, profile),
  loadPrinterProfile: (deviceName) => ipcRenderer.invoke('load-printer-profile', deviceName),
  loadAllPrinterProfiles: () => ipcRenderer.invoke('load-all-printer-profiles'),
  getPrinterSystemConfig: () => ipcRenderer.invoke('get-printer-system-config'),
  setPrinterResolution: (hDpi, vDpi) =>
    ipcRenderer.invoke('set-printer-resolution', hDpi, vDpi),
  onPrintJobStatus: (callback) => listen('print-job-status', callback),

  // 文件能力仍按现有业务用例逐项登记；主进程负责来源、参数和路径校验。
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveCustomerFolderPath: (customerId, folderPath) =>
    ipcRenderer.invoke('save-customer-folder-path', customerId, folderPath),
  getCustomerFolderPath: (customerId) =>
    ipcRenderer.invoke('get-customer-folder-path', customerId),
  scanFolderFiles: (folderPath, includeProcessed) =>
    ipcRenderer.invoke('scan-folder-files', folderPath, includeProcessed),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  moveFileToProcessed: (filePath, targetFolder) =>
    ipcRenderer.invoke('move-file-to-processed', filePath, targetFolder),
  moveProcessedToCompleted: (targetFolder) =>
    ipcRenderer.invoke('move-processed-to-completed', targetFolder),
  moveProcessedToParent: (targetFolder) =>
    ipcRenderer.invoke('move-processed-to-parent', targetFolder),
  openFile: (filePath, customerFolderPath) =>
    ipcRenderer.invoke('open-file', filePath, customerFolderPath),
  openFolder: (filePath) => ipcRenderer.invoke('open-folder', filePath),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  saveBufferToFile: (buffer, filePath) =>
    ipcRenderer.invoke('save-buffer-to-file', buffer, filePath),

  // 语音接口保留契约；主进程不再读取客户端长期云密钥。
  startVoiceRecognition: () => ipcRenderer.invoke('start-voice-recognition'),
  stopVoiceRecognition: () => ipcRenderer.invoke('stop-voice-recognition'),
  sendAudioData: (audioData) => ipcRenderer.invoke('send-audio-data', audioData),
  onVoiceRecognitionResult: (callback) => listen('voice-recognition-result', callback),
  onVoiceRecognitionError: (callback) => listen('voice-recognition-error', callback),
  textToSpeech: (text, sessionId) => ipcRenderer.invoke('text-to-speech', text, sessionId),
  onTTSResult: (callback) => listen('tts-result', callback),
  onTTSError: (callback) => listen('tts-error', callback),

  writeAppLog: (level, tag, message, meta) =>
    ipcRenderer.send('app-log', { level, tag, message, meta }),
  getAppLogDirectory: () => ipcRenderer.invoke('app-log-dir'),
  openAppLogDirectory: () => ipcRenderer.invoke('open-app-log-dir'),
  rendererConsoleLog: (line) =>
    ipcRenderer.send('renderer-console-log', typeof line === 'string' ? line : String(line)),

  getRememberPrinterUserSync: () => {
    try {
      return ipcRenderer.sendSync('remember-printer-user-get-sync') === '1';
    } catch {
      return false;
    }
  },
  setRememberPrinterUserSync: (enabled) => {
    try {
      ipcRenderer.sendSync('remember-printer-user-set-sync', Boolean(enabled));
    } catch {
      // 保持原同步接口兼容；异步接口是首选。
    }
  },
  rememberPrinterUserSetAsync: (enabled) =>
    ipcRenderer.send('remember-printer-user-set-async', Boolean(enabled)),
  onClearRememberPrinterUser: (callback) =>
    listen('clear-remember-printer-user', callback),

  // 订单写入只暴露逐项白名单，不向页面提供任意网络请求能力。
  orderWrite: Object.freeze({
    savePasteOrders: (payload) =>
      ipcRenderer.invoke('order-write-save-paste-orders', payload),
  }),

  // 桌面调度身份：accessToken 永不跨越 preload，渲染进程只接收会话摘要。
  dispatchAuth: Object.freeze({
    getSession: () => ipcRenderer.invoke('dispatch-auth-get-session'),
    adoptLoginSession: (auth, options) =>
      ipcRenderer.invoke('dispatch-auth-adopt-login-session', auth, options),
    beginLogin: (options) => ipcRenderer.invoke('dispatch-auth-begin-login', options),
    pollLogin: () => ipcRenderer.invoke('dispatch-auth-poll-login'),
    cancelLogin: () => ipcRenderer.invoke('dispatch-auth-cancel-login'),
    logout: () => ipcRenderer.invoke('dispatch-auth-logout'),
  }),

  // 用户退出：由主进程清除安全会话、Cookie、网络缓存和自动登录标志。
  userSession: Object.freeze({
    logout: () => ipcRenderer.invoke('user-session-logout'),
    testLogin: (userId) => ipcRenderer.invoke('user-session-test-login', userId),
  }),

  // 桌面调度命令：仅暴露经过主进程校验的白名单操作。
  dispatchCommands: Object.freeze({
    getCapabilities: () => ipcRenderer.invoke('dispatch-get-capabilities'),
    createIdempotencyKey: () => ipcRenderer.invoke('dispatch-create-idempotency-key'),
    assignDriver: (command) => ipcRenderer.invoke('dispatch-confirm-stop', command),
    loadRouteEditPage: (command) => ipcRenderer.invoke('dispatch-load-route-edit-page', command),
    previewRoute: (command) => ipcRenderer.invoke('dispatch-preview-route', command),
    previewRouteExpansion: (command) => ipcRenderer.invoke('dispatch-preview-route-expansion', command),
    confirmDispatch: (command) => ipcRenderer.invoke('dispatch-confirm-route', command),
    lockPlanningStop: (command) => ipcRenderer.invoke('dispatch-lock-planning-stop', command),
    unlockPlanningStop: (command) => ipcRenderer.invoke('dispatch-unlock-planning-stop', command),
    updateDriverEmployment: (command) => ipcRenderer.invoke('dispatch-update-driver-employment', command),
  }),

  // Huawei JS SDK 按产品要求在客户端使用项目 API Key；Key 不固化在桌面包源码中。
  dispatchMap: Object.freeze({
    loadConfig: () => ipcRenderer.invoke('dispatch-map-load-config'),
    loadTile: (tile) => ipcRenderer.invoke('dispatch-map-load-tile', tile),
  }),

  // MCP 仅暴露状态、受限配置、内存会话摘要和打印任务监听。
  getMcpStatus: () => ipcRenderer.invoke('get-mcp-status'),
  updateMcpConfig: (config) => ipcRenderer.invoke('update-mcp-config', config),
  setMcpSessionUser: (user) => ipcRenderer.send('mcp-session-user', user),
  onMcpPrintTrigger: (callback) => {
    if (mcpPrintTriggerCleanup) {
      mcpPrintTriggerCleanup();
    }
    mcpPrintTriggerCleanup = listen('mcp-print-trigger', (task) => {
      callback(task);
      if (task && task.taskId != null) {
        ipcRenderer.send('mcp-print-ack', task.taskId);
      }
    });
    return () => {
      if (mcpPrintTriggerCleanup) {
        mcpPrintTriggerCleanup();
        mcpPrintTriggerCleanup = null;
      }
    };
  }
});

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
