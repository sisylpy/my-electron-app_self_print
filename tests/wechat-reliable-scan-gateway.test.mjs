import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDispatchGateway } = require('../src/dispatch/dispatch-gateway.js');

function scanMessage(index) {
  return {
    messageFingerprint: `message-${String(index).padStart(8, '0')}`,
    messageTimeMs: 1792656000000,
    messageKind: 'TEXT',
    processingState: 'UNCLAIMED',
    readerLocator: null,
    readerAttachmentId: null,
  };
}

test('450 条可靠扫描按 200+200+50 登记，全部成功后才 finalize', async () => {
  const calls = [];
  const gateway = createDispatchGateway({
    app: {
      getPath: () => path.join(os.tmpdir(), 'wechat-reliable-scan-gateway'),
      getVersion: () => 'test',
    },
    safeStorage: { isEncryptionAvailable: () => false },
    axios: { create: () => ({
      request: async options => {
        calls.push(options);
        if (options.url === 'desktop-dispatch/v1/auth/me') {
          return { status: 200, data: { code: 0, data: { userId: 9, disId: 160 } } };
        }
        return { status: 200, data: { code: 0, data: { accepted: true } } };
      },
    }) },
  });
  assert.equal((await gateway.adoptLoginSession({ accessToken: 'test-token' })).ok, true);
  calls.length = 0;

  const result = await gateway.commitReliableWechatScan({
    customerId: 7,
    scanId: 'scan-450-gateway-test',
    bindingRevision: 3,
    protocolVersion: 2,
    windowStartTimeMs: 1792569600000,
    windowEndTimeMs: 1792656000000,
    messages: Array.from({ length: 450 }, (_unused, index) => scanMessage(index)),
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 5);
  assert.match(calls[0].url, /scans\/begin$/);
  assert.deepEqual(calls.slice(1, 4).map(call => call.data.messages.length), [200, 200, 50]);
  assert.match(calls[4].url, /scans\/scan-450-gateway-test\/finalize$/);
  assert.equal(calls[0].data.expectedMessageCount, 450);
  assert.equal(calls[0].data.expectedBatchCount, 3);
  calls.slice(1, 4).forEach(call => assert.match(call.data.batchDigest, /^[a-f0-9]{64}$/));
  assert.match(calls[0].data.scanDigest, /^[a-f0-9]{64}$/);
});

test('已有待确认任务可原子领取后来到达的消息', async () => {
  const calls = [];
  const gateway = createDispatchGateway({
    app: {
      getPath: () => path.join(os.tmpdir(), 'wechat-reliable-task-gateway'),
      getVersion: () => 'test',
    },
    safeStorage: { isEncryptionAvailable: () => false },
    axios: { create: () => ({
      request: async options => {
        calls.push(options);
        if (options.url === 'desktop-dispatch/v1/auth/me') {
          return { status: 200, data: { code: 0, data: { userId: 9, disId: 160 } } };
        }
        return { status: 200, data: { code: 0, data: { orderTaskId: 88 } } };
      },
    }) },
  });
  await gateway.adoptLoginSession({ accessToken: 'test-token' });
  calls.length = 0;
  const result = await gateway.claimWechatTask({
    customerId: 7,
    bindingRevision: 3,
    departmentId: 11,
    sourceKey: `wechat2:${'a'.repeat(64)}`,
    orderTaskId: 88,
    taskKind: 'TEXT',
    draftText: '苹果2斤',
    messageFingerprints: ['message-00000001', 'message-00000002'],
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].data.orderTaskId, 88);
  assert.deepEqual(calls[0].data.messageFingerprints,
    ['message-00000001', 'message-00000002']);
});
