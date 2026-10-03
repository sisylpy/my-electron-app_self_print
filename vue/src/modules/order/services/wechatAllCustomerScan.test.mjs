import assert from 'node:assert/strict';
import { scanAllBoundWechatCustomers } from './wechatAllCustomerScan.js';

const calls = [];
const progress = [];
let activeScans = 0;
let maxActiveScans = 0;

const result = await scanAllBoundWechatCustomers({
  entries: [
    { title: '调料群', row: { customerId: 18 } },
    { title: '失效客户', row: { customerId: 19 } },
    { title: '蔬菜群', row: { customerId: 20 } },
  ],
  onProgress: item => progress.push(`${item.current}/${item.total}:${item.title}`),
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
assert.equal(result.checkedCount, 3);
assert.equal(result.successCount, 2);
assert.equal(result.emptyCount, 1);
assert.equal(result.imports.length, 2);
assert.deepEqual(result.failures, [
  { title: '失效客户', message: '微信搜索不到该客户' },
]);

await assert.rejects(
  () => scanAllBoundWechatCustomers({ entries: [] }),
  /scanEntry must be a function/,
);

console.log('WeChat all-customer scan orchestration passed');
