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
