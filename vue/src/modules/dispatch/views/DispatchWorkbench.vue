<template>
  <main class="dispatch-workbench" aria-label="桌面调度工作台">
    <Teleport to="#product-header-context">
      <div class="dispatch-header-row">
        <header class="dispatch-toolbar">
          <div class="dispatch-toolbar__summary">
            <span>{{ historicalPlan ? '历史运营总览' : '今日运营总览' }}</span>
          </div>

          <dl class="dispatch-toolbar__metrics">
            <div>
              <dd>{{ activeMetrics?.driverCount ?? activeRoutes.length }}</dd>
              <dt>条路线</dt>
            </div>
            <div>
              <dd>{{ activeMetrics?.customerStopCount ?? activeStopCount }}</dd>
              <dt>个饭店部门</dt>
            </div>
            <div>
              <dd>{{ activeMetrics?.totalDistanceText || '—' }}</dd>
              <dt>总里程</dt>
            </div>
            <div>
              <dd>{{ activeMetrics?.totalDurationText || '—' }}</dd>
              <dt>预计时长</dt>
            </div>
          </dl>

          <div class="dispatch-toolbar__actions">
            <button
              v-if="canManageDuty"
              type="button"
              title="管理司机可派状态"
              @click="dutyDialogVisible = true"
            >司机管理</button>
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
      </div>
    </Teleport>

    <nav class="dispatch-phase-tabs" aria-label="配送阶段">
      <button
        v-for="phase in phaseOptions"
        :key="phase.key"
        type="button"
        :class="[{ active: activePhase === phase.key }, `is-${phase.key}`]"
        @click="selectPhase(phase.key)"
      >
        <span>{{ phase.short }}</span>
        <strong>{{ phase.label }}</strong>
        <em>{{ phase.count }}</em>
      </button>
    </nav>

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
            <p v-if="selectedRoute">
              当前路线 · {{ selectedRoute._stops.length }} 站 ·
              {{ selectedRoute.totalRoundTripDistanceText || selectedRoute.totalDistanceText || '路线已生成' }} ·
              {{ selectedRoute.totalRoundTripDurationText || selectedRoute.totalDurationText || '等待时长' }}
            </p>
            <p v-else>{{ historicalPlan ? '当前显示历史计划，迟到时间不再按今天计算。' : activePhaseCopy.mapHint }}</p>
          </div>
          <button type="button" @click="showAllRoutesOnMap">⌗ 显示全部路线</button>
        </div>

        <div v-if="activeSnapshot.status === 'loading' && !activeMapOverview.markers" class="dispatch-map-panel__state">
          <span class="dispatch-map-panel__spinner"></span>
          <strong>正在读取路线</strong>
        </div>
        <HuaweiDispatchMap
          v-else
          :key="`dispatch-map-${mapViewNonce}`"
          prominent
          :map-overview="activeMapOverview"
          :selected-stop="selectedStop"
          :selected-driver-user-id="selectedDriverUserId"
          :authenticated="authSession?.authenticated === true"
          :auth-checking="['unknown', 'checking'].includes(dispatchState.auth.status)"
          @select-marker="selectMarker"
          @select-line="selectMapLine"
          @session-expired="handleDesktopSessionExpired"
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
        @execute-action="executePageAction"
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
      :batch-code="activeSnapshot.pageViewModel?.batchCode || dispatchState.context.batchCode"
      :initial-map-overview="activeMapOverview"
      :planning="planning"
      @close="routeEditorRoute = null"
      @saved="handleRouteSaved"
      @changed="refresh"
      @stale="handleRouteEditorStale"
    />

    <DispatchDutyDialog
      v-if="dutyDialogVisible"
      :drivers="driverRows"
      :submitting="isSubmitting"
      @close="dutyDialogVisible = false"
      @toggle-duty="submitDutyChange"
      @employment="submitEmploymentChange"
    />

    <DispatchTimeWindowDialog
      v-if="timeWindowAction"
      :payload="timeWindowAction.payload"
      :submitting="isSubmitting"
      @close="timeWindowAction = null"
      @confirm="submitTimeWindow"
    />

    <ManualDispatchDialog
      v-if="manualDispatchVisible"
      :page-data="manualDispatchPage"
      :loading="manualDispatchLoading"
      :error="manualDispatchError"
      @close="closeManualDispatch"
      @select-driver="openManualDriverRoute"
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
import DispatchDutyDialog from '../components/DispatchDutyDialog.vue';
import DispatchRouteEditDialog from '../components/DispatchRouteEditDialog.vue';
import DispatchTimeWindowDialog from '../components/DispatchTimeWindowDialog.vue';
import DriverSelectDialog from '../components/DriverSelectDialog.vue';
import ManualDispatchDialog from '../components/ManualDispatchDialog.vue';
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
  buildDeliveryStopCommand,
  buildDepartDriverCommand,
  buildDriverDutyPayload,
  buildDriverEmploymentPayload,
  buildManualDispatchPayload,
  buildReturnStopToSandboxCommand,
  buildStopTimeWindowPayload,
  dispatchErrorPresentation,
  hasDispatchPermission,
} from '../services/writeContract';

