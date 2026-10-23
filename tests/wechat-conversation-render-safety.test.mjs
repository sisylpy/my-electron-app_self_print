import assert from 'node:assert/strict';
import fs from 'node:fs';

const workbench = fs.readFileSync(
  'vue/src/modules/order/views/OrderWorkbenchV2.vue',
  'utf8',
);
const workspaceWindowService = fs.readFileSync(
  'src/wechat/workspace-window-service.js',
  'utf8',
);

const desktopSelectionListener = workbench.match(
  /async function handleWechatConversationChanged\(payload\) \{([\s\S]*?)\n\}\n\nconst removeWechatConversationListener/,
)?.[1] || '';

assert.match(desktopSelectionListener, /await syncWechatSelectionFromDesktop\(payload\)/);
assert.doesNotMatch(
  desktopSelectionListener,
  /focusWechatWorkspaceApp/,
  'manual WeChat selection must not return focus before its message list finishes painting',
);
assert.match(
  workspaceWindowService,
  /const CONVERSATION_WATCH_INTERVAL_MS = 2000/,
  'Mac conversation observation must leave enough time for WeChat to render messages',
);
assert.doesNotMatch(workspaceWindowService, /\}, 450\)/);
assert.match(workspaceWindowService, /if \(!conversationChanged\) return/);
assert.doesNotMatch(
  workspaceWindowService,
  /publishConversationTitle\(title\);/,
  'unchanged titles must not wake the renderer on every accessibility poll',
);
assert.match(workspaceWindowService, /publishConversationTitle\(title, avatarDataUrl, true\)/);

console.log('WeChat conversation render safety test passed.');
