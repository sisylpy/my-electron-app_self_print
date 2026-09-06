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

/**
 * 保留现有记住用户行为：只在轮播入口自动进入 Bills。
 * /dispatch 不参与自动重定向，也不会改变打印入口。
 */
router.beforeEach((to, from, next) => {
  const currentUser = store.state.disUser || parseStoredDisUser();
  if (currentUser && to.meta?.module
      && !canAccessModule(to.meta.module, currentUser)) {
    next({ name: defaultRouteNameForUser(currentUser), replace: true });
    return;
  }
  if (to.name === 'Home' || (to.path || '').replace(/\/$/, '') === '/home') {
    next();
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
    next();
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
    next();
    return;
  }
  writeAppLog('info', 'router', 'remember-auto-login:redirect-bills', {
    disId: query.disId,
    to: to.fullPath,
  });
  next({
    name: 'Bills',
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
