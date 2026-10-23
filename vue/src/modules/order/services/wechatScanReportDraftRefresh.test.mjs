import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workbench = fs.readFileSync(
  'vue/src/modules/order/views/OrderWorkbenchV2.vue',
  'utf8',
);

test('全面检查合并任务时保留仅新增消息供关闭报告后刷新', () => {
  const enqueue = workbench.match(
    /function enqueueWechatImportItems\([\s\S]*?\n\}\n\nasync function enqueueWechatImport/,
  )?.[0] || '';

  assert.match(enqueue, /selectPendingWechatRefreshPayload\(/);
  assert.match(enqueue, /pendingRefreshPayload/);
  assert.match(enqueue, /pendingMessageCount:/);
});

test('关闭全面检查报告后只追加新消息并清除待刷新标记', () => {
  const dismiss = workbench.match(
    /async function dismissWechatScanReport\([\s\S]*?\n\}\n\nfunction messageFingerprints/,
  )?.[0] || '';

  assert.match(dismiss, /appendWechatImport\?\.\(/);
  assert.match(dismiss, /incrementalPayload/);
  assert.match(dismiss, /pendingRefreshPayload: null/);
  assert.match(dismiss, /pendingMessageCount: 0/);
});
