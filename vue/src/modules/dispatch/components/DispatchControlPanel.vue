<template>
  <aside class="control-panel" aria-label="路线与调度操作">
    <section
      v-if="routes.length"
      class="route-switcher"
      :class="{ 'is-single': routes.length === 1 }"
      aria-label="司机路线"
    >
      <button
        v-for="route in routes"
        :key="route._routeKey"
        type="button"
        :class="{ active: selectedRouteKey === route._routeKey }"
        @click="$emit('select-route', route)"
      >
        <i :style="{ backgroundColor: routeColor(route) }"></i>
        <span>
          <strong>{{ route.driverName || '未命名司机' }}</strong>
          <small>{{ route._stops.length }} 站 · {{ route.totalRoundTripDistanceText || route.totalDistanceText || '路线已生成' }}</small>
        </span>
        <em>›</em>
      </button>
    </section>

    <section v-if="selectedRoute" class="route-detail" :class="`is-${activePhase}`">
      <div class="route-detail__overview">
        <dl class="route-detail__metrics">
          <div><dd>{{ selectedRoute._stops.length }} 站</dd><dt>站点数</dt></div>
          <div><dd>{{ selectedRoute.totalRoundTripDistanceText || selectedRoute.totalDistanceText || '—' }}</dd><dt>总里程</dt></div>
          <div><dd>{{ selectedRoute.totalRoundTripDurationText || selectedRoute.totalDurationText || '—' }}</dd><dt>预计时长</dt></div>
          <div><dt>{{ activePhase === 'delivery' ? '实际出发' : '建议出发' }}</dt><dd>{{ selectedRoute.plannedDepartLabel || '—' }}</dd></div>
          <div><dt>{{ activePhase === 'delivery' ? '下一站到达' : '首站到达' }}</dt><dd>{{ firstArrivalLabel }}</dd></div>
          <div><dt>{{ routeEndLabel }}</dt><dd>{{ routeEndTime }}</dd></div>
        </dl>

        <div v-if="activePhase === 'dispatch'" class="route-detail__actions route-detail__actions--dispatch">
          <button
            type="button"
            class="primary"
            :disabled="!canEditRoute || submitting"
            @click="$emit('edit-route', selectedRoute)"
          >编辑路线</button>
          <button
            type="button"
            :disabled="!canConfirmDispatch || submitting"
            @click="$emit('confirm-dispatch')"
          >{{ submitting ? '确认中…' : '确认路线' }}</button>
        </div>
        <div v-else-if="activePhase === 'loading'" class="route-detail__actions route-detail__actions--loading">
          <button
            v-if="routeEditVisible"
            type="button"
            class="primary"
            :disabled="!canEditRoute || submitting || selectedRoute.routeEditAction?.enabled === false"
            :title="selectedRoute.routeEditAction?.disabledReason || ''"
            @click="$emit('edit-route', selectedRoute)"
          >编辑路线</button>
          <button
            v-if="routePrimaryVisible"
            type="button"
            :disabled="submitting || selectedRoute.primaryAction?.enabled === false"
            :title="selectedRoute.primaryAction?.disabledReason || ''"
            @click="$emit('execute-action', { action: selectedRoute.primaryAction, route: selectedRoute })"
          >{{ selectedRoute.primaryAction?.label || '执行操作' }}</button>
        </div>
      </div>
      <p v-if="activePhase === 'dispatch' && actionHint" class="route-detail__permission">{{ actionHint }}</p>

      <div v-if="selectedRoute.deliveryProgressLine" class="route-detail__progress">
        <span><i :style="{ width: `${deliveryProgress}%` }"></i></span>
        <strong>{{ selectedRoute.deliveryProgressLine }}</strong>
      </div>

      <div class="route-detail__list-head">
        <strong>配送顺序</strong>
        <span>点击客户，地图同步定位</span>
      </div>

      <div class="stop-list__columns" aria-hidden="true">
        <span>#</span>
        <span>客户与货品</span>
        <span>时间窗口</span>
        <span>路段距离</span>
        <span>预计到达</span>
        <span>服务时长</span>
        <span>预计离开</span>
        <span>状态</span>
        <span>操作</span>
      </div>

      <ol class="stop-list">
        <li
          v-for="(stop, index) in selectedRoute._stops"
          :key="stop._stopKey"
          :class="{ active: selectedStopKey === stop._stopKey, 'is-driver-locked': stop.driverLocked }"
        >
          <div class="stop-list__row">
            <button type="button" class="stop-list__select" @click="$emit('select-stop', stop)">
              <span class="stop-list__sequence">{{ stop.seq || index + 1 }}</span>
              <span class="stop-list__customer">
                <strong>{{ stop.customerName || stop.name || '未命名客户' }}</strong>
                <b v-if="stop.isReturnPickup" class="return-pickup-badge">退货取货</b>
                <span v-if="stop.driverLocked" class="driver-lock-badge">
                  🔒 {{ stop.driverLockLabel || '已锁定司机' }}
                </span>
                <small>{{ stop.goodsSummary || stop._customerAddress || '暂无商品摘要' }}</small>
              </span>
              <span class="stop-list__window">{{ stop.windowRequirementLabel || '—' }}</span>
              <span class="stop-list__leg">{{ stop.legText || stop.legDistanceLabel || '—' }}</span>
              <span class="stop-list__value">{{ stop.plannedArrivalLabel || stop.timeRight || stop.estimateArriveTime || '—' }}</span>
              <span class="stop-list__value">{{ stop.serviceDurationLabel || '—' }}</span>
              <span class="stop-list__value">{{ stop.plannedDepartureLabel || '—' }}</span>
              <span class="stop-list__status" :class="statusTone(stop.arrivalStatusTone)">{{ displayStatus(stop) || '—' }}</span>
            </button>
            <span class="stop-list__actions">
              <button
                v-for="action in visibleStopActions(stop)"
                :key="`${stop._stopKey}:${action.actionType}`"
                type="button"
                :class="{ danger: action === stop.exceptionAction }"
                :disabled="submitting || action.enabled === false"
                :title="action.disabledReason || ''"
                @click="$emit('execute-action', { action, route: selectedRoute, stop })"
              >{{ action.label || actionLabel(action) }}</button>
            </span>
          </div>
        </li>
        <li class="stop-list__depot">
          <span>{{ returnToDepotRequired ? '仓' : '终' }}</span>
          <span class="stop-list__depot-copy"><small v-if="routeEndLeg">🚚 {{ routeEndLeg }}</small><strong>{{ routeEndName }}</strong></span>
          <small class="stop-list__depot-time">{{ routeEndTime }}</small>
        </li>
      </ol>
    </section>

    <section v-else-if="activePhase === 'dispatch' && unassignedStops.length" class="unassigned-list">
      <div class="route-detail__list-head">
        <strong>待分配客户</strong>
        <span>{{ unassignedStops.length }} 个客户</span>
      </div>
      <button
        v-for="stop in unassignedStops"
        :key="stop._stopKey"
        type="button"
        :class="{ active: selectedStopKey === stop._stopKey, 'is-driver-locked': stop.driverLocked }"
        @click="$emit('select-stop', stop)"
      >
        <span>?</span>
        <span>
          <strong>{{ stop.customerName || '未命名客户' }}</strong>
          <b v-if="stop.isReturnPickup" class="return-pickup-badge">退货取货</b>
          <span v-if="stop.driverLocked" class="driver-lock-badge">
            🔒 {{ stop.driverLockLabel || '已锁定司机' }}
          </span>
          <small>{{ stop.goodsSummary || stop._customerAddress }}</small>
        </span>
      </button>
      <button
        type="button"
        class="unassigned-list__assign"
        :disabled="!canAssignDriver || submitting"
        @click="$emit('assign-driver')"
      >
        为所选客户安排司机
      </button>
    </section>

    <section v-else class="control-panel__empty">
      <span>✓</span>
      <strong>当前没有{{ phaseCopy.title }}路线</strong>
      <p>切换上方状态可查看其他调度阶段。</p>
    </section>

  </aside>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  activePhase: { type: String, required: true },
  routes: { type: Array, default: () => [] },
  unassignedStops: { type: Array, default: () => [] },
  selectedRouteKey: { type: String, default: null },
  selectedStopKey: { type: String, default: null },
  selectedStop: { type: Object, default: null },
  mapOverview: { type: Object, default: () => ({}) },
  canAssignDriver: { type: Boolean, default: false },
  canEditRoute: { type: Boolean, default: false },
  canConfirmDispatch: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  historicalPlan: { type: Boolean, default: false },
  actionHint: { type: String, default: '' },
});

