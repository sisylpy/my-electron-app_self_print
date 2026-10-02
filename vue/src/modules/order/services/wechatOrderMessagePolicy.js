export const CONVERSATION_DIRECT = 'direct';
export const CONVERSATION_GROUP = 'group';
export const GROUP_ALL_MEMBER_MESSAGES = 'ALL_MEMBER_MESSAGES';
export const GROUP_MENTION_SELF_ONLY = 'MENTION_SELF_ONLY';

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
      || (message?.type === 'text' && typeof message.text === 'string' && message.text.trim()))
    .filter((message) => !selfIds.has(message.senderId));

  if (conversationKind === CONVERSATION_GROUP && groupMode === GROUP_MENTION_SELF_ONLY) {
    // 图片本身无法证明它 @ 了当前账号；该群模式下只接收可验证的文字消息。
    candidates = candidates.filter((message) => (
      message.type === 'text' && mentionsCurrentAccount(message.text, selfNames)
    ));
  }

  return candidates
    .map((message) => ({
      ...message,
      orderText: message.type === 'text'
        ? conversationKind === CONVERSATION_GROUP && groupMode === GROUP_MENTION_SELF_ONLY
          ? stripCurrentAccountMentions(message.text, selfNames)
          : message.text.trim()
        : '',
    }))
    .filter((message) => message.type === 'image' || message.orderText);
}
