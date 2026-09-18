function count(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

export function customerOrderStats(entry) {
  const total = count(entry?.totalCount);
  const priced = count(entry?.hasPrice);
  const readyToPrint = count(entry?.finishCount);
  const needsReview = count(entry?.unDo);
  const subtotal = Number(entry?.twoSubtotal);
  return {
    needsReview,
    total,
    weighted: count(entry?.hasWeight),
    priced,
    needsPrice: Math.max(0, total - priced),
    readyToPrint,
    inProgress: Math.max(0, total - readyToPrint),
    readySubtotal: Number.isFinite(subtotal) ? subtotal : 0,
    subtotalText: Number.isFinite(subtotal) ? subtotal.toFixed(1) : '0.0',
    allDone: total > 0 && readyToPrint === total && needsReview === 0,
  };
}

export function customerStageCount(customer, stage) {
  const stats = customer?._workbenchStats || {};
  if (stage === 'review') return count(stats.needsReview);
  if (stage === 'price') return count(stats.needsPrice);
  if (stage === 'ready') return count(stats.readyToPrint);
  return count(stats.inProgress);
}

export function customerVisibleInStage(customer, stage) {
  // 待确认、出货中保留完整客户概览；待写价、可打印只列出有对应订单的客户。
  return (stage !== 'price' && stage !== 'ready') || customerStageCount(customer, stage) > 0;
}

export function isPrintableOrder(order) {
  return Boolean(order?.nxDepartmentOrdersId)
    && Number(order.nxDoStatus) === 2
    && Number(order.nxDoPurchaseStatus) > 3
    && Number(order.nxDoWeight) > 0
    && Number(order.nxDoPrice) > 0.1
    && Number(order.nxDoSubtotal) > 0;
}
