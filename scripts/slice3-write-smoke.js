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
  if (condition) console.log(`PASS ${message}`);
  else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

async function loadWriteContract() {
  const source = read('vue/src/modules/dispatch/services/writeContract.js');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

async function exerciseGatewayContracts() {
  const requests = [];
  const axios = {
    create() {
      return {
        async request(config) {
          requests.push(config);
          if (config.url === 'desktop-dispatch/v1/auth/me') {
            return {
              status: 200,
              data: {
                code: 0,
                data: {
                  userId: 9,
                  disId: 56,
                  roleCode: 'OWNER',
                  permissions: [
                    'dispatch:duty:manage',
                    'dispatch:assignment:write',
                    'dispatch:route:edit',
                    'dispatch:confirm',
                    'dispatch:loading:confirm',
                    'dispatch:delivery:confirm',
                  ],
                },
              },
            };
          }
          if (config.data?.reason === 'force-conflict') {
            return {
              status: 200,
              data: { code: 409, errorCode: 'ROUTE_VERSION_CONFLICT', msg: '路线已变化' },
            };
          }
          return { status: 200, data: { code: 0, data: { accepted: true } } };
        },
      };
    },
  };
  const { createDispatchGateway } = require('../src/dispatch/dispatch-gateway');
  const gateway = createDispatchGateway({
    app: {
      getPath: () => path.join(root, '.dispatch-smoke-no-write'),
      getVersion: () => 'test',
    },
    safeStorage: { isEncryptionAvailable: () => false },
    axios,
  });
  const adopted = await gateway.adoptLoginSession({
    accessToken: 'test-token',
    userId: 9,
    disId: 56,
    roleCode: 'OWNER',
    permissions: [],
  });
  check(adopted.ok, '测试网关建立经过 auth/me 复核的内存会话');
  requests.length = 0;
  const key = 'dispatch-test-key-0001';
  await gateway.checkInDriver({ driverUserId: 314, idempotencyKey: key, payload: {} });
  await gateway.checkOutDriver({ driverUserId: 314, idempotencyKey: key, payload: {} });
  await gateway.updateStopTimeWindow({
    idempotencyKey: key,
    payload: { routeDate: '2026-08-26', batchCode: 'MORNING', deliveryStopId: 101, latestDeliveryTimeS: 36000 },
  });
  await gateway.returnStopToSandbox({
    deliveryStopId: 101,
    idempotencyKey: key,
    payload: { routeDate: '2026-08-26', batchCode: 'MORNING', reason: 'test', suppressTodayResponse: true },
  });
  await gateway.loadManualDispatchPanorama({
    payload: { routeDate: '2026-08-26', batchCode: 'MORNING', departmentId: 7, depFatherId: 7, sandboxStopKey: 'DEP:7', liveOrderIds: [1] },
  });
  await gateway.departDriver({
    driverUserId: 314,
    idempotencyKey: key,
    payload: { routeDate: '2026-08-26', batchCode: 'MORNING', driverRouteId: 88 },
  });
  await gateway.completeDeliveryStop({
    deliveryStopId: 101,
    idempotencyKey: key,
    payload: { routeDate: '2026-08-26', batchCode: 'MORNING', reason: '' },
  });
  await gateway.returnDeliveryStopToSandbox({
    deliveryStopId: 101,
    idempotencyKey: key,
    payload: { routeDate: '2026-08-26', batchCode: 'MORNING', reason: '拒收' },
  });
  const sandboxResourcePayload = {
    routeDate: '2026-08-26',
    batchCode: 'MORNING',
    driverUserId: 314,
    routeResourceType: 'DISPATCH_SANDBOX',
    sandboxEditCredential: 'test-sandbox-credential',
    canonicalSandboxVersion: 'SANDBOX_V1:test',
    sandboxStateFingerprint: 'test-state-fingerprint',
  };
  await gateway.loadRouteEditPage({ payload: { ...sandboxResourcePayload, stopKeys: [] } });
  await gateway.previewRoute({
    payload: {
      ...sandboxResourcePayload,
      stopKeys: ['dep:1'],
      removedStopKeys: ['dep:2'],
      removalCommandId: 'owner-remove-test-1',
    },
  });
  await gateway.previewRouteExpansion({
    payload: {
      ...sandboxResourcePayload,
      previewToken: 'preview-token',
      maxActiveRouteDurationS: 10800,
      latestRouteFinishAt: '2026-08-26T10:30:00+08:00',
      maxRoadDistanceM: 30000,
      maxAddedStops: 4,
    },
  });
  await gateway.releaseRoutePreview({
    payload: {
      ...sandboxResourcePayload,
      previewToken: 'preview-token',
    },
  });
  await gateway.confirmRoute({
    idempotencyKey: key,
    payload: {
      ...sandboxResourcePayload,
      stopKeys: ['dep:1'],
      liveOrderIds: [1],
      previewToken: 'preview-token',
      confirmReason: 'test',
      expectedRouteVersion: 0,
      expectedTaskVersions: [],
    },
  });
  const reassignPayload = {
    routeDate: '2026-08-26',
    batchCode: 'MORNING',
    driverUserId: 314,
    driverRouteId: 88,
    routeVersion: 5,
    targetDriverUserId: 315,
    stopKeys: ['TASK:1'],
    sourcePage: 'LOADING',
    previewToken: 'preview-token',
  };
  await gateway.previewRouteReassignment({ payload: reassignPayload });
  await gateway.confirmRouteReassignment({ payload: reassignPayload, idempotencyKey: key });
  const conflict = await gateway.returnDeliveryStopToSandbox({
    deliveryStopId: 101,
    idempotencyKey: key,
    payload: { routeDate: '2026-08-26', batchCode: 'MORNING', reason: 'force-conflict' },
  });

  const urls = requests.map((request) => request.url);
  const expectedUrls = [
    'nxdisroutedispatch/drivers/314/duty/on',
    'nxdisroutedispatch/drivers/314/duty/off',
    'nxdisroutedispatch/dispatch/sandbox/stops/time-window',
    'nxdisroutedispatch/sandbox/stops/101/return-to-sandbox',
    'nxdisroutedispatch/sandbox/manual-dispatch/driver-panorama',
    'nxdisroutedispatch/drivers/314/depart-now',
    'nxdisroutedispatch/delivery/stops/101/complete-now',
    'nxdisroutedispatch/sandbox/stops/101/return-to-sandbox-now',
    'desktop-dispatch/v1/route-edits/page',
    'desktop-dispatch/v1/route-edits/expansion/preview',
    'desktop-dispatch/v1/route-edits/preview/release',
    'nxdisroutedispatch/sandbox/driver-route-edit/preview',
    'nxdisroutedispatch/sandbox/driver-route-edit/confirm',
  ];
  check(expectedUrls.every((url) => urls.includes(url)),
    '网关实际请求路径逐项匹配 Boss 派单合同');
  check(requests.every((request) => request.headers.Authorization === 'Bearer test-token'),
    '所有 Boss 兼容写请求均由主进程注入桌面 Bearer Token');
  check(requests.every((request) => {
    const body = JSON.stringify(request.data || {});
    return !body.includes('"disId"') && !body.includes('"operatorUserId"');
  }), 'Boss 兼容请求不接受渲染层配送商或操作人身份');
  check(requests.filter((request) => request.headers['Idempotency-Key'])
    .every((request) => request.headers['X-Client-Version'] === 'test'),
  '有副作用的 Boss 兼容请求携带幂等键和客户端版本');
  check(conflict.status === 409 && conflict.refreshRequired === true,
    'HTTP 200 包裹的 Boss 业务 409 会转换为桌面并发刷新语义');
  const expansionRequest = requests.find((request) => request.url === 'desktop-dispatch/v1/route-edits/expansion/preview');
  check(expansionRequest?.data?.routeResourceType === 'DISPATCH_SANDBOX'
    && expansionRequest?.data?.maxActiveRouteDurationS === 10800
    && expansionRequest?.data?.latestRouteFinishAt === '2026-08-26T10:30:00+08:00'
    && expansionRequest?.data?.maxRoadDistanceM === 30000
    && expansionRequest?.data?.maxAddedStops === 4,
  '主进程白名单保留沙箱资源与AI四项约束');
  const releaseRequest = requests.find((request) => request.url === 'desktop-dispatch/v1/route-edits/preview/release');
  check(releaseRequest?.data?.previewToken === 'preview-token'
    && releaseRequest?.data?.driverUserId === 314
    && releaseRequest?.data?.routeResourceType === 'DISPATCH_SANDBOX',
  '关闭路线编辑页会精确释放当前司机的服务端preview');
}

async function run() {
  const main = read('src/main.js');
  const preload = read('src/preload.js');
  const gateway = read('src/dispatch/dispatch-gateway.js');
  const credentialStore = read('src/dispatch/credential-store.js');
  const workbench = read('vue/src/modules/dispatch/views/DispatchWorkbench.vue');
  const home = read('vue/src/views/Home.vue');
  const styledMap = read('vue/src/modules/map/components/HuaweiStyledDispatchMap.vue');
  const tileMap = read('vue/src/modules/map/components/HuaweiDispatchMap.vue');
  const routeEditor = read('vue/src/modules/dispatch/components/DispatchRouteEditDialog.vue');
  const controlPanel = read('vue/src/modules/dispatch/components/DispatchControlPanel.vue');
  const dutyDialog = read('vue/src/modules/dispatch/components/DispatchDutyDialog.vue');
  const timeDialog = read('vue/src/modules/dispatch/components/DispatchTimeWindowDialog.vue');
  const manualDialog = read('vue/src/modules/dispatch/components/ManualDispatchDialog.vue');
  const dispatchStore = read('vue/src/modules/dispatch/store/index.js');
  const serverAuthController = readFrom(
    serverRoot,
    'src/main/java/com/nongxinle/distribute/dispatch/api/desktop/DesktopDispatchAuthController.java'
  );
  const serverAuthService = readFrom(
    serverRoot,
    'src/main/java/com/nongxinle/distribute/dispatch/security/DesktopDispatchAuthService.java'
  );
  const contract = await loadWriteContract();

  await exerciseGatewayContracts();

  check(gateway.includes("const API_PREFIX = 'desktop-dispatch/v1/'")
    && gateway.includes("const LEGACY_DISPATCH_API_PREFIX = 'nxdisroutedispatch/'"),
  '桌面 v1 与 Boss 兼容接口都由主进程固定前缀访问');
  check(gateway.includes('strictPayload(input?.payload')
    && gateway.includes('FORBIDDEN_IDENTITY_FIELDS'),
  '所有派单写请求仍经过字段白名单并拒绝渲染层身份字段');
  check(gateway.includes("headers.Authorization = `Bearer ${session.accessToken}`")
    && gateway.includes("'Idempotency-Key'"),
  'Bearer Token 不离开主进程，写操作携带幂等键');
  check(credentialStore.match(/safeStorage\s*[\r\n. ]+encryptString/)
    && credentialStore.includes('safeStorage.decryptString'),
  '调度凭证继续使用操作系统安全存储');
  check(!preload.match(/accessToken\s*[:=]/)
    && preload.includes('dispatchCommands: Object.freeze'),
  'preload 只暴露冻结命令白名单，不暴露 accessToken');
  check(home.includes('persistSession: true')
    && credentialStore.match(/safeStorage\s*[\r\n. ]+encryptString/)
    && credentialStore.includes('safeStorage.decryptString'),
  '老板完成原桌面登录后，内部调度令牌由系统安全存储加密保存并可在重启后恢复');
  check(styledMap.includes('mapAuthBlocked')
    && styledMap.includes('dispatch-map-shell')
    && styledMap.includes("emit('session-expired'")
    && workbench.includes(':auth-checking=')
    && workbench.includes('@session-expired="handleDesktopSessionExpired"')
    && !styledMap.includes('扫码登录')
    && !workbench.includes('dispatch-auth-begin-login'),
  '地图使用稳定根容器并只依赖原桌面登录建立的内部会话，不再提供第二套扫码入口');
  check(!gateway.includes('beginLogin')
    && !gateway.includes('pollLogin')
    && !gateway.includes('cancelLogin')
    && !preload.includes('dispatch-auth-begin-login')
    && !preload.includes('dispatch-auth-poll-login')
    && !preload.includes('dispatch-auth-cancel-login'),
  '主进程与 preload 已删除独立调度二维码生成、轮询和取消接口');
  check(!fs.existsSync(path.join(root, 'vue/src/modules/dispatch/components/DispatchLoginDialog.vue'))
    && !fs.existsSync(path.join(bossRoot, 'lib/desktopDispatchLogin.js')),
  '桌面派单二次登录弹窗与 Boss 调度扫码工具均不存在');
  check(!serverAuthController.includes('/challenges')
    && !serverAuthController.includes('mobileApprove')
    && !serverAuthService.includes('createChallenge')
    && !serverAuthService.includes('exchangeChallenge')
    && serverAuthController.includes('value = "/me"')
    && serverAuthController.includes('value = "/logout"'),
  '服务端删除二次扫码挑战链路，只保留原桌面登录自动签发后的会话校验和退出');
  check(tileMap.includes('reportTileFailure')
    && tileMap.includes('TRANSPARENT_TILE_B64')
    && tileMap.includes("emit('unavailable', error)"),
  '并发瓦片鉴权失败会统一降级，不再为每张瓦片重复抛出登录错误');

  const parityMethods = [
    'checkInDriver',
    'checkOutDriver',
    'updateStopTimeWindow',
    'returnStopToSandbox',
    'loadManualDispatchPanorama',
    'departDriver',
    'completeDeliveryStop',
    'returnDeliveryStopToSandbox',
    'previewRouteReassignment',
    'confirmRouteReassignment',
    'releaseRoutePreview',
  ];
  parityMethods.forEach((method) => {
    check(gateway.includes(method) && preload.includes(method) && dispatchStore.includes(method),
      `${method} 已贯通 gateway、preload 与 Vuex`);
  });
  check(main.includes('dispatch-driver-duty-on')
    && main.includes('dispatch-update-stop-time-window')
    && main.includes('dispatch-return-stop-to-sandbox')
    && main.includes('dispatch-depart-driver')
    && main.includes('dispatch-complete-delivery-stop')
    && main.includes('dispatch-release-route-preview')
    && main.includes('dispatch-confirm-route-reassignment'),
  '主进程逐项注册 Boss 派单动作 IPC，不提供任意网络代理');

  const sandboxRoute = {
    driverUserId: 314,
    _phase: 'dispatch',
    _routeEditPayload: {
      routeResourceType: 'DISPATCH_SANDBOX',
      sandboxEditCredential: 'test-sandbox-credential',
      canonicalSandboxVersion: 'SANDBOX_V1:test',
      sandboxStateFingerprint: 'test-state-fingerprint',
      sandboxCredentialExpiresAt: 1787844063260,
      sourcePage: 'DISPATCH_SANDBOX',
    },
  };
  const preview = contract.buildRoutePreviewPayload({
    route: sandboxRoute,
    stopKeys: [],
    routeDate: '2026-08-26',
    batchCode: 'MORNING',
  });
  check(Array.isArray(preview.stopKeys) && preview.stopKeys.length === 0,
    '首次读取允许空页面列表，但不会推断任何客户被人工删除');
  check(!Object.hasOwn(preview, 'removedStopKeys')
    && preview.routeResourceType === 'DISPATCH_SANDBOX'
    && preview.sandboxEditCredential === 'test-sandbox-credential',
  '沙箱路线携带服务端签发资源，普通 stopKeys 差异不产生删除语义');

  const explicitRemoval = contract.buildRoutePreviewPayload({
    route: sandboxRoute,
    stopKeys: ['dep:1'],
    removedStopKeys: ['dep:2'],
    removalCommandId: 'owner-remove-test-1',
    routeDate: '2026-08-26',
    batchCode: 'MORNING',
  });
  check(explicitRemoval.removedStopKeys.join(',') === 'dep:2'
    && explicitRemoval.removalCommandId === 'owner-remove-test-1',
  '人工删除只能通过 removedStopKeys 与独立 command id 明确表达');

  const emptyConfirm = contract.buildRouteEditConfirmPayload({
    route: {
      driverUserId: 314,
      driverRouteId: 88,
      routeVersion: 4,
      _routeEditPayload: {
        routeResourceType: 'FORMAL_DRIVER_ROUTE',
        driverRouteId: 88,
        routeVersion: 4,
      },
      _stops: [{ sandboxStopKey: 'TASK:1', taskId: 1, taskVersion: 3, liveOrderIds: [9] }],
    },
    stops: [],
    stopKeys: [],
    routeDate: '2026-08-26',
    batchCode: 'MORNING',
    previewToken: 'preview-token',
  });
  check(Array.isArray(emptyConfirm.stopKeys) && emptyConfirm.stopKeys.length === 0
    && emptyConfirm.expectedTaskVersions.length === 1
    && emptyConfirm.routeResourceType === 'FORMAL_DRIVER_ROUTE'
    && emptyConfirm.driverRouteId === 88,
  '正式空路线确认绑定精确 driverRouteId，同时保留原任务版本并发校验');

  const expansion = contract.buildRouteExpansionPayload({
    route: sandboxRoute,
    routeDate: '2026-08-26',
    batchCode: 'MORNING',
    previewToken: 'preview-token',
    maxActiveRouteDurationS: 10800,
    latestRouteFinishAt: '2026-08-26T10:30:00+08:00',
    maxRoadDistanceM: 30000,
    maxAddedStops: 4,
  });
  check(expansion.maxActiveRouteDurationS === 10800
    && expansion.latestRouteFinishAt === '2026-08-26T10:30:00+08:00'
    && expansion.maxRoadDistanceM === 30000
    && expansion.maxAddedStops === 4
    && !Object.hasOwn(expansion, 'sandboxCredentialExpiresAt')
    && !Object.hasOwn(expansion, 'candidatePolicy')
    && !Object.hasOwn(expansion, 'operatorUserId'),
  'AI增补四项硬约束完整发送，页面凭据有效期、候选策略和操作人身份不进入试算DTO');

  const releasePreview = contract.buildRoutePreviewReleasePayload({
    route: sandboxRoute,
    routeDate: '2026-08-26',
    batchCode: 'MORNING',
    previewToken: 'preview-token',
  });
  check(releasePreview.previewToken === 'preview-token'
    && releasePreview.driverUserId === 314
    && releasePreview.routeResourceType === 'DISPATCH_SANDBOX'
    && !Object.hasOwn(releasePreview, 'sandboxCredentialExpiresAt'),
  '释放preview合同保留可信沙箱scope并剥离页面辅助过期字段');

  const remoteDelete = contract.buildReturnStopToSandboxCommand({
    stop: { deliveryStopId: 101 },
    routeDate: '2026-08-26',
    batchCode: 'MORNING',
  });
  check(remoteDelete.deliveryStopId === 101
    && remoteDelete.payload.suppressTodayResponse === true,
  '装车中移除使用 Boss REMOTE 合同并由服务端判断是否形成空路线');

  const manual = contract.buildManualDispatchPayload({
    payload: {
      disId: 56,
      operatorUserId: 1,
      departmentId: 7,
      sandboxStopKey: 'DEP:7',
      liveOrderIds: [1, 2],
      driverPanoramaPath: '/ignored',
    },
  }, '2026-08-26', 'MORNING');
  check(manual.departmentId === 7 && manual.sandboxStopKey === 'DEP:7'
    && !Object.hasOwn(manual, 'disId') && !Object.hasOwn(manual, 'operatorUserId')
    && !Object.hasOwn(manual, 'driverPanoramaPath'),
  '人工调度复用司机全景业务字段，同时剥离身份和动态路径');

  const timeWindow = contract.buildStopTimeWindowPayload({
    action: { payload: { deliveryStopId: 101, customerName: '测试客户' } },
    form: { earliestTime: '08:30', latestTime: '10:00', reason: '老板调整' },
    routeDate: '2026-08-26',
    batchCode: 'MORNING',
    phase: 'loading',
  });
  check(timeWindow.earliestDeliveryTimeS === 30600
    && timeWindow.latestDeliveryTimeS === 36000
    && timeWindow.responsePage === 'LOADING',
  '时间窗字段和装车回刷合同与 Boss 一致');

  const reassignPreview = contract.buildRouteReassignmentPreviewPayload({
    route: {
      _phase: 'loading',
      driverUserId: 314,
      driverRouteId: 88,
      routeVersion: 5,
      _stops: [{ sandboxStopKey: 'TASK:1' }, { sandboxStopKey: 'TASK:2' }],
    },
    candidate: { driverUserId: 315 },
    routeDate: '2026-08-26',
    batchCode: 'MORNING',
  });
  const reassignConfirm = contract.buildRouteReassignmentConfirmPayload({
    previewPayload: reassignPreview,
    previewPage: { previewToken: 'reassign-token', driver: { driverRouteId: 88, routeVersion: 5 } },
  });
  check(reassignConfirm.targetDriverUserId === 315
    && reassignConfirm.driverRouteId === 88
    && reassignConfirm.stopKeys.join(',') === 'TASK:1,TASK:2',
  '装车整条路线更换司机保留 routeId 和客户顺序，并使用 previewToken');

  check(workbench.includes('DispatchDutyDialog')
    && workbench.includes('DispatchTimeWindowDialog')
    && workbench.includes('ManualDispatchDialog')
    && workbench.includes('executePageAction'),
  '工作台接入司机管理、时间窗、人工调度和服务端动作分发');
  check(workbench.includes("'CONFIRM_SANDBOX_STOP'")
    && workbench.includes("'CONFIRM_ASSIGN'")
    && workbench.includes("type === 'RETURN_TO_DISPATCH'")
    && workbench.includes("await selectPhase('dispatch')"),
  '沙箱状态动作保持无操作，装车调整路线只切回分派页而不误开编辑器');
  check(routeEditor.includes("props.route._phase === 'loading'")
    && routeEditor.includes("dispatch/returnStopToSandbox")
    && routeEditor.includes('reassignDriverCandidates'),
  '路线编辑区分 LOCAL/REMOTE 删除并支持装车路线更换司机');
  check(routeEditor.includes('maxActiveRouteDurationS')
    && routeEditor.includes('latestRouteFinishAt')
    && routeEditor.includes('maxRoadDistanceM')
    && routeEditor.includes('maxAddedStops')
    && routeEditor.includes('route-editor__map-viewport')
    && routeEditor.includes('.dispatch-huawei-map__canvas')
    && routeEditor.includes("policy !== 'SANDBOX_REBALANCE'"),
  '桌面AI增补四项约束固定显示在受控地图下方，且只接受服务端沙箱重平衡策略');
  check(routeEditor.includes('pendingRemovedStopKeys')
    && routeEditor.includes('pendingRemovalCommandId')
    && routeEditor.includes("if (context === 'page')")
    && routeEditor.includes('当前编辑内容仍保留'),
  '桌面人工删除使用明确命令，重新计算遇到409时保留编辑内容而不关窗');
  check(routeEditor.includes('route-editor__driver-lock')
    && routeEditor.includes('candidateLockLabel')
    && routeEditor.includes('保存改派后自动取消'),
  '路线编辑候选和已加入站点明显显示司机锁，并说明确认改派后自动取消旧锁');
  check(controlPanel.includes('visibleStopActions')
    && controlPanel.includes("$emit('execute-action'")
    && controlPanel.includes('windowRequirementLabel')
    && controlPanel.includes('serviceDurationLabel')
    && controlPanel.includes('returnToDepotRequired')
    && controlPanel.includes('v-if="routes.length"')
    && controlPanel.includes("'is-single': routes.length === 1")
    && controlPanel.includes("'CONFIRM_SANDBOX_STOP'")
    && controlPanel.includes("stop?._phase === 'dispatch' && type === 'RETURN_TO_SANDBOX'"),
  '单条或多条路线都显示司机卡，并渲染服务端动作、时间窗、卸货时长和兼职/专职终点');
  check(dutyDialog.includes('canToggleDuty')
    && timeDialog.includes('latestTime')
    && manualDialog.includes('canSimulate'),
  '三个面板分别遵循 Boss 的服务端可用性、时间窗必填和司机试算门禁');

  const interceptor = readFrom(
    serverRoot,
    'src/main/java/com/nongxinle/distribute/dispatch/security/DesktopDispatchAuthInterceptor.java'
  );
  check(interceptor.includes('/api/nxdisroutedispatch/')
    && interceptor.includes('requireLegacyPermissionIfNeeded')
    && interceptor.includes('/depart-now')
    && interceptor.includes('/complete-now'),
  'Boss 兼容写接口由服务端桌面 Bearer 鉴权和权限门禁保护');

  if (failures > 0) {
    console.error(`Dispatch parity smoke failed: ${failures}`);
    process.exit(1);
  }
  console.log('Dispatch parity smoke passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
