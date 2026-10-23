import { parseOrderFromText } from '../../../utils/pasteOrderParser.js';

function compactWechatText(value, maxLength = 72) {
  const compact = String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .join('；')
    .replace(/\s+/g, ' ');
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 1))}…`;
}

function orderReadiness(orders) {
  if (!Array.isArray(orders) || !orders.length) {
    return { ok: false, reason: '未解析出“商品名＋数量＋规格”' };
  }
  for (let index = 0; index < orders.length; index += 1) {
    const order = orders[index] || {};
    const row = index + 1;
    if (!String(order.nxDoGoodsName || '').trim()) {
      return { ok: false, reason: `第${row}项缺少商品名称` };
    }
    const quantity = String(order.nxDoQuantity ?? '').trim();
    if (!quantity || Number.isNaN(Number(quantity)) || Number(quantity) <= 0) {
      return { ok: false, reason: `第${row}项缺少有效数量` };
    }
    const standard = String(order.nxDoStandard || '').trim();
    if (!standard || !/^[\u4e00-\u9fff]+$/.test(standard) || standard.length > 2) {
      return { ok: false, reason: `第${row}项缺少有效规格` };
    }
  }
  return { ok: true, reason: '' };
}

export function buildWechatScanTaskSummary(payload, taskType = '') {
  const text = String(payload?.text || '').trim();
  const preview = compactWechatText(text);
  if (taskType !== 'text' || !text) {
    return {
      textPreview: preview,
      saveReady: false,
      parsedItemCount: 0,
      parseMessage: '',
    };
  }

  const parsed = parseOrderFromText(text);
  const invalidSegments = Array.isArray(parsed?.invalidSegments)
    ? parsed.invalidSegments
    : [];
  if (invalidSegments.length) {
    return {
      textPreview: preview,
      saveReady: false,
      parsedItemCount: 0,
      parseMessage: `有 ${invalidSegments.length} 处内容不完整，需进入任务修改`,
    };
  }

  const orders = Array.isArray(parsed?.orders) ? parsed.orders : [];
  const ready = orderReadiness(orders);
  return {
    textPreview: preview,
    saveReady: ready.ok,
    parsedItemCount: ready.ok ? orders.length : 0,
    parseMessage: ready.ok ? `已解析 ${orders.length} 项商品` : ready.reason,
  };
}
