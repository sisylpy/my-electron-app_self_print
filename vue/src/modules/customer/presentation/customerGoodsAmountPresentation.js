export const CUSTOMER_GOODS_AMOUNT_GROUPS = [
  { key: 'core', title: '核心商品', range: '累计贡献前 70%', tone: 'green' },
  { key: 'important', title: '重要商品', range: '累计贡献 70%–90%', tone: 'blue' },
  { key: 'general', title: '一般商品', range: '其余订货额', tone: 'orange' },
  { key: 'noAmount', title: '无订货额', range: '所选范围暂无有效金额', tone: 'light' },
];

export const CUSTOMER_GOODS_AMOUNT_WINDOWS = [
  { key: '30', label: '近30天', field: 'orderAmount30Days', quantityField: 'averageOrderQuantity30Days' },
  { key: '90', label: '近90天', field: 'orderAmount90Days', quantityField: 'averageOrderQuantity90Days' },
  { key: '365', label: '近一年', field: 'orderAmount365Days', quantityField: 'averageOrderQuantity365Days' },
  { key: 'all', label: '全部', field: 'orderAmountAll', quantityField: 'averageOrderQuantityAll' },
];

function positiveAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function resolveCustomerGoodsAverageQuantity(item, viewMode, amountWindow) {
  const quantityField = viewMode === 'amount'
    ? amountWindow?.quantityField
    : 'averageOrderQuantity90Days';
  const number = Number(item?.[quantityField]);
  return {
    value: Number.isFinite(number) && number > 0 ? number : null,
    unit: String(item?.averageOrderQuantityUnit || item?.spec || '').trim(),
  };
}

/**
 * 按金额由高到低排列，并按每个商品开始贡献前的累计占比分为 ABC 三档。
 * 这样即使第一种商品单独超过 70%，它仍然属于核心商品，不会出现核心档为空。
 */
export function buildCustomerGoodsAmountRows(goods, field) {
  const rows = (goods || []).map((item) => ({
    ...item,
    amountValue: positiveAmount(item?.[field]),
  })).sort((a, b) => {
    if (a.amountValue !== b.amountValue) return b.amountValue - a.amountValue;
    const aLast = a.lastOrderDays === null ? Number.MAX_SAFE_INTEGER : a.lastOrderDays;
    const bLast = b.lastOrderDays === null ? Number.MAX_SAFE_INTEGER : b.lastOrderDays;
    if (aLast !== bLast) return aLast - bLast;
    return String(a.goodsName || '').localeCompare(String(b.goodsName || ''), 'zh-CN');
  });
  const total = rows.reduce((sum, item) => sum + item.amountValue, 0);
  let cumulative = 0;
  return rows.map((item) => {
    if (item.amountValue <= 0 || total <= 0) {
      return { ...item, amountShare: 0, amountKey: 'noAmount' };
    }
    const cumulativeBefore = cumulative / total;
    const amountKey = cumulativeBefore < 0.7
      ? 'core'
      : (cumulativeBefore < 0.9 ? 'important' : 'general');
    cumulative += item.amountValue;
    return {
      ...item,
      amountShare: (item.amountValue / total) * 100,
      amountKey,
    };
  });
}

export function summarizeCustomerGoodsAmountRows(rows) {
  const source = rows || [];
  return {
    totalAmount: source.reduce((sum, item) => sum + positiveAmount(item.amountValue), 0),
    core: source.filter((item) => item.amountKey === 'core').length,
    withAmount: source.filter((item) => positiveAmount(item.amountValue) > 0).length,
  };
}
