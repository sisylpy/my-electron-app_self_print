import assert from 'node:assert/strict';
import {
  buildWechatReconciliationPlan,
  loadCustomerWechatBinding,
  mergeWechatOrderPayload,
  prepareWechatOrderImport,
  removeWechatImportQueueItem,
} from './wechatOrderImport.js';

assert.deepEqual(
  buildWechatReconciliationPlan(
    [' 金调料 ', '测试', '金调料'],
    ['未绑定', '金调料', '金调料']
  ),
  [
    { title: '金调料', opened: true },
    { title: '测试', opened: false },
  ]
);

assert.deepEqual(
  removeWechatImportQueueItem(
    [{ token: 'wechat:a' }, { token: 'wechat:b' }, { token: 'wechat:c' }],
    'wechat:b'
  ),
  {
    items: [{ token: 'wechat:a' }, { token: 'wechat:c' }],
    nextToken: 'wechat:c',
    removed: true,
  }
);
assert.equal(
  removeWechatImportQueueItem([{ token: 'wechat:a' }], 'wechat:a').nextToken,
  null
);

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

const noPendingReader = {
  getParticipants: electronAPI.wechatReader.getParticipants,
  getMessages: async () => ({
    ok: true,
    result: {
      items: [{
        id: 'msg:no-pending',
        senderId: 'friend',
        type: 'text',
        text: '土豆3件',
        timestamp: '2026-10-01T00:29:00.000Z',
      }],
    },
  }),
};
const duplicate = await prepareWechatOrderImport({
  customerId: 7,
  binding: loaded,
  now: Date.parse('2026-10-01T00:30:00.000Z'),
  retryDelaysMs: [],
  electronAPI: {
    wechatReader: noPendingReader,
    customerWechatOrders: {
      prepareMessages: async () => ({
        ok: true,
        data: {
          binding,
          pendingMessageFingerprints: [],
          processedCount: 1,
        },
      }),
    },
  },
});
assert.equal(duplicate.status, 'duplicate');

const incompleteState = await prepareWechatOrderImport({
  customerId: 7,
  binding: loaded,
  now: Date.parse('2026-10-01T00:30:00.000Z'),
  retryDelaysMs: [],
  electronAPI: {
    wechatReader: noPendingReader,
    customerWechatOrders: {
      prepareMessages: async () => ({
        ok: true,
        data: {
          binding,
          pendingMessageFingerprints: [],
          processedCount: 0,
        },
      }),
    },
  },
});
assert.equal(incompleteState.status, 'conflict');
assert.match(incompleteState.message, /没有返回完整的处理状态/);

let queriedTimeRange = null;
const prepared = await prepareWechatOrderImport({
  customerId: 7,
  binding: loaded,
  now: Date.parse('2026-10-01T00:30:00.000Z'),
  electronAPI: {
    ...electronAPI,
    wechatReader: {
      ...electronAPI.wechatReader,
      getMessages: async (_conversationId, timeRange) => {
        queriedTimeRange = timeRange;
        return electronAPI.wechatReader.getMessages();
      },
    },
  },
});
assert.equal(prepared.status, 'ready');
assert.equal(queriedTimeRange.end, '2026-10-01T00:32:00.000Z');
assert.equal(prepared.pendingCount, 1);
assert.equal(prepared.skippedCount, 1);
assert.equal(prepared.payload.text, '西兰花2件');
assert.deepEqual(prepared.payload.source.messages, [
  { messageFingerprint: 'msg:00000002', messageTimeMs: Date.parse('2026-10-01T00:27:00.000Z') },
]);
assert.deepEqual(prepared.payload.entries, [{
  messageFingerprint: 'msg:00000002',
  messageTimeMs: Date.parse('2026-10-01T00:27:00.000Z'),
  type: 'text',
  text: '西兰花2件',
}]);

