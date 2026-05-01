// preload.js
console.log('Preload script loaded----src');

const { contextBridge, ipcRenderer } = require('electron');

// 动态加载 axios（在 preload 脚本中）
let axios = null;
try {
  axios = require('axios');
} catch (e) {
  console.log('[preload] axios 加载失败:', e.message);
}

let mcpPrintTriggerListener = null;

contextBridge.exposeInMainWorld('electronAPI', {
  
  ipcRenderer: ipcRenderer,
  
  sendPrintRequest: (printData, depFatherId, depId, tradeNo, userId, paperCount) => ipcRenderer.send('print-request', printData, depFatherId, depId, tradeNo, userId, paperCount),
  sendPrintRequestGb: (printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount) => ipcRenderer.send('print-request-gb', printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount),
  sendPrintRequestGbBatch: (printData, gbBatchId, paperCount) => ipcRenderer.send('print-request-gb-batch', printData, gbBatchId, paperCount),
  
  // 新的打印API：支持IPC回执，返回Promise。isHistoryOrder=true 时跳过保存接口和刷新客户列表
  sendPrintRequestWithCallback: (printData, depFatherId, depId, tradeNo, userId, paperCount, shouldSave, isHistoryOrder) => 
    ipcRenderer.invoke('print-request-with-callback', printData, depFatherId, depId, tradeNo, userId, paperCount, shouldSave, isHistoryOrder),
  sendPrintRequestGbWithCallback: (printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount, shouldSave) => 
    ipcRenderer.invoke('print-request-gb-with-callback', printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount, shouldSave),
  sendPrintRequestGbBatchWithCallback: (printData, gbBatchId, paperCount, shouldSave) => 
    ipcRenderer.invoke('print-request-gb-batch-with-callback', printData, gbBatchId, paperCount, shouldSave),
  triggerEnterKey: () => {
    ipcRenderer.send('trigger-enter-key');
  },
  
  // 设备配置相关
  onGetDeviceConfig: (callback) => ipcRenderer.on('get-device-config', (event, printParams) => callback(printParams)),
  sendDeviceConfig: (deviceConfig, printParams) => ipcRenderer.send('device-config-response', deviceConfig, printParams),
  
  // 设备配置检查相关
  onCheckDeviceConfigForPrint: (callback) => ipcRenderer.on('check-device-config-for-print', (event, printParams) => callback(printParams)),
  sendDeviceConfigCheckResult: (hasDeviceConfig, printParams) => ipcRenderer.send('device-config-check-result', hasDeviceConfig, printParams),
  
  // 合并接口设备配置相关
  onGetDeviceConfigForMerge: (callback) => ipcRenderer.on('get-device-config-for-merge', (event, printParams) => callback(printParams)),
  sendDeviceConfigForMerge: (deviceConfig, printParams) => ipcRenderer.send('device-config-response-for-merge', deviceConfig, printParams),

  getOSInfo: () => ipcRenderer.invoke('get-os-info'),
  // onRefreshCustomerList: (callback) => ipcRenderer.on('refresh-customer-list', callback),
  onRefreshCustomerList: (callback) => ipcRenderer.on('refresh-customer-list', (event, ...args) => callback(...args)),

  // 文件夹和文件操作相关 API
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  saveCustomerFolderPath: (customerId, folderPath) => ipcRenderer.invoke('save-customer-folder-path', customerId, folderPath),
  getCustomerFolderPath: (customerId) => ipcRenderer.invoke('get-customer-folder-path', customerId),
  scanFolderFiles: (folderPath, includeProcessed) => ipcRenderer.invoke('scan-folder-files', folderPath, includeProcessed),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  moveFileToProcessed: (filePath, targetFolder) => ipcRenderer.invoke('move-file-to-processed', filePath, targetFolder),
  moveProcessedToCompleted: (targetFolder) => ipcRenderer.invoke('move-processed-to-completed', targetFolder),
  moveProcessedToParent: (targetFolder) => ipcRenderer.invoke('move-processed-to-parent', targetFolder),
  openFile: (filePath, customerFolderPath) => ipcRenderer.invoke('open-file', filePath, customerFolderPath),
  openFolder: (filePath) => ipcRenderer.invoke('open-folder', filePath),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  saveBufferToFile: (buffer, filePath) => ipcRenderer.invoke('save-buffer-to-file', buffer, filePath),

  // 语音识别相关 API
  startVoiceRecognition: () => ipcRenderer.invoke('start-voice-recognition'),
  stopVoiceRecognition: () => ipcRenderer.invoke('stop-voice-recognition'),
  sendAudioData: (audioData) => ipcRenderer.invoke('send-audio-data', audioData),
  onVoiceRecognitionResult: (callback) => {
    ipcRenderer.on('voice-recognition-result', (event, result) => callback(result));
  },
  onVoiceRecognitionError: (callback) => {
    ipcRenderer.on('voice-recognition-error', (event, error) => callback(error));
  },
  
  // 语音合成（TTS）相关 API
  textToSpeech: (text, sessionId) => ipcRenderer.invoke('text-to-speech', text, sessionId),
  onTTSResult: (callback) => {
    ipcRenderer.on('tts-result', (event, result) => callback(result));
  },
  onTTSError: (callback) => {
    ipcRenderer.on('tts-error', (event, error) => callback(error));
  },
  
  // 系统打印机管理相关 API

  getSystemPrinters: () => ipcRenderer.invoke('get-system-printers'),
  saveDefaultPrinter: (printerName, displayName) => ipcRenderer.invoke('save-default-printer', printerName, displayName),
  getDefaultPrinter: () => ipcRenderer.invoke('get-default-printer'),
  
  // 打印机配置文件持久化相关 API
  savePrinterProfile: (deviceName, profile) => ipcRenderer.invoke('save-printer-profile', deviceName, profile),
  loadPrinterProfile: (deviceName) => ipcRenderer.invoke('load-printer-profile', deviceName),
  loadAllPrinterProfiles: () => ipcRenderer.invoke('load-all-printer-profiles'),
  
  // Windows 系统打印机配置获取 API
  getPrinterSystemConfig: () => ipcRenderer.invoke('get-printer-system-config'),
  setPrinterResolution: (hDpi, vDpi) => ipcRenderer.invoke('set-printer-resolution', hDpi, vDpi),
  
  // 打印校准页面 API
  sendPrintCalibrationPage: (htmlContent) => ipcRenderer.invoke('print-calibration-page', htmlContent),

  /** 写应用日志（异步 IPC，不阻塞界面） */
  writeAppLog: (level, tag, message, meta) => {
    try {
      ipcRenderer.send('app-log', { level, tag, message, meta });
    } catch (e) {
      console.error('[preload] writeAppLog failed', e);
    }
  },
  getAppLogDirectory: () => ipcRenderer.invoke('app-log-dir'),
  openAppLogDirectory: () => ipcRenderer.invoke('open-app-log-dir'),

  /** 与 localStorage 双写：主进程 userData 中的「记住用户」开关（同步 IPC） */
  getRememberPrinterUserSync: () => {
    try {
      return ipcRenderer.sendSync('remember-printer-user-get-sync') === '1';
    } catch {
      return false;
    }
  },
  setRememberPrinterUserSync: (enabled) => {
    try {
      ipcRenderer.sendSync('remember-printer-user-set-sync', !!enabled);
    } catch (e) {
      console.error('[preload] setRememberPrinterUserSync', e);
    }
  },

  /** 勾选「记住用户」时用异步写入，避免 sendSync 卡死界面 */
  rememberPrinterUserSetAsync: (enabled) => {
    try {
      ipcRenderer.send('remember-printer-user-set-async', !!enabled);
    } catch (e) {
      console.error('[preload] rememberPrinterUserSetAsync', e);
    }
  },

  /** 在启动 Electron 的终端里打印一行（渲染进程 console 打包后常看不到） */
  rendererConsoleLog: (line) => {
    try {
      ipcRenderer.send('renderer-console-log', typeof line === 'string' ? line : String(line));
    } catch (e) {
      console.error('[preload] rendererConsoleLog', e);
    }
  },
  
  // MCP 服务器状态和配置
  getMcpStatus: () => ipcRenderer.invoke('get-mcp-status'),
  updateMcpConfig: (config) => ipcRenderer.invoke('update-mcp-config', config),
  
  // 监听 MCP 打印触发（来自主进程）— 先移除旧监听，避免 HMR/重复注册导致同一任务触发多次
  onMcpPrintTrigger: (callback) => {
    if (mcpPrintTriggerListener) {
      ipcRenderer.removeListener('mcp-print-trigger', mcpPrintTriggerListener);
      mcpPrintTriggerListener = null;
    }
    mcpPrintTriggerListener = (_event, params) => {
      try {
        callback(params);
      } catch (e) {
        console.error('[preload] onMcpPrintTrigger', e);
      }
    };
    ipcRenderer.on('mcp-print-trigger', mcpPrintTriggerListener);
  },

  // MCP 调用 API（通过 main.js 的 IPC handler 代理到渲染进程的 axios）
  mcpCallApi: async (apiPath, method, data) => {
    try {
      // 调用 main.js 中的 mcp-call-api handler，由它在渲染进程中执行 axios 调用
      const result = await ipcRenderer.invoke('mcp-call-api', apiPath, method, data);
      return result;
    } catch (error) {
      console.error('[preload] mcpCallApi error:', error);
      return { error: error.message };
    }
  },

});