defineEmits([
  'select-route',
  'select-stop',
  'assign-driver',
  'edit-route',
  'confirm-dispatch',
  'execute-action',
]);

const PHASE_COPY = {
  dispatch: {
    eyebrow: '电脑已自动规划',
    title: '分派中',
    hint: '检查司机与客户顺序，确认后进入装车。',
  },
  loading: {
    eyebrow: '路线已确认',
    title: '装车中',
    hint: '查看每条路线的装车客户与出发顺序。',
  },
  delivery: {
    eyebrow: '司机已经出发',
    title: '配送中',
    hint: '地图和客户状态会随配送进度更新。',
  },
};

const phaseCopy = computed(() => PHASE_COPY[props.activePhase] || PHASE_COPY.dispatch);
const selectedRoute = computed(() => (
  props.routes.find((route) => route._routeKey === props.selectedRouteKey) || null
));
const firstArrivalLabel = computed(() => {
  const route = selectedRoute.value;
  const stop = props.activePhase === 'delivery'
    ? route?._stops?.find((item) => !item.stopDone)
    : route?._stops?.[0];
  return route?.firstStopPlannedArrivalLabel
    || stop?.plannedArrivalLabel
    || stop?.timeRight
    || stop?.estimateArriveTime
    || '—';
});
const routeEndNode = computed(() => selectedRoute.value?._endNode || {});
const returnToDepotRequired = computed(() => (
  selectedRoute.value?.returnToDepotRequired
  ?? selectedRoute.value?.returnToDepot
  ?? routeEndNode.value?.returnToDepotRequired
  ?? true
) !== false);
const routeEndLabel = computed(() => (
  selectedRoute.value?.routeEndLabel
  || (returnToDepotRequired.value ? '预计返回' : '预计完成')
));
const routeEndName = computed(() => (
  routeEndNode.value?.customerName
  || routeEndNode.value?.name
  || (returnToDepotRequired.value ? '返回仓库' : '配送完成')
));
const routeEndTime = computed(() => (
  selectedRoute.value?.plannedReturnLabel
  || selectedRoute.value?.plannedFinishLabel
  || routeEndNode.value?.plannedArrivalLabel
  || routeEndNode.value?.timeRight
  || '—'
));
const routeEndLeg = computed(() => (
  routeEndNode.value?.legText
  || routeEndNode.value?.legDistanceLabel
  || ''
));
const deliveryProgress = computed(() => {
  const value = Number(selectedRoute.value?.deliveryProgressPercent);
  if (Number.isFinite(value)) return Math.min(100, Math.max(0, value));
  const all = selectedRoute.value?._stops?.length || 0;
  const done = selectedRoute.value?._stops?.filter((stop) => stop.stopDone).length || 0;
  return all ? Math.round((done / all) * 100) : 0;
});
const routeEditVisible = computed(() => Boolean(
  selectedRoute.value?.routeEditAction
  || selectedRoute.value?.canEditRoute === true
));
const routePrimaryVisible = computed(() => isVisibleAction(selectedRoute.value?.primaryAction));

