export const WECHAT_CONVERSATION_DIRECT = 'direct';
export const WECHAT_CONVERSATION_GROUP = 'group';
export const WECHAT_GROUP_ALL_MEMBERS = 'ALL_MEMBER_MESSAGES';
export const WECHAT_GROUP_MENTION_SELF = 'MENTION_SELF_ONLY';

export function normalizeCustomerWechatBinding(value) {
  const source = value && typeof value === 'object' ? value : {};
  const conversationKind = [WECHAT_CONVERSATION_DIRECT, WECHAT_CONVERSATION_GROUP]
    .includes(source.conversationKind) ? source.conversationKind : null;
  const groupMode = conversationKind === WECHAT_CONVERSATION_GROUP
    ? source.groupMode === WECHAT_GROUP_ALL_MEMBERS
      ? WECHAT_GROUP_ALL_MEMBERS
      : WECHAT_GROUP_MENTION_SELF
    : null;
  return {
    ...source,
    conversationKind,
    groupMode,
    bound: Number(source.enabled) === 1
      && Boolean(source.accountFingerprint)
      && Boolean(source.conversationFingerprint),
  };
}

export function customerWechatTypeLabel(binding, hasWechatName = false) {
  const normalized = normalizeCustomerWechatBinding(binding);
  if (!normalized.bound) return hasWechatName ? '待关联' : '未设置';
  if (normalized.conversationKind === WECHAT_CONVERSATION_DIRECT) return '微信好友';
  return normalized.groupMode === WECHAT_GROUP_ALL_MEMBERS ? '专属群' : '混合群';
}

export function customerWechatDisplayName(customer, binding) {
  return String(
    customer?.nxDepartmentWechatDisplayName
      || binding?.displayName
      || '',
  ).trim();
}

export function buildCustomerWechatBindingPayload(customerId, binding, displayName, groupMode) {
  const normalized = normalizeCustomerWechatBinding(binding);
  if (!normalized.bound) return null;
  const name = String(displayName || normalized.displayName || '').trim();
  if (!name) throw new Error('已关联微信的客户不能清空微信名称');
  const nextGroupMode = normalized.conversationKind === WECHAT_CONVERSATION_GROUP
    ? groupMode === WECHAT_GROUP_ALL_MEMBERS
      ? WECHAT_GROUP_ALL_MEMBERS
      : WECHAT_GROUP_MENTION_SELF
    : null;
  return {
    customerId: Number(customerId),
    displayName: name,
    accountFingerprint: normalized.accountFingerprint,
    conversationFingerprint: normalized.conversationFingerprint,
    conversationKind: normalized.conversationKind,
    groupMode: nextGroupMode,
  };
}
