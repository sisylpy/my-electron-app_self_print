import { createRouter, createWebHashHistory } from 'vue-router';
import Home from '@/views/Home.vue';
import Screen from '@/views/Screen.vue';
import store from '@/store';
import { customerRoutes } from '@/modules/customer';
import { dispatchRoutes } from '@/modules/dispatch';
import { orderRoutes } from '@/modules/order';
import { printRoutes } from '@/modules/print';
import { settingRoutes } from '@/modules/setting';
import { returnRoutes } from '@/modules/returns';
import { predictionLabRoutes } from '@/modules/predictionLab';
import { salesAnalysisRoutes } from '@/modules/salesAnalysis';
import { writeAppLog } from '@/utils/appLog';
import { canAccessModule, defaultRouteNameForUser } from '@/utils/disUserRole';
import {
  parseStoredDisUser,
  isRememberPrinterUserEnabled,
  isKioskEntryRoute,
  resolveBillsQueryFromDisUser,
} from '@/utils/rememberPrinterUser';

export const coreRoutes = [
  {
    path: '/',
    name: 'Screen',
    component: Screen,
    meta: {
      shell: false,
      module: 'core',
      title: '配送商登录',
    },
  },
  {
    path: '/home',
    name: 'Home',
    component: Home,
    meta: {
      shell: false,
      module: 'core',
      title: '配送商选择',
    },
  },
];

export const routes = [
  ...coreRoutes,
  ...orderRoutes,
  ...printRoutes,
  ...returnRoutes,
  ...dispatchRoutes,
  ...customerRoutes,
  ...predictionLabRoutes,
  ...salesAnalysisRoutes,
  ...settingRoutes,
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

function routeRequiresDisUser(route) {
  return route.matched.some((record) => record.meta?.requiresDisUser)
    || route.meta?.requiresDisUser === true;
}

async function rememberedOrderSessionIsValid(disId) {
  const action = window.electronAPI?.orderSession?.todayCustomers;
  if (typeof action !== 'function') return true;
  try {
    const result = await action(disId);
    return !(result?.ok === false && Number(result?.status) === 401);
  } catch (error) {
    writeAppLog('warn', 'router', 'remember-auto-login:validation-unavailable', {
      disId,
      message: error?.message || String(error),
    });
    return true;
  }
}

/** 用「记住用户」签发的长会话令牌静默换回订单会话（开机自启也走这里）。 */
async function refreshRememberedSession(disId) {
  const action = window.electronAPI?.orderSession?.refreshSession;
  if (typeof action !== 'function') return false;
  try {
    const result = await action();
    if (!result?.ok) {
      writeAppLog('info', 'router', 'remember-auto-login:refresh-failed', {
        disId,
        status: result?.status ?? null,
        message: result?.message || '',
      });
      return false;
    }
    const refreshedUser = result?.data?.user;
    if (refreshedUser && resolveBillsQueryFromDisUser(refreshedUser)) {
      store.commit('SET_DISUSER', refreshedUser);
    }
    writeAppLog('info', 'router', 'remember-auto-login:refresh-ok', { disId });
    return true;
  } catch (error) {
    writeAppLog('warn', 'router', 'remember-auto-login:refresh-error', {
      disId,
      message: error?.message || String(error),
    });
    return false;
  }
}

/** 会话过期不再直接判定要扫码：先尝试用自动登录令牌续期。 */
async function ensureRememberedSession(disId) {
  if (await rememberedOrderSessionIsValid(disId)) return true;
  return refreshRememberedSession(disId);
}

/**
 * 会话过期只清订单会话本身。
 *
 * 注意：不能走 userSession.logout / CLEAR_USER_SESSION_CACHE——那两个会把
 * 「记住用户」开关和本地 disUser 一起删掉，导致用户重新登录后令牌永远不会被保存，
 * 下一次启动又要求重新登录，形成死循环。开关与用户资料是偏好，只能由用户自己关闭。
 */
async function clearExpiredRememberedSession() {
  try {
    await window.electronAPI?.orderSession?.logout?.();
  } catch (error) {
    writeAppLog('warn', 'router', 'remember-auto-login:clear-session-failed', {
      message: error?.message || String(error),
    });
  }
}

function loginRoute(reason, returnTo = '') {
  return {
    name: 'Home',
    query: {
      reason,
      ...(returnTo ? { returnTo } : {}),
    },
    replace: true,
  };
}

/**
 * 保留现有记住用户行为：只在轮播入口自动进入当前角色的默认页面。
 * /dispatch 不参与自动重定向，也不会改变打印入口。
 */
router.beforeEach(async (to, from, next) => {
  const currentUser = store.state.disUser || parseStoredDisUser();
  if (to.name === 'Home' || (to.path || '').replace(/\/$/, '') === '/home') {
    next();
    return;
  }

  if (routeRequiresDisUser(to)) {
    const currentQuery = resolveBillsQueryFromDisUser(currentUser);
    if (!currentQuery) {
      next(loginRoute('login-required', String(to.name || '')));
      return;
    }
    if (from.matched.length === 0
        && !await ensureRememberedSession(currentQuery.disId)) {
      await clearExpiredRememberedSession();
      next(loginRoute('session-expired', String(to.name || '')));
      return;
    }
  }

  if (currentUser && to.meta?.module
      && !canAccessModule(to.meta.module, currentUser)) {
    next({ name: defaultRouteNameForUser(currentUser), replace: true });
    return;
  }
  if (!isKioskEntryRoute(to)) {
    next();
    return;
  }
  const remember = isRememberPrinterUserEnabled();
  if (!remember) {
    writeAppLog('info', 'router', 'remember-auto-login:skip', {
      reason: 'remember-flag-off',
      to: to.fullPath,
      name: to.name,
    });
    next(loginRoute('login-required'));
    return;
  }
  let user = store.state.disUser;
  if (!resolveBillsQueryFromDisUser(user)) {
    user = parseStoredDisUser();
    if (user && resolveBillsQueryFromDisUser(user)) {
      store.commit('SET_DISUSER', user);
    }
  }
  const query = resolveBillsQueryFromDisUser(user);
  if (!query) {
    writeAppLog('info', 'router', 'remember-auto-login:skip', {
      reason: 'no-valid-disUser',
      to: to.fullPath,
      name: to.name,
      hasLocalDis: !!parseStoredDisUser(),
    });
    next(loginRoute('login-required'));
    return;
  }
  if (!await ensureRememberedSession(query.disId)) {
    writeAppLog('info', 'router', 'remember-auto-login:session-expired', {
      disId: query.disId,
      to: to.fullPath,
    });
    await clearExpiredRememberedSession();
    next(loginRoute('session-expired'));
    return;
  }
  const targetRoute = defaultRouteNameForUser(user);
  writeAppLog('info', 'router', 'remember-auto-login:redirect-default-route', {
    disId: query.disId,
    routeName: targetRoute,
    to: to.fullPath,
  });
  next({
    name: targetRoute,
    query: {
      disId: query.disId,
      disName: query.disName,
    },
    replace: true,
  });
});

router.onError((error) => {
  writeAppLog('error', 'router', error?.message || String(error), {
    stack: error?.stack,
  });
});

export default router;
