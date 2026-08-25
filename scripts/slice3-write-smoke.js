const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const serverRoot = path.resolve(root, '../../../nongxinle-server');
const bossRoot = path.resolve(root, '../boss-mini');
let failures = 0;

function readFrom(base, relativePath) {
  return fs.readFileSync(path.join(base, relativePath), 'utf8');
}

function read(relativePath) {
  return readFrom(root, relativePath);
}

function check(condition, message) {
  if (condition) {
    console.log(`PASS ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

const main = read('src/main.js');
const preload = read('src/preload.js');
const gateway = read('src/dispatch/dispatch-gateway.js');
const credentialStore = read('src/dispatch/credential-store.js');
const workbench = read('vue/src/modules/dispatch/views/DispatchWorkbench.vue');
const writeContract = read('vue/src/modules/dispatch/services/writeContract.js');
const dispatchStore = read('vue/src/modules/dispatch/store/index.js');
const bills = read('vue/src/views/Bills.vue');
const app = read('vue/src/App.vue');

check(gateway.includes("const API_PREFIX = 'desktop-dispatch/v1/'"),
  'Electron 调度写网关只使用 /api/desktop-dispatch/v1 合同前缀');
check(gateway.includes("'stops/confirm'") && gateway.includes("'route-edits/confirm'"),
  '首批写网关只登记分配司机与确认派单');
check(!gateway.match(/nxdisroutedispatch\/.*(confirm|edit)/),
  'Electron 写网关不调用小程序兼容写接口');
check(gateway.includes("'Idempotency-Key'") && gateway.includes("'X-Client-Version'"),
  '写命令携带幂等键与客户端版本');
check(gateway.includes("headers.Authorization = `Bearer ${session.accessToken}`"),
  'Bearer Token 只由主进程写入请求头');
check(credentialStore.match(/safeStorage\s*[\r\n. ]+encryptString/)
  && credentialStore.includes('safeStorage.decryptString'),
  '可持久化 Token 使用操作系统安全存储加密');
check(!preload.match(/accessToken\s*[:=]/), 'preload 不向渲染进程暴露 accessToken');
check(preload.includes('dispatchAuth: Object.freeze')
  && preload.includes('dispatchCommands: Object.freeze'),
  'preload 仅暴露冻结的调度白名单 API');
check(main.includes("ipcMain.handle('dispatch-confirm-stop'")
  && main.includes("ipcMain.handle('dispatch-confirm-route'"),
  '主进程只注册两项 Slice 3.0 写命令');

check(writeContract.includes('expectedTaskVersion')
  && writeContract.includes('expectedRouteVersion')
  && writeContract.includes('expectedTaskVersions'),
  '渲染层严格提交 taskVersion/routeVersion');
check(!writeContract.match(/\b(operatorUserId|disId)\b/),
  '渲染层写合同不构造 operatorUserId/disId');
check(dispatchStore.includes("dispatch/assignDriver") === false
  && dispatchStore.includes('commands.assignDriver')
  && dispatchStore.includes('commands.confirmDispatch'),
  'Vuex 通过 preload 白名单发起两项写操作');
check(workbench.includes('DriverSelectDialog')
  && workbench.includes('DispatchLoginDialog')
  && workbench.includes('确认派单'),
  '工作台包含司机选择、扫码登录与确认派单 UI');
check(writeContract.includes('status === 401')
  && writeContract.includes('status === 403')
  && writeContract.includes('status === 409')
  && writeContract.includes('status === 422'),
  '工作台反馈覆盖 401/403/409/422');

check(!bills.includes('modules/dispatch'), 'Bills 未引入 dispatch 模块');
check(app.includes("this.$router.push({ name: 'Bills' })"),
  'MCP 打印流程仍保持导航 Bills');

const bossApi = readFrom(bossRoot, 'lib/apiRouteDispatch.js');
const bossSandbox = readFrom(
  bossRoot,
  'subPackage-routeDispatch/pages/bossTab/sandbox/sandbox.js'
);
const bossDesktopLogin = readFrom(bossRoot, 'lib/desktopDispatchLogin.js');
check(bossApi.includes('approveDesktopDispatchChallenge')
  && bossApi.includes("'desktop-dispatch/v1/'"),
  'Boss 小程序扫码授权复用桌面 v1 登录接口');
check(bossSandbox.includes('scanDesktopDispatchLogin')
  && bossDesktopLogin.includes('wx.scanCode')
  && bossDesktopLogin.includes('NXL_DESKTOP_DISPATCH_LOGIN'),
  'Boss 分派中页面校验并授权 Electron 登录二维码');

const stopDto = readFrom(
  serverRoot,
  'src/main/java/com/nongxinle/distribute/dispatch/api/desktop/DesktopStopConfirmCommandRequest.java'
);
const routeDto = readFrom(
  serverRoot,
  'src/main/java/com/nongxinle/distribute/dispatch/api/desktop/DesktopRouteEditConfirmCommandRequest.java'
);
const commandService = readFrom(
  serverRoot,
  'src/main/java/com/nongxinle/distribute/dispatch/application/desktop/DesktopDispatchCommandService.java'
);
check(!stopDto.match(/private\s+Integer\s+(disId|operatorUserId)/)
  && !routeDto.match(/private\s+Integer\s+(disId|operatorUserId)/),
  '桌面 v1 DTO 不定义 disId/operatorUserId');
check(routeDto.includes('expectedTaskVersions') && routeDto.includes('driverRouteId'),
  '确认派单 DTO 冻结路线标识和任务版本集合');
check(commandService.includes('TASK_VERSION_CONFLICT')
  && commandService.includes('ROUTE_VERSION_CONFLICT')
  && commandService.includes('FORBIDDEN_IDENTITY_FIELD'),
  '服务端区分任务/路线冲突并拒绝客户端身份字段');

if (failures > 0) {
  console.error(`Slice 3.0 write smoke failed: ${failures}`);
  process.exit(1);
}

console.log('Slice 3.0 write smoke passed.');
