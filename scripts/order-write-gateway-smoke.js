const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createOrderWriteGateway } = require('../src/order/order-write-gateway');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

async function main() {
  let capturedRequest = null;
  const axios = {
    create(options) {
      assert.strictEqual(options.withCredentials, false);
      return {
        async post(url, data, requestOptions) {
          capturedRequest = { url, data, requestOptions };
          return {
            status: 200,
            data: { code: 0, taskId: 88, data: [], task: {} },
          };
        },
      };
    },
  };

  const gateway = createOrderWriteGateway({ axios });
  const success = await gateway.savePasteOrders({
    orderList: [{ nxDoGoodsName: '小米椒', nxDoQuantity: '2', nxDoStandard: '斤' }],
    pasteText: '小米椒2斤',
    type: 3,
  });
  assert.strictEqual(success.ok, true);
  assert.strictEqual(capturedRequest.url, 'ocr/pasteSearchGoods');
  assert.strictEqual(capturedRequest.requestOptions.headers.Origin, undefined);
  assert.strictEqual(capturedRequest.requestOptions.maxRedirects, 0);
  assert.strictEqual(capturedRequest.data.type, 3);

  const wechatSuccess = await gateway.savePasteOrders({
    orderList: [{ nxDoGoodsName: '土豆', nxDoQuantity: '5', nxDoStandard: '斤' }],
    pasteText: '土豆5斤',
    type: 3,
    wechatOrderSource: {
      customerId: 7,
      bindingRevision: 3,
      wechatTaskId: 41,
      accountFingerprint: 'fp:account1234',
      conversationFingerprint: 'fp:friend12345',
      conversationKind: 'direct',
      groupMode: null,
      messages: [{ messageFingerprint: 'fp:friend12345:99', messageTimeMs: 1700000000000 }],
    },
  });
  assert.strictEqual(wechatSuccess.ok, true);
  assert.strictEqual(capturedRequest.data.wechatOrderSource.customerId, 7);
  assert.strictEqual(capturedRequest.data.wechatOrderSource.bindingRevision, 3);
  assert.strictEqual(capturedRequest.data.wechatOrderSource.wechatTaskId, 41);
  assert.strictEqual(capturedRequest.data.wechatOrderSource.conversationKind, 'direct');
  assert.strictEqual(capturedRequest.data.wechatOrderSource.messages.length, 1);

  const wechatGroupSuccess = await gateway.savePasteOrders({
    orderList: [{ nxDoGoodsName: '白菜', nxDoQuantity: '2', nxDoStandard: '件' }],
    pasteText: '白菜2件',
    type: 3,
    wechatOrderSource: {
      customerId: 7,
      bindingRevision: 3,
      wechatTaskId: 42,
      accountFingerprint: 'fp:account1234',
      conversationFingerprint: 'fp:group123456',
      conversationKind: 'group',
      groupMode: 'MENTION_SELF_ONLY',
      messages: [{ messageFingerprint: 'fp:group123456:100', messageTimeMs: 1700000001000 }],
    },
  });
  assert.strictEqual(wechatGroupSuccess.ok, true);
  assert.strictEqual(capturedRequest.data.wechatOrderSource.conversationKind, 'group');
  assert.strictEqual(capturedRequest.data.wechatOrderSource.groupMode, 'MENTION_SELF_ONLY');

  const missingGroupMode = await gateway.savePasteOrders({
    orderList: [{ nxDoGoodsName: '白菜', nxDoQuantity: '2', nxDoStandard: '件' }],
    type: 3,
    wechatOrderSource: {
      customerId: 7,
      bindingRevision: 3,
      wechatTaskId: 43,
      accountFingerprint: 'fp:account1234',
      conversationFingerprint: 'fp:group123456',
      conversationKind: 'group',
      messages: [{ messageFingerprint: 'fp:group123456:100', messageTimeMs: 1700000001000 }],
    },
  });
  assert.strictEqual(missingGroupMode.ok, false);
  assert.strictEqual(missingGroupMode.status, 400);

  const invalidWechatSource = await gateway.savePasteOrders({
    orderList: [{ nxDoGoodsName: '土豆', nxDoQuantity: '5', nxDoStandard: '斤' }],
    type: 3,
    wechatOrderSource: {
      customerId: 7,
      bindingRevision: 3,
      wechatTaskId: 44,
      accountFingerprint: 'wxid_secret',
      conversationFingerprint: 'fp:friend12345',
      conversationKind: 'direct',
      messages: [{ messageFingerprint: 'fp:friend12345:99', messageTimeMs: 1700000000000 }],
    },
  });
  assert.strictEqual(invalidWechatSource.ok, false);
  assert.strictEqual(invalidWechatSource.status, 400);

  const missingWechatTaskId = await gateway.savePasteOrders({
    orderList: [{ nxDoGoodsName: '土豆', nxDoQuantity: '5', nxDoStandard: '斤' }],
    type: 3,
    wechatOrderSource: {
      customerId: 7,
      bindingRevision: 3,
      accountFingerprint: 'fp:account1234',
      conversationFingerprint: 'fp:friend12345',
      conversationKind: 'direct',
      groupMode: null,
      messages: [{ messageFingerprint: 'fp:friend12345:99', messageTimeMs: 1700000000000 }],
    },
  });
  assert.strictEqual(missingWechatTaskId.ok, false);
  assert.strictEqual(missingWechatTaskId.status, 400);

  const excelSuccess = await gateway.savePasteOrders({
    orderList: [{ nxDoGoodsName: '小米椒', nxDoQuantity: '2', nxDoStandard: '斤' }],
    pasteText: '小米椒,2,斤',
    type: 2,
  });
  assert.strictEqual(excelSuccess.ok, true);
  assert.strictEqual(capturedRequest.data.type, 2);

  const unsupported = await gateway.savePasteOrders({
    orderList: [{ nxDoGoodsName: '小米椒' }],
    type: 1,
  });
  assert.strictEqual(unsupported.ok, false);
  assert.strictEqual(unsupported.status, 400);
  assert.strictEqual(capturedRequest.data.type, 2);

  const invalid = await gateway.savePasteOrders({ orderList: [], pasteText: '', type: 3 });
  assert.strictEqual(invalid.ok, false);
  assert.strictEqual(invalid.status, 400);

  const mainSource = read('src/main.js');
  const preloadSource = read('src/preload.js');
  const apiSource = read('vue/src/api/all.js');
  assert(mainSource.includes("ipcMain.handle('order-write-save-paste-orders'"));
  assert(preloadSource.includes('orderWrite: Object.freeze'));
  assert(!preloadSource.includes('orderApiRequest'));
  assert(apiSource.includes('window.electronAPI?.orderWrite?.savePasteOrders'));

  console.log('Order write gateway smoke passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
