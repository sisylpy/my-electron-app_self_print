#!/usr/bin/env node
/**
 * V2 图片待补与扫描游标回归测试。
 *
 * 固定场景：09:30 图片订单（原图未下载）+ 09:35 文字订单。V2 完整扫描
 * 可以推进扫描游标，但图片必须先持久化到服务端消息台账；即使 Reader 重启后
 * 不再返回这条旧消息，也必须能够通过 attachmentId + locator 继续恢复。
 */
import assert from 'node:assert/strict';
import {
  prepareWechatOrderImport,
  WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED,
} from './wechatOrderImport.js';

const NOW = Date.parse('2026-10-22T09:40:00.000Z');
const T_IMAGE = Date.parse('2026-10-22T09:30:00.000Z');
const T_TEXT = Date.parse('2026-10-22T09:35:00.000Z');
const SELF = { id: 'self', displayName: '测试账号', isSelf: true };
const iso = (ms) => new Date(ms).toISOString();

const BASE_BINDING = {
  enabled: 1,
  displayName: '测试7群',
  accountFingerprint: 'fp:account123',
  conversationFingerprint: 'fp:conversation123',
  conversationKind: 'group',
  groupMode: 'ALL_MEMBER_MESSAGES',
  bindingRevision: 1,
  scanProtocolVersion: 2,
  scanCursorTimeMs: 0,
};

const ALL_MESSAGES = [
  {
    id: 'msg:image-0930',
    senderId: 'friend',
    type: 'image',
    text: '',
    timestamp: iso(T_IMAGE),
    attachmentRef: {
      id: 'att:image-0930',
      locator: 'signed-reader-locator:image-0930',
    },
  },
  {
    id: 'msg:text-0935',
    senderId: 'friend',
    type: 'text',
    text: '西兰花2件',
    timestamp: iso(T_TEXT),
  },
];

function makeReader({ messages = ALL_MESSAGES, attachmentImpl }) {
  const state = { attachmentCalls: [], messageCalls: [] };
  return {
    state,
    getSelfParticipant: async () => ({
      ok: true,
      result: SELF,
      start: { role: 'warm', generation: 1, startMs: 0 },
    }),
    getMessages: async (_conversationId, timeRange) => {
      state.messageCalls.push(timeRange);
      const start = Date.parse(timeRange.start);
      const end = Date.parse(timeRange.end);
      return {
        ok: true,
        result: {
          items: messages.filter((message) => {
            const at = Date.parse(message.timestamp);
            return at >= start && at <= end;
          }),
          hasMore: false,
          nextPageKey: null,
        },
      };
    },
    getAttachment: async (attachmentId, locator) => {
      state.attachmentCalls.push({ attachmentId, locator });
      return attachmentImpl(attachmentId, locator);
    },
    lastColdStart: async () => ({ generation: 1, startMs: 0, totalStarts: 1 }),
  };
}

function makeReliableServer() {
  const rows = new Map();
  const state = { commits: [], reports: [], cursorTimeMs: 0 };
  return {
    state,
    rows,
    commitReliableScan: async (input) => {
      state.commits.push(input);
      input.messages.forEach((message) => {
        if (rows.has(message.messageFingerprint)) return;
        rows.set(message.messageFingerprint, {
          id: rows.size + 1,
          messageFingerprint: message.messageFingerprint,
          messageTimeMs: message.messageTimeMs,
          status: 'RECEIVED',
          processingState: message.processingState,
          wechatTaskId: null,
          readerAttachmentId: message.readerAttachmentId,
          readerLocator: message.readerLocator,
        });
      });
      state.cursorTimeMs = Math.max(state.cursorTimeMs, input.windowEndTimeMs);
      return {
        ok: true,
        data: {
          cursorTimeMs: state.cursorTimeMs,
          messageStates: input.messages.map((message) => rows.get(message.messageFingerprint)),
        },
      };
    },
    loadPendingMessages: async () => ({
      ok: true,
      data: {
        items: Array.from(rows.values()).filter((row) => (
          row.status === 'RECEIVED' && row.wechatTaskId == null
        )),
        hasMore: false,
        nextAfterId: null,
      },
    }),
    reportAttachment: async (payload) => {
      state.reports.push(payload);
      const row = rows.get(payload.messageFingerprint);
      if (row) row.processingState = payload.recovered ? 'UNCLAIMED' : 'ATTACHMENT_UNAVAILABLE';
      return { ok: true, data: { updated: Boolean(row) } };
    },
    acknowledgeMixedImage: async () => ({ ok: true, data: { updated: true } }),
    markOrderCreated(sourceMessages) {
      sourceMessages.forEach((message) => {
        const row = rows.get(message.messageFingerprint);
        if (!row) return;
        row.status = 'ORDER_CREATED';
        row.processingState = 'TASK_CLAIMED';
        row.wechatTaskId = 101;
      });
    },
  };
}

