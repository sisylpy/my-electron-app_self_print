import assert from 'node:assert/strict';
import {
  buildWechatReconciliationPlan,
  loadCustomerWechatBinding,
  loadWechatConversationAvatar,
  loadWechatConversationSnapshot,
  mergeWechatOrderPayload,
  normalizeWechatAvatarSource,
  prepareWechatOrderImport,
  removeWechatImportQueueItem,
  WECHAT_IMAGE_DOWNLOAD_RETRY_DELAYS_MS,
  WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED,
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

let firstEmptyMessageReads = 0;
const firstEmptySleeps = [];
const firstEmpty = await prepareWechatOrderImport({
  customerId: 7,
  binding,
  retryDelaysMs: [250, 500],
  returnFirstEmpty: true,
  sleep: async delayMs => firstEmptySleeps.push(delayMs),
  electronAPI: {
    customerWechatOrders: {
      prepareMessages: async () => {
        throw new Error('空结果不应请求服务端准备订单');
      },
    },
    wechatReader: {
      getParticipants: async () => ({
        ok: true,
        result: [{ id: 'self', displayName: '李沛谊', isSelf: true }],
      }),
      getMessages: async () => {
        firstEmptyMessageReads += 1;
        return { ok: true, result: { items: [] } };
      },
    },
  },
});
assert.equal(firstEmpty.status, 'empty');
assert.equal(firstEmptyMessageReads, 1);
assert.deepEqual(firstEmptySleeps, []);

const loaded = await loadCustomerWechatBinding(7, electronAPI);
assert.equal(loaded.bound, true);
await assert.rejects(
  () => loadCustomerWechatBinding(7, {
    customerWechatOrders: {
      loadBinding: async () => ({ ok: false, status: 401, message: '登录已失效' }),
    },
  }),
  { code: 'SERVER_AUTH_FAILED', message: '服务端认证失败：登录已失效' },
);
assert.equal(
  normalizeWechatAvatarSource('http://wx.qlogo.cn/mmhead/example/0'),
  'https://wx.qlogo.cn/mmhead/example/0'
);
assert.equal(normalizeWechatAvatarSource('https://example.com/avatar.png'), '');
assert.equal(
  await loadWechatConversationAvatar({
    binding: loaded,
    conversationTitle: '金调料',
    electronAPI: {
      wechatReader: {
        findConversation: async () => ({
          ok: true,
          result: {
            matches: [{
              id: binding.conversationFingerprint,
              displayName: '金调料',
              avatarUrl: 'https://wx.qlogo.cn/mmhead/customer/0',
            }],
          },
        }),
      },
    },
  }),
  'https://wx.qlogo.cn/mmhead/customer/0'
);
assert.deepEqual(
  await loadWechatConversationSnapshot({
    binding: loaded,
    conversationTitle: '金调料',
    electronAPI: {
      wechatReader: {
        findConversation: async () => ({
          ok: true,
          result: {
            matches: [{
              id: binding.conversationFingerprint,
              displayName: '金调料',
              lastMessageAt: '2026-10-01T00:29:00.000Z',
              avatarUrl: 'https://wx.qlogo.cn/mmhead/customer/0',
            }],
          },
        }),
      },
    },
  }),
  {
    available: true,
    exists: true,
    avatarUrl: 'https://wx.qlogo.cn/mmhead/customer/0',
    lastMessageTimeMs: Date.parse('2026-10-01T00:29:00.000Z'),
  }
);
assert.equal((await loadWechatConversationSnapshot({
  binding: loaded,
  conversationTitle: '已删除好友',
  electronAPI: {
    wechatReader: {
      findConversation: async () => ({
        ok: false,
        error: { code: 'CONVERSATION_NOT_FOUND', message: '未找到匹配会话' },
      }),
    },
  },
})).exists, false);

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
assert.equal(
  duplicate.latestObservedMessageTimeMs,
  Date.parse('2026-10-01T00:29:00.000Z')
);
assert.equal(
  duplicate.queryStartTimeMs,
  Date.parse('2026-09-30T00:30:00.000Z')
);

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

let attachmentAttempts = 0;
const attachmentRetryWaits = [];
const imageDownloadedAfterFocus = await prepareWechatOrderImport({
  customerId: 7,
  binding: loaded,
  now: Date.parse('2026-10-01T00:30:00.000Z'),
  retryDelaysMs: [],
  attachmentRetryDelaysMs: [500, 1000],
  sleep: async delayMs => attachmentRetryWaits.push(delayMs),
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
            id: 'msg:image-downloading',
            senderId: 'friend',
            type: 'image',
            text: '',
            timestamp: '2026-10-01T00:29:00.000Z',
            attachmentRef: { id: 'attachment:image-downloading', kind: 'image' },
          }],
        },
      }),
      getAttachment: async (attachmentId) => {
        attachmentAttempts += 1;
        if (attachmentAttempts < 3) {
          return {
            ok: false,
            error: {
              code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED,
              message: '只有聊天缩略图',
              retryable: true,
            },
          };
        }
        return {
          ok: true,
          result: {
            attachmentId,
            mimeType: 'image/jpeg',
            size: 136192,
            dataUrl: 'data:image/jpeg;base64,/9j/2Q==',
          },
        };
      },
    },
  },
});
assert.equal(imageDownloadedAfterFocus.status, 'ready');
assert.equal(imageDownloadedAfterFocus.deferredImageCount, 0);
assert.equal(imageDownloadedAfterFocus.payload.images[0].size, 136192);
assert.equal(attachmentAttempts, 3);
assert.deepEqual(attachmentRetryWaits, [500, 1000]);
assert.equal(
  WECHAT_IMAGE_DOWNLOAD_RETRY_DELAYS_MS.reduce((total, delayMs) => total + delayMs, 0),
  30500,
  '自动巡查应给微信完整原图留出约 30 秒下载窗口'
);

