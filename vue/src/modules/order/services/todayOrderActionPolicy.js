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
  // 写单价时若订单已有出货数量，后端 giveOrderPrice 会直接把 nxDoStatus 置为完成(2)，
  // 但出库（库存扣减、purchaseStatus 推进到 4）尚未发生。此时库存还没动，
  // 订单既不能修改也不能完成出库还不满足可打印，所以修改与完成出库都要继续允许。
  const outboundPending = !completed || purchaseStatus <= 3;

  return {
    persisted,
    draft,
    completed,
    purchaseStatus,
    canDelete: draft && !collaborationLocked,
    canModify: persisted && !draft && editablePurchaseStage && !collaborationLocked && outboundPending,
    canReplaceGoods: persisted && !draft && !completed && editablePurchaseStage && !collaborationLocked,
    canFinishOutbound: persisted && !draft && editablePurchaseStage && !collaborationLocked && outboundPending,
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
