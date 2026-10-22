import assert from 'node:assert/strict';
import { reusePendingWechatTextTask } from './wechatTaskClaimPlan.js';

const existing = {
  token: 'task:16',
  taskType: 'text',
  sourceKey: 'wechat2:existing',
  draftRevision: 3,
  departmentId: 1546,
  payload: {
    text: '鲜花2束',
    source: { wechatTaskId: 16, messages: [{ messageFingerprint: 'm1' }] },
  },
};
const incoming = {
  token: 'new-task',
  taskType: 'text',
  sourceKey: 'wechat2:new',
  payload: {
    text: '土豆9斤',
    source: { messages: [{ messageFingerprint: 'm2' }] },
  },
};

const planned = reusePendingWechatTextTask(incoming, existing, (left, right) => ({
  text: `${left.text}\n${right.text}`,
  source: { messages: [...left.source.messages, ...right.source.messages] },
}));

assert.equal(planned.token, 'task:16');
assert.equal(planned.sourceKey, 'wechat2:existing');
assert.equal(planned.draftRevision, 3);
assert.equal(planned.payload.source.wechatTaskId, 16);
assert.equal(planned.payload.text, '鲜花2束\n土豆9斤');
assert.deepEqual(planned.payload.source.messages.map(item => item.messageFingerprint), ['m1', 'm2']);

assert.equal(
  reusePendingWechatTextTask({ ...incoming, taskType: 'image' }, existing, () => null).token,
  'new-task'
);

console.log('wechat task claim plan tests passed');
