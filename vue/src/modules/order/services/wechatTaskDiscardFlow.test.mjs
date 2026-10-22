import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const workbench = read('vue/src/modules/order/views/OrderWorkbenchV2.vue');
const modal = read('vue/src/modules/order/components/workbench/WechatOrderImportModal.vue');
const preload = read('src/preload.js');
const main = read('src/main.js');
const gateway = read('src/dispatch/dispatch-gateway.js');

const discard = workbench.match(
  /async function discardWechatImportSession\(\) \{([\s\S]*?)\n\}\n\nfunction resetWechatImportModalState/,
)?.[1] || '';
assert.match(discard, /wechatImportQueue\.value/);
assert.match(discard, /customerWechatOrders\?\.discardTasks\?\.\(\{ taskIds \}\)/);
assert.match(discard, /unwrapWechatServer\(response\)/);
assert.match(discard, /wechatImportQueue\.value = \[\]/);

const nativeClose = workbench.match(
  /onWorkspaceCloseRequested\?\.\(async \(\) => \{([\s\S]*?)\n  \}\);/,
)?.[1] || '';
assert.match(nativeClose, /await discardWechatImportSession\(\)/);

const later = workbench.match(
  /async function closeWechatImportModal\(\) \{([\s\S]*?)\n\}\n\nonBeforeUnmount/,
)?.[1] || '';
assert.doesNotMatch(later, /discardWechatImportSession/);
assert.match(modal, /class="wechat-import-modal__later"[\s\S]*?@click="\$emit\('close'\)"/);

assert.match(preload, /discardTasks: \(payload\) =>[\s\S]*?customer-wechat-task-v2-discard/);
assert.match(main, /ipcMain\.handle\('customer-wechat-task-v2-discard'/);
assert.match(gateway, /function discardWechatTasks\(input = \{\}\)/);
assert.match(gateway, /customer-wechat-orders\/tasks\/discard/);

console.log('wechat task discard flow tests passed');
