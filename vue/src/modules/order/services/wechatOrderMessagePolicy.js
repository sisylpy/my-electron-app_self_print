export const CONVERSATION_DIRECT = 'direct';
export const CONVERSATION_GROUP = 'group';
export const GROUP_ALL_MEMBER_MESSAGES = 'ALL_MEMBER_MESSAGES';
export const GROUP_MENTION_SELF_ONLY = 'MENTION_SELF_ONLY';

// The reader must never turn a media/blob payload into a paste-order task.
// Keep normal order separators (tabs and line breaks), but reject replacement
// characters and the binary control range that cannot occur in customer text.
const UNREADABLE_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]/u;
const MEANINGFUL_TEXT = /[\p{L}\p{N}]/u;
const VISIBLE_TEXT = /[^\s]/u;
const WECHAT_MEDIA_PLACEHOLDER = /^\s*\[(?:图片|动画表情|表情|文件|视频|语音)\]\s*$/u;

/**
 * A conservative last-line guard for reader data. Message type alone is not
 * enough: malformed local records can present binary/attachment content as a
 * type=1 string. Do not reject ordinary Chinese order text, punctuation, or
 * multi-line messages; only discard objectively unreadable payloads.
 */
export function isReadableWechatOrderText(value) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (!text || UNREADABLE_TEXT.test(text) || WECHAT_MEDIA_PLACEHOLDER.test(text)) return false;

  const visible = Array.from(text).filter(character => VISIBLE_TEXT.test(character));
  if (!visible.length) return false;
  const meaningfulCount = visible.filter(character => MEANINGFUL_TEXT.test(character)).length;
  // A lone ASCII letter wrapped by punctuation (for example "‹/›y") is a
  // common symptom of a binary payload decoded as UTF-8, not an order line.
  return meaningfulCount > 0 && meaningfulCount / visible.length >= 0.35;
}

export function normalizeConversationKind(value) {
  return value === CONVERSATION_GROUP ? CONVERSATION_GROUP : CONVERSATION_DIRECT;
}

export function normalizeGroupMode(conversationKind, value) {
  if (conversationKind !== CONVERSATION_GROUP) return null;
  return value === GROUP_ALL_MEMBER_MESSAGES
    ? GROUP_ALL_MEMBER_MESSAGES
    : GROUP_MENTION_SELF_ONLY;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentionPattern(name, global = false) {
  const flags = global ? 'gu' : 'u';
  return new RegExp(`[@＠]\\s*${escapeRegExp(name)}(?=$|[\\s\\u2005,，:：])`, flags);
}

export function mentionsCurrentAccount(text, selfNames) {
  const source = String(text || '');
  return selfNames.some((name) => name && mentionPattern(name).test(source));
}

export function stripCurrentAccountMentions(text, selfNames) {
  let output = String(text || '');
  selfNames.forEach((name) => {
    if (name) output = output.replace(mentionPattern(name, true), '');
  });
  return output.replace(/^[\s\u2005]+/u, '').trim();
}

export function selectWechatOrderMessages(items, participants, binding) {
  const participantRows = Array.isArray(participants) ? participants : [];
  const selfRows = participantRows.filter((item) => item?.isSelf);
  const selfIds = new Set(selfRows.map((item) => item.id));
  if (!selfIds.size) throw new Error('无法识别当前微信账号，请先确认 Reader 数据状态');

  const selfNames = selfRows
    .map((item) => String(item.displayName || '').trim())
    .filter(Boolean);
  const conversationKind = normalizeConversationKind(binding?.conversationKind);
  const groupMode = normalizeGroupMode(conversationKind, binding?.groupMode);
  let candidates = (Array.isArray(items) ? items : [])
    .filter((message) => message?.type === 'image'
      || (message?.type === 'text' && isReadableWechatOrderText(message.text)))
    .filter((message) => !selfIds.has(message.senderId));

  if (conversationKind === CONVERSATION_GROUP && groupMode === GROUP_MENTION_SELF_ONLY) {
    // 图片本身无法证明它 @ 了当前账号；该群模式下只接收可验证的文字消息。
    candidates = candidates.filter((message) => (
      message.type === 'text' && mentionsCurrentAccount(message.text, selfNames)
    ));
  }

  return candidates
    .map((message) => {
      const orderText = message.type === 'text'
        ? conversationKind === CONVERSATION_GROUP && groupMode === GROUP_MENTION_SELF_ONLY
          ? stripCurrentAccountMentions(message.text, selfNames)
          : message.text.trim()
        : '';
      return { ...message, orderText };
    })
    .filter((message) => message.type === 'image' || isReadableWechatOrderText(message.orderText));
}
