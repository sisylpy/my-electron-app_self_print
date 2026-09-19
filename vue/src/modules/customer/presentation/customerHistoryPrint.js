export const CUSTOMER_HISTORY_PRINT_COMPONENTS = Object.freeze([
  'ApplyPanel',
  'ApplyFiftyPanel',
  'ApplyHalfPanel',
  'ApplyHalfWholePanel',
  'ApplyThirtyPanel',
  'ApplyThirtyWholePanel',
]);

export function resolveCustomerHistoryPrintComponent(printName) {
  return CUSTOMER_HISTORY_PRINT_COMPONENTS.includes(printName) ? printName : 'ApplyPanel';
}

export function normalizeCustomerHistoryPrintData(payload, billSummary = {}) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const detailBill = source.bill && typeof source.bill === 'object' ? source.bill : {};
  const bill = { ...billSummary, ...detailBill };
  const lines = Array.isArray(detailBill.nxDepartmentOrdersEntities)
    ? detailBill.nxDepartmentOrdersEntities
    : (Array.isArray(source.arr) ? source.arr : []);

  return {
    bill: {
      ...bill,
      nxDepartmentOrdersEntities: Array.from(lines),
    },
    arr: Array.from(lines),
  };
}
