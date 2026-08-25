const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failures = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function check(condition, message) {
  if (condition) {
    console.log(`PASS ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

const dispatchApi = read('vue/src/modules/dispatch/api/dispatchReadApi.js');
const orderApi = read('vue/src/modules/order/api/orderReadApi.js');
const dispatchStore = read('vue/src/modules/dispatch/store/index.js');
const workbench = read('vue/src/modules/dispatch/views/DispatchWorkbench.vue');
const leftPanel = read('vue/src/modules/dispatch/components/DispatchLeftPanel.vue');
const routeWorkspace = read('vue/src/modules/dispatch/components/RouteWorkspace.vue');
const detailPanel = read('vue/src/modules/dispatch/components/DispatchDetailPanel.vue');
const map = read('vue/src/modules/map/components/ReadOnlyDispatchMap.vue');
const app = read('vue/src/App.vue');
const bills = read('vue/src/views/Bills.vue');

const requiredEndpoints = [
  'dispatch/sandbox/today',
  'dispatch/loading/today',
  'delivery/today',
  'drivers/available',
];
requiredEndpoints.forEach((endpoint) => {
  check(dispatchApi.includes(endpoint), `调度只读 API 包含 ${endpoint}`);
});
check(dispatchApi.includes('axiosInstance.get'), '调度 API 使用 GET');
check(orderApi.includes('axiosInstance.get'), '客户目录 API 使用 GET');
check(
  !`${dispatchApi}\n${orderApi}`.match(/axiosInstance\.(post|put|patch|delete)\s*\(/),
  'Slice 1 API 不包含 POST、PUT、PATCH、DELETE'
);
check(!dispatchApi.match(/duty\/(on|off)|depart-now|complete-now|confirm|manual-dispatch/),
  '调度 API 白名单不包含派单、发车、完成或司机状态写端点');

check(dispatchStore.includes('Promise.allSettled'), '五类只读数据支持独立成功和失败');
check(dispatchStore.includes("import('../api/dispatchReadApi')"), 'dispatch store 只从调度只读 API 加载');
check(dispatchStore.includes("import('@/modules/order/api/orderReadApi')"), 'dispatch store 只从订单只读 API 加载客户地址');
check(!dispatchStore.includes('localStorage'), '调度远程快照不写入本地缓存');
check(dispatchStore.includes("snapshot.status = snapshot.receivedAt ? 'stale' : 'error'"),
  '刷新失败时保留最近成功快照');

// 产品化工作台已由早期三栏组件收敛为“路线地图 + 调度控制面板”。
// 旧只读组件继续保留用于边界回归，但工作台装配检查应跟随当前正式结构。
check(workbench.includes('HuaweiDispatchMap'), '工作台具有路线地图');
check(workbench.includes('DispatchControlPanel'), '工作台具有路线调度控制面板');
check(
  workbench.includes(':selected-stop="selectedStop"')
    && workbench.includes('@select-stop="selectStop"'),
  '工作台保持地图与客户详情双向联动'
);
check(leftPanel.includes('今日') && leftPanel.includes('待派') && leftPanel.includes('配送中'),
  '左栏提供今日、待派、配送中订单视图');
check(leftPanel.includes('在线状态按司机当班状态展示') && leftPanel.includes('_taskLabel'),
  '左栏展示司机当班口径状态和当前任务');
check(routeWorkspace.includes('站点顺序') && routeWorkspace.includes('deliveryProgressPercent'),
  '中栏展示服务端站点顺序和配送进度');
check(detailPanel.includes('地址') && detailPanel.includes('商品') && detailPanel.includes('配送状态'),
  '右栏展示客户、地址、商品和配送状态');
check(map.includes('mapOverview') && map.includes('polylines') && map.includes('markers'),
  '地图只读复用服务端 mapOverview');
check(!map.match(/\b(fetch|axios)\b/), '地图组件不访问地图或路线计算接口');

const slice1ReadUi = `${leftPanel}\n${routeWorkspace}\n${detailPanel}\n${map}`;
check(!slice1ReadUi.includes('electronAPI'), '调度只读展示组件不调用 Electron/打印 IPC');
check(!slice1ReadUi.match(/routeEditAction|canToggleDuty|发车|完成配送/),
  'Slice 1 展示组件不包含路线编辑、发车或完成配送能力');
check(workbench.includes('commands.assignDriver') || workbench.includes('assignDriver'),
  '后续 Slice 3 写能力仅由工作台编排，不污染 Slice 1 只读 API');

check(app.includes("this.$router.push({ name: 'Bills' })"),
  'MCP 打印仍导航现有 Bills');
check(!app.includes("name: 'DispatchWorkbench'"), 'MCP/App 不会强制导航调度页');
check(!bills.includes('modules/dispatch'), 'Bills 继续与 dispatch 隔离');

if (failures > 0) {
  console.error(`Slice 1 readonly smoke failed: ${failures}`);
  process.exit(1);
}

console.log('Slice 1 readonly smoke passed.');