function run(reader, server, binding = BASE_BINDING, now = NOW) {
  return prepareWechatOrderImport({
    customerId: 7,
    binding,
    now,
    retryDelaysMs: [],
    attachmentRetryDelaysMs: [],
    electronAPI: {
      wechatReader: reader,
      customerWechatOrders: server,
    },
  });
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('A1. 首轮完整扫描：图片进入待补台账，文字仍可生成任务', async () => {
  const reader = makeReader({
    attachmentImpl: async () => ({
      ok: false,
      error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' },
    }),
  });
  const server = makeReliableServer();
  const result = await run(reader, server);

  assert.equal(result.status, 'ready');
  assert.equal(result.deferredImageCount, 1);
  assert.equal(result.payload.text, '西兰花2件');
  assert.deepEqual(
    result.payload.source.messages.map((message) => message.messageFingerprint),
    ['msg:text-0935'],
  );
  assert.deepEqual(
    server.state.commits[0].messages.map((message) => message.messageFingerprint),
    ['msg:image-0930', 'msg:text-0935'],
    '可靠扫描必须在取图前持久化完整消息清单',
  );
  assert.equal(server.rows.get('msg:image-0930').processingState, 'ATTACHMENT_UNAVAILABLE');
  assert.ok(result.binding.scanCursorTimeMs > T_TEXT, '完整提交后 V2 扫描游标可以推进');
});

test('A2. 正式保存文字订单不得把待补图片标记为已处理', async () => {
  const reader = makeReader({
    attachmentImpl: async () => ({
      ok: false,
      error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' },
    }),
  });
  const server = makeReliableServer();
  const result = await run(reader, server);
  server.markOrderCreated(result.payload.source.messages);

  assert.equal(server.rows.get('msg:text-0935').status, 'ORDER_CREATED');
  assert.equal(server.rows.get('msg:image-0930').status, 'RECEIVED');
  assert.equal(server.rows.get('msg:image-0930').wechatTaskId, null);
});

test('A3. Reader 重启后不返回旧消息，仍从服务端台账恢复图片', async () => {
  const firstReader = makeReader({
    attachmentImpl: async () => ({
      ok: false,
      error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' },
    }),
  });
  const server = makeReliableServer();
  const firstResult = await run(firstReader, server);
  server.markOrderCreated(firstResult.payload.source.messages);

  const restartedReader = makeReader({
    messages: [],
    attachmentImpl: async (attachmentId, locator) => ({
      ok: true,
      result: {
        attachmentId,
        locator,
        mimeType: 'image/png',
        size: 10,
        dataUrl: 'data:image/png;base64,AAAA',
      },
    }),
  });
  const recovered = await run(
    restartedReader,
    server,
    { ...BASE_BINDING, scanCursorTimeMs: firstResult.binding.scanCursorTimeMs },
    NOW + 60 * 60 * 1000,
  );

  assert.equal(restartedReader.state.attachmentCalls.length, 1);
  assert.deepEqual(restartedReader.state.attachmentCalls[0], {
    attachmentId: 'att:image-0930',
    locator: 'signed-reader-locator:image-0930',
  });
  assert.equal(recovered.status, 'ready');
  assert.deepEqual(
    recovered.payload.entries.map((entry) => entry.messageFingerprint),
    ['msg:image-0930'],
    '已保存的文字不能重复进入任务，待补图片必须单独恢复',
  );
  assert.equal(recovered.payload.images.length, 1);
});

test('A4. 重启后原图仍不可用时继续保留待补状态', async () => {
  const firstReader = makeReader({
    attachmentImpl: async () => ({
      ok: false,
      error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' },
    }),
  });
  const server = makeReliableServer();
  const firstResult = await run(firstReader, server);
  server.markOrderCreated(firstResult.payload.source.messages);

  const restartedReader = makeReader({
    messages: [],
    attachmentImpl: async () => ({
      ok: false,
      error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图仍未下载' },
    }),
  });
  const deferred = await run(
    restartedReader,
    server,
    { ...BASE_BINDING, scanCursorTimeMs: firstResult.binding.scanCursorTimeMs },
    NOW + 60 * 60 * 1000,
  );

  assert.equal(deferred.status, 'deferred');
  assert.equal(deferred.deferredImageCount, 1);
  assert.equal(server.rows.get('msg:image-0930').status, 'RECEIVED');
  assert.equal(server.rows.get('msg:image-0930').processingState, 'ATTACHMENT_UNAVAILABLE');
  assert.equal(server.state.reports.at(-1).recovered, false);
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`  ok  - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL- ${name}`);
    console.error(`        ${error && error.message}`);
  }
}
console.log(`\nV2 图片待补与游标测试：${tests.length - failed}/${tests.length} 通过`);
if (failed) process.exit(1);
