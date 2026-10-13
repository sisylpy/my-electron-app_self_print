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

const DEFAULT_PRINTER_PROFILE = Object.freeze({
  safeLeftMm: 12,
  safeRightMm: 12,
  distributorNameFontSize: 18,
  orderContentFontSize: 14,
  headerFontSize: 14,
  lineHeight: 24,
  zoomFactor: 1,
  maxPrintableWidth: 200,
});

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

function finiteInRange(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

/**
 * 与打印中心正式配送单保持同一套现场校准口径：
 * 240mm 物理纸宽、210mm 安全基准宽度，并复用打印机的左右边距、字号和缩放配置。
 */
function resolvePrinterLayout(profile, printerProfile = {}) {
  const zoomFactor = finiteInRange(printerProfile.zoomFactor, DEFAULT_PRINTER_PROFILE.zoomFactor, 0.5, 1.5);
  let leftMm = finiteInRange(printerProfile.safeLeftMm, DEFAULT_PRINTER_PROFILE.safeLeftMm, 0, 100) * zoomFactor;
  let rightMm = finiteInRange(printerProfile.safeRightMm, DEFAULT_PRINTER_PROFILE.safeRightMm, 0, 100) * zoomFactor;
  let contentWidthMm = Math.max(40, 210
    - finiteInRange(printerProfile.safeLeftMm, DEFAULT_PRINTER_PROFILE.safeLeftMm, 0, 100)
    - finiteInRange(printerProfile.safeRightMm, DEFAULT_PRINTER_PROFILE.safeRightMm, 0, 100)) * zoomFactor;
  let pageBoxWidthMm = leftMm + contentWidthMm + rightMm;

  if (pageBoxWidthMm > profile.widthMm) {
    const scale = profile.widthMm / pageBoxWidthMm;
    leftMm *= scale;
    rightMm *= scale;
    contentWidthMm *= scale;
    pageBoxWidthMm = profile.widthMm;
  }

  const maxPrintableWidth = finiteInRange(
    printerProfile.maxPrintableWidth,
    DEFAULT_PRINTER_PROFILE.maxPrintableWidth,
    120,
    230,
  );
  if (contentWidthMm > maxPrintableWidth) {
    const scale = maxPrintableWidth / contentWidthMm;
    leftMm *= scale;
    rightMm *= scale;
    contentWidthMm *= scale;
    pageBoxWidthMm *= scale;
  }

  const compactRatio = profile.heightMm <= 93 ? 0.86 : profile.heightMm <= 140 ? 0.93 : 1;
  const bodyFontPx = finiteInRange(
    printerProfile.orderContentFontSize,
    DEFAULT_PRINTER_PROFILE.orderContentFontSize,
    8,
    32,
  ) * zoomFactor * compactRatio;
  const headerFontPx = finiteInRange(
    printerProfile.headerFontSize,
    DEFAULT_PRINTER_PROFILE.headerFontSize,
    8,
    32,
  ) * zoomFactor * compactRatio;
  const titleFontPx = Math.max(
    finiteInRange(
      printerProfile.distributorNameFontSize,
      DEFAULT_PRINTER_PROFILE.distributorNameFontSize,
      10,
      40,
    ) * zoomFactor,
    bodyFontPx * 1.45,
  );
  const lineHeightPx = finiteInRange(
    printerProfile.lineHeight,
    DEFAULT_PRINTER_PROFILE.lineHeight,
    12,
    60,
  ) * zoomFactor * compactRatio;
  const topMm = (profile.heightMm <= 93 ? 5 : profile.heightMm <= 140 ? 7 : 10) * zoomFactor;
  const bottomMm = (profile.heightMm <= 93 ? 3 : profile.heightMm <= 140 ? 4 : 5) * zoomFactor;
  const pageBoxHeightMm = Math.min(profile.heightMm, Math.max(30, (profile.heightMm - topMm - bottomMm) * zoomFactor));

  return {
    bodyFontPx,
    bottomMm,
    contentWidthMm,
    headerFontPx,
    leftMm,
    lineHeightPx,
    pageBoxHeightMm,
    pageBoxWidthMm,
    rightMm,
    titleFontPx,
    topMm,
  };
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
  const labels = receipt
    ? ['仓库收货人', '复核人', '司机']
    : ['客户确认', '司机', '实际取货时间'];
  return labels.map((label) => `<div class="signature-item"><span>${label}</span><i></i></div>`).join('');
}

function renderMetaItem(label, value, className = '') {
  return `<div class="meta-item ${className}"><span>${label}</span><strong>${value}</strong></div>`;
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
  const documentCaption = receipt ? '退货入库验收凭证' : '客户退货取货凭证';
  const temperatureLabel = receipt ? '收货温度' : '取货温度';
  const temperatureValue = temperature === null
    ? '<span class="write-line short">&nbsp;</span><em>℃</em>'
    : `${temperature}<em>℃</em>`;

  return `<section class="print-page ${profile.heightMm <= 93 ? 'third-page' : profile.heightMm <= 140 ? 'half-page' : 'full-page'}" data-page="${pageIndex + 1}">
    <header class="document-header">
      <div class="document-header__topline">
        <div class="brand">${display(distributerName, '农心乐配送')}</div>
        <div class="document-caption">${documentCaption}</div>
      </div>
      <div class="document-header__title-row">
        <span class="title-spacer"></span>
        <h1>${title}</h1>
        <div class="page-number">第 ${pageIndex + 1} / ${totalPages} 页</div>
      </div>
    </header>
    <section class="meta-grid">
      ${renderMetaItem('客户', display(salesReturn.customerName), 'customer-meta')}
      ${renderMetaItem('退货单号', display(salesReturn.nxDsrNo), 'return-no-meta')}
      ${renderMetaItem(receipt ? '收货日期' : '取货日期', display(pickupDate))}
      ${renderMetaItem('原配送单', display(originalBillNo || salesReturn.nxDsrOriginalBillId))}
      ${renderMetaItem('申请时间', dateTime(salesReturn.nxDsrCreatedAt), 'application-time compact-optional')}
      ${renderMetaItem(temperatureLabel, temperatureValue, 'temperature-meta compact-optional')}
    </section>
    <main class="items-area">${renderItems(pageItems, pageIndex, profile, receipt)}</main>
    <footer class="document-footer ${lastPage ? '' : 'continuation'}">
      ${lastPage ? `<div class="settlement-panel"><div class="settlement"><span>${amountLabel}</span><strong>${money(amount)}</strong></div>${amountNotice}</div>
        <div class="remark"><span>备注</span><strong>${display(remark)}</strong></div>
        <div class="signatures">${renderSignatures(receipt)}</div>` : '<div class="continue-label">退货明细续下页</div>'}
    </footer>
  </section>`;
}

export function resolveReturnPrintProfile(printName) {
  return RETURN_PRINT_PROFILES[printName] || RETURN_PRINT_PROFILES[DEFAULT_PRINT_NAME];
}

export function buildReturnDocumentHtml(payload, distributerName = '', printerProfile = {}) {
  const job = payload?.job || {};
  const salesReturn = payload?.salesReturn || {};
  const receipt = job.nxDrpjDocumentType === 'WAREHOUSE_RECEIPT';
  const profile = resolveReturnPrintProfile(payload?.customerPrintName || salesReturn.customerPrintName);
  const items = Array.isArray(salesReturn.items) ? salesReturn.items : [];
  const pageSize = profile.rowsPerColumn * profile.columns;
  const pages = paginate(items, pageSize);
  const layout = resolvePrinterLayout(profile, printerProfile);
  const rowPadding = profile.heightMm <= 93 ? '2px 3px' : profile.heightMm <= 140 ? '3px 4px' : '5px 5px';
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
<html lang="zh-CN" data-print-profile="${profile.printName}" data-print-width-mm="${profile.widthMm}" data-print-height-mm="${profile.heightMm}" data-layout-columns="${profile.columns}">
<head><meta charset="utf-8"><title>${receipt ? '仓库退货收货单' : '客户退货取货交接单'}</title>
<style>
@page{size:${profile.widthMm}mm ${profile.heightMm}mm;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{margin:0;color:#000;font-family:"SimSun","Microsoft YaHei","PingFang SC",sans-serif;font-size:${layout.bodyFontPx.toFixed(1)}px;font-weight:500}body{background:#e9ecef;padding:12px}.print-page{width:${layout.pageBoxWidthMm.toFixed(2)}mm;height:${layout.pageBoxHeightMm.toFixed(2)}mm;margin:0 auto 12px;padding:${layout.topMm.toFixed(2)}mm ${layout.rightMm.toFixed(2)}mm ${layout.bottomMm.toFixed(2)}mm ${layout.leftMm.toFixed(2)}mm;background:#fff;display:flex;flex-direction:column;overflow:hidden;page-break-after:always;box-shadow:0 2px 10px rgba(0,0,0,.16);color:#000}.print-page:last-child{page-break-after:auto}.document-header{padding:3px 0 5px;border-bottom:2px solid #000}.document-header__topline,.document-header__title-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center}.document-header__topline{color:#000;font-size:${layout.headerFontPx.toFixed(1)}px;line-height:${layout.lineHeightPx.toFixed(1)}px;letter-spacing:.4px}.brand{justify-self:start;font-weight:800;color:#000}.document-caption{grid-column:2;font-weight:700}.document-header__title-row{margin-top:1px}.document-header h1{grid-column:2;margin:0;font-size:${layout.titleFontPx.toFixed(1)}px;line-height:1.2;letter-spacing:3px;color:#000;font-weight:800}.title-spacer{grid-column:1}.page-number{grid-column:3;justify-self:end;align-self:end;padding-bottom:2px;color:#000;font-size:${layout.headerFontPx.toFixed(1)}px;font-weight:700}.meta-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;border-top:0;background:#fff}.meta-item{display:grid;grid-template-columns:5.8em minmax(0,1fr);align-items:center;min-width:0;min-height:${layout.lineHeightPx.toFixed(1)}px;padding:3px 7px;border-bottom:1px solid #000}.meta-item:nth-child(odd){border-right:1px solid #000}.meta-item:nth-last-child(-n+2){border-bottom:0}.meta-item span{color:#000;font-size:1em;font-weight:700}.meta-item strong{overflow:hidden;color:#000;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.temperature-meta strong{display:flex;align-items:flex-end;gap:2px}.temperature-meta em{font-size:.9em;font-style:normal;font-weight:700}.items-area{min-height:0;margin-top:3px;overflow:hidden}.return-table{width:100%;border:2px solid #000;border-collapse:collapse;table-layout:fixed}.return-table th,.return-table td{border:1px solid #000;padding:${rowPadding};text-align:center;line-height:${layout.lineHeightPx.toFixed(1)}px;word-break:break-all;vertical-align:middle;color:#000;background:#fff}.return-table th{font-weight:800}.return-table td{font-weight:600}.return-table .left{text-align:left}.return-table .seq{width:7%}.return-table .unit{width:9%}.return-table .qty{width:14%}.single-table .reason{width:24%}.return-table small{display:block;margin-top:1px;color:#000;font-size:.86em;font-weight:600;line-height:1.15}.write-line{display:inline-block;min-width:13mm;border-bottom:2px solid #000}.write-line.short{min-width:9mm}.two-column-items{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.compact-table .seq{width:9%}.compact-table .qty{width:20%}.empty-row{height:10mm;color:#000}.document-footer{padding-top:4px}.settlement-panel{display:flex;align-items:center;min-height:${layout.lineHeightPx.toFixed(1)}px;padding:4px 8px;border:1px solid #000;background:#fff}.settlement{display:flex;align-items:baseline;gap:9px}.settlement span{color:#000;font-weight:800}.settlement strong{color:#000;font-size:1.28em;font-weight:800}.settlement-notice{margin-left:auto;color:#000;font-size:.86em;font-weight:600}.remark{display:grid;grid-template-columns:4.6em minmax(0,1fr);align-items:start;min-height:30px;padding:5px 8px;border:1px solid #000;border-top:0}.remark span{color:#000;font-weight:800}.remark strong{color:#000;font-weight:600;line-height:1.35}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:7mm;margin-top:9px}.signature-item{display:grid;grid-template-columns:auto minmax(18mm,1fr);align-items:end;gap:5px;white-space:nowrap}.signature-item span{font-size:1em;font-weight:800}.signature-item i{display:block;height:1.5em;border-bottom:2px solid #000}.continue-label{margin-left:auto;padding:4px 8px;border:1px solid #000;color:#000;font-size:.9em;font-weight:700}.third-page .document-header{padding:1px 0 2px}.third-page .document-header__topline{display:none}.third-page .document-header h1{font-size:${Math.max(16, layout.titleFontPx - 2).toFixed(1)}px;letter-spacing:2px}.third-page .meta-grid{font-size:.9em}.third-page .meta-item{min-height:17px;padding:1px 4px}.third-page .compact-optional{display:none}.third-page .meta-item:nth-child(3),.third-page .meta-item:nth-child(4){border-bottom:0}.third-page .document-footer{padding-top:2px}.third-page .settlement-panel{min-height:19px;padding:2px 4px}.third-page .remark{min-height:19px;padding:2px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.third-page .signatures{gap:3mm;margin-top:2px}.third-page .signature-item{gap:3px}.third-page .settlement-notice{font-size:.78em}.half-page .document-header{padding-top:2px}.half-page .meta-item{min-height:20px;padding:2px 6px}.half-page .signatures{margin-top:4px}.full-page .document-footer{padding-top:6px}.full-page .signatures{margin-top:11px}
@media print{html,body{width:100%}body{background:#fff;padding:0}.print-page{margin:0;width:${layout.pageBoxWidthMm.toFixed(2)}mm;height:${layout.pageBoxHeightMm.toFixed(2)}mm;box-shadow:none;break-inside:avoid;page-break-inside:avoid}}
</style></head><body>${body}</body></html>`;
}

export default buildReturnDocumentHtml;
