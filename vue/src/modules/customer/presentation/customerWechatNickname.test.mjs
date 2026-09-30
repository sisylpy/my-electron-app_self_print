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

assert.match(editDrawer, /微信好友／群昵称/);
assert.match(editDrawer, /v-model\.trim="form\.nxDepartmentWechatDisplayName"/);
assert.match(editDrawer, /maxlength="255"/);
assert.match(
  orderSource,
  /if \(!loaded\.bound && loaded\.displayName\) searchName\.value = loaded\.displayName;/,
);
assert.match(orderSource, /item\.kind === 'direct' \|\| item\.kind === CONVERSATION_GROUP/);
assert.match(orderSource, /GROUP_ALL_MEMBER_MESSAGES/);
assert.match(orderSource, /GROUP_MENTION_SELF_ONLY/);

console.log('customer WeChat nickname contract passed');