const mixedDeferredImage = await prepareWechatOrderImport({
  customerId: 7,
  binding: loaded,
  now: Date.parse('2026-10-01T00:30:00.000Z'),
  retryDelaysMs: [],
  electronAPI: {
    customerWechatOrders: {
      prepareMessages: async (_customerId, messages) => ({
        ok: true,
        data: {
          binding: { ...binding, cursorTimeMs: Date.parse('2026-10-01T00:29:00.000Z') },
          pendingMessageFingerprints: messages.map(message => message.messageFingerprint),
        },
      }),
    },
    wechatReader: {
      getParticipants: electronAPI.wechatReader.getParticipants,
      getMessages: async () => ({
        ok: true,
        result: {
          items: [
            {
              id: 'msg:text-with-image',
              senderId: 'friend',
              type: 'text',
              text: '土豆6斤',
              timestamp: '2026-10-01T00:28:00.000Z',
            },
            {
              id: 'msg:image-deferred',
              senderId: 'friend',
              type: 'image',
              text: '',
              timestamp: '2026-10-01T00:29:00.000Z',
              attachmentRef: { id: 'attachment:image-deferred', kind: 'image' },
            },
          ],
        },
      }),
      getAttachment: async () => ({
        ok: false,
        error: {
          code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED,
          message: '只有聊天缩略图',
          retryable: true,
        },
      }),
    },
  },
});
assert.equal(mixedDeferredImage.status, 'ready');
assert.equal(mixedDeferredImage.payload.text, '土豆6斤');
assert.deepEqual(
  mixedDeferredImage.payload.source.messages.map(message => message.messageFingerprint),
  ['msg:text-with-image']
);
assert.equal(mixedDeferredImage.deferredImageCount, 1);
assert.match(mixedDeferredImage.warning, /后续自动读取/);
assert.equal(
  mixedDeferredImage.binding.cursorTimeMs,
  loaded.cursorTimeMs,
  '有待下载图片时不得向前推进游标'
);

const imageDeferred = await prepareWechatOrderImport({
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
            id: 'msg:image-only-deferred',
            senderId: 'friend',
            type: 'image',
            text: '',
            timestamp: '2026-10-01T00:29:00.000Z',
            attachmentRef: { id: 'attachment:image-only-deferred', kind: 'image' },
          }],
        },
      }),
      getAttachment: async () => ({
        ok: false,
        error: {
          code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED,
          message: '只有聊天缩略图',
          retryable: true,
        },
      }),
    },
  },
});
assert.equal(imageDeferred.status, 'deferred');
assert.equal(imageDeferred.payload, undefined);
assert.equal(imageDeferred.deferredImageCount, 1);
assert.match(imageDeferred.message, /后续自动读取/);

