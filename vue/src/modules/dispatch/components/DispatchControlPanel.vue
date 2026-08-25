<template>
  <aside class="control-panel" aria-label="路线与调度操作">
    <header class="control-panel__header">
      <div>
        <span>{{ phaseCopy.eyebrow }}</span>
        <h2>{{ selectedRoute?.driverName || phaseCopy.title }}</h2>
        <p v-if="selectedRoute">
          {{ selectedRoute._stops.length }} 个客户 ·
          {{ selectedRoute.totalRoundTripDistanceText || selectedRoute.totalDistanceText || '路线已生成' }} ·
          {{ selectedRoute.totalRoundTripDurationText || selectedRoute.totalDurationText || '等待时长' }}
        </p>
        <p v-else>{{ phaseCopy.hint }}</p>
      </div>
      <strong>{{ historicalPlan ? '历史计划' : `${routes.length} 条路线` }}</strong>
    </header>

    <section v-if="routes.length > 1" class="route-switcher" aria-label="司机路线">
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

    <section v-if="selectedRoute" class="route-detail">
      <div v-if="activePhase === 'dispatch'" class="route-detail__actions">
        <button
          type="button"
          :disabled="!canEditRoute || submitting"
          @click="$emit('edit-route', selectedRoute)"
        >
          调整路线
        </button>
        <button
          type="button"
          :disabled="!canAssignDriver || submitting"
          @click="$emit('assign-driver')"
        >
          更换司机
        </button>
        <button
          type="button"
          class="primary"
          :disabled="!canConfirmDispatch || submitting"
          @click="$emit('confirm-dispatch')"
        >
          {{ submitting ? '正在确认…' : '确认这条路线' }}
        </button>
      </div>
      <p v-if="activePhase === 'dispatch' && actionHint" class="route-detail__permission">
        {{ actionHint }}
      </p>

      <div v-if="activePhase === 'dispatch'" class="route-detail__plan-time">
        <span><small>建议出发</small><strong>{{ selectedRoute.plannedDepartLabel || '等待服务端计算' }}</strong></span>
        <span><small>首站预计到达</small><strong>{{ firstArrivalLabel }}</strong></span>
        <span><small>预计返回</small><strong>{{ selectedRoute.plannedReturnLabel || '—' }}</strong></span>
      </div>

      <div class="route-detail__list-head">
        <strong>配送顺序</strong>
        <span>点击客户，地图同步定位</span>
      </div>

      <ol class="stop-list">
        <li
          v-for="(stop, index) in selectedRoute._stops"
          :key="stop._stopKey"
          :class="{ active: selectedStopKey === stop._stopKey }"
        >
          <button type="button" @click="$emit('select-stop', stop)">
            <span class="stop-list__sequence">{{ stop.seq || index + 1 }}</span>
            <span class="stop-list__copy">
              <strong>{{ stop.customerName || stop.name || '未命名客户' }}</strong>
              <small>{{ stop.goodsSummary || stop._customerAddress }}</small>
              <em v-if="stop.legText || stop.legDistanceLabel">
                {{ stop.legText || stop.legDistanceLabel }}
              </em>
            </span>
            <span class="stop-list__time">
              <strong>{{ stop.timeRight || stop.plannedArrivalLabel || stop.estimateArriveTime || '—' }}</strong>
              <small>{{ displayStatus(stop) }}</small>
            </span>
          </button>
        </li>
        <li class="stop-list__depot">
          <span>仓</span>
          <strong>{{ selectedRoute.returnToDepot === false ? '末站结束' : '返回仓库' }}</strong>
          <small>{{ selectedRoute.plannedReturnLabel || '等待服务端计算' }}</small>
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
        :class="{ active: selectedStopKey === stop._stopKey }"
        @click="$emit('select-stop', stop)"
      >
        <span>?</span>
        <span>
          <strong>{{ stop.customerName || '未命名客户' }}</strong>
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
  const stop = selectedRoute.value?._stops?.[0];
  return stop?.timeRight || stop?.plannedArrivalLabel || stop?.estimateArriveTime || '—';
});

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
</script>

<style scoped>
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

.stop-list button {
  display: grid;
  width: 100%;
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
</style>
