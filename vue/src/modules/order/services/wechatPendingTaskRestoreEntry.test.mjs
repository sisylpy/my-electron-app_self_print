import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workbench = fs.readFileSync(
  'vue/src/modules/order/views/OrderWorkbenchV2.vue',
  'utf8',
);

test('重新打开微信订单时先恢复服务端未保存任务', () => {
  const entry = workbench.match(
    /async function handleWechatScan\(\) \{([\s\S]*?)\n\}\n\nasync function readUnreadWechatOrders/,
  )?.[1] || '';
  const restoreAt = entry.indexOf('await restoreWechatDraftTasks({ surfaceError: true })');
  const openExistingAt = entry.indexOf('if (wechatImportQueue.value.length)');
  assert.ok(restoreAt >= 0, '入口必须恢复服务端待确认任务');
  assert.ok(openExistingAt > restoreAt, '必须先恢复任务，再决定是否进入任务工作台');
});

test('恢复图片任务时保留消息级任务身份，不能合并两张图片', () => {
  const restore = workbench.match(
    /async function restoreWechatDraftTasks\([\s\S]*?\n\}\n\n\/\/ 由 MCP/,
  )?.[0] || '';
  assert.match(restore, /taskType === 'image'[\s\S]*?taskFingerprint:/);
  assert.match(restore, /messages\[0\]\?\.messageFingerprint/);
});