const store = useStore();
const router = useRouter();
let refreshTimer = null;
const driverDialogVisible = ref(false);
const confirmDialogRoute = ref(null);
const routeEditorRoute = ref(null);
const dutyDialogVisible = ref(false);
const timeWindowAction = ref(null);
const manualDispatchVisible = ref(false);
const manualDispatchLoading = ref(false);
const manualDispatchPage = ref(null);
const manualDispatchError = ref('');
const mapViewNonce = ref(0);
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
  && !historicalPlan.value
  && Boolean(selectedStop.value)
  && !selectedStop.value?._driverUserId
  && sessionMatchesDistributer.value
  && hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.assignDriver)
));
const canConfirmDispatch = computed(() => (
  activePhase.value === 'dispatch'
  && !historicalPlan.value
  && Boolean(selectedRoute.value?._stops?.length)
  && sessionMatchesDistributer.value
  && hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.confirmDispatch)
));
const canEditRoute = computed(() => (
  ['dispatch', 'loading'].includes(activePhase.value)
  && !historicalPlan.value
  && Boolean(selectedRoute.value)
  && sessionMatchesDistributer.value
  && hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.routeEdit)
  && hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.confirmDispatch)
  && selectedRoute.value?.canEditRoute === true
  && selectedRoute.value?.routeEditAction?.enabled !== false
));
const canManageDuty = computed(() => (
  sessionMatchesDistributer.value
  && hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.dutyManage)
));
const dispatchActionHint = computed(() => {
  if (!['dispatch', 'loading'].includes(activePhase.value)) return '';
  if (!authSession.value?.authenticated) return '桌面登录已失效，请重新登录。';
  if (!sessionMatchesDistributer.value) return '当前登录账号与配送商不一致，请重新登录桌面端。';
  if (!hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.confirmDispatch)) {
    return '当前账号没有确认派单权限。';
  }
  if (!hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.routeEdit)) {
    return '当前账号没有调整路线权限。';
  }
  if (activePhase.value === 'loading') return '装车中路线可调整客户，也可按服务端候选更换整条路线司机。';
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

function showAllRoutesOnMap() {
  mapViewNonce.value += 1;
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
    goToDesktopLogin();
    showFeedback('桌面登录已失效', `请重新登录桌面端，再${actionLabel}`, 'warning');
    return false;
  }
  if (!sessionMatchesDistributer.value) {
    showFeedback('账号不匹配', '当前登录账号不属于该配送商，请退出后重新登录桌面端', 'error');
    return false;
  }
  if (!hasDispatchPermission(authSession.value, permission)) {
    showFeedback('权限不足', `当前账号无权${actionLabel}`, 'error');
    return false;
  }
  return true;
}

function openDriverDialog() {
  if (historicalPlan.value) {
    showFeedback('历史计划只读', 'Boss 派单动作只允许操作今日路线', 'warning');
    return;
  }
  if (!selectedStop.value) {
    showFeedback('请选择订单', '请先在左侧选择需要分配司机的待派订单', 'warning');
    return;
  }
  if (!requireLoginOrPermission(DISPATCH_PERMISSIONS.assignDriver, '分配司机')) return;
  const actionType = String(
    selectedStop.value?.primaryAction?.actionType
      || selectedStop.value?.primaryAction?.action
      || ''
  ).toUpperCase();
  if (actionType === 'START_MANUAL_DISPATCH') {
    openManualDispatch(selectedStop.value.primaryAction);
    return;
  }
  driverDialogVisible.value = true;
}

