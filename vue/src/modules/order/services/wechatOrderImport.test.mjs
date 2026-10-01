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

let participantCalls = 0;
let messageCalls = 0;
const retryWaits = [];
const retryNowValues = [
  Date.parse('2026-10-01T01:00:00.000Z'),
  Date.parse('2026-10-01T01:00:02.000Z'),
  Date.parse('2026-10-01T01:00:06.000Z'),
];
const originalDateNow = Date.now;
Date.now = () => retryNowValues[Math.min(messageCalls, retryNowValues.length - 1)];
try {
  const retried = await prepareWechatOrderImport({
    customerId: 7,
    binding,
    retryDelaysMs: [2000, 4000, 7000],
    sleep: async delayMs => retryWaits.push(delayMs),
    electronAPI: {
      customerWechatOrders: electronAPI.customerWechatOrders,
      wechatReader: {
        getParticipants: async () => {
          participantCalls += 1;
          return electronAPI.wechatReader.getParticipants();
        },
        getMessages: async () => {
          messageCalls += 1;
          if (messageCalls < 3) return { ok: true, result: { items: [] } };
          return {
            ok: true,
            result: {
              items: [{
                id: 'msg:late',
                senderId: 'friend',
                type: 'text',
                text: '咖啡10袋',
                timestamp: '2026-10-01T01:00:05.000Z',
              }],
            },
          };
        },
      },
    },
  });
  assert.equal(retried.status, 'ready');
  assert.equal(retried.payload.text, '咖啡10袋');
  assert.equal(participantCalls, 1);
  assert.equal(messageCalls, 3);
  assert.deepEqual(retryWaits, [2000, 4000]);
} finally {
  Date.now = originalDateNow;
}

console.log('WeChat order import tests passed.');
