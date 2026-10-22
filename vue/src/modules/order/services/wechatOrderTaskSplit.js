const TEXT_TASK = 'text';
const IMAGE_TASK = 'image';
const MIXED_TASK = 'mixed';

function messageId(value) {
  return String(value?.messageFingerprint || '');
}

function messageTime(value) {
  const time = Number(value?.messageTimeMs);
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function compareByMessageTime(left, right) {
  return messageTime(left) - messageTime(right)
    || messageId(left).localeCompare(messageId(right));
}

function sourceMessages(payload, messageIds) {
  const messages = Array.isArray(payload?.source?.messages) ? payload.source.messages : [];
  return messages
    .filter(message => messageIds.has(messageId(message)))
    .sort(compareByMessageTime);
}

function createTaskPayload(payload, taskType, entries, images, taskFingerprint = '') {
  const messageIds = new Set([
    ...entries.map(messageId),
    ...images.map(messageId),
  ].filter(Boolean));
  const messages = sourceMessages(payload, messageIds);
  return {
    ...payload,
    taskType,
    ...(taskFingerprint ? { taskFingerprint } : {}),
    text: taskType === TEXT_TASK
      ? entries.map(entry => String(entry?.text || '').trim()).filter(Boolean).join('\n')
      : '',
    images,
    entries,
    source: {
      ...payload.source,
      messages,
    },
  };
}

function imageContentKey(image) {
  const dataUrl = String(image?.dataUrl || '');
  // Only collapse byte-identical recovered originals. Missing image data must
  // remain independent, and visually similar/re-encoded photos must not be
  // guessed to be the same order.
  return dataUrl || `message:${messageId(image)}`;
}

/**
 * Splits the messages from one WeChat conversation into independently savable
 * order tasks.  Image messages must not share a source fingerprint with the
 * text-paste task: saving one task marks only its own WeChat messages handled.
 */
export function splitWechatOrderPayloads(payload) {
  if (!payload?.source) return [];
  const entries = Array.isArray(payload.entries) ? payload.entries.slice().sort(compareByMessageTime) : [];
  const images = Array.isArray(payload.images) ? payload.images.slice().sort(compareByMessageTime) : [];

  // Older callers may not have per-message entries. Keep their original,
  // unsplit payload intact rather than risk marking the same source twice.
  if (!entries.length) {
    const hasText = Boolean(String(payload.text || '').trim());
    if (!hasText && !images.length) return [];
    return [{
      ...payload,
      taskType: hasText && images.length ? MIXED_TASK : (images.length ? IMAGE_TASK : TEXT_TASK),
    }];
  }

  const imageById = new Map(images.map(image => [messageId(image), image]).filter(([id]) => id));
  const imageEntriesById = new Map();
  const textEntries = [];
  entries.forEach((entry) => {
    const id = messageId(entry);
    if (entry?.type === IMAGE_TASK || imageById.has(id)) {
      if (id) imageEntriesById.set(id, entry);
      return;
    }
    if (String(entry?.text || '').trim()) textEntries.push(entry);
  });
  const imageGroups = new Map();
  images.forEach((image) => {
    const fingerprint = messageId(image);
    if (!fingerprint) return;
    const entry = imageEntriesById.get(fingerprint) || {
      messageFingerprint: image.messageFingerprint,
      messageTimeMs: image.messageTimeMs,
      type: IMAGE_TASK,
      text: '',
    };
    const key = imageContentKey(image);
    const group = imageGroups.get(key);
    if (group) {
      group.entries.push(entry);
      return;
    }
    imageGroups.set(key, { image, entries: [entry] });
  });
  const groupedImages = Array.from(imageGroups.values()).sort((left, right) => (
    compareByMessageTime(left.entries[0], right.entries[0])
  ));

  // Text can be parsed locally at once. Put it first so a long-running image
  // recognition request never blocks an already-readable text order. Each
  // distinct source image is deliberately its own task: different photos may
  // be a single-column list, a multi-column list, or an unrelated attachment.
  // If WeChat contains the exact same original bytes more than once, keep one
  // visible image task but claim every physical message in that task. Saving
  // it therefore marks all duplicates handled and they cannot reappear later.
  const tasks = [];
  if (textEntries.length) tasks.push(createTaskPayload(payload, TEXT_TASK, textEntries, []));
  groupedImages.forEach(({ image, entries: groupedEntries }) => {
    const sortedEntries = groupedEntries.slice().sort(compareByMessageTime);
    const fingerprint = messageId(sortedEntries[0]);
    if (!fingerprint || !image) return;
    tasks.push(createTaskPayload(payload, IMAGE_TASK, sortedEntries, [image], fingerprint));
  });
  return tasks;
}

export function wechatOrderTaskLabel(taskType) {
  if (taskType === IMAGE_TASK) return '图片识别任务';
  if (taskType === TEXT_TASK) return '文字粘贴任务';
  return '微信订单任务';
}
