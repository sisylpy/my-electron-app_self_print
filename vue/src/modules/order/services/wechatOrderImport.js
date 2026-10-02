import {
  CONVERSATION_GROUP,
  GROUP_MENTION_SELF_ONLY,
  normalizeConversationKind,
  normalizeGroupMode,
  selectWechatOrderMessages,
} from './wechatOrderMessagePolicy.js';

export function unwrapWechatReader(response) {
  if (response?.ok) return response.result;
  throw new Error(response?.error?.message || '读取本地微信数据失败');
}

export function unwrapWechatServer(response) {
  if (response?.ok) return response.data;
  throw new Error(response?.message || '服务器请求失败');
}

export function normalizeWechatBinding(data) {
  const conversationKind = normalizeConversationKind(data?.conversationKind);
  return {
    ...(data || {}),
    conversationKind,
    groupMode: normalizeGroupMode(conversationKind, data?.groupMode),
    bound: Number(data?.enabled) === 1
      && Boolean(data?.accountFingerprint)
      && Boolean(data?.conversationFingerprint),
  };
}

export function buildWechatReconciliationPlan(boundTitles, openedTitles) {
  const bound = Array.from(new Set(
    (Array.isArray(boundTitles) ? boundTitles : [])
      .map(title => String(title || '').trim())
      .filter(Boolean)
  ));
  const boundSet = new Set(bound);
  const opened = Array.from(new Set(
    (Array.isArray(openedTitles) ? openedTitles : [])
      .map(title => String(title || '').trim())
      .filter(title => boundSet.has(title))
  ));
  const openedSet = new Set(opened);
  return [
    ...opened.map(title => ({ title, opened: true })),
    ...bound.filter(title => !openedSet.has(title)).map(title => ({ title, opened: false })),
  ];
}

export function removeWechatImportQueueItem(items, token) {
  const queue = Array.isArray(items) ? items : [];
  const target = String(token || '');
  const index = queue.findIndex(item => String(item?.token || '') === target);
  if (index < 0) {
    return {
      items: queue,
      nextToken: queue[0]?.token || null,
      removed: false,
    };
  }
  const remaining = queue.filter((_item, itemIndex) => itemIndex !== index);
  const nextItem = remaining[Math.min(index, Math.max(0, remaining.length - 1))] || null;
  return {
    items: remaining,
    nextToken: nextItem?.token || null,
    removed: true,
  };
}

function requireCustomerId(customerId) {
  const value = Number(customerId);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('客户 ID 无效');
  return value;
}

function payloadEntries(payload) {
  if (Array.isArray(payload?.entries)) return payload.entries;
  const messages = Array.isArray(payload?.source?.messages) ? payload.source.messages : [];
  if (messages.length !== 1 || typeof payload?.text !== 'string') return [];
  return [{ ...messages[0], text: payload.text }];
}

export function mergeWechatOrderPayload(currentPayload, incomingPayload) {
  if (!currentPayload?.source) return incomingPayload;
  if (!incomingPayload?.source) return currentPayload;
  const currentMessages = Array.isArray(currentPayload.source.messages)
    ? currentPayload.source.messages : [];
  const incomingMessages = Array.isArray(incomingPayload.source.messages)
    ? incomingPayload.source.messages : [];
  const messageMap = new Map();
  [...currentMessages, ...incomingMessages].forEach((message) => {
    const id = String(message?.messageFingerprint || '');
    if (id) messageMap.set(id, message);
  });
  const messages = Array.from(messageMap.values()).sort((left, right) => (
    Number(left.messageTimeMs) - Number(right.messageTimeMs)
    || String(left.messageFingerprint).localeCompare(String(right.messageFingerprint))
  ));
  const entryMap = new Map();
  [...payloadEntries(currentPayload), ...payloadEntries(incomingPayload)].forEach((entry) => {
    const id = String(entry?.messageFingerprint || '');
    if (id) entryMap.set(id, entry);
  });
  const entries = messages
    .map(message => entryMap.get(String(message.messageFingerprint)))
    .filter(Boolean);
  const incomingIds = new Set(incomingMessages.map(message => String(message.messageFingerprint)));
  const currentIds = new Set(currentMessages.map(message => String(message.messageFingerprint)));
  const incomingContainsCurrent = Array.from(currentIds).every(id => incomingIds.has(id));
  const text = entries.length === messages.length
    ? entries.map(entry => entry.text).join('\n')
    : incomingContainsCurrent
      ? incomingPayload.text
      : [currentPayload.text, incomingPayload.text].filter(Boolean).join('\n');
  return {
    ...incomingPayload,
    text,
    entries,
    source: {
      ...incomingPayload.source,
      messages,
    },
  };
}

function noIncomingMessage(binding) {
  if (binding.conversationKind === CONVERSATION_GROUP
      && binding.groupMode === GROUP_MENTION_SELF_ONLY) {
    return '所选时间范围内没有 @ 当前微信账号的新群消息';
  }
  if (binding.conversationKind === CONVERSATION_GROUP) {
    return '所选时间范围内没有新的群成员文字消息';
  }
  return '所选时间范围内没有新的好友文字消息';
}

