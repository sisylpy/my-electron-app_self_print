<template>
  <section class="workspace" aria-labelledby="route-workspace-title">
    <div class="workspace__top">
      <div>
        <p>服务端实时方案</p>
        <h2 id="route-workspace-title">路线工作区</h2>
      </div>
      <div class="workspace__phase-tabs" role="tablist" aria-label="调度阶段">
        <button
          v-for="item in phases"
          :key="item.key"
          type="button"
          :class="{ active: activePhase === item.key }"
          role="tab"
          :aria-selected="activePhase === item.key"
          @click="$emit('select-phase', item.key)"
        >
          {{ item.label }}
          <span>{{ item.count }}</span>
        </button>
      </div>
    </div>

    <div v-if="pageHeader || topMetrics" class="workspace__summary">
      <div class="workspace__summary-copy">
        <span>{{ pageHeader?.scheduleBannerLine || '今日调度' }}</span>
        <strong>{{ pageHeader?.progress?.mainLine || pageHeader?.statusLabel || '等待服务端调度数据' }}</strong>
      </div>
      <dl>
        <div>
          <dt>司机</dt>
          <dd>{{ topMetrics?.driverCount ?? '—' }}</dd>
        </div>
        <div>
          <dt>站点</dt>
          <dd>{{ topMetrics?.customerStopCount ?? '—' }}</dd>
        </div>
        <div>
          <dt>里程</dt>
          <dd>{{ topMetrics?.totalDistanceText || '—' }}</dd>
        </div>
        <div>
          <dt>时长</dt>
          <dd>{{ topMetrics?.totalDurationText || '—' }}</dd>
        </div>
      </dl>
    </div>

    <div v-if="snapshotStatus === 'loading'" class="workspace__state">
      <span class="workspace__spinner"></span>
      <strong>正在读取路线</strong>
      <p>数据来自 nongxinle-server</p>
    </div>

    <div v-else-if="snapshotError && !routes.length" class="workspace__state workspace__state--error">
      <span>!</span>
      <strong>该阶段读取失败</strong>
      <p>{{ snapshotError }}</p>
    </div>

    <div v-else-if="routes.length" class="workspace__routes">
      <article
        v-for="route in routes"
        :key="route._routeKey"
        class="route-card"
        :class="{ selected: selectedRouteKey === route._routeKey }"
      >
        <button type="button" class="route-card__header" @click="$emit('select-route', route)">
          <span class="route-card__driver">
            <i>{{ initial(route.driverName) }}</i>
            <span>
              <strong>{{ route.driverName || '未命名司机' }}</strong>
              <small>{{ route.driverStatusLabel || route._phaseLabel }}</small>
            </span>
          </span>
          <span class="route-card__headline">
            <strong>{{ route.routeSummary || route.routeStatsLine || `${route._stops.length} 个客户` }}</strong>
            <small>{{ route.scheduleHeadline || route.routeHeadlineLine || route.deliveryProgressLine || '服务端路线' }}</small>
          </span>
          <span class="route-card__badge">{{ route.badgeLabel || route._phaseLabel }}</span>
        </button>

        <div v-if="progressValue(route) !== null" class="route-card__progress">
          <div>
            <span>{{ route.deliveryProgressLine || '配送进度' }}</span>
            <strong>{{ progressValue(route) }}%</strong>
          </div>
          <i><b :style="{ width: `${progressValue(route)}%` }"></b></i>
        </div>

        <ol class="route-card__timeline" aria-label="站点顺序">
          <li
            v-for="(stop, index) in route._stops"
            :key="stop._stopKey"
            :class="{ active: selectedStopKey === stop._stopKey }"
          >
            <span class="route-card__connector"></span>
            <button type="button" @click="$emit('select-stop', stop)">
              <span class="route-card__seq">{{ stop.seq || index + 1 }}</span>
              <span class="route-card__stop-copy">
                <strong>{{ stop.customerName || stop.name || '未命名客户' }}</strong>
                <small>{{ stop.goodsSummary || '服务端未返回商品摘要' }}</small>
              </span>
              <span class="route-card__stop-time">
                <strong>{{ stop.timeRight || stop.estimateArriveTime || stop.plannedArrivalLabel || '—' }}</strong>
                <small>{{ stop._displayStatus }}</small>
              </span>
            </button>
            <em v-if="stop.legText || stop.legDistanceLabel">
              {{ stop.legText || stop.legDistanceLabel }}
            </em>
          </li>
          <li class="route-card__return">
            <span class="route-card__connector"></span>
            <div>
              <span class="route-card__seq route-card__seq--return">仓</span>
              <span class="route-card__stop-copy">
                <strong>返回仓库</strong>
                <small>{{ route.depotName || '配送中心' }}</small>
              </span>
              <span class="route-card__stop-time">
                <strong>{{ route.plannedReturnLabel || '—' }}</strong>
                <small>计划返仓</small>
              </span>
            </div>
          </li>
        </ol>
      </article>
    </div>

    <div v-else class="workspace__state">
      <span>○</span>
      <strong>暂无{{ activePhaseLabel }}路线</strong>
      <p v-if="activePhase === 'dispatch'">未分配客户可在左侧“待派”订单中查看。</p>
      <p v-else>当前结果以服务端调度状态为准。</p>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  activePhase: {
    type: String,
    required: true,
  },
  phaseCounts: {
    type: Object,
    required: true,
  },
  pageViewModel: {
    type: Object,
    default: null,
  },
  routes: {
    type: Array,
    default: () => [],
  },
  snapshotStatus: {
    type: String,
    default: 'idle',
  },
  snapshotError: {
    type: String,
    default: null,
  },
  selectedRouteKey: {
    type: String,
    default: null,
  },
  selectedStopKey: {
    type: String,
    default: null,
  },
});

