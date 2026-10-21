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
  const configured = normalized.bound || binding?.profileConfigured === true;
  if (!configured) return hasWechatName ? '待关联' : '未设置';
  const typeLabel = normalized.conversationKind === WECHAT_CONVERSATION_DIRECT
    ? '微信好友'
    : normalized.groupMode === WECHAT_GROUP_ALL_MEMBERS ? '专属群' : '混合群';
  return normalized.bound ? typeLabel : `${typeLabel}（待关联）`;
}

export function customerWechatDisplayName(customer, binding) {
  return String(
    customer?.nxDepartmentWechatDisplayName
      || binding?.displayName
      || '',
  ).trim();
}

export function buildCustomerWechatBindingPayload(
  customerId,
  binding,
  displayName,
  conversationKind,
  groupMode,
) {
  const normalized = normalizeCustomerWechatBinding(binding);
  if (!normalized.bound) return null;
  const name = String(displayName || normalized.displayName || '').trim();
  if (!name) throw new Error('已关联微信的客户不能清空微信名称');
  const nextKind = conversationKind === WECHAT_CONVERSATION_GROUP
    ? WECHAT_CONVERSATION_GROUP
    : WECHAT_CONVERSATION_DIRECT;
  // 好友与群之间切换时不能复用旧会话指纹；只保存客户资料偏好，下一次
  // 读取会按新类型重新查找并建立技术绑定。
  if (nextKind !== normalized.conversationKind) return null;
  const nextGroupMode = nextKind === WECHAT_CONVERSATION_GROUP
    ? groupMode === WECHAT_GROUP_ALL_MEMBERS
      ? WECHAT_GROUP_ALL_MEMBERS
      : WECHAT_GROUP_MENTION_SELF
    : null;
  return {
    customerId: Number(customerId),
    displayName: name,
    accountFingerprint: normalized.accountFingerprint,
    conversationFingerprint: normalized.conversationFingerprint,
    conversationKind: nextKind,
    groupMode: nextGroupMode,
  };
}
