import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeWechatOrderPayload } from './wechatOrderImport.js';

function sourceMessages(ids) {
  return ids.map((id, index) => ({
    messageFingerprint: id,
    messageTimeMs: 1000 + index,
  }));
}

const originalText = '鲜花2束\n西兰花8斤\n油菜1件\n油菜3件';
const messageIds = ['msg:flower', 'msg:broccoli', 'msg:rape-1', 'msg:rape-3'];
const freshPayload = {
  text: originalText,
  entries: [
    { messageFingerprint: 'msg:flower', messageTimeMs: 1000, text: '鲜花2束' },
    { messageFingerprint: 'msg:broccoli', messageTimeMs: 1001, text: '西兰花8斤' },
    { messageFingerprint: 'msg:rape-1', messageTimeMs: 1002, text: '油菜1件' },
    { messageFingerprint: 'msg:rape-3', messageTimeMs: 1003, text: '油菜3件' },
  ],
  source: { messages: sourceMessages(messageIds) },
};

test('重复全量检查不会把同一待确认订单再次拼接', () => {
  const restoredPayload = {
    text: originalText,
    entries: [],
    source: { messages: sourceMessages(messageIds) },
  };

  const checkedOnce = mergeWechatOrderPayload(restoredPayload, freshPayload);
  const checkedTwice = mergeWechatOrderPayload(checkedOnce, freshPayload);
  const checkedThreeTimes = mergeWechatOrderPayload(checkedTwice, freshPayload);

  assert.equal(checkedThreeTimes.text, originalText);
  assert.equal(checkedThreeTimes.source.messages.length, 4);
});

test('恢复的整份草稿只追加真正的新消息', () => {
  const restoredPayload = {
    text: '鲜花2束\n西兰花8斤',
    entries: [],
    source: { messages: sourceMessages(['msg:flower', 'msg:broccoli']) },
  };
  const refreshedPayload = {
    text: '鲜花2束\n西兰花8斤\n土豆9斤',
    entries: [
      { messageFingerprint: 'msg:flower', messageTimeMs: 1000, text: '鲜花2束' },
      { messageFingerprint: 'msg:broccoli', messageTimeMs: 1001, text: '西兰花8斤' },
      { messageFingerprint: 'msg:potato', messageTimeMs: 1002, text: '土豆9斤' },
    ],
    source: { messages: sourceMessages(['msg:flower', 'msg:broccoli', 'msg:potato']) },
  };

  const merged = mergeWechatOrderPayload(restoredPayload, refreshedPayload);

  assert.equal(merged.text, '鲜花2束\n西兰花8斤\n土豆9斤');
  assert.equal(merged.source.messages.length, 3);
});

test('重新检查保留人工编辑的草稿并只追加新消息', () => {
  const editedPayload = {
    ...freshPayload,
    text: '鲜花改为3束\n西兰花8斤\n油菜合计4件',
  };
  const incoming = {
    text: `${originalText}\n冬瓜6斤`,
    entries: [
      ...freshPayload.entries,
      { messageFingerprint: 'msg:winter-melon', messageTimeMs: 1004, text: '冬瓜6斤' },
    ],
    source: { messages: sourceMessages([...messageIds, 'msg:winter-melon']) },
  };

  const merged = mergeWechatOrderPayload(editedPayload, incoming);

  assert.equal(merged.text, '鲜花改为3束\n西兰花8斤\n油菜合计4件\n冬瓜6斤');
  assert.equal(merged.source.messages.length, 5);
});
