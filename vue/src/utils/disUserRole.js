export const DIS_USER_ROLE_ADMIN = 0;
export const DIS_USER_ROLE_CLERK = 1;
export const DIS_USER_ROLE_SALES = 3;

const CLERK_MODULES = new Set(['order']);
const SALES_MODULES = new Set(['customer']);

export function getDisUserRole(user) {
  if (!user || user.nxDiuAdmin === undefined || user.nxDiuAdmin === null) return null;
  const role = Number(user.nxDiuAdmin);
  return Number.isFinite(role) ? role : null;
}

export function canAccessModule(moduleName, user) {
  if (!moduleName || moduleName === 'core') return true;
  const role = getDisUserRole(user);
  if (role === DIS_USER_ROLE_ADMIN) return true;
  if (role === DIS_USER_ROLE_CLERK) return CLERK_MODULES.has(moduleName);
  if (role === DIS_USER_ROLE_SALES) return SALES_MODULES.has(moduleName);
  return false;
}

export function defaultRouteNameForUser(user) {
  const role = getDisUserRole(user);
  if (role === DIS_USER_ROLE_ADMIN) return 'Bills';
  if (role === DIS_USER_ROLE_CLERK) return 'OrderIntake';
  if (role === DIS_USER_ROLE_SALES) return 'CustomerCenter';
  return 'Screen';
}

export function roleLabelForUser(user) {
  const role = getDisUserRole(user);
  if (role === DIS_USER_ROLE_ADMIN) return '老板';
  if (role === DIS_USER_ROLE_CLERK) return '录单员';
  if (role === DIS_USER_ROLE_SALES) return '业务员';
  return '其他角色';
}
