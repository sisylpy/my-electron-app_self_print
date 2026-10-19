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
 * 返回值：true 放行 / false 拒绝 / null 交给原有角色规则。
 *
 * @param {string|null} plan 当前生效套餐
 * @param {boolean} loaded 套餐是否已查询成功（区分"确认为历史未迁移客户"与"查询失败/未完成"）
 */
export function canUseDispatch(plan, loaded) {
  if (!loaded) return false;
  // 平台型保留原有角色权限校验；确认为历史未迁移客户（查询成功但无套餐记录）
  // 也保留旧角色兼容，不按基础出货版降级。
  if (!plan || plan === 'PLATFORM_PARTNER') return null;
  return false;
}

export function canAccessModule(moduleName, user, planState) {
  if (!moduleName || moduleName === 'core') return true;
  if (moduleName === 'dispatch') {
    const byPlan = canUseDispatch(planState?.currentPlan, Boolean(planState?.loaded));
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
