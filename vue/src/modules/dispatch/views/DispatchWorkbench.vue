<template>
  <main class="dispatch-workbench" aria-label="桌面调度工作台">
    <Teleport to="#product-header-context">
      <nav class="dispatch-phase-tabs" aria-label="配送阶段">
        <button
          v-for="phase in phaseOptions"
          :key="phase.key"
          type="button"
          :class="{ active: activePhase === phase.key }"
          @click="selectPhase(phase.key)"
        >
          <span>{{ phase.short }}</span>
          <strong>{{ phase.label }}</strong>
          <em>{{ phase.count }}</em>
        </button>
      </nav>
    </Teleport>

    <header class="dispatch-toolbar">
      <div class="dispatch-toolbar__summary">
        <span>{{ historicalPlan ? '历史计划' : '今日路线' }}</span>
        <strong>{{ activeRouteDateLabel }}</strong>
        <small>{{ activeRoutes.length }} 条路线 · {{ activeStopCount }} 个客户</small>
      </div>

      <dl class="dispatch-toolbar__metrics">
        <div>
          <dt>司机</dt>
          <dd>{{ activeMetrics?.driverCount ?? activeRoutes.length }}</dd>
        </div>
        <div>
          <dt>客户</dt>
          <dd>{{ activeMetrics?.customerStopCount ?? activeStopCount }}</dd>
        </div>
        <div>
          <dt>里程</dt>
          <dd>{{ activeMetrics?.totalDistanceText || '—' }}</dd>
        </div>
        <div>
          <dt>时长</dt>
          <dd>{{ activeMetrics?.totalDurationText || '—' }}</dd>
        </div>
      </dl>

      <div class="dispatch-toolbar__actions">
        <span :class="refreshTone"><i></i>{{ refreshLabel }} · {{ updatedLabel }}</span>
        <button
          v-if="authSession?.authenticated"
          type="button"
          class="session-button"
          title="退出桌面调度登录"
          @click="logoutDispatch"
        >
          {{ sessionRoleLabel }}
        </button>
        <button
          v-else
          type="button"
          class="login-button"
          @click="goToOriginalLogin"
        >
          扫码登录
        </button>
        <button
          type="button"
          :disabled="isReading"
          title="只重新读取服务端数据"
          @click="refresh"
        >
          <span :class="{ spinning: isReading }">↻</span>
          刷新
        </button>
      </div>
    </header>

    <section
      v-if="feedback.message"
      class="dispatch-workbench__feedback"
      :class="`is-${feedback.tone}`"
      role="status"
    >
      <strong>{{ feedback.title }}</strong>
      <span>{{ feedback.message }}</span>
      <button type="button" aria-label="关闭提示" @click="clearFeedback">×</button>
    </section>

    <section v-if="warningItems.length" class="dispatch-workbench__warning" aria-label="数据读取提示">
      <div>
        <strong>部分数据暂未更新</strong>
        <span v-for="warning in warningItems" :key="warning.key">
          {{ warning.label }}：{{ warning.error }}
        </span>
      </div>
      <button type="button" :disabled="isReading" @click="refresh">重新读取</button>
    </section>

    <section class="dispatch-workbench__layout">
      <section class="dispatch-map-panel" aria-label="配送路线地图">
        <div class="dispatch-map-panel__header">
          <div>
            <h2>路线地图</h2>
            <p>{{ historicalPlan ? '当前显示历史计划，迟到时间不再按今天计算。' : activePhaseCopy.mapHint }}</p>
          </div>
          <strong v-if="selectedRoute">
            {{ selectedRoute.driverName || '当前司机' }} · {{ selectedRoute._stops.length }} 站
          </strong>
        </div>

        <div v-if="activeSnapshot.status === 'loading' && !activeMapOverview.markers" class="dispatch-map-panel__state">
          <span class="dispatch-map-panel__spinner"></span>
          <strong>正在读取路线</strong>
        </div>
        <HuaweiDispatchMap
          v-else
          prominent
          :map-overview="activeMapOverview"
          :selected-stop="selectedStop"
          :selected-driver-user-id="selectedDriverUserId"
          @select-marker="selectMarker"
          @select-line="selectMapLine"
        />
      </section>

      <DispatchControlPanel
        :active-phase="activePhase"
        :routes="activeRoutes"
        :unassigned-stops="unassignedStops"
        :selected-route-key="selection.routeKey"
        :selected-stop-key="selectedStop?._stopKey || null"
        :selected-stop="selectedStop"
        :map-overview="activeMapOverview"
        :can-assign-driver="canAssignDriver"
        :can-edit-route="canEditRoute"
        :can-confirm-dispatch="canConfirmDispatch"
        :submitting="isSubmitting"
        :historical-plan="historicalPlan"
        :action-hint="dispatchActionHint"
        @select-route="selectRoute"
        @select-stop="selectStop"
        @assign-driver="openDriverDialog"
        @edit-route="openRouteEditor"
        @confirm-dispatch="openConfirmDialog"
      />
    </section>

    <DriverSelectDialog
      v-if="driverDialogVisible && selectedStop"
      :stop="selectedStop"
      :drivers="driverRows"
      :submitting="isSubmitting"
      @close="driverDialogVisible = false"
      @confirm="submitDriverDialog"
    />

    <DispatchRouteEditDialog
      v-if="routeEditorRoute"
      :route="routeEditorRoute"
      :route-date="routeDateForWrite()"
      :batch-code="snapshots.dispatch?.pageViewModel?.batchCode || dispatchState.context.batchCode"
      :initial-map-overview="activeMapOverview"
      :planning="planning"
      @close="routeEditorRoute = null"
      @saved="handleRouteSaved"
      @changed="refresh"
    />

    <div
      v-if="confirmDialogRoute"
      class="confirm-backdrop"
      role="presentation"
      @mousedown.self="confirmDialogRoute = null"
    >
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dispatch-title">
        <span>确认派单</span>
        <h2 id="confirm-dispatch-title">{{ confirmDialogRoute.driverName || '所选司机' }}的配送路线</h2>
        <p>
          将按服务端当前顺序提交 {{ confirmDialogRoute._stops.length }} 个客户站点。
          服务端会再次校验并决定是否进入装车阶段。
        </p>
        <div>
          <button type="button" :disabled="isSubmitting" @click="confirmDialogRoute = null">取消</button>
          <button type="button" class="primary" :disabled="isSubmitting" @click="submitDispatchConfirmation">
            {{ isSubmitting ? '服务端确认中…' : '确认派单' }}
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
import HuaweiDispatchMap from '@/modules/map/components/HuaweiStyledDispatchMap.vue';
import DispatchControlPanel from '../components/DispatchControlPanel.vue';
import DispatchRouteEditDialog from '../components/DispatchRouteEditDialog.vue';
import DriverSelectDialog from '../components/DriverSelectDialog.vue';
import {
  buildDriverRows,
  buildOrderCollections,
  findStopBySelection,
  findStopForMarker,
} from '../services/readModel';
import {
  DISPATCH_PERMISSIONS,
  buildAssignDriverPayload,
  buildConfirmDispatchPayload,
  dispatchErrorPresentation,
  hasDispatchPermission,
} from '../services/writeContract';

