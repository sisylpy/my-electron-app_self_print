import assert from 'node:assert/strict';

import {
  WECHAT_CONVERSATION_GROUP,
  WECHAT_GROUP_ALL_MEMBERS,
  WECHAT_GROUP_MENTION_SELF,
  buildCustomerWechatBindingPayload,
  customerWechatDisplayName,
  customerWechatTypeLabel,
  normalizeCustomerWechatBinding,
} from './customerWechatBinding.js';

const groupBinding = normalizeCustomerWechatBinding({
  enabled: 1,
  displayName: '调料群',
  accountFingerprint: 'fp:account123',
  conversationFingerprint: 'fp:conversation123',
  conversationKind: 'group',
  groupMode: WECHAT_GROUP_ALL_MEMBERS,
});

assert.equal(groupBinding.bound, true);
assert.equal(customerWechatTypeLabel(groupBinding), '专属群');
assert.equal(
  customerWechatTypeLabel({ ...groupBinding, groupMode: WECHAT_GROUP_MENTION_SELF }),
  '混合群',
);
assert.equal(
  customerWechatDisplayName({ nxDepartmentWechatDisplayName: '客户资料群名' }, groupBinding),
  '客户资料群名',
);
assert.deepEqual(
  buildCustomerWechatBindingPayload(
    18,
    groupBinding,
    '新调料群',
    WECHAT_CONVERSATION_GROUP,
    WECHAT_GROUP_MENTION_SELF,
  ),
  {
    customerId: 18,
    displayName: '新调料群',
    accountFingerprint: 'fp:account123',
    conversationFingerprint: 'fp:conversation123',
    conversationKind: 'group',
    groupMode: WECHAT_GROUP_MENTION_SELF,
  },
);
assert.equal(customerWechatTypeLabel(null, true), '待关联');
assert.equal(
  customerWechatTypeLabel(
    { profileConfigured: true, conversationKind: 'group', groupMode: WECHAT_GROUP_ALL_MEMBERS },
    false,
  ),
  '未设置',
);
assert.equal(
  customerWechatTypeLabel(
    { profileConfigured: true, conversationKind: 'group', groupMode: WECHAT_GROUP_ALL_MEMBERS },
    true,
  ),
  '专属群（待关联）',
);
assert.equal(
  customerWechatDisplayName({ nxDepartmentWechatDisplayName: '' }, groupBinding),
  '',
);
assert.equal(
  buildCustomerWechatBindingPayload(18, groupBinding, '新好友', 'direct', null),
  null,
);
assert.equal(buildCustomerWechatBindingPayload(18, null, '未绑定', 'group', WECHAT_GROUP_ALL_MEMBERS), null);
assert.equal(
  buildCustomerWechatBindingPayload(18, groupBinding, '', WECHAT_CONVERSATION_GROUP, WECHAT_GROUP_ALL_MEMBERS),
  null,
);

console.log('customer WeChat binding presentation tests passed');
