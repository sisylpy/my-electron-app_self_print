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
    all: total + needsReview,
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
  if (stage === 'all') return count(stats.all);
  if (stage === 'review') return count(stats.needsReview);
  if (stage === 'price') return count(stats.needsPrice);
  if (stage === 'ready') return count(stats.readyToPrint);
  return count(stats.inProgress);
}

export function customerVisibleInStage(customer, stage) {
  return customerStageCount(customer, stage) > 0;
}

export function isPrintableOrder(order) {
  return Boolean(order?.nxDepartmentOrdersId)
    && Number(order.nxDoStatus) === 2
    && Number(order.nxDoPurchaseStatus) > 3
    && Number(order.nxDoWeight) > 0
    && Number(order.nxDoPrice) > 0.1
    && Number(order.nxDoSubtotal) > 0;
}

export function ordersVisibleInStage(orders, stage) {
  const rows = Array.isArray(orders) ? orders : [];
  if (stage === 'ready') return rows.filter(isPrintableOrder);
  if (stage === 'progress') return rows.filter(order => !isPrintableOrder(order));
  if (stage === 'price') return rows.filter(order => !(Number(order?.nxDoPrice) > 0.1));
  return rows;
}
