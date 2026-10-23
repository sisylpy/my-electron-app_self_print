import {
  CONVERSATION_GROUP,
  GROUP_MENTION_SELF_ONLY,
  isReadableWechatOrderText,
  mentionsCurrentAccount,
  normalizeConversationKind,
  normalizeGroupMode,
  selectWechatOrderMessages,
} from './wechatOrderMessagePolicy.js';
import { applyCustomerWechatProfile } from '../../../utils/customerWechatProfile.js';

export const WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED = 'WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED';
export const WECHAT_IMAGE_DOWNLOAD_RETRY_DELAYS_MS = Object.freeze([
  500,
  1000,
  2000,
  4000,
  8000,
  15000,
]);

// 微信桌面端可能延迟把已经显示在会话里的消息写入本地数据库。扫描游标只表示
// 上次检查到的位置，因此每次都需要保留足够的重叠窗口；消息台账负责去重。
// 这也避免连续的空扫描把刚写入、但时间稍早的消息永久排除在窗口之外。
const WECHAT_SCAN_OVERLAP_MS = 15 * 60 * 1000;
const WECHAT_SCAN_CLOCK_SKEW_MS = 2 * 60 * 1000;

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
  const error = new Error(response?.error?.message || '读取本地微信数据失败');
  error.code = String(response?.error?.code || 'WECHAT_READER_FAILED');
  error.retryable = response?.error?.retryable === true;
  throw error;
}

