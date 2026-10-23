import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const workbench = read('vue/src/modules/order/views/OrderWorkbenchV2.vue');
const modal = read('vue/src/modules/order/components/workbench/WechatOrderImportModal.vue');
const preload = read('src/preload.js');
const main = read('src/main.js');
const gateway = read('src/dispatch/dispatch-gateway.js');

const removeTask = workbench.match(
  /async function removeWechatImport\(token, \{ markIgnored = !wechatBatchSaving\.value \} = \{\}\) \{([\s\S]*?)\n\}\n\nfunction normalizeObservedWechatConversationTitle/,
)?.[1] || '';
assert.match(removeTask, /await ensureWechatImportClaimed\(item\)/);
assert.match(removeTask, /api\.ignoreTasks\(\{ taskIds: \[taskId\] \}\)/);
assert.match(removeTask, /unwrapWechatServer\(response\)/);
assert.match(removeTask, /if \(!update\.removed\) return/);
assert.match(workbench, /markIgnored = !wechatBatchSaving\.value/);

assert.match(modal, /title="标记为已查看的非订单内容，后续读取不再重复出现"/);
assert.match(preload, /ignoreTasks: \(payload\) =>[\s\S]*?customer-wechat-task-v2-ignore/);
assert.match(main, /ipcMain\.handle\('customer-wechat-task-v2-ignore'/);
assert.match(gateway, /function ignoreWechatTasks\(input = \{\}\)/);
assert.match(gateway, /customer-wechat-orders\/tasks\/ignore/);

console.log('wechat task ignore flow tests passed');
