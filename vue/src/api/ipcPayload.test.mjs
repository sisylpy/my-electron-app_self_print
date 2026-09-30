import assert from 'node:assert/strict';
import { toIpcCloneableJson } from './ipcPayload.js';

const reactiveLikeSource = new Proxy({
  customerId: 7,
  accountFingerprint: 'fp:account1234',
  conversationFingerprint: 'fp:group123456',
  conversationKind: 'group',
  groupMode: 'ALL_MEMBER_MESSAGES',
  messages: [{ messageFingerprint: 'fp:group123456:100', messageTimeMs: 1700000001000 }],
}, {});
const reactiveLikeOrder = new Proxy({
  nxDoGoodsName: '西瓜',
  nxDoQuantity: '10',
  nxDoStandard: '个',
}, {});

assert.throws(() => structuredClone(reactiveLikeSource));

const cloneable = toIpcCloneableJson({
  orderList: [reactiveLikeOrder],
  pasteText: '西瓜10个',
  type: 3,
  wechatOrderSource: reactiveLikeSource,
}, '订单数据');

assert.doesNotThrow(() => structuredClone(cloneable));
assert.deepEqual(cloneable.orderList[0], {
  nxDoGoodsName: '西瓜',
  nxDoQuantity: '10',
  nxDoStandard: '个',
});
assert.equal(cloneable.wechatOrderSource.groupMode, 'ALL_MEMBER_MESSAGES');

console.log('IPC payload clone boundary passed');
