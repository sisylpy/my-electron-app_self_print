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
assert.match(openEntry, /refreshWechatLauncherSummary/);
assert.match(
  openEntry,
  /await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: false \}\)/,
);
assert.doesNotMatch(openEntry, /await openActiveWechatImport\(\);/);
assert.doesNotMatch(openEntry, /loadBoundWechatCustomers|readUnread|currentConversation/);

const closeEntry = workbench.match(
  /async function closeWechatImportModal\(\) \{([\s\S]*?)\n\}\n\nonBeforeUnmount/,
)?.[1] || '';
assert.match(closeEntry, /const shouldCloseWechatWorkspace = wechatWorkspaceReady\.value/);
assert.match(closeEntry, /if \(!shouldCloseWechatWorkspace\) return/);

const unreadAction = workbench.match(
  /async function readUnreadWechatOrders\(\) \{([\s\S]*?)\n\}\n\nasync function handleTaskAdded/,
)?.[1] || '';
assert.match(unreadAction, /loadBoundWechatCustomers/);
assert.match(unreadAction, /loadBoundWechatCustomers\(\{ refreshCustomers: true \}\)/);
assert.match(unreadAction, /wechatUi\?\.readUnread/);
assert.match(unreadAction, /ensureWechatBindingWithGroupMode/);
assert.match(workbench, /resolveWechatCustomerAssociation/);

assert.match(modal, /查看未读订单/);
assert.match(modal, /读取当前微信/);
assert.match(modal, /当前没有未读客户/);
assert.match(modal, /launcherUnreadCount === 0/);
assert.match(modal, /launcherCurrentTitle/);
assert.match(modal, /检查 \$\{props\.launcherCustomerCount\} 位微信客户/);
assert.match(workbench, /:launcher-unread-count="wechatLauncherUnreadCount"/);
assert.match(workbench, /:launcher-current-title="wechatLauncherConversationTitle"/);
assert.match(workbench, /:launcher-customer-count="wechatLauncherCustomerCount"/);
assert.match(workbench, /wechatUi\?\.inspectUnread/);
assert.match(modal, /\$emit\('scan-unread'\)/);
assert.match(modal, /\$emit\('scan-all'\)/);
assert.match(modal, /scanReportOpen/);
assert.match(modal, /实时查询结果/);
assert.match(modal, /自动化正在执行/);
assert.match(modal, /\$emit\('dismiss-scan-report'\)/);
assert.match(modal, /这次要检查哪些微信/);
assert.match(modal, /去跟客户匹配/);
assert.match(modal, /关联并继续转订单/);
assert.match(modal, /unmatchedConversationTitle/);
assert.match(modal, /选择群订单接收方式/);
assert.match(modal, /ALL_MEMBER_MESSAGES/);
assert.match(modal, /MENTION_SELF_ONLY/);
assert.match(modal, /showSelectedImportAction && \(items\.length \|\| activeItem\)/);
assert.match(workbench, /:show-selected-import-action="showCurrentWechatReadButton"/);
assert.match(workbench, /WECHAT_GROUP_MODE_REQUIRED/);
assert.match(workbench, /ensureWechatBindingWithGroupMode/);

const selectedAction = workbench.match(
  /async function importSelectedWechatConversation\(\) \{([\s\S]*?)\n\}\n\nasync function openWechatCustomerMatcher/,
)?.[1] || '';
assert.match(selectedAction, /currentConversationApi\(\)/);
assert.match(selectedAction, /findWechatCustomerProfileMatches/);
assert.doesNotMatch(selectedAction, /loadBoundWechatCustomers|allowedTitles/);
assert.match(workbench, /async function importWechatConversationForCustomer/);
assert.match(workbench, /loadCustomerWechatBinding\(customerId\(customer\)\)/);

const allCustomerAction = workbench.match(
  /async function scanAllBoundWechatOrders\(\) \{([\s\S]*?)\n\}\n\nasync function handleTaskAdded/,
)?.[1] || '';
assert.match(allCustomerAction, /loadBoundWechatCustomers\(\{ refreshCustomers: true \}\)/);
assert.match(allCustomerAction, /scanAllBoundWechatCustomers/);
assert.match(allCustomerAction, /beginWechatScanReport/);
assert.match(allCustomerAction, /beginWechatScanStep/);
assert.match(allCustomerAction, /onResult/);
assert.match(allCustomerAction, /completeWechatScanStep/);
assert.match(allCustomerAction, /focusWechatImportConversation/);
assert.match(allCustomerAction, /ensureWechatBindingWithGroupMode/);
assert.match(allCustomerAction, /prepareWechatOrderImport/);
assert.match(allCustomerAction, /retryDelaysMs: \[250\]/);
assert.match(workbench, /@scan-all="scanAllBoundWechatOrders"/);

const selectTaskAction = workbench.match(
  /async function selectWechatImport\(token\) \{([\s\S]*?)\n\}\n\nasync function removeWechatImport/,
)?.[1] || '';
assert.match(selectTaskAction, /activeWechatImportToken\.value = item\.token/);
assert.match(
  selectTaskAction,
  /await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: true \}\)/,
);
assert.doesNotMatch(selectTaskAction, /item\.token === activeWechatImport\.value\?\.token/);

const desktopSelectionAction = workbench.match(
  /async function syncWechatSelectionFromDesktop\(payload\) \{([\s\S]*?)\n\}\n\nconst removeWechatConversationListener/,
)?.[1] || '';
assert.match(workbench, /onConversationChanged/);
assert.match(desktopSelectionAction, /observedWechatConversationTitle\.value = title/);
assert.match(desktopSelectionAction, /activeWechatImportToken\.value = matchingItem\.token/);
assert.match(
  desktopSelectionAction,
  /await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: false \}\)/,
);

console.log('WeChat order workspace entry passed');
