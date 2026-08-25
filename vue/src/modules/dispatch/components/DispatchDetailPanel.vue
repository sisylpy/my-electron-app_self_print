<template>
  <aside class="detail-panel" aria-label="地图和客户详情">
    <ReadOnlyDispatchMap
      :map-overview="mapOverview"
      :selected-stop="selectedStop"
      @select-marker="$emit('select-marker', $event)"
    />

    <section class="customer-detail" aria-labelledby="customer-detail-title">
      <div class="customer-detail__header">
        <div>
          <p>当前选择</p>
          <h2 id="customer-detail-title">客户详情</h2>
        </div>
        <span>只读</span>
      </div>

      <template v-if="selectedStop">
        <div class="customer-detail__hero">
          <span>{{ initial(selectedStop.customerName || selectedStop.name) }}</span>
          <div>
            <strong>{{ selectedStop.customerName || selectedStop.name || '未命名客户' }}</strong>
            <small>{{ selectedStop._phaseLabel }} · {{ selectedStop._driverName }}</small>
          </div>
          <em>{{ selectedStop._displayStatus }}</em>
        </div>

        <dl class="customer-detail__fields">
          <div class="customer-detail__field customer-detail__field--wide">
            <dt>地址</dt>
            <dd>{{ selectedStop._customerAddress }}</dd>
          </div>
          <div class="customer-detail__field customer-detail__field--wide">
            <dt>商品</dt>
            <dd>{{ selectedStop.goodsSummary || '服务端未返回商品摘要' }}</dd>
          </div>
          <div class="customer-detail__field">
            <dt>配送状态</dt>
            <dd>{{ selectedStop._displayStatus }}</dd>
          </div>
          <div class="customer-detail__field">
            <dt>负责司机</dt>
            <dd>{{ selectedStop._driverName }}</dd>
          </div>
          <div class="customer-detail__field">
            <dt>计划到达</dt>
            <dd>{{ selectedStop.plannedArrivalLabel || selectedStop.estimateArriveTime || '—' }}</dd>
          </div>
          <div class="customer-detail__field">
            <dt>时间窗</dt>
            <dd>{{ selectedStop.customerWindowLabel || selectedStop.windowLabel || '—' }}</dd>
          </div>
          <div class="customer-detail__field">
            <dt>服务时长</dt>
            <dd>{{ selectedStop.serviceDurationLabel || selectedStop.unloadDurationText || '—' }}</dd>
          </div>
          <div class="customer-detail__field">
            <dt>距上一站</dt>
            <dd>{{ selectedStop.legText || selectedStop.distanceText || '—' }}</dd>
          </div>
        </dl>

        <div class="customer-detail__timeline">
          <h3>配送时间线</h3>
          <div>
            <span></span>
            <p>
              <strong>计划到达</strong>
              <small>{{ selectedStop.plannedArrivalLabel || selectedStop.estimateArriveTime || '时间待服务端计算' }}</small>
            </p>
          </div>
          <div>
            <span></span>
            <p>
              <strong>计划离开</strong>
              <small>{{ selectedStop.plannedDepartureLabel || selectedStop.estimateLeaveTime || '时间待服务端计算' }}</small>
            </p>
          </div>
          <div>
            <span></span>
            <p>
              <strong>当前状态</strong>
              <small>{{ selectedStop._displayStatus }}</small>
            </p>
          </div>
        </div>
      </template>

      <div v-else class="customer-detail__empty">
        <strong>选择一个客户站点</strong>
        <span>可从左侧订单、中间路线或地图标记进行选择。</span>
      </div>
    </section>
  </aside>
</template>

<script setup>
import ReadOnlyDispatchMap from '@/modules/map/components/ReadOnlyDispatchMap.vue';

defineProps({
  mapOverview: {
    type: Object,
    default: () => ({}),
  },
  selectedStop: {
    type: Object,
    default: null,
  },
});

defineEmits(['select-marker']);

function initial(name) {
  return String(name || '客').trim().slice(0, 1);
}
</script>

<style scoped>
.detail-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 14px;
  overflow: auto;
  padding: 14px;
  border: 1px solid #dce5ee;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 30px rgba(33, 54, 85, .05);
}

.customer-detail {
  padding-top: 14px;
  border-top: 1px solid #e7edf3;
}

.customer-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.customer-detail__header h2,
.customer-detail__header p {
  margin: 0;
}

.customer-detail__header h2 {
  color: #172033;
  font-size: 17px;
}

.customer-detail__header p {
  margin-bottom: 3px;
  color: #8190a4;
  font-size: 10px;
}

.customer-detail__header > span {
  padding: 4px 9px;
  border-radius: 99px;
  color: #42617c;
  background: #eef4f8;
  font-size: 10px;
  font-weight: 700;
}

.customer-detail__hero {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(110deg, #f0f6ff, #f8fbff);
}

.customer-detail__hero > span {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  background: #3873c3;
  font-size: 14px;
  font-weight: 800;
}

.customer-detail__hero > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.customer-detail__hero strong {
  overflow: hidden;
  color: #223148;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-detail__hero small {
  margin-top: 4px;
  color: #6e7e93;
  font-size: 10px;
}

.customer-detail__hero em {
  padding: 5px 7px;
  border-radius: 99px;
  color: #2a659e;
  background: #e5f0fb;
  font-size: 9px;
  font-style: normal;
  font-weight: 700;
}

.customer-detail__fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 10px 0 0;
}

.customer-detail__field {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #e6ebf0;
  border-radius: 9px;
}

.customer-detail__field--wide {
  grid-column: 1 / -1;
}

.customer-detail__field dt {
  color: #8a97a8;
  font-size: 9px;
}

.customer-detail__field dd {
  overflow-wrap: anywhere;
  margin: 4px 0 0;
  color: #34445a;
  font-size: 11px;
  font-weight: 650;
}

.customer-detail__timeline {
  margin-top: 14px;
}

.customer-detail__timeline h3 {
  margin: 0 0 8px;
  color: #53647a;
  font-size: 11px;
}

.customer-detail__timeline > div {
  position: relative;
  display: grid;
  grid-template-columns: 15px 1fr;
  gap: 8px;
  padding-bottom: 9px;
}

.customer-detail__timeline > div:not(:last-child)::after {
  position: absolute;
  top: 10px;
  bottom: -2px;
  left: 4px;
  width: 1px;
  background: #d7e0e9;
  content: '';
}

.customer-detail__timeline > div > span {
  z-index: 1;
  width: 9px;
  height: 9px;
  margin-top: 3px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: #477cbd;
  box-shadow: 0 0 0 1px #9cb7d6;
}

.customer-detail__timeline p {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.customer-detail__timeline strong {
  color: #4e5f74;
  font-size: 10px;
}

.customer-detail__timeline small {
  margin-top: 2px;
  color: #7e8b9c;
  font-size: 9px;
}

.customer-detail__empty {
  display: grid;
  min-height: 180px;
  place-items: center;
  align-content: center;
  color: #8190a4;
  text-align: center;
}

.customer-detail__empty strong {
  color: #596a7e;
  font-size: 12px;
}

.customer-detail__empty span {
  max-width: 270px;
  margin-top: 5px;
  font-size: 9px;
}
</style>
