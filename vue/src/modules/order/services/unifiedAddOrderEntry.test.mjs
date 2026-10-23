import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const inbox = await readFile(
  new URL('../components/workbench/OrderFlowInbox.vue', import.meta.url),
  'utf8',
);
const workbench = await readFile(
  new URL('../views/OrderWorkbenchV2.vue', import.meta.url),
  'utf8',
);

assert.doesNotMatch(inbox, />追加订单<\/button>/);
assert.doesNotMatch(inbox, /\$emit\('continue-order'/);
assert.doesNotMatch(inbox, /iconAddOrder/);
assert.match(inbox, /@click="\$emit\('new-order', selectedCustomer\)"/);
assert.match(inbox, /为“\$\{customerName\(selectedCustomer\)\}”添加订单/);
assert.equal((inbox.match(/\$emit\('new-order'/g) || []).length, 1);
assert.match(inbox, /点击顶部“＋”添加订单/);
assert.match(workbench, /@new-order="openCreateOrder"/);
assert.match(
  workbench,
  /function openCreateOrder\(customer\) \{\s+wechatManualOrderReturnToken\.value = null;\s+activateCreateOrder\(customer\);\s+\}/,
);
assert.match(workbench, /createOrderWorkspaceSequence\.value \+= 1/);
assert.match(workbench, /customerContext\.selectCustomer\(matchingCustomer \|\| customer\)/);

console.log('unified add order entry tests passed');