const imagePrepared = await prepareWechatOrderImport({
  customerId: 7,
  binding: loaded,
  now: Date.parse('2026-10-01T00:30:00.000Z'),
  retryDelaysMs: [],
  electronAPI: {
    customerWechatOrders: {
      prepareMessages: async (_customerId, messages) => ({
        ok: true,
        data: {
          binding,
          pendingMessageFingerprints: messages.map(message => message.messageFingerprint),
        },
      }),
    },
    wechatReader: {
      getParticipants: electronAPI.wechatReader.getParticipants,
      getMessages: async () => ({
        ok: true,
        result: {
          items: [{
            id: 'msg:image-1',
            senderId: 'friend',
            type: 'image',
            text: '',
            timestamp: '2026-10-01T00:29:00.000Z',
            attachmentRef: { id: 'attachment:image-1', kind: 'image' },
          }],
        },
      }),
      getAttachment: async (attachmentId) => ({
        ok: true,
        result: {
          attachmentId,
          mimeType: 'image/jpeg',
          size: 4,
          dataUrl: 'data:image/jpeg;base64,/9j/2Q==',
        },
      }),
    },
  },
});
assert.equal(imagePrepared.status, 'ready');
assert.equal(imagePrepared.payload.text, '');
assert.deepEqual(imagePrepared.payload.images, [{
  messageFingerprint: 'msg:image-1',
  messageTimeMs: Date.parse('2026-10-01T00:29:00.000Z'),
  mimeType: 'image/jpeg',
  size: 4,
  dataUrl: 'data:image/jpeg;base64,/9j/2Q==',
}]);
assert.equal(imagePrepared.payload.entries[0].type, 'image');

const mergedPayload = mergeWechatOrderPayload(
  {
    text: '油菜8斤',
    entries: [{ messageFingerprint: 'msg:old', messageTimeMs: 1000, text: '油菜8斤' }],
    source: { conversationFingerprint: 'fp:conversation123', messages: [
      { messageFingerprint: 'msg:old', messageTimeMs: 1000 },
    ] },
  },
  {
    text: '土豆8斤',
    entries: [{ messageFingerprint: 'msg:new', messageTimeMs: 2000, text: '土豆8斤' }],
    source: { conversationFingerprint: 'fp:conversation123', messages: [
      { messageFingerprint: 'msg:new', messageTimeMs: 2000 },
    ] },
  }
);
assert.equal(mergedPayload.text, '油菜8斤\n土豆8斤');
assert.deepEqual(mergedPayload.source.messages.map(message => message.messageFingerprint), [
  'msg:old',
  'msg:new',
]);

const mergedImages = mergeWechatOrderPayload(
  {
    text: '',
    images: [{ messageFingerprint: 'msg:image-old', dataUrl: 'data:image/jpeg;base64,old' }],
    entries: [{ messageFingerprint: 'msg:image-old', messageTimeMs: 1000, type: 'image', text: '' }],
    source: { conversationFingerprint: 'fp:conversation123', messages: [
      { messageFingerprint: 'msg:image-old', messageTimeMs: 1000 },
    ] },
  },
  {
    text: '',
    images: [
      { messageFingerprint: 'msg:image-old', dataUrl: 'data:image/jpeg;base64,old' },
      { messageFingerprint: 'msg:image-new', dataUrl: 'data:image/png;base64,new' },
    ],
    entries: [
      { messageFingerprint: 'msg:image-old', messageTimeMs: 1000, type: 'image', text: '' },
      { messageFingerprint: 'msg:image-new', messageTimeMs: 2000, type: 'image', text: '' },
    ],
    source: { conversationFingerprint: 'fp:conversation123', messages: [
      { messageFingerprint: 'msg:image-old', messageTimeMs: 1000 },
      { messageFingerprint: 'msg:image-new', messageTimeMs: 2000 },
    ] },
  },
);
assert.deepEqual(
  mergedImages.images.map(image => image.messageFingerprint),
  ['msg:image-old', 'msg:image-new'],
);

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
  assert.equal(messageCalls, 4);
  assert.deepEqual(retryWaits, [2000, 4000, 7000]);
} finally {
  Date.now = originalDateNow;
}

