import assert from 'node:assert/strict';
import fs from 'node:fs';

const workbench = fs.readFileSync(
  'vue/src/modules/order/views/OrderWorkbenchV2.vue',
  'utf8',
);

const allCustomerAction = workbench.match(
  /async function scanAllBoundWechatOrders\(\) \{([\s\S]*?)\n\}\n\nasync function handleTaskAdded/,
)?.[1] || '';

assert.match(allCustomerAction, /createWechatOrderTiming\('scan-all-bound-wechat'\)/);
assert.match(allCustomerAction, /scan-workspace-open/);
assert.match(allCustomerAction, /scan-customer-directory-load/);
assert.match(allCustomerAction, /scan-conversation-focus/);
assert.match(allCustomerAction, /scan-binding-check/);
assert.match(allCustomerAction, /scan-order-read/);
assert.match(allCustomerAction, /scan-customer-complete/);
assert.match(allCustomerAction, /conversationTitle: title/);
assert.match(allCustomerAction, /customerName: wechatScanCustomerName\(row, title\)/);
assert.match(allCustomerAction, /ensureWechatBindingWithGroupMode\([\s\S]*?onTiming/);
assert.match(allCustomerAction, /prepareWechatOrderImport\([\s\S]*?onTiming/);
assert.match(allCustomerAction, /scan-report-visible/);
assert.match(allCustomerAction, /timing\.finish\(timingOutcome, timingSummary\)/);

console.log('WeChat all-customer timing instrumentation passed');
