export function reusePendingWechatTextTask(incomingItem, existingItem, mergePayload) {
  if (!incomingItem || !existingItem
      || incomingItem.taskType !== 'text'
      || existingItem.taskType !== 'text'
      || typeof mergePayload !== 'function') return incomingItem;

  const existingTaskId = Number(existingItem?.payload?.source?.wechatTaskId);
  if (!Number.isInteger(existingTaskId) || existingTaskId <= 0) return incomingItem;

  const payload = mergePayload(existingItem.payload, incomingItem.payload);
  return {
    ...incomingItem,
    token: existingItem.token,
    departmentId: existingItem.departmentId || incomingItem.departmentId,
    sourceKey: existingItem.sourceKey || incomingItem.sourceKey,
    draftRevision: Number(existingItem.draftRevision) || 0,
    payload: {
      ...payload,
      source: {
        ...payload.source,
        wechatTaskId: existingTaskId,
      },
    },
  };
}
