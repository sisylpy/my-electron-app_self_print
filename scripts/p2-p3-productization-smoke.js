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

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL ${message}`);
}

function check(condition, message) {
  condition ? pass(message) : fail(message);
}

for (const legacyName of ['PlaceOrder', 'TaskOrder', 'OrderList']) {
  const source = read(`vue/src/components/${legacyName}.vue`);
  check(source.split(/\r?\n/).length <= 30, `${legacyName}.vue 是兼容薄入口`);
  check(/modules\/order\/components/.test(source), `${legacyName}.vue 指向 order 模块`);
}

for (const [componentName, controllerName] of [
  ['PlaceOrderWorkspace', 'placeOrderController'],
  ['TaskOrderWorkspace', 'taskOrderController'],
  ['OrderEditor', 'orderEditorController'],
]) {
  const source = read(`vue/src/modules/order/components/${componentName}.vue`);
  check(source.split(/\r?\n/).length < 1200, `${componentName}.vue 已拆离超大控制逻辑`);
  check(source.includes(`../services/${controllerName}`), `${componentName}.vue 使用独立控制器`);
  check(exists(`vue/src/modules/order/services/${controllerName}.js`), `${controllerName} 控制器存在`);
}

for (const requiredFile of [
  'vue/src/modules/order/components/OrderModeSelector.vue',
  'vue/src/modules/order/components/TaskSelector.vue',
  'vue/src/modules/order/components/ProductPanel.vue',
  'vue/src/modules/order/services/orderApi.js',
  'vue/src/modules/order/services/voiceInputService.js',
  'vue/src/modules/order/stores/orderWorkspaceState.js',
]) {
  check(exists(requiredFile), `${requiredFile} 已模块化`);
}

const orderApi = read('vue/src/modules/order/services/orderApi.js');
for (const apiMethod of ['recognizeOrderFromExcel', 'recognizeOrderOCR', 'saveManulOrder']) {
  check(orderApi.includes(apiMethod), `订单 API 门面保留 ${apiMethod}`);
}

const state = read('vue/src/modules/order/stores/orderWorkspaceState.js');
for (const factory of ['createPlaceOrderState', 'createTaskOrderState', 'createOrderListState']) {
  check(state.includes(factory), `页面状态工厂保留 ${factory}`);
}

const main = read('src/main.js');
const preload = read('src/preload.js');
check(exists('src/print/config.js'), '主进程打印配置已集中');
check(exists('src/print/validation.js'), '打印 IPC 校验已独立');
check(exists('vue/src/modules/print/config/paperProfiles.js'), '纸型合同已集中登记');
check(exists('vue/src/modules/print/config/printerDefaults.js'), '打印机默认配置已集中');
check(/assertTrustedRendererEvent\(event\)/.test(main), '打印 IPC 校验调用来源');
check(/assertPrintMetadata\(/.test(main), '打印 IPC 校验业务参数');
check(/runTrackedPrintJob\(/.test(main), '回执打印任务发布统一状态');
check(/onPrintJobStatus\s*:/.test(preload), 'preload 仅白名单暴露打印状态');
check(!/ipcRenderer\s*[:,]/.test(preload), 'preload 未暴露原始 ipcRenderer');

const shell = read('vue/src/app/layout/ProductShell.vue');
check(shell.includes('<PrintJobStatus'), '产品壳层显示打印任务状态');

const app = read('vue/src/App.vue');
const dispatchGuardAt = app.indexOf("this.$route.name === 'DispatchWorkbench'");
const billsNavigationAt = app.indexOf("this.$route.name !== 'Bills'", dispatchGuardAt);
check(
  dispatchGuardAt >= 0 && billsNavigationAt > dispatchGuardAt,
  'MCP 任务在进入 Bills 前保护派单页面'
);
check(
  /ENQUEUE_MCP_PRINT_TASK[\s\S]*DispatchWorkbench[\s\S]*return;[\s\S]*this\.\$route\.name !== 'Bills'/.test(app),
  '派单页 MCP 任务只入队且不抢占路由'
);

if (failures > 0) {
  console.error(`P2/P3 productization smoke failed: ${failures}`);
  process.exit(1);
}

console.log('P2/P3 productization smoke passed.');
