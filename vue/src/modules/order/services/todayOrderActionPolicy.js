const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function getTodayOrderActionPolicy(order) {
  const id = order?.nxDepartmentOrdersId;
  const status = toNumber(order?.nxDoStatus, -2);
  const purchaseStatus = toNumber(order?.nxDoPurchaseStatus, 0);
  const persisted = id !== null && id !== undefined && id !== '';
  const draft = status === -2;
  const completed = status === 2;
  const collaborationLocked = Boolean(order?._collaborationDemandLocked);
  const editablePurchaseStage = purchaseStatus < 4;

  return {
    persisted,
    draft,
    completed,
    purchaseStatus,
    canDelete: draft && !collaborationLocked,
    canModify: persisted && !draft && !completed && editablePurchaseStage && !collaborationLocked,
    canReplaceGoods: persisted && !draft && !completed && editablePurchaseStage && !collaborationLocked,
    canFinishOutbound: persisted && !draft && !completed && editablePurchaseStage && !collaborationLocked,
    canRestock: persisted && completed && purchaseStatus === 4,
    canFinishDelivery: persisted && completed && purchaseStatus === 4,
    canCancelDelivery: persisted && purchaseStatus === 5,
    canInsertBefore: persisted && !collaborationLocked,
    canViewGoods: Boolean(order?.nxDoDisGoodsId || order?.nxDistributerGoodsEntity?.nxDistributerGoodsId),
  };
}

export function validateFinishOutbound(order) {
  const weight = Number(order?.nxDoWeight);
  const price = Number(order?.nxDoPrice);

  if (!Number.isFinite(weight) || weight <= 0) {
    return '请先填写大于 0 的出货数量';
  }
  if (!Number.isFinite(price) || price <= 0.1) {
    return '请先填写有效单价';
  }
  return '';
}
