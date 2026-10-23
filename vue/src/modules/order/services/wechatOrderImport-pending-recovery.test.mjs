import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareWechatOrderImport } from './wechatOrderImport.js';

test('任务领取失败后，下一次读取会扩展窗口重新取得未领取文字', async () => {
  const messageTimeMs = Date.parse('2026-10-22T10:00:00.000Z');
  const cursorTimeMs = Date.parse('2026-10-22T11:00:00.000Z');
  const now = Date.parse('2026-10-22T11:05:00.000Z');
  const message = {
    id: 'message-pending-recovery',
    senderId: 'friend',
    type: 'text',
    text: '苹果2斤',
    timestamp: new Date(messageTimeMs).toISOString(),
  };
  const messageCalls = [];
  let pendingCalls = 0;
  const binding = {
    enabled: 1,
    displayName: '测试好友',
    accountFingerprint: 'fp:account',
    conversationFingerprint: 'fp:conversation',
    conversationKind: 'direct',
    groupMode: null,
    bindingRevision: 1,
    scanCursorTimeMs: cursorTimeMs,
  };
  const result = await prepareWechatOrderImport({
    customerId: 7,
    binding,
    now,
    retryDelaysMs: [],
    electronAPI: {
      wechatReader: {
        getSelfParticipant: async () => ({
          ok: true,
          result: { id: 'self', displayName: '我', isSelf: true },
          start: { role: 'warm', generation: 1, startMs: 0 },
        }),
        lastColdStart: async () => ({ generation: 1, startMs: 0 }),
        getMessages: async (_conversationId, timeRange) => {
          messageCalls.push(timeRange);
          const startMs = Date.parse(timeRange.start);
          return {
            ok: true,
            result: {
              items: startMs <= messageTimeMs ? [message] : [],
              hasMore: false,
            },
          };
        },
      },
      customerWechatOrders: {
        loadPendingMessages: async () => {
          pendingCalls += 1;
          return {
            ok: true,
            data: {
              items: [{
                id: 91,
                messageFingerprint: message.id,
                messageTimeMs,
                status: 'RECEIVED',
                processingState: 'UNCLAIMED',
                wechatTaskId: null,
              }],
              hasMore: false,
              nextAfterId: null,
            },
          };
        },
        commitReliableScan: async () => ({
          ok: true,
          data: {
            cursorTimeMs: now,
            messageStates: [{
              messageFingerprint: message.id,
              status: 'RECEIVED',
              processingState: 'UNCLAIMED',
              wechatTaskId: null,
            }],
          },
        }),
        reportAttachment: async () => ({ ok: true, data: {} }),
        acknowledgeMixedImage: async () => ({ ok: true, data: {} }),
      },
    },
  });

  assert.equal(pendingCalls, 2, '读取前查恢复台账，登记后刷新一次状态');
  assert.ok(Date.parse(messageCalls[0].start) <= messageTimeMs);
  assert.equal(result.status, 'ready');
  assert.deepEqual(
    result.payload.source.messages.map(item => item.messageFingerprint),
    [message.id]
  );
});

test('连续空扫描推进游标后，15 分钟重叠仍能取得稍早写入的新消息', async () => {
  const messageTimeMs = Date.parse('2026-10-23T00:22:00.000+08:00');
  const cursorTimeMs = Date.parse('2026-10-23T00:33:00.000+08:00');
  const now = Date.parse('2026-10-23T00:34:00.000+08:00');
  const message = {
    id: 'message-late-mango-0022',
    senderId: 'friend',
    type: 'text',
    text: '芒果8斤',
    timestamp: new Date(messageTimeMs).toISOString(),
  };
  const messageCalls = [];
  const binding = {
    enabled: 1,
    displayName: '测试7群',
    accountFingerprint: 'fp:account',
    conversationFingerprint: 'fp:conversation',
    conversationKind: 'group',
    groupMode: 'ALL_MEMBER_MESSAGES',
    bindingRevision: 1,
    scanCursorTimeMs: cursorTimeMs,
  };
  const result = await prepareWechatOrderImport({
    customerId: 7,
    binding,
    now,
    retryDelaysMs: [],
    knownMessageFingerprints: new Set(['message-watermelon', 'message-apple']),
    electronAPI: {
      wechatReader: {
        getSelfParticipant: async () => ({
          ok: true,
          result: { id: 'self', displayName: '我', isSelf: true },
          start: { role: 'warm', generation: 1, startMs: 0 },
        }),
        lastColdStart: async () => ({ generation: 1, startMs: 0 }),
        getMessages: async (_conversationId, timeRange) => {
          messageCalls.push(timeRange);
          const startMs = Date.parse(timeRange.start);
          return {
            ok: true,
            result: {
              items: startMs <= messageTimeMs ? [message] : [],
              hasMore: false,
            },
          };
        },
      },
      customerWechatOrders: {
        loadPendingMessages: async () => ({
          ok: true,
          data: { items: [], hasMore: false, nextAfterId: null },
        }),
        commitReliableScan: async ({ messages }) => ({
          ok: true,
          data: {
            cursorTimeMs: now,
            messageStates: messages.map(item => ({
              messageFingerprint: item.messageFingerprint,
              status: 'RECEIVED',
              processingState: 'UNCLAIMED',
              wechatTaskId: null,
            })),
          },
        }),
        reportAttachment: async () => ({ ok: true, data: {} }),
        acknowledgeMixedImage: async () => ({ ok: true, data: {} }),
      },
    },
  });

  assert.equal(
    Date.parse(messageCalls[0].start),
    cursorTimeMs - 15 * 60 * 1000,
    '重叠窗口应覆盖连续空扫描前写入的消息'
  );
  assert.equal(result.status, 'ready');
  assert.equal(result.payload.text, '芒果8斤');
});