function openConfirmDialog() {
  if (historicalPlan.value) {
    showFeedback('历史计划只读', '不能确认历史派单路线', 'warning');
    return;
  }
  if (!selectedRoute.value) {
    showFeedback('请选择路线', '请先在中间工作区选择需要确认的司机路线', 'warning');
    return;
  }
  if (!requireLoginOrPermission(DISPATCH_PERMISSIONS.confirmDispatch, '确认派单')) return;
  confirmDialogRoute.value = selectedRoute.value;
}

function openRouteEditor(route) {
  if (historicalPlan.value) {
    showFeedback('历史计划只读', '不能调整历史路线', 'warning');
    return;
  }
  if (!route) {
    showFeedback('请选择路线', '请先选择需要调整的司机路线', 'warning');
    return;
  }
  if (!requireLoginOrPermission(DISPATCH_PERMISSIONS.routeEdit, '调整路线')) return;
  if (!hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.confirmDispatch)) {
    showFeedback('权限不足', '当前账号可以预览路线，但没有保存路线的权限', 'error');
    return;
  }
  if (route.routeEditAction?.enabled === false) {
    showFeedback('当前不可调整', route.routeEditAction.disabledReason || '服务端已锁定这条路线', 'warning');
    return;
  }
  const trustedPayload = route._routeEditPayload || route.routeEditAction?.payload;
  if (!trustedPayload?.routeResourceType) {
    showFeedback('无法打开路线编辑', '服务端未返回可信路线编辑资源，请刷新列表后重试', 'error');
    return;
  }
  routeEditorRoute.value = {
    ...route,
    _routeEditPayload: trustedPayload,
  };
}

async function handleRouteSaved(result) {
  const driverName = routeEditorRoute.value?.driverName || '所选司机';
  routeEditorRoute.value = null;
  const data = result?.data || {};
  if (data.routeReassigned) {
    showFeedback('路线司机已更换', '整条装车路线已交给新司机，客户顺序和路线数据保持不变', 'success');
  } else if (data.routeDeleted || data.exitedLoading) {
    showFeedback('空路线已删除', '最后一家客户已回到待分配区域，空路线不再显示', 'success');
  } else {
    showFeedback('路线调整成功', `${driverName}的客户顺序已经保存`, 'success');
  }
  await refresh();
}

async function handleRouteEditorStale(message) {
  routeEditorRoute.value = null;
  showFeedback('路线状态已更新', message || '路线状态已经变化，请从最新列表重新打开', 'warning');
  await refresh();
}

