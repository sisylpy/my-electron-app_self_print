export const DIS_USER_ROLE_ADMIN = 0;
export const DIS_USER_ROLE_CLERK = 1;
export const DIS_USER_ROLE_STAFF = 2;
export const DIS_USER_ROLE_SALES = 3;

const CLERK_MODULES = new Set(['order']);
const STAFF_MODULES = new Set(['print', 'returns']);
const SALES_MODULES = new Set(['customer']);

export function getDisUserRole(user) {
  if (!user || user.nxDiuAdmin === undefined || user.nxDiuAdmin === null) return null;
  const role = Number(user.nxDiuAdmin);
  return Number.isFinite(role) ? role : null;
}

/**
 * 配送调度只对平台型开放：基础出货版与经营版隐藏入口。
 * 套餐读取不到（历史未迁移客户、桌面安全会话不可用）时不做判断，
 * 交给角色规则处理，避免把老客户当成基础出货版。
 */
export function canUseDispatch(plan) {
  if (!plan) return null;
  return plan === 'PLATFORM_PARTNER';
}

export function canAccessModule(moduleName, user, plan) {
  if (!moduleName || moduleName === 'core') return true;
  if (moduleName === 'dispatch') {
    const byPlan = canUseDispatch(plan);
    if (byPlan !== null) return byPlan;
  }
  const role = getDisUserRole(user);
  if (role === DIS_USER_ROLE_ADMIN) return true;
  if (role === DIS_USER_ROLE_CLERK) return CLERK_MODULES.has(moduleName);
  if (role === DIS_USER_ROLE_STAFF) return STAFF_MODULES.has(moduleName);
  if (role === DIS_USER_ROLE_SALES) return SALES_MODULES.has(moduleName);
  return false;
}

export function defaultRouteNameForUser(user) {
  const role = getDisUserRole(user);
  if (role === DIS_USER_ROLE_ADMIN) return 'OrderWorkbenchV2';
  if (role === DIS_USER_ROLE_CLERK) return 'OrderIntake';
  if (role === DIS_USER_ROLE_STAFF) return 'ReturnPrintWorkbench';
  if (role === DIS_USER_ROLE_SALES) return 'CustomerCenter';
  return 'Screen';
}

export function roleLabelForUser(user) {
  const role = getDisUserRole(user);
  if (role === DIS_USER_ROLE_ADMIN) return '老板';
  if (role === DIS_USER_ROLE_CLERK) return '录单员';
  if (role === DIS_USER_ROLE_STAFF) return '出货 / 库房';
  if (role === DIS_USER_ROLE_SALES) return '业务员';
  return '其他角色';
}
