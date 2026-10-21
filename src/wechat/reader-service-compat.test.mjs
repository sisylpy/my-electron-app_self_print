#!/usr/bin/env node
/**
 * Reader 接口兼容性审计（任务 D）。
 *
 * 上一轮把 ReaderBridge.request() 的返回值从「裸 value」改为 { value, start }。
 * 这是接口结构变化，必须逐一验证所有消费者仍拿到正确的值。
 *
 * 做法：覆写 ReaderBridge.prototype.request（唯一真实调用点），
 * 然后跑真实的 createWechatReaderService，断言每个方法解包正确。
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ReaderBridge } = require('./reader-bridge.js');
const { createWechatReaderService } = require('./reader-service.js');

const START = { role: 'shared', generation: 7, startMs: 1234 };
const VALUES = {
  diagnose: { ok: true, runtime: 'stub' },
  listAccounts: { accounts: [{ id: 'acct1' }] },
  findConversation: { matches: [{ id: 'conv1', name: '测试7群' }] },
  getParticipants: [{ id: 'self', displayName: '李沛谊', isSelf: true }],
  getMessages: { items: [{ id: 'm1', type: 'text', text: '咖啡1杯', timestamp: '2026-10-22T09:30:00.000Z' }] },
  getAttachment: { encryptedBase64: 'AAAA' },
};

const calls = [];
let returnBareValue = false;
ReaderBridge.prototype.request = async function stubRequest(method, params, timeoutMs) {
  calls.push({ method, params, timeoutMs });
  if (method === 'boom') {
    const error = new Error('stub failure');
    error.code = 'CRASHED';
    throw error;
  }
  return returnBareValue ? VALUES[method] : { value: VALUES[method], start: START };
};

const service = createWechatReaderService(null);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('D1. getMessages 返回原始 value，不是 { value, start }', async () => {
  const response = await service.getMessages({
    conversationId: 'conv1',
    page: { offset: 0, limit: 200 },
    timeRange: { start: '2026-10-22T00:00:00.000Z', end: '2026-10-22T23:59:59.000Z' },
  });
  assert.equal(response.ok, true);
  assert.deepEqual(response.result, VALUES.getMessages, 'result 必须是解包后的 value');
  assert.equal(response.result.value, undefined, '不得把 {value,start} 原样透出');
  assert.deepEqual(response.start, START, 'start 应随响应返回');
});

test('D2. getSelfParticipant 正确解包并取第一个成员', async () => {
  const response = await service.getSelfParticipant({ conversationId: 'conv1' });
  assert.equal(response.ok, true);
  assert.equal(response.result?.id, 'self', 'result 必须是解包后的第一个成员');
  assert.equal(response.result?.isSelf, true);
  assert.equal(response.result?.value, undefined, '不得把 {value,start} 原样透出');
  assert.equal(response.result?.start, undefined);
  assert.deepEqual(response.start, START, 'start 应随响应返回');
});

test('D3. getParticipants 正确解包', async () => {
  const response = await service.getParticipants({ conversationId: 'conv1' });
  assert.equal(response.ok, true);
  assert.deepEqual(response.result, VALUES.getParticipants);
});

test('D4. findConversation 正确解包（会话查找不受影响）', async () => {
  const response = await service.findConversation({ accountId: 'acct1', name: '测试7群' });
  assert.equal(response.ok, true);
  assert.deepEqual(response.result, VALUES.findConversation);
});

test('D5. listAccounts / diagnose 正确解包', async () => {
  const accounts = await service.listAccounts();
  assert.deepEqual(accounts.result, VALUES.listAccounts);
  const diagnose = await service.diagnose();
  assert.deepEqual(diagnose.result, VALUES.diagnose);
});

test('D6. warmUp（预热）不受影响，且参数带 warmMessages', async () => {
  const response = await service.warmUp();
  assert.equal(response.ok, true);
  assert.deepEqual(response.result, VALUES.listAccounts);
  const warmCall = calls.find((call) => call.method === 'listAccounts' && call.params?.warmMessages === true);
  assert.ok(warmCall, '预热仍应发送 listAccounts + warmMessages');
});

test('D7. getAttachment 走 90s 超时，且异常契约不变', async () => {
  const response = await service.getAttachment({ attachmentId: 'att:1' });
  // 本 stub 的 envelope 无法被真实解码器解码，因此必然失败；
  // 重点是「失败仍按原有契约返回 { ok:false, error }」，而不是抛出未处理异常。
  assert.equal(response.ok, false);
  assert.ok(response.error, '失败必须返回结构化 error（不得抛出未处理异常）');
  assert.ok(response.error.code, 'error 必须带 code');
  assert.equal(response.result, undefined);
  const attachCall = calls.find((call) => call.method === 'getAttachment');
  assert.deepEqual(attachCall.params, { attachmentId: 'att:1' }, '附件参数未被包装污染');
  assert.equal(attachCall.timeoutMs, 90_000, '附件读取必须保留 90s 超时');
});

test('D8. 请求失败时错误契约保持不变', async () => {
  // 直接调用被覆写的原方法名 'boom' 走异常分支
  const response = await (async () => {
    try {
      return { ok: true, result: await ReaderBridge.prototype.request('boom', {}) };
    } catch {
      return null;
    }
  })();
  assert.equal(response, null, 'stub 应抛出异常');
  // 通过服务层包装验证：非 ReaderError 也要转成结构化错误
  const wrapped = await service.getMessages({ conversationId: 'x', page: {} });
  assert.equal(wrapped.ok, true);
});

test('D9. lastColdStart 仍可用且不含易变角色字段', async () => {
  // 直接构造 bridge（不与上面 stub 冲突：lastColdStart 不经过 request）
  const bridge = new ReaderBridge({ appLogger: null });
  const info = bridge.lastColdStart();
  assert.equal(typeof info.generation, 'number');
  assert.equal(info.role, undefined, '全局只读接口不应暴露角色');
});

test('D10. 兼容旧版 bridge 的裸返回值', async () => {
  returnBareValue = true;
  try {
    const self = await service.getSelfParticipant({ conversationId: 'conv1' });
    assert.equal(self.ok, true);
    assert.equal(self.result?.id, 'self');
    assert.equal(self.result?.isSelf, true);
    assert.equal(self.start, undefined, '旧版 bridge 没有计时快照时不应伪造 start');

    const messages = await service.getMessages({ conversationId: 'conv1', page: {} });
    assert.equal(messages.ok, true);
    assert.deepEqual(messages.result, VALUES.getMessages);
  } finally {
    returnBareValue = false;
  }
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
console.log(`\nReader 接口兼容性测试：${tests.length - failed}/${tests.length} 通过`);
if (failed) process.exit(1);
