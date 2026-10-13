/** 与 Screen.vue 及「设备与设置」共用：localStorage 与主进程 userData 标志双写。 */
export const REMEMBER_PRINTER_USER_KEY = 'rememberPrinterUser';

export function parseStoredDisUser() {
  try {
    const raw = localStorage.getItem('disUser');
    if (!raw || raw === 'null') return null;
    const u = JSON.parse(raw);
    if (!u || typeof u !== 'object') return null;
    return u;
  } catch {
    return null;
  }
}

export function isRememberPrinterUserEnabled() {
  if (localStorage.getItem(REMEMBER_PRINTER_USER_KEY) === '1') return true;
  try {
    const enabled = window.electronAPI?.getRememberPrinterUserSync?.() === true;
    if (enabled) localStorage.setItem(REMEMBER_PRINTER_USER_KEY, '1');
    return enabled;
  } catch {
    return false;
  }
}

/** 所有入口统一写入，保证欢迎页、设置页和下次启动的状态一致。 */
export function setRememberPrinterUserEnabled(enabled) {
  const normalized = Boolean(enabled);
  if (normalized) {
    localStorage.setItem(REMEMBER_PRINTER_USER_KEY, '1');
  } else {
    localStorage.removeItem(REMEMBER_PRINTER_USER_KEY);
  }
  try {
    window.electronAPI?.rememberPrinterUserSetAsync?.(normalized);
  } catch {
    // 浏览器预览或主进程不可用时，localStorage 仍可用。
  }
  return normalized;
}

/** 首次导航时 to.name 可能尚未带上，用 matched / path 兜底 */
export function isKioskEntryRoute(to) {
  const name = to.name ?? to.matched[0]?.name;
  if (name === 'Screen' || name === 'Home') return true;
  const p = (to.path || '').replace(/\/$/, '') || '/';
  return p === '/' || p === '/home';
}

/** 从已保存用户对象解析自动登录 query（尽量兼容字段差异） */
export function resolveBillsQueryFromDisUser(u) {
  if (!u || typeof u !== 'object') return null;
  const disId = u.nxDiuDistributerId ?? u.nxDistributerUserId ?? null;
  if (disId === null || disId === undefined || disId === '') return null;
  const disName =
    u.nxDistributerEntity?.nxDistributerName ||
    u.nxDistributerName ||
    u.disName ||
    u.nxDistributerEntity?.nxDistributerAttrName ||
    '';
  return {
    disId: String(disId),
    disName: disName || '配送商',
  };
}

