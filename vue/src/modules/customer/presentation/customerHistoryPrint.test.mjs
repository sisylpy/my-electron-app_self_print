import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CUSTOMER_HISTORY_PRINT_COMPONENTS,
  normalizeCustomerHistoryPrintData,
  resolveCustomerHistoryPrintComponent,
} from './customerHistoryPrint.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const customerCenterPath = path.resolve(__dirname, '../views/CustomerCenter.vue');
const customerCenter = fs.readFileSync(customerCenterPath, 'utf8');
const historyOrders = fs.readFileSync(path.resolve(__dirname, '../../../components/HistoryOrders.vue'), 'utf8');

assert.equal(resolveCustomerHistoryPrintComponent('ApplyHalfPanel'), 'ApplyHalfPanel');
assert.equal(resolveCustomerHistoryPrintComponent('unknown-format'), 'ApplyPanel');
assert.equal(resolveCustomerHistoryPrintComponent(''), 'ApplyPanel');

const fallbackLines = [{ nxDepartmentOrdersId: 1 }];
const normalizedFallback = normalizeCustomerHistoryPrintData({ arr: fallbackLines }, {
  nxDepartmentBillId: 8,
  nxDbTradeNo: 'HISTORY-8',
});
assert.equal(normalizedFallback.bill.nxDbTradeNo, 'HISTORY-8');
assert.deepEqual(normalizedFallback.arr, fallbackLines);
assert.deepEqual(normalizedFallback.bill.nxDepartmentOrdersEntities, fallbackLines);
assert.notEqual(normalizedFallback.arr, fallbackLines, '打印数据不能复用接口数组引用');

const detailLines = [{ nxDepartmentOrdersId: 2 }];
const normalizedDetail = normalizeCustomerHistoryPrintData({
  bill: {
    nxDbTradeNo: 'DETAIL-2',
    nxDepartmentOrdersEntities: detailLines,
  },
  arr: fallbackLines,
}, { nxDbTradeNo: 'SUMMARY-2' });
assert.equal(normalizedDetail.bill.nxDbTradeNo, 'DETAIL-2');
assert.deepEqual(normalizedDetail.arr, detailLines, '账单内商品应优先于兼容 arr');

assert.match(customerCenter, /:is-history-order="true"/);
assert.match(customerCenter, /:order-data="historyPrintData"/);
assert.match(customerCenter, /loadedHistoryPrintComponent/);
assert.doesNotMatch(customerCenter, /class="bill-overview"/);
assert.doesNotMatch(customerCenter, /class="bill-lines"/);
assert.match(historyOrders, /预览 \/ 补打/);
assert.doesNotMatch(historyOrders, /handleDownloadExcel|downloadExcelLoading|下载Excel/);

for (const componentName of CUSTOMER_HISTORY_PRINT_COMPONENTS) {
  const printComponent = fs.readFileSync(
    path.resolve(__dirname, `../../../components/Applys/${componentName}.vue`),
    'utf8',
  );
  assert.match(
    customerCenter,
    new RegExp(`components/Applys/${componentName}\\.vue`),
    `${componentName} 应与打印中心复用同一个模板`,
  );
  assert.match(printComponent, /@click="downLoadOnly"/);
  assert.match(printComponent, /@click="printOnly"/);
  assert.match(
    printComponent,
    /!!this\.isHistoryOrder/,
    `${componentName} 补打时必须跳过订单保存`,
  );
}

console.log('Customer history reprint regression tests passed.');
