/**
 * Electron contextBridge / ipcRenderer 不能复制 Vue 的响应式 Proxy。
 * 订单本来就会以 JSON 发送到后端，因此在进入 IPC 前做一次
 * JSON 边界序列化，同时去掉 Proxy、方法和原型。
 */
export function toIpcCloneableJson(value, label = '请求数据') {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error(`${label}无法序列化`);
  }
  if (typeof serialized !== 'string') {
    throw new Error(`${label}无法序列化`);
  }
  return JSON.parse(serialized);
}
