import assert from 'node:assert/strict';
import {
  CONVERSATION_DIRECT,
  CONVERSATION_GROUP,
  GROUP_ALL_MEMBER_MESSAGES,
  GROUP_MENTION_SELF_ONLY,
  isReadableWechatOrderText,
  selectWechatOrderMessages,
} from './wechatOrderMessagePolicy.js';

const participants = [
  { id: 'fp:self', displayName: '当前账号', isSelf: true },
  { id: 'fp:member-a', displayName: '成员A', isSelf: false },
  { id: 'fp:member-b', displayName: '成员B', isSelf: false },
];
const messages = [
  { id: 'self', senderId: 'fp:self', type: 'text', text: '商家回复' },
  { id: 'plain', senderId: 'fp:member-a', type: 'text', text: '西瓜10个' },
  { id: 'mention-self', senderId: 'fp:member-a', type: 'text', text: '@当前账号\u2005土豆5斤' },
  { id: 'mention-other', senderId: 'fp:member-b', type: 'text', text: '@其他商家\u2005白菜2件' },
  { id: 'multiline-order', senderId: 'fp:member-a', type: 'text', text: '中葱五斤\n小黄瓜一斤' },
  { id: 'replacement', senderId: 'fp:member-a', type: 'text', text: '‹\uFFFD/\uFFFD›y' },
  { id: 'nul', senderId: 'fp:member-a', type: 'text', text: '西瓜\u000010斤' },
  { id: 'control', senderId: 'fp:member-a', type: 'text', text: '土豆\u00075斤' },
  { id: 'binary-like', senderId: 'fp:member-a', type: 'text', text: '‹/›y' },
  { id: 'image-placeholder', senderId: 'fp:member-a', type: 'text', text: '[图片]' },
  { id: 'image', senderId: 'fp:member-a', type: 'image', text: '' },
];

assert.equal(isReadableWechatOrderText('中葱五斤\n小黄瓜一斤'), true);
assert.equal(isReadableWechatOrderText('‹\uFFFD/\uFFFD›y'), false);
assert.equal(isReadableWechatOrderText('西瓜\u000010斤'), false);
assert.equal(isReadableWechatOrderText('土豆\u00075斤'), false);
assert.equal(isReadableWechatOrderText('‹/›y'), false);
assert.equal(isReadableWechatOrderText('[图片]'), false);

assert.deepEqual(
  selectWechatOrderMessages(messages, participants, { conversationKind: CONVERSATION_DIRECT })
    .map((item) => item.id),
  ['plain', 'mention-self', 'mention-other', 'multiline-order', 'image'],
);

assert.deepEqual(
  selectWechatOrderMessages(messages, participants, {
    conversationKind: CONVERSATION_GROUP,
    groupMode: GROUP_ALL_MEMBER_MESSAGES,
  }).map((item) => item.id),
  ['plain', 'mention-self', 'mention-other', 'multiline-order', 'image'],
);

const mentioned = selectWechatOrderMessages(messages, participants, {
  conversationKind: CONVERSATION_GROUP,
  groupMode: GROUP_MENTION_SELF_ONLY,
});
assert.deepEqual(mentioned.map((item) => item.id), ['mention-self']);
assert.equal(mentioned[0].orderText, '土豆5斤');

console.log('WeChat group order message policy passed');
