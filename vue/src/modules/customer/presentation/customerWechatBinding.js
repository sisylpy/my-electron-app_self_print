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

export function customerWechatTypeLabel(binding, hasWechatName = null) {
  // 微信名称是后续会话类型和自动读取的前置条件。名称已清空时，不能继续
  // 展示本机偏好或旧技术绑定留下的群类型，避免用户误以为仍在自动读单。
  const resolvedHasWechatName = hasWechatName === null
    ? Boolean(String(binding?.displayName || '').trim())
    : hasWechatName === true;
  if (!resolvedHasWechatName) return '未设置';
  const normalized = normalizeCustomerWechatBinding(binding);
  const configured = normalized.bound || binding?.profileConfigured === true;
  if (!configured) return '待关联';
  const typeLabel = normalized.conversationKind === WECHAT_CONVERSATION_DIRECT
    ? '微信好友'
    : normalized.groupMode === WECHAT_GROUP_ALL_MEMBERS ? '专属群' : '混合群';
  return normalized.bound ? typeLabel : `${typeLabel}（待关联）`;
}

export function customerWechatDisplayName(customer, binding) {
  if (customer && Object.prototype.hasOwnProperty.call(customer, 'nxDepartmentWechatDisplayName')) {
    return String(customer.nxDepartmentWechatDisplayName || '').trim();
  }
  return String(
    binding?.displayName || '',
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
  const name = String(displayName || '').trim();
  // 空名称由调用方走 clearBinding；绝不能回退到旧绑定名称并把旧关系重新保存。
  if (!name) return null;
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
