import assert from 'node:assert/strict';
import { splitWechatOrderPayloads } from './wechatOrderTaskSplit.js';

const payload = {
  text: '西红柿 2 斤',
  entries: [
    { messageFingerprint: 'msg:text-001', messageTimeMs: 1000, type: 'text', text: '西红柿 2 斤' },
    { messageFingerprint: 'msg:image-001', messageTimeMs: 2000, type: 'image', text: '' },
    { messageFingerprint: 'msg:image-002', messageTimeMs: 3000, type: 'image', text: '' },
  ],
  images: [
    {
      messageFingerprint: 'msg:image-001',
      messageTimeMs: 2000,
      mimeType: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,/9j/2Q==',
    },
    {
      messageFingerprint: 'msg:image-002',
      messageTimeMs: 3000,
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    },
  ],
  source: {
    conversationFingerprint: 'fp:conversation-001',
    messages: [
      { messageFingerprint: 'msg:text-001', messageTimeMs: 1000 },
      { messageFingerprint: 'msg:image-001', messageTimeMs: 2000 },
      { messageFingerprint: 'msg:image-002', messageTimeMs: 3000 },
    ],
  },
};

const tasks = splitWechatOrderPayloads(payload);

assert.equal(tasks.length, 3);
assert.equal(tasks[0].taskType, 'text');
assert.equal(tasks[0].text, '西红柿 2 斤');
assert.equal(tasks[0].images.length, 0);
assert.deepEqual(tasks[0].source.messages.map(item => item.messageFingerprint), ['msg:text-001']);

assert.equal(tasks[1].taskType, 'image');
assert.equal(tasks[1].taskFingerprint, 'msg:image-001');
assert.equal(tasks[1].text, '');
assert.deepEqual(tasks[1].images.map(item => item.messageFingerprint), ['msg:image-001']);
assert.deepEqual(tasks[1].source.messages.map(item => item.messageFingerprint), ['msg:image-001']);

assert.equal(tasks[2].taskType, 'image');
assert.equal(tasks[2].taskFingerprint, 'msg:image-002');
assert.deepEqual(tasks[2].images.map(item => item.messageFingerprint), ['msg:image-002']);
assert.deepEqual(tasks[2].source.messages.map(item => item.messageFingerprint), ['msg:image-002']);

console.log('wechat order task split tests passed');
