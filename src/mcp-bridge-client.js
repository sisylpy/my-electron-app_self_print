'use strict';
// GrainPrint 任务通信层：与本地 MCP 桥（grain-print-mcp 服务，仅 127.0.0.1:3011）安全通信。
// 职责边界：仅负责 身份上报 / 心跳 / 领取任务 / 结果回传 / 执行端防重复。
// 不重写打印业务（模板、渲染、出纸仍由 GrainPrint 既有逻辑完成）。
//
// 可测试性：electron 仅在运行时惰性 require，且提供环境变量注入点
// （GRAIN_EXECUTED_STORE_PATH / GRAIN_LOCAL_DIS_ID），便于在纯 Node 下执行真实客户端逻辑。
// 移植自 GrainPrint 临时副本 src/mcp-bridge-client.js，按 ai-priter-electric 真工程结构放置。
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

// 惰性获取 electron app（非 electron 环境如测试下不会触发）
function electronApp() {
  try { return require('electron').app; } catch (e) { return null; }
}

// 桥端口选择：显式 GRAIN_BRIDGE_PORT 优先；否则统一默认 3011。
// 3011 是 grain-print-connector 本地桥端口，开发模式（`npm run start`）与
// 正式打包版（GrainPrint.app）共用，保证「装好正式版 → 连接器直接连通」，无需手带环境变量。
// 与已废弃的 3010（旧打包版）不再混用，避免桌面端与桥端口错配导致「GrainPrint 未连接」。
function defaultBridgePort() {
  if (process.env.GRAIN_BRIDGE_PORT) return Number(process.env.GRAIN_BRIDGE_PORT);
  return 3011;
}

const DEFAULT_PORT = defaultBridgePort();
const SECRET_PATH = process.env.GRAIN_BRIDGE_SECRET_PATH ||
  path.join(os.homedir(), '.grain-print-mcp', 'bridge-secret');

function readSecret() {
  try { return fs.readFileSync(SECRET_PATH, 'utf8').trim(); } catch (e) { return null; }
}

// 执行端防重复：本地持久记录已执行的任务 id（进程重启后依然有效）。
function executedStorePath() {
  if (process.env.GRAIN_EXECUTED_STORE_PATH) return process.env.GRAIN_EXECUTED_STORE_PATH;
  const app = electronApp();
  if (app && typeof app.getPath === 'function') {
    try { return path.join(app.getPath('userData'), 'grain-print-executed.json'); }
    catch (e) { /* fallthrough */ }
  }
  return path.join(os.tmpdir(), 'grain-print-executed.json');
}
function loadExecuted() {
  try { return new Set(JSON.parse(fs.readFileSync(executedStorePath(), 'utf8'))); } catch (e) { return new Set(); }
}
function saveExecuted(set) {
  try { fs.writeFileSync(executedStorePath(), JSON.stringify([...set]), { mode: 0o600 }); } catch (e) { /* ignore */ }
}
// 返回 true 表示首次执行（需打印）；false 表示已执行过（防重复）。
function markExecuted(taskId) {
  const s = loadExecuted();
  if (s.has(taskId)) return false;
  s.add(taskId); saveExecuted(s); return true;
}

function postJSON(pathname, body, secret) {
  return new Promise((resolve) => {
    if (!secret) { resolve({ ok: false, error: 'no-secret' }); return; }
    const data = JSON.stringify(body || {});
    const req = http.request({
      host: '127.0.0.1', port: DEFAULT_PORT, path: pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bridge-Secret': secret },
    }, (res) => {
      let b = ''; res.on('data', (c) => (b += c));
      res.on('end', () => resolve({ ok: res.statusCode < 400, status: res.statusCode, body: b }));
    });
    req.on('error', () => resolve({ ok: false, error: 'req-error' }));
    req.setTimeout(2000, () => req.destroy());
    req.write(data); req.end();
  });
}
function getJSON(pathname, secret) {
  return new Promise((resolve) => {
    if (!secret) { resolve({ ok: false, error: 'no-secret' }); return; }
    const req = http.request({
      host: '127.0.0.1', port: DEFAULT_PORT, path: pathname, method: 'GET',
      headers: { 'X-Bridge-Secret': secret },
    }, (res) => {
      let b = ''; res.on('data', (c) => (b += c));
      res.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) { /* ignore */ } resolve({ ok: res.statusCode < 400, json: j }); });
    });
    req.on('error', () => resolve({ ok: false, error: 'req-error' }));
    req.setTimeout(2000, () => req.destroy());
    req.end();
  });
}

// 读取 GrainPrint 当前登录的配送商身份（与连接器凭证做一致性校验）。
// 测试可通过 GRAIN_LOCAL_DIS_ID 注入，避免依赖 electron 渲染进程。
function getLoggedInDisId() {
  if (process.env.GRAIN_LOCAL_DIS_ID) {
    return Promise.resolve(String(process.env.GRAIN_LOCAL_DIS_ID));
  }
  return new Promise((resolve) => {
    let BrowserWindow = null;
    try { BrowserWindow = require('electron').BrowserWindow; } catch (e) { resolve(null); return; }
    const win = (BrowserWindow.getAllWindows() || [])[0];
    if (!win || win.isDestroyed()) { resolve(null); return; }
    win.webContents.executeJavaScript(
      "(function(){try{var d=localStorage.getItem('disUser');if(d){var o=JSON.parse(d);return o.nxDiuDistributerId!=null?String(o.nxDiuDistributerId):null;}return null;}catch(e){return null;}})()"
    ).then((v) => resolve(v || null)).catch(() => resolve(null));
  });
}

async function reportIdentity(disId, printerAvailable, wechat) {
  const secret = readSecret();
  if (!secret) return;
  await postJSON('/bridge/identity', {
    disId: String(disId),
    printerAvailable: !!printerAvailable,
    version: '1.0.0',
    wechat: wechat || null,
  }, secret);
}
async function reportHeartbeat() {
  const secret = readSecret();
  if (!secret) return;
  await postJSON('/bridge/heartbeat', {}, secret);
}
async function fetchTasks(disId) {
  const secret = readSecret();
  if (!secret) return [];
  const r = await getJSON('/bridge/tasks?disId=' + encodeURIComponent(disId), secret);
  if (!r.ok || !r.json) return [];
  return r.json.tasks || [];
}

async function getBridgeStatus() {
  const secret = readSecret();
  if (!secret) return { ok: false, port: DEFAULT_PORT, error: 'no-secret' };
  const result = await getJSON('/bridge/tasks?disId=0', secret);
  return {
    ok: Boolean(result.ok && result.json && Array.isArray(result.json.tasks)),
    port: DEFAULT_PORT,
    error: result.error || null,
  };
}
async function reportResult(taskId, success, message) {
  const secret = readSecret();
  if (!secret || !taskId) return;
  await postJSON('/bridge/task/' + encodeURIComponent(taskId) + '/result', { success: !!success, message: message || '' }, secret);
}

// GrainPrint 领取任务后上报「已受理」：使任务状态 pending → accepted（受理≠完成）。
async function acceptTask(taskId) {
  const secret = readSecret();
  if (!secret || !taskId) return;
  await postJSON('/bridge/task/' + encodeURIComponent(taskId) + '/accept', {}, secret);
}

module.exports = {
  getLoggedInDisId, getBridgeStatus, reportIdentity, reportHeartbeat, fetchTasks, reportResult, acceptTask, markExecuted,
  DEFAULT_PORT, SECRET_PATH,
};
