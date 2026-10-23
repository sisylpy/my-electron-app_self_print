import assert from 'node:assert/strict';
import fs from 'node:fs';

const aiPanel = fs.readFileSync(
  'vue/src/modules/order/components/workbench/AiOrderPanel.vue',
  'utf8',
);

assert.match(aiPanel, /<OrderModeSelector/);
assert.doesNotMatch(aiPanel, /微信聊天/);
assert.doesNotMatch(aiPanel, /handleWechatQuickAction/);
assert.doesNotMatch(aiPanel, /pullWechatMessages/);
assert.doesNotMatch(aiPanel, /ai-order-panel__wechat-mode/);

console.log('Legacy WeChat order quick action removed');
