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
const disUserRole = read('vue/src/utils/disUserRole.js');
const axiosClient = read('vue/src/api/axios.js');
const desktopOrderSession = read('vue/src/api/desktopOrderSession.js');
const home = read('vue/src/views/Home.vue');
const loginStoryPanel = read('vue/src/components/login/LoginStoryPanel.vue');
const bills = read('vue/src/views/Bills.vue');
const shell = read('vue/src/app/layout/ProductShell.vue');
const orderWorkbench = read('vue/src/modules/order/views/OrderWorkbenchV2.vue');
const orderFlowInbox = read('vue/src/modules/order/components/workbench/OrderFlowInbox.vue');
const aiOrderPanel = read('vue/src/modules/order/components/workbench/AiOrderPanel.vue');
const placeOrderWorkspace = read('vue/src/modules/order/components/PlaceOrderWorkspace.vue');
const placeOrderController = read('vue/src/modules/order/services/placeOrderController.js');
const imageCropper = read('vue/src/components/ImageCropperModal.vue');
const settingsCenter = read('vue/src/modules/setting/views/SettingsCenter.vue');
const rememberPrinterUser = read('vue/src/utils/rememberPrinterUser.js');
const preload = read('src/preload.js');
const electronMain = read('src/main.js');

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
  navigation.includes("label: '录单'")
    && !navigation.includes("label: '工作台'"),
  '首个订单入口显示为录单'
);
check(
  disUserRole.includes("if (role === DIS_USER_ROLE_ADMIN) return 'OrderWorkbenchV2';")
    && router.includes('const targetRoute = defaultRouteNameForUser(user);')
    && router.includes('name: targetRoute'),
  '老板账号和记住登录入口默认进入首个录单页面'
);
check(
  router.includes("reason: 'remember-flag-off'")
    && /if \(!remember\) \{[\s\S]*?next\(\);[\s\S]*?return;[\s\S]*?\}/.test(router)
    && router.includes('rememberedOrderSessionIsValid(query.disId)')
    && router.includes("next(loginRoute('session-expired'"),
  '未开启自动登录时保留欢迎页，仅在会话过期时进入扫码登录'
);
check(
  settingsCenter.includes('自动登录')
    && settingsCenter.includes('开机自启')
    && settingsCenter.includes('setRememberPrinterUserEnabled')
    && settingsCenter.includes('appPreferences')
    && rememberPrinterUser.includes('getRememberPrinterUserSync')
    && preload.includes('getLaunchAtLogin')
    && electronMain.includes("ipcMain.handle('app-launch-at-login-get'")
    && electronMain.includes('app.setLoginItemSettings'),
  '设备与设置提供双写自动登录和系统开机自启开关'
);
check(
  main.includes('ORDER_SESSION_EXPIRED_EVENT')
    && main.includes("reason: 'session-expired'")
    && axiosClient.includes("notifyOrderSessionExpired('axios')")
    && desktopOrderSession.includes('notifyOrderSessionExpired(`desktop-order-session:${method}`)'),
  '运行中的订单会话失效会统一清理并返回扫码登录'
);
check(
  home.includes("this.$route.query.reason === 'session-expired'")
    && home.includes('登录状态已失效，请重新用微信扫码登录'),
  '扫码登录页会通俗说明需要重新登录的原因'
);
check(
  home.includes('<LoginStoryPanel />')
    && home.includes('微信扫码登录')
    && home.includes('二维码仅用于本次登录')
    && home.includes('this.stopPolling();'),
  '扫码登录页使用产品动画双栏布局，刷新二维码前会停止旧轮询'
);
check(
  loginStoryPanel.includes('微信消息，自动汇成订单')
    && loginStoryPanel.includes('零散内容，快速变成清单')
    && loginStoryPanel.includes('录单、出库、打印，一套完成')
    && loginStoryPanel.includes('prefers-reduced-motion')
    && loginStoryPanel.includes('beforeUnmount()'),
  '登录页三段产品动画会自动切换，并支持减少动态效果及定时器清理'
);
check(
  aiOrderPanel.includes(':wechat-conversation-name="pendingWechatImport')
    && placeOrderWorkspace.includes(':source-name="imageCropperWechatName"')
    && placeOrderController.includes('imageCropperWechatName()')
    && placeOrderController.includes('对应客户：${customerName}')
    && imageCropper.includes('微信图片订单来源')
    && imageCropper.includes('icm-source-banner'),
  '图片裁剪框顶部突出显示真实微信好友或群名，并在需要时显示对应客户'
);

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
check(shell.includes('.product-sidebar__navigation a') && shell.includes('flex: 1 0 54px'),
  '侧栏菜单项按可用高度均匀分配并保留最小点击高度');
check(shell.includes('.product-sidebar__navigation') && shell.includes('overflow-y: auto'),
  '侧栏在窗口高度不足时允许导航区滚动');
check(
  shell.indexOf('<ProductWorkspace') < shell.indexOf('<ProductHeader')
    && shell.includes('class="product-shell__workspace"')
    && shell.includes('class="product-shell__header"')
    && orderWorkbench.includes('defer to="#product-header-context"')
    && orderFlowInbox.includes('defer to="#product-header-context"'),
  '订单工作区先于标题栏卸载，顶部 Teleport 不会残留失效 DOM 节点'
);

if (failures > 0) {
  console.error(`ProductShell smoke failed: ${failures}`);
  process.exit(1);
}

console.log('ProductShell smoke passed.');
