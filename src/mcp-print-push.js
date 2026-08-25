/**
 * MCP 打印任务可靠投递。
 *
 * 只使用 webContents.send，不执行渲染进程脚本文本。渲染进程收到任务后通过
 * mcp-print-ack 回执；未收到回执时有限重试，App.vue 再按 taskId 去重。
 */
const MAX_DELIVERY_ATTEMPTS = 5;
const RETRY_DELAY_MS = 750;
const pendingDeliveries = new Map();

function deliveryKey(webContentsId, taskId) {
  return `${webContentsId}:${String(taskId)}`;
}

function clearDelivery(key) {
  const pending = pendingDeliveries.get(key);
  if (pending && pending.timer) {
    clearTimeout(pending.timer);
  }
  pendingDeliveries.delete(key);
}

function deliver(key) {
  const pending = pendingDeliveries.get(key);
  if (!pending) return;

  const { webContents, task } = pending;
  if (!webContents || webContents.isDestroyed()) {
    clearDelivery(key);
    return;
  }

  pending.attempts += 1;
  try {
    webContents.send('mcp-print-trigger', task);
  } catch (error) {
    console.warn('[MCP] IPC 打印任务发送失败:', error.message);
  }

  if (pending.attempts >= MAX_DELIVERY_ATTEMPTS) {
    console.error(
      '[MCP] 打印任务投递未收到回执，停止重试:',
      task.taskId,
      task.departmentName || ''
    );
    clearDelivery(key);
    return;
  }

  pending.timer = setTimeout(() => deliver(key), RETRY_DELAY_MS);
}

function pushMcpPrintTaskToRenderer(webContents, task) {
  if (!webContents || webContents.isDestroyed() || !task || task.taskId == null) {
    return false;
  }
  const key = deliveryKey(webContents.id, task.taskId);
  clearDelivery(key);
  pendingDeliveries.set(key, {
    webContents,
    task,
    attempts: 0,
    timer: null
  });
  deliver(key);
  return true;
}

function acknowledgeMcpPrintTask(webContentsId, taskId) {
  if (taskId == null) return false;
  const key = deliveryKey(webContentsId, taskId);
  if (!pendingDeliveries.has(key)) return false;
  clearDelivery(key);
  return true;
}

function clearMcpPrintDeliveriesForWebContents(webContentsId) {
  const prefix = `${webContentsId}:`;
  for (const key of pendingDeliveries.keys()) {
    if (key.startsWith(prefix)) {
      clearDelivery(key);
    }
  }
}

module.exports = {
  pushMcpPrintTaskToRenderer,
  acknowledgeMcpPrintTask,
  clearMcpPrintDeliveriesForWebContents
};
