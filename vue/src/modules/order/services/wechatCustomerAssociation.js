import {
  normalizeWechatBinding,
  unwrapWechatReader,
  unwrapWechatServer,
} from './wechatOrderImport.js';
import {
  GROUP_ALL_MEMBER_MESSAGES,
  GROUP_MENTION_SELF_ONLY,
} from './wechatOrderMessagePolicy.js';

export const WECHAT_GROUP_MODE_REQUIRED = 'WECHAT_GROUP_MODE_REQUIRED';
export const WECHAT_PROFILE_REQUIRED = 'WECHAT_PROFILE_REQUIRED';

function timingNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function emitTiming(onTiming, stage, startedAt, meta = {}) {
  if (typeof onTiming !== 'function') return;
  try {
    onTiming({
      stage,
      durationMs: Math.round((timingNow() - startedAt) * 100) / 100,
      ...meta,
    });
  } catch {
    // 性能日志不能影响客户与微信的关联流程。
  }
}

async function timed(onTiming, stage, task, meta = {}) {
  const startedAt = timingNow();
  try {
    const value = await task();
    emitTiming(onTiming, stage, startedAt, meta);
    return value;
  } catch (error) {
    emitTiming(onTiming, stage, startedAt, { ...meta, failed: true });
    throw error;
  }
}

function title(value) {
  return String(value || '').trim();
}

function hasRealConversationActivity(conversation) {
  const value = conversation?.lastMessageAt;
  if (!value) return false;
  return Number.isFinite(new Date(value).getTime());
}

function selectExactConversation(exactMatches) {
  if (exactMatches.length === 1) return exactMatches[0];

  // Weixin may retain an old contact row after the same person changes account
  // or is added again.  A stale row has no session timestamp and cannot be the
  // visible chat containing today's order.  Only resolve the duplicate when
  // exactly one candidate has real conversation activity; two active chats
  // remain ambiguous and must still be bound manually to prevent order mixups.
  const activeMatches = exactMatches.filter(hasRealConversationActivity);
  return activeMatches.length === 1 ? activeMatches[0] : null;
}

function addRow(index, key, row) {
  if (!key) return;
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(row);
}

export function findWechatCustomerProfileMatches(customers, selectedTitle) {
  const normalizedTitle = title(selectedTitle);
  if (!normalizedTitle) return [];
  return (Array.isArray(customers) ? customers : []).filter(
    customer => title(customer?.nxDepartmentWechatDisplayName) === normalizedTitle
  );
}

export function buildWechatCustomerAssociationDirectory(rows) {
  const allRows = (Array.isArray(rows) ? rows : [])
    .filter(row => row?.customer)
    .map(row => ({
      ...row,
      binding: row.binding ? normalizeWechatBinding(row.binding) : null,
    }));
  const profileByTitle = new Map();
  const boundByTitle = new Map();

  allRows.forEach((row) => {
    addRow(profileByTitle, title(row.customer.nxDepartmentWechatDisplayName), row);
    if (row.binding?.bound) addRow(boundByTitle, title(row.binding.displayName), row);
  });

  return {
    allRows,
    profileByTitle,
    boundByTitle,
    allowedTitles: Array.from(new Set([
      ...profileByTitle.keys(),
      ...boundByTitle.keys(),
    ])),
  };
}

export function resolveWechatCustomerAssociation(directory, selectedTitle) {
  const normalizedTitle = title(selectedTitle);
  const profileRows = directory?.profileByTitle?.get(normalizedTitle) || [];
  if (profileRows.length) {
    if (profileRows.length === 1) return profileRows[0];

    // “微信好友／群昵称”刚从旧客户换到新客户时，旧客户仍带着完整
    // 会话指纹，而新客户只有刚保存的昵称。此时唯一的未绑定客户
    // 就是本次明确选择的新归属，后续会把技术绑定原子迁移过去。
    const unboundRows = profileRows.filter(row => !row.binding?.bound);
    if (unboundRows.length === 1) return unboundRows[0];
    throw new Error('该微信好友关联了多个客户，请先保留一个客户的微信昵称');
  }

  const boundRows = directory?.boundByTitle?.get(normalizedTitle) || [];
  if (boundRows.length === 1) return boundRows[0];
  if (boundRows.length > 1) {
    throw new Error('当前微信好友关联了多个客户，请先检查微信绑定');
  }
  throw new Error('此微信好友没有关联客户');
}

