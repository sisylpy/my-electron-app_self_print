import assert from 'node:assert/strict';
import {
  customerParticipatesInAutoRead,
  databaseResultCoversConversation,
  readWechatCustomerDatabaseFirst,
  scanAllBoundWechatCustomers,
} from './wechatAllCustomerScan.js';

await assert.rejects(
  () => scanAllBoundWechatCustomers({
    entries: [{ title: '客户微信' }],
    scanEntry: async () => {
      const error = new Error('服务端认证失败');
      error.code = 'SERVER_AUTH_FAILED';
      throw error;
    },
  }),
  { code: 'SERVER_AUTH_FAILED' },
);

const excludedCustomerKeys = new Set(['7:20']);
assert.equal(customerParticipatesInAutoRead(7, 20, excludedCustomerKeys), false);
assert.equal(customerParticipatesInAutoRead(7, 21, excludedCustomerKeys), true);
excludedCustomerKeys.delete('7:20');
assert.equal(customerParticipatesInAutoRead(7, 20, excludedCustomerKeys), true);

const databaseOnlyCalls = [];
const databaseOnly = await readWechatCustomerDatabaseFirst({
  readDatabase: async ({ mode }) => {
    databaseOnlyCalls.push(`read:${mode}`);
    return { status: 'ready', payload: { text: '苹果5斤' } };
  },
  focusConversation: async () => databaseOnlyCalls.push('focus'),
});
assert.deepEqual(databaseOnlyCalls, ['read:database']);
assert.equal(databaseOnly.mode, 'database');
assert.equal(databaseOnly.verifiedByConversation, false);

const freshDuplicateCalls = [];
const freshDuplicate = await readWechatCustomerDatabaseFirst({
  readDatabase: async ({ mode }) => {
    freshDuplicateCalls.push(`read:${mode}`);
    return {
      status: 'duplicate',
      queryStartTimeMs: 1000,
      latestObservedMessageTimeMs: 5000,
    };
  },
  canTrustDatabaseResult: result => databaseResultCoversConversation(result, {
    available: true,
    exists: true,
    lastMessageTimeMs: 5000,
  }),
  focusConversation: async () => freshDuplicateCalls.push('focus'),
});
assert.deepEqual(freshDuplicateCalls, ['read:database']);
assert.equal(freshDuplicate.mode, 'database');
assert.equal(freshDuplicate.result.status, 'duplicate');

assert.equal(databaseResultCoversConversation(
  { status: 'empty', queryStartTimeMs: 10_000, latestObservedMessageTimeMs: null },
  { available: true, exists: true, lastMessageTimeMs: 9000 },
), true, 'a conversation older than the query window is fully covered');
assert.equal(databaseResultCoversConversation(
  { status: 'duplicate', queryStartTimeMs: 1000, latestObservedMessageTimeMs: 4000 },
  { available: true, exists: true, lastMessageTimeMs: 5000 },
), false, 'a newer session row must still open WeChat for hydration');
assert.equal(databaseResultCoversConversation(
  { status: 'duplicate', queryStartTimeMs: 1000, latestObservedMessageTimeMs: 5000 },
  { available: true, exists: false, lastMessageTimeMs: null },
), false, 'a stale binding is never trusted');

const fallbackCalls = [];
const fallback = await readWechatCustomerDatabaseFirst({
  readDatabase: async ({ mode }) => {
    fallbackCalls.push(`read:${mode}`);
    return mode === 'database'
      ? { status: 'empty' }
      : { status: 'ready', payload: { text: '油菜80斤' } };
  },
  focusConversation: async ({ databaseResult }) => {
    fallbackCalls.push(`focus:${databaseResult.status}`);
  },
});
assert.deepEqual(fallbackCalls, [
  'read:database',
  'focus:empty',
  'read:conversation',
]);
assert.equal(fallback.mode, 'conversation');
assert.equal(fallback.verifiedByConversation, true);

const recoveryCalls = [];
const recovered = await readWechatCustomerDatabaseFirst({
  readDatabase: async ({ mode }) => {
    recoveryCalls.push(`read:${mode}`);
    if (mode === 'database') throw new Error('图片附件尚未完整');
    return { status: 'ready', payload: { images: [{}] } };
  },
  focusConversation: async ({ databaseError }) => {
    recoveryCalls.push(`focus:${databaseError.message}`);
  },
});
assert.deepEqual(recoveryCalls, [
  'read:database',
  'focus:图片附件尚未完整',
  'read:conversation',
]);
assert.equal(recovered.mode, 'conversation');

await assert.rejects(
  () => readWechatCustomerDatabaseFirst({
    readDatabase: async () => ({ status: 'empty' }),
    focusConversation: async () => {
      throw new Error('微信搜索不到该客户');
    },
  }),
  /微信搜索不到该客户/,
);

const calls = [];
const progress = [];
const outcomes = [];
let activeScans = 0;
let maxActiveScans = 0;

const result = await scanAllBoundWechatCustomers({
  entries: [
    { title: '调料群', row: { customerId: 18 } },
    { title: '失效客户', row: { customerId: 19 } },
    { title: '蔬菜群', row: { customerId: 20 } },
  ],
  onProgress: item => progress.push(`${item.current}/${item.total}:${item.title}`),
  onResult: item => outcomes.push(`${item.current}/${item.total}:${item.title}:${item.status}:${item.itemCount}`),
  scanEntry: async (entry) => {
    activeScans += 1;
    maxActiveScans = Math.max(maxActiveScans, activeScans);
    calls.push(`start:${entry.title}`);
    await Promise.resolve();
    activeScans -= 1;
    if (entry.title === '失效客户') throw new Error('微信搜索不到该客户');
    calls.push(`finish:${entry.title}`);
    return entry.title === '调料群'
      ? [{ token: 'wechat:seasoning' }, { token: 'wechat:seasoning:image' }]
      : [];
  },
});

assert.equal(maxActiveScans, 1, 'WeChat conversations must never be opened concurrently');
assert.deepEqual(calls, [
  'start:调料群',
  'finish:调料群',
  'start:失效客户',
  'start:蔬菜群',
  'finish:蔬菜群',
]);
assert.deepEqual(progress, ['1/3:调料群', '2/3:失效客户', '3/3:蔬菜群']);
assert.deepEqual(outcomes, [
  '1/3:调料群:found:2',
  '2/3:失效客户:error:0',
  '3/3:蔬菜群:empty:0',
]);
assert.equal(result.checkedCount, 3);
assert.equal(result.successCount, 2);
assert.equal(result.emptyCount, 1);
assert.equal(result.imports.length, 2);
assert.deepEqual(result.failures, [
  { title: '失效客户', message: '微信搜索不到该客户' },
]);
assert.deepEqual(result.warnings, []);

const warningOutcomes = [];
const warningResult = await scanAllBoundWechatCustomers({
  entries: [{ title: '李沛谊' }],
  scanEntry: async () => ({
    items: [],
    warning: '1 张图片只有聊天缩略图，请打开原图后重试',
  }),
  onResult: item => warningOutcomes.push(item),
});
assert.equal(warningResult.failures.length, 0);
assert.deepEqual(warningResult.warnings, [{
  title: '李沛谊',
  message: '1 张图片只有聊天缩略图，请打开原图后重试',
}]);
assert.equal(warningOutcomes[0].status, 'warning');
assert.equal(warningResult.emptyCount, 0);

await assert.rejects(
  () => scanAllBoundWechatCustomers({ entries: [] }),
  /scanEntry must be a function/,
);

console.log('WeChat all-customer scan orchestration passed');
