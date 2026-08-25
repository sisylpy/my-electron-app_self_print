const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failures = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function check(condition, message) {
  if (condition) {
    console.log(`PASS ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

for (const moduleName of ['print', 'dispatch', 'order', 'map']) {
  check(
    exists(`vue/src/modules/${moduleName}/index.js`),
    `${moduleName} 模块具有公开入口`
  );
  check(
    exists(`vue/src/modules/${moduleName}/README.md`),
    `${moduleName} 模块具有边界说明`
  );
}

const main = read('vue/src/main.js');
const router = read('vue/src/router/index.js');
const printRoutes = read('vue/src/modules/print/routes.js');
const dispatchRoutes = read('vue/src/modules/dispatch/routes.js');
const dispatchStore = read('vue/src/modules/dispatch/store/index.js');
const dispatchView = read('vue/src/modules/dispatch/views/DispatchWorkbench.vue');
const rootStore = read('vue/src/store/index.js');
const app = read('vue/src/App.vue');
const bills = read('vue/src/views/Bills.vue');

check(main.includes("import router from './router'"), '应用只从统一 router 入口装配路由');
check(!main.includes('createRouter'), 'main.js 不再维护第二套路由实例');
check(router.includes('...printRoutes') && router.includes('...dispatchRoutes'),
  '统一 router 组合打印和调度模块路由');
check(printRoutes.includes("path: PRINT_ROUTE_PATH"), '打印正式路径仍由 /bills 常量提供');
check(printRoutes.includes("alias: '/print'"), '打印入口具有独立 /print 别名');
check(printRoutes.includes("name: PRINT_ROUTE_NAME"), '打印路由名继续使用 Bills');
check(printRoutes.includes("component: Bills"), '打印入口继续加载现有 Bills 页面');
check(dispatchRoutes.includes("path: DISPATCH_ROUTE_PATH"), '调度入口注册 /dispatch');
check(dispatchRoutes.includes("name: DISPATCH_ROUTE_NAME"), '调度路由具有独立名称');
check(dispatchRoutes.includes("import('./views/DispatchWorkbench.vue')"), '调度页面独立懒加载');

check(rootStore.includes("import dispatch from '@/modules/dispatch/store'"),
  '根 Vuex 注册 dispatch 命名空间');
check(rootStore.includes('mcpPrintQueue: []'), '现有 MCP 打印队列仍保留在根状态');
check(dispatchStore.includes('namespaced: true'), 'dispatch 状态使用命名空间');
check(!dispatchStore.includes('localStorage'), 'dispatch 快照不写入 localStorage');
check(!dispatchStore.match(/axiosInstance\.(post|put|patch|delete)/),
  'dispatch store 不直接调用业务写接口');

check(app.includes("this.$router.push({ name: 'Bills' })"),
  'MCP 打印仍只导航到现有 Bills');
check(!app.includes("name: 'DispatchWorkbench'"), 'MCP/App 不会强制导航到调度页面');
check(!bills.includes('modules/dispatch'), 'Bills 不依赖 dispatch 模块');
check(!dispatchView.includes('electronAPI'), '调度页面不调用 Electron 打印 API');
check(!dispatchView.match(/\b(fetch|axios)\s*\(/), '调度页面不绕过模块 API 直接请求');

if (failures > 0) {
  console.error(`Slice 0 architecture smoke failed: ${failures}`);
  process.exit(1);
}

console.log('Slice 0 architecture smoke passed.');
