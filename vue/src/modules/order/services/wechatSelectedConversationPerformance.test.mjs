import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workbench = await readFile(
  new URL('../views/OrderWorkbenchV2.vue', import.meta.url),
  'utf8',
);
const selectedCustomerImport = workbench.match(
  /async function importWechatConversationForCustomer\([\s\S]*?\n\}\n\nasync function importSelectedWechatConversation/,
)?.[0] || '';

assert.match(selectedCustomerImport, /loadWechatConversationSnapshot/);
assert.match(selectedCustomerImport, /databaseResultCoversConversation/);
assert.match(selectedCustomerImport, /result\.status === 'empty'/);
assert.match(selectedCustomerImport, /selected-conversation-stable-empty/);
assert.match(selectedCustomerImport, /selected-conversation-database-covered/);
assert.match(selectedCustomerImport, /if \(!databaseCovered\)/);
assert.match(selectedCustomerImport, /selected-conversation-focus/);
assert.match(selectedCustomerImport, /forceReselect: true/);

const coveredBranch = selectedCustomerImport.match(
  /if \(databaseCovered\) \{([\s\S]*?)\n    \}/,
)?.[1] || '';
assert.doesNotMatch(coveredBranch, /focusWechatImportConversation|prepareWechatOrderImport/);

const unreadImport = workbench.match(
  /async function readUnreadWechatOrders\(\) \{[\s\S]*?\n\}\n\n\/\/ Markdown/,
)?.[0] || '';

// The unread scanner leaves WeChat on the last title that it opened and
// verified. Reuse that exact task instead of searching for the same chat a
// second time; retain the explicit-focus fallback when it produced no task.
assert.match(unreadImport, /const lastOpenedTitle = normalizeObservedWechatConversationTitle/);
assert.match(unreadImport, /const alreadyOpenImport = scan\.result\?\.openedTitlesExact === true/);
assert.match(unreadImport, /const initialImport = alreadyOpenImport \|\| imports\[0\]/);
assert.match(unreadImport, /openWorkspace: false/);
assert.match(unreadImport, /focusConversation: !alreadyOpenImport/);

const desktopSelectionSync = workbench.match(
  /async function syncWechatSelectionFromDesktop\(payload\) \{[\s\S]*?\n\}\n\nasync function refreshObservedWechatConversation/,
)?.[0] || '';

// A native WeChat click may update the observed title while the scan report is
// visible, but it must not select an image order task and open its crop dialog
// over the report.
assert.match(desktopSelectionSync, /if \(wechatScanReportOpen\.value\) return/);
const reportGuardIndex = desktopSelectionSync.indexOf('if (wechatScanReportOpen.value) return');
const taskSwitchIndex = desktopSelectionSync.indexOf('activeWechatImportToken.value = matchingItem.token');
assert.ok(reportGuardIndex >= 0 && taskSwitchIndex > reportGuardIndex);

console.log('WeChat selected-conversation performance guard passed');
