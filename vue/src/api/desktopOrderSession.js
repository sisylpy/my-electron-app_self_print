// 打包后的 file:// 页面只通过白名单 IPC 使用扫码建立的订单会话。
// Vite 开发态仍使用原来的同源 /api 代理。
export function isPackagedDesktop() {
  return import.meta.env.PROD && typeof window !== 'undefined'
    && window.location.protocol === 'file:';
}

export async function desktopOrderSessionRequest(method, ...args) {
  const action = window.electronAPI?.orderSession?.[method];
  if (typeof action !== 'function') {
    throw new Error('桌面订单会话功能不可用，请更新安装包');
  }
  const result = await action(...args);
  if (!result?.ok) {
    const error = new Error(result?.message || '订单服务暂不可用');
    error.response = { status: result?.status || 0, data: result?.data || null };
    throw error;
  }
  return { status: result.status, data: result.data };
}
