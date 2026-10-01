import assert from 'node:assert/strict';
import {
  loadCustomerWechatBinding,
  prepareWechatOrderImport,
} from './wechatOrderImport.js';

const binding = {
  enabled: 1,
  displayName: '金调料',
  accountFingerprint: 'fp:account123',
  conversationFingerprint: 'fp:conversation123',
  conversationKind: 'direct',
  groupMode: null,
  cursorTimeMs: 0,
};

const electronAPI = {
  customerWechatOrders: {
    loadBinding: async () => ({ ok: true, data: binding }),
    prepareMessages: async (_customerId, messages) => ({
      ok: true,
      data: {
        binding: { ...binding, cursorTimeMs: messages.at(-1).messageTimeMs },
        pendingMessageFingerprints: [messages.at(-1).messageFingerprint],
      },
    }),
  },
  wechatReader: {
    getParticipants: async () => ({
      ok: true,
      result: [
        { id: 'self', displayName: '李沛谊', isSelf: true },
        { id: 'friend', displayName: '金调料', isSelf: false },
      ],
    }),
    getMessages: async () => ({
      ok: true,
      result: {
        items: [
          { id: 'msg:00000001', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: '2026-10-01T00:26:00.000Z' },
          { id: 'msg:00000002', senderId: 'friend', type: 'text', text: '西兰花2件', timestamp: '2026-10-01T00:27:00.000Z' },
          { id: 'msg:00000003', senderId: 'self', type: 'text', text: '收到', timestamp: '2026-10-01T00:28:00.000Z' },
        ],
      },
    }),
  },
};

const loaded = await loadCustomerWechatBinding(7, electronAPI);
assert.equal(loaded.bound, true);

const prepared = await prepareWechatOrderImport({
  customerId: 7,
  binding: loaded,
  now: Date.parse('2026-10-01T00:30:00.000Z'),
  electronAPI,
});
assert.equal(prepared.status, 'ready');
assert.equal(prepared.pendingCount, 1);
assert.equal(prepared.skippedCount, 1);
assert.equal(prepared.payload.text, '西兰花2件');
assert.deepEqual(prepared.payload.source.messages, [
  { messageFingerprint: 'msg:00000002', messageTimeMs: Date.parse('2026-10-01T00:27:00.000Z') },
]);

console.log('WeChat order import tests passed.');
