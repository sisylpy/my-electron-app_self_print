/** Electron IPC 只接受可克隆的最小会话摘要，不能直接传 Vue 响应式对象。 */
export function mcpSessionUserSummary(value) {
  if (!value || typeof value !== 'object') return null;
  const disId = Number(value.nxDiuDistributerId);
  if (!Number.isSafeInteger(disId) || disId <= 0) return null;
  const name = value.nxDistributerEntity?.nxDistributerName;
  return {
    nxDiuDistributerId: disId,
    nxDistributerEntity: {
      nxDistributerName: typeof name === 'string' ? name.slice(0, 100) : '',
    },
  };
}