function routeDateForWrite() {
  const value = activeSnapshot.value.pageViewModel?.routeDate
    || snapshots.value.dispatch?.pageViewModel?.routeDate;
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
  if (presentation.loginRequired) goToDesktopLogin();
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

function actionType(action) {
  return String(action?.actionType || action?.action || '').trim().toUpperCase();
}

function actionPayload(action) {
  return action?.payload && typeof action.payload === 'object' ? action.payload : {};
}

async function openManualDispatch(action) {
  if (!action || action.enabled === false) {
    showFeedback('当前不可人工调度', action?.disabledReason || '服务端未开放该操作', 'warning');
    return;
  }
  if (!requireLoginOrPermission(DISPATCH_PERMISSIONS.assignDriver, '人工调度')) return;
  manualDispatchVisible.value = true;
  manualDispatchLoading.value = true;
  manualDispatchPage.value = null;
  manualDispatchError.value = '';
  try {
    const payload = buildManualDispatchPayload(
      action,
      routeDateForWrite(),
      dispatchState.value.context.batchCode
    );
    const result = await store.dispatch('dispatch/loadManualDispatchPanorama', payload);
    if (!result?.ok) {
      const presentation = dispatchErrorPresentation(result);
      manualDispatchError.value = presentation.message;
      if (presentation.loginRequired) goToDesktopLogin();
      return;
    }
    manualDispatchPage.value = result.data || {};
  } catch (error) {
    manualDispatchError.value = error?.message || '读取人工调度司机列表失败';
  } finally {
    manualDispatchLoading.value = false;
  }
}

function closeManualDispatch() {
  if (manualDispatchLoading.value) return;
  manualDispatchVisible.value = false;
  manualDispatchPage.value = null;
  manualDispatchError.value = '';
}

function openManualDriverRoute(driver) {
  const action = driver?.primaryAction || {};
  if (driver?.canSimulate === false || action.enabled === false) {
    showFeedback('当前不可试算', driver?.blockedReason || action.disabledReason || '目标司机不可用', 'warning');
    return;
  }
  const payload = actionPayload(action);
  if (!payload.driverUserId || !Array.isArray(payload.stopKeys)) {
    showFeedback('请求数据不完整', '服务端未返回司机路线试算参数，请刷新后重试', 'error');
    return;
  }
  const stopByKey = new Map(orderCollections.value.pending.map((stop) => [
    String(stop.sandboxStopKey || stop.stopKey || ''),
    stop,
  ]));
  const routeStops = payload.stopKeys.map((key, index) => {
    const normalizedKey = String(key || '').trim();
    return stopByKey.get(normalizedKey) || {
      sandboxStopKey: normalizedKey,
      stopKey: normalizedKey,
      _stopKey: normalizedKey || `manual-stop-${index}`,
      customerName: `客户${index + 1}`,
      liveOrderIds: [],
    };
  });
  routeEditorRoute.value = {
    ...driver,
    driverUserId: payload.driverUserId,
    driverName: driver.driverName,
    driverRouteId: driver.driverRouteId ?? null,
    routeVersion: driver.routeVersion ?? 0,
    _phase: 'dispatch',
    _routeKey: `dispatch:manual:${payload.driverUserId}`,
    _stops: routeStops,
    _routeEditPayload: payload,
  };
  manualDispatchVisible.value = false;
}

async function submitTimeWindow(form) {
  if (!timeWindowAction.value) return;
  try {
    const payload = buildStopTimeWindowPayload({
      action: timeWindowAction.value.action,
      form,
      routeDate: routeDateForWrite(),
      batchCode: activeSnapshot.value.pageViewModel?.batchCode || dispatchState.value.context.batchCode,
      phase: activePhase.value,
    });
    const result = await store.dispatch('dispatch/updateStopTimeWindow', payload);
    const success = await handleCommandResult(
      result,
      '送达时间已更新',
      `${timeWindowAction.value.payload?.customerName || '所选客户'}的当日送达时间已保存`
    );
    if (success) timeWindowAction.value = null;
  } catch (error) {
    showFeedback('无法保存', error?.message || '送达时间参数不完整', 'error');
  }
}

async function submitDutyChange({ driver, dutyOn }) {
  if (!requireLoginOrPermission(DISPATCH_PERMISSIONS.dutyManage, '管理司机可派状态')) return;
  if (driver.canToggleDuty === false) {
    showFeedback('当前不可操作', driver.toggleDisabledReason || '服务端已锁定司机状态', 'warning');
    return;
  }
  const verb = dutyOn ? '开启' : '关闭';
  const content = dutyOn
    ? `${verb}后，“${driver.driverName || '该司机'}”会持续保持可派，直到手动关闭。确认开启？`
    : `${verb}后，系统不会再给“${driver.driverName || '该司机'}”派单。确认关闭？`;
  if (!window.confirm(content)) return;
  const payload = buildDriverDutyPayload();
  const result = await store.dispatch(
    dutyOn ? 'dispatch/checkInDriver' : 'dispatch/checkOutDriver',
    { driverUserId: driver.driverUserId, payload }
  );
  await handleCommandResult(result, dutyOn ? '已开启可派' : '已关闭可派', `${driver.driverName || '司机'}状态已更新`);
}

async function submitEmploymentChange({ driver, employmentType }) {
  if (!requireLoginOrPermission(DISPATCH_PERMISSIONS.dutyManage, '设置司机类型')) return;
  const label = employmentType === 'PART_TIME' ? '兼职' : '专职';
  const message = employmentType === 'PART_TIME'
    ? '兼职司机送完最后一个客户后结束，不计算返回仓库。确认修改？'
    : '专职司机送完后返回仓库，路线会计算返程。确认修改？';
  if (!window.confirm(message)) return;
  try {
    const payload = buildDriverEmploymentPayload(employmentType);
    const result = await store.dispatch('dispatch/updateDriverEmployment', {
      driverUserId: driver.driverUserId,
      payload,
    });
    await handleCommandResult(result, '司机类型已更新', `${driver.driverName || '司机'}已设为${label}`);
  } catch (error) {
    showFeedback('无法保存', error?.message || '司机类型无效', 'error');
  }
}

async function submitLoadingReturn(stop, action) {
  if (!window.confirm(action?.payload?.removeConfirmMessage || '确认将该客户从装车路线移除并退回待分配区域？')) return;
  try {
    const command = buildReturnStopToSandboxCommand({
      stop,
      action,
      routeDate: routeDateForWrite(),
      batchCode: activeSnapshot.value.pageViewModel?.batchCode || dispatchState.value.context.batchCode,
    });
    const result = await store.dispatch('dispatch/returnStopToSandbox', command);
    await handleCommandResult(
      result,
      result?.data?.exitedLoading ? '空路线已删除' : '客户已退回待分配',
      result?.data?.exitedLoading ? '最后一家客户已移除，空路线不再显示' : '客户已从装车路线移除'
    );
  } catch (error) {
    showFeedback('无法提交', error?.message || '客户站点参数不完整', 'error');
  }
}

async function submitDeparture(route, action) {
  const allowed = hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.loadingConfirm)
    || hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.deliveryConfirm)
    || hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.deliverySelf);
  if (!authSession.value?.authenticated || !sessionMatchesDistributer.value || !allowed) {
    showFeedback('权限不足', '当前账号没有确认发车权限', 'error');
    return;
  }
  if (!window.confirm(`确认${route?.driverName || '该司机'}整条路线现在出发？`)) return;
  try {
    const command = buildDepartDriverCommand({
      route,
      action,
      routeDate: routeDateForWrite(),
      batchCode: activeSnapshot.value.pageViewModel?.batchCode || dispatchState.value.context.batchCode,
    });
    const result = await store.dispatch('dispatch/departDriver', command);
    await handleCommandResult(result, '已确认发车', `${route?.driverName || '司机'}的路线已进入配送中`);
  } catch (error) {
    showFeedback('无法发车', error?.message || '路线参数不完整', 'error');
  }
}

