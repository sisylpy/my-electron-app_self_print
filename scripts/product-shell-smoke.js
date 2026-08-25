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

for (const component of [
  'vue/src/app/layout/ProductShell.vue',
  'vue/src/app/layout/ProductSidebar.vue',
  'vue/src/app/layout/ProductHeader.vue',
  'vue/src/app/layout/ProductWorkspace.vue',
]) {
  check(exists(component), `${path.basename(component)} 已建立`);
}

for (const moduleName of ['print', 'order', 'dispatch', 'customer', 'setting']) {
  check(
    exists(`vue/src/modules/${moduleName}/index.js`),
    `${moduleName} 模块具有公开入口`
  );
}

const app = read('vue/src/App.vue');
const main = read('vue/src/main.js');
const router = read('vue/src/router/index.js');
const navigation = read('vue/src/app/navigation/productNavigation.js');
const bills = read('vue/src/views/Bills.vue');
const shell = read('vue/src/app/layout/ProductShell.vue');

check(
  app.includes('<ProductShell') && app.includes('$route.meta.shell !== false'),
  'App 通过路由 meta 统一装配 ProductShell'
);
check(
  main.includes("import './app/styles/product-tokens.css'"),
  '应用装配统一产品视觉变量'
);
check(
  router.includes('...orderRoutes')
    && router.includes('...printRoutes')
    && router.includes('...dispatchRoutes')
    && router.includes('...customerRoutes')
    && router.includes('...settingRoutes'),
  '统一路由接入五个产品模块'
);

for (const routeName of [
  'OrderWorkbenchV2',
  'Bills',
  'DispatchWorkbench',
  'PurchasePredictionLab',
  'CustomerCenter',
  'SettingsCenter',
]) {
  check(navigation.includes(`routeName: '${routeName}'`), `侧栏注册 ${routeName}`);
}

check(
  bills.includes('async applyProductRoute')
    && bills.includes("billsView === 'order'")
    && bills.includes("billsView === 'task'")
    && bills.includes("billsView === 'all'"),
  'Bills 仅通过路由适配选择现有业务视图'
);
check(
  bills.includes("route?.query?.mcpPrint === 'true'"),
  'ProductShell 适配保留 MCP 打印路由优先级'
);
check(!shell.includes('Applys/'), 'ProductShell 不依赖打印模板');
check(!shell.includes('/api/'), 'ProductShell 不调用业务接口');
check(!shell.includes('dispatchCommands'), 'ProductShell 不发起调度写操作');

if (failures > 0) {
  console.error(`ProductShell smoke failed: ${failures}`);
  process.exit(1);
}

console.log('ProductShell smoke passed.');
