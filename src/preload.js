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
let mcpBridgeStatusCleanup = null;

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
  previewReturnDocument: (htmlContent) => ipcRenderer.invoke('preview-return-document', htmlContent),
  printReturnDocument: (htmlContent) => ipcRenderer.invoke('print-return-document', htmlContent),
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
  // 拣货单（A4）打印：独立打印机配置 + A4 打印通道
  getPickListPrintConfig: () => ipcRenderer.invoke('get-pick-list-print-config'),
  savePickListPrintConfig: (config) =>
    ipcRenderer.invoke('save-pick-list-print-config', config),
  printPickListA4: (htmlContent) => ipcRenderer.invoke('print-pick-list-a4', htmlContent),
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

  // 应用启动偏好：主进程负责读写 macOS / Windows 系统登录项。
  appPreferences: Object.freeze({
    getLaunchAtLogin: () => ipcRenderer.invoke('app-launch-at-login-get'),
    setLaunchAtLogin: (enabled) =>
      ipcRenderer.invoke('app-launch-at-login-set', Boolean(enabled)),
  }),

  // 微信订单定时读取：配置与客户排除项均由主进程持久化和调度。
  wechatAutoRead: Object.freeze({
    getConfig: () => ipcRenderer.invoke('wechat-auto-read-config-get'),
    setConfig: (config) => ipcRenderer.invoke('wechat-auto-read-config-set', {
      enabled: config?.enabled === true,
      times: (Array.isArray(config?.times) ? Array.from(config.times) : [])
        .map(time => String(time)),
    }),
    getCustomerParticipation: (distributerId, customerId) =>
      ipcRenderer.invoke('wechat-auto-read-customer-get', { distributerId, customerId }),
    setCustomerParticipation: (distributerId, customerId, participates) =>
      ipcRenderer.invoke('wechat-auto-read-customer-set', {
        distributerId,
        customerId,
        participates: participates === true,
      }),
    onTrigger: (callback) => listen('wechat-auto-read-trigger', callback),
    finish: (runId) => ipcRenderer.invoke('wechat-auto-read-finish', runId),
  }),

  // 客户历史订单由主进程携带安全会话查询，令牌不进入页面。
  customerHistory: Object.freeze({
    loadMonths: (departmentId) =>
      ipcRenderer.invoke('customer-history-load-months', { departmentId }),
  }),

  // 商业套餐只取当前生效套餐编码，用于按套餐开放桌面端功能入口。
  commercialEntitlement: Object.freeze({
    load: () => ipcRenderer.invoke('commercial-entitlement-load'),
  }),

  // 客户OCR预训练通过主进程安全会话访问；页面不能提交配送商或操作人身份。
  customerOcrTraining: Object.freeze({
    list: (customerId) => ipcRenderer.invoke('customer-ocr-training-list', { customerId }),
    detail: (scene, taskId) => ipcRenderer.invoke('customer-ocr-training-detail', { scene, taskId }),
    create: (payload) => ipcRenderer.invoke('customer-ocr-training-create', payload),
    updateItem: (taskId, itemId, payload) =>
      ipcRenderer.invoke('customer-ocr-training-update-item', { taskId, itemId, payload }),
    deleteItem: (taskId, itemId) =>
      ipcRenderer.invoke('customer-ocr-training-delete-item', { taskId, itemId }),
    deleteTask: (taskId) => ipcRenderer.invoke('customer-ocr-training-delete', { taskId }),
    complete: (taskId) => ipcRenderer.invoke('customer-ocr-training-complete', { taskId }),
  }),

  // 客户微信好友绑定及消息去重登记通过主进程安全会话访问。
  customerWechatOrders: Object.freeze({
    loadBinding: (customerId) => ipcRenderer.invoke('customer-wechat-binding-load', { customerId }),
    saveBinding: (payload) => ipcRenderer.invoke('customer-wechat-binding-save', payload),
    clearBinding: (customerId) => ipcRenderer.invoke('customer-wechat-binding-clear', { customerId }),
    commitReliableScan: (payload) =>
      ipcRenderer.invoke('customer-wechat-scan-v2-commit', payload),
    claimTask: (payload) => ipcRenderer.invoke('customer-wechat-task-v2-claim', payload),
    loadPendingTasks: (payload = {}) =>
      ipcRenderer.invoke('customer-wechat-task-v2-pending', payload),
    discardTasks: (payload) =>
      ipcRenderer.invoke('customer-wechat-task-v2-discard', payload),
    loadPendingMessages: (payload) =>
      ipcRenderer.invoke('customer-wechat-messages-v2-pending', payload),
    updateDraft: (payload) => ipcRenderer.invoke('customer-wechat-task-v2-draft', payload),
    reportAttachment: (payload) =>
      ipcRenderer.invoke('customer-wechat-attachment-v2-report', payload),
    acknowledgeMixedImage: (payload) =>
      ipcRenderer.invoke('customer-wechat-mixed-image-v2-ack', payload),
  }),

  // Reader 只返回不可逆 ID 和业务 DTO；绝不暴露启动命令、路径、stdio 或 access material。
  wechatReader: Object.freeze({
    diagnose: () => ipcRenderer.invoke('wechat-reader-diagnose'),
    listAccounts: () => ipcRenderer.invoke('wechat-reader-list-accounts'),
    warmUp: () => ipcRenderer.invoke('wechat-reader-warm-up'),
    findConversation: (accountId, name) =>
      ipcRenderer.invoke('wechat-reader-find-conversation', { accountId, name }),
    getParticipants: (conversationId) =>
      ipcRenderer.invoke('wechat-reader-get-participants', { conversationId }),
    getSelfParticipant: (conversationId) =>
      ipcRenderer.invoke('wechat-reader-get-self-participant', { conversationId }),
    getMessages: (conversationId, timeRange, page) =>
      ipcRenderer.invoke('wechat-reader-get-messages', { conversationId, timeRange, page }),
    getAttachment: (attachmentId, locator = null) =>
      ipcRenderer.invoke('wechat-reader-get-attachment', { attachmentId, locator }),
    lastColdStart: () =>
      ipcRenderer.invoke('wechat-reader-last-cold-start'),
  }),

  // 只允许扫描渲染层提交的已绑定会话标题；主进程负责启动、超时和退出回收。
  wechatUi: Object.freeze({
    inspectUnread: (allowedTitles) =>
      ipcRenderer.invoke('wechat-ui-inspect-unread', { allowedTitles }),
    readUnread: (allowedTitles) =>
      ipcRenderer.invoke('wechat-ui-read-unread', { allowedTitles }),
    currentConversation: (options = {}) =>
      ipcRenderer.invoke('wechat-ui-current-conversation', {
        requireForeground: options?.requireForeground === true,
        includeAvatar: options?.includeAvatar !== false,
      }),
    focusConversation: (title, options = {}) =>
      ipcRenderer.invoke('wechat-ui-focus-conversation', {
        title,
        forceReselect: options?.forceReselect === true,
      }),
    openWorkspace: () => ipcRenderer.invoke('wechat-ui-workspace-open'),
    focusWorkspace: () => ipcRenderer.invoke('wechat-ui-workspace-focus'),
    closeWorkspace: () => ipcRenderer.invoke('wechat-ui-workspace-close'),
    onWorkspaceCloseRequested: (callback) =>
      listen('wechat-ui-workspace-close-requested', callback),
    onConversationChanged: (callback) =>
      listen('wechat-ui-conversation-changed', callback),
  }),

  // 正式包只暴露扫码轮询及两个固定订单读取动作；会话 Cookie 留在主进程。
  orderSession: Object.freeze({
    testLogin: (userId) => ipcRenderer.invoke('order-session-test-login', userId),
    pollLogin: (sessionId) => ipcRenderer.invoke('order-session-poll-login', sessionId),
    todayCustomers: (disId) => ipcRenderer.invoke('order-session-today-customers', disId),
    orderWorkbenchOverview: (disId) => ipcRenderer.invoke('order-session-workbench-overview', disId),
    ocrTaskStatus: (taskId) => ipcRenderer.invoke('order-session-ocr-task-status', taskId),
    phoneOrders: (input) => ipcRenderer.invoke('order-session-phone-orders', input),
    pickListCategories: (input) => ipcRenderer.invoke('order-session-pick-list-categories', input),
    pickListCategoryGoods: (input) =>
      ipcRenderer.invoke('order-session-pick-list-category-goods', input),
    pickListShelves: (input) => ipcRenderer.invoke('order-session-pick-list-shelves', input),
    pickListShelfGoods: (input) => ipcRenderer.invoke('order-session-pick-list-shelf-goods', input),
    pickListFinishOrder: (input) =>
      ipcRenderer.invoke('order-session-pick-list-finish-order', input),
    recognizeOrderQwen: (input) => ipcRenderer.invoke('order-session-recognize-qwen', input),
    recognizeOrderAsync: (input) => ipcRenderer.invoke('order-session-recognize-async', input),
    refreshSession: () => ipcRenderer.invoke('order-session-refresh'),
    issueRememberToken: () => ipcRenderer.invoke('order-session-issue-token'),
    logout: (options) => ipcRenderer.invoke('order-session-logout', options),
  }),

  // 销售分析只开放固定只读查询，配送商身份由主进程安全会话提供。
  salesAnalysis: Object.freeze({
    loadOverview: (range) => ipcRenderer.invoke('sales-analysis-load-overview', range),
    loadCategory: (categoryId, range) =>
      ipcRenderer.invoke('sales-analysis-load-category', { categoryId, range }),
    loadProductCustomers: (goodsId, range, limit) =>
      ipcRenderer.invoke('sales-analysis-load-product-customers', { goodsId, range, limit }),
    loadCategoryCustomers: (categoryId, range, page, pageSize) =>
      ipcRenderer.invoke('sales-analysis-load-category-customers', {
        categoryId, range, page, pageSize,
      }),
    loadCategoryCustomerProducts: (categoryId, customerId, range, page, pageSize) =>
      ipcRenderer.invoke('sales-analysis-load-category-customer-products', {
        categoryId, customerId, range, page, pageSize,
      }),
  }),

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
  }),

  // 连接器凭证：渲染进程只收到必要结果（列表不含明文）；token 不跨 preload。
  connectorCredential: Object.freeze({
    issue: (input) => ipcRenderer.invoke('connector-credential-issue', input),
    list: () => ipcRenderer.invoke('connector-credential-list'),
    revokeAll: () => ipcRenderer.invoke('connector-credential-revoke-all'),
  }),

  // 用户退出：由主进程清除安全会话、Cookie、网络缓存；「记住用户」偏好保留。
  userSession: Object.freeze({
    logout: (options) => ipcRenderer.invoke('user-session-logout', options),
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
    releaseRoutePreview: (command) => ipcRenderer.invoke('dispatch-release-route-preview', command),
    confirmDispatch: (command) => ipcRenderer.invoke('dispatch-confirm-route', command),
    lockPlanningStop: (command) => ipcRenderer.invoke('dispatch-lock-planning-stop', command),
    unlockPlanningStop: (command) => ipcRenderer.invoke('dispatch-unlock-planning-stop', command),
    updateDriverEmployment: (command) => ipcRenderer.invoke('dispatch-update-driver-employment', command),
    checkInDriver: (command) => ipcRenderer.invoke('dispatch-driver-duty-on', command),
    checkOutDriver: (command) => ipcRenderer.invoke('dispatch-driver-duty-off', command),
    updateStopTimeWindow: (command) => ipcRenderer.invoke('dispatch-update-stop-time-window', command),
    returnStopToSandbox: (command) => ipcRenderer.invoke('dispatch-return-stop-to-sandbox', command),
    loadManualDispatchPanorama: (command) =>
      ipcRenderer.invoke('dispatch-load-manual-driver-panorama', command),
    departDriver: (command) => ipcRenderer.invoke('dispatch-depart-driver', command),
    completeDeliveryStop: (command) => ipcRenderer.invoke('dispatch-complete-delivery-stop', command),
    returnDeliveryStopToSandbox: (command) =>
      ipcRenderer.invoke('dispatch-return-delivery-stop-to-sandbox', command),
    previewRouteReassignment: (command) =>
      ipcRenderer.invoke('dispatch-preview-route-reassignment', command),
    confirmRouteReassignment: (command) =>
      ipcRenderer.invoke('dispatch-confirm-route-reassignment', command),
  }),

  // Huawei JS SDK 按产品要求在客户端使用项目 API Key；Key 不固化在桌面包源码中。
  dispatchMap: Object.freeze({
    loadConfig: () => ipcRenderer.invoke('dispatch-map-load-config'),
    loadTile: (tile) => ipcRenderer.invoke('dispatch-map-load-tile', tile),
  }),

  // MCP 仅暴露 3011 连接器状态和打印任务监听。
  getMcpStatus: () => ipcRenderer.invoke('get-mcp-status'),
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
  },

  // 桥连接状态（GrainPrint 是否登录 / 微信是否打开/登录）：主进程每轮询周期推送，
  // 渲染端据此在顶部显示红条提示，避免审核/使用时因环境缺项而静默失败。
  onMcpBridgeStatus: (callback) => {
    if (mcpBridgeStatusCleanup) mcpBridgeStatusCleanup();
    mcpBridgeStatusCleanup = listen('mcp-bridge-status', (status) => callback(status));
    return () => {
      if (mcpBridgeStatusCleanup) {
        mcpBridgeStatusCleanup();
        mcpBridgeStatusCleanup = null;
      }
    };
  },

  // R2 打印结果回传：OrderPrint 组件实际出纸（或失败/超时）后，由 Bills 经此 IPC 通知主进程，
  // 主进程再上报 3011 桥。仅透传「真实出纸结果」；受理(accept)≠完成。
  reportPrintResult: (taskId, success, message) =>
    ipcRenderer.send('mcp-print-result', { taskId, success: !!success, message: message || '' }),
});

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
