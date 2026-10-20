/**
 * 拣货单 A4 打印模板。
 *
 * 与配送单模板互不影响：固定 A4 纵向纸型，正文左右两栏（CSS 多列）流式排版。
 * 内容口径沿用 Boss 小程序拣货单：
 *  - 单客户：客户拣货单，商品 + 订货 + 出货（称重商品出货列留空手写）
 *  - 批量  ：X月X日批量拣货单，商品合计 + 各客户订货量
 *  - 按商品：按商品大类分组；按货架：按货架 + 层位 + 层内序号「第N」
 */

const A4_STYLE = `
@page { size: A4 portrait; margin: 8mm; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "PingFang SC", "Microsoft YaHei", "Heiti SC", sans-serif;
  font-size: 12px;
  color: #000;
  background: #fff;
}
.sheet { width: 194mm; }
.header { text-align: center; margin-bottom: 4mm; }
.title { font-size: 19px; font-weight: 700; letter-spacing: 1px; }
.meta { font-size: 12px; margin-top: 1.5mm; }
.meta .label { color: #444; }
.columns { column-count: 2; column-gap: 6mm; }
.group {
  font-weight: 700;
  font-size: 13px;
  margin: 3mm 0 1mm;
  padding-bottom: 0.5mm;
  border-bottom: 1px solid #000;
  break-after: avoid;
}
.layer { font-size: 12px; font-weight: 700; margin: 2mm 0 1mm; break-after: avoid; }
.row {
  display: flex;
  align-items: baseline;
  margin-bottom: 1.6mm;
  break-inside: avoid;
}
.seq { width: 13mm; flex: none; color: #333; }
.name { flex: 1 1 auto; padding-right: 1mm; }
.qty { width: 18mm; flex: none; text-align: right; }
.out {
  width: 20mm;
  flex: none;
  text-align: right;
  min-height: 4mm;
  border-bottom: 1px solid #000;
}
.sub {
  display: flex;
  align-items: baseline;
  margin: 0 0 1.2mm 6mm;
  font-size: 11px;
  break-inside: avoid;
}
.sub .cust { flex: 1 1 auto; color: #333; }
.sub .num { width: 22mm; flex: none; text-align: right; }
.spec { color: #666; font-size: 11px; }
.footer { margin-top: 4mm; font-size: 11px; color: #444; }
.empty { text-align: center; padding: 20mm 0; color: #666; }
`;

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function todayText() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** 单客户商品行：称重商品出货列留空，固定规格直接带数量（与小程序一致） */
function itemRow(order, seqText) {
  const unit = order.nxDoStandard || order.nxDoPrintStandard || '';
  const qty = Number(order.nxDoQuantity || 0);
  const weigh = !order.__fixedSpec;
  const name = order._goodsName || order.nxDoGoodsName || '';
  return `<div class="row">
    <span class="seq">${escapeHtml(seqText || '')}</span>
    <span class="name">${escapeHtml(name)}</span>
    <span class="qty">${escapeHtml(qty)}${escapeHtml(unit)}</span>
    <span class="out">${weigh ? '' : escapeHtml(qty)}</span>
  </div>`;
}

function batchItemRow(item) {
  const spec = item.spec && item.spec !== item.unit ? `（${item.spec}）` : '';
  const total = Number(item.total || 0);
  const subs = (item.subRows || []).map((sub) => `<div class="sub">
    <span class="cust">${escapeHtml(sub.name)}</span>
    <span class="num">${escapeHtml(sub.qty)}</span>
  </div>`).join('');
  return `<div class="row">
    <span class="seq">${item.layerSeq != null ? `第${escapeHtml(item.layerSeq)}` : ''}</span>
    <span class="name">${escapeHtml(item.name)}<span class="spec">${escapeHtml(spec)}</span></span>
    <span class="qty">${escapeHtml(total)}${escapeHtml(item.unit || '')}</span>
    <span class="out">${item.isWeigh ? '' : escapeHtml(total)}</span>
  </div>${subs}`;
}

/**
 * 生成拣货单 A4 HTML。
 * @param {Object} options
 * @param {'customer'|'batch'} options.kind 单客户 / 批量
 * @param {'goods'|'shelf'} options.mode   按商品 / 按货架
 * @param {string} options.customerName    单客户的客户名
 * @param {Array}  options.groups          分组数据
 */
export function buildPickListA4Html({ kind = 'customer', mode = 'goods', customerName = '', groups = [] }) {
  const isBatch = kind === 'batch';
  const now = new Date();
  const title = isBatch ? `${now.getMonth() + 1}月${now.getDate()}日批量拣货单` : '客户拣货单';
  const meta = isBatch
    ? `<div class="meta"><span class="label">打印日期：</span>${todayText()}</div>`
    : `<div class="meta"><span class="label">客户：</span>${escapeHtml(customerName)}　<span class="label">日期：</span>${todayText()}</div>`;

  const body = (groups || []).map((group) => {
    if (mode === 'goods') {
      const rows = (group.items || []).map((item, index) => {
        if (isBatch) return batchItemRow(item);
        return itemRow(item, String(index + 1));
      }).join('');
      return `<div class="group">${escapeHtml(group.name)}</div>${rows}`;
    }
    const layerBlocks = (group.layers || []).map((layer) => {
      const layerTitle = layer.layer == null ? '' : `L${layer.layer} 层`;
      const rows = (layer.items || []).map((item, index) => {
        const seq = item.layerSeq != null ? `第${item.layerSeq}` : String(index + 1);
        if (isBatch) return batchItemRow(item);
        return itemRow(item, seq);
      }).join('');
      return `${layerTitle ? `<div class="layer">${escapeHtml(layerTitle)}</div>` : ''}${rows}`;
    }).join('');
    return `<div class="group">${escapeHtml(group.name)}</div>${layerBlocks}`;
  }).join('');

  const content = body || '<div class="empty">暂无待出货商品</div>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${A4_STYLE}</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="title">${escapeHtml(title)}</div>
      ${meta}
    </div>
    <div class="columns">${content}</div>
  </div>
</body>
</html>`;
}

export default buildPickListA4Html;
