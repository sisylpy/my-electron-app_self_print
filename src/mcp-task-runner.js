'use strict';
// 任务领取与受理编排（从 main.js 抽出，便于独立测试；不依赖 electron、不改动打印业务）。
// 职责边界：
//  - 校验「连接器授权配送商 == GrainPrint 当前登录会话」一致性；
//  - 执行端防重复（markExecuted）；
//  - 上报「已受理」（acceptTask，使 pending → accepted，受理≠完成可查询）；
//  - 下发渲染进程触发既有出纸链路。
// 注意：实际出纸结果由 GrainPrint 打印回调（printContentToWindowWithCallback）回传，
//       本模块不负责上报结果，也不在轮询中自动重打——避免「结果不确定时自动重打」。
// 移植自 GrainPrint 临时副本 src/mcp-task-runner.js，按 ai-priter-electric 真工程结构放置。

// 处理单个任务：一致性校验 → 防重复 → 受理 → 下发。返回 {accepted} 或 {skipped}。
async function processTask(task, deps) {
  const taskId = task.taskId || task.id;
  const loginDisId = await deps.getLoggedInDisId();
  if (!loginDisId) return { skipped: 'no-login' };
  // 连接器授权配送商必须与 GrainPrint 当前登录会话一致，否则拒绝执行（防越权打印他人订单）
  if (String(task.disId) !== String(loginDisId)) {
    return { skipped: 'disId-mismatch' };
  }
  // 执行端防重复：已执行过的任务不再出纸（进程重启后仍有效）
  const first = deps.markExecuted(taskId);
  if (!first) return { skipped: 'already-executed' };
  // 上报「已受理」：状态 pending → accepted，使受理≠完成可查询
  await deps.acceptTask(taskId);
  // 下发渲染进程（实际出纸由既有链路完成；结果由打印回调回传）
  await deps.pushToRenderer(task);
  return { accepted: true, taskId };
}

// 一次轮询周期：身份/心跳上报 → 拉取任务 → 逐个受理下发。仅依赖注入项，便于测试替换最终出纸。
async function pollOnce(deps) {
  const loginDisId = await deps.getLoggedInDisId();
  if (!loginDisId) return { fetched: 0, reason: 'no-login' };
  const printerAvailable = !!(deps.getDefaultPrinterName && deps.getDefaultPrinterName());
  await deps.reportIdentity(loginDisId, printerAvailable);
  await deps.reportHeartbeat();
  const tasks = await deps.fetchTasks(loginDisId);
  if (!Array.isArray(tasks)) return { fetched: 0 };
  let accepted = 0;
  let skipped = 0;
  for (const task of tasks) {
    const r = await processTask(task, deps);
    if (r && r.accepted) accepted++;
    else skipped++;
  }
  return { fetched: tasks.length, accepted, skipped };
}

module.exports = { processTask, pollOnce };
