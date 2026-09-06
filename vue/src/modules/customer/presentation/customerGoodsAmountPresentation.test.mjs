import assert from 'node:assert/strict';
import {
  buildCustomerGoodsAmountRows,
  CUSTOMER_GOODS_AMOUNT_WINDOWS,
  resolveCustomerGoodsAverageQuantity,
  summarizeCustomerGoodsAmountRows,
} from './customerGoodsAmountPresentation.js';

const rows = buildCustomerGoodsAmountRows([
  { goodsName: '乙', lastOrderDays: 2, orderAmount90Days: 20 },
  { goodsName: '甲', lastOrderDays: 1, orderAmount90Days: 60 },
  { goodsName: '丁', lastOrderDays: 4, orderAmount90Days: 10 },
  { goodsName: '丙', lastOrderDays: 3, orderAmount90Days: 10 },
  { goodsName: '无金额', lastOrderDays: null, orderAmount90Days: null },
], 'orderAmount90Days');

assert.deepEqual(rows.map((item) => item.goodsName), ['甲', '乙', '丙', '丁', '无金额']);
assert.deepEqual(rows.map((item) => item.amountKey), ['core', 'core', 'important', 'general', 'noAmount']);
assert.equal(rows[0].amountShare, 60);
assert.deepEqual(summarizeCustomerGoodsAmountRows(rows), {
  totalAmount: 100,
  core: 2,
  withAmount: 4,
});

const dominant = buildCustomerGoodsAmountRows([
  { goodsName: '大额商品', lastOrderDays: 1, orderAmount30Days: 90 },
  { goodsName: '普通商品', lastOrderDays: 1, orderAmount30Days: 10 },
], 'orderAmount30Days');
assert.equal(dominant[0].amountKey, 'core');
assert.equal(dominant[1].amountKey, 'general');

const quantityItem = {
  spec: '斤',
  averageOrderQuantity30Days: 12.5,
  averageOrderQuantity90Days: 10,
  averageOrderQuantity365Days: 8.25,
  averageOrderQuantityAll: 7,
  averageOrderQuantityUnit: '公斤',
};
assert.deepEqual(resolveCustomerGoodsAverageQuantity(
  quantityItem,
  'frequency',
  CUSTOMER_GOODS_AMOUNT_WINDOWS[0],
), { value: 10, unit: '公斤' });
assert.deepEqual(resolveCustomerGoodsAverageQuantity(
  quantityItem,
  'amount',
  CUSTOMER_GOODS_AMOUNT_WINDOWS[0],
), { value: 12.5, unit: '公斤' });
assert.deepEqual(resolveCustomerGoodsAverageQuantity(
  { spec: '箱', averageOrderQuantity90Days: 0 },
  'frequency',
  CUSTOMER_GOODS_AMOUNT_WINDOWS[1],
), { value: null, unit: '箱' });

console.log('customer goods amount presentation tests passed');