function normalizedActionType(action) {
  return String(action?.actionType || action?.action || '').trim().toUpperCase();
}

function isVisibleAction(action, stop = null) {
  const type = normalizedActionType(action);
  if (!type || [
    'STATUS_ONLY',
    'VIEW_ROUTE',
    'GO_LOADING',
    'CONFIRM_SANDBOX_STOP',
    'CONFIRM_ASSIGN',
  ].includes(type)) return false;
  if (stop?._phase === 'dispatch' && type === 'RETURN_TO_SANDBOX') return false;
  return true;
}

function visibleStopActions(stop) {
  return [stop?.primaryAction, stop?.exceptionAction]
    .filter((action) => isVisibleAction(action, stop));
}

function actionLabel(action) {
  const labels = {
    EDIT_TODAY_TIME_WINDOW: '编辑时间',
    START_MANUAL_DISPATCH: '人工调度',
    RETURN_TO_DISPATCH: '调整路线',
    RETURN_TO_SANDBOX: '退回待分配',
    RETURN_TO_SANDBOX_NOW: '退回待分配',
    COMPLETE_NOW: '确认送达',
    COMPLETE_DELIVERY: '确认送达',
    DEPART_NOW: '确认发车',
    MARK_DELIVERY_EXCEPTION: '异常处理',
  };
  return labels[normalizedActionType(action)] || '操作';
}

function routeColor(route) {
  const legend = Array.isArray(props.mapOverview?.legend) ? props.mapOverview.legend : [];
  const matched = legend.find((item) => (
    item?.driverUserId != null
    && route?.driverUserId != null
    && String(item.driverUserId) === String(route.driverUserId)
  ));
  if (matched?.color) return matched.color;
  const driverId = route?.driverUserId;
  const colors = ['#0f9f6e', '#2563eb', '#dc5b45', '#7c5ce7', '#d48a12', '#0891b2'];
  const numeric = Number(driverId);
  if (Number.isFinite(numeric)) return colors[Math.abs(numeric) % colors.length];
  return colors[props.routes.indexOf(route) % colors.length];
}

function displayStatus(stop) {
  if (props.historicalPlan && /迟到\s*\d+/u.test(String(stop?._displayStatus || ''))) {
    return '历史计划';
  }
  return stop?._displayStatus || '';
}

function statusTone(tone) {
  const normalized = String(tone || '').trim().toLowerCase();
  if (['danger', 'error', 'late'].includes(normalized)) return 'is-danger';
  if (['warning', 'warn', 'early'].includes(normalized)) return 'is-warning';
  return 'is-success';
}
</script>

<style scoped>
.stop-list li.is-driver-locked,
.unassigned-list button.is-driver-locked {
  overflow: hidden;
  border: 1px solid #e08a00;
  border-left: 5px solid #f0a020;
  border-radius: 9px;
  background: #fffaf0;
  box-shadow: 0 4px 14px rgba(211, 126, 0, .14);
}

