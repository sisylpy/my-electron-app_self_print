const { ReaderBridge } = require('./reader-bridge');
const { ReaderError, transportError, TRANSPORT_ERROR } = require('./reader-errors');
const {
  decodeWechatImageEnvelopeAsync,
  WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED,
} = require('./image-container-decoder');

let bridge = null;
let shutdownPromise = null;

function getBridge(appLogger) {
  if (!bridge) bridge = new ReaderBridge({ appLogger });
  return bridge;
}

function requireString(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw transportError(TRANSPORT_ERROR.BAD_REQUEST, `${name} 参数无效`);
  }
  return value.trim();
}

function normalizePage(page) {
  const offset = Number.isFinite(Number(page?.offset)) ? Math.max(0, Math.floor(Number(page.offset))) : 0;
  const rawLimit = Number.isFinite(Number(page?.limit)) ? Math.floor(Number(page.limit)) : 50;
  return { offset, limit: Math.min(200, Math.max(1, rawLimit)) };
}

function normalizeTimeRange(timeRange) {
  const output = {};
  if (typeof timeRange?.start === 'string' && timeRange.start) output.start = timeRange.start;
  if (typeof timeRange?.end === 'string' && timeRange.end) output.end = timeRange.end;
  return Object.keys(output).length ? output : undefined;
}

function createWechatReaderService(appLogger) {
  const request = (method, params) => getBridge(appLogger).request(method, params);

  async function run(work) {
    try {
      return { ok: true, result: await work() };
    } catch (error) {
      const payload = error instanceof ReaderError
        ? error.payload
        : transportError(TRANSPORT_ERROR.PROTOCOL_ERROR, '读取本地微信数据失败').payload;
      return { ok: false, error: payload };
    }
  }

  return Object.freeze({
    diagnose: () => run(() => request('diagnose', {})),
    listAccounts: () => run(() => request('listAccounts', {})),
    warmUp: () => run(() => request('listAccounts', { warmMessages: true })),
    findConversation: (input) => run(() => request('findConversation', {
      accountId: requireString(input?.accountId, 'accountId'),
      name: requireString(input?.name, 'name'),
    })),
    getParticipants: (input) => run(() => request('getParticipants', {
      conversationId: requireString(input?.conversationId, 'conversationId'),
    })),
    getSelfParticipant: (input) => run(async () => {
      const participants = await request('getParticipants', {
        conversationId: requireString(input?.conversationId, 'conversationId'),
        selfOnly: true,
      });
      return Array.isArray(participants) ? participants[0] || null : null;
    }),
    getMessages: (input) => run(() => {
      const params = {
        conversationId: requireString(input?.conversationId, 'conversationId'),
        page: normalizePage(input?.page),
      };
      const timeRange = normalizeTimeRange(input?.timeRange);
      if (timeRange) params.timeRange = timeRange;
      return request('getMessages', params);
    }),
    getAttachment: (input) => run(async () => {
      const attachmentId = requireString(input?.attachmentId, 'attachmentId');
      const envelope = await request('getAttachment', { attachmentId }, 90_000);
      try {
        const decoded = await decodeWechatImageEnvelopeAsync(envelope);
        return {
          attachmentId,
          mimeType: decoded.mimeType,
          size: decoded.size,
          dataUrl: `data:${decoded.mimeType};base64,${decoded.base64}`,
        };
      } catch (error) {
        throw transportError(
          error?.code === WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED
            ? WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED
            : TRANSPORT_ERROR.PROTOCOL_ERROR,
          error?.message || '微信图片解码失败，请在微信中打开原图后重试',
          true
        );
      }
    }),
  });
}

function shutdownReader() {
  if (shutdownPromise) return shutdownPromise;
  const owned = bridge;
  if (!owned) return Promise.resolve();
  const active = owned.dispose().finally(() => {
    if (bridge === owned) bridge = null;
    if (shutdownPromise === active) shutdownPromise = null;
  });
  shutdownPromise = active;
  return active;
}

module.exports = { createWechatReaderService, shutdownReader };
