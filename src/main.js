// src/main.js
const { app, BrowserWindow, ipcMain, screen, dialog, shell, Menu } = require('electron');
const path = require('path')
const fs = require('fs')
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

const axios = require('axios');

// 移除顶部的静态require，改为动态加载


const VUE3_DEVTOOLS_ID = 'ljjemllljcmogpfapbkkighbhhppjdbg';


const isDev = !app.isPackaged; // 使用 app.isPackaged 来检测开发模式
let mainWindow;

// 创建中文菜单
function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
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



  // 监听来自渲染进程的打印请求（旧接口，保持兼容）
  ipcMain.on('print-request', (event, printData, depFatherId, depId, tradeNo, userId, paperCount) => {
    printContentToWindow(printData, depFatherId, depId , tradeNo, userId, paperCount);
  });

  ipcMain.on('print-request-gb', (event, printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount) => {
    printContentToWindowGb(printData, gbDepFatherId, gbDepId , tradeNo, userId, nxDisId, paperCount);
  });

  ipcMain.on('print-request-gb-batch', (event, printData, gbBatchId, paperCount) => {
    printContentToWindowGbPb(printData, gbBatchId, paperCount);
  });

  // 新的IPC handlers：支持回执的打印接口（返回Promise）
  ipcMain.handle('print-request-with-callback', async (event, printData, depFatherId, depId, tradeNo, userId, paperCount, shouldSave) => {
    try {
      const result = await printContentToWindowWithCallback(printData, depFatherId, depId, tradeNo, userId, paperCount, shouldSave);
      return result;
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('print-request-gb-with-callback', async (event, printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount, shouldSave) => {
    try {
      const result = await printContentToWindowGbWithCallback(printData, gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount, shouldSave);
      return result;
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('print-request-gb-batch-with-callback', async (event, printData, gbBatchId, paperCount, shouldSave) => {
    try {
      const result = await printContentToWindowGbPbWithCallback(printData, gbBatchId, paperCount, shouldSave);
      return result;
    } catch (error) {
      throw error;
    }
  });

  console.log('Window created');

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window loaded'); // Check if the window loaded properly
    // 生产环境不打开DevTools
  });

  console.log('Window created'); // Log here too
}

ipcMain.handle('get-os-info', () => {
  return {
    platform: os.platform(),
    arch: os.arch(),
  };
});

ipcMain.on('trigger-enter-key', () => {
  console.log('Received trigger-enter-key');
  keyboard.pressKey(Key.Enter);
  keyboard.releaseKey(Key.Enter);
});

// ========== 文件夹和文件操作相关 IPC ==========

// 选择文件夹对话框
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择订单存储文件夹'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  
  return { success: false, path: null };
});

// 保存客户文件夹路径配置
ipcMain.handle('save-customer-folder-path', async (event, customerId, folderPath) => {
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'customer-folders.json');
    
    let config = {};
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(configData);
    }
    
    config[customerId] = folderPath;
    
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
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'customer-folders.json');
    
    if (!fs.existsSync(configPath)) {
      return { success: true, path: null };
    }
    
    const configData = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configData);
    
    return { success: true, path: config[customerId] || null };
  } catch (error) {
    console.error('读取客户文件夹路径失败:', error);
    return { success: false, error: error.message, path: null };
  }
});

