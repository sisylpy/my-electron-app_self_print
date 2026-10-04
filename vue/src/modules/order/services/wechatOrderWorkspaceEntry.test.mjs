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
assert.doesNotMatch(openEntry, /refreshWechatLauncherSummary|loadBoundWechatCustomers|inspectUnread/);
assert.match(
  openEntry,
  /await openActiveWechatImport\(\{ openWorkspace: true, focusConversation: false \}\)/,
);
assert.doesNotMatch(openEntry, /await openActiveWechatImport\(\);/);
assert.doesNotMatch(openEntry, /loadBoundWechatCustomers|readUnread|currentConversation/);

const closeEntry = workbench.match(
  /async function closeWechatImportModal\(\) \{([\s\S]*?)\n\}\n\nonBeforeUnmount/,
)?.[1] || '';
assert.match(closeEntry, /const shouldCloseWechatWorkspace = wechatWorkspaceReady\.value/);
assert.match(closeEntry, /if \(!shouldCloseWechatWorkspace\) return/);

const unreadAction = workbench.match(
  /async function readUnreadWechatOrders\(\) \{([\s\S]*?)\n\}\n\nasync function scanAllBoundWechatOrders/,
)?.[1] || '';
assert.match(unreadAction, /loadBoundWechatCustomers/);
assert.match(unreadAction, /loadBoundWechatCustomers\(\{ refreshCustomers: true \}\)/);
assert.match(unreadAction, /wechatUi\?\.readUnread/);
assert.match(unreadAction, /ensureWechatBindingWithGroupMode/);
assert.match(workbench, /resolveWechatCustomerAssociation/);

assert.match(modal, /读取未读订单/);
assert.match(modal, /读取当前微信/);
assert.match(modal, /launcherCurrentTitle/);
assert.match(modal, /selectedImportBusyTitle/);
assert.match(modal, /正在识别“\$\{props\.launcherCurrentTitle\}”/);
assert.match(modal, /正在查找“\$\{props\.launcherCurrentTitle\}”关联的客户/);
assert.doesNotMatch(modal, /正在识别当前微信好友/);
assert.match(modal, /检查已关联微信/);
assert.doesNotMatch(modal, /launcherUnreadCount|launcherCustomerCount|launcherSummaryLoading/);
assert.match(workbench, /:launcher-current-title="observedWechatConversationTitle"/);
assert.doesNotMatch(workbench, /wechatLauncherUnreadCount|wechatLauncherCustomerCount|refreshWechatLauncherSummary/);
assert.match(modal, /\$emit\('scan-unread'\)/);
assert.match(modal, /\$emit\('scan-all'\)/);
assert.match(modal, /重新检查全部/);
assert.match(modal, /重新逐个检查全部已关联微信/);
assert.match(modal, /scanReportOpen/);
assert.match(modal, /实时查询结果/);
assert.match(modal, /自动化正在执行/);
assert.match(modal, /\$emit\('dismiss-scan-report'\)/);
assert.match(modal, /选择一种方式，把微信里的订货内容同步到农心乐配送商系统/);
assert.match(modal, /开始读取未读订单/);
assert.match(modal, /读取当前聊天订单/);
assert.match(modal, /开始全面检查/);
assert.match(modal, /日常收单优先使用“读取未读订单”/);
assert.match(modal, /wechat-import-modal__choice-visual/);
assert.match(modal, /wechat-import-modal__launcher-tips/);
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
assert.match(selectedAction, /current-conversation-cache-corrected/);
assert.doesNotMatch(selectedAction, /current-conversation-cached/);
assert.match(selectedAction, /findWechatCustomerProfileMatches/);
assert.match(selectedAction, /createWechatOrderTiming\('read-selected-wechat'\)/);
assert.match(selectedAction, /waitForWechatConfirmationPaint\(\)/);
assert.match(selectedAction, /confirmation-page-visible/);
assert.doesNotMatch(selectedAction, /loadBoundWechatCustomers|allowedTitles/);
assert.match(workbench, /async function importWechatConversationForCustomer/);
assert.match(workbench, /loadCustomerWechatBinding\(selectedCustomerId\)/);
assert.match(workbench, /writeAppLog\('info', 'wechat-order-timing', 'phase'/);
assert.match(workbench, /writeAppLog\(outcome === 'success' \? 'info' : 'warn', 'wechat-order-timing', 'summary'/);

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
assert.match(allCustomerAction, /readWechatCustomerDatabaseFirst/);
assert.match(allCustomerAction, /mode === 'database' \? \[250, 500\] : \[250\]/);
assert.doesNotMatch(allCustomerAction, /wechatImportQueue\.value = \[\]/);
assert.doesNotMatch(allCustomerAction, /wechatImportBatch\.value = \[\]/);
assert.match(allCustomerAction, /enqueueWechatImportItems\(result\.imports, \{ activate: false \}\)/);
assert.match(allCustomerAction, /已保留当前 \$\{preservedTaskCount\} 个未保存任务/);
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
