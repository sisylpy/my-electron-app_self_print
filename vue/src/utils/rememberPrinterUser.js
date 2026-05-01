/** 与 Screen.vue「记住用户」共用：以 localStorage 为准；userData 标志由主进程异步备份（菜单「取消自动登录」会删文件） */
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

/** 路由守卫只用 localStorage，避免 sendSync 拖慢导航；与界面勾选一致 */
export function isRememberPrinterUserEnabled() {
  return localStorage.getItem(REMEMBER_PRINTER_USER_KEY) === '1';
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