async function submitDeliveryAction(stop, action, returnToSandbox) {
  const allowed = hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.deliveryConfirm)
    || hasDispatchPermission(authSession.value, DISPATCH_PERMISSIONS.deliverySelf);
  if (!authSession.value?.authenticated || !sessionMatchesDistributer.value || !allowed) {
    showFeedback('权限不足', '当前账号没有配送确认权限', 'error');
    return;
  }
  let reason = '';
  if (returnToSandbox) {
    reason = window.prompt('请输入退回待分配的原因：', '') || '';
    if (!reason.trim()) {
      showFeedback('未执行退回', '配送中退回必须填写原因', 'warning');
      return;
    }
  } else if (!window.confirm(`确认“${stop?.customerName || '该客户'}”已经送达？`)) {
    return;
  }
  try {
    const command = buildDeliveryStopCommand({
      stop,
      action,
      routeDate: routeDateForWrite(),
      batchCode: activeSnapshot.value.pageViewModel?.batchCode || dispatchState.value.context.batchCode,
      reason,
    });
    const result = await store.dispatch(
      returnToSandbox ? 'dispatch/returnDeliveryStopToSandbox' : 'dispatch/completeDeliveryStop',
      command
    );
    await handleCommandResult(
      result,
      returnToSandbox ? '已退回待分配' : '已确认送达',
      `${stop?.customerName || '客户'}状态已由服务端更新`
    );
  } catch (error) {
    showFeedback('无法提交', error?.message || '配送任务参数不完整', 'error');
  }
}

async function executePageAction({ action, route, stop } = {}) {
  const type = actionType(action);
  if (!type || [
    'STATUS_ONLY',
    'VIEW_ROUTE',
    'CONFIRM_SANDBOX_STOP',
    'CONFIRM_ASSIGN',
  ].includes(type)) return;
  if (historicalPlan.value) {
    showFeedback('历史计划只读', 'Boss 派单动作只允许操作今日路线', 'warning');
    return;
  }
  if (action?.enabled === false) {
    showFeedback('当前不可操作', action.disabledReason || '服务端已禁用该操作', 'warning');
    return;
  }
  if (type === 'GO_LOADING') {
    await selectPhase('loading');
    return;
  }
  if (type === 'START_MANUAL_DISPATCH') {
    await openManualDispatch(action);
    return;
  }
  if (['OPEN_DRIVER_ROUTE_EDIT', 'SIMULATE_MANUAL_DISPATCH'].includes(type)) {
    openRouteEditor(route || selectedRoute.value);
    return;
  }
  if (type === 'RETURN_TO_DISPATCH') {
    showFeedback('请至分派中调整路线', '装车路线不能在当前列表直接退回，已为你切换到分派中', 'warning');
    await selectPhase('dispatch');
    return;
  }
  if (type === 'EDIT_TODAY_TIME_WINDOW') {
    if (!requireLoginOrPermission(DISPATCH_PERMISSIONS.routeEdit, '编辑送达时间')) return;
    timeWindowAction.value = { action, payload: actionPayload(action), route, stop };
    return;
  }
  if (type === 'DEPART_NOW') {
    await submitDeparture(route || selectedRoute.value, action);
    return;
  }
  if (['COMPLETE_NOW', 'COMPLETE_DELIVERY', 'CONFIRM_DELIVERY'].includes(type)) {
    await submitDeliveryAction(stop || selectedStop.value, action, false);
    return;
  }
  if (type === 'RETURN_TO_SANDBOX_NOW') {
    await submitDeliveryAction(stop || selectedStop.value, action, true);
    return;
  }
  if (type === 'RETURN_TO_SANDBOX') {
    if (activePhase.value === 'loading') {
      await submitLoadingReturn(stop || selectedStop.value, action);
    }
    return;
  }
  if (type === 'MARK_DELIVERY_EXCEPTION') {
    showFeedback('功能未接入', '与 Boss 小程序一致：通用配送异常尚无正式后端合同', 'warning');
    return;
  }
  showFeedback('暂不支持该动作', `服务端返回了未识别的 actionType：${type}`, 'warning');
}