const store = useStore();
const router = useRouter();
let refreshTimer = null;
const driverDialogVisible = ref(false);
const confirmDialogRoute = ref(null);
const routeEditorRoute = ref(null);
const feedback = reactive({
  title: '',
  message: '',
  tone: 'success',
});

const dispatchState = computed(() => store.state.dispatch);
const snapshots = computed(() => dispatchState.value.snapshots);
const activePhase = computed(() => dispatchState.value.context.activePhase);
const selection = computed(() => dispatchState.value.selection);
const authSession = computed(() => dispatchState.value.auth.session);
const sessionRoleLabel = computed(() => {
  if (!authSession.value?.authenticated) return '';
  if (hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.routeEdit)) {
    return '老板 · 可编辑';
  }
  return '只读登录';
});
const commandState = computed(() => dispatchState.value.command);
const activeSnapshot = computed(() => (
  snapshots.value[activePhase.value] || {
    status: 'idle',
    pageViewModel: null,
    error: null,
  }
));
const orderCollections = computed(() => buildOrderCollections(
  snapshots.value,
  snapshots.value.customers?.data
));
const driverRows = computed(() => buildDriverRows(
  snapshots.value.drivers?.data,
  snapshots.value
));
const activeRoutes = computed(() => orderCollections.value.routes[activePhase.value] || []);
const selectedStop = computed(() => findStopBySelection(orderCollections.value, selection.value));
const selectedRoute = computed(() => activeRoutes.value.find(
  (route) => route._routeKey === selection.value.routeKey
) || null);
const phaseCounts = computed(() => ({
  dispatch: orderCollections.value.routes.dispatch.length,
  loading: orderCollections.value.routes.loading.length,
  delivery: orderCollections.value.routes.delivery.length,
}));
const phaseOptions = computed(() => ([
  { key: 'dispatch', label: '分派中', short: '派', count: phaseCounts.value.dispatch },
  { key: 'loading', label: '装车中', short: '装', count: phaseCounts.value.loading },
  { key: 'delivery', label: '配送中', short: '送', count: phaseCounts.value.delivery },
]));
const activeMetrics = computed(() => activeSnapshot.value.pageViewModel?.topMetrics || null);
const activeMapOverview = computed(() => activeSnapshot.value.pageViewModel?.mapOverview || {});
const planning = computed(() => snapshots.value.dispatch?.pageViewModel?.planning || {});
const activeStopCount = computed(() => activeRoutes.value.reduce(
  (total, route) => total + (route._stops?.length || 0),
  activePhase.value === 'dispatch' ? orderCollections.value.pending.filter((stop) => !stop._driverUserId).length : 0
));
const unassignedStops = computed(() => (
  activePhase.value === 'dispatch'
    ? orderCollections.value.pending.filter((stop) => !stop._driverUserId)
    : []
));
const selectedDriverUserId = computed(() => (
  selectedRoute.value?.driverUserId ?? selectedStop.value?._driverUserId ?? selection.value.driverUserId
));
const activePhaseCopy = computed(() => ({
  dispatch: {
    eyebrow: '电脑自动分派结果',
    title: '分派中',
    hint: '先看路线是否合理，再确认派单',
    mapTitle: '自动分派路线图',
    mapHint: '电脑已经生成道路路线，点击路线或客户可同步查看。',
  },
  loading: {
    eyebrow: '已确认路线',
    title: '装车中',
    hint: '查看司机、客户和装车顺序',
    mapTitle: '装车路线图',
    mapHint: '查看每位司机的客户顺序和装车路线。',
  },
  delivery: {
    eyebrow: '已出发路线',
    title: '配送中',
    hint: '查看实时配送进度',
    mapTitle: '配送执行路线图',
    mapHint: '点击路线或客户查看当前配送进度。',
  },
}[activePhase.value]));
const activeRouteDate = computed(() => (
  activeSnapshot.value.pageViewModel?.routeDate
  || snapshots.value.dispatch?.pageViewModel?.routeDate
  || ''
));
const todayRouteDate = computed(() => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
});
const historicalPlan = computed(() => (
  Boolean(activeRouteDate.value) && activeRouteDate.value !== todayRouteDate.value
));
const activeRouteDateLabel = computed(() => (
  historicalPlan.value ? activeRouteDate.value : '今天'
));
const isReading = computed(() => ['loading', 'refreshing'].includes(dispatchState.value.refresh.status));
const isSubmitting = computed(() => commandState.value.status === 'submitting');
const refreshLabel = computed(() => {
  switch (dispatchState.value.refresh.status) {
    case 'loading': return '正在读取';
    case 'refreshing': return '正在更新';
    case 'partial': return '部分更新';
    case 'error': return '读取失败';
    case 'ready': return '数据已同步';
    default: return '等待同步';
  }
});
const refreshTone = computed(() => (
  ['partial', 'error'].includes(dispatchState.value.refresh.status) ? 'warn' : 'ok'
));
const updatedLabel = computed(() => {
  const value = dispatchState.value.refresh.finishedAt;
  if (!value) return '尚未更新';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚更新';
  return `检查于 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
});
const warningItems = computed(() => {
  const labels = {
    dispatch: '分派中',
    loading: '装车中',
    delivery: '配送中',
    drivers: '司机列表',
    customers: '客户地址',
  };
  return Object.entries(snapshots.value)
    .filter(([, snapshot]) => snapshot.error)
    .map(([key, snapshot]) => ({ key, label: labels[key] || key, error: snapshot.error }));
});
const sessionMatchesDistributer = computed(() => {
  if (!authSession.value?.authenticated) return false;
  const readDisId = store.state.disUser?.nxDiuDistributerId;
  return readDisId != null && String(readDisId) === String(authSession.value.disId);
});
const canAssignDriver = computed(() => (
  activePhase.value === 'dispatch'
  && Boolean(selectedStop.value)
  && sessionMatchesDistributer.value
  && hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.assignDriver)
));
const canConfirmDispatch = computed(() => (
  activePhase.value === 'dispatch'
  && Boolean(selectedRoute.value?._stops?.length)
  && sessionMatchesDistributer.value
  && hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.confirmDispatch)
));
const canEditRoute = computed(() => (
  activePhase.value === 'dispatch'
  && Boolean(selectedRoute.value?._stops?.length)
  && sessionMatchesDistributer.value
  && hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.routeEdit)
  && hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.confirmDispatch)
));
const dispatchActionHint = computed(() => {
  if (activePhase.value !== 'dispatch') return '';
  if (!authSession.value?.authenticated) return '扫码登录后可以调整路线、更换司机和确认派单。';
  if (!sessionMatchesDistributer.value) return '当前扫码账号与配送商不一致，请重新登录。';
  if (!hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.confirmDispatch)) {
    return '当前账号没有确认派单权限。';
  }
  if (!hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.routeEdit)) {
    return '当前账号没有调整路线权限。';
  }
  return '';
});

function commitSelection(stop, extras = {}) {
  store.commit('dispatch/SET_SELECTION', {
    driverUserId: stop?._driverUserId ?? extras.driverUserId ?? null,
    stopKey: stop?._stopKey ?? null,
    deliveryStopId: stop?.deliveryStopId ?? null,
    routeKey: stop?._routeKey ?? extras.routeKey ?? null,
  });
}

function selectStop(stop) {
  if (!stop) return;
  if (stop._phase && stop._phase !== activePhase.value) {
    store.commit('dispatch/SET_ACTIVE_PHASE', stop._phase);
  }
  commitSelection(stop);
}

function selectRoute(route) {
  if (!route) return;
  const firstStop = route._stops?.[0] || null;
  commitSelection(firstStop, {
    driverUserId: route.driverUserId,
    routeKey: route._routeKey,
  });
}

async function selectPhase(phase) {
  store.commit('dispatch/SET_ACTIVE_PHASE', phase);
  store.commit('dispatch/CLEAR_SELECTION');
  await nextTick();
  ensureSelection();
}

async function selectDriver(driver) {
  if (!driver) return;
  if (driver._phase && driver._phase !== activePhase.value) {
    store.commit('dispatch/SET_ACTIVE_PHASE', driver._phase);
    await nextTick();
  }
  const matchingRoute = activeRoutes.value.find(
    (route) => String(route.driverUserId) === String(driver.driverUserId)
  );
  if (matchingRoute) {
    selectRoute(matchingRoute);
    return;
  }
  commitSelection(null, { driverUserId: driver.driverUserId, routeKey: null });
}

function selectMarker(marker) {
  const stop = findStopForMarker(orderCollections.value, marker, activePhase.value);
  if (stop) selectStop(stop);
}

function selectMapLine(line) {
  if (!line) return;
  const route = activeRoutes.value.find(
    (item) => item.driverUserId != null
      && line.driverUserId != null
      && String(item.driverUserId) === String(line.driverUserId)
  );
  if (route) selectRoute(route);
}

function ensureSelection() {
  if (selectedStop.value) return;
  const firstRouteStop = activeRoutes.value.find((route) => route._stops?.length)?._stops?.[0];
  const firstStop = firstRouteStop
    || (activePhase.value === 'dispatch' ? orderCollections.value.pending[0] : null);
  if (firstStop) {
    commitSelection(firstStop);
  }
}

async function refresh() {
  await store.dispatch('dispatch/loadWorkbench');
  ensureSelection();
}

function clearFeedback() {
  feedback.title = '';
  feedback.message = '';
  feedback.tone = 'success';
}

function showFeedback(title, message, tone = 'success') {
  feedback.title = title;
  feedback.message = message;
  feedback.tone = tone;
}

function requireLoginOrPermission(permission, actionLabel) {
  if (!authSession.value?.authenticated) {
    goToOriginalLogin();
    showFeedback('需要登录', `请先手机扫码登录，再${actionLabel}`, 'warning');
    return false;
  }
  if (!sessionMatchesDistributer.value) {
    showFeedback('账号不匹配', '扫码账号不属于当前配送商，请退出后重新扫码', 'error');
    return false;
  }
  if (!hasDispatchPermission(authSession.value, permission)) {
    showFeedback('权限不足', `当前账号无权${actionLabel}`, 'error');
    return false;
  }
  return true;
}

function openDriverDialog() {
  if (!selectedStop.value) {
    showFeedback('请选择订单', '请先在左侧选择需要分配司机的待派订单', 'warning');
    return;
  }
  if (!requireLoginOrPermission(DISPATCH_PERMISSIONS.assignDriver, '分配司机')) return;
  driverDialogVisible.value = true;
}

function openConfirmDialog() {
  if (!selectedRoute.value) {
    showFeedback('请选择路线', '请先在中间工作区选择需要确认的司机路线', 'warning');
    return;
  }
  if (!requireLoginOrPermission(DISPATCH_PERMISSIONS.confirmDispatch, '确认派单')) return;
  confirmDialogRoute.value = selectedRoute.value;
}

function openRouteEditor(route) {
  if (!route) {
    showFeedback('请选择路线', '请先选择需要调整的司机路线', 'warning');
    return;
  }
  if (!requireLoginOrPermission(DISPATCH_PERMISSIONS.routeEdit, '调整路线')) return;
  if (!hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.confirmDispatch)) {
    showFeedback('权限不足', '当前账号可以预览路线，但没有保存路线的权限', 'error');
    return;
  }
  routeEditorRoute.value = route;
}

async function handleRouteSaved() {
  const driverName = routeEditorRoute.value?.driverName || '所选司机';
  routeEditorRoute.value = null;
  showFeedback('路线调整成功', `${driverName}的客户顺序已经保存`, 'success');
  await refresh();
}

function routeDateForWrite() {
  const value = snapshots.value.dispatch?.pageViewModel?.routeDate;
  if (value) return value;
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function targetRouteForDriver(driverUserId) {
  return orderCollections.value.routes.dispatch.find(
    (route) => String(route.driverUserId) === String(driverUserId)
  ) || null;
}

async function handleCommandResult(result, successTitle, successMessage) {
  if (result?.ok) {
    showFeedback(successTitle, successMessage, 'success');
    await refresh();
    return true;
  }
  const presentation = dispatchErrorPresentation(result);
  showFeedback('操作未完成', presentation.message, presentation.tone);
  if (presentation.loginRequired) goToOriginalLogin();
  if (presentation.refresh) await refresh();
  return false;
}

async function submitDriverAssignment(driver) {
  try {
    const payload = buildAssignDriverPayload({
      stop: selectedStop.value,
      driver,
      targetRoute: targetRouteForDriver(driver.driverUserId),
      routeDate: routeDateForWrite(),
      batchCode: snapshots.value.dispatch?.pageViewModel?.batchCode
        || dispatchState.value.context.batchCode,
    });
    const result = await store.dispatch('dispatch/assignDriver', payload);
    const success = await handleCommandResult(
      result,
      '司机分配成功',
      `${selectedStop.value?.customerName || '客户'}已交由服务端分配给${driver.driverName || '所选司机'}`
    );
    if (success) driverDialogVisible.value = false;
  } catch (error) {
    showFeedback('无法提交', error?.message || '分配司机参数不完整', 'error');
  }
}

async function submitDriverDialog(driver) {
  await submitDriverAssignment(driver);
}

async function submitDispatchConfirmation() {
  const route = confirmDialogRoute.value;
  try {
    const payload = buildConfirmDispatchPayload({
      route,
      routeDate: routeDateForWrite(),
      batchCode: snapshots.value.dispatch?.pageViewModel?.batchCode
        || dispatchState.value.context.batchCode,
    });
    const result = await store.dispatch('dispatch/confirmDispatch', payload);
    const success = await handleCommandResult(
      result,
      '派单确认成功',
      `${route.driverName || '所选司机'}的路线已由服务端确认`
    );
    if (success) confirmDialogRoute.value = null;
  } catch (error) {
    showFeedback('无法提交', error?.message || '确认派单参数不完整', 'error');
  }
}

function goToOriginalLogin() {
  router.push({
    name: 'Home',
    query: { returnTo: 'DispatchWorkbench' },
  });
}

async function logoutDispatch() {
  await store.dispatch('dispatch/logoutDispatch');
  showFeedback('已退出调度登录', '只读调度信息仍可继续查看', 'success');
}

function refreshWhenVisible() {
  if (document.visibilityState === 'visible' && !isReading.value) {
    refresh();
  }
}

watch(
  () => [
    activePhase.value,
    activeRoutes.value.length,
    orderCollections.value.pending.length,
  ],
  ensureSelection
);

onMounted(async () => {
  await Promise.all([
    store.dispatch('dispatch/restoreAuth'),
    refresh(),
  ]);
  refreshTimer = window.setInterval(refreshWhenVisible, 60_000);
  window.addEventListener('focus', refreshWhenVisible);
});

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer);
  window.removeEventListener('focus', refreshWhenVisible);
  store.dispatch('dispatch/cancelRead');
  store.commit('dispatch/CLEAR_COMMAND');
});
</script>

<style scoped>
:global(body) {
  min-width: 1180px;
  overflow: hidden;
  background: var(--product-bg);
}

:global(#app),
:global(#app-container) {
  min-height: 100vh;
}

.dispatch-workbench {
  box-sizing: border-box;
  display: flex;
  height: 100%;
  min-width: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 14px 16px 16px;
  color: #172033;
  background:
    radial-gradient(circle at 15% 0, rgba(202, 220, 242, .42), transparent 33%),
    #eef3f8;
}

.dispatch-workbench__header {
  display: grid;
  grid-template-columns: minmax(300px, 1fr) auto minmax(260px, 1fr);
  gap: 18px;
  align-items: center;
  flex: none;
  padding: 10px 14px;
  border: 1px solid #dbe4ed;
  border-radius: 15px;
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 6px 24px rgba(36, 57, 84, .04);
}

.dispatch-workbench__identity {
  display: flex;
  align-items: center;
  gap: 11px;
}

.dispatch-workbench__logo {
  display: grid;
  width: 39px;
  height: 39px;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, #207a58, #13533d);
  box-shadow: 0 5px 14px rgba(24, 107, 77, .2);
  font-weight: 900;
}

.dispatch-workbench__identity h1,
.dispatch-workbench__identity p {
  margin: 0;
}

.dispatch-workbench__identity h1 {
  color: #17253a;
  font-size: 20px;
  line-height: 1.1;
}

.dispatch-workbench__identity p {
  margin-bottom: 4px;
  color: #718196;
  font-size: 10px;
}

.dispatch-workbench__status {
  display: flex;
  align-items: center;
  flex-direction: column;
}

.dispatch-workbench__status > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #257359;
  font-size: 11px;
  font-weight: 800;
}

.dispatch-workbench__status > span.warn {
  color: #a16914;
}

.dispatch-workbench__status i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #20a875;
  box-shadow: 0 0 0 4px rgba(32, 168, 117, .1);
}

.dispatch-workbench__status .warn i {
  background: #d99426;
  box-shadow: 0 0 0 4px rgba(217, 148, 38, .1);
}

.dispatch-workbench__status small {
  margin-top: 3px;
  color: #8a97a8;
  font-size: 9px;
}

.dispatch-workbench__header-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dispatch-workbench__header-actions button,
.dispatch-workbench__header-actions a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  border: 1px solid #cfd9e4;
  border-radius: 9px;
  color: #52657d;
  background: #fff;
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.dispatch-workbench__header-actions a {
  border-color: #2b65b4;
  color: #fff;
  background: #2b65b4;
}

.dispatch-workbench__header-actions .login-button {
  border-color: #277255;
  color: #fff;
  background: #277255;
}

.dispatch-workbench__header-actions .session-button {
  border-color: #b8d7cb;
  color: #276b53;
  background: #eef8f4;
}

.dispatch-workbench__header-actions button:disabled {
  cursor: wait;
  opacity: .65;
}

.dispatch-workbench__header-actions .spinning {
  animation: refresh-spin .8s linear infinite;
}

.dispatch-workbench__guardrail {
  display: flex;
  gap: 9px;
  align-items: center;
  flex: none;
  margin-top: 8px;
  padding: 7px 12px;
  border: 1px solid #d6e1eb;
  border-radius: 10px;
  color: #66778e;
  background: rgba(247, 250, 252, .9);
  font-size: 10px;
}

.dispatch-workbench__guardrail strong {
  padding: 3px 7px;
  border-radius: 99px;
  color: #246b50;
  background: #e3f4ed;
  font-size: 9px;
}

.dispatch-workbench__guardrail em {
  margin-left: auto;
  color: #7d8b9c;
  font-size: 9px;
  font-style: normal;
}

.dispatch-workbench__command-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex: none;
  margin-top: 8px;
  padding: 8px 10px 8px 13px;
  border: 1px solid #d8e3ed;
  border-radius: 11px;
  background: #fff;
}

.dispatch-workbench__command-bar > div {
  display: flex;
  align-items: center;
  gap: 9px;
}

.dispatch-workbench__command-bar strong {
  color: #26384f;
  font-size: 11px;
}

.dispatch-workbench__command-bar span {
  color: #758399;
  font-size: 9px;
}

.dispatch-workbench__command-bar button {
  padding: 7px 12px;
  border: 1px solid #b7c5d4;
  border-radius: 8px;
  color: #4f6177;
  background: #fff;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.dispatch-workbench__command-bar button.primary {
  border-color: #246d52;
  color: #fff;
  background: #246d52;
}

.dispatch-workbench__command-bar button:disabled {
  cursor: not-allowed;
  opacity: .45;
}

.dispatch-workbench__feedback {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  flex: none;
  margin-top: 8px;
  padding: 8px 38px 8px 12px;
  border: 1px solid #add8c8;
  border-radius: 10px;
  color: #276b53;
  background: #effaf6;
  font-size: 10px;
}

.dispatch-workbench__feedback.is-warning {
  border-color: #e9cf91;
  color: #7f5b17;
  background: #fff9e9;
}

.dispatch-workbench__feedback.is-error {
  border-color: #e8b1b1;
  color: #983f3f;
  background: #fff2f2;
}

.dispatch-workbench__feedback button {
  position: absolute;
  top: 3px;
  right: 7px;
  border: 0;
  color: currentColor;
  background: transparent;
  font-size: 19px;
  cursor: pointer;
}

.dispatch-workbench__warning {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex: none;
  margin-top: 8px;
  padding: 8px 12px;
  border: 1px solid #efd49b;
  border-radius: 10px;
  color: #7f5a15;
  background: #fff9e9;
}

.dispatch-workbench__warning > div {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 12px;
}

.dispatch-workbench__warning strong,
.dispatch-workbench__warning span {
  font-size: 9px;
}

.dispatch-workbench__warning button {
  flex: none;
  padding: 5px 9px;
  border: 1px solid #d4aa55;
  border-radius: 7px;
  color: #7d5813;
  background: transparent;
  font-size: 9px;
  cursor: pointer;
}

.dispatch-workbench__layout {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(245px, 285px) minmax(525px, 1fr) minmax(310px, 370px);
  gap: 11px;
  margin-top: 10px;
}

.confirm-backdrop {
  position: fixed;
  z-index: 1000;
  display: grid;
  inset: 0;
  place-items: center;
  padding: 24px;
  background: rgba(14, 25, 40, .56);
  backdrop-filter: blur(5px);
}

.confirm-dialog {
  width: min(430px, 92vw);
  padding: 26px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 24px 80px rgba(9, 22, 40, .28);
}

.confirm-dialog > span {
  color: #287055;
  font-size: 10px;
  font-weight: 800;
}

.confirm-dialog h2 {
  margin: 5px 0 8px;
  color: #1d2c41;
  font-size: 19px;
}

.confirm-dialog p {
  margin: 0;
  color: #6d7d91;
  font-size: 11px;
  line-height: 1.7;
}

.confirm-dialog > div {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 21px;
}

.confirm-dialog button {
  padding: 9px 17px;
  border: 1px solid #d2dbe5;
  border-radius: 9px;
  color: #5d6e83;
  background: #fff;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.confirm-dialog button.primary {
  border-color: #236c51;
  color: #fff;
  background: #236c51;
}

.confirm-dialog button:disabled {
  cursor: wait;
  opacity: .6;
}

@keyframes refresh-spin {
  to { transform: rotate(360deg); }
}

@media (min-width: 1500px) {
  .dispatch-workbench__layout {
    grid-template-columns: 310px minmax(650px, 1fr) 420px;
  }
}

/* 地图主导的调度中控布局 */
.dispatch-workbench {
  padding: 12px 14px 14px;
  background: #f3f7f5;
}

.dispatch-phase-tabs {
  display: flex;
  align-self: stretch;
  gap: 18px;
}

.dispatch-phase-tabs button {
  position: relative;
  display: grid;
  min-width: 118px;
  grid-template-columns: 28px auto auto;
  gap: 7px;
  align-items: center;
  padding: 0 4px;
  border: 0;
  color: #63716c;
  background: transparent;
  cursor: pointer;
}

.dispatch-phase-tabs button::after {
  position: absolute;
  right: 0;
  bottom: -14px;
  left: 0;
  height: 3px;
  border-radius: 99px 99px 0 0;
  background: transparent;
  content: '';
}

.dispatch-phase-tabs button.active {
  color: #0b8358;
}

.dispatch-phase-tabs button.active::after {
  background: #0c9b66;
}

.dispatch-phase-tabs button > span {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border-radius: 8px;
  color: #587169;
  background: #edf3f0;
  font-size: 10px;
  font-weight: 900;
}

.dispatch-phase-tabs button.active > span {
  color: #fff;
  background: #0f9b68;
}

.dispatch-phase-tabs strong {
  font-size: 11px;
  white-space: nowrap;
}

.dispatch-phase-tabs em {
  display: grid;
  min-width: 21px;
  height: 19px;
  place-items: center;
  padding: 0 5px;
  border-radius: 99px;
  color: #677670;
  background: #eef2f0;
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
}

.dispatch-phase-tabs button.active em {
  color: #0d7b55;
  background: #def3ea;
}

.dispatch-toolbar {
  display: grid;
  grid-template-columns: minmax(210px, .8fr) minmax(390px, 1.2fr) auto;
  gap: 22px;
  align-items: center;
  flex: none;
  padding: 10px 14px;
  border: 1px solid #dce6e1;
  border-radius: 12px;
  background: #fff;
}

.dispatch-toolbar__summary {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}

.dispatch-toolbar__summary span {
  color: #17845f;
  font-size: 9px;
  font-weight: 800;
}

.dispatch-toolbar__summary strong {
  color: #1d342c;
  font-size: 14px;
}

.dispatch-toolbar__summary small {
  overflow: hidden;
  color: #87928e;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dispatch-toolbar__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(74px, 1fr));
  margin: 0;
}

.dispatch-toolbar__metrics > div {
  padding: 0 14px;
  border-left: 1px solid #e4ebe7;
}

.dispatch-toolbar__metrics dt {
  color: #8c9793;
  font-size: 8px;
}

.dispatch-toolbar__metrics dd {
  overflow: hidden;
  margin: 3px 0 0;
  color: #344b43;
  font-size: 11px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dispatch-toolbar__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
}

.dispatch-toolbar__actions > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-right: 3px;
  color: #6f7f79;
  font-size: 8px;
  white-space: nowrap;
}

.dispatch-toolbar__actions > span i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #1aa775;
}

.dispatch-toolbar__actions > span.warn i {
  background: #d58a1d;
}

.dispatch-toolbar__actions button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 9px;
  border: 1px solid #ccd9d3;
  border-radius: 8px;
  color: #536961;
  background: #fff;
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
}

.dispatch-toolbar__actions .login-button {
  border-color: #13875f;
  color: #fff;
  background: #13875f;
}

.dispatch-toolbar__actions .session-button {
  color: #187556;
  background: #eef8f4;
}

.dispatch-toolbar__actions button:disabled {
  cursor: wait;
  opacity: .5;
}

.dispatch-toolbar__actions .spinning {
  animation: refresh-spin .8s linear infinite;
}

.dispatch-workbench__feedback,
.dispatch-workbench__warning {
  margin-top: 7px;
}

.dispatch-workbench__layout {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(620px, 1.7fr) minmax(360px, .9fr);
  gap: 10px;
  margin-top: 9px;
}

.dispatch-map-panel {
  box-sizing: border-box;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 14px;
  overflow: hidden;
  border: 1px solid #dce6e1;
  border-radius: 14px;
  background: #fff;
}

.dispatch-map-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex: none;
  margin-bottom: 11px;
}

.dispatch-map-panel__header span,
.dispatch-map-panel__header h2,
.dispatch-map-panel__header p {
  margin: 0;
}

.dispatch-map-panel__header span {
  color: #17845f;
  font-size: 9px;
  font-weight: 800;
}

.dispatch-map-panel__header h2 {
  margin-top: 2px;
  color: #19332a;
  font-size: 17px;
}

.dispatch-map-panel__header p {
  margin-top: 3px;
  color: #89948f;
  font-size: 8px;
}

.dispatch-map-panel__header > strong {
  flex: none;
  padding: 6px 9px;
  border-radius: 8px;
  color: #25634f;
  background: #edf7f3;
  font-size: 9px;
}

.dispatch-map-panel__state {
  display: grid;
  min-height: 0;
  flex: 1;
  place-items: center;
  align-content: center;
  color: #5e736b;
}

.dispatch-map-panel__spinner {
  width: 25px;
  height: 25px;
  margin-bottom: 9px;
  border: 3px solid #d9e8e1;
  border-top-color: #129b68;
  border-radius: 50%;
  animation: refresh-spin .8s linear infinite;
}

@media (min-width: 1500px) {
  .dispatch-workbench__layout {
    grid-template-columns: minmax(760px, 1.8fr) minmax(390px, .82fr);
  }
}

@media (max-width: 1260px) {
  .dispatch-toolbar {
    grid-template-columns: minmax(190px, 1fr) auto;
  }

  .dispatch-toolbar__metrics {
    display: none;
  }

  .dispatch-workbench__layout {
    grid-template-columns: minmax(560px, 1.5fr) minmax(340px, .9fr);
  }
}
</style>
