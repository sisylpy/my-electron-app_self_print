#!/usr/bin/env node
/**
 * 图片订单漏读缺陷的可执行复现（任务 A）。
 *
 * 固定场景：09:30 图片订单（原图未下载）+ 09:35 文字订单，文字订单成功保存。
 *
 * 说明（重要）：
 * - 客户端部分跑的是真实 prepareWechatOrderImport 代码。
 * - 服务端游标推进规则（completeOrderSave: markOrderCreated + updateCursor）
 *   来自对 CustomerWechatOrderService.java 的源码阅读，这里以等价模型模拟，
 *   不是执行真实 Java。已读源码位置见报告。
 * - Reader 的 getMessages 按 timeRange 过滤并应用 offset/limit，模拟真实分页契约。
 */
import assert from 'node:assert/strict';
import {
  prepareWechatOrderImport,
  WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED,
} from './wechatOrderImport.js';

const NOW = Date.parse('2026-10-22T09:40:00.000Z');
const T_IMAGE = Date.parse('2026-10-22T09:30:00.000Z');   // 09:30 图片
const T_TEXT = Date.parse('2026-10-22T09:35:00.000Z');    // 09:35 文字

const SELF = { id: 'self', displayName: '测试账号', isSelf: true };
const iso = (ms) => new Date(ms).toISOString();

const BASE_BINDING = {
  enabled: 1,
  displayName: '测试7群',
  accountFingerprint: 'fp:account123',
  conversationFingerprint: 'fp:conversation123',
  conversationKind: 'group',
  groupMode: 'ALL_MEMBER_MESSAGES',
  cursorTimeMs: 0,
};

const ALL_MESSAGES = [
  {
    id: 'msg:image-0930',
    senderId: 'friend',
    type: 'image',
    text: '',
    timestamp: iso(T_IMAGE),
    attachmentRef: { id: 'att:image-0930' },
  },
  {
    id: 'msg:text-0935',
    senderId: 'friend',
    type: 'text',
    text: '西兰花2件',
    timestamp: iso(T_TEXT),
  },
];

/** Reader 模拟：按 timeRange 过滤 + offset/limit 分页，忠实模拟调用契约。 */
function makeReader(attachmentImpl) {
  const state = { attachmentCalls: [], messageCalls: [] };
  return {
    state,
    getSelfParticipant: async () => ({
      ok: true,
      result: SELF,
      start: { role: 'warm', generation: 1, startMs: 0 },
    }),
    getMessages: async (_conversationId, timeRange, page) => {
      state.messageCalls.push({ timeRange, page });
      const start = Date.parse(timeRange.start);
      const end = Date.parse(timeRange.end);
      const offset = Number(page?.offset) || 0;
      const limit = Number(page?.limit) || 200;
      const inWindow = ALL_MESSAGES.filter((message) => {
        const at = Date.parse(message.timestamp);
        return at >= start && at <= end;
      });
      return { ok: true, result: { items: inWindow.slice(offset, offset + limit) } };
    },
    getAttachment: async (attachmentId) => {
      state.attachmentCalls.push(attachmentId);
      return attachmentImpl(attachmentId);
    },
    lastColdStart: async () => ({ generation: 1, startMs: 0, totalStarts: 1 }),
  };
}

/**
 * 服务端模型（依据 CustomerWechatOrderService）：
 * - prepare：登记为 RECEIVED（pending），返回 pendingMessageFingerprints
 * - 保存订单：仅对 source.messages 调 markOrderCreated，并把游标推进到
 *   source.messages 中最新一条的时间
 */
function makeServer({ pendingIds, processedCount = 0, cursorTimeMs = 0 }) {
  const state = { prepared: [], saved: null, cursorTimeMs };
  return {
    state,
    prepareMessages: async (_customerId, submitted) => {
      state.prepared.push(submitted.map((m) => m.messageFingerprint));
      return {
        ok: true,
        data: {
          binding: { ...BASE_BINDING, cursorTimeMs: state.cursorTimeMs },
          pendingMessageFingerprints: pendingIds,
          pendingCount: pendingIds.length,
          processedCount,
        },
      };
    },
    /** 模拟 completeOrderSave */
    saveOrder: (sourceMessages) => {
      const latest = sourceMessages.reduce(
        (max, m) => (m.messageTimeMs > max.messageTimeMs ? m : max),
        sourceMessages[0]
      );
      state.saved = sourceMessages.map((m) => m.messageFingerprint);
      if (latest && latest.messageTimeMs > state.cursorTimeMs) {
        state.cursorTimeMs = latest.messageTimeMs;
      }
      return state.cursorTimeMs;
    },
  };
}

