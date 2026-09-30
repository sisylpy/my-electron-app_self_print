const { ReaderBridge } = require('./reader-bridge');
const { ReaderError, transportError, TRANSPORT_ERROR } = require('./reader-errors');

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
    findConversation: (input) => run(() => request('findConversation', {
      accountId: requireString(input?.accountId, 'accountId'),
      name: requireString(input?.name, 'name'),
    })),
    getParticipants: (input) => run(() => request('getParticipants', {
      conversationId: requireString(input?.conversationId, 'conversationId'),
    })),
    getMessages: (input) => run(() => {
      const params = {
        conversationId: requireString(input?.conversationId, 'conversationId'),
        page: normalizePage(input?.page),
      };
      const timeRange = normalizeTimeRange(input?.timeRange);
      if (timeRange) params.timeRange = timeRange;
      return request('getMessages', params);
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
