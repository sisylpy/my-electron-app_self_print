import assert from 'node:assert/strict';
import { buildReturnDocumentHtml, resolveReturnPrintProfile } from './returnDocumentTemplate.js';

const PROFILES = [
  ['ApplyPanel', 240, 279, 1],
  ['ApplyFiftyPanel', 240, 279, 2],
  ['ApplyHalfWholePanel', 240, 140, 1],
  ['ApplyHalfPanel', 240, 140, 2],
  ['ApplyThirtyWholePanel', 240, 93, 1],
  ['ApplyThirtyPanel', 240, 93, 2],
];

function salesReturn(items = []) {
  return {
    nxDsrNo: 'RT-001',
    customerName: '测试<门店>',
    nxDsrRouteDate: '2026-08-30',
    nxDsrOriginalBillId: 99,
    nxDsrEstimatedCreditAmount: 8.5,
    nxDsrActualCreditAmount: 6.25,
    items,
  };
}

function item(index = 1) {
  return {
    nxDsriGoodsName: `西红柿${index}`,
    nxDsriUnit: '斤',
    nxDsriApprovedQuantity: 2,
    nxDsriPickedQuantity: null,
    nxDsriReceivedQuantity: 1.5,
    nxDsriAcceptedQuantity: 1.25,
    nxDsriDispositionCode: 'RESTOCK',
    nxDsriReason: '品质不符',
  };
}

for (const [printName, width, height, columns] of PROFILES) {
  const profile = resolveReturnPrintProfile(printName);
  assert.equal(profile.widthMm, width);
  assert.equal(profile.heightMm, height);
  assert.equal(profile.columns, columns);

  const html = buildReturnDocumentHtml({
    customerPrintName: printName,
    originalBillNo: 'LZPS-08-30-001',
    job: { nxDrpjDocumentType: 'CUSTOMER_HANDOVER' },
    salesReturn: salesReturn([item()]),
  }, '测试配送商');
  assert.match(html, new RegExp(`data-print-profile="${printName}"`));
  assert.match(html, new RegExp(`data-layout-columns="${columns}"`));
  assert.match(html, new RegExp(`@page\\{size:${width}mm ${height}mm`));
}

const handover = buildReturnDocumentHtml({
  customerPrintName: 'ApplyHalfWholePanel',
  originalBillNo: 'LZPS-08-30-001',
  job: { nxDrpjDocumentType: 'CUSTOMER_HANDOVER', nxDrpjAttemptCount: 3 },
  salesReturn: salesReturn([item()]),
}, '测试配送商');

assert.match(handover, /客户退货取货交接单/);
assert.match(handover, /取货日期/);
assert.match(handover, /原配送单/);
assert.match(handover, /LZPS-08-30-001/);
assert.match(handover, /预计退款/);
assert.match(handover, /最终以仓库验收和财务结算为准/);
assert.match(handover, /客户确认/);
assert.match(handover, /测试&lt;门店&gt;/);
assert.doesNotMatch(handover, /测试<门店>/);
assert.doesNotMatch(handover, /打印次数|模板：|A4 portrait/);

const adaptiveSingle = buildReturnDocumentHtml({
  customerPrintName: 'ApplyFiftyPanel',
  job: { nxDrpjDocumentType: 'CUSTOMER_HANDOVER' },
  salesReturn: salesReturn([item()]),
}, '测试配送商');
assert.doesNotMatch(adaptiveSingle, /<div class="two-column-items">/);
assert.equal((adaptiveSingle.match(/class="return-table single-table"/g) || []).length, 1);

const balancedColumns = buildReturnDocumentHtml({
  customerPrintName: 'ApplyFiftyPanel',
  job: { nxDrpjDocumentType: 'CUSTOMER_HANDOVER' },
  salesReturn: salesReturn([item(1), item(2), item(3)]),
}, '测试配送商');
assert.match(balancedColumns, /two-column-items/);
assert.equal((balancedColumns.match(/class="return-table compact-table"/g) || []).length, 2);

const receipt = buildReturnDocumentHtml({
  customerPrintName: 'ApplyThirtyPanel',
  job: { nxDrpjDocumentType: 'WAREHOUSE_RECEIPT' },
  salesReturn: salesReturn([item()]),
}, '测试配送商');

assert.match(receipt, /仓库退货收货单/);
assert.match(receipt, /实收/);
assert.match(receipt, /合格/);
assert.match(receipt, /返库/);
assert.match(receipt, /确认退款/);
assert.match(receipt, /仓库收货人/);

const paged = buildReturnDocumentHtml({
  customerPrintName: 'ApplyThirtyWholePanel',
  job: { nxDrpjDocumentType: 'CUSTOMER_HANDOVER' },
  salesReturn: salesReturn([item(1), item(2), item(3), item(4)]),
}, '测试配送商');
assert.equal((paged.match(/class="print-page/g) || []).length, 2);
assert.match(paged, /第 1 \/ 2 页/);
assert.match(paged, /退货明细续下页/);

assert.equal(resolveReturnPrintProfile('UnknownTemplate').printName, 'ApplyPanel');