export function unwrapWechatServer(response) {
  if (response?.ok) return response.data;
  const status = Number(response?.status);
  const authFailure = status === 401 || status === 403;
  const error = new Error(authFailure
    ? `服务端认证失败：${response?.message || '登录状态已失效'}`
    : (response?.message || '服务器请求失败'));
  error.code = authFailure ? 'SERVER_AUTH_FAILED' : (response?.errorCode || 'SERVER_REQUEST_FAILED');
  error.status = status;
  throw error;
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

export async function safeReadColdStart(electronAPI = window.electronAPI) {
  if (!electronAPI?.wechatReader?.lastColdStart) {
    return { coldStart: false, coldStartMs: 0 };
  }
  try {
    const info = await electronAPI.wechatReader.lastColdStart();
    return info && typeof info === 'object'
      ? { coldStart: Boolean(info.coldStart), coldStartMs: Number(info.coldStartMs) || 0 }
      : { coldStart: false, coldStartMs: 0 };
  } catch {
    return { coldStart: false, coldStartMs: 0 };
  }
}

export function normalizeWechatAvatarSource(value) {
  const source = String(value || '').trim();
  if (!source) return '';
  if (/^data:image\/png;base64,[A-Za-z0-9+/=]+$/u.test(source)) {
    return source.length <= 300000 ? source : '';
  }
  if (source.length > 4096) return '';
  try {
    const url = new URL(source);
    const hostname = url.hostname.toLocaleLowerCase();
    const trustedHost = [
      'qlogo.cn',
      'qpic.cn',
      'weixin.qq.com',
      'wechat.com',
      'weixinbridge.com',
    ].some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
    if (!trustedHost || !['http:', 'https:'].includes(url.protocol)) return '';
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return '';
  }
}

export async function loadWechatConversationAvatar({
  binding,
  conversationTitle,
  electronAPI = window.electronAPI,
}) {
  const snapshot = await loadWechatConversationSnapshot({
    binding,
    conversationTitle,
    electronAPI,
  });
  return snapshot.avatarUrl;
}

export function assertWechatConversationNameCurrent(conversationTitle, snapshot) {
  const title = String(conversationTitle || '').trim() || '该微信会话';
  if (!snapshot?.available) {
    const error = new Error(
      `暂时无法核验微信中是否仍存在“${title}”，本次已停止读取，请稍后重试`
    );
    error.code = 'WECHAT_CONVERSATION_NAME_UNVERIFIED';
    throw error;
  }
  if (snapshot.exists !== false) return snapshot;
  const currentDisplayName = String(snapshot.currentDisplayName || '').trim();
  const error = new Error(
    currentDisplayName
      ? `关联微信名称“${title}”已失效，当前名称是“${currentDisplayName}”。请在客户中心更新后重试`
      : `微信中已找不到“${title}”，名称可能已经修改。请在客户中心更新关联微信名称后重试`
  );
  error.code = 'WECHAT_CONVERSATION_NAME_STALE';
  throw error;
}

export async function loadWechatConversationSnapshot({
  binding,
  conversationTitle,
  electronAPI = window.electronAPI,
}) {
  const normalizedBinding = normalizeWechatBinding(binding);
  const title = String(conversationTitle || normalizedBinding.displayName || '').trim();
  const reader = electronAPI?.wechatReader;
  if (!normalizedBinding.bound || !title || !reader?.findConversation) {
    return {
      available: false,
      exists: null,
      currentDisplayName: '',
      avatarUrl: '',
      lastMessageTimeMs: null,
    };
  }
  try {
    const response = await reader.findConversation(
      normalizedBinding.accountFingerprint,
      title
    );
    if (!response?.ok) {
      if (response?.error?.code === 'CONVERSATION_NOT_FOUND') {
        return {
          available: true,
          exists: false,
          currentDisplayName: '',
          avatarUrl: '',
          lastMessageTimeMs: null,
        };
      }
      return {
        available: false,
        exists: null,
        currentDisplayName: '',
        avatarUrl: '',
        lastMessageTimeMs: null,
      };
    }
    const found = response.result;
    const matches = Array.isArray(found?.matches) ? found.matches : [];
    const fingerprintMatch = matches.find(item => (
      String(item?.id || '') === String(normalizedBinding.conversationFingerprint)
    ));
    const titleMatch = matches.find(item => String(item?.displayName || '').trim() === title);
    const exact = fingerprintMatch
      && String(fingerprintMatch?.displayName || '').trim() === title
      ? fingerprintMatch
      : null;
    const avatarMatch = fingerprintMatch || titleMatch;
    if (!exact) {
      return {
        available: true,
        exists: false,
        currentDisplayName: String(fingerprintMatch?.displayName || '').trim(),
        avatarUrl: normalizeWechatAvatarSource(avatarMatch?.avatarUrl),
        lastMessageTimeMs: null,
      };
    }
    const lastMessageTimeMs = Date.parse(exact.lastMessageAt);
    return {
      available: true,
      exists: true,
      currentDisplayName: String(exact.displayName || '').trim(),
      avatarUrl: normalizeWechatAvatarSource(exact.avatarUrl),
      lastMessageTimeMs: Number.isFinite(lastMessageTimeMs) ? lastMessageTimeMs : null,
    };
  } catch {
    // Preserve the distinction between "name absent" and "could not verify".
    // Automatic order scans fail closed on the latter instead of silently
    // trusting a stable fingerprint with a potentially stale display name.
    return {
      available: false,
      exists: null,
      currentDisplayName: '',
      avatarUrl: '',
      lastMessageTimeMs: null,
    };
  }
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

export function selectNewWechatOrderPayload(payload, knownMessageFingerprints = []) {
  if (!payload?.source) return payload;
  const known = knownMessageFingerprints instanceof Set
    ? knownMessageFingerprints
    : new Set(Array.from(knownMessageFingerprints || []).map(value => String(value || '')));
  const messages = (Array.isArray(payload.source.messages) ? payload.source.messages : [])
    .filter(message => !known.has(String(message?.messageFingerprint || '')));
  const messageIds = new Set(messages.map(message => String(message?.messageFingerprint || '')));
  const entries = payloadEntries(payload)
    .filter(entry => messageIds.has(String(entry?.messageFingerprint || '')));
  const images = payloadImages(payload)
    .filter(image => messageIds.has(String(image?.messageFingerprint || '')));
  const textEntries = entries.filter(entry => String(entry?.text || '').trim());
  const text = entries.length === messages.length
    ? textEntries.map(entry => String(entry.text).trim()).join('\n')
    : messages.length === (Array.isArray(payload.source.messages) ? payload.source.messages.length : 0)
      ? String(payload.text || '')
      : textEntries.map(entry => String(entry.text).trim()).join('\n');
  return {
    ...payload,
    text,
    entries,
    images,
    source: {
      ...payload.source,
      messages,
    },
  };
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
  const currentIds = new Set(currentMessages.map(message => String(message.messageFingerprint)));
  const currentEntryMap = new Map();
  payloadEntries(currentPayload).forEach((entry) => {
    const id = String(entry?.messageFingerprint || '');
    if (id) currentEntryMap.set(id, entry);
  });
  const incomingEntryMap = new Map();
  payloadEntries(incomingPayload).forEach((entry) => {
    const id = String(entry?.messageFingerprint || '');
    if (id) incomingEntryMap.set(id, entry);
  });
  const entryMap = new Map(currentEntryMap);
  incomingEntryMap.forEach((entry, id) => {
    // An existing draft may already contain manual edits. Refreshes may fill
    // missing message metadata, but must never replace an existing entry with
    // a restored task-level draft copied onto that message.
    if (!entryMap.has(id) || !currentIds.has(id)) entryMap.set(id, entry);
  });
  const entries = messages
    .map(message => entryMap.get(String(message.messageFingerprint)))
    .filter(Boolean);
  const currentText = String(currentPayload.text || '');
  const currentEntries = currentMessages
    .map(message => currentEntryMap.get(String(message.messageFingerprint)))
    .filter(Boolean);
  const currentEntryText = currentEntries.map(entry => entry.text).filter(Boolean).join('\n');
  const currentTextIsMessageStructured = currentEntries.length === currentMessages.length
    && currentEntryText === currentText;
  const newMessages = incomingMessages.filter(message => (
    !currentIds.has(String(message?.messageFingerprint || ''))
  ));
  const newEntries = newMessages
    .map(message => incomingEntryMap.get(String(message?.messageFingerprint || '')))
    .filter(Boolean);
  const newEntryText = newEntries.map(entry => entry.text).filter(Boolean).join('\n');

  let text = currentText;
  if (!currentMessages.length) {
    text = String(incomingPayload.text || '');
  } else if (newMessages.length && currentTextIsMessageStructured && entries.length === messages.length) {
    // Untouched drafts can be rebuilt in deterministic message order.
    text = entries.map(entry => entry.text).filter(Boolean).join('\n');
  } else if (newMessages.length && newEntries.length === newMessages.length) {
    // Restored or manually edited drafts are opaque task-level text. Append
    // only verified new messages instead of re-appending the whole scan.
    text = [currentText, newEntryText].filter(Boolean).join('\n');
  } else if (newMessages.length === incomingMessages.length) {
    text = [currentText, incomingPayload.text].filter(Boolean).join('\n');
  }
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

/**
 * 完整性诊断计数：只统计「数量」与「排除原因分类」，绝不记录任何消息内容。
 * 复用策略模块里完全相同的判定函数，保证计数口径与实际筛选一致。
 */
function countWechatMessageSelection(items, participants, binding) {
  const rows = Array.isArray(items) ? items : [];
  const participantRows = Array.isArray(participants) ? participants : [];
  const selfRows = participantRows.filter((item) => item?.isSelf);
  const selfIds = new Set(selfRows.map((item) => item.id));
  const selfNames = selfRows
    .map((item) => String(item.displayName || '').trim())
    .filter(Boolean);
  const conversationKind = normalizeConversationKind(binding?.conversationKind);
  const groupMode = normalizeGroupMode(conversationKind, binding?.groupMode);
  const mentionSelfOnly = conversationKind === CONVERSATION_GROUP
    && groupMode === GROUP_MENTION_SELF_ONLY;
  let rawImageCount = 0;
  let excludedByType = 0;
  let excludedByUnreadable = 0;
  let excludedBySelf = 0;
  let excludedByMention = 0;
  rows.forEach((message) => {
    const type = message?.type;
    if (type === 'image') rawImageCount += 1;
    if (type !== 'image' && type !== 'text') {
      excludedByType += 1;
      return;
    }
    if (type === 'text' && !isReadableWechatOrderText(message.text)) {
      excludedByUnreadable += 1;
      return;
    }
    if (selfIds.has(message.senderId)) {
      excludedBySelf += 1;
      return;
    }
    if (mentionSelfOnly
        && (type !== 'text' || !mentionsCurrentAccount(message.text, selfNames))) {
      excludedByMention += 1;
    }
  });
  return {
    rawMessageCount: rows.length,
    rawImageCount,
    excludedByType,
    excludedByUnreadable,
    excludedBySelf,
    excludedByMention,
  };
}

export async function loadCustomerWechatBinding(customerId, electronAPI = window.electronAPI) {
  const id = requireCustomerId(customerId);
  const api = electronAPI?.customerWechatOrders;
  if (!api?.loadBinding) throw new Error('当前安装包不支持微信聊天订单');
  const binding = normalizeWechatBinding(unwrapWechatServer(await api.loadBinding(id)));
  return normalizeWechatBinding(applyCustomerWechatProfile(id, binding));
}

export async function readWechatMessageWindow({
  reader,
  conversationId,
  startMs,
  endMs,
  onTiming = null,
  attempt = 1,
  pageLimit = 200,
}) {
  const items = [];
  const seen = new Set();
  const seenKeys = new Set();
  let pageKey = null;
  let pageNo = 0;
  while (pageNo < 1000) {
    const page = unwrapWechatReader(await timed(
      onTiming,
      'reader-messages',
      () => reader.getMessages(
        conversationId,
        { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() },
        { limit: pageLimit, pageKey }
      ),
      { attempt, pageNo: pageNo + 1 }
    ));
    const rows = Array.isArray(page?.items) ? page.items : [];
    rows.forEach((message) => {
      const identity = String(message?.id || '');
      if (!identity || seen.has(identity)) return;
      seen.add(identity);
      items.push(message);
    });
    pageNo += 1;
    if (page?.hasMore !== true) break;
    const nextKey = typeof page?.nextPageKey === 'string' && page.nextPageKey
      ? page.nextPageKey : null;
    if (nextKey) {
      if (seenKeys.has(nextKey)) throw new Error('Reader 分页游标重复，扫描已停止且不会提交进度');
      seenKeys.add(nextKey);
      pageKey = nextKey;
      continue;
    }
    throw new Error('Reader 报告仍有后续消息，但没有返回下一页定位信息');
  }
  if (pageNo >= 1000) throw new Error('微信消息分页超过安全上限，扫描已停止且不会提交进度');
  return { items, pageCount: pageNo };
}

function mixedGroupImageMessages(items, participants, binding) {
  if (normalizeConversationKind(binding?.conversationKind) !== CONVERSATION_GROUP
      || normalizeGroupMode(CONVERSATION_GROUP, binding?.groupMode) !== GROUP_MENTION_SELF_ONLY) return [];
  const selfIds = new Set((Array.isArray(participants) ? participants : [])
    .filter(item => item?.isSelf).map(item => String(item.id || '')));
  return (Array.isArray(items) ? items : []).filter(message => (
    message?.type === 'image'
    && !selfIds.has(String(message?.senderId || ''))
    && Number.isFinite(Date.parse(message?.timestamp))
  ));
}

async function commitReliableScan({
  orderApi,
  customerId,
  binding,
  startMs,
  endMs,
  messages,
  onTiming,
}) {
  if (!orderApi?.commitReliableScan || !Number.isSafeInteger(Number(binding?.bindingRevision))) {
    throw new Error('当前客户缺少可靠扫描绑定版本，请重新保存客户微信设置后再读取');
  }
  const scanId = `scan-${customerId}-${endMs}-${Math.random().toString(36).slice(2, 12)}`;
  const response = await timed(onTiming, 'server-scan-v2-commit', () => orderApi.commitReliableScan({
    customerId,
    scanId,
    bindingRevision: Number(binding.bindingRevision),
    protocolVersion: 2,
    windowStartTimeMs: startMs,
    windowEndTimeMs: endMs,
    messages,
  }), { messageCount: messages.length });
  const data = unwrapWechatServer(response);
  return {
    binding: normalizeWechatBinding({
      ...binding,
      scanCursorTimeMs: data?.cursorTimeMs ?? endMs,
      scanProtocolVersion: 2,
    }),
    messageStates: Array.isArray(data?.messageStates) ? data.messageStates : [],
  };
}

async function loadAllPendingWechatMessages(orderApi, params) {
  const items = [];
  const seenAfterIds = new Set();
  let afterId = null;
  while (items.length < 10000) {
    const data = unwrapWechatServer(await orderApi.loadPendingMessages({
      ...params,
      afterId,
      limit: 200,
    }));
    const pageItems = Array.isArray(data?.items) ? data.items : [];
    items.push(...pageItems);
    if (data?.hasMore !== true) break;
    const nextAfterId = Number(data?.nextAfterId);
    if (!Number.isSafeInteger(nextAfterId) || nextAfterId <= 0
        || seenAfterIds.has(nextAfterId)) {
      throw new Error('服务端待恢复消息分页异常，本次已停止读取');
    }
    seenAfterIds.add(nextAfterId);
    afterId = nextAfterId;
  }
  if (items.length >= 10000) throw new Error('待恢复微信消息超过安全上限，请联系管理员处理');
  return items;
}

export async function prepareWechatOrderImport({
  customerId,
  binding,
  now = null,
  retryDelaysMs = [400, 800, 1600],
  returnFirstEmpty = false,
  attachmentRetryDelaysMs = [],
  knownMessageFingerprints = null,
  deferPrepareUntilStable = false,
  sleep = (delayMs) => new Promise(resolve => setTimeout(resolve, delayMs)),
  electronAPI = window.electronAPI,
  onTiming = null,
  coldStartBaseline = null,
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
      || !orderApi?.commitReliableScan
      || !orderApi?.loadPendingMessages
      || !orderApi?.reportAttachment
      || !orderApi?.acknowledgeMixedImage) {
    throw new Error('当前安装包不支持读取微信聊天订单');
  }

  // 首个 reader 请求的响应里带有「本次请求专属」的启动快照（role/generation/startMs），
  // 不会被并发请求覆盖；拿不到快照时只读取全局启动序号用于性能标记。
  const selfParticipantResponse = reader.getSelfParticipant
    ? await timed(
      onTiming,
      'reader-self-participant',
      () => reader.getSelfParticipant(normalizedBinding.conversationFingerprint),
      { mode: 'lightweight' }
    )
    : null;
  const participantsResponse = !reader.getSelfParticipant
    ? await timed(
      onTiming,
      'reader-participants',
      () => reader.getParticipants(normalizedBinding.conversationFingerprint),
      { mode: 'full' }
    )
    : null;
  const participants = reader.getSelfParticipant
    ? [unwrapWechatReader(selfParticipantResponse)].filter(Boolean)
    : unwrapWechatReader(participantsResponse);
  const firstReaderResponse = selfParticipantResponse || participantsResponse;

  const coldBaseline = coldStartBaseline != null
    ? coldStartBaseline
    : await safeReadColdStart(electronAPI);
  const startSnapshot = (firstReaderResponse && firstReaderResponse.start)
    || await safeReadColdStart(electronAPI);
  const generationDelta = (Number(startSnapshot.generation) || 0)
    - (Number(coldBaseline?.generation) || 0);
  // 拿不到专属快照时角色未知，不能冒充 warm，否则会掩盖真实的冷启动。
  const startRole = startSnapshot.role ? String(startSnapshot.role) : 'unknown';
  const startedThisTrace = generationDelta > 0 || startRole === 'shared';
  if (startedThisTrace) {
    emitTiming(onTiming, 'reader-cold-start', timingNow(), {
      // coldStart=true 表示本次 trace 主动发起了启动；
      // shared 表示只是等待了预热已发起的启动，两者在报表中分开统计。
      coldStart: startRole === 'active',
      startRole,
      startGeneration: Number(startSnapshot.generation) || 0,
      startGenerationDelta: generationDelta,
      coldStartMs: Number(startSnapshot.startMs) || 0,
    });
  }
  const cursor = Number(normalizedBinding.scanCursorTimeMs);
  const fixedNow = Number(now);
  const hasFixedNow = Number.isFinite(fixedNow) && fixedNow > 0;
  const retryDelays = Array.isArray(retryDelaysMs)
    ? retryDelaysMs.filter(delayMs => Number.isFinite(Number(delayMs)) && Number(delayMs) >= 0)
    : [];
  const attachmentRetryDelays = Array.isArray(attachmentRetryDelaysMs)
    ? attachmentRetryDelaysMs
      .map(delayMs => Number(delayMs))
      .filter(delayMs => Number.isFinite(delayMs) && delayMs >= 0)
    : [];
  const hasKnownSnapshot = knownMessageFingerprints !== null
    && knownMessageFingerprints !== undefined;
  const knownFingerprints = new Set(
    hasKnownSnapshot
      ? Array.from(knownMessageFingerprints).map(value => String(value || '')).filter(Boolean)
      : []
  );
  let incoming = [];
  let relevantIncoming = [];
  let pending = [];
  let nextBinding = normalizedBinding;
  let pendingSignature = '';
  let stablePendingReads = 0;
  let queryStartTimeMs = null;
  let queryEndTimeMs = null;
  let latestObservedMessageTimeMs = null;
  let mixedImages = [];
  // Keep the query window stable during one synchronization. Together with
  // the Reader's DB/WAL change token this makes unchanged verification reads
  // memory-fast, while a newly written WeChat message still invalidates cache.
  const scanNow = hasFixedNow ? fixedNow : Date.now();
  let recoveryWindowStartMs = null;
  if (Number.isFinite(cursor) && cursor > 0) {
    const priorRecoveryRows = await timed(
      onTiming,
      'server-pending-preflight',
      () => loadAllPendingWechatMessages(orderApi, {
        customerId: id,
        accountFingerprint: normalizedBinding.accountFingerprint,
        conversationFingerprint: normalizedBinding.conversationFingerprint,
      })
    );
    const unclaimedTimes = priorRecoveryRows
      .filter(row => row?.status === 'RECEIVED'
        && row?.processingState === 'UNCLAIMED'
        && row?.wechatTaskId == null)
      .map(row => Number(row?.messageTimeMs))
      .filter(value => Number.isFinite(value) && value > 0);
    if (unclaimedTimes.length) {
      recoveryWindowStartMs = Math.max(0, Math.min(...unclaimedTimes) - WECHAT_SCAN_CLOCK_SKEW_MS);
    }
  }

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
    const normalStartMs = Number.isFinite(cursor) && cursor > 0
      ? Math.max(0, cursor - WECHAT_SCAN_OVERLAP_MS)
      : attemptNow - 24 * 60 * 60 * 1000;
    const startMs = Number.isFinite(recoveryWindowStartMs)
      ? Math.min(normalStartMs, recoveryWindowStartMs)
      : normalStartMs;
    // 微信消息使用服务端时间，刚到达的消息可能比电脑当前时间快几十秒。
    // 如果查询上限严格等于点击时刻，界面中已经可见的未读消息仍会被排除。
    const endMs = attemptNow + WECHAT_SCAN_CLOCK_SKEW_MS;
    queryStartTimeMs = startMs;
    queryEndTimeMs = endMs;
    const page = await readWechatMessageWindow({
      reader,
      conversationId: normalizedBinding.conversationFingerprint,
      startMs,
      endMs,
      onTiming,
      attempt: attempt + 1,
    });
    const pageItems = page.items;
    mixedImages = mixedGroupImageMessages(pageItems, participants, normalizedBinding);
    pageItems.forEach((message) => {
      const messageTimeMs = Date.parse(message?.timestamp);
      if (!Number.isFinite(messageTimeMs)) return;
      latestObservedMessageTimeMs = latestObservedMessageTimeMs === null
        ? messageTimeMs
        : Math.max(latestObservedMessageTimeMs, messageTimeMs);
    });
    const filterStartedAt = timingNow();
    incoming = selectWechatOrderMessages(pageItems, participants, normalizedBinding)
      .map((message) => ({ ...message, messageTimeMs: Date.parse(message.timestamp) }))
      .filter((message) => Number.isFinite(message.messageTimeMs))
      .sort((left, right) => (
        left.messageTimeMs - right.messageTimeMs
        || String(left.id).localeCompare(String(right.id))
      ));
    const selectionCounts = countWechatMessageSelection(
      pageItems,
      participants,
      normalizedBinding
    );
    // pageItems 是 Reader 原始条目，时间字段是 timestamp；messageTimeMs 是后面
    // 映射 incoming 时才附加的，这里必须用 timestamp。
    const observedTimes = pageItems
      .map((message) => Date.parse(message?.timestamp))
      .filter((value) => Number.isFinite(value));
    const oldestObservedMs = observedTimes.length ? Math.min(...observedTimes) : null;
    const newestObservedMs = observedTimes.length ? Math.max(...observedTimes) : null;
    const unparsableTimeCount = pageItems.length
      - pageItems.filter((message) => Number.isFinite(Date.parse(message?.timestamp))).length;
    emitTiming(onTiming, 'message-filter', filterStartedAt, {
      attempt: attempt + 1,
      incomingCount: incoming.length,
      knownCount: hasKnownSnapshot
        ? incoming.filter(message => knownFingerprints.has(String(message.id))).length
        : 0,
      // ---- 完整性统计（仅数量，不含任何消息内容）----
      rawMessageCount: selectionCounts.rawMessageCount,
      selectedCount: incoming.length,
      rawImageCount: selectionCounts.rawImageCount,
      selectedImageCount: incoming.filter(message => message.type === 'image').length,
      excludedByType: selectionCounts.excludedByType,
      excludedByUnreadable: selectionCounts.excludedByUnreadable,
      excludedBySelf: selectionCounts.excludedBySelf,
      excludedByMention: selectionCounts.excludedByMention,
      excludedByUnparsableTime: unparsableTimeCount,
      // 返回条数达到本页上限只代表「本页已满、可能还有后续数据」。
      // 是否真的有后续，以 Reader 的稳定 Keyset pageKey 为准。
      pageOffset: 0,
      pageLimit: 200,
      pageFull: selectionCounts.rawMessageCount >= 200,
      pageCount: page.pageCount,
      queryStartTimeMs,
      queryEndTimeMs,
      // 黑盒判定排序方向用：观察窗口内最旧/最新消息距窗口两端的距离。
      // newestGapToWindowEndMs 很大 => 返回的是窗口前段（升序，最新被截掉）；
      // oldestDeltaFromWindowStartMs 很大 => 返回的是窗口后段（降序，最旧被截掉）。
      oldestDeltaFromWindowStartMs: Number.isFinite(queryStartTimeMs) && oldestObservedMs != null
        ? oldestObservedMs - queryStartTimeMs
        : null,
      newestGapToWindowEndMs: Number.isFinite(queryEndTimeMs) && newestObservedMs != null
        ? queryEndTimeMs - newestObservedMs
        : null,
    });
    // A database-first scan still has a separate, exact visible-conversation
    // fallback before an empty result can be accepted. Do not spend every
    // retry delay proving the same empty snapshot here; the post-focus read
    // remains the authoritative hydration check. Reads that already contain
    // messages keep all stability retries unchanged.
    if (!incoming.length) {
      if (returnFirstEmpty) break;
      continue;
    }

    relevantIncoming = hasKnownSnapshot
      ? incoming.filter(message => !knownFingerprints.has(String(message.id)))
      : incoming;
    if (!relevantIncoming.length) {
      pending = [];
      continue;
    }
    pending = relevantIncoming;
    // 微信窗口被点开后，客户端可能先写入一部分旧消息，再延迟写入最新消息。
    // 生产读取必须等候待处理消息连续两次保持稳定，避免只生成半张订单。
    if (pending.length) {
      const signature = pending.map(message => message.id).sort().join('|');
      stablePendingReads = signature === pendingSignature ? stablePendingReads + 1 : 0;
      pendingSignature = signature;
      if (hasFixedNow || stablePendingReads >= 2 || attempt === retryDelays.length) break;
    }
  }

  const ledgerMessages = [
    ...incoming.map(message => ({
      messageFingerprint: message.id,
      messageTimeMs: message.messageTimeMs,
      messageKind: message.type === 'image' ? 'IMAGE' : 'TEXT',
      processingState: message.type === 'image' ? 'ATTACHMENT_PENDING' : 'UNCLAIMED',
      readerLocator: message?.attachmentRef?.locator || null,
      readerAttachmentId: message?.attachmentRef?.id || null,
    })),
    ...mixedImages.map(message => ({
      messageFingerprint: message.id,
      messageTimeMs: Date.parse(message.timestamp),
      messageKind: 'IMAGE',
      processingState: 'MIXED_IMAGE_NOTICE_PENDING',
      readerLocator: message?.attachmentRef?.locator || null,
      readerAttachmentId: message?.attachmentRef?.id || null,
    })),
  ];
  const uniqueLedgerMessages = Array.from(new Map(
    ledgerMessages.map(message => [String(message.messageFingerprint), message])
  ).values());
  const scanCommit = await commitReliableScan({
    orderApi,
    customerId: id,
    binding: nextBinding,
    startMs: queryStartTimeMs,
    endMs: queryEndTimeMs,
    messages: uniqueLedgerMessages,
    onTiming,
  });
  nextBinding = scanCommit.binding;
  const scanStateByFingerprint = new Map(scanCommit.messageStates.map(state => (
    [String(state?.messageFingerprint || ''), state]
  )));
  pending = relevantIncoming.filter((message) => {
    const state = scanStateByFingerprint.get(String(message.id));
    if (!state || state.status !== 'RECEIVED' || state.wechatTaskId != null) return false;
    if (message.type === 'image') {
      return ['UNCLAIMED', 'ATTACHMENT_PENDING', 'ATTACHMENT_UNAVAILABLE']
        .includes(state.processingState);
    }
    return state.processingState === 'UNCLAIMED';
  });
  let recoveryRows = [];
  let mixedImageWarning = '';
  {
    recoveryRows = await loadAllPendingWechatMessages(orderApi, {
      customerId: id,
      accountFingerprint: nextBinding.accountFingerprint,
      conversationFingerprint: nextBinding.conversationFingerprint,
    });
    const notices = recoveryRows.filter(row => row?.processingState === 'MIXED_IMAGE_NOTICE_PENDING');
    if (notices.length) {
      mixedImageWarning = `发现 ${notices.length} 张混合群图片，请到微信确认是否属于当前配送商`;
      await Promise.all(notices.map(row => orderApi.acknowledgeMixedImage({
        customerId: id,
        messageFingerprint: row.messageFingerprint,
      })));
    }
  }
  const hasRecoverableAttachment = recoveryRows.some(row => (
    ['ATTACHMENT_PENDING', 'ATTACHMENT_UNAVAILABLE'].includes(row?.processingState)
    && row?.readerAttachmentId
    && row?.readerLocator
  ));

  if (!incoming.length && !hasRecoverableAttachment) {
    return {
      status: 'empty',
      message: mixedImageWarning
        ? `${noIncomingMessage(normalizedBinding)}；${mixedImageWarning}`
        : noIncomingMessage(normalizedBinding),
      binding: nextBinding,
      pendingCount: 0,
      skippedCount: 0,
      queryStartTimeMs,
      queryEndTimeMs,
      latestObservedMessageTimeMs,
      warning: mixedImageWarning,
    };
  }

  if (hasKnownSnapshot && !relevantIncoming.length && !hasRecoverableAttachment) {
    return {
      status: 'current',
      message: '当前会话已经是最新内容',
      binding: nextBinding,
      pendingCount: 0,
      skippedCount: 0,
      queryStartTimeMs,
      queryEndTimeMs,
      latestObservedMessageTimeMs,
      warning: mixedImageWarning,
    };
  }

  if (!pending.length && !hasRecoverableAttachment) {
    const allMessagesRegistered = relevantIncoming.every(message => (
      scanStateByFingerprint.has(String(message.id))
    ));
    return {
      status: allMessagesRegistered ? 'duplicate' : 'conflict',
      message: allMessagesRegistered
        ? '读取到的消息都已经生成过订单，没有重复导入'
        : '可靠扫描未返回完整的消息状态，本次没有生成任务，请重新读取',
      binding: nextBinding,
      pendingCount: 0,
      skippedCount: relevantIncoming.length,
      queryStartTimeMs,
      queryEndTimeMs,
      latestObservedMessageTimeMs,
    };
  }

  const skippedCount = relevantIncoming.length - pending.length;
  const pendingImages = pending.filter(message => message.type === 'image');
  let images = [];
  let deferredImages = [];
  if (pendingImages.length) {
    if (!reader.getAttachment) throw new Error('当前安装包不支持读取微信图片，请升级后重试');
    const attachmentResults = await timed(
      onTiming,
      'reader-attachments',
      () => Promise.all(pendingImages.map(async (message) => {
        const attachmentId = message?.attachmentRef?.id;
        if (!attachmentId) throw new Error('微信图片缺少附件标识，请重新读取消息');
        for (let attempt = 0; attempt <= attachmentRetryDelays.length; attempt += 1) {
          if (attempt > 0) {
            const delayMs = attachmentRetryDelays[attempt - 1];
            await timed(
              onTiming,
              'reader-attachment-download-wait',
              () => sleep(delayMs),
              { attempt: attempt + 1, delayMs }
            );
          }
          try {
            const attachment = unwrapWechatReader(await reader.getAttachment(
              attachmentId,
              message?.attachmentRef?.locator || null
            ));
            try {
              unwrapWechatServer(await orderApi.reportAttachment({
                customerId: id,
                messageFingerprint: message.id,
                recovered: true,
              }));
            } catch (error) {
              return {
                deferred: {
                  messageFingerprint: message.id,
                  messageTimeMs: message.messageTimeMs,
                },
              };
            }
            return {
              image: {
                messageFingerprint: message.id,
                messageTimeMs: message.messageTimeMs,
                mimeType: attachment.mimeType,
                size: attachment.size,
                dataUrl: attachment.dataUrl,
              },
            };
          } catch (error) {
            if (error?.code === WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED
                && attempt < attachmentRetryDelays.length) continue;
            try {
              unwrapWechatServer(await orderApi.reportAttachment({
                customerId: id,
                messageFingerprint: message.id,
                recovered: false,
                errorCode: error?.code || 'ATTACHMENT_RECOVERY_FAILED',
              }));
            } catch (_) {
              // The durable row is already ATTACHMENT_PENDING. A reporting
              // outage must not block text orders; the next scan retries it.
            }
            return {
              deferred: {
                messageFingerprint: message.id,
                messageTimeMs: message.messageTimeMs,
              },
            };
          }
        }
        throw new Error('微信图片自动下载重试状态异常');
      })),
      { imageCount: pendingImages.length }
    );
    images = attachmentResults.map(result => result.image).filter(Boolean);
    deferredImages = attachmentResults.map(result => result.deferred).filter(Boolean);
    // 附件结果计数：成功取回 / 原图未下载待补齐 / 彻底失败（此处失败会抛错，
    // 因此记为 0 只代表「本次未走到失败分支」）。
    // 同样是结果快照阶段（durationMs≈0），真实耗时请读 reader-attachments。
    emitTiming(onTiming, 'attachment-result', timingNow(), {
      pendingImageCount: pendingImages.length,
      imageSuccessCount: images.length,
      imageDeferredCount: deferredImages.length,
      imageFailedCount: Math.max(0, pendingImages.length - images.length - deferredImages.length),
    });
  }
  if (reader.getAttachment && recoveryRows.length) {
    const currentIds = new Set(pendingImages.map(message => String(message.id)));
    const recoverable = recoveryRows.filter(row => (
      !currentIds.has(String(row?.messageFingerprint || ''))
      && ['ATTACHMENT_PENDING', 'ATTACHMENT_UNAVAILABLE'].includes(row?.processingState)
      && row?.readerAttachmentId
      && row?.readerLocator
    )).slice(0, 4);
    const recovered = await Promise.all(recoverable.map(async (row) => {
      try {
        const attachment = unwrapWechatReader(await reader.getAttachment(
          row.readerAttachmentId,
          row.readerLocator
        ));
        unwrapWechatServer(await orderApi.reportAttachment({
          customerId: id,
          messageFingerprint: row.messageFingerprint,
          recovered: true,
        }));
        return {
          message: {
            id: row.messageFingerprint,
            messageTimeMs: Number(row.messageTimeMs),
            type: 'image',
            orderText: '',
          },
          image: {
            messageFingerprint: row.messageFingerprint,
            messageTimeMs: Number(row.messageTimeMs),
            mimeType: attachment.mimeType,
            size: attachment.size,
            dataUrl: attachment.dataUrl,
          },
        };
      } catch (error) {
        try {
          unwrapWechatServer(await orderApi.reportAttachment({
            customerId: id,
            messageFingerprint: row.messageFingerprint,
            recovered: false,
            errorCode: error?.code || 'ATTACHMENT_RECOVERY_FAILED',
          }));
        } catch (_) {
          // Pending is already durable. Recovery/reporting outages do not
          // block newly read text orders and will be retried next time.
        }
        return null;
      }
    }));
    recovered.filter(Boolean).forEach((entry) => {
      pending.push(entry.message);
      images.push(entry.image);
    });
  }
  const availableImageIds = new Set(images.map(image => String(image.messageFingerprint)));
  const processablePending = pending.filter(message => (
    message.type !== 'image' || availableImageIds.has(String(message.id))
  ));
  const deferredImageCount = deferredImages.length;
  const deferredMessage = deferredImageCount
    ? `${deferredImageCount} 张图片原图仍在下载，将在后续自动读取时继续重试`
    : '';
  if (!processablePending.length && deferredImageCount) {
    return {
      status: 'deferred',
      message: [deferredMessage, mixedImageWarning].filter(Boolean).join('；'),
      binding: nextBinding,
      pendingCount: pending.length,
      skippedCount,
      deferredImageCount,
      queryStartTimeMs,
      queryEndTimeMs,
      latestObservedMessageTimeMs,
      warning: mixedImageWarning || deferredMessage,
    };
  }
  const payloadStartedAt = timingNow();
  const payload = {
    text: processablePending.map((message) => message.orderText).filter(Boolean).join('\n'),
    images,
    entries: processablePending.map((message) => ({
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
      bindingRevision: nextBinding.bindingRevision,
      messages: processablePending.map((message) => ({
        messageFingerprint: message.id,
        messageTimeMs: message.messageTimeMs,
      })),
    },
  };
  emitTiming(onTiming, 'payload-build', payloadStartedAt, {
    pendingCount: pending.length,
    imageCount: images.length,
    // 真正进入订单确认流程（写入 payload.source.messages）的消息数量。
    confirmedMessageCount: processablePending.length,
    deferredImageCount,
    skippedCount,
  });
  return {
    status: 'ready',
    message: `已载入 ${processablePending.length} 条新消息${skippedCount ? `，跳过 ${skippedCount} 条已处理消息` : ''}${deferredMessage ? `；${deferredMessage}` : ''}`,
    binding: nextBinding,
    pendingCount: processablePending.length,
    skippedCount,
    deferredImageCount,
    warning: [deferredMessage, mixedImageWarning].filter(Boolean).join('；'),
    payload,
  };
}
