import assert from 'node:assert/strict';
import fs from 'node:fs';

const workbench = fs.readFileSync(
  'vue/src/modules/order/views/OrderWorkbenchV2.vue',
  'utf8',
);
const modal = fs.readFileSync(
  'vue/src/modules/order/components/workbench/WechatOrderImportModal.vue',
  'utf8',
);

const openEntry = workbench.match(
  /async function handleWechatScan\(\) \{([\s\S]*?)\n\}\n\nasync function readUnreadWechatOrders/,
)?.[1] || '';
assert.match(openEntry, /wechatImportModalOpen\.value = true/);
assert.match(openEntry, /await openWechatWorkspace\(\)/);
assert.doesNotMatch(openEntry, /loadBoundWechatCustomers|readUnread|currentConversation/);

const unreadAction = workbench.match(
  /async function readUnreadWechatOrders\(\) \{([\s\S]*?)\n\}\n\nasync function handleTaskAdded/,
)?.[1] || '';
assert.match(unreadAction, /loadBoundWechatCustomers/);
assert.match(unreadAction, /loadBoundWechatCustomers\(\{ refreshCustomers: true \}\)/);
assert.match(unreadAction, /wechatUi\?\.readUnread/);
assert.match(unreadAction, /ensureWechatCustomerBinding/);
assert.match(workbench, /resolveWechatCustomerAssociation/);

assert.match(modal, /读未读订单/);
assert.match(modal, /查询现在选择的好友转订单/);
assert.match(modal, /\$emit\('scan-unread'\)/);
assert.match(modal, /页面不会自动扫描/);
assert.match(modal, /去跟客户匹配/);
assert.match(modal, /关联并继续转订单/);
assert.match(modal, /unmatchedConversationTitle/);

const selectedAction = workbench.match(
  /async function importSelectedWechatConversation\(\) \{([\s\S]*?)\n\}\n\nasync function openWechatCustomerMatcher/,
)?.[1] || '';
assert.match(selectedAction, /currentConversationApi\(\)/);
assert.match(selectedAction, /findWechatCustomerProfileMatches/);
assert.doesNotMatch(selectedAction, /loadBoundWechatCustomers|allowedTitles/);
assert.match(workbench, /async function importWechatConversationForCustomer/);
assert.match(workbench, /loadCustomerWechatBinding\(customerId\(customer\)\)/);

console.log('WeChat order workspace entry passed');
