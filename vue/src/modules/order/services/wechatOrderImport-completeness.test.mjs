#!/usr/bin/env node
/**
 * 消息完整性统计 / 分页上限 / 图片附件 / 游标边界 / 失败恢复 的可执行测试。
 *
 * 使用 stub 化的 electronAPI 驱动真实的 prepareWechatOrderImport，
 * 断言它「实际发出的计时事件」与「返回值」，而不是只做语法检查。
 *
 * 覆盖：
 *   1. 完整性计数：原始 / 保留 / 按原因排除
 *   2. 200 条上限截断标记
 *   3. 图片附件：成功 / 待补齐 / 失败
 *   4. 游标边界：原图未下载时不得推进游标，且不得进入 source.messages
 *   5. 失败恢复：非「原图未下载」错误必须抛出（整次读取失败）
 *   6. 服务端 pending / processed / submitted 计数
 *   7. 隐私：计时事件里不得出现任何聊天原文
 */
import assert from 'node:assert/strict';
import {
  prepareWechatOrderImport,
  WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED,
} from './wechatOrderImport.js';

const BASE_BINDING = {
  enabled: 1,
  displayName: '测试7群',
  accountFingerprint: 'fp:account123',
  conversationFingerprint: 'fp:conversation123',
  conversationKind: 'group',
  groupMode: 'ALL_MEMBER_MESSAGES',
  cursorTimeMs: 0,
};

const SELF = { id: 'self', displayName: '测试账号', isSelf: true };
const FRIEND = { id: 'friend', displayName: '测试客户', isSelf: false };

/** 构造一次读取：收集全部计时事件，返回 { result, events, find } */
async function runImport({
  messages,
  pendingMessageFingerprints = null,
  processedCount = 0,
  preparedCursorTimeMs = 5000,
  attachmentImpl = null,
  attachmentRetryDelaysMs = [],
  binding = BASE_BINDING,
}) {
  const events = [];
  const fingerprints = pendingMessageFingerprints
    ?? messages.filter((m) => m.senderId !== 'self').map((m) => m.id);
  let prepareCallCount = 0;
  let attachmentCallCount = 0;
  let getMessagesCallCount = 0;

  const electronAPI = {
    customerWechatOrders: {
      prepareMessages: async (_customerId, submitted) => {
        prepareCallCount += 1;
        return {
          ok: true,
          data: {
            binding: { ...binding, cursorTimeMs: preparedCursorTimeMs },
            pendingMessageFingerprints: fingerprints,
            pendingCount: fingerprints.length,
            processedCount,
          },
        };
      },
    },
    wechatReader: {
      getSelfParticipant: async () => ({ ok: true, result: SELF }),
      getMessages: async () => {
        getMessagesCallCount += 1;
        return { ok: true, result: { items: messages } };
      },
      getAttachment: attachmentImpl
        ? async (attachmentId) => {
          attachmentCallCount += 1;
          return attachmentImpl(attachmentId);
        }
        : attachmentImpl,
      lastColdStart: async () => ({ generation: 0, startMs: 0, role: 'warm' }),
    },
  };

  const result = await prepareWechatOrderImport({
    customerId: 7,
    binding,
    retryDelaysMs: [],
    attachmentRetryDelaysMs,
    electronAPI,
    onTiming: (event) => events.push(event),
  });

  const find = (stage) => events.filter((e) => e.stage === stage);
  return {
    result,
    events,
    find,
    last: (stage) => find(stage).at(-1),
    prepareCallCount,
    attachmentCallCount,
    getMessagesCallCount,
  };
}