defineEmits(['select-phase', 'select-route', 'select-stop']);

const phases = computed(() => [
  { key: 'dispatch', label: '分派中', count: props.phaseCounts.dispatch || 0 },
  { key: 'loading', label: '装车中', count: props.phaseCounts.loading || 0 },
  { key: 'delivery', label: '配送中', count: props.phaseCounts.delivery || 0 },
]);

const pageHeader = computed(() => props.pageViewModel?.pageHeader || null);
const topMetrics = computed(() => props.pageViewModel?.topMetrics || null);
const activePhaseLabel = computed(() => (
  phases.value.find((item) => item.key === props.activePhase)?.label || ''
));

function initial(name) {
  return String(name || '司').trim().slice(0, 1);
}

function progressValue(route) {
  const value = Number(route.deliveryProgressPercent);
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}
</script>

<style scoped>
.workspace {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  padding: 16px;
  border: 1px solid #dce5ee;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 30px rgba(33, 54, 85, .05);
}

.workspace__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.workspace__top h2,
.workspace__top p {
  margin: 0;
}

.workspace__top h2 {
  color: #19283e;
  font-size: 19px;
}

.workspace__top p {
  margin-bottom: 3px;
  color: #8190a4;
  font-size: 10px;
}

.workspace__phase-tabs {
  display: flex;
  gap: 5px;
  padding: 4px;
  border-radius: 10px;
  background: #eef2f6;
}

.workspace__phase-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 11px;
  border: 0;
  border-radius: 7px;
  color: #64738a;
  background: transparent;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.workspace__phase-tabs button.active {
  color: #1d57ad;
  background: #fff;
  box-shadow: 0 2px 8px rgba(31, 57, 91, .1);
}

.workspace__phase-tabs span {
  display: inline-grid;
  min-width: 19px;
  height: 19px;
  place-items: center;
  padding: 0 4px;
  border-radius: 99px;
  color: #5b6d85;
  background: #dde5ed;
  font-size: 9px;
}

.workspace__phase-tabs button.active span {
  color: #fff;
  background: #3a70bd;
}

