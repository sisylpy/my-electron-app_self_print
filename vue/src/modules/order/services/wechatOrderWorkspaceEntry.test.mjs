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
const workspaceWindowService = fs.readFileSync(
  'src/wechat/workspace-window-service.js',
  'utf8',
);
const mainProcess = fs.readFileSync('src/main.js', 'utf8');
const preload = fs.readFileSync('src/preload.js', 'utf8');

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
assert.doesNotMatch(openEntry, /loadBoundWechatCustomers|readUnread/);
assert.match(openEntry, /void refreshObservedWechatConversation\(\{ force: true \}\)/);
assert.doesNotMatch(openEntry, /await refreshObservedWechatConversation/);

const closeEntry = workbench.match(
  /async function closeWechatImportModal\(\) \{([\s\S]*?)\n\}\n\nonBeforeUnmount/,
)?.[1] || '';
assert.match(closeEntry, /const shouldCloseWechatWorkspace = wechatWorkspaceReady\.value/);
assert.match(closeEntry, /resetWechatImportModalState\(\)/);
assert.match(closeEntry, /if \(!shouldCloseWechatWorkspace\) return/);
assert.doesNotMatch(closeEntry, /discardWechatImportSession\(\)/);
assert.match(workbench, /onWorkspaceCloseRequested/);
assert.match(workbench, /removeWechatWorkspaceCloseRequestedListener/);
assert.match(workbench, /function resetWechatImportModalState\(\)/);

const discardEntry = workbench.match(
  /function discardWechatImportSession\(\) \{([\s\S]*?)\n\}\n\nfunction resetWechatImportModalState/,
)?.[1] || '';
assert.match(discardEntry, /dismissPendingWechatImport/);
assert.match(discardEntry, /wechatImportQueue\.value = \[\]/);
assert.match(discardEntry, /wechatImportBatch\.value = \[\]/);
assert.match(discardEntry, /wechatImportCompletedTokens\.value = \[\]/);
assert.match(discardEntry, /activeWechatImportToken\.value = null/);
assert.match(discardEntry, /wechatScanResults\.value = \[\]/);

const nativeCloseEntry = workbench.match(
  /onWorkspaceCloseRequested\?\.\(\(\) => \{([\s\S]*?)\n  \}\);/,
)?.[1] || '';
assert.match(nativeCloseEntry, /discardWechatImportSession\(\)/);
assert.match(nativeCloseEntry, /resetWechatImportModalState\(\)/);

const unreadAction = workbench.match(
  /async function readUnreadWechatOrders\(\) \{([\s\S]*?)\n\}\n\nasync function scanAllBoundWechatOrders/,
)?.[1] || '';
assert.match(unreadAction, /loadBoundWechatCustomers/);
assert.match(unreadAction, /loadBoundWechatCustomers\(\{ refreshCustomers: true \}\)/);
assert.match(unreadAction, /wechatUi\?\.readUnread/);
assert.match(unreadAction, /ensureWechatBindingFromCustomerProfile/);
assert.match(workbench, /resolveWechatCustomerAssociation/);

