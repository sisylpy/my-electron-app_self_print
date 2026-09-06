function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanImagePath(value) {
  const path = String(value ?? '').trim();
  return path && !['null', 'undefined', '-1'].includes(path) ? path : '';
}

function absoluteImageUrl(path, serverBase) {
  if (!path) return '';
  if (/^(https?:)?\/\//i.test(path) || /^(data:|blob:)/i.test(path)) return path;
  const base = cleanImagePath(serverBase);
  return base
    ? `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
    : path;
}

export function resolveGoodsImage(goods, serverBase, fallback = '') {
  const item = goods || {};
  const candidates = [
    item.nxDgGoodsFileLarge,
    item.nxDgGoodsFile,
    item.nxDgNxFatherImg,
    item.nxGoodsFileBig,
    item.nxGoodsFile,
  ].map(cleanImagePath).filter(Boolean);
  const realImage = candidates.find((path) => !/^(?:\/)?goodsImage\/logo\.jpg$/i.test(path));
  return absoluteImageUrl(realImage || candidates[0] || cleanImagePath(fallback), serverBase);
}

export function formatMoney(value) {
  return `¥${number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDecimal(value, digits = 2) {
  return number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

export function formatQuantities(values, empty = '暂无有效数量') {
  if (!Array.isArray(values) || !values.length) return empty;
  return values.map((item) => `${formatDecimal(item.quantity, 4)}${item.unit || ''}`).join(' · ');
}

export function formatAveragePrices(values, empty = '暂无有效均价') {
  if (!Array.isArray(values) || !values.length) return empty;
  return values.map((item) => `${formatMoney(item.price)}/${item.unit || '单位'}`).join(' · ');
}

export function relativeBarWidth(rows, value) {
  const max = Math.max(0, ...(Array.isArray(rows) ? rows.map((row) => number(row.salesAmount)) : []));
  if (max <= 0) return '0%';
  return `${Math.max(4, Math.round(number(value) / max * 100))}%`;
}

export function categoryTileStyle(category, index) {
  const share = Math.max(0, Math.min(100, number(category?.share)));
  const basis = index === 0 ? Math.max(44, share) : Math.max(23, Math.min(48, share));
  return {
    flexGrow: String(Math.max(1, share)),
    flexBasis: `calc(${basis}% - 8px)`,
  };
}

function iso(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function rangeForDays(days, now = new Date()) {
  const size = Math.max(1, Number(days) || 30);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - size + 1);
  return { startDate: iso(start), endDate: iso(end) };
}

export function percentageLabel(value) {
  return `${formatDecimal(value, 2)}%`;
}