function activeReaderAccount(accounts) {
  const candidates = Array.isArray(accounts) ? accounts : [];
  return candidates.find(item => item?.isCurrentLogin && item?.hasAccessMaterial)
    || candidates.find(item => item?.hasAccessMaterial)
    || null;
}

export async function ensureWechatCustomerBinding({
  row,
  selectedTitle,
  directory,
  groupMode: requestedGroupMode = null,
  electronAPI = window.electronAPI,
  onTiming = null,
}) {
  const normalizedTitle = title(selectedTitle);
  const current = normalizeWechatBinding(row?.binding);
  if (current.bound && title(current.displayName) === normalizedTitle) {
    const startedAt = timingNow();
    emitTiming(onTiming, 'binding-reuse', startedAt);
    return current;
  }

  const reader = electronAPI?.wechatReader;
  const bindingApi = electronAPI?.customerWechatOrders;
  if (!reader?.listAccounts || !reader?.findConversation || !bindingApi?.saveBinding) {
    throw new Error('当前安装包不支持自动关联微信好友');
  }

  const accounts = unwrapWechatReader(await timed(
    onTiming,
    'reader-list-accounts',
    () => reader.listAccounts()
  ));
  const account = activeReaderAccount(accounts);
  if (!account) throw new Error('当前微信账号的本地数据访问材料未就绪');

  const found = unwrapWechatReader(await timed(
    onTiming,
    'reader-find-conversation',
    () => reader.findConversation(account.id, normalizedTitle)
  ));
  const exactMatches = (Array.isArray(found?.matches) ? found.matches : []).filter(item => (
    title(item?.displayName) === normalizedTitle
    && (item?.kind === 'direct' || item?.kind === 'group')
  ));
  if (!exactMatches.length) throw new Error(`微信中没有找到“${normalizedTitle}”`);
  const conversation = selectExactConversation(exactMatches);
  if (!conversation) throw new Error('微信中存在多个同名会话，请先在订单录入页手动绑定');

  // 好友/群以及群规则必须在客户资料中一次设定。这里不能根据微信搜索结果
  // 偷偷猜测，更不能在自动读取过程中临时弹选择框，否则无人值守任务会中断。
  if (row?.binding?.profileConfigured !== true) {
    const error = new Error('请先在客户中心设置该微信名称是好友还是微信群');
    error.code = WECHAT_PROFILE_REQUIRED;
    throw error;
  }
  if (current.conversationKind !== conversation.kind) {
    throw new Error(`客户资料设置为${current.conversationKind === 'group' ? '微信群' : '微信好友'}，但微信中找到的是${conversation.kind === 'group' ? '微信群' : '微信好友'}，请先在客户中心更正`);
  }

  const priorRow = (directory?.allRows || []).find(candidate => (
    candidate?.binding?.bound
    && candidate.binding.accountFingerprint === account.id
    && candidate.binding.conversationFingerprint === conversation.id
  ));
  let groupMode = null;
  if (conversation.kind === 'group') {
    groupMode = [
      requestedGroupMode,
      priorRow?.binding?.groupMode,
      current.groupMode,
    ].find(value => [GROUP_ALL_MEMBER_MESSAGES, GROUP_MENTION_SELF_ONLY].includes(value)) || null;
    if (!groupMode) {
      const error = new Error('请先在客户中心设置微信群是专属群还是混合群');
      error.code = WECHAT_GROUP_MODE_REQUIRED;
      error.conversationTitle = conversation.displayName;
      throw error;
    }
  }

  const customerId = Number(row?.customer?.nxDepartmentId ?? row?.customer?.departmentId);
  if (!Number.isSafeInteger(customerId) || customerId <= 0) throw new Error('客户 ID 无效');
  const saved = unwrapWechatServer(await timed(
    onTiming,
    'server-save-binding',
    () => bindingApi.saveBinding({
      customerId,
      displayName: conversation.displayName,
      accountFingerprint: account.id,
      conversationFingerprint: conversation.id,
      conversationKind: conversation.kind,
      groupMode,
    })
  ));
  return normalizeWechatBinding(saved);
}