function run(readers, server, binding, attachmentImpl) {
  return prepareWechatOrderImport({
    customerId: 7,
    binding,
    now: NOW,
    retryDelaysMs: [],
    attachmentRetryDelaysMs: [],
    electronAPI: {
      wechatReader: readers,
      customerWechatOrders: server,
    },
  });
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('A1. 首轮读取：图片 deferred，只有文字进入 source.messages', async () => {
  const reader = makeReader(async () => ({
    ok: false,
    error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' },
  }));
  const server = makeServer({ pendingIds: ['msg:image-0930', 'msg:text-0935'] });
  const result = await run(reader, server, BASE_BINDING);

  assert.equal(result.deferredImageCount, 1, '图片应处于待补齐');
  assert.equal(result.binding.cursorTimeMs, 0, '客户端不得推进游标');
  const sourceIds = result.payload.source.messages.map((m) => m.messageFingerprint);
  assert.deepEqual(sourceIds, ['msg:text-0935'], 'source.messages 只应含文字订单');
  assert.ok(!sourceIds.includes('msg:image-0930'), '待补齐图片被排除在 source.messages 之外');
});

test('A2. 保存文字订单后，服务端游标推进到 09:35（越过 09:30 图片）', async () => {
  const reader = makeReader(async () => ({
    ok: false,
    error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' },
  }));
  const server = makeServer({ pendingIds: ['msg:image-0930', 'msg:text-0935'] });
  const result = await run(reader, server, BASE_BINDING);
  const cursor = server.saveOrder(result.payload.source.messages);
  assert.equal(cursor, T_TEXT, '游标应停在 09:35（source.messages 中最新一条）');
  assert.ok(cursor > T_IMAGE, '游标已越过 09:30 图片');
});

test('A3. 【缺陷复现】游标越过后再次读取，即使原图已可下载也再也读不到图片', async () => {
  // 第一轮：图片 deferred
  const first = makeReader(async () => ({
    ok: false,
    error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' },
  }));
  const server1 = makeServer({ pendingIds: ['msg:image-0930', 'msg:text-0935'] });
  const result1 = await run(first, server1, BASE_BINDING);
  const cursor = server1.saveOrder(result1.payload.source.messages);
  assert.equal(cursor, T_TEXT);

  // 第二轮：原图已经可以下载了
  const second = makeReader(async () => ({
    ok: true,
    result: { mimeType: 'image/png', size: 10, dataUrl: 'data:image/png;base64,AAAA' },
  }));
  const server2 = makeServer({
    pendingIds: [],                 // 文字已生成订单；图片仍是 RECEIVED 但读不到
    processedCount: 1,
    cursorTimeMs: cursor,
  });
  const binding2 = { ...BASE_BINDING, cursorTimeMs: cursor };
  const result2 = await run(second, server2, binding2);

  // 窗口起点 = 游标 - 2 分钟 = 09:33，09:30 的图片已不在窗口内
  const windowStart = Date.parse(second.state.messageCalls[0].timeRange.start);
  assert.equal(windowStart, cursor - 2 * 60 * 1000, '窗口起点应为游标前 2 分钟');
  assert.ok(T_IMAGE < windowStart, '09:30 图片落在窗口起点之前');

  assert.equal(
    second.state.attachmentCalls.length,
    0,
    '附件一次都没被请求：图片根本没进入本轮结果，重试无从谈起'
  );
  assert.ok(
    !result2.payload,
    '本轮没有可处理消息（文字已处理），图片订单永久丢失'
  );
});

test('A4. 对照组：未保存订单（游标未动）时，原图下载成功后可以补回', async () => {
  // 第一轮：图片 deferred，但不保存任何订单
  const first = makeReader(async () => ({
    ok: false,
    error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' },
  }));
  const server1 = makeServer({ pendingIds: ['msg:image-0930', 'msg:text-0935'] });
  const result1 = await run(first, server1, BASE_BINDING);
  assert.equal(result1.deferredImageCount, 1);
  // 刻意不调用 saveOrder —— 游标保持 0

  // 第二轮：原图已可下载
  const second = makeReader(async () => ({
    ok: true,
    result: { mimeType: 'image/png', size: 10, dataUrl: 'data:image/png;base64,AAAA' },
  }));
  const server2 = makeServer({
    pendingIds: ['msg:image-0930', 'msg:text-0935'],
    cursorTimeMs: 0,
  });
  const result2 = await run(second, server2, BASE_BINDING);

  assert.equal(second.state.attachmentCalls.length, 1, '应重新尝试取附件');
  assert.equal(result2.deferredImageCount, 0, '本次不再有待补齐');
  const sourceIds = result2.payload.source.messages.map((m) => m.messageFingerprint);
  assert.ok(
    sourceIds.includes('msg:image-0930'),
    '游标未推进时图片可以被补回——证明丢失只由游标推进造成'
  );
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
console.log(`\n图片漏读复现测试：${tests.length - failed}/${tests.length} 通过`);
if (failed) process.exit(1);