.driver-lock-badge {
  display: inline-flex;
  width: fit-content;
  max-width: 100%;
  align-items: center;
  margin-top: 4px;
  padding: 3px 8px;
  overflow: hidden;
  border: 1px solid #e08a00;
  border-radius: 999px;
  color: #9d5100;
  background: #fff0c7;
  font-size: 10px;
  font-weight: 900;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.control-panel {
  box-sizing: border-box;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #dce6e1;
  border-radius: 14px;
  background: #fff;
}

.control-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 17px 18px 14px;
  border-bottom: 1px solid #e8eeeb;
}

.control-panel__header span,
.control-panel__header h2,
.control-panel__header p {
  margin: 0;
}

.control-panel__header span {
  color: #16855e;
  font-size: 10px;
  font-weight: 800;
}

.control-panel__header h2 {
  margin-top: 3px;
  color: #183129;
  font-size: 20px;
}

.control-panel__header p {
  margin-top: 4px;
  color: #7b8984;
  font-size: 10px;
}

.control-panel__header > strong {
  flex: none;
  padding: 5px 9px;
  border-radius: 99px;
  color: #40665a;
  background: #eef6f2;
  font-size: 10px;
}

.route-switcher {
  display: flex;
  gap: 7px;
  overflow-x: auto;
  padding: 10px 12px;
  border-bottom: 1px solid #edf1ef;
}

