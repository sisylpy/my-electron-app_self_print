import assert from 'node:assert/strict';
import fs from 'node:fs';
import { customerHasWechatContact } from './wechatOrderAvailability.js';

assert.equal(customerHasWechatContact(null), false);
assert.equal(customerHasWechatContact({ nxDepartmentWechatDisplayName: '   ' }), false);
assert.equal(customerHasWechatContact({ nxDepartmentWechatDisplayName: '金调料' }), true);
assert.equal(customerHasWechatContact({ nxDepartmentWechatDisplayName: '测试群' }), true);

const aiPanel = fs.readFileSync(
  'vue/src/modules/order/components/workbench/AiOrderPanel.vue',
  'utf8',
);
const workspace = fs.readFileSync(
  'vue/src/modules/order/components/PlaceOrderWorkspace.vue',
  'utf8',
);
const source = fs.readFileSync(
  'vue/src/modules/order/components/workbench/WechatOrderSource.vue',
  'utf8',
);

assert.match(aiPanel, /v-if="hasWechatContact"/);
assert.match(aiPanel, /@click="handleWechatQuickAction"/);
assert.match(aiPanel, /pullWechatMessages/);
assert.match(workspace, /ref="wechatOrderSourceRef"/);
assert.match(source, /defineExpose\(\{ pullMessages \}\)/);

console.log('WeChat order quick action passed');
