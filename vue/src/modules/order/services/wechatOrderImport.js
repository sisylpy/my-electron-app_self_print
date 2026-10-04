import {
  CONVERSATION_GROUP,
  GROUP_MENTION_SELF_ONLY,
  normalizeConversationKind,
  normalizeGroupMode,
  selectWechatOrderMessages,
} from './wechatOrderMessagePolicy.js';

function timingNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function roundedDuration(startedAt) {
  return Math.round((timingNow() - startedAt) * 100) / 100;
}

function emitTiming(onTiming, stage, startedAt, meta = {}) {
  if (typeof onTiming !== 'function') return;
  try {
    onTiming({ stage, durationMs: roundedDuration(startedAt), ...meta });
  } catch {
    // 性能日志不能影响微信订单读取主流程。
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

function payloadImages(payload) {
  return Array.isArray(payload?.images) ? payload.images : [];
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
    ? entries.map(entry => entry.text).filter(Boolean).join('\n')
    : incomingContainsCurrent
      ? incomingPayload.text
      : [currentPayload.text, incomingPayload.text].filter(Boolean).join('\n');
  return {
    ...incomingPayload,
    text,
    entries,
    images: Array.from(new Map(
      [...payloadImages(currentPayload), ...payloadImages(incomingPayload)]
        .map(image => [String(image?.messageFingerprint || ''), image])
        .filter(([id]) => id)
    ).values()),
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
    return '所选时间范围内没有新的群成员文字或图片消息';
  }
  return '所选时间范围内没有新的好友文字或图片消息';
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
  retryDelaysMs = [400, 800, 1600],
  sleep = (delayMs) => new Promise(resolve => setTimeout(resolve, delayMs)),
  electronAPI = window.electronAPI,
  onTiming = null,
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
  if ((!reader?.getSelfParticipant && !reader?.getParticipants)
      || !reader?.getMessages
      || !orderApi?.prepareMessages) {
    throw new Error('当前安装包不支持读取微信聊天订单');
  }

  const participants = reader.getSelfParticipant
    ? [unwrapWechatReader(await timed(
      onTiming,
      'reader-self-participant',
      () => reader.getSelfParticipant(normalizedBinding.conversationFingerprint),
      { mode: 'lightweight' }
    ))].filter(Boolean)
    : unwrapWechatReader(await timed(
      onTiming,
      'reader-participants',
      () => reader.getParticipants(normalizedBinding.conversationFingerprint),
      { mode: 'full' }
    ));
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
  let preparedIncomingSignature = '';
  // Keep the query window stable during one synchronization. Together with
  // the Reader's DB/WAL change token this makes unchanged verification reads
  // memory-fast, while a newly written WeChat message still invalidates cache.
  const scanNow = hasFixedNow ? fixedNow : Date.now();

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    if (attempt > 0) {
      const delayMs = Number(retryDelays[attempt - 1]);
      await timed(
        onTiming,
        'reader-stability-wait',
        () => sleep(delayMs),
        { attempt: attempt + 1, delayMs }
      );
    }
    const attemptNow = scanNow;
    const startMs = Number.isFinite(cursor) && cursor > 0
      ? Math.max(0, cursor - 2 * 60 * 1000)
      : attemptNow - 24 * 60 * 60 * 1000;
    // 微信消息使用服务端时间，刚到达的消息可能比电脑当前时间快几十秒。
    // 如果查询上限严格等于点击时刻，界面中已经可见的未读消息仍会被排除。
    const endMs = attemptNow + 2 * 60 * 1000;
    const page = unwrapWechatReader(await timed(
      onTiming,
      'reader-messages',
      () => reader.getMessages(
        normalizedBinding.conversationFingerprint,
        { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() },
        { offset: 0, limit: 200 }
      ),
      { attempt: attempt + 1 }
    ));
    const filterStartedAt = timingNow();
    incoming = selectWechatOrderMessages(page?.items, participants, normalizedBinding)
      .map((message) => ({ ...message, messageTimeMs: Date.parse(message.timestamp) }))
      .filter((message) => Number.isFinite(message.messageTimeMs))
      .sort((left, right) => (
        left.messageTimeMs - right.messageTimeMs
        || String(left.id).localeCompare(String(right.id))
      ));
    emitTiming(onTiming, 'message-filter', filterStartedAt, {
      attempt: attempt + 1,
      incomingCount: incoming.length,
    });
    if (!incoming.length) continue;

    const incomingSignature = incoming.map(message => message.id).sort().join('|');
    if (incomingSignature !== preparedIncomingSignature) {
      prepared = unwrapWechatServer(await timed(
        onTiming,
        'server-prepare-messages',
        () => orderApi.prepareMessages(
          id,
          incoming.map((message) => ({
            messageFingerprint: message.id,
            messageTimeMs: message.messageTimeMs,
          }))
        ),
        { attempt: attempt + 1, incomingCount: incoming.length }
      ));
      preparedIncomingSignature = incomingSignature;
    }
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
    const processedCount = Number(prepared?.processedCount);
    const allMessagesProcessed = Number.isFinite(processedCount)
      && processedCount >= incoming.length;
    return {
      status: allMessagesProcessed ? 'duplicate' : 'conflict',
      message: allMessagesProcessed
        ? '读取到的消息都已经生成过订单，没有重复导入'
        : '读取到了微信消息，但后台没有返回完整的处理状态，请重新关联客户后重试',
      binding: nextBinding,
      pendingCount: 0,
      skippedCount: incoming.length,
    };
  }

  const skippedCount = incoming.length - pending.length;
  const pendingImages = pending.filter(message => message.type === 'image');
  let images = [];
  if (pendingImages.length) {
    if (!reader.getAttachment) throw new Error('当前安装包不支持读取微信图片，请升级后重试');
    images = await timed(
      onTiming,
      'reader-attachments',
      () => Promise.all(pendingImages.map(async (message) => {
        const attachmentId = message?.attachmentRef?.id;
        if (!attachmentId) throw new Error('微信图片缺少附件标识，请重新读取消息');
        const attachment = unwrapWechatReader(await reader.getAttachment(attachmentId));
        return {
          messageFingerprint: message.id,
          messageTimeMs: message.messageTimeMs,
          mimeType: attachment.mimeType,
          size: attachment.size,
          dataUrl: attachment.dataUrl,
        };
      })),
      { imageCount: pendingImages.length }
    );
  }
  const payloadStartedAt = timingNow();
  const payload = {
    text: pending.map((message) => message.orderText).filter(Boolean).join('\n'),
    images,
    entries: pending.map((message) => ({
      messageFingerprint: message.id,
      messageTimeMs: message.messageTimeMs,
      type: message.type,
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
  };
  emitTiming(onTiming, 'payload-build', payloadStartedAt, {
    pendingCount: pending.length,
    imageCount: images.length,
  });
  return {
    status: 'ready',
    message: `已载入 ${pending.length} 条新消息${skippedCount ? `，跳过 ${skippedCount} 条已处理消息` : ''}`,
    binding: nextBinding,
    pendingCount: pending.length,
    skippedCount,
    payload,
  };
}
