import { PAPER_PROFILES } from '../../print/config/paperProfiles.js';

const RETURN_PRINT_PROFILES = Object.freeze({
  ApplyPanel: Object.freeze({
    ...PAPER_PROFILES.FULL_STANDARD,
    printName: 'ApplyPanel',
    customerLabel: '一张一列',
    columns: 1,
    rowsPerColumn: 20,
  }),
  ApplyFiftyPanel: Object.freeze({
    ...PAPER_PROFILES.FULL_FIFTY,
    printName: 'ApplyFiftyPanel',
    customerLabel: '一张两列',
    columns: 2,
    rowsPerColumn: 18,
  }),
  ApplyHalfWholePanel: Object.freeze({
    ...PAPER_PROFILES.HALF_WHOLE,
    printName: 'ApplyHalfWholePanel',
    customerLabel: '半张一列',
    columns: 1,
    rowsPerColumn: 8,
  }),
  ApplyHalfPanel: Object.freeze({
    ...PAPER_PROFILES.HALF_STANDARD,
    printName: 'ApplyHalfPanel',
    customerLabel: '半张两列',
    columns: 2,
    rowsPerColumn: 7,
  }),
  ApplyThirtyWholePanel: Object.freeze({
    ...PAPER_PROFILES.THIRD_WHOLE,
    printName: 'ApplyThirtyWholePanel',
    customerLabel: '三分之一张一列',
    columns: 1,
    rowsPerColumn: 3,
  }),
  ApplyThirtyPanel: Object.freeze({
    ...PAPER_PROFILES.THIRD_STANDARD,
    printName: 'ApplyThirtyPanel',
    customerLabel: '三分之一张两列',
    columns: 2,
    rowsPerColumn: 3,
  }),
});

const DEFAULT_PRINT_NAME = 'ApplyPanel';

const DISPOSITION_LABELS = {
  RESTOCK: '返库',
  SCRAP: '报损',
  RETURN_TO_SUPPLIER: '退供应商',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function display(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  return escapeHtml(value);
}

function quantity(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(3).replace(/\.?0+$/, '') : display(value);
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `¥${number.toFixed(2)}` : '¥0.00';
}

function dateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? display(value) : escapeHtml(date.toLocaleString('zh-CN', { hour12: false }));
}

function writableQuantity(value, unit) {
  const text = quantity(value);
  if (text === null) return '<span class="write-line">&nbsp;</span>';
  return `${text}${unit ? `<small>${display(unit)}</small>` : ''}`;
}

function fixedQuantity(value, unit) {
  const text = quantity(value);
  return `${text === null ? '-' : text}${unit ? `<small>${display(unit)}</small>` : ''}`;
}

function disposition(item) {
  return display(DISPOSITION_LABELS[item?.nxDsriDispositionCode] || item?.nxDsriDispositionCode);
}

function paginate(items, pageSize) {
  if (!items.length) return [[]];
  const pages = [];
  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }
  return pages;
}

function renderSingleColumnTable(items, startIndex, receipt) {
  const header = receipt
    ? '<th class="seq">序</th><th>商品</th><th class="unit">单位</th><th class="qty">实收数量</th><th class="qty">合格数量</th><th class="reason">处置</th>'
    : '<th class="seq">序</th><th>商品</th><th class="unit">单位</th><th class="qty">核准数量</th><th class="qty">实取数量</th><th class="reason">退货原因</th>';
  const rows = items.map((item, index) => receipt
    ? `<tr><td>${startIndex + index + 1}</td><td class="left">${display(item.nxDsriGoodsName)}</td><td>${display(item.nxDsriUnit)}</td><td>${writableQuantity(item.nxDsriReceivedQuantity)}</td><td>${writableQuantity(item.nxDsriAcceptedQuantity)}</td><td>${disposition(item)}</td></tr>`
    : `<tr><td>${startIndex + index + 1}</td><td class="left">${display(item.nxDsriGoodsName)}</td><td>${display(item.nxDsriUnit)}</td><td>${fixedQuantity(item.nxDsriApprovedQuantity)}</td><td>${writableQuantity(item.nxDsriPickedQuantity)}</td><td class="left">${display(item.nxDsriReason)}</td></tr>`
  ).join('');
  return `<table class="return-table single-table"><thead><tr>${header}</tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty-row">无退货商品</td></tr>'}</tbody></table>`;
}

