import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store'; // 引入 store
import { writeAppLog } from './utils/appLog';
import toast from './plugins/toast';
import jQuery from 'jquery'
import { BootstrapVue3 } from 'bootstrap-vue-3';

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

import 'admin-lte/dist/css/adminlte.min.css'
import 'admin-lte/dist/js/adminlte.min.js'
import './app/styles/product-tokens.css'

// 引入 vxe-table
import VXETable from 'vxe-table'
import 'vxe-table/lib/style.css'
import './app/styles/product-polish.css'

window.$ = window.jQuery = jQuery

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
  window.electronAPI?.setMcpSessionUser?.(store.state.disUser || null);
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