// 扫描文件夹中的文件（Excel 和图片）
ipcMain.handle('scan-folder-files', async (event, folderPath, includeProcessed = false) => {
  try {
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
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在' };
    }
    
    const fileBuffer = fs.readFileSync(filePath);
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

function printContentToWindowGbPb(printContent, gbBatchId, paperCount) {
  const printWindow = new BrowserWindow({
    show: false, // 不显示打印窗口
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 设置打印窗口的缩放比例，确保字体清晰
  printWindow.webContents.setZoomFactor(1.0);

  printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printContent));

  printWindow.webContents.on('did-finish-load', () => {
    // 确保在打印前设置正确的缩放
    printWindow.webContents.setZoomFactor(1.0);
    
    printWindow.webContents.print({
      marginsType: 0, // 0 = default, 1 = none, 2 = minimum
      silent: true,  // 静默打印，不弹出对话框
      printBackground: false,
      deviceName: '',// 空字符串使用默认打印机
      margins: {
        marginType: 'none' // 或使用具体的数值，如 { top: 0, bottom: 0, left: 0, right: 0 }
      },
      dpi: { horizontal: 300, vertical: 300 }, // 设置打印DPI为300，提高清晰度

    }, (success, error) => {
      if (success) {
        console.log('打印成功userId', gbBatchId);
        // 调用GB批次保存接口
        savePrintBillGbPb(gbBatchId, paperCount);
      } else {
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
    printWindow.webContents.setZoomFactor(1.0);

    printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printContent));

    printWindow.webContents.on('did-finish-load', () => {
      // 确保在打印前设置正确的缩放
      printWindow.webContents.setZoomFactor(1.0);
      
      printWindow.webContents.print({
        marginsType: 0,
        silent: true,
        printBackground: false,
        deviceName: '',
        margins: {
          marginType: 'none'
        },
        dpi: { horizontal: 360, vertical: 180 }, // 设置打印DPI为360x180，提高清晰度
      }, (success, error) => {
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
  const printWindow = new BrowserWindow({
    show: false, // 不显示打印窗口
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 设置打印窗口的缩放比例，确保字体清晰
  printWindow.webContents.setZoomFactor(1.0);

  printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printContent));

  printWindow.webContents.on('did-finish-load', () => {
    // 确保在打印前设置正确的缩放
    printWindow.webContents.setZoomFactor(1.0);
    
    printWindow.webContents.print({
      marginsType: 0, // 0 = default, 1 = none, 2 = minimum
      silent: true,  // 静默打印，不弹出对话框
      printBackground: false,
      deviceName: '',// 空字符串使用默认打印机
      margins: {
        marginType: 'none' // 或使用具体的数值，如 { top: 0, bottom: 0, left: 0, right: 0 }
      },
      dpi: { horizontal: 300, vertical: 300 }, // 设置打印DPI为300，提高清晰度

    }, (success, error) => {
      if (success) {
        console.log('打印成功userId', userId);
        // 调用GB订单保存接口
        savePrintBillGb(gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount);
      } else {
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
    printWindow.webContents.setZoomFactor(1.0);

    printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printContent));

    printWindow.webContents.on('did-finish-load', () => {
      // 确保在打印前设置正确的缩放
      printWindow.webContents.setZoomFactor(1.0);
      
      printWindow.webContents.print({
        marginsType: 0,
        silent: true,
        printBackground: false,
        deviceName: '',
        margins: {
          marginType: 'none'
        },
        dpi: { horizontal: 360, vertical: 180 }, // 设置打印DPI为360x180，提高清晰度
      }, (success, error) => {
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
  const printWindow = new BrowserWindow({
    show: false, // 不显示打印窗口
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 设置打印窗口的缩放比例，确保字体清晰
  printWindow.webContents.setZoomFactor(1.0);

  printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printContent));

  printWindow.webContents.on('did-finish-load', () => {
    // 确保在打印前设置正确的缩放
    printWindow.webContents.setZoomFactor(1.0);
    
    printWindow.webContents.print({
      marginsType: 0, // 0 = default, 1 = none, 2 = minimum
      silent: true,  // 静默打印，不弹出对话框
      printBackground: false,
      deviceName: '',// 空字符串使用默认打印机
      margins: {
        marginType: 'none' // 或使用具体的数值，如 { top: 0, bottom: 0, left: 0, right: 0 }
      },
      dpi: { horizontal: 300, vertical: 300 }, // 设置打印DPI为300，提高清晰度

    }, (success, error) => {
      if (success) {
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
        console.log('打印失败userId', error, userId);
      }
    });
  });
}

// 新的打印函数：返回Promise，支持IPC回执
function printContentToWindowWithCallback(printContent, depFatherId, depId, tradeNo, userId, paperCount, shouldSave = true) {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 设置打印窗口的缩放比例，确保字体清晰
    printWindow.webContents.setZoomFactor(1.0);

    printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(printContent));

    printWindow.webContents.on('did-finish-load', () => {
      // 确保在打印前设置正确的缩放
      printWindow.webContents.setZoomFactor(1.0);
      
      printWindow.webContents.print({
        marginsType: 0,
        silent: true,
        printBackground: false,
        deviceName: '',
        margins: {
          marginType: 'none'
        },
        dpi: { horizontal: 360, vertical: 180 }, // 设置打印DPI为360x180，提高清晰度
      }, (success, error) => {
        // 关闭打印窗口
        printWindow.destroy();
        
        if (success) {
          console.log('✅ [IPC回执] 打印成功 userId:', userId, 'tradeNo:', tradeNo, 'shouldSave:', shouldSave);
          
          // 只在 shouldSave=true 时保存打印记录（异步，不阻塞回执）
          if (shouldSave) {
            console.log('💾 [IPC回执] 需要保存打印记录，paperCount:', paperCount);
            if (mainWindow) {
              console.log('💾 [IPC回执] 发送设备配置检查请求到渲染进程');
              mainWindow.webContents.send('check-device-config-for-print', {
                depFatherId, depId, tradeNo, userId, paperCount
              });
            } else {
              console.log('💾 [IPC回执] 主窗口不存在，直接调用保存接口');
              savePrintBill(depFatherId, depId, tradeNo, userId, paperCount);
            }
          } else {
            console.log('⏭️ [IPC回执] 跳过保存，非最后一页');
          }
          
          resolve({ success: true, tradeNo });
        } else {
          console.error('❌ [IPC回执] 打印失败:', error, 'userId:', userId);
          reject({ success: false, error, tradeNo });
        }
      });
    });

    // 处理加载错误
    printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      printWindow.destroy();
      reject({ success: false, error: `加载失败: ${errorDescription}`, errorCode });
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

function savePrintBill(depFatherId, depId, tradeNo, userId, paperCount) {
  console.log('💾 [savePrintBill] 开始保存订单:', {
    depFatherId, depId, tradeNo, userId, paperCount
  });

  const apiUrl = isDev
    ? `http://localhost:8080/nongxinle_master_war_exploded/api/nxdepartmentbill/saveAccountBillPrinter/`
    : `https://grainservice.club:8443/nongxinle/api/nxdepartmentbill/saveAccountBillPrinter/`;

  console.log('🌐 [savePrintBill] 请求URL:', apiUrl);

  // 发起请求
  const postData = {
    depId: depId,
    depFatherId: depFatherId,
    tradeNo: tradeNo,
    userId: userId
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
  
  const apiUrl = isDev
    ? `http://localhost:8080/nongxinle_master_war_exploded/api/machine/print/record`
    : `https://grainservice.club:8443/nongxinle/api/machine/print/record`;

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
  console.log('📱 收到设备配置 (合并接口):', deviceConfig);
  console.log('📋 收到printParams (合并接口):', printParams);
  
  const apiUrl = isDev
    ? `http://localhost:8080/nongxinle_master_war_exploded/api/nxdepartmentbill/saveAccountBillPrinterSelf`
    : `https://grainservice.club:8443/nongxinle/api/nxdepartmentbill/saveAccountBillPrinterSelf`;

  // 构建合并接口的请求数据
  const mergeData = {
    depFatherId: parseInt(printParams.depFatherId || 0),
    depId: parseInt(printParams.depId || 0),
    tradeNo: printParams.tradeNo || '',
    userId: parseInt(printParams.userId || 0),
    deviceId: parseInt(deviceConfig?.selectedDevice?.nxPdId || 0),
    pricePerSheet: '0.00', // 默认价格，可以根据需要调整
    marketId: parseInt(deviceConfig?.deviceAdminInfo?.marketId || 0),
    paperCount: Math.max(1, parseInt(printParams.paperCount || 1))
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
      printParams.paperCount
    );
  }
});

function savePrintBillGb(gbDepFatherId, gbDepId, tradeNo, userId, nxDisId, paperCount) {
  console.log('GB订单保存:', gbDepFatherId, gbDepId, tradeNo, userId, nxDisId);

  const apiUrl = isDev
    ? `http://localhost:8080/nongxinle_master_war_exploded/api/nxdepartmentbill/saveAccountBillPrinterGb/`
    : `https://grainservice.club:8443/nongxinle/api/nxdepartmentbill/saveAccountBillPrinterGb/`;

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

  const apiUrl = isDev
    ? `http://localhost:8080/nongxinle_master_war_exploded/api/gbdistributerpurchasebatch/nxDisPrintGbPurBatch/`
    : `https://grainservice.club:8443/nongxinle/api/gbdistributerpurchasebatch/nxDisPrintGbPurBatch/`;
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

app.whenReady().then(() => {
  // 创建中文菜单
  createMenu();
  
  createWindow();

  // 对于 macOS，当所有窗口关闭时重新激活应用的处理
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();

  });
});

app.on('window-all-closed', () => {
  // 对于 Windows 和 Linux，在所有窗口关闭后退出应用
  if (process.platform !== 'darwin') app.quit();
});