function renderCompactTable(items, startIndex, receipt, emptyLabel = '') {
  const header = receipt
    ? '<th class="seq">序</th><th>商品 / 处置</th><th class="qty">实收</th><th class="qty">合格</th>'
    : '<th class="seq">序</th><th>商品 / 原因</th><th class="qty">核准</th><th class="qty">实取</th>';
  const rows = items.map((item, index) => {
    const detail = receipt ? disposition(item) : display(item.nxDsriReason);
    const firstQuantity = receipt ? item.nxDsriReceivedQuantity : item.nxDsriApprovedQuantity;
    const secondQuantity = receipt ? item.nxDsriAcceptedQuantity : item.nxDsriPickedQuantity;
    return `<tr>
      <td>${startIndex + index + 1}</td>
      <td class="left"><strong>${display(item.nxDsriGoodsName)}</strong><small>${detail}</small></td>
      <td>${receipt ? writableQuantity(firstQuantity, item.nxDsriUnit) : fixedQuantity(firstQuantity, item.nxDsriUnit)}</td>
      <td>${writableQuantity(secondQuantity, item.nxDsriUnit)}</td>
    </tr>`;
  }).join('');
  return `<table class="return-table compact-table"><thead><tr>${header}</tr></thead><tbody>${rows || `<tr><td colspan="4" class="empty-row">${emptyLabel || '&nbsp;'}</td></tr>`}</tbody></table>`;
}

function renderItems(pageItems, pageIndex, profile, receipt) {
  const pageSize = profile.rowsPerColumn * profile.columns;
  const startIndex = pageIndex * pageSize;
  // 两列是容量方案，不应强制制造空白右栏。只有一条（或空数据）时使用完整宽表格；
  // 多条时左右均衡，避免最后一页全部挤在左边。
  if (profile.columns === 1 || pageItems.length <= 1) {
    return renderSingleColumnTable(pageItems, startIndex, receipt);
  }
  const leftCount = Math.ceil(pageItems.length / 2);
  const leftItems = pageItems.slice(0, leftCount);
  const rightItems = pageItems.slice(leftCount);
  return `<div class="two-column-items">
    ${renderCompactTable(leftItems, startIndex, receipt)}
    ${renderCompactTable(rightItems, startIndex + leftCount, receipt)}
  </div>`;
}

function renderSignatures(receipt) {
  return receipt
    ? '<span>仓库收货人：____________</span><span>复核人：____________</span><span>司机：____________</span>'
    : '<span>客户确认：____________</span><span>司机：____________</span><span>实际取货时间：____________</span>';
}

function renderPage({
  pageItems,
  pageIndex,
  totalPages,
  profile,
  salesReturn,
  receipt,
  distributerName,
  originalBillNo,
}) {
  const lastPage = pageIndex === totalPages - 1;
  const pickupDate = salesReturn.nxDsrRouteDate || '-';
  const temperature = quantity(salesReturn.nxDsrTemperature);
  const remark = receipt
    ? salesReturn.nxDsrReceiveRemark
    : salesReturn.nxDsrPickupRemark || salesReturn.nxDsrApprovalRemark;
  const amount = receipt ? salesReturn.nxDsrActualCreditAmount : salesReturn.nxDsrEstimatedCreditAmount;
  const amountLabel = receipt ? '确认退款' : '预计退款';
  const amountNotice = receipt ? '' : '<span class="settlement-notice">最终以仓库验收和财务结算为准</span>';
  const title = receipt ? '仓库退货收货单' : '客户退货取货交接单';

  return `<section class="print-page ${profile.heightMm <= 93 ? 'third-page' : profile.heightMm <= 140 ? 'half-page' : 'full-page'}" data-page="${pageIndex + 1}">
    <header class="document-header">
      <div class="brand">${display(distributerName, '农心乐配送')}</div>
      <h1>${title}</h1>
      <div class="page-number">第 ${pageIndex + 1} / ${totalPages} 页</div>
    </header>
    <section class="meta-grid">
      <div><b>客户：</b>${display(salesReturn.customerName)}</div>
      <div><b>退货单号：</b>${display(salesReturn.nxDsrNo)}</div>
      <div><b>${receipt ? '收货日期' : '取货日期'}：</b>${display(pickupDate)}</div>
      <div><b>原配送单：</b>${display(originalBillNo || salesReturn.nxDsrOriginalBillId)}</div>
      <div class="application-time"><b>申请时间：</b>${dateTime(salesReturn.nxDsrCreatedAt)}</div>
      <div class="application-time"><b>${receipt ? '收货温度' : '取货温度'}：</b>${temperature === null ? '<span class="write-line short">&nbsp;</span>' : `${temperature}℃`}</div>
    </section>
    <main class="items-area">${renderItems(pageItems, pageIndex, profile, receipt)}</main>
    <footer class="document-footer ${lastPage ? '' : 'continuation'}">
      ${lastPage ? `<div class="settlement"><b>${amountLabel}：</b>${money(amount)} ${amountNotice}</div>
        <div class="remark"><b>备注：</b>${display(remark)}</div>
        <div class="signatures">${renderSignatures(receipt)}</div>` : '<div class="continue-label">退货明细续下页</div>'}
    </footer>
  </section>`;
}