assert.match(modal, /读取未读订单/);
assert.match(modal, /读取当前微信/);
assert.match(modal, /launcherCurrentTitle/);
assert.match(modal, /launcherCurrentAvatar/);
assert.match(modal, /wechat-import-modal__selected-avatar/);
assert.match(modal, /item\.conversationAvatar/);
assert.match(modal, /activeItem\.conversationAvatar/);
assert.match(modal, /workspaceWarning \|\| activeItem\.refreshError \|\| activeItem\.refreshNote/);
assert.match(
  modal,
  /wechat-import-modal__result-icon[\s\S]*?item\.conversationAvatar[\s\S]*?scanResultSymbol\(item\)/,
);
assert.match(modal, /hideBrokenAvatar/);
assert.match(modal, /selectedImportBusyTitle/);
assert.match(modal, /正在识别“\$\{props\.launcherCurrentTitle\}”/);
assert.match(modal, /正在查找“\$\{props\.launcherCurrentTitle\}”关联的客户/);
assert.doesNotMatch(modal, /正在识别当前微信好友/);
assert.match(workbench, /:conversation-switching="wechatConversationSwitching"/);
assert.match(workbench, /:conversation-switching-title="wechatConversationSwitchingTitle"/);
assert.doesNotMatch(modal, /v-if="conversationSwitching && !busy"/);
assert.doesNotMatch(modal, /正在切换微信会话/);
assert.doesNotMatch(modal, /完成前请稍候，不要重复操作/);
assert.match(modal, /if \(props\.conversationSwitching\) return/);
assert.match(modal, /检查已关联微信/);
assert.doesNotMatch(modal, /launcherUnreadCount|launcherCustomerCount|launcherSummaryLoading/);
assert.match(workbench, /:launcher-current-title="observedWechatConversationTitle"/);
assert.match(workbench, /:launcher-current-avatar="observedWechatConversationAvatar"/);
assert.match(workbench, /normalizeObservedWechatConversationAvatar/);
assert.match(workbench, /payload\?\.avatarDataUrl/);
assert.match(workbench, /resolveWechatConversationAvatar/);
assert.match(workbench, /conversationAvatar/);
assert.match(workbench, /item\?\.conversationTitle \|\| item\?\.title/);
assert.match(workbench, /wechatScanResults\.value = wechatScanResults\.value\.map\(addAvatar\)/);
assert.doesNotMatch(workbench, /wechatLauncherUnreadCount|wechatLauncherCustomerCount|refreshWechatLauncherSummary/);
assert.match(modal, /\$emit\('scan-unread'\)/);
assert.match(modal, /\$emit\('scan-all'\)/);
assert.match(modal, /重新检查全部/);
assert.match(modal, /重新逐个检查全部已关联微信/);
const modalHeaderStart = modal.indexOf('<header class="wechat-import-modal__header">');
const modalHeaderEnd = modal.indexOf('</header>', modalHeaderStart);
const rescanButtonIndex = modal.indexOf('class="wechat-import-modal__rescan-all"');
assert.ok(rescanButtonIndex > modalHeaderStart && rescanButtonIndex < modalHeaderEnd);
assert.equal((modal.match(/class="wechat-import-modal__rescan-all"/g) || []).length, 1);
assert.match(modal, /scanReportOpen/);
assert.match(modal, /实时查询结果/);
assert.match(modal, /自动化正在执行/);
assert.match(modal, /\$emit\('dismiss-scan-report'\)/);
const dismissScanReportAction = workbench.match(
  /async function dismissWechatScanReport\(\) \{([\s\S]*?)\n\}/,
)?.[1] || '';
assert.match(dismissScanReportAction, /wechatScanReportOpen\.value = false/);
assert.match(dismissScanReportAction, /WECHAT_SCAN_REPORT_LEAVE_MS/);
assert.match(dismissScanReportAction, /await openActiveWechatImport/);
assert.match(modal, /选择一种方式，把微信里的订货内容同步到农心乐配送商系统/);
assert.match(modal, /开始读取未读订单/);
assert.match(modal, /读取当前聊天订单/);
assert.match(modal, /开始全面检查/);
assert.match(modal, /日常收单优先使用“读取未读订单”/);
assert.match(modal, /wechat-import-modal__choice-visual/);
assert.match(modal, /wechat-import-modal__launcher-tips/);
assert.match(
  modal,
  /@media \(max-width: 760px\)[\s\S]*?wechat-import-modal__launcher-actions \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/,
);
assert.match(
  modal,
  /@media \(max-width: 760px\)[\s\S]*?upload-section > \.row\) \{[\s\S]*?flex-wrap: nowrap/,
);
assert.match(
  modal,
  /upload-section > \.row > \.col-md-3\) \{[\s\S]*?width: 29%[\s\S]*?flex: 0 0 29%/,
);
assert.match(
  modal,
  /upload-section > \.row > \.col-md-9\) \{[\s\S]*?width: 71%[\s\S]*?flex: 0 0 71%/,
);
assert.match(modal, /去跟客户匹配/);
assert.match(modal, /关联并继续转订单/);
assert.match(modal, /unmatchedConversationTitle/);
assert.doesNotMatch(modal, /选择群订单接收方式/);
assert.doesNotMatch(modal, /groupModeRequest/);
assert.match(modal, /showSelectedImportAction && !selectedConversation && \(items\.length \|\| activeItem\)/);
assert.match(workbench, /:show-selected-import-action="showCurrentWechatReadButton"/);
assert.doesNotMatch(workbench, /WECHAT_GROUP_MODE_REQUIRED/);
assert.doesNotMatch(workbench, /group-mode-selection/);
assert.match(workbench, /ensureWechatBindingFromCustomerProfile/);

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
const selectedCustomerImport = workbench.match(
  /async function importWechatConversationForCustomer\([\s\S]*?\n\}\n\nasync function importSelectedWechatConversation/,
)?.[0] || '';
assert.match(selectedCustomerImport, /if \(!result\.payload\)/);
assert.match(selectedCustomerImport, /selected-conversation-fallback/);
assert.match(
  selectedCustomerImport,
  /focusWechatImportConversation\([\s\S]*?\{ conversationTitle: title \},[\s\S]*?\{ forceReselect: true \}/,
);
assert.match(selectedCustomerImport, /readMode: 'focused-verification'/);
assert.match(workbench, /writeAppLog\('info', 'wechat-order-timing', 'phase'/);
assert.match(workbench, /writeAppLog\(outcome === 'success' \? 'info' : 'warn', 'wechat-order-timing', 'summary'/);

const refreshSelectedAction = workbench.match(
  /async function refreshActiveWechatImport\(options = \{\}\) \{([\s\S]*?)\n\}\n\nfunction mergeActiveWechatImport/,
)?.[1] || '';
assert.match(refreshSelectedAction, /createWechatOrderTiming\('refresh-selected-wechat'\)/);
assert.match(refreshSelectedAction, /knownMessageFingerprints: messageFingerprints\(item\.payload\)/);
assert.match(refreshSelectedAction, /deferPrepareUntilStable: true/);
assert.match(refreshSelectedAction, /observedTitle !== expectedTitle/);
assert.match(refreshSelectedAction, /needsFocusBeforeRead/);
assert.match(refreshSelectedAction, /if \(options\.manual && !needsFocusBeforeRead\)/);
assert.match(refreshSelectedAction, /recordWechatServiceTiming\(timing, event\)/);
assert.match(refreshSelectedAction, /timing\.finish\(outcome/);

const allCustomerAction = workbench.match(
  /async function scanAllBoundWechatOrders\(options = \{\}\) \{([\s\S]*?)\n\}\n\nasync function handleTaskAdded/,
)?.[1] || '';
assert.match(allCustomerAction, /const automatic = options\?\.automatic === true/);
assert.match(allCustomerAction, /const customerFilter = automatic/);
assert.match(allCustomerAction, /loadBoundWechatCustomers\(\{ refreshCustomers: true, customerFilter \}\)/);
assert.match(workbench, /typeof customerFilter !== 'function' \|\| customerFilter\(customer\)/);
assert.match(allCustomerAction, /scanAllBoundWechatCustomers/);
assert.match(allCustomerAction, /beginWechatScanReport/);
assert.match(allCustomerAction, /beginWechatScanStep/);
assert.match(allCustomerAction, /onResult/);
assert.match(allCustomerAction, /completeWechatScanStep/);
assert.match(allCustomerAction, /focusWechatImportConversation/);
assert.match(allCustomerAction, /ensureWechatBindingFromCustomerProfile/);
assert.match(allCustomerAction, /prepareWechatOrderImport/);
assert.match(allCustomerAction, /readWechatCustomerDatabaseFirst/);
assert.match(allCustomerAction, /mode === 'database' \? \[250, 500\] : \[250\]/);
assert.doesNotMatch(allCustomerAction, /wechatImportQueue\.value = \[\]/);
assert.doesNotMatch(allCustomerAction, /wechatImportBatch\.value = \[\]/);
assert.match(allCustomerAction, /enqueueWechatImportItems\(result\.imports, \{ activate: false \}\)/);
assert.match(allCustomerAction, /已保留当前 \$\{preservedTaskCount\} 个未保存任务/);
assert.match(allCustomerAction, /await focusWechatWorkspaceApp\(\)/);
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

const removeTaskAction = workbench.match(
  /async function removeWechatImport\(token\) \{([\s\S]*?)\n\}\n\nfunction normalizeObservedWechatConversationTitle/,
)?.[1] || '';
assert.match(
  removeTaskAction,
  /await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: true \}\)/,
);
assert.match(removeTaskAction, /await closeWechatImportModal\(\)/);

const savedTaskAction = workbench.match(
  /async function handleTaskAdded\(change\) \{([\s\S]*?)\n\}\n\nfunction handleWechatImportError/,
)?.[1] || '';
assert.match(
  savedTaskAction,
  /await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: true \}\)/,
);
assert.doesNotMatch(savedTaskAction, /focusConversation: false/);
assert.match(
  savedTaskAction,
  /activeWechatImportToken\.value = queueUpdate\.items\[0\]\?\.token \|\| null/,
);
assert.doesNotMatch(
  savedTaskAction,
  /activeWechatImportToken\.value = queueUpdate\.nextToken/,
);
assert.match(savedTaskAction, /await closeWechatImportModal\(\)/);
assert.match(savedTaskAction, /本轮微信订单已全部确认保存/);