let lightweightSelfCalls = 0;
let fullParticipantCalls = 0;
const importTimings = [];
const lightweightPrepared = await prepareWechatOrderImport({
  customerId: 7,
  binding: loaded,
  now: Date.parse('2026-10-01T00:30:00.000Z'),
  retryDelaysMs: [],
  onTiming: event => importTimings.push(event),
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
      getSelfParticipant: async () => {
        lightweightSelfCalls += 1;
        return { ok: true, result: { id: 'self', displayName: '李沛谊', isSelf: true } };
      },
      getParticipants: async () => {
        fullParticipantCalls += 1;
        return electronAPI.wechatReader.getParticipants();
      },
      getMessages: async () => ({
        ok: true,
        result: {
          items: [{
            id: 'msg:lightweight-self',
            senderId: 'friend',
            type: 'text',
            text: '青菜6斤',
            timestamp: '2026-10-01T00:29:00.000Z',
          }],
        },
      }),
    },
  },
});
assert.equal(lightweightPrepared.status, 'ready');
assert.equal(lightweightPrepared.payload.text, '青菜6斤');
assert.equal(lightweightSelfCalls, 1);
assert.equal(fullParticipantCalls, 0);
assert.deepEqual(
  importTimings.map(event => event.stage),
  [
    'reader-self-participant',
    'reader-messages',
    'message-filter',
    'server-prepare-messages',
    'payload-build',
  ]
);
assert.ok(importTimings.every(event => Number.isFinite(event.durationMs)));

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

let currentSnapshotReads = 0;
let currentSnapshotPrepares = 0;
const currentSnapshotWaits = [];
const currentSnapshot = await prepareWechatOrderImport({
  customerId: 7,
  binding,
  retryDelaysMs: [650],
  knownMessageFingerprints: new Set(['msg:known']),
  deferPrepareUntilStable: true,
  sleep: async delayMs => currentSnapshotWaits.push(delayMs),
  electronAPI: {
    customerWechatOrders: {
      prepareMessages: async () => {
        currentSnapshotPrepares += 1;
        throw new Error('已知消息不应该再次请求服务端');
      },
    },
    wechatReader: {
      getParticipants: electronAPI.wechatReader.getParticipants,
      getMessages: async () => {
        currentSnapshotReads += 1;
        return {
          ok: true,
          result: {
            items: [{
              id: 'msg:known',
              senderId: 'friend',
              type: 'text',
              text: '已在当前草稿中的订单',
              timestamp: '2026-10-01T02:01:00.000Z',
            }],
          },
        };
      },
    },
  },
});
assert.equal(currentSnapshot.status, 'current');
assert.equal(currentSnapshot.payload, undefined);
assert.equal(currentSnapshotReads, 2);
assert.equal(currentSnapshotPrepares, 0);
assert.deepEqual(currentSnapshotWaits, [650]);

let optimizedRefreshReads = 0;
let optimizedRefreshPrepares = 0;
let optimizedPreparedMessages = [];
const optimizedRefreshWaits = [];
const optimizedRefresh = await prepareWechatOrderImport({
  customerId: 7,
  binding,
  retryDelaysMs: [650],
  knownMessageFingerprints: new Set(['msg:known']),
  deferPrepareUntilStable: true,
  sleep: async delayMs => optimizedRefreshWaits.push(delayMs),
  electronAPI: {
    customerWechatOrders: {
      prepareMessages: async (_customerId, messages) => {
        optimizedRefreshPrepares += 1;
        optimizedPreparedMessages = messages;
        return {
          ok: true,
          data: {
            binding,
            pendingMessageFingerprints: messages.map(message => message.messageFingerprint),
          },
        };
      },
    },
    wechatReader: {
      getParticipants: electronAPI.wechatReader.getParticipants,
      getMessages: async () => {
        optimizedRefreshReads += 1;
        const items = [{
          id: 'msg:known',
          senderId: 'friend',
          type: 'text',
          text: '已在当前草稿中的订单',
          timestamp: '2026-10-01T02:01:00.000Z',
        }];
        if (optimizedRefreshReads > 1) items.push({
          id: 'msg:new-after-click',
          senderId: 'friend',
          type: 'text',
          text: '第二次快照才写入的新订单',
          timestamp: '2026-10-01T02:01:30.000Z',
        });
        return { ok: true, result: { items } };
      },
    },
  },
});
assert.equal(optimizedRefresh.status, 'ready');
assert.equal(optimizedRefresh.payload.text, '第二次快照才写入的新订单');
assert.deepEqual(
  optimizedRefresh.payload.source.messages.map(message => message.messageFingerprint),
  ['msg:new-after-click']
);
assert.deepEqual(
  optimizedPreparedMessages.map(message => message.messageFingerprint),
  ['msg:new-after-click']
);
assert.equal(optimizedRefreshReads, 2);
assert.equal(optimizedRefreshPrepares, 1);
assert.deepEqual(optimizedRefreshWaits, [650]);

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
  assert.equal(partialWritePrepares, 2);
  assert.deepEqual(partialWriteWaits, [1000, 1000, 1000, 1000]);
} finally {
  Date.now = originalDateNow;
}

console.log('WeChat order import tests passed.');
