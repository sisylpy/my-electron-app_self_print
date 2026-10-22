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
  const output = { offset, limit: Math.min(200, Math.max(1, rawLimit)) };
  // Presence of pageKey opts into Reader keyset paging. Null starts a new,
  // fixed-window scan; a string resumes it. Offset-only callers stay v2-safe.
  if (page && Object.prototype.hasOwnProperty.call(page, 'pageKey')) {
    output.pageKey = typeof page.pageKey === 'string' && page.pageKey
      ? page.pageKey
      : null;
  }
  return output;
}

function normalizeTimeRange(timeRange) {
  const output = {};
  if (typeof timeRange?.start === 'string' && timeRange.start) output.start = timeRange.start;
  if (typeof timeRange?.end === 'string' && timeRange.end) output.end = timeRange.end;
  return Object.keys(output).length ? output : undefined;
}

// ReaderBridge.request() 曾从“直接返回业务值”升级为返回 { value, start }，
// 开发模式下 Electron 主进程不会随源码热更新，可能短暂出现新旧版本混用。
// 这里同时兼容两种契约，避免本人账号、消息或附件被错误解包成 null。
function unpackBridgeResponse(response) {
  const isTimedEnvelope = response
    && typeof response === 'object'
    && Object.prototype.hasOwnProperty.call(response, 'value')
    && Object.prototype.hasOwnProperty.call(response, 'start');
  return isTimedEnvelope ? response : { value: response, start: null };
}

function createWechatReaderService(appLogger) {
  const request = async (method, params, timeoutMs) => unpackBridgeResponse(
    await getBridge(appLogger).request(method, params, timeoutMs)
  );

  async function run(work) {
    try {
      // request() 返回 { value, start }：start 是本次请求专属的启动快照，
      // 随响应一起返回，避免渲染层再去读可能被其它请求覆盖的全局状态。
      const { value, start } = await work();
      const result = { ok: true, result: value === undefined ? null : value };
      if (start) result.start = start;
      return result;
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
      const { value: participants, start } = await request('getParticipants', {
        conversationId: requireString(input?.conversationId, 'conversationId'),
        selfOnly: true,
      });
      // run() 约定 work() 必须返回 { value, start }；这里在内部转换后仍需保持该形状，
      // 否则会被解包成 undefined（曾导致本人账号识别失败）。
      return {
        value: Array.isArray(participants) ? participants[0] || null : null,
        start,
      };
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
      const locator = typeof input?.locator === 'string' && input.locator.trim()
        ? input.locator.trim()
        : undefined;
      const { value: envelope, start } = await request(
        'getAttachment',
        locator ? { attachmentId, locator } : { attachmentId },
        90_000
      );
      try {
        const decoded = await decodeWechatImageEnvelopeAsync(envelope);
        // 同样必须保持 { value, start } 形状，否则附件结果会被解包成 null。
        return {
          value: {
            attachmentId,
            mimeType: decoded.mimeType,
            size: decoded.size,
            dataUrl: `data:${decoded.mimeType};base64,${decoded.base64}`,
          },
          start,
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
    lastColdStart: () => getBridge(appLogger).lastColdStart(),
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