function ts(offsetMs) {
  return new Date(Date.now() - 60_000 + offsetMs).toISOString();
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

// ---------------------------------------------------------------- 1. 完整性计数
test('1. 完整性计数：原始/保留/按原因排除 分类正确', async () => {
  const messages = [
    { id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: ts(0) },
    { id: 'm2', senderId: 'friend', type: 'text', text: '西兰花2件', timestamp: ts(1) },
    { id: 'm3', senderId: 'self', type: 'text', text: '收到', timestamp: ts(2) },
    { id: 'm4', senderId: 'friend', type: 'video', text: '', timestamp: ts(3) },
    { id: 'm5', senderId: 'friend', type: 'text', text: '[图片]', timestamp: ts(4) },
    { id: 'm6', senderId: 'friend', type: 'image', text: '', timestamp: ts(5), attachmentRef: { id: 'att:6' } },
    { id: 'm7', senderId: 'friend', type: 'text', text: '��', timestamp: ts(6) },
    { id: 'm8', senderId: 'friend', type: 'text', text: '   ', timestamp: ts(7) },
  ];
  const { last } = await runImport({
    messages,
    // m6 是图片，必须提供附件能力，否则读取会按业务规则直接失败。
    attachmentImpl: async () => ({
      ok: true,
      result: { mimeType: 'image/png', size: 10, dataUrl: 'data:image/png;base64,AAAA' },
    }),
  });
  const filter = last('message-filter');

  assert.equal(filter.rawMessageCount, 8, '原始条数应为 8');
  assert.equal(filter.selectedCount, 3, 'm1/m2/m6 应被保留');
  assert.equal(filter.excludedByType, 1, 'm4 非 text/image');
  assert.equal(filter.excludedBySelf, 1, 'm3 本人发送');
  assert.equal(filter.excludedByUnreadable, 3, 'm5 占位符 / m7 乱码 / m8 纯空白');
  assert.equal(filter.excludedByMention, 0, 'ALL_MEMBER_MESSAGES 模式不按 @ 过滤');
  assert.equal(filter.pageFull, false);
});

test('1b. 完整性计数不得修改被统计的消息对象（观察性副作用检查）', async () => {
  const messages = [
    { id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: ts(0) },
    { id: 'm2', senderId: 'self', type: 'text', text: '收到', timestamp: ts(1) },
    { id: 'm3', senderId: 'friend', type: 'image', text: '', timestamp: ts(2), attachmentRef: { id: 'att:3' } },
  ];
  const before = JSON.parse(JSON.stringify(messages));
  await runImport({
    messages,
    attachmentImpl: async () => ({
      ok: true,
      result: { mimeType: 'image/png', size: 10, dataUrl: 'data:image/png;base64,AAAA' },
    }),
  });
  assert.deepEqual(messages, before, '统计逻辑不得改写消息数组');
});

// ---------------------------------------------------------------- 2. 200 条上限
test('2. 本页已满：返回正好等于页上限时 pageFull=true（不代表已确认截断）', async () => {
  const many = Array.from({ length: 200 }, (_unused, index) => ({
    id: `bulk:${index}`,
    senderId: 'self',
    type: 'text',
    text: '本人消息',
    timestamp: ts(index),
  }));
  const { result, last } = await runImport({ messages: many });
  const filter = last('message-filter');

  assert.equal(filter.rawMessageCount, 200);
  assert.equal(filter.pageLimit, 200);
  // 语义修正：本页已满 ≠ 已经截断，只代表「可能还有后续数据」。
  assert.equal(filter.pageFull, true, '返回条数达到本页上限应标记 pageFull');
  assert.equal(result.status, 'empty', '全部为本人消息时应无待处理');
});

test('2b. 未达上限时 pageFull=false', async () => {
  const { last } = await runImport({
    messages: [{ id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: ts(0) }],
  });
  assert.equal(last('message-filter').pageFull, false);
});

test('2c. 排序方向黑盒诊断字段可用（用于真机判定丢最新还是丢最旧）', async () => {
  const { last } = await runImport({
    messages: [{ id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: ts(0) }],
  });
  const filter = last('message-filter');
  assert.ok(
    'oldestDeltaFromWindowStartMs' in filter && 'newestGapToWindowEndMs' in filter,
    '必须输出窗口两端距离，才能在真机判定排序方向'
  );
  assert.ok(
    Number.isFinite(filter.oldestDeltaFromWindowStartMs)
    && Number.isFinite(filter.newestGapToWindowEndMs)
  );
});

// ---------------------------------------------------------------- 3. 图片附件
test('3. 图片附件：成功 / 待补齐 / 失败 分别计数', async () => {
  const messages = [
    { id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: ts(0) },
    { id: 'img:ok', senderId: 'friend', type: 'image', text: '', timestamp: ts(1), attachmentRef: { id: 'att:ok' } },
    { id: 'img:defer', senderId: 'friend', type: 'image', text: '', timestamp: ts(2), attachmentRef: { id: 'att:defer' } },
  ];
  const { last } = await runImport({
    messages,
    attachmentImpl: async (attachmentId) => {
      if (attachmentId === 'att:ok') {
        return { ok: true, result: { mimeType: 'image/png', size: 10, dataUrl: 'data:image/png;base64,AAAA' } };
      }
      return { ok: false, error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' } };
    },
  });
  const attachment = last('attachment-result');

  assert.equal(attachment.pendingImageCount, 2);
  assert.equal(attachment.imageSuccessCount, 1, 'att:ok 应成功');
  assert.equal(attachment.imageDeferredCount, 1, 'att:defer 应记为待补齐');
  assert.equal(attachment.imageFailedCount, 0);
});

// ---------------------------------------------------------------- 4. 游标边界
test('4. 游标边界：有原图未下载时不得推进游标', async () => {
  const messages = [
    { id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: ts(0) },
    { id: 'img:defer', senderId: 'friend', type: 'image', text: '', timestamp: ts(1), attachmentRef: { id: 'att:defer' } },
  ];
  const { result } = await runImport({
    messages,
    preparedCursorTimeMs: 5000,
    attachmentImpl: async () => ({
      ok: false,
      error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' },
    }),
  });

  assert.equal(result.deferredImageCount, 1);
  assert.equal(
    result.binding.cursorTimeMs,
    0,
    '存在待补齐图片时必须沿用旧游标（0），不能采用服务端返回的 5000'
  );
});

test('4b. 游标边界：无待补齐图片时可以推进游标（对照组）', async () => {
  const messages = [
    { id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: ts(0) },
    { id: 'img:ok', senderId: 'friend', type: 'image', text: '', timestamp: ts(1), attachmentRef: { id: 'att:ok' } },
  ];
  const { result } = await runImport({
    messages,
    preparedCursorTimeMs: 5000,
    attachmentImpl: async () => ({
      ok: true,
      result: { mimeType: 'image/png', size: 10, dataUrl: 'data:image/png;base64,AAAA' },
    }),
  });

  assert.equal(result.deferredImageCount, 0);
  assert.equal(result.binding.cursorTimeMs, 5000, '无待补齐时应采用服务端推进后的游标');
});

test('4c. 游标边界风险前提：待补齐图片不进入 source.messages（保存订单不会等它）', async () => {
  const messages = [
    { id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: ts(0) },
    { id: 'img:defer', senderId: 'friend', type: 'image', text: '', timestamp: ts(1), attachmentRef: { id: 'att:defer' } },
  ];
  const { result } = await runImport({
    messages,
    attachmentImpl: async () => ({
      ok: false,
      error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' },
    }),
  });

  const sourceIds = result.payload.source.messages.map((m) => m.messageFingerprint);
  assert.ok(sourceIds.includes('m1'), '文本消息应进入 source.messages');
  assert.ok(
    !sourceIds.includes('img:defer'),
    '待补齐图片未进入 source.messages —— 这是「保存订单会把游标推进到更晚消息，' +
    '使更早的待补齐图片可能被挤出读取窗口」这一风险成立的前提'
  );
  assert.equal(result.payload.images.length, 0);
});

// ---------------------------------------------------------------- 5. 失败恢复
test('5. 失败恢复：非「原图未下载」错误必须抛出，整次读取失败', async () => {
  const messages = [
    { id: 'img:broken', senderId: 'friend', type: 'image', text: '', timestamp: ts(1), attachmentRef: { id: 'att:broken' } },
  ];
  await assert.rejects(
    () => runImport({
      messages,
      attachmentImpl: async () => ({
        ok: false,
        error: { code: 'PROTOCOL_ERROR', message: '微信图片解码失败' },
      }),
    }),
    (error) => {
      assert.equal(error.code, 'PROTOCOL_ERROR');
      return true;
    }
  );
});

test('5b. 「原图未下载」不抛出，走待补齐路径并可重试', async () => {
  let attempts = 0;
  const messages = [
    { id: 'img:retry', senderId: 'friend', type: 'image', text: '', timestamp: ts(1), attachmentRef: { id: 'att:retry' } },
  ];
  const { result } = await runImport({
    messages,
    attachmentRetryDelaysMs: [0],
    attachmentImpl: async () => {
      attempts += 1;
      return { ok: false, error: { code: WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED, message: '原图未下载' } };
    },
  });
  assert.equal(attempts, 2, 'attachmentRetryDelaysMs=[0] 应重试一次，共 2 次尝试');
  assert.equal(result.status, 'deferred', '全部图片待补齐时应返回 deferred 而非报错');
  assert.equal(result.binding.cursorTimeMs, 0, 'deferred 时游标不得推进');
});

// ---------------------------------------------------------------- 6. 服务端计数
test('6. 服务端去重计数：submitted / pending / processed 正确上报', async () => {
  const messages = [
    { id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: ts(0) },
    { id: 'm2', senderId: 'friend', type: 'text', text: '西兰花2件', timestamp: ts(1) },
    { id: 'm3', senderId: 'friend', type: 'text', text: '土豆3斤', timestamp: ts(2) },
  ];
  const { last, prepareCallCount } = await runImport({
    messages,
    pendingMessageFingerprints: ['m2'],
    processedCount: 2,
  });
  const prepareResult = last('server-prepare-result');

  assert.equal(prepareCallCount, 1);
  assert.equal(prepareResult.submittedCount, 3, '提交给服务端 3 条');
  assert.equal(prepareResult.pendingCount, 1, '服务端返回 1 条待处理');
  assert.equal(prepareResult.processedCount, 2, '服务端返回 2 条已处理');
});

// ---------------------------------------------------------------- 7. 隐私
test('7. 隐私：计时事件不得包含任何聊天原文', async () => {
  const messages = [
    { id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯机密客户名', timestamp: ts(0) },
  ];
  const { events } = await runImport({ messages });

  for (const event of events) {
    const serialized = JSON.stringify(event);
    assert.ok(
      !serialized.includes('咖啡1杯机密客户名'),
      `计时事件泄露聊天原文：${event.stage}`
    );
    for (const key of Object.keys(event)) {
      assert.ok(
        !['text', 'orderText', 'dataUrl', 'content'].includes(key),
        `计时事件出现禁止字段 ${key}（阶段 ${event.stage}）`
      );
    }
  }
});

// ---------------------------------------------------------------- D. 计数对业务无副作用
test('8. 完整性统计不额外触发附件读取或网络请求', async () => {
  const messages = [
    { id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: ts(0) },
    { id: 'img:ok', senderId: 'friend', type: 'image', text: '', timestamp: ts(1), attachmentRef: { id: 'att:ok' } },
  ];
  const { prepareCallCount, attachmentCallCount, getMessagesCallCount } = await runImport({
    messages,
    attachmentImpl: async () => ({
      ok: true,
      result: { mimeType: 'image/png', size: 10, dataUrl: 'data:image/png;base64,AAAA' },
    }),
  });
  assert.equal(getMessagesCallCount, 1, '消息只应读取一次（retryDelaysMs=[]）');
  assert.equal(prepareCallCount, 1, '服务端去重只应调用一次');
  assert.equal(attachmentCallCount, 1, '附件读取次数应等于待处理图片数，不得额外触发');
});

test('9. 统计阶段是结果快照，不重复计入操作耗时', async () => {
  const messages = [
    { id: 'm1', senderId: 'friend', type: 'text', text: '咖啡1杯', timestamp: ts(0) },
  ];
  const { last } = await runImport({ messages });
  const snapshot = last('server-prepare-result');
  assert.ok(snapshot, '应输出 server-prepare-result 快照');
  assert.ok(
    Number(snapshot.durationMs) < 20,
    `快照阶段耗时应接近 0，实际 ${snapshot.durationMs}`
  );
  assert.equal(snapshot.submittedCount, 1, '快照必须携带完整计数');
});

test('10. 完整性统计成本可控（200 条时筛选阶段仍有界）', async () => {
  const many = Array.from({ length: 200 }, (_unused, index) => ({
    id: `bulk:${index}`,
    senderId: 'friend',
    type: 'text',
    text: `商品${index}`,
    timestamp: ts(index),
  }));
  const { last } = await runImport({ messages: many });
  const filter = last('message-filter');
  assert.equal(filter.rawMessageCount, 200);
  assert.ok(
    Number(filter.durationMs) < 100,
    `200 条统计+筛选耗时应有界，实际 ${filter.durationMs}`
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
console.log(`\n消息完整性/分页/图片/游标/失败恢复测试：${tests.length - failed}/${tests.length} 通过`);
if (failed) process.exit(1);
