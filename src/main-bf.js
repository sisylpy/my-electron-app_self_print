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
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const axios = require('axios');

// 注意：当前使用 HTTP API（一句话识别），不需要 WebSocket
// 如果需要实时流式识别，可以后续添加 WebSocket 支持

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
    console.log('🔍 [打印系数] ========== IPC Handler 收到打印请求 ==========');
    console.log('📥 [IPC Handler] ========== 收到打印请求 ==========');
    console.log('📥 [IPC Handler] 参数:', { depFatherId, depId, tradeNo, userId, paperCount, shouldSave });
    console.log('📥 [IPC Handler] HTML内容长度:', printData ? printData.length : 0);
    console.log('📥 [IPC Handler] HTML内容预览（前200字符）:', printData ? printData.substring(0, 200) : '(空)');
    
    // 获取打印系数（用于日志）
    try {
      const defaultPrinter = getDefaultPrinterName();
      const zoomFactor = await getPrinterZoomFactor(defaultPrinter || '');
      console.log('🔍 [打印系数] IPC Handler - 获取到的缩放系数:', {
        defaultPrinter: defaultPrinter || '系统默认',
        zoomFactor: zoomFactor,
        zoomFactorType: typeof zoomFactor,
        willApplyScaling: zoomFactor !== 1.0
      });
    } catch (err) {
      console.warn('⚠️ [打印系数] IPC Handler - 获取缩放系数失败:', err);
    }
    
    try {
      const result = await printContentToWindowWithCallback(printData, depFatherId, depId, tradeNo, userId, paperCount, shouldSave);
      return result;
    } catch (error) {
      console.error('❌ [IPC Handler] ❌ 打印请求异常:', error);
      console.error('❌ [IPC Handler] 错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
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

// ========== 系统打印机管理相关 IPC ==========

// 获取系统打印机列表
ipcMain.handle('get-system-printers', async (event) => {
  try {
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
      let parseFunction;
      
      if (platform === 'darwin') {
        // macOS: 使用 lpstat 命令获取所有打印机
        command = 'lpstat -p 2>/dev/null';
        parseFunction = (stdout) => {
          const lines = stdout.split('\n').filter(line => line.startsWith('printer'));
          return lines.map(line => {
            const match = line.match(/printer\s+(\S+)/);
            return match ? match[1] : null;
          }).filter(name => name);
        };
        
        // 同时获取默认打印机
        try {
          const { stdout } = await execAsync('lpstat -d 2>/dev/null');
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
        command = 'wmic printer get name,default /value';
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
        command = 'lpstat -p 2>/dev/null';
        parseFunction = (stdout) => {
          const lines = stdout.split('\n').filter(line => line.startsWith('printer'));
          return lines.map(line => {
            const match = line.match(/printer\s+(\S+)/);
            return match ? match[1] : null;
          }).filter(name => name);
        };
      }
      
      try {
        console.log('[打印机] 执行命令:', command);
        const { stdout, stderr } = await execAsync(command, {
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
            const { stdout } = await execAsync('lpstat -d 2>/dev/null');
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
    const userDataPath = app.getPath('userData');
    const profilesPath = path.join(userDataPath, 'printer-profiles.json');
    
    let profiles = {};
    if (fs.existsSync(profilesPath)) {
      const profilesData = fs.readFileSync(profilesPath, 'utf-8');
      profiles = JSON.parse(profilesData);
    }
    
    // 只保存需要的字段，确保不包含 scale 等旧字段
    const cleanProfile = {
      safeLeftMm: profile.safeLeftMm,
      safeRightMm: profile.safeRightMm,
      distributorNameFontSize: profile.distributorNameFontSize,
      orderContentFontSize: profile.orderContentFontSize,
      lineHeight: profile.lineHeight ?? 24,  // 行间距，默认 24px
      headerFontSize: profile.headerFontSize ?? 14,  // 表头字体大小
      zoomFactor: profile.zoomFactor ?? 1.0,  // 缩放系数，默认 1.0
      maxPrintableWidth: profile.maxPrintableWidth ?? 195,  // 最大可打印宽度（mm）
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

// ========== 打印校准页面相关 IPC ==========

// 打印校准页面
ipcMain.handle('print-calibration-page', async (event, htmlContent) => {
  return new Promise((resolve, reject) => {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 设置缩放因子为 1.0（校准页面不需要缩放）
    printWindow.webContents.setZoomFactor(1.0);

    printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.setZoomFactor(1.0);
      
      // 获取默认打印机名称
      const defaultPrinter = getDefaultPrinterName();
      console.log('[校准页面] 使用打印机:', defaultPrinter || '系统默认打印机');
      
      setTimeout(() => {
        printWindow.webContents.print({
          silent: false, // 校准页面显示打印对话框，让用户选择打印机
          printBackground: true,
          deviceName: defaultPrinter || '',
          marginsType: 1, // 无边距
        }, (success, error) => {
          printWindow.destroy();
          if (success) {
            console.log('[校准页面] ✅ 打印成功');
            resolve({ success: true });
          } else {
            console.error('[校准页面] ❌ 打印失败:', error);
            reject({ success: false, error });
          }
        });
      }, 500);
    });

    printWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      printWindow.destroy();
      reject({ success: false, error: `加载失败: ${errorDescription}`, errorCode });
    });
  });
});

// ========== Windows 系统打印机配置获取（通过 PowerShell）==========

// 获取系统默认打印机的配置信息（DPI、纸张尺寸）
// 支持 Windows 和 macOS
ipcMain.handle('get-printer-system-config', async (event) => {
  try {
    const platform = os.platform();
    
    console.log('[打印机系统配置] 当前平台:', platform);
    
    // Windows 平台：使用 PowerShell
    if (platform === 'win32') {
    
    // PowerShell 命令：获取默认打印机的配置信息
    const psCommand = `
      $printer = Get-CimInstance -ClassName Win32_Printer | Where-Object { $_.Default -eq $true }
      if ($printer) {
        $config = Get-CimInstance -ClassName Win32_PrinterConfiguration | Where-Object { $_.Name -eq $printer.Name }
        if ($config) {
          $obj = [PSCustomObject]@{
            name = $printer.Name
            hDpi = $config.HorizontalResolution
            vDpi = $config.VerticalResolution
            widthMm = [Math]::Round($config.PaperWidth / 10, 1)
            heightMm = [Math]::Round($config.PaperLength / 10, 1)
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
    
    const { stdout, stderr } = await execAsync(
      `powershell -Command "${psCommand.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    
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
          const result = await execAsync('lpstat -d', { encoding: 'utf8', timeout: 5000 });
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
            const { stdout: allPrintersOutput } = await execAsync('lpstat -p', { encoding: 'utf8', timeout: 5000 });
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
            const { stdout: lpstatAll } = await execAsync('lpstat -a', { encoding: 'utf8', timeout: 5000 });
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
        
        // 获取打印机详细信息
        let hDpi = 300; // macOS 默认值
        let vDpi = 300;
        let widthMm = 241; // 标准连续纸宽度
        let heightMm = 279; // 标准连续纸高度
        
        console.log('[打印机系统配置] macOS: 准备获取打印机选项，打印机名称:', printerName);
        console.log('[打印机系统配置] macOS: 执行命令: lpoptions -p "' + printerName + '" -l');
        
        try {
          // 尝试获取打印机选项
          const lpoptionsResult = await execAsync(`lpoptions -p "${printerName}" -l`, { 
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
            // 解析分辨率设置（如果可用）
            const resolutionMatch = lpoptionsOutput.match(/Resolution\/.*:\s*(\d+)x(\d+)/i);
            if (resolutionMatch) {
              hDpi = parseInt(resolutionMatch[1]) || 300;
              vDpi = parseInt(resolutionMatch[2]) || 300;
              console.log('[打印机系统配置] macOS: ✅ 解析到分辨率:', hDpi, 'x', vDpi);
            } else {
              console.log('[打印机系统配置] macOS: ⚠️ 未找到分辨率信息，使用默认值 300x300');
              console.log('[打印机系统配置] macOS: 尝试查找其他分辨率格式...');
              // 尝试其他可能的格式
              const altResolutionMatch = lpoptionsOutput.match(/resolution[:\s]+(\d+)[xX](\d+)/i);
              if (altResolutionMatch) {
                hDpi = parseInt(altResolutionMatch[1]) || 300;
                vDpi = parseInt(altResolutionMatch[2]) || 300;
                console.log('[打印机系统配置] macOS: ✅ 使用备用格式解析到分辨率:', hDpi, 'x', vDpi);
              }
            }
            
            // 解析纸张尺寸设置（如果可用）
            const pageSizeMatch = lpoptionsOutput.match(/PageSize\/.*:\s*(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/i);
            if (pageSizeMatch) {
              // macOS 通常使用点（points）或英寸，需要转换
              // 1 inch = 25.4mm, 1 point = 0.352778mm
              const widthInches = parseFloat(pageSizeMatch[1]) || 0;
              const heightInches = parseFloat(pageSizeMatch[2]) || 0;
              if (widthInches > 0 && heightInches > 0) {
                widthMm = Math.round(widthInches * 25.4 * 10) / 10;
                heightMm = Math.round(heightInches * 25.4 * 10) / 10;
                console.log('[打印机系统配置] macOS: ✅ 解析到纸张尺寸:', widthMm, 'x', heightMm, 'mm');
              }
            } else {
              console.log('[打印机系统配置] macOS: ⚠️ 未找到纸张尺寸信息，使用默认值 241x279mm');
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

// ==================== 腾讯云语音识别相关功能 ====================

// 腾讯云配置（从配置文件读取）
const DEFAULT_TENCENT_CLOUD_CONFIG = {
  secretId: '',
  secretKey: '',
  appId: '',
  engineModelType: '16k_zh',
  region: 'ap-guangzhou'
};

function loadTencentCloudConfig() {
  const userDataPath = app.getPath('userData');
  const projectConfigPath = path.join(app.getAppPath(), 'config', 'tencent-cloud.json');
  const userConfigPath = path.join(userDataPath, 'tencent-cloud.json');
  const pathsToTry = [userConfigPath, projectConfigPath];
  for (const configPath of pathsToTry) {
    if (fs.existsSync(configPath)) {
      try {
        const data = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(data);
        return { ...DEFAULT_TENCENT_CLOUD_CONFIG, ...config };
      } catch (e) {
        console.warn('[腾讯云] 配置文件解析失败:', configPath, e.message);
      }
    }
  }
  console.warn('[腾讯云] 未找到配置文件，请复制 config/tencent-cloud.example.json 为 tencent-cloud.json 并填入密钥');
  return DEFAULT_TENCENT_CLOUD_CONFIG;
}

let TENCENT_CLOUD_CONFIG = null;
function getTencentCloudConfig() {
  if (!TENCENT_CLOUD_CONFIG) {
    TENCENT_CLOUD_CONFIG = loadTencentCloudConfig();
  }
  return TENCENT_CLOUD_CONFIG;
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
    console.log('[语音识别] 开始语音识别（主进程 PCM 录音）...');

    const cfg = getTencentCloudConfig();
    if (!cfg.secretId || !cfg.secretKey) {
      return { success: false, error: '请配置腾讯云密钥：复制 config/tencent-cloud.example.json 为 tencent-cloud.json 或放入用户数据目录，并填入 secretId、secretKey' };
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
  // PCM 模式下，音频数据直接在主进程录制，不需要从渲染进程发送
  console.log('[语音识别] send-audio-data 被调用，但 PCM 模式下不需要');
  return { success: true, message: 'PCM 模式下音频在主进程录制' };
});

// 停止语音识别并获取结果
ipcMain.handle('stop-voice-recognition', async (event) => {
  try {
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

// 获取打印机的缩放系数（从配置文件读取）
async function getPrinterZoomFactor(printerName) {
  try {
    const userDataPath = app.getPath('userData');
    const profilesPath = path.join(userDataPath, 'printer-profiles.json');
    
    if (!fs.existsSync(profilesPath)) {
      return 1.0; // 配置文件不存在，返回默认值
    }
    
    const profilesData = fs.readFileSync(profilesPath, 'utf-8');
    const profiles = JSON.parse(profilesData);
    
    // 优先查找 default-printer（因为保存时使用的是 default-printer）
    if (profiles['default-printer'] && profiles['default-printer'].zoomFactor !== undefined) {
      return profiles['default-printer'].zoomFactor;
    }
    
    if (!printerName) {
      // 如果没有指定打印机名称，尝试查找第一个配置
      const profileKeys = Object.keys(profiles);
      if (profileKeys.length > 0) {
        const firstProfile = profiles[profileKeys[0]];
        if (firstProfile && firstProfile.zoomFactor !== undefined) {
          return firstProfile.zoomFactor;
        }
      }
      return 1.0;
    }
    
    // 精确匹配
    const profile = profiles[printerName];
    if (profile && profile.zoomFactor !== undefined) {
      return profile.zoomFactor;
    }
    
    // 尝试模糊匹配（不区分大小写）
    const lowerPrinterName = printerName.toLowerCase();
    for (const [key, value] of Object.entries(profiles)) {
      if (key.toLowerCase() === lowerPrinterName && value.zoomFactor !== undefined) {
        return value.zoomFactor;
      }
    }
    
    // 如果找不到匹配的打印机配置，尝试使用 default-printer 作为后备
    if (profiles['default-printer'] && profiles['default-printer'].zoomFactor !== undefined) {
      return profiles['default-printer'].zoomFactor;
    }
    
    return 1.0; // 没有配置，返回默认值
  } catch (error) {
    console.error('🔍 [打印系数] getPrinterZoomFactor - 读取失败:', error.message);
    return 1.0; // 出错时返回默认值
  }
}

// 语音合成：将文本转换为语音
ipcMain.handle('text-to-speech', async (event, text, sessionId) => {
  try {
    console.log('[TTS] 开始语音合成，文本:', text);
    
    if (!text || !text.trim()) {
      return { success: false, error: '文本不能为空' };
    }
    
    const cfg = getTencentCloudConfig();
    if (!cfg.secretId || !cfg.secretKey) {
      return { success: false, error: '请配置腾讯云密钥：复制 config/tencent-cloud.example.json 为 tencent-cloud.json 或放入用户数据目录，并填入 secretId、secretKey' };
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
    
    // 获取默认打印机名称
    const defaultPrinter = getDefaultPrinterName();
    console.log('[打印] GB批次打印，使用打印机:', defaultPrinter || '系统默认打印机');
    
    printWindow.webContents.print({
      marginsType: 0, // 0 = default, 1 = none, 2 = minimum
      silent: true,  // 静默打印，不弹出对话框
      printBackground: false,
      deviceName: defaultPrinter || '',// 使用配置的默认打印机，空字符串使用系统默认打印机
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

    printWindow.webContents.on('did-finish-load', async () => {
      // 获取默认打印机名称和缩放系数
      const defaultPrinter = getDefaultPrinterName();
      const zoomFactor = await getPrinterZoomFactor(defaultPrinter);
      
      console.log('[打印] GB批次打印（IPC回执），使用打印机:', defaultPrinter || '系统默认打印机');
      console.log('[打印缩放] 缩放系数:', zoomFactor);
      
      // 应用缩放系数（关键：修正整体缩小问题）
      printWindow.webContents.setZoomFactor(zoomFactor);
      
      printWindow.webContents.print({
        marginsType: 0,
        silent: true,
        printBackground: false,
        deviceName: defaultPrinter || '', // 使用配置的默认打印机
        margins: {
          marginType: 'none'
        },
        dpi: { horizontal: 360, vertical: 180 }, // 设置打印DPI为360x180，提高清晰度
      }, (success, error) => {
        // 恢复缩放因子
        printWindow.webContents.setZoomFactor(1.0);
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
    
    // 获取默认打印机名称
    const defaultPrinter = getDefaultPrinterName();
    console.log('[打印] GB订单打印，使用打印机:', defaultPrinter || '系统默认打印机');
    
    printWindow.webContents.print({
      marginsType: 0, // 0 = default, 1 = none, 2 = minimum
      silent: true,  // 静默打印，不弹出对话框
      printBackground: false,
      deviceName: defaultPrinter || '',// 使用配置的默认打印机，空字符串使用系统默认打印机
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

    printWindow.webContents.on('did-finish-load', async () => {
      // 获取默认打印机名称和缩放系数
      const defaultPrinter = getDefaultPrinterName();
      const zoomFactor = await getPrinterZoomFactor(defaultPrinter);
      
      console.log('[打印] GB订单打印（IPC回执），使用打印机:', defaultPrinter || '系统默认打印机');
      console.log('[打印缩放] 缩放系数:', zoomFactor);
      
      // 应用缩放系数（关键：修正整体缩小问题）
      printWindow.webContents.setZoomFactor(zoomFactor);
      
      printWindow.webContents.print({
        marginsType: 0,
        silent: true,
        printBackground: false,
        deviceName: defaultPrinter || '', // 使用配置的默认打印机
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
    
    // 获取默认打印机名称
    const defaultPrinter = getDefaultPrinterName();
    console.log('[打印] 普通订单打印，使用打印机:', defaultPrinter || '系统默认打印机');
    
    printWindow.webContents.print({
      marginsType: 0, // 0 = default, 1 = none, 2 = minimum
      silent: true,  // 静默打印，不弹出对话框
      printBackground: false,
      deviceName: defaultPrinter || '',// 使用配置的默认打印机，空字符串使用系统默认打印机
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
  console.log('🔍 [打印系数] ========== printContentToWindowWithCallback 函数开始 ==========');
  console.log('🚀 [printContentToWindowWithCallback] ========== 开始创建打印窗口 ==========');
  console.log('🚀 [printContentToWindowWithCallback] 参数:', { depFatherId, depId, tradeNo, userId, paperCount, shouldSave });
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
    printWindow.webContents.setZoomFactor(1.0);

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
    }, 10000); // 10秒超时
    
    printWindow.webContents.on('did-finish-load', async () => {
      console.log('📄 [printContentToWindowWithCallback] 打印窗口加载完成，准备打印');
      console.log('📄 [printContentToWindowWithCallback] HTML内容长度:', printContent.length);
      console.log('📄 [printContentToWindowWithCallback] 打印参数:', { depFatherId, depId, tradeNo, userId, paperCount, shouldSave });
      
      // 注意：这里先设置为 1.0，实际的缩放系数会在 setTimeout 回调中应用
      // 因为需要先获取打印机配置来确定最终的缩放系数
      printWindow.webContents.setZoomFactor(1.0);
      
      console.log('📄 [printContentToWindowWithCallback] 普通打印：将在 setTimeout 回调中应用缩放系数');
      
      // 添加延迟，确保内容完全渲染（根据 GPT 建议，延迟 500ms 确保 HTML/CSS/图片完全加载）
      setTimeout(async () => {
        if (isResolved) {
          console.warn('⚠️ [printContentToWindowWithCallback] 已超时，跳过打印');
          return; // 如果已经超时，不再执行打印
        }
        
        // 额外延迟，确保内容完全渲染（特别是图片和 CSS）
        // GPT 建议：在 did-finish-load 之后延迟 500ms 调用打印
        console.log('⏳ [printContentToWindowWithCallback] 等待 500ms 确保内容完全渲染...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
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
                    console.warn('⚠️ [打印] ⚠️⚠️⚠️ 打印机处于暂停状态，打印可能失败 ⚠️⚠️⚠️');
                    console.warn('⚠️ [打印] 请检查打印机是否暂停，如果是，请取消暂停后重试');
                  } else if (matchedPrinter.status === 3) {
                    console.error('❌ [打印] ❌❌❌ 打印机处于错误状态，打印可能失败 ❌❌❌');
                    console.error('❌ [打印] 请检查：');
                    console.error('❌ [打印]   1. 打印机是否已连接');
                    console.error('❌ [打印]   2. 打印机是否缺纸');
                    console.error('❌ [打印]   3. 打印机是否有卡纸或其他错误');
                    console.error('❌ [打印]   4. 打印机驱动是否正常');
                    console.error('❌ [打印] 即使 Electron 返回成功，打印机也可能因为错误状态而无法打印');
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
        
        // 重要：使用最终确定的打印机名称重新获取缩放系数
        // 因为 finalPrinterName 可能是系统识别的实际名称，与配置时保存的名称可能不同
        const printerNameForZoom = finalPrinterName || defaultPrinter || '';
        const finalZoomFactor = await getPrinterZoomFactor(printerNameForZoom);
        
        // 获取初始缩放系数（用于日志对比）
        const initialZoomFactor = await getPrinterZoomFactor(defaultPrinter || '');
        
        console.log('🔍 [打印系数] ========== main.js 获取缩放系数 ==========');
        console.log('🔍 [printContentToWindowWithCallback] 最终打印机配置:', {
          defaultPrinter: defaultPrinter || '未配置',
          finalPrinterName: finalPrinterName || '系统默认',
          printerNameForZoom: printerNameForZoom || '系统默认',
          initialZoomFactor: initialZoomFactor,
          finalZoomFactor: finalZoomFactor,
          'initialZoomFactor类型': typeof initialZoomFactor,
          'finalZoomFactor类型': typeof finalZoomFactor,
          zoomFactorChanged: finalZoomFactor !== initialZoomFactor,
          '将使用的zoomFactor': finalZoomFactor
        });
        console.log('🔍 [打印系数] ========== main.js 缩放系数获取完成 ==========');
        
        // 重要：对于针式打印机，CSS @page size 可能被驱动忽略
        // 因此需要同时使用 Electron 的 setZoomFactor 来确保缩放生效
        // 注意：CSS 层面已经缩放字体大小，这里只缩放整体页面，避免双重缩放字体
        // 策略：CSS 保持原始尺寸，Electron setZoomFactor 统一缩放
        console.log('🔍 [打印系数] ========== main.js 应用缩放系数 ==========');
        console.log('🔍 [打印系数] main.js - 缩放系数检查:', {
          'finalZoomFactor': finalZoomFactor,
          '类型': typeof finalZoomFactor,
          '是否为1.0': finalZoomFactor === 1.0,
          '将应用setZoomFactor': finalZoomFactor !== 1.0
        });
        
        if (finalZoomFactor !== 1.0) {
          printWindow.webContents.setZoomFactor(finalZoomFactor);
          console.log('✅ [打印系数] main.js - 应用 Electron setZoomFactor:', finalZoomFactor);
          console.log('📐 [打印系数] main.js - 说明：针式打印机需要 Electron 层面缩放，CSS @page size 可能被驱动忽略');
          console.log('📐 [打印系数] main.js - 缩放效果：页面将放大', ((finalZoomFactor - 1) * 100).toFixed(2), '%');
        } else {
          printWindow.webContents.setZoomFactor(1.0);
        }
        console.log('🔍 [打印系数] ========== main.js 缩放系数应用完成 ==========');
        
        console.log('🖨️ [printContentToWindowWithCallback] 开始调用打印API');
        
        // 检测平台
        const platform = os.platform();
        const isMacOS = platform === 'darwin';
        const isWindows = platform === 'win32';
        
        console.log('🖨️ [printContentToWindowWithCallback] 当前平台:', platform);
        
        // 根据 GPT 建议优化打印参数：
        // 1. 使用 marginsType: 0 (默认边距)，比 'none' 更稳健
        // 2. macOS 需要特殊处理：设置 DPI 和禁用字体平滑
        // 3. 开启 printBackground 防止样式丢失
        const printOptions = {
          silent: true,
          printBackground: true, // 开启背景打印，防止样式丢失
          deviceName: finalPrinterName, // 使用验证后的打印机名称
          marginsType: 0, // 0 = 默认边距，比 'none' 更稳健，兼容性更好
          // 不设置 margins 对象，使用系统默认
        };
        
        // macOS 特殊处理：针式打印机需要明确的 DPI 设置
        // macOS 使用 CUPS，打印流程是：应用 -> PDF -> CUPS -> 驱动
        // PDF 中间层可能导致字体渲染模糊，需要明确设置 DPI
        if (isMacOS) {
          // Epson 针式打印机通常使用 180x180 DPI（标准）或 360x180 DPI（高质量）
          // 对于 macOS，使用高质量模式以提高清晰度
          printOptions.dpi = { horizontal: 360, vertical: 180 };
          console.log('🍎 [printContentToWindowWithCallback] macOS 平台：设置 DPI 360x180（高质量模式）');
          console.log('🍎 [printContentToWindowWithCallback] 说明：macOS 使用 CUPS，需要明确 DPI 以避免 PDF 中间层导致的模糊');
          console.log('🍎 [printContentToWindowWithCallback] 使用高质量模式（360x180）以提高打印清晰度');
        } else if (isWindows) {
          // Windows：让驱动自己决定 DPI（针式打印机驱动通常能正确识别）
          // 不设置 dpi，让打印机驱动自己决定（针式打印机通常有固定 DPI，如 180x180）
          console.log('🪟 [printContentToWindowWithCallback] Windows 平台：不设置 DPI，让驱动自己决定');
        }
        
        console.log('🖨️ [printContentToWindowWithCallback] 打印参数:', printOptions);
        console.log('🖨️ [printContentToWindowWithCallback] 优化说明:');
        console.log('  - 使用 marginsType: 0 (默认边距)');
        if (isMacOS) {
          console.log('  - macOS: 设置 DPI 360x180（高质量模式）');
          console.log('  - macOS: 开启 printBackground: true');
        } else {
          console.log('  - 移除自定义 DPI，使用驱动默认值');
          console.log('  - 开启 printBackground: true');
        }
        console.log('  - 如果打印失败，请检查打印机是否在线、缺纸或暂停');
        
        // 监听打印错误事件
        printWindow.webContents.on('print-failed', (event, errorCode, errorDescription) => {
          console.error('❌ [打印] 打印失败事件触发');
          console.error('❌ [打印] errorCode:', errorCode);
          console.error('❌ [打印] errorDescription:', errorDescription);
        });
        
        // 在打印前再次确认 setZoomFactor（确保缩放生效）
        const currentZoomFactor = printWindow.webContents.getZoomFactor();
        
        // 强制应用缩放系数（确保生效）
        if (Math.abs(currentZoomFactor - finalZoomFactor) > 0.0001) {
          printWindow.webContents.setZoomFactor(finalZoomFactor);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // 使用 Promise 包装 print()，确保在打印时缩放仍然生效
        const printPromise = new Promise((printResolve, printReject) => {
          // 在调用 print() 前再次确认缩放（macOS 可能需要）
          if (finalZoomFactor !== 1.0) {
            printWindow.webContents.setZoomFactor(finalZoomFactor);
          }
          
          printWindow.webContents.print(printOptions, (success, error) => {
          console.log('🖨️ [printContentToWindowWithCallback] ========== 打印回调被调用 ==========');
          console.log('🖨️ [printContentToWindowWithCallback] success:', success);
          console.log('🖨️ [printContentToWindowWithCallback] error:', error);
          console.log('🖨️ [printContentToWindowWithCallback] error类型:', typeof error);
          console.log('🖨️ [printContentToWindowWithCallback] 打印参数:', { userId, tradeNo, shouldSave });
          console.log('🖨️ [printContentToWindowWithCallback] 使用的打印机:', finalPrinterName || '系统默认');
          
          // 恢复缩放因子为 1.0（虽然窗口会被销毁，但为了代码完整性）
          printWindow.webContents.setZoomFactor(1.0);
          
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
            
            printResolve({ success: true, tradeNo });
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
            
            printReject({ success: false, error: error || '打印失败', tradeNo, printer: finalPrinterName || defaultPrinter });
          }
        });
        }); // 关闭 printPromise
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
