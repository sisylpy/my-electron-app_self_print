/**
 * 应用日志：写入 userData/logs/app-YYYY-MM-DD.log
 * 供主进程异常、渲染进程通过 IPC 上报、客户发日志排查问题。
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let logDir;
let processHandlersBound = false;
let ipcRegistered = false;
/** 仅开发环境：定时采样主进程内存 */
let devMemorySampleTimer = null;

// 开发环境主进程内存采样间隔（仅 !app.isPackaged）。测试时可改小；日常可改回 3 * 60 * 1000
const DEV_MEMORY_SAMPLE_INTERVAL_MS = 30  * 60  * 1000; // 每 30 秒一条

function bytesToMB(b) {
  return Math.round((b / 1024 / 1024) * 100) / 100;
}

/** 主进程 memoryUsage（不含 Chromium 渲染进程，仅作趋势参考） */
function logMainMemorySample() {
  const m = process.memoryUsage();
  append('info', 'main', 'memory-sample-dev', {
    note: '主进程 Node/V8；界面内存请在 DevTools Memory 或活动监视器看 Electron Helper(Renderer)',
    rssMB: bytesToMB(m.rss),
    heapUsedMB: bytesToMB(m.heapUsed),
    heapTotalMB: bytesToMB(m.heapTotal),
    externalMB: bytesToMB(m.external),
    arrayBuffersMB: bytesToMB(m.arrayBuffers || 0)
  });
}

function startDevMemorySampling() {
  if (app.isPackaged) return;
  if (devMemorySampleTimer) {
    clearInterval(devMemorySampleTimer);
    devMemorySampleTimer = null;
  }
  logMainMemorySample(); // 启动后立即一条
  devMemorySampleTimer = setInterval(logMainMemorySample, DEV_MEMORY_SAMPLE_INTERVAL_MS);
  const ivSec = DEV_MEMORY_SAMPLE_INTERVAL_MS / 1000;
  console.log(
    `[appLogger] 开发环境已开启主进程内存采样：每 ${ivSec < 60 ? ivSec + ' 秒' : ivSec / 60 + ' 分钟'}写入日志（memory-sample-dev）`
  );
}

function stopDevMemorySampling() {
  if (devMemorySampleTimer) {
    clearInterval(devMemorySampleTimer);
    devMemorySampleTimer = null;
  }
}

function ensureLogDir() {
  if (!logDir) {
    logDir = path.join(app.getPath('userData'), 'logs');
  }
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  return logDir;
}

function getTodayLogFilePath() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return path.join(ensureLogDir(), `app-${y}-${m}-${day}.log`);
}

function readAppVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** 日志时间：本机本地时区（非 UTC 的 Z），便于国内对照 */
function formatLocalTimestamp(d = new Date()) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${y}-${mo}-${da} ${h}:${mi}:${s}.${ms}`;
}

function formatLine(level, scope, message, meta) {
  const ts = formatLocalTimestamp();
  let line = `[${ts}] [${level}] [${scope}] ${message}`;
  if (meta !== undefined && meta !== null) {
    try {
      line += typeof meta === 'string' ? ` ${meta}` : ` ${JSON.stringify(meta)}`;
    } catch {
      line += ' [meta-json-failed]';
    }
  }
  return `${line}\n`;
}

/**
 * @param {'error'|'warn'|'info'|'debug'} level
 * @param {string} scope 如 main / vue / renderer
 */
function append(level, scope, message, meta) {
  try {
    const filePath = getTodayLogFilePath();
    const line = formatLine(level, scope, message, meta);
    fs.appendFileSync(filePath, line, 'utf8');
    // 开发环境同步一行到主进程终端，便于对照文件
    if (!app.isPackaged) {
      const short = line.replace(/\n$/, '');
      if (level === 'error') console.error('[app-log]', short);
      else if (level === 'warn') console.warn('[app-log]', short);
      else console.log('[app-log]', short);
    }
  } catch (e) {
    console.error('[appLogger] append failed:', e);
  }
}

function writeSessionHeader() {
  const os = require('os');
  append('info', 'main', 'session-start', {
    appVersion: readAppVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    osRelease: os.release(),
    arch: process.arch,
    packaged: app.isPackaged,
    userData: app.getPath('userData')
  });
}

function bindProcessHandlers() {
  if (processHandlersBound) return;
  processHandlersBound = true;

  process.on('uncaughtException', (err) => {
    append('error', 'main', 'uncaughtException', {
      message: err && err.message,
      stack: err && err.stack
    });
    console.error('[main] uncaughtException', err);
  });

  process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    append('error', 'main', 'unhandledRejection', { message: msg, stack });
    console.error('[main] unhandledRejection', reason);
  });
}

/**
 * 注册 IPC：渲染进程 send('app-log')、invoke 取路径 / 打开文件夹
 * @param {import('electron').IpcMain} ipcMain
 * @param {import('electron').Shell} shell
 * @param {(event: import('electron').IpcMainEvent | import('electron').IpcMainInvokeEvent) => void} assertTrustedEvent
 */
function registerIpc(ipcMain, shell, assertTrustedEvent) {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.on('app-log', (event, payload) => {
    assertTrustedEvent(event);
    if (!payload || typeof payload !== 'object') return;
    const level = ['error', 'warn', 'info', 'debug'].includes(payload.level)
      ? payload.level
      : 'info';
    const tag = typeof payload.tag === 'string' ? payload.tag : 'renderer';
    const message = typeof payload.message === 'string' ? payload.message : String(payload.message ?? '');
    append(level, tag, message, payload.meta);
  });

  ipcMain.handle('app-log-dir', (event) => {
    assertTrustedEvent(event);
    ensureLogDir();
    return logDir;
  });

  ipcMain.handle('open-app-log-dir', async (event) => {
    assertTrustedEvent(event);
    ensureLogDir();
    const err = await shell.openPath(logDir);
    return { ok: !err, path: logDir, error: err || undefined };
  });
}

/**
 * 须在 app.whenReady() 内调用（保证 getPath 可用）
 */
function init(ipcMain, shell, assertTrustedEvent) {
  ensureLogDir();
  writeSessionHeader();
  bindProcessHandlers();
  registerIpc(ipcMain, shell, assertTrustedEvent);

  // 开发包：在运行 Electron 的终端里打印路径（日志不在项目目录下）
  if (!app.isPackaged) {
    const todayFile = getTodayLogFilePath();
    console.log('\n======== GrainPrint 应用日志（开发环境）========');
    console.log('日志目录:', logDir);
    console.log('今日文件:', todayFile);
    console.log('提示: 菜单「帮助 → 打开日志文件夹」可打开目录');
    console.log('================================================\n');
    startDevMemorySampling();
  }

  // 退出前清掉定时器（仅开发环境会创建）
  app.once('before-quit', () => {
    stopDevMemorySampling();
  });
}

function getLogDir() {
  return ensureLogDir();
}

module.exports = {
  init,
  append,
  getLogDir,
  /** 调试用：手动打一条主进程内存 */
  logMainMemorySample,
  startDevMemorySampling,
  stopDevMemorySampling
};
