const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const coreApi = read('vue/src/api/all.js');
const orderApi = read('vue/src/modules/order/services/orderApi.js');
const controller = read('vue/src/modules/order/services/placeOrderController.js');

assert.match(
  coreApi,
  /recognizeWechatOrderImage\s*\([^)]*\)\s*\{/,
  '核心 API 必须实现微信图片订单识别',
);
assert.match(
  orderApi,
  /['"]recognizeWechatOrderImage['"]\s*,/,
  '订单 API 白名单必须转发微信图片订单识别',
);
assert.match(
  controller,
  /api\.recognizeWechatOrderImage\s*\(/,
  '订单页面必须通过订单 API 门面调用微信图片订单识别',
);

console.log('WeChat image order API contract smoke passed.');