const desktopSelectionAction = workbench.match(
  /async function syncWechatSelectionFromDesktop\(payload\) \{([\s\S]*?)\n\}\n\nconst removeWechatConversationListener/,
)?.[1] || '';
assert.match(workbench, /onConversationChanged/);
assert.match(workbench, /wechatConversationObservationPoller = \/\^Win\/i/);
assert.match(workbench, /document\.hasFocus\(\)/);
assert.match(workbench, /window\.clearInterval\(wechatConversationObservationPoller\)/);
assert.match(desktopSelectionAction, /observedWechatConversationTitle\.value = title/);
assert.match(
  desktopSelectionAction,
  /if \(!activeWechatImport\.value && !selectedWechatConversation\.value\) return/,
);
assert.match(desktopSelectionAction, /activeWechatImportToken\.value = matchingItem\.token/);
assert.match(desktopSelectionAction, /showSelectedWechatConversation\(title, avatarDataUrl\)/);
assert.match(
  desktopSelectionAction,
  /await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: false \}\)/,
);

const observedConversationRefresh = workbench.match(
  /async function refreshObservedWechatConversation\(\{ force = false \} = \{\}\) \{([\s\S]*?)\n\}\n\nconst wechatConversationObservationPoller/,
)?.[1] || '';
assert.match(
  observedConversationRefresh,
  /currentConversationApi\(\{ requireForeground: !force \}\)/,
);
assert.match(observedConversationRefresh, /selected\.result\?\.title/);
assert.match(observedConversationRefresh, /await syncWechatSelectionFromDesktop\(selected\.result\)/);
assert.match(observedConversationRefresh, /wechatConversationObservationRunning/);
assert.match(observedConversationRefresh, /lastWechatConversationObservationAt < 800/);
assert.match(observedConversationRefresh, /selectedTitle !== titleBeforeRequest/);
assert.match(observedConversationRefresh, /await focusWechatWorkspaceApp\(\)/);
assert.doesNotMatch(
  observedConversationRefresh,
  /activeWechatImport\.value \|\| selectedWechatConversation\.value/,
);
const desktopSelectionListener = workbench.match(
  /async function handleWechatConversationChanged\(payload\) \{([\s\S]*?)\n\}\n\nconst removeWechatConversationListener/,
)?.[1] || '';
assert.match(desktopSelectionListener, /payload\?\.selectionChanged === true/);
assert.match(desktopSelectionListener, /await syncWechatSelectionFromDesktop\(payload\)/);
assert.match(desktopSelectionListener, /await focusWechatWorkspaceApp\(\)/);
assert.match(workbench, /void handleWechatConversationChanged\(payload\)/);
const focusConversationAction = workbench.match(
  /async function focusWechatImportConversation\(item, options = \{\}\) \{([\s\S]*?)\n\}\n\nasync function openWechatWorkspace/,
)?.[1] || '';
assert.match(focusConversationAction, /wechatConversationSwitching\.value = true/);
assert.match(focusConversationAction, /await focusApi\(conversationTitle,[\s\S]*?forceReselect/);
assert.match(focusConversationAction, /UNSUPPORTED_PLATFORM/);
assert.match(focusConversationAction, /wechatConversationSwitching\.value = false/);
assert.match(workbench, /selectedWechatTodayInbox = useTodayOrderInbox\(disUser\)/);
assert.match(workbench, /#selected-conversation/);
assert.match(workbench, /<TodayOrders/);
assert.match(workbench, /prepareWechatConversationForCustomer/);
assert.match(workbench, /今天的订单已经全部转存/);
assert.match(modal, /微信订单记录/);
assert.match(modal, /再次检查新订单/);

assert.match(workspaceWindowService, /const conversationChanged = title !== lastConversationTitle/);
assert.match(
  workspaceWindowService,
  /publishConversationTitle\(title\);\s*if \(!conversationChanged\) return/,
);
assert.match(workspaceWindowService, /publishConversationTitle\(title, avatarDataUrl, true\)/);
assert.match(workspaceWindowService, /Focus handoff must not depend on optional avatar capture/);
assert.doesNotMatch(workspaceWindowService, /!title \|\| title === lastConversationTitle/);
const workspaceOpenAction = workspaceWindowService.match(
  /async open\(\) \{([\s\S]*?)\n    \},\n\n    async close/,
)?.[1] || '';
assert.match(
  workspaceOpenAction,
  /startConversationWatcher\(\);\s*await observeConversationTitle\(conversationWatcherGeneration\);[\s\S]*?window\.show\(\);\s*applyWorkspaceBounds\(window, layout\.app, platform\);\s*window\.focus\(\);/,
);
assert.match(workspaceOpenAction, /await leaveExpandedWindowState\(window, saved\)/);
assert.match(workspaceOpenAction, /showInactive[\s\S]*?applyWorkspaceBounds\(window, layout\.app, platform\)/);
assert.match(workspaceWindowService, /focus\(\) \{[\s\S]*?window\.show\(\);\s*window\.focus\(\);/);
assert.match(workspaceWindowService, /isOpen\(\) \{\s*return Boolean\(session\);/);
assert.match(workspaceWindowService, /window\.isMinimized\(\)[\s\S]*?window\.restore\(\)/);
assert.match(workspaceOpenAction, /session = \{ saved, wechatBounds: null, layout \}/);
assert.match(mainProcess, /ipcMain\.handle\('wechat-ui-workspace-focus'/);
assert.match(preload, /focusWorkspace: \(\) => ipcRenderer\.invoke\('wechat-ui-workspace-focus'\)/);
assert.match(preload, /requireForeground: options\?\.requireForeground === true/);
assert.match(preload, /onWorkspaceCloseRequested:[\s\S]*?wechat-ui-workspace-close-requested/);
assert.match(mainProcess, /mainWindow\.on\('close',[\s\S]*?event\.preventDefault\(\)/);
assert.match(mainProcess, /wechat-ui-workspace-close-requested/);
assert.match(mainProcess, /service\.close\(\)/);
const currentConversationHandler = mainProcess.match(
  /ipcMain\.handle\('wechat-ui-current-conversation',[\s\S]*?\n  \}\);/,
)?.[0] || '';
assert.match(currentConversationHandler, /currentConversation\(input\)/);
assert.doesNotMatch(currentConversationHandler, /mainWindow\.focus\(\)/);
assert.match(mainProcess, /mainWindow\.on\('blur'/);
assert.match(mainProcess, /scheduleWindowsWechatSelectionObservation\(\)/);
assert.match(mainProcess, /requireForeground: true/);
assert.match(mainProcess, /wechat-ui-conversation-changed/);
const focusConversationHandler = mainProcess.match(
  /ipcMain\.handle\('wechat-ui-focus-conversation',[\s\S]*?\n  \}\);/,
)?.[0] || '';
assert.match(focusConversationHandler, /finally \{/);
assert.match(focusConversationHandler, /currentConversation\(\{/);
assert.match(focusConversationHandler, /VISIBLE_HEADER_ALREADY_MATCHED/);
assert.match(focusConversationHandler, /VERIFIED_FOREGROUND_TITLE_REUSED/);
assert.match(focusConversationHandler, /await getWechatWorkspaceWindowService\(\)\.focus\(\)/);
assert.doesNotMatch(focusConversationHandler, /mainWindow\.show\(\);\s*mainWindow\.focus\(\);/);
assert.doesNotMatch(focusConversationHandler, /if \(!result\?\.ok/);

console.log('WeChat order workspace entry passed');
