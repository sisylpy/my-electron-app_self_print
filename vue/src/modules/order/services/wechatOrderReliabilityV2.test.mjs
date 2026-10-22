#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  prepareWechatOrderImport,
  readWechatMessageWindow,
  WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED,
} from './wechatOrderImport.js';

function message(index) {
  return {
    id: `msg:${String(index).padStart(4, '0')}`,
    senderId: 'friend',
    type: 'text',
    text: `商品${index} 1斤`,
    timestamp: '2026-10-22T08:00:00.000Z',
  };
}

async function readCount(count) {
  const all = Array.from({ length: count }, (_unused, index) => message(index));
  const calls = [];
  const reader = {
    getMessages: async (_conversationId, _range, page) => {
      calls.push({ ...page });
      const offset = page.pageKey ? Number(page.pageKey.slice(4)) : 0;
      const items = all.slice(offset, offset + page.limit);
      const next = offset + items.length;
      return {
        ok: true,
        result: {
          items,
          hasMore: next < all.length,
          nextPageKey: next < all.length ? `key:${next}` : null,
        },
      };
    },
  };
  const result = await readWechatMessageWindow({
    reader,
    conversationId: 'fp:conversation_test',
    startMs: Date.parse('2026-10-22T00:00:00.000Z'),
    endMs: Date.parse('2026-10-23T00:00:00.000Z'),
  });
  assert.equal(result.items.length, count);
  assert.equal(new Set(result.items.map(item => item.id)).size, count);
  assert.equal(result.pageCount, Math.max(1, Math.ceil(count / 200)));
  assert.equal(calls[0].pageKey, null);
  calls.slice(1).forEach(call => assert.match(call.pageKey, /^key:\d+$/));
}

for (const count of [199, 200, 201, 400, 450]) await readCount(count);

await assert.rejects(
  readWechatMessageWindow({
    reader: {
      getMessages: async () => ({
        ok: true,
        result: { items: [message(1)], hasMore: true, nextPageKey: null },
      }),
    },
    conversationId: 'fp:conversation_test',
    startMs: 1,
    endMs: 2,
  }),
  /没有返回下一页定位信息/
);

let page = 0;
await assert.rejects(
  readWechatMessageWindow({
    reader: {
      getMessages: async () => {
        page += 1;
        return {
          ok: true,
          result: { items: [message(page)], hasMore: true, nextPageKey: 'key:repeat' },
        };
      },
    },
    conversationId: 'fp:conversation_test',
    startMs: 1,
    endMs: 2,
  }),
  /分页游标重复/
);

console.log('wechatOrderReliabilityV2.test.mjs: passed');

const fixedNow = Date.parse('2026-10-22T09:00:00.000Z');
const allOrders = Array.from({ length: 450 }, (_unused, index) => ({
  ...message(index),
  timestamp: '2026-10-22T08:00:00.000Z',
}));
let committed = null;
const result = await prepareWechatOrderImport({
  customerId: 7,
  now: fixedNow,
  retryDelaysMs: [],
  binding: {
    enabled: 1,
    accountFingerprint: 'fp:account_test',
    conversationFingerprint: 'fp:conversation_test',
    conversationKind: 'group',
    groupMode: 'ALL_MEMBER_MESSAGES',
    bindingRevision: 3,
    scanProtocolVersion: 2,
    scanCursorTimeMs: 0,
  },
  electronAPI: {
    wechatReader: {
      getSelfParticipant: async () => ({
        ok: true,
        result: { id: 'self', displayName: '配送商', isSelf: true },
      }),
      lastColdStart: async () => ({ generation: 0, startMs: 0, role: 'warm' }),
      getMessages: async (_conversationId, _range, pageRequest) => {
        const offset = pageRequest.pageKey ? Number(pageRequest.pageKey.slice(4)) : 0;
        const items = allOrders.slice(offset, offset + pageRequest.limit);
        const next = offset + items.length;
        return {
          ok: true,
          result: {
            items,
            hasMore: next < allOrders.length,
            nextPageKey: next < allOrders.length ? `key:${next}` : null,
          },
        };
      },
    },
    customerWechatOrders: {
      commitReliableScan: async (input) => {
        committed = input;
        return {
          ok: true,
          data: {
            cursorTimeMs: input.windowEndTimeMs,
            messageStates: input.messages.map(item => ({
              messageFingerprint: item.messageFingerprint,
              status: 'RECEIVED',
              processingState: 'UNCLAIMED',
              wechatTaskId: null,
            })),
          },
        };
      },
      loadPendingMessages: async () => ({ ok: true, data: { items: [] } }),
      reportAttachment: async () => ({ ok: true, data: { updated: true } }),
      acknowledgeMixedImage: async () => ({ ok: true, data: { updated: true } }),
    },
  },
});
assert.equal(committed.messages.length, 450);
assert.equal(result.status, 'ready');
assert.equal(result.payload.entries.length, 450);
assert.equal(result.binding.scanCursorTimeMs, fixedNow + 2 * 60 * 1000);

