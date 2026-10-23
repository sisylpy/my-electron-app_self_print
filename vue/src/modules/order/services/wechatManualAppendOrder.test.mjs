import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modal = await readFile(
  new URL('../components/workbench/WechatOrderImportModal.vue', import.meta.url),
  'utf8',
);
const panel = await readFile(
  new URL('../components/workbench/AiOrderPanel.vue', import.meta.url),
  'utf8',
);
const workbench = await readFile(
  new URL('../views/OrderWorkbenchV2.vue', import.meta.url),
  'utf8',
);

assert.match(modal, />追加订单<\/button>/);
assert.match(modal, /\$emit\('append-order'\)/);
assert.match(modal, /v-if="actionStatus !== 'success'"[\s\S]*?\$emit\('append-order'\)[\s\S]*?>追加订单<\/button>/);
assert.match(workbench, /@append-order="openWechatManualOrder"/);
assert.match(workbench, /function openWechatManualOrder\(\)/);
assert.match(workbench, /selectedWechatConversation\.value\?\.customer/);
assert.match(workbench, /findWechatCustomerProfileMatches\(customerContext\.customers\.value, title\)/);
assert.match(workbench, /if \(customer\) returnToken = item\.token/);
assert.match(workbench, /wechatManualOrderReturnToken\.value = returnToken/);
assert.match(workbench, /wechatManualOrderReturnToken\.value = returnToken;\s+dismissWechatSelectedAction\(\)/);
assert.match(workbench, /activateCreateOrder\(customer\)/);
assert.match(workbench, /:key="`create-order-\$\{createOrderWorkspaceSequence\}`"/);
assert.match(workbench, /createOrderWorkspaceSequence\.value \+= 1/);
assert.match(workbench, /function handleCreateOrderBack\(\)/);
assert.match(workbench, /if \(returnToken === null\)/);
assert.match(workbench, /wechatImportModalOpen\.value = true/);
assert.match(panel, /\{\{ returnLabel \}\}/);
assert.match(panel, /returnLabel: \{ type: String, default: '返回订单主页' \}/);

console.log('wechat manual append order tests passed');