.workspace__summary {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 18px;
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #e0e8f0;
  border-radius: 12px;
  background: linear-gradient(100deg, #f4f8fe, #fafcff);
}

.workspace__summary-copy {
  display: flex;
  min-width: 180px;
  flex-direction: column;
  justify-content: center;
}

.workspace__summary-copy span {
  color: #738399;
  font-size: 10px;
}

.workspace__summary-copy strong {
  margin-top: 4px;
  color: #24599e;
  font-size: 12px;
}

.workspace__summary dl {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(4, minmax(70px, 1fr));
  margin: 0;
}

.workspace__summary dl div {
  padding: 0 12px;
  border-left: 1px solid #dce5ef;
}

.workspace__summary dt {
  color: #8391a3;
  font-size: 9px;
}

.workspace__summary dd {
  margin: 4px 0 0;
  color: #24334a;
  font-size: 13px;
  font-weight: 800;
}

.workspace__routes {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 11px;
  overflow: auto;
  margin-top: 12px;
  padding-right: 3px;
}

.route-card {
  flex: none;
  overflow: hidden;
  border: 1px solid #dfe7ef;
  border-radius: 13px;
  background: #fff;
}

.route-card.selected {
  border-color: #78a2df;
  box-shadow: 0 0 0 2px rgba(65, 120, 196, .09);
}

.route-card__header {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(150px, .8fr) minmax(190px, 1.2fr) auto;
  gap: 16px;
  align-items: center;
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid #edf1f5;
  color: inherit;
  background: #fbfcfe;
  text-align: left;
  cursor: pointer;
}

.route-card__driver {
  display: flex;
  align-items: center;
  gap: 9px;
}

.route-card__driver > i {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  flex: none;
  border-radius: 10px;
  color: #fff;
  background: #356fbe;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}

.route-card__driver > span,
.route-card__headline {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.route-card__driver strong,
.route-card__headline strong {
  overflow: hidden;
  color: #223148;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-card__driver small,
.route-card__headline small {
  overflow: hidden;
  margin-top: 3px;
  color: #7c899a;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-card__badge {
  padding: 5px 8px;
  border-radius: 99px;
  color: #2d65ae;
  background: #eaf2ff;
  font-size: 9px;
  font-weight: 800;
}

.route-card__progress {
  padding: 10px 14px 5px;
}

.route-card__progress > div {
  display: flex;
  justify-content: space-between;
  color: #64748b;
  font-size: 10px;
}

.route-card__progress > div strong {
  color: #2665b7;
}

.route-card__progress > i {
  display: block;
  height: 5px;
  overflow: hidden;
  margin-top: 6px;
  border-radius: 99px;
  background: #e7edf4;
}

.route-card__progress b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #3a79cc, #27a77c);
}

.route-card__timeline {
  margin: 0;
  padding: 7px 14px 10px;
  list-style: none;
}

.route-card__timeline li {
  position: relative;
  padding: 0 0 0 9px;
}

.route-card__timeline li > button,
.route-card__return > div {
  display: grid;
  width: 100%;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  padding: 8px 7px;
  border: 0;
  border-radius: 9px;
  color: inherit;
  background: transparent;
  text-align: left;
}

.route-card__timeline li > button {
  cursor: pointer;
}

.route-card__timeline li > button:hover,
.route-card__timeline li.active > button {
  background: #f0f6ff;
}

.route-card__connector {
  position: absolute;
  z-index: 0;
  top: 39px;
  bottom: -9px;
  left: 29px;
  width: 2px;
  background: #dce5ee;
}

.route-card__return .route-card__connector {
  display: none;
}

.route-card__seq {
  z-index: 1;
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border: 3px solid #fff;
  border-radius: 50%;
  color: #fff;
  background: #3b75c3;
  box-shadow: 0 0 0 1px #bbcee7;
  font-size: 9px;
  font-weight: 800;
}

.route-card__seq--return {
  background: #334155;
}

.route-card__stop-copy,
.route-card__stop-time {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.route-card__stop-copy strong {
  overflow: hidden;
  color: #28374c;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-card__stop-copy small {
  overflow: hidden;
  margin-top: 3px;
  color: #7f8b9c;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-card__stop-time {
  align-items: end;
}

.route-card__stop-time strong {
  color: #334e70;
  font-size: 10px;
}

.route-card__stop-time small {
  margin-top: 3px;
  color: #73849a;
  font-size: 9px;
}

.route-card__timeline li > em {
  display: block;
  margin: -2px 0 2px 46px;
  color: #9aa6b4;
  font-size: 8px;
  font-style: normal;
}

.workspace__state {
  display: grid;
  min-height: 310px;
  flex: 1;
  place-items: center;
  align-content: center;
  color: #8190a4;
  text-align: center;
}

.workspace__state > span {
  display: grid;
  width: 35px;
  height: 35px;
  place-items: center;
  margin-bottom: 10px;
  border-radius: 50%;
  color: #52739b;
  background: #eaf0f6;
  font-size: 18px;
}

.workspace__state strong {
  color: #56677c;
  font-size: 13px;
}

.workspace__state p {
  max-width: 360px;
  margin: 5px 0 0;
  font-size: 10px;
}

.workspace__state--error > span {
  color: #a84545;
  background: #fff0f0;
}

.workspace__state--error p {
  color: #a84545;
}

.workspace__spinner {
  border: 3px solid #dfe8f2;
  border-top-color: #3a76c6;
  animation: route-spin .8s linear infinite;
}

@keyframes route-spin {
  to { transform: rotate(360deg); }
}
</style>