export function resolveReturnPrintProfile(printName) {
  return RETURN_PRINT_PROFILES[printName] || RETURN_PRINT_PROFILES[DEFAULT_PRINT_NAME];
}

export function buildReturnDocumentHtml(payload, distributerName = '') {
  const job = payload?.job || {};
  const salesReturn = payload?.salesReturn || {};
  const receipt = job.nxDrpjDocumentType === 'WAREHOUSE_RECEIPT';
  const profile = resolveReturnPrintProfile(payload?.customerPrintName || salesReturn.customerPrintName);
  const items = Array.isArray(salesReturn.items) ? salesReturn.items : [];
  const pageSize = profile.rowsPerColumn * profile.columns;
  const pages = paginate(items, pageSize);
  const contentWidthMm = profile.widthMm - 6;
  const contentHeightMm = profile.heightMm - 6;
  const fontSize = profile.heightMm <= 93 ? 9 : profile.heightMm <= 140 ? 10 : 11;
  const titleSize = profile.heightMm <= 93 ? 16 : profile.heightMm <= 140 ? 18 : 22;
  const rowPadding = profile.heightMm <= 93 ? '2px 3px' : profile.heightMm <= 140 ? '3px 4px' : '5px 4px';
  const body = pages.map((pageItems, pageIndex) => renderPage({
    pageItems,
    pageIndex,
    totalPages: pages.length,
    profile,
    salesReturn,
    receipt,
    distributerName,
    originalBillNo: payload?.originalBillNo,
  })).join('');

  return `<!doctype html>
<html lang="zh-CN" data-print-profile="${profile.printName}" data-layout-columns="${profile.columns}">
<head><meta charset="utf-8"><title>${receipt ? '仓库退货收货单' : '客户退货取货交接单'}</title>
<style>
@page{size:${profile.widthMm}mm ${profile.heightMm}mm;margin:3mm}
*{box-sizing:border-box}html,body{margin:0;color:#111;font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:${fontSize}px}body{background:#e9ecef;padding:12px}.print-page{width:${contentWidthMm}mm;height:${contentHeightMm}mm;margin:0 auto 12px;padding:0;background:#fff;display:flex;flex-direction:column;overflow:hidden;page-break-after:always;box-shadow:0 2px 10px rgba(0,0,0,.16)}.print-page:last-child{page-break-after:auto}.document-header{position:relative;text-align:center;border-bottom:1px solid #222;padding-bottom:3px}.brand{font-size:1.08em;font-weight:600}.document-header h1{font-size:${titleSize}px;line-height:1.15;letter-spacing:2px;margin:2px 0}.page-number{position:absolute;right:0;bottom:4px;font-size:.9em}.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;padding:4px 0}.meta-grid b{display:inline-block;min-width:5.5em}.items-area{min-height:0;overflow:hidden}.return-table{width:100%;border-collapse:collapse;table-layout:fixed}.return-table th,.return-table td{border:1px solid #222;padding:${rowPadding};text-align:center;line-height:1.2;word-break:break-all;vertical-align:middle}.return-table th{font-weight:700;background:#f2f2f2}.return-table .left{text-align:left}.return-table .seq{width:7%}.return-table .unit{width:9%}.return-table .qty{width:14%}.single-table .reason{width:24%}.return-table small{display:block;font-size:.86em;font-weight:400;line-height:1.15;margin-top:1px}.write-line{display:inline-block;min-width:13mm;border-bottom:1px solid #111}.write-line.short{min-width:9mm}.two-column-items{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.compact-table .seq{width:9%}.compact-table .qty{width:20%}.empty-row{height:10mm;color:#666}.document-footer{padding-top:3px}.settlement{display:flex;align-items:baseline;gap:4px;font-size:1.02em}.settlement-notice{margin-left:auto;font-size:.86em;color:#333}.remark{margin-top:2px;min-height:1.8em;border-bottom:1px solid #222;line-height:1.35}.signatures{display:flex;justify-content:space-between;gap:8px;margin-top:5px;white-space:nowrap}.continue-label{text-align:right;font-size:.9em;padding-top:3px}.third-page .document-header{padding-bottom:1px}.third-page .document-header h1{margin:0}.third-page .meta-grid{gap:1px 8px;padding:2px 0}.third-page .application-time{display:none}.third-page .document-footer{padding-top:1px}.third-page .remark{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:1.35em}.third-page .signatures{margin-top:2px}.third-page .settlement-notice{font-size:.78em}.half-page .meta-grid{padding:3px 0}.full-page .document-footer{padding-top:6px}.full-page .signatures{margin-top:10px}
@media print{body{background:#fff;padding:0}.print-page{margin:0;width:${contentWidthMm}mm;height:${contentHeightMm}mm;box-shadow:none}}
</style></head><body>${body}</body></html>`;
}

export default buildReturnDocumentHtml;
