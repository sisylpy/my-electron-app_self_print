import {
  normalizeWechatBinding,
  unwrapWechatReader,
  unwrapWechatServer,
} from './wechatOrderImport.js';

function title(value) {
  return String(value || '').trim();
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
  electronAPI = window.electronAPI,
}) {
  const normalizedTitle = title(selectedTitle);
  const current = normalizeWechatBinding(row?.binding);
  if (current.bound && title(current.displayName) === normalizedTitle) return current;

  const reader = electronAPI?.wechatReader;
  const bindingApi = electronAPI?.customerWechatOrders;
  if (!reader?.listAccounts || !reader?.findConversation || !bindingApi?.saveBinding) {
    throw new Error('当前安装包不支持自动关联微信好友');
  }

  const accounts = unwrapWechatReader(await reader.listAccounts());
  const account = activeReaderAccount(accounts);
  if (!account) throw new Error('当前微信账号的本地数据访问材料未就绪');

  const found = unwrapWechatReader(await reader.findConversation(account.id, normalizedTitle));
  const exactMatches = (Array.isArray(found?.matches) ? found.matches : []).filter(item => (
    title(item?.displayName) === normalizedTitle
    && (item?.kind === 'direct' || item?.kind === 'group')
  ));
  if (!exactMatches.length) throw new Error(`微信中没有找到“${normalizedTitle}”`);
  if (exactMatches.length > 1) throw new Error('微信中存在多个同名会话，请先在订单录入页手动绑定');

  const conversation = exactMatches[0];
  const priorRow = (directory?.allRows || []).find(candidate => (
    candidate?.binding?.bound
    && candidate.binding.accountFingerprint === account.id
    && candidate.binding.conversationFingerprint === conversation.id
  ));
  let groupMode = null;
  if (conversation.kind === 'group') {
    groupMode = priorRow?.binding?.groupMode || current.groupMode || null;
    if (!groupMode) throw new Error('群聊需要先在订单录入页选择订单接收方式');
  }

  const customerId = Number(row?.customer?.nxDepartmentId ?? row?.customer?.departmentId);
  if (!Number.isSafeInteger(customerId) || customerId <= 0) throw new Error('客户 ID 无效');
  const saved = unwrapWechatServer(await bindingApi.saveBinding({
    customerId,
    displayName: conversation.displayName,
    accountFingerprint: account.id,
    conversationFingerprint: conversation.id,
    conversationKind: conversation.kind,
    groupMode,
  }));
  return normalizeWechatBinding(saved);
}
