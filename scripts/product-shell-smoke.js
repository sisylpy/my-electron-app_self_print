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

for (const name of [
  'ApplyPanel', 'ApplyFiftyPanel', 'ApplyHalfPanel',
  'ApplyHalfWholePanel', 'ApplyThirtyPanel', 'ApplyThirtyWholePanel',
]) {
  const panel = read(`vue/src/components/Applys/${name}.vue`);
  const actions = panel.indexOf('order-preview-actions');
  check(actions > 0
    && panel.indexOf('order-preview-actions', actions + 'order-preview-actions'.length) === -1
    && panel.includes('display: flex; flex-direction: column; height: 100%; min-height: 0;')
    && panel.includes('style="order: -1; flex-shrink: 0;"')
    && panel.includes('<slot name="department-selector"></slot>')
    && panel.includes('@click="printOnly"'),
  `${name} 的打印操作栏在预览上方、只出现一次并支持部门选择`);
}

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
check(
  bills.includes('<template #department-selector>')
    && bills.includes('<option value="all">全部部门</option>')
    && bills.includes('@change="handlePrintDepartmentSelection"'),
  '多部门打印默认显示全部部门，并可在右侧切换单部门'
);
check(
  !bills.includes('¥{{ Number(item.nxDepartmentSubAmount).toFixed(2) }}')
    && !bills.includes('class="sub-department-list"'),
  '客户列表不再把子部门数量显示成金额，部门入口已移到右侧'
);
check(
  bills.includes('class="print-customer-metrics"')
    && bills.includes('item._printCenterStats.total')
    && bills.includes('item._printCenterStats.subtotalText')
    && bills.includes('customerOrderStats(entry)'),
  '打印中心客户卡片复用工作台口径显示商品数和金额'
);
check(!shell.includes('Applys/'), 'ProductShell 不依赖打印模板');
check(!shell.includes('/api/'), 'ProductShell 不调用业务接口');
check(!shell.includes('dispatchCommands'), 'ProductShell 不发起调度写操作');
check(shell.includes('--product-sidebar-width: 104px'), 'Windows 侧栏使用加宽后的 104px 宽度');
check(shell.includes('.product-sidebar__navigation section') && shell.includes('display: contents'),
  '侧栏分组不会阻断菜单项按整屏高度等分');
check(shell.includes('.product-sidebar__navigation a') && shell.includes('flex: 1 1 0'),
  '侧栏菜单项按可用高度均匀分配');
check(shell.includes('.product-sidebar__navigation') && shell.includes('overflow: hidden'),
  '侧栏导航不再显示独立滚动条');

if (failures > 0) {
  console.error(`ProductShell smoke failed: ${failures}`);
  process.exit(1);
}

console.log('ProductShell smoke passed.');
