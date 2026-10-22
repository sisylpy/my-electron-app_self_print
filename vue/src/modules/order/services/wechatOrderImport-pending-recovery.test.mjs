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