function goToDesktopLogin() {
  router.push({
    name: 'Home',
    query: { returnTo: 'DispatchWorkbench' },
  });
}

async function handleDesktopSessionExpired(error = null) {
  if (error) await store.dispatch('dispatch/restoreAuth');
  if (!authSession.value?.authenticated) {
    showFeedback('桌面登录已失效', '请重新登录桌面端，登录后地图和调度权限会自动恢复。', 'warning');
    goToDesktopLogin();
  }
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
  const authResult = await store.dispatch('dispatch/restoreAuth');
  if (!authResult?.data?.authenticated) {
    goToDesktopLogin();
    return;
  }
  await refresh();
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

/* Desktop control-room typography: keep the map spacious while making operational text readable. */
.dispatch-workbench { padding: 8px 12px 12px; }
.dispatch-phase-tabs { gap: 24px; }
.dispatch-phase-tabs button { min-width: 140px; grid-template-columns: 34px auto auto; gap: 9px; }
.dispatch-phase-tabs button > span { width: 33px; height: 33px; font-size: 13px; }
.dispatch-phase-tabs strong { font-size: 14px; }
.dispatch-phase-tabs em { min-width: 25px; height: 22px; font-size: 11px; }
.dispatch-toolbar { min-height: 58px; padding: 9px 16px; border-radius: 14px; }
.dispatch-toolbar__summary span { font-size: 11px; }
.dispatch-toolbar__summary strong { font-size: 19px; }
.dispatch-toolbar__summary small { font-size: 12px; }
.dispatch-toolbar__metrics dt { font-size: 10px; }
.dispatch-toolbar__metrics dd { margin-top: 5px; font-size: 15px; }
.dispatch-toolbar__actions > span { font-size: 10px; }
.dispatch-toolbar__actions button { min-height: 38px; padding: 8px 11px; font-size: 11px; }
.dispatch-workbench__feedback,
.dispatch-workbench__warning { padding-top: 10px; padding-bottom: 10px; font-size: 12px; }
.dispatch-workbench__warning strong,
.dispatch-workbench__warning span { font-size: 11px; }
.dispatch-workbench__warning button { font-size: 11px; }
.dispatch-workbench__layout {
  grid-template-columns: minmax(540px, 1.03fr) minmax(540px, .97fr);
  gap: 0;
  margin-top: 0;
  overflow: hidden;
  border: 1px solid #d8e4de;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 34px rgba(36, 71, 58, .06);
}
.dispatch-map-panel {
  align-self: stretch;
  width: 100%;
  height: 100%;
  max-height: none;
  margin: 0;
  padding: 18px;
  border: 0;
  border-right: 1px solid #dfe8e3;
  border-radius: 0;
  box-shadow: none;
}
.dispatch-map-panel__header { margin-bottom: 9px; }
.dispatch-map-panel__header h2 { font-size: 20px; }
.dispatch-map-panel__header p { margin-top: 3px; font-size: 10px; }
.dispatch-map-panel__header > strong { padding: 8px 11px; font-size: 11px; }
.confirm-dialog > span { font-size: 12px; }
.confirm-dialog h2 { font-size: 23px; }
.confirm-dialog p { font-size: 13px; }
.confirm-dialog button { font-size: 13px; }

@media (min-width: 1500px) {
  .dispatch-workbench__layout {
    grid-template-columns: minmax(650px, 1.03fr) minmax(640px, .97fr);
    gap: 0;
  }
}

@media (max-width: 1260px) {
  .dispatch-workbench__layout {
    grid-template-columns: minmax(490px, 1fr) minmax(475px, 1fr);
    gap: 0;
  }

  .dispatch-map-panel {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 18px;
  }
}

/* Dispatch owns one compact product-header row: phase, scope, metrics and actions stay together. */
:global(#product-header-context) {
  height: 100%;
}

.dispatch-header-row {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.dispatch-header-row .dispatch-phase-tabs {
  flex: none;
  gap: 5px;
}

.dispatch-header-row .dispatch-phase-tabs button {
  min-width: 88px;
  grid-template-columns: 27px auto auto;
  gap: 5px;
  padding: 0 2px;
}

.dispatch-header-row .dispatch-phase-tabs button::after {
  bottom: -13px;
}

.dispatch-header-row .dispatch-phase-tabs button > span {
  width: 27px;
  height: 27px;
  border-radius: 7px;
  font-size: 11px;
}

.dispatch-header-row .dispatch-phase-tabs strong {
  font-size: 12px;
}

.dispatch-header-row .dispatch-phase-tabs em {
  min-width: 21px;
  height: 19px;
  padding: 0 4px;
  font-size: 9px;
}

.dispatch-header-row .dispatch-toolbar {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  gap: 10px;
  align-items: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.dispatch-header-row .dispatch-toolbar__summary {
  flex: none;
  gap: 5px;
  padding-left: 10px;
  border-left: 1px solid #e0e9e5;
}

.dispatch-header-row .dispatch-toolbar__summary span {
  font-size: 9px;
}

.dispatch-header-row .dispatch-toolbar__summary strong {
  font-size: 15px;
}

.dispatch-header-row .dispatch-toolbar__summary small {
  max-width: 104px;
  font-size: 10px;
}

.dispatch-header-row .dispatch-toolbar__metrics {
  display: flex;
  min-width: 0;
  flex: 1;
}

.dispatch-header-row .dispatch-toolbar__metrics > div:nth-child(-n + 2) {
  display: none;
}

.dispatch-header-row .dispatch-toolbar__metrics > div {
  min-width: 82px;
  padding: 0 9px;
}

.dispatch-header-row .dispatch-toolbar__metrics dt {
  font-size: 8px;
}

.dispatch-header-row .dispatch-toolbar__metrics dd {
  margin-top: 2px;
  font-size: 12px;
}

.dispatch-header-row .dispatch-toolbar__actions {
  flex: none;
  gap: 5px;
}

.dispatch-header-row .dispatch-toolbar__actions > span {
  max-width: 118px;
  overflow: hidden;
  font-size: 9px;
  text-overflow: ellipsis;
}

.dispatch-header-row .dispatch-toolbar__actions button {
  min-height: 31px;
  padding: 5px 8px;
  font-size: 10px;
}

@media (max-width: 1320px) {
  .dispatch-header-row .dispatch-toolbar__metrics {
    display: none;
  }

  .dispatch-header-row .dispatch-toolbar__actions > span {
    display: none;
  }
}

/* Reference layout: overview header, full-width phase rail and a map/table split. */
.dispatch-workbench {
  padding: 14px 18px 18px;
  background: #f6f8f7;
}

.dispatch-header-row {
  width: 100%;
  height: 100%;
}

.dispatch-header-row .dispatch-toolbar {
  display: grid;
  width: 100%;
  min-height: 0;
  grid-template-columns: 116px minmax(430px, 1fr) auto;
  gap: 12px;
  padding: 0;
  border: 0;
  background: transparent;
}

.dispatch-header-row .dispatch-toolbar__summary {
  display: flex;
  align-items: center;
  align-self: stretch;
  padding: 0 14px 0 0;
  border: 0;
  border-right: 1px solid #e0e7e3;
}

.dispatch-header-row .dispatch-toolbar__summary span {
  color: #263a33;
  font-size: 11px;
  font-weight: 700;
}

.dispatch-header-row .dispatch-toolbar__metrics {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(4, minmax(92px, 1fr));
  align-self: stretch;
}

.dispatch-header-row .dispatch-toolbar__metrics > div,
.dispatch-header-row .dispatch-toolbar__metrics > div:nth-child(-n + 2) {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 0 13px;
  border-left: 1px solid #e4e9e6;
  text-align: center;
}

.dispatch-header-row .dispatch-toolbar__metrics > div:first-child {
  border-left: 0;
}

.dispatch-header-row .dispatch-toolbar__metrics dd {
  order: 1;
  margin: 0;
  color: #111a17;
  font-size: 20px;
  line-height: 1.1;
  font-weight: 900;
}

.dispatch-header-row .dispatch-toolbar__metrics dt {
  order: 2;
  margin-top: 4px;
  color: #65736e;
  font-size: 10px;
}

.dispatch-header-row .dispatch-toolbar__actions {
  gap: 10px;
}

.dispatch-header-row .dispatch-toolbar__actions button {
  min-height: 42px;
  padding: 8px 15px;
  border-color: #b9d2c7;
  border-radius: 8px;
  color: #087847;
  font-size: 12px;
  background: #fff;
}

.dispatch-header-row .dispatch-toolbar__actions button:last-child {
  min-width: 44px;
  color: #52615c;
  border-color: #d9e0dd;
}

.dispatch-phase-tabs {
  display: grid;
  flex: none;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.dispatch-phase-tabs button {
  position: relative;
  display: flex;
  min-width: 0;
  height: 56px;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 0 18px;
  border: 1px solid #dce3e0;
  border-radius: 7px;
  color: #16875a;
  background: #fff;
  box-shadow: 0 1px 3px rgba(28, 60, 47, .03);
}

.dispatch-phase-tabs button::after {
  display: none;
}

.dispatch-phase-tabs button > span {
  display: inline-flex;
  width: auto;
  height: auto;
  color: inherit;
  background: transparent;
  font-size: 13px;
}

.dispatch-phase-tabs strong {
  font-size: 17px;
}

.dispatch-phase-tabs em {
  min-width: 27px;
  height: 27px;
  padding: 0 7px;
  color: inherit;
  background: #eef6f2;
  font-size: 12px;
}

.dispatch-phase-tabs button.is-loading {
  color: #ed6f07;
}

.dispatch-phase-tabs button.is-loading em {
  background: #fff1df;
}

.dispatch-phase-tabs button.is-delivery {
  color: #1767df;
}

.dispatch-phase-tabs button.is-delivery em {
  background: #eaf2ff;
}

.dispatch-phase-tabs button.active {
  color: #fff;
  border-color: #087f49;
  background: linear-gradient(135deg, #078049, #00945a);
}

.dispatch-phase-tabs button.active > span,
.dispatch-phase-tabs button.active em {
  color: inherit;
  background: rgba(255, 255, 255, .18);
}

.dispatch-phase-tabs button.active::before {
  position: absolute;
  bottom: -8px;
  left: 50%;
  border-top: 8px solid #078a51;
  border-right: 10px solid transparent;
  border-left: 10px solid transparent;
  content: '';
  transform: translateX(-50%);
}

@media (min-width: 1500px) {
  .dispatch-workbench__layout {
    grid-template-columns: minmax(460px, .9fr) minmax(650px, 1.1fr);
  }
}

.dispatch-workbench__layout {
  grid-template-columns: minmax(460px, .9fr) minmax(650px, 1.1fr);
  gap: 12px;
  margin: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.dispatch-map-panel {
  height: 100%;
  padding: 0;
  overflow: hidden;
  border: 1px solid #dce5e1;
  border-radius: 10px;
  background: #fff;
}

.dispatch-map-panel__header {
  min-height: 68px;
  margin: 0;
  padding: 12px 15px;
  border-bottom: 1px solid #e7ece9;
}

.dispatch-map-panel__header h2 {
  margin: 0;
  font-size: 17px;
}

.dispatch-map-panel__header p {
  margin-top: 5px;
  font-size: 11px;
}

.dispatch-map-panel__header > button {
  flex: none;
  min-height: 34px;
  padding: 7px 11px;
  border: 1px solid #d8e1dd;
  border-radius: 7px;
  color: #526860;
  background: #fff;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

@media (max-width: 1320px) {
  .dispatch-header-row .dispatch-toolbar {
    grid-template-columns: 92px minmax(360px, 1fr) auto;
  }

  .dispatch-header-row .dispatch-toolbar__metrics {
    display: grid;
  }

  .dispatch-header-row .dispatch-toolbar__metrics dd {
    font-size: 16px;
  }

  .dispatch-workbench__layout {
    grid-template-columns: minmax(430px, .86fr) minmax(590px, 1.14fr);
  }
}
</style>