.route-switcher button {
  display: grid;
  min-width: 172px;
  grid-template-columns: 4px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  padding: 9px 10px;
  border: 1px solid #dfe7e3;
  border-radius: 9px;
  color: inherit;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.route-switcher button.active {
  border-color: #62b99a;
  background: #eef9f5;
  box-shadow: 0 0 0 2px rgba(15, 159, 110, .08);
}

.route-switcher i {
  width: 4px;
  height: 30px;
  border-radius: 99px;
}

.route-switcher span {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.route-switcher strong {
  overflow: hidden;
  color: #20362f;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-switcher small {
  overflow: hidden;
  margin-top: 3px;
  color: #7a8883;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-switcher em {
  color: #96a39f;
  font-size: 18px;
  font-style: normal;
}

.route-detail,
.unassigned-list {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.route-detail__summary {
  padding: 13px 16px 11px;
  background: #fbfcfc;
}

.route-detail__summary > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.route-detail__summary > div span {
  color: #87938f;
  font-size: 9px;
}

.route-detail__summary > div strong {
  color: #1c332b;
  font-size: 13px;
}

.route-detail__summary dl {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 10px 0 0;
}

.route-detail__summary dl div {
  padding-left: 9px;
  border-left: 2px solid #dce8e3;
}

.route-detail__summary dt {
  color: #8a9692;
  font-size: 8px;
}

.route-detail__summary dd {
  overflow: hidden;
  margin: 3px 0 0;
  color: #344a43;
  font-size: 10px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-detail__actions {
  display: grid;
  grid-template-columns: .9fr .9fr 1.3fr;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #e8eeeb;
  border-bottom: 1px solid #e8eeeb;
}

.route-detail__actions button,
.unassigned-list__assign {
  padding: 9px 11px;
  border: 1px solid #b9ccc4;
  border-radius: 8px;
  color: #416058;
  background: #fff;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.route-detail__actions button.primary,
.unassigned-list__assign {
  border-color: #119865;
  color: #fff;
  background: #119865;
}

.route-detail__actions button:disabled,
.unassigned-list__assign:disabled {
  cursor: not-allowed;
  opacity: .42;
}

.route-detail__permission {
  margin: 0;
  padding: 0 14px 9px;
  color: #9a6e22;
  background: #fff;
  font-size: 8px;
}

.route-detail__plan-time {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin: 10px 14px 0;
  overflow: hidden;
  border: 1px solid #deebe5;
  border-radius: 9px;
  background: #deebe5;
}

.route-detail__plan-time > span {
  display: flex;
  min-width: 0;
  padding: 8px;
  flex-direction: column;
  background: #f7fbf9;
}

.route-detail__plan-time small {
  color: #84928c;
  font-size: 7px;
}

.route-detail__plan-time strong {
  margin-top: 3px;
  overflow: hidden;
  color: #1c7655;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-detail__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px 8px;
}

.route-detail__list-head strong {
  color: #2a4038;
  font-size: 11px;
}

.route-detail__list-head span {
  color: #929d99;
  font-size: 8px;
}

.stop-list {
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  margin: 0;
  padding: 0 10px 12px;
  list-style: none;
}

.stop-list li {
  border-bottom: 1px solid #edf1ef;
}

.stop-list li.active {
  border-color: transparent;
  border-radius: 9px;
  background: #eef9f5;
}

.stop-list__row {
  display: flex;
  align-items: center;
}

.stop-list__select {
  display: grid;
  min-width: 0;
  flex: 1;
  grid-template-columns: 29px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  padding: 10px 8px;
  border: 0;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.stop-list__actions {
  display: flex;
  flex: none;
  gap: 4px;
  padding-right: 7px;
}

.stop-list__actions button {
  padding: 5px 7px;
  border: 1px solid #b9d5ca;
  border-radius: 6px;
  color: #187452;
  background: #f3faf7;
  font-size: 8px;
  font-weight: 800;
  cursor: pointer;
}

.stop-list__actions button.danger {
  border-color: #e2bab7;
  color: #a44c45;
  background: #fff6f5;
}

.stop-list__actions button:disabled {
  cursor: not-allowed;
  opacity: .45;
}

.route-detail__actions--loading {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.route-detail__actions--dispatch {
  grid-template-columns: .9fr 1.3fr;
}

.stop-list__sequence,
.stop-list__depot > span {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border-radius: 50%;
  color: #197855;
  background: #e4f3ed;
  font-size: 10px;
  font-weight: 900;
}

.stop-list__copy,
.stop-list__time {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.stop-list__copy strong {
  overflow: hidden;
  color: #233a32;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-list__copy small {
  overflow: hidden;
  margin-top: 3px;
  color: #87938f;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-list__copy em {
  margin-top: 3px;
  color: #5d776e;
  font-size: 8px;
  font-style: normal;
}

.stop-list__time {
  align-items: flex-end;
}

.stop-list__time strong {
  color: #40564f;
  font-size: 9px;
}

.stop-list__time small {
  margin-top: 3px;
  color: #8b9793;
  font-size: 8px;
}

.stop-list__depot {
  display: grid;
  grid-template-columns: 29px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  padding: 10px 8px;
}

.stop-list__depot > span {
  color: #fff;
  background: #263d35;
}

.stop-list__depot strong {
  color: #43564f;
  font-size: 10px;
}

.stop-list__depot small {
  color: #89948f;
  font-size: 8px;
}

.unassigned-list {
  overflow-y: auto;
  padding: 0 12px 12px;
}

.unassigned-list > button:not(.unassigned-list__assign) {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  margin-bottom: 7px;
  padding: 10px;
  border: 1px solid #e2e8e5;
  border-radius: 9px;
  color: inherit;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.unassigned-list > button.active {
  border-color: #66b899;
  background: #eff9f5;
}

.unassigned-list > button > span:first-child {
  display: grid;
  width: 27px;
  height: 27px;
  place-items: center;
  border-radius: 50%;
  color: #6b7773;
  background: #edf0ef;
  font-weight: 900;
}

.unassigned-list > button > span:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.unassigned-list strong {
  color: #2c4039;
  font-size: 10px;
}

.unassigned-list small {
  overflow: hidden;
  margin-top: 3px;
  color: #87938f;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unassigned-list__assign {
  width: 100%;
  margin-top: 5px;
}

.control-panel__empty {
  display: grid;
  min-height: 0;
  flex: 1;
  place-items: center;
  align-content: center;
  color: #83918c;
  text-align: center;
}

.control-panel__empty span {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 50%;
  color: #19845e;
  background: #eaf6f1;
  font-size: 18px;
}

.control-panel__empty strong {
  margin-top: 10px;
  color: #41564f;
  font-size: 12px;
}

.control-panel__empty p {
  margin: 5px 0 0;
  font-size: 9px;
}

.selected-stop {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  gap: 9px;
  align-items: center;
  flex: none;
  padding: 10px 13px;
  border-top: 1px solid #e4ebe7;
  background: #f8fbfa;
}

.selected-stop > span {
  display: grid;
  width: 33px;
  height: 33px;
  place-items: center;
  border-radius: 9px;
  color: #fff;
  background: #16865e;
  font-size: 11px;
  font-weight: 900;
}

.selected-stop > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.selected-stop small {
  color: #8a9692;
  font-size: 8px;
}

.selected-stop strong {
  overflow: hidden;
  margin-top: 1px;
  color: #283e36;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-stop em {
  overflow: hidden;
  margin-top: 2px;
  color: #82908b;
  font-size: 8px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-stop p {
  margin: 0;
  padding: 4px 7px;
  border-radius: 99px;
  color: #276d55;
  background: #e5f3ed;
  font-size: 8px;
  font-weight: 800;
}

/* Desktop density follows the Boss route card while keeping the route sequence visible above the fold. */
.control-panel__header { padding: 9px 16px 8px; }
.control-panel__header span { font-size: 11px; }
.control-panel__header h2 { margin-top: 2px; font-size: 20px; line-height: 1.12; }
.control-panel__header p { margin-top: 3px; font-size: 11px; line-height: 1.3; }
.control-panel__header > strong { padding: 5px 9px; font-size: 11px; }
.route-switcher { gap: 8px; padding: 7px 12px; scrollbar-width: thin; }
.route-switcher button { min-width: 170px; padding: 7px 10px; border-radius: 10px; }
.route-switcher strong { font-size: 13px; }
.route-switcher small { font-size: 10px; }
.route-detail__actions { gap: 9px; padding: 8px 14px; }
.route-detail__actions button,
.unassigned-list__assign { min-height: 36px; font-size: 12px; }
.route-detail__permission { padding: 0 18px 10px; font-size: 11px; }
.route-detail__plan-time { margin: 7px 14px 0; border-radius: 10px; }
.route-detail__plan-time > span { align-items: center; min-height: 48px; padding: 6px; text-align: center; }
.route-detail__plan-time small { font-size: 9px; }
.route-detail__plan-time strong { margin-top: 3px; font-size: 16px; line-height: 1.08; }
.route-detail__plan-time em { margin-top: 3px; padding: 2px 6px; border-radius: 99px; font-size: 9px; font-style: normal; }
.is-success { color: #11825c; background: #e3f7ef; }
.is-warning { color: #a36a0c; background: #fff3d6; }
.is-danger { color: #ad473e; background: #ffe9e6; }
.route-detail__progress { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; margin: 6px 14px 0; }
.route-detail__progress > span { height: 7px; overflow: hidden; border-radius: 99px; background: #e7efeb; }
.route-detail__progress i { display: block; height: 100%; border-radius: inherit; background: #16a06e; }
.route-detail__progress strong { color: #63766e; font-size: 11px; }
.route-detail__distance-line { display: flex; justify-content: center; gap: 18px; margin: 6px 14px 0; padding: 6px 0; border-top: 1px solid #edf2ef; border-bottom: 1px solid #edf2ef; color: #70827a; font-size: 11px; }
.route-detail__list-head { padding: 7px 16px 6px; }
.route-detail__list-head strong { font-size: 14px; }
.route-detail__list-head span { font-size: 10px; }
.stop-list { padding: 0 12px 16px 14px; scrollbar-gutter: stable; }
.stop-list::-webkit-scrollbar { width: 8px; }
.stop-list::-webkit-scrollbar-thumb { border: 2px solid #fff; border-radius: 99px; background: #c7d8d1; }
.stop-list li { margin-bottom: 6px; border: 1px solid #e3ebe7; border-radius: 11px; background: #fff; }
.stop-list li.active { border-color: #7ac8aa; box-shadow: 0 0 0 2px rgba(18, 143, 96, .08); }
.stop-list__row { align-items: stretch; }
.stop-list__select { grid-template-columns: 34px minmax(0, 1fr); gap: 9px; align-items: flex-start; padding: 9px; }
.stop-list__sequence,
.stop-list__depot > span { width: 31px; height: 31px; font-size: 12px; }
.stop-list__content { display: flex; min-width: 0; flex-direction: column; }
.stop-list__leg { margin: -9px -9px 7px; padding: 6px 9px; border-radius: 9px 9px 0 0; color: #567169; background: #f2f6f4; font-size: 10px; }
.stop-list__title { display: flex; align-items: center; gap: 8px; }
.stop-list__title strong { overflow: hidden; color: #263d35; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.stop-list__title em { flex: none; padding: 2px 6px; border-radius: 5px; color: #d48618; background: #fff4dc; font-size: 10px; font-style: normal; font-weight: 800; }
.stop-list__goods { overflow: hidden; margin-top: 4px; color: #74847e; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.stop-list__time-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 7px; padding-top: 6px; border-top: 1px solid #edf2ef; }
.stop-list__time-grid > span { display: flex; min-width: 0; align-items: center; flex-direction: column; padding: 0 7px; border-right: 1px solid #e5ece8; text-align: center; }
.stop-list__time-grid > span:last-child { border-right: 0; }
.stop-list__time-grid small { color: #8c9994; font-size: 9px; }
.stop-list__time-grid strong { margin-top: 3px; color: #263c34; font-size: 14px; }
.stop-list__time-grid em { margin-top: 3px; padding: 2px 6px; border-radius: 99px; font-size: 9px; font-style: normal; }
.stop-list__actions { align-items: flex-start; flex-direction: column; padding: 12px 10px 0 0; }
.stop-list__actions button { min-width: 58px; padding: 7px 9px; font-size: 10px; }
.stop-list__depot { margin-bottom: 0 !important; padding: 12px; border-color: #dfe8e3 !important; }
.stop-list__depot > span + span { display: flex; flex-direction: column; }
.stop-list__depot strong { font-size: 14px; }
.stop-list__depot small { font-size: 11px; }
.unassigned-list { padding: 0 16px 16px; }
.unassigned-list > button:not(.unassigned-list__assign) { padding: 12px; }
.unassigned-list strong { font-size: 13px; }
.unassigned-list small { font-size: 11px; }
.control-panel__empty strong { font-size: 15px; }
.control-panel__empty p { font-size: 12px; }

.control-panel {
  border: 0;
  border-radius: 0;
}

/* Keep the selected route identity on one line and share the first summary row with actions. */
.control-panel__header > div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 9px;
}

.control-panel__header > div > span,
.control-panel__header > div > h2 {
  flex: none;
}

.control-panel__header > div > p {
  overflow: hidden;
  margin-top: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-detail.is-dispatch,
.route-detail.is-loading {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(190px, .72fr) minmax(290px, 1.28fr);
  grid-template-rows: auto auto auto auto auto minmax(0, 1fr);
}

.route-detail.is-dispatch .route-detail__actions,
.route-detail.is-loading .route-detail__actions {
  grid-column: 1;
  grid-row: 1;
}

.route-detail.is-dispatch .route-detail__plan-time,
.route-detail.is-loading .route-detail__plan-time {
  grid-column: 2;
  grid-row: 1;
  margin: 6px 12px 0 0;
}

.route-detail.is-dispatch .route-detail__permission,
.route-detail.is-loading .route-detail__permission {
  grid-column: 1 / -1;
  grid-row: 2;
}

.route-detail.is-dispatch .route-detail__progress,
.route-detail.is-loading .route-detail__progress {
  grid-column: 1 / -1;
  grid-row: 3;
}

.route-detail.is-dispatch .route-detail__distance-line,
.route-detail.is-loading .route-detail__distance-line {
  grid-column: 1 / -1;
  grid-row: 4;
}

.route-detail.is-dispatch .route-detail__list-head,
.route-detail.is-loading .route-detail__list-head {
  grid-column: 1 / -1;
  grid-row: 5;
}

.route-detail.is-dispatch .stop-list,
.route-detail.is-loading .stop-list {
  grid-column: 1 / -1;
  grid-row: 6;
}

@media (max-width: 1260px) {
  .route-detail.is-dispatch,
  .route-detail.is-loading {
    grid-template-columns: minmax(175px, .7fr) minmax(260px, 1.3fr);
  }
}

/* Desktop route sheet: compact overview and table rows matching the approved reference. */
.control-panel {
  border: 1px solid #dce5e1;
  border-radius: 10px;
  background: #fff;
}

.route-switcher {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  overflow: visible;
  padding: 10px;
}

.route-switcher.is-single {
  grid-template-columns: minmax(0, 1fr);
}

.route-switcher button {
  width: 100%;
  min-width: 0;
  min-height: 58px;
  padding: 8px 10px;
  border-radius: 8px;
}

.route-switcher strong {
  font-size: 13px;
}

.route-switcher small {
  margin-top: 4px;
  font-size: 10px;
}

.route-detail,
.route-detail.is-dispatch,
.route-detail.is-loading {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.route-detail__overview {
  display: grid;
  flex: none;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: stretch;
  border-bottom: 1px solid #e6ece9;
  background: #fff;
}

.route-detail__metrics {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(6, minmax(74px, 1fr));
  margin: 0;
  padding: 14px 8px;
}

.route-detail__metrics > div {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border-left: 1px solid #e5ebe8;
  text-align: center;
}

.route-detail__metrics > div:first-child {
  border-left: 0;
}

.route-detail__metrics dt {
  order: 2;
  margin-top: 5px;
  color: #7d8b86;
  font-size: 9px;
}

.route-detail__metrics dd {
  order: 1;
  overflow: hidden;
  margin: 0;
  color: #14241f;
  font-size: 14px;
  line-height: 1.15;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-detail__metrics > div:nth-child(n + 4) dd {
  color: #078249;
}

.route-detail__actions,
.route-detail.is-dispatch .route-detail__actions,
.route-detail.is-loading .route-detail__actions {
  display: flex;
  grid-column: auto;
  grid-row: auto;
  min-width: 126px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 6px;
  padding: 9px 11px;
  border: 0;
  border-left: 1px solid #e5ebe8;
}

.route-detail__actions button,
.route-detail__actions button.primary {
  width: 100%;
  min-height: 34px;
  padding: 7px 12px;
  border: 1px solid #0c8752;
  border-radius: 6px;
  color: #087b49;
  background: #fff;
  font-size: 11px;
}

.route-detail__actions button.primary {
  color: #fff;
  background: #07864d;
}

.route-detail__permission {
  padding: 6px 12px;
  border-bottom: 1px solid #edf1ef;
  font-size: 10px;
}

.route-detail__progress {
  flex: none;
  margin: 7px 12px 0;
}

.route-detail__list-head,
.route-detail.is-dispatch .route-detail__list-head,
.route-detail.is-loading .route-detail__list-head {
  grid-column: auto;
  grid-row: auto;
  flex: none;
  padding: 12px 12px 8px;
}

.route-detail__list-head strong {
  font-size: 15px;
}

.stop-list__columns {
  display: grid;
  flex: none;
  grid-template-columns: 38px minmax(120px, 1.55fr) minmax(76px, .82fr) minmax(72px, .72fr) repeat(4, minmax(60px, .62fr)) 72px;
  align-items: center;
  min-height: 36px;
  margin: 0 10px;
  padding: 0 8px;
  border: 1px solid #e2e8e5;
  border-radius: 7px 7px 0 0;
  color: #697873;
  background: #f7f9f8;
  font-size: 9px;
  text-align: center;
}

.stop-list__columns span:nth-child(2) {
  text-align: left;
}

.stop-list,
.route-detail.is-dispatch .stop-list,
.route-detail.is-loading .stop-list {
  grid-column: auto;
  grid-row: auto;
  min-height: 0;
  flex: 1;
  margin: 0 10px 10px;
  padding: 0;
  overflow-y: auto;
  border: 1px solid #e2e8e5;
  border-top: 0;
  border-radius: 0 0 7px 7px;
  background: #fff;
}

.stop-list li,
.stop-list li.active {
  position: relative;
  margin: 0;
  border: 0;
  border-bottom: 1px solid #e9eeeb;
  border-radius: 0;
  background: #fff;
  box-shadow: none;
}

.stop-list li.active {
  background: #f1faf6;
}

.stop-list li:last-child {
  border-bottom: 0;
}

.stop-list__row {
  display: flex;
  min-width: 0;
  align-items: stretch;
}

.stop-list__select {
  display: grid;
  min-width: 0;
  flex: 1;
  grid-template-columns: 38px minmax(120px, 1.55fr) minmax(76px, .82fr) minmax(72px, .72fr) repeat(4, minmax(60px, .62fr));
  gap: 0;
  align-items: center;
  padding: 0 8px;
  text-align: center;
}

.stop-list__select > span {
  min-width: 0;
  padding: 12px 7px;
  border-left: 1px solid #eef2f0;
}

.stop-list__select > span:first-child,
.stop-list__select > span:nth-child(2) {
  border-left: 0;
}

.stop-list__sequence {
  position: relative;
  width: 28px;
  height: 28px;
  padding: 0 !important;
  color: #fff;
  background: #07894e;
  font-size: 12px;
}

.stop-list__customer {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  text-align: left;
}

.stop-list__customer strong {
  overflow: hidden;
  max-width: 100%;
  color: #15251f;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-list__customer small {
  overflow: hidden;
  max-width: 100%;
  margin-top: 5px;
  color: #6d7d77;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-list__window {
  color: #e17b08;
  font-size: 10px;
  font-weight: 700;
}

.stop-list__leg {
  margin: 0;
  color: #5c6d67;
  background: transparent;
  font-size: 10px;
}

.stop-list__value {
  color: #182821;
  font-size: 12px;
  font-weight: 700;
}

.stop-list__status {
  justify-self: center;
  padding: 3px 7px !important;
  border: 0 !important;
  border-radius: 99px;
  color: #07884e;
  background: #e6f7ef;
  font-size: 10px;
  font-weight: 700;
}

.stop-list__actions {
  display: flex;
  box-sizing: border-box;
  width: 72px;
  min-width: 72px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  padding: 7px 6px;
  border-left: 1px solid #eef2f0;
}

.stop-list__actions button {
  width: 100%;
  min-width: 0;
  padding: 5px 3px;
  font-size: 8px;
}

.stop-list__depot {
  display: grid;
  min-height: 52px;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 0;
  align-items: center;
  margin: 0 !important;
  padding: 0 15px;
  border: 0 !important;
}

.stop-list__depot > span:first-child {
  width: 28px;
  height: 28px;
  color: #fff;
  background: #263e35;
}

.stop-list__depot > .stop-list__depot-copy {
  display: flex;
  width: auto;
  height: auto;
  min-width: 0;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;
  padding: 0 10px;
  border-radius: 0;
  color: #263d35;
  background: transparent;
  text-align: left;
}

.stop-list__depot-copy small {
  overflow: hidden;
  max-width: 100%;
  color: #61736c;
  font-size: 10px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stop-list__depot-copy strong {
  margin-top: 3px;
  color: #263d35;
}

.stop-list__depot-time {
  justify-self: end;
  padding-right: 8px;
  color: #7b8984;
  font-size: 11px;
  white-space: nowrap;
}

.stop-list__depot strong {
  font-size: 12px;
}

.return-pickup-badge {
  display: inline-block;
  width: fit-content;
  margin-top: 3px;
  padding: 2px 6px;
  border-radius: 9px;
  color: #a04c25;
  background: #fff0e7;
  font-size: 9px;
  font-weight: 800;
}

@media (max-width: 1260px) {
  .route-detail__metrics {
    grid-template-columns: repeat(3, minmax(76px, 1fr));
    row-gap: 9px;
  }

  .route-detail__metrics > div:nth-child(4) {
    border-left: 0;
  }

  .stop-list__columns,
  .stop-list__select {
    grid-template-columns: 38px minmax(112px, 1.5fr) minmax(72px, .85fr) minmax(70px, .75fr) repeat(4, minmax(58px, .65fr));
  }

  .stop-list__columns {
    grid-template-columns: 38px minmax(112px, 1.5fr) minmax(72px, .85fr) minmax(70px, .75fr) repeat(4, minmax(58px, .65fr)) 72px;
  }
}
</style>
