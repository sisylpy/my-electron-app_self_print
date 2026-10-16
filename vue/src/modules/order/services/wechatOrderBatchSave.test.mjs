import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync(
  'vue/src/modules/order/components/workbench/AiOrderPanel.vue',
  'utf8',
);
const controller = fs.readFileSync(
  'vue/src/modules/order/services/placeOrderController.js',
  'utf8',
);
const workbench = fs.readFileSync(
  'vue/src/modules/order/views/OrderWorkbenchV2.vue',
  'utf8',
);

const taskAdded = panel.match(
  /function handleTaskAdded\(event\) \{([\s\S]*?)\n\}\n\nfunction handleWechatTasksLoaded/,
)?.[1] || '';
assert.match(taskAdded, /if \(props\.batchSaveMode\)/);
assert.match(taskAdded, /appliedWechatImportToken\.value = null/);
assert.match(taskAdded, /emit\('task-added', token/);
assert.ok(
  taskAdded.indexOf('if (props.batchSaveMode)') < taskAdded.indexOf('const token = appliedWechatImportToken.value'),
  'batch save must suppress the stale manual-preview token before it is forwarded',
);

const batchSave = panel.match(
  /async function runWechatImportAndSave\(payload\) \{([\s\S]*?)\n\}\n\ndefineExpose/,
)?.[1] || '';
assert.match(batchSave, /appliedWechatImportToken\.value = null/);
assert.match(batchSave, /const autoSaved = await target\.applyWechatImport\(importPayload\)/);
assert.match(batchSave, /autoSaved && autoSaved\.taskId != null/);
assert.doesNotMatch(
  batchSave,
  /placeOrderRef\.value !== target[\s\S]*?applyWechatImport\(importPayload\)/,
  'an already submitted image must never be submitted again after a component switch',
);

const applyWechatImport = controller.match(
  /async applyWechatImport\(payload\) \{([\s\S]*?)\n            \},\n\n            \/\/ 停止所有正在进行的朗读/,
)?.[1] || '';
assert.match(applyWechatImport, /return this\.loadWechatOrderTask\(payload\)/);
assert.match(controller, /return this\.openWechatImageInOriginalRecognizer\(images\[0\], requestId, autoRecognize\)/);
assert.match(controller, /return this\.handleQwenAutoRecognize\(dataUrl\)/);

assert.match(workbench, /:batch-save-mode="wechatBatchSaving"/);
assert.match(workbench, /function onMcpWechatScan\(\)/);
assert.match(workbench, /function onMcpWechatSaveOrders\(\)/);
assert.match(workbench, /async function batchSaveAllWechatOrders/);
assert.match(workbench, /const outcome = await panel\.runWechatImportAndSave\(item\.payload\)/);
assert.match(workbench, /await removeWechatImport\(item\.token\)/);
assert.match(workbench, /const saveOutcome = await batchSaveAllWechatOrders\(\{ reportMode: 'merged' \}\)/);
assert.match(
  workbench,
  /async function handleOrderChanged\(change\) \{[\s\S]{0,500}?if \(wechatBatchSaving\.value\) return;/,
);
assert.match(
  workbench,
  /async function handleTaskAdded\(change\) \{[\s\S]{0,500}?if \(wechatBatchSaving\.value\) return;/,
);
assert.doesNotMatch(workbench, /仍走腾讯 OCR/);

console.log('wechatOrderBatchSave tests passed');