let delayedWriteReads = 0;
let delayedWritePrepares = 0;
const delayedWriteWaits = [];
const delayedWriteBinding = {
  ...binding,
  cursorTimeMs: Date.parse('2026-10-01T02:00:00.000Z'),
};
const delayedWrite = await prepareWechatOrderImport({
  customerId: 7,
  binding: delayedWriteBinding,
  now: Date.parse('2026-10-01T02:02:00.000Z'),
  retryDelaysMs: [1000],
  sleep: async delayMs => delayedWriteWaits.push(delayMs),
  electronAPI: {
    customerWechatOrders: {
      prepareMessages: async (_customerId, messages) => {
        delayedWritePrepares += 1;
        const pending = messages
          .map(message => message.messageFingerprint)
          .filter(messageId => messageId === 'msg:late-write');
        return {
          ok: true,
          data: {
            binding: delayedWriteBinding,
            pendingMessageFingerprints: pending,
          },
        };
      },
    },
    wechatReader: {
      getParticipants: electronAPI.wechatReader.getParticipants,
      getMessages: async () => {
        delayedWriteReads += 1;
        const items = [{
          id: 'msg:already-processed',
          senderId: 'friend',
          type: 'text',
          text: '旧订单',
          timestamp: '2026-10-01T01:59:30.000Z',
        }];
        if (delayedWriteReads > 1) items.push({
          id: 'msg:late-write',
          senderId: 'friend',
          type: 'text',
          text: '刚写入本地库的新订单',
          timestamp: '2026-10-01T02:01:30.000Z',
        });
        return { ok: true, result: { items } };
      },
    },
  },
});
assert.equal(delayedWrite.status, 'ready');
assert.equal(delayedWrite.payload.text, '刚写入本地库的新订单');
assert.equal(delayedWriteReads, 2);
assert.equal(delayedWritePrepares, 2);
assert.deepEqual(delayedWriteWaits, [1000]);

let partialWriteReads = 0;
let partialWritePrepares = 0;
const partialWriteWaits = [];
const partialWriteBinding = {
  ...binding,
  cursorTimeMs: Date.parse('2026-10-01T03:00:00.000Z'),
};
Date.now = () => Date.parse('2026-10-01T03:02:00.000Z');
try {
  const partialWrite = await prepareWechatOrderImport({
    customerId: 7,
    binding: partialWriteBinding,
    retryDelaysMs: [1000, 1000, 1000, 1000],
    sleep: async delayMs => partialWriteWaits.push(delayMs),
    electronAPI: {
      customerWechatOrders: {
        prepareMessages: async (_customerId, messages) => {
          partialWritePrepares += 1;
          return {
            ok: true,
            data: {
              binding: partialWriteBinding,
              pendingMessageFingerprints: messages.map(message => message.messageFingerprint),
            },
          };
        },
      },
      wechatReader: {
        getParticipants: electronAPI.wechatReader.getParticipants,
        getMessages: async () => {
          partialWriteReads += 1;
          const items = [{
            id: 'msg:vegetable-old',
            senderId: 'friend',
            type: 'text',
            text: '西葫芦5斤',
            timestamp: '2026-10-01T03:00:30.000Z',
          }];
          if (partialWriteReads >= 3) items.push({
            id: 'msg:vegetable-late',
            senderId: 'friend',
            type: 'text',
            text: '油菜8斤',
            timestamp: '2026-10-01T03:01:30.000Z',
          });
          return { ok: true, result: { items } };
        },
      },
    },
  });
  assert.equal(partialWrite.status, 'ready');
  assert.equal(partialWrite.payload.text, '西葫芦5斤\n油菜8斤');
  assert.equal(partialWrite.pendingCount, 2);
  assert.equal(partialWriteReads, 5);
  assert.equal(partialWritePrepares, 5);
  assert.deepEqual(partialWriteWaits, [1000, 1000, 1000, 1000]);
} finally {
  Date.now = originalDateNow;
}

console.log('WeChat order import tests passed.');
