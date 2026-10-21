export const CUSTOMER_WECHAT_PROFILE_STORAGE_KEY = 'grainprint.customer-wechat-profile.v1';

const DIRECT = 'direct';
const GROUP = 'group';
const ALL_MEMBERS = 'ALL_MEMBER_MESSAGES';
const MENTION_SELF = 'MENTION_SELF_ONLY';

function customerKey(customerId) {
  const id = String(customerId ?? '').trim();
  return /^[1-9]\d*$/.test(id) ? id : '';
}

function storageOrNull(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function readAll(storage) {
  const target = storageOrNull(storage);
  if (!target) return {};
  try {
    const parsed = JSON.parse(target.getItem(CUSTOMER_WECHAT_PROFILE_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizeCustomerWechatProfile(value) {
  const source = value && typeof value === 'object' ? value : {};
  const conversationKind = source.conversationKind === GROUP
    ? GROUP
    : source.conversationKind === DIRECT ? DIRECT : null;
  const groupMode = conversationKind === GROUP
    ? source.groupMode === ALL_MEMBERS ? ALL_MEMBERS : MENTION_SELF
    : null;
  return { conversationKind, groupMode };
}

export function loadCustomerWechatProfile(customerId, storage = null) {
  const key = customerKey(customerId);
  if (!key) return null;
  const raw = readAll(storage)[key];
  const normalized = normalizeCustomerWechatProfile(raw);
  return normalized.conversationKind ? normalized : null;
}

export function saveCustomerWechatProfile(customerId, profile, storage = null) {
  const key = customerKey(customerId);
  if (!key) throw new TypeError('客户 ID 无效');
  const target = storageOrNull(storage);
  if (!target) throw new Error('当前环境无法保存微信客户设置');
  const all = readAll(target);
  const normalized = normalizeCustomerWechatProfile(profile);
  if (normalized.conversationKind) all[key] = normalized;
  else delete all[key];
  target.setItem(CUSTOMER_WECHAT_PROFILE_STORAGE_KEY, JSON.stringify(all));
  return normalized.conversationKind ? normalized : null;
}

export function applyCustomerWechatProfile(customerId, binding, storage = null) {
  const technicalBound = binding?.bound === true || (
    Number(binding?.enabled) === 1
    && Boolean(binding?.accountFingerprint)
    && Boolean(binding?.conversationFingerprint)
  );
  const preference = loadCustomerWechatProfile(customerId, storage);
  if (!preference) return { ...(binding || {}), profileConfigured: technicalBound };
  const technicalBindingKind = binding?.conversationKind;
  const kindChanged = technicalBound
    && technicalBindingKind !== preference.conversationKind;
  return {
    ...(binding || {}),
    ...preference,
    // 客户把“好友/群”改成另一种类型后，旧会话指纹不能继续冒充有效绑定。
    // 保留指纹供诊断，但先禁用，下一次读单会按新类型重新核验并关联。
    ...(kindChanged ? { enabled: 0, bound: false } : {}),
    profileConfigured: true,
  };
}
