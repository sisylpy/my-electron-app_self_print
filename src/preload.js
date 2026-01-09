// preload.js
console.log('PreloadAAAAAA script loaded----src');

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  
  ipcRenderer: ipcRenderer,
  
  sendPrintRequest: (printData, depFatherId, depId, tradeNo, userId, paperCount) => ipcRenderer.send('print-request', printData, depFatherId, depId, tradeNo, userId, paperCount),
  sendPrintRequestGb: (printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount) => ipcRenderer.send('print-request-gb', printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount),
  sendPrintRequestGbBatch: (printData, gbBatchId, paperCount) => ipcRenderer.send('print-request-gb-batch', printData, gbBatchId, paperCount),
  
  // 新的打印API：支持IPC回执，返回Promise
  sendPrintRequestWithCallback: (printData, depFatherId, depId, tradeNo, userId, paperCount, shouldSave) => 
    ipcRenderer.invoke('print-request-with-callback', printData, depFatherId, depId, tradeNo, userId, paperCount, shouldSave),
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

  
});
