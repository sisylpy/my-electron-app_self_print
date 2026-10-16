import assert from 'node:assert/strict';
import fs from 'node:fs';

const workbench = fs.readFileSync(
  'vue/src/modules/order/views/OrderWorkbenchV2.vue',
  'utf8',
);

const allCustomerAction = workbench.match(
  /async function scanAllBoundWechatOrders\(options = \{\}\) \{([\s\S]*?)\n\}\n\nasync function handleTaskAdded/,
)?.[1] || '';

assert.match(allCustomerAction, /createWechatOrderTiming\('scan-all-bound-wechat'\)/);
assert.match(allCustomerAction, /scan-workspace-open/);
assert.match(allCustomerAction, /scan-customer-directory-load/);
assert.match(allCustomerAction, /readWechatCustomerDatabaseFirst/);
assert.match(allCustomerAction, /scan-database-fallback/);
assert.match(allCustomerAction, /scan-database-freshness/);
assert.match(allCustomerAction, /databaseResultCoversConversation/);
assert.match(allCustomerAction, /scan-conversation-focus/);
assert.match(allCustomerAction, /scan-binding-check/);
assert.match(allCustomerAction, /scan-order-read/);
assert.match(allCustomerAction, /mode === 'database' \? \[250, 500\] : \[250\]/);
assert.match(allCustomerAction, /scan-customer-complete/);
assert.match(allCustomerAction, /conversationTitle: title/);
assert.match(allCustomerAction, /customerName: wechatScanCustomerName\(row, title\)/);
assert.match(allCustomerAction, /ensureWechatBindingWithGroupMode\([\s\S]*?onTiming/);
assert.match(allCustomerAction, /prepareWechatOrderImport\([\s\S]*?onTiming/);
assert.match(allCustomerAction, /scan-results-ready/);
assert.doesNotMatch(allCustomerAction, /scan-first-import-open|openActiveWechatImport/);
assert.match(allCustomerAction, /scan-report-visible/);
assert.match(allCustomerAction, /timing\.finish\(timingOutcome, timingSummary\)/);
assert.match(allCustomerAction, /const automatic = options\?\.automatic === true/);
assert.match(allCustomerAction, /const shouldAutoSave = automatic \|\| window\.__grainAutoSaveWechatOrders/);
assert.match(allCustomerAction, /batchSaveAllWechatOrders\(\{ reportMode: 'merged' \}\)/);

const dismissReportAction = workbench.match(
  /async function dismissWechatScanReport\(\) \{([\s\S]*?)\n\}\n\nfunction messageFingerprints/,
)?.[1] || '';
assert.match(dismissReportAction, /wechatScanReportOpen\.value = false/);
assert.match(dismissReportAction, /await nextTick\(\)/);
assert.match(dismissReportAction, /openActiveWechatImport\(\{/);
assert.match(dismissReportAction, /openWorkspace: false/);
assert.match(dismissReportAction, /focusConversation: true/);

console.log('WeChat all-customer timing instrumentation passed');
