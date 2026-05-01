import { createApp } from 'vue';
import App from './App.vue';
import { createRouter ,createWebHashHistory} from 'vue-router';
import Home from './views/Home.vue';
import Bills from './views/Bills.vue';
import Screen from './views/Screen.vue';
import TRyVue from './views/try.vue';
import store from './store'; // 引入 store
import { writeAppLog } from './utils/appLog';
import toast from './plugins/toast';
import {
    parseStoredDisUser,
    isRememberPrinterUserEnabled,
    isKioskEntryRoute,
    resolveBillsQueryFromDisUser,
} from './utils/rememberPrinterUser';
import jQuery from 'jquery'
import { BootstrapVue3 } from 'bootstrap-vue-3';

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

import 'admin-lte/dist/css/adminlte.min.css'
import 'admin-lte/dist/js/adminlte.min.js'

// 引入 vxe-table
import VXETable from 'vxe-table'
import 'vxe-table/lib/style.css'

// 引入 axios 实例并暴露到 window（供 MCP 使用）
import axiosInstance from './api/axios';

// 在应用挂载后再暴露到 window，确保 Vue 上下文可用
const exposeAxios = () => {
  window.axios = axiosInstance;
  window.axiosInstance = axiosInstance;
  console.log('[Vue] axios 已暴露到 window:', !!window.axios);
};

// 立即暴露一次
exposeAxios();
const routes = [
  // {
  //   path: '/',
  //   name: 'TRyVue',
  //   component: TRyVue,
  
  // },
  {
    path: '/',
    name: 'Screen',
    component: Screen,
  },
  { path: '/home',  name: 'Home',component: Home },
  { path: '/bills', name: 'Bills', component: Bills },
];
window.$ = window.jQuery = jQuery
const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

/**
 * 记住用户：仅在进入轮播页（/ Screen）时自动进账单。
 * 用户点「打印配送单」会进入 Home 扫码，若此处也拦截，会看不到二维码直接被送进 Bills。
 */
router.beforeEach((to, from, next) => {
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
    writeAppLog('info', 'router', 'remember-auto-login:skip', { reason: 'remember-flag-off', to: to.fullPath, name: to.name });
    next();
    return;
  }
  let u = store.state.disUser;
  if (!resolveBillsQueryFromDisUser(u)) {
    u = parseStoredDisUser();
    if (u && resolveBillsQueryFromDisUser(u)) {
      store.commit('SET_DISUSER', u);
    }
  }
  const q = resolveBillsQueryFromDisUser(u);
  if (!q) {
    writeAppLog('info', 'router', 'remember-auto-login:skip', {
      reason: 'no-valid-disUser',
      to: to.fullPath,
      name: to.name,
      hasLocalDis: !!parseStoredDisUser(),
    });
    next();
    return;
  }
  writeAppLog('info', 'router', 'remember-auto-login:redirect-bills', { disId: q.disId, to: to.fullPath });
  next({
    name: 'Bills',
    query: { disId: q.disId, disName: q.disName },
    replace: true,
  });
});

router.onError((err) => {
  writeAppLog('error', 'router', err?.message || String(err), { stack: err?.stack });
});

const app = createApp(App);
app.use(router);
app.use(store);  // 使用 Vue Router
app.use(toast); // 使用 Toast 插件
app.use(BootstrapVue3);
app.use(VXETable); // 使用 vxe-table

// Vue 运行时错误 → 控制台 + 应用日志
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue 错误:', err);
  console.error('错误信息:', info);
  console.error('组件实例:', instance);
  writeAppLog('error', 'vue', err?.message || String(err), {
    stack: err?.stack,
    info,
    componentName: instance?.$options?.name
  });
};

// 全局脚本错误
window.addEventListener('error', (event) => {
  writeAppLog('error', 'renderer', event.message || 'window.error', {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack
  });
});

// 未处理的 Promise 拒绝
window.addEventListener('unhandledrejection', (event) => {
  const r = event.reason;
  writeAppLog('error', 'renderer', r?.message || String(r), {
    stack: r instanceof Error ? r.stack : undefined
  });
});

// 挂载应用
const mountElement = document.getElementById('app');
if (mountElement) {
  app.mount('#app');
  console.log('✅ Vue 应用已挂载到 #app');
  writeAppLog('info', 'renderer', 'vue-app-mounted', {
    hash: typeof window !== 'undefined' ? window.location.hash : ''
  });
  // 开发时说明日志文件位置（写在系统 userData，不在 vue 项目目录）
  const api = typeof window !== 'undefined' ? window.electronAPI : null;
  if (api && typeof api.getAppLogDirectory === 'function') {
    api.getAppLogDirectory().then((dir) => {
      console.info(
        '%c[应用日志]%c 本地文件目录（非项目路径）: %c%s',
        'font-weight:bold;color:#0d6efd',
        '',
        'color:#198754',
        dir
      );
      console.info('[应用日志] 另请查看运行 Electron 的终端，启动时会打印「今日文件」完整路径；菜单 帮助 → 打开日志文件夹');
    }).catch(() => {});
  } else {
    console.warn('[应用日志] 当前不是 Electron（例如只跑了 vite），不会写入 app-*.log；请用 npm start 同时启动 Electron。');
  }
} else {
  console.error('❌ 找不到 #app 元素！');
  writeAppLog('error', 'renderer', 'mount-failed: #app missing');
}