const textWithDeferredImage = [
  { ...message(1), timestamp: '2026-10-22T08:10:00.000Z' },
  {
    id: 'message-image-deferred',
    senderId: 'friend',
    type: 'image',
    text: '',
    timestamp: '2026-10-22T08:11:00.000Z',
    attachmentRef: {
      id: 'fp:attachment_deferred_image_001',
      locator: `${'a'.repeat(20)}.${'b'.repeat(20)}`,
    },
  },
];
const deferred = await prepareWechatOrderImport({
  customerId: 7,
  now: fixedNow,
  retryDelaysMs: [],
  attachmentRetryDelaysMs: [],
  binding: {
    enabled: 1,
    accountFingerprint: 'fp:account_test',
    conversationFingerprint: 'fp:conversation_test',
    conversationKind: 'group',
    groupMode: 'ALL_MEMBER_MESSAGES',
    bindingRevision: 3,
    scanProtocolVersion: 2,
    scanCursorTimeMs: 0,
  },
  electronAPI: {
    wechatReader: {
      getSelfParticipant: async () => ({
        ok: true,
        result: { id: 'self', displayName: '配送商', isSelf: true },
      }),
      lastColdStart: async () => ({ generation: 0, startMs: 0, role: 'warm' }),
      getMessages: async () => ({
        ok: true,
        result: { items: textWithDeferredImage, hasMore: false, nextPageKey: null },
      }),
      getAttachment: async () => ({
        ok: false,
        error: {
          code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED,
          message: '原图尚未下载',
          retryable: true,
        },
      }),
    },
    customerWechatOrders: {
      commitReliableScan: async (input) => ({
        ok: true,
        data: {
          cursorTimeMs: input.windowEndTimeMs,
          messageStates: input.messages.map(item => ({
            messageFingerprint: item.messageFingerprint,
            status: 'RECEIVED',
            processingState: item.processingState,
            wechatTaskId: null,
          })),
        },
      }),
      loadPendingMessages: async () => ({ ok: true, data: { items: [] } }),
      reportAttachment: async () => ({ ok: true, data: { updated: true } }),
      acknowledgeMixedImage: async () => ({ ok: true, data: { updated: true } }),
    },
  },
});
assert.equal(deferred.status, 'ready');
assert.equal(deferred.payload.entries.length, 1);
assert.equal(deferred.payload.entries[0].messageFingerprint, 'msg:0001');
assert.equal(deferred.deferredImageCount, 1);
assert.equal(deferred.binding.scanCursorTimeMs, fixedNow + 2 * 60 * 1000);

const recoveredAfterRestart = await prepareWechatOrderImport({
  customerId: 7,
  now: fixedNow,
  retryDelaysMs: [],
  attachmentRetryDelaysMs: [],
  binding: {
    enabled: 1,
    accountFingerprint: 'fp:account_test',
    conversationFingerprint: 'fp:conversation_test',
    conversationKind: 'group',
    groupMode: 'ALL_MEMBER_MESSAGES',
    bindingRevision: 3,
    scanProtocolVersion: 2,
    scanCursorTimeMs: fixedNow,
  },
  electronAPI: {
    wechatReader: {
      getSelfParticipant: async () => ({
        ok: true,
        result: { id: 'self', displayName: '配送商', isSelf: true },
      }),
      lastColdStart: async () => ({ generation: 0, startMs: 0, role: 'warm' }),
      getMessages: async () => ({
        ok: true,
        result: { items: [], hasMore: false, nextPageKey: null },
      }),
      getAttachment: async (attachmentId, locator) => ({
        ok: true,
        result: {
          id: attachmentId,
          locator,
          mimeType: 'image/jpeg',
          size: 3,
          dataUrl: 'data:image/jpeg;base64,AAEC',
        },
      }),
    },
    customerWechatOrders: {
      commitReliableScan: async (input) => ({
        ok: true,
        data: { cursorTimeMs: input.windowEndTimeMs, messageStates: [] },
      }),
      loadPendingMessages: async () => ({
        ok: true,
        data: {
          items: [{
            messageFingerprint: 'message-image-deferred',
            messageTimeMs: fixedNow - 60_000,
            processingState: 'ATTACHMENT_PENDING',
            readerAttachmentId: 'fp:attachment_deferred_image_001',
            readerLocator: `${'a'.repeat(20)}.${'b'.repeat(20)}`,
          }],
        },
      }),
      reportAttachment: async () => ({ ok: true, data: { updated: true } }),
      acknowledgeMixedImage: async () => ({ ok: true, data: { updated: true } }),
    },
  },
});
assert.equal(recoveredAfterRestart.status, 'ready');
assert.equal(recoveredAfterRestart.payload.entries.length, 1);
assert.equal(recoveredAfterRestart.payload.entries[0].messageFingerprint, 'message-image-deferred');
assert.equal(recoveredAfterRestart.payload.images.length, 1);

console.log('wechatOrderReliabilityV2 integration cases: passed');
