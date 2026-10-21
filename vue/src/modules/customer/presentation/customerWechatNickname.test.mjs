import assert from 'node:assert/strict';
import fs from 'node:fs';

const editDrawer = fs.readFileSync(
  'vue/src/modules/customer/components/CustomerEditDrawer.vue',
  'utf8',
);
const orderSource = fs.readFileSync(
  'vue/src/modules/order/components/workbench/WechatOrderSource.vue',
  'utf8',
);
const profilePanel = fs.readFileSync(
  'vue/src/modules/customer/components/CustomerProfilePanel.vue',
  'utf8',
);

assert.match(editDrawer, /客户微信名称（好友／群昵称）/);
assert.match(editDrawer, /v-model\.trim="form\.nxDepartmentWechatDisplayName"/);
assert.match(editDrawer, /maxlength="255"/);
assert.match(editDrawer, /专属群/);
assert.match(editDrawer, /混合群/);
assert.match(editDrawer, /wechatGroupMode/);
assert.match(editDrawer, /微信会话类型/);
assert.match(editDrawer, /wechatConversationKind/);
assert.match(profilePanel, /客户微信名称/);
assert.match(profilePanel, /微信订单接收方式/);
assert.match(
  orderSource,
  /if \(!loaded\.bound && loaded\.displayName\) searchName\.value = loaded\.displayName;/,
);
assert.match(orderSource, /item\.kind === 'direct' \|\| item\.kind === CONVERSATION_GROUP/);
assert.match(orderSource, /GROUP_ALL_MEMBER_MESSAGES/);
assert.doesNotMatch(orderSource, /pendingGroup/);
assert.match(orderSource, /请先在客户中心设置该微信名称是好友还是微信群/);

console.log('customer WeChat nickname contract passed');