export async function loadCustomerWechatBinding(customerId, electronAPI = window.electronAPI) {
  const id = requireCustomerId(customerId);
  const api = electronAPI?.customerWechatOrders;
  if (!api?.loadBinding) throw new Error('当前安装包不支持微信聊天订单');
  return normalizeWechatBinding(unwrapWechatServer(await api.loadBinding(id)));
}

export async function prepareWechatOrderImport({
  customerId,
  binding,
  now = null,
  retryDelaysMs = [2000, 4000, 7000, 12000, 20000],
  sleep = (delayMs) => new Promise(resolve => setTimeout(resolve, delayMs)),
  electronAPI = window.electronAPI,
}) {
  const id = requireCustomerId(customerId);
  const normalizedBinding = normalizeWechatBinding(binding);
  if (!normalizedBinding.bound) {
    return {
      status: 'unbound',
      message: '当前客户尚未绑定微信好友或群聊，请先完成绑定',
      binding: normalizedBinding,
    };
  }

  const reader = electronAPI?.wechatReader;
  const orderApi = electronAPI?.customerWechatOrders;
  if (!reader?.getParticipants || !reader?.getMessages || !orderApi?.prepareMessages) {
    throw new Error('当前安装包不支持读取微信聊天订单');
  }

  const participants = unwrapWechatReader(
    await reader.getParticipants(normalizedBinding.conversationFingerprint)
  );
  const cursor = Number(normalizedBinding.cursorTimeMs);
  const fixedNow = Number(now);
  const hasFixedNow = Number.isFinite(fixedNow) && fixedNow > 0;
  const retryDelays = Array.isArray(retryDelaysMs)
    ? retryDelaysMs.filter(delayMs => Number.isFinite(Number(delayMs)) && Number(delayMs) >= 0)
    : [];
  let incoming = [];
  let pending = [];
  let prepared = null;
  let nextBinding = normalizedBinding;
  let pendingSignature = '';
  let stablePendingReads = 0;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    if (attempt > 0) await sleep(Number(retryDelays[attempt - 1]));
    const attemptNow = hasFixedNow ? fixedNow : Date.now();
    const startMs = Number.isFinite(cursor) && cursor > 0
      ? Math.max(0, cursor - 2 * 60 * 1000)
      : attemptNow - 24 * 60 * 60 * 1000;
    const page = unwrapWechatReader(await reader.getMessages(
      normalizedBinding.conversationFingerprint,
      { start: new Date(startMs).toISOString(), end: new Date(attemptNow).toISOString() },
      { offset: 0, limit: 200 }
    ));
    incoming = selectWechatOrderMessages(page?.items, participants, normalizedBinding)
      .map((message) => ({ ...message, messageTimeMs: Date.parse(message.timestamp) }))
      .filter((message) => Number.isFinite(message.messageTimeMs))
      .sort((left, right) => (
        left.messageTimeMs - right.messageTimeMs
        || String(left.id).localeCompare(String(right.id))
      ));
    if (!incoming.length) continue;

    prepared = unwrapWechatServer(await orderApi.prepareMessages(
      id,
      incoming.map((message) => ({
        messageFingerprint: message.id,
        messageTimeMs: message.messageTimeMs,
      }))
    ));
    const pendingIds = new Set(prepared?.pendingMessageFingerprints || []);
    pending = incoming.filter((message) => pendingIds.has(message.id));
    nextBinding = normalizeWechatBinding(prepared?.binding || nextBinding);
    // 微信窗口被点开后，客户端可能先写入一部分旧消息，再延迟写入最新消息。
    // 生产读取必须等候待处理消息连续两次保持稳定，避免只生成半张订单。
    if (pending.length) {
      const signature = pending.map(message => message.id).sort().join('|');
      stablePendingReads = signature === pendingSignature ? stablePendingReads + 1 : 0;
      pendingSignature = signature;
      if (hasFixedNow || stablePendingReads >= 2 || attempt === retryDelays.length) break;
    }
  }

  if (!incoming.length) {
    return {
      status: 'empty',
      message: noIncomingMessage(normalizedBinding),
      binding: normalizedBinding,
      pendingCount: 0,
      skippedCount: 0,
    };
  }

  if (!pending.length) {
    return {
      status: 'duplicate',
      message: '读取到的消息都已经生成过订单，没有重复导入',
      binding: nextBinding,
      pendingCount: 0,
      skippedCount: incoming.length,
    };
  }

  const skippedCount = incoming.length - pending.length;
  return {
    status: 'ready',
    message: `已载入 ${pending.length} 条新消息${skippedCount ? `，跳过 ${skippedCount} 条已处理消息` : ''}`,
    binding: nextBinding,
    pendingCount: pending.length,
    skippedCount,
    payload: {
      text: pending.map((message) => message.orderText).join('\n'),
      entries: pending.map((message) => ({
        messageFingerprint: message.id,
        messageTimeMs: message.messageTimeMs,
        text: message.orderText,
      })),
      source: {
        customerId: id,
        accountFingerprint: nextBinding.accountFingerprint,
        conversationFingerprint: nextBinding.conversationFingerprint,
        conversationKind: nextBinding.conversationKind,
        groupMode: nextBinding.groupMode,
        messages: pending.map((message) => ({
          messageFingerprint: message.id,
          messageTimeMs: message.messageTimeMs,
        })),
      },
    },
  };
}
