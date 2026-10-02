import assert from 'node:assert/strict';
import {
  splitWechatOrderPayloads,
  wechatOrderTaskLabel,
} from '../vue/src/modules/order/services/wechatOrderTaskSplit.js';

const source = {
  customerId: 7,
  conversationFingerprint: 'wechat:jin-tiao-liao',
  messages: [
    { messageFingerprint: 'msg:image', messageTimeMs: 1000 },
    { messageFingerprint: 'msg:text', messageTimeMs: 2000 },
  ],
};
const payload = {
  text: '中葱五斤\n小黄瓜一斤',
  images: [{
    messageFingerprint: 'msg:image',
    messageTimeMs: 1000,
    mimeType: 'image/jpeg',
    dataUrl: 'data:image/jpeg;base64,/9j/2Q==',
  }],
  entries: [
    { messageFingerprint: 'msg:image', messageTimeMs: 1000, type: 'image', text: '' },
    { messageFingerprint: 'msg:text', messageTimeMs: 2000, type: 'text', text: '中葱五斤\n小黄瓜一斤' },
  ],
  source,
};

const tasks = splitWechatOrderPayloads(payload);
assert.equal(tasks.length, 2);
assert.deepEqual(tasks.map(task => task.taskType), ['text', 'image']);
assert.deepEqual(tasks[0].source.messages, [source.messages[1]]);
assert.equal(tasks[0].text, '中葱五斤\n小黄瓜一斤');
assert.equal(tasks[0].images.length, 0);
assert.deepEqual(tasks[1].source.messages, [source.messages[0]]);
assert.equal(tasks[1].text, '');
assert.equal(tasks[1].images.length, 1);
assert.equal(wechatOrderTaskLabel('image'), '图片识别任务');
assert.equal(wechatOrderTaskLabel('text'), '文字粘贴任务');

const textOnly = splitWechatOrderPayloads({
  ...payload,
  images: [],
  entries: [payload.entries[1]],
  source: { ...source, messages: [source.messages[1]] },
});
assert.equal(textOnly.length, 1);
assert.equal(textOnly[0].taskType, 'text');

console.log('WeChat image/text task split passed');
