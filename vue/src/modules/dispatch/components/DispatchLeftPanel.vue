<template>
  <aside class="left-panel" aria-label="订单和司机">
    <div class="left-panel__switch" role="tablist" aria-label="左栏内容">
      <button
        type="button"
        :class="{ active: mode === 'orders' }"
        role="tab"
        :aria-selected="mode === 'orders'"
        @click="mode = 'orders'"
      >
        订单
      </button>
      <button
        type="button"
        :class="{ active: mode === 'drivers' }"
        role="tab"
        :aria-selected="mode === 'drivers'"
        @click="mode = 'drivers'"
      >
        司机
      </button>
    </div>

    <template v-if="mode === 'orders'">
      <div class="left-panel__filters">
        <button
          v-for="filter in orderFilters"
          :key="filter.key"
          type="button"
          :class="{ active: orderFilter === filter.key }"
          @click="orderFilter = filter.key"
        >
          <span>{{ filter.label }}</span>
          <strong>{{ filter.count }}</strong>
        </button>
      </div>

      <div class="left-panel__section-title">
        <div>
          <p>{{ activeOrderFilter.hint }}</p>
          <h2>{{ activeOrderFilter.label }}</h2>
        </div>
        <span>{{ visibleOrders.length }} 单</span>
      </div>

      <div v-if="visibleOrders.length" class="left-panel__list">
        <button
          v-for="order in visibleOrders"
          :key="order._stopKey"
          type="button"
          class="order-card"
          :class="{ selected: selectedStopKey === order._stopKey }"
          @click="$emit('select-stop', order)"
        >
          <span class="order-card__sequence">{{ order.seq || '•' }}</span>
          <span class="order-card__main">
            <strong>{{ order.customerName || order.name || '未命名客户' }}</strong>
            <b v-if="order.isReturnPickup" class="return-pickup-badge">退货取货</b>
            <small>{{ order.goodsSummary || '服务端未返回商品摘要' }}</small>
            <em>{{ order._driverName }} · {{ order._phaseLabel }}</em>
          </span>
          <span class="order-card__status">{{ order._displayStatus }}</span>
        </button>
      </div>
      <div v-else class="left-panel__empty">
        <strong>暂无{{ activeOrderFilter.label }}</strong>
        <span>数据以服务端今日调度结果为准</span>
      </div>
    </template>

    <template v-else>
      <div class="left-panel__section-title left-panel__section-title--driver">
        <div>
          <p>在线状态按司机当班状态展示</p>
          <h2>司机列表</h2>
        </div>
        <span>{{ drivers.length }} 人</span>
      </div>

      <div v-if="drivers.length" class="left-panel__list">
        <button
          v-for="driver in drivers"
          :key="driver.driverUserId"
          type="button"
          class="driver-card"
          :class="{ selected: sameId(selectedDriverUserId, driver.driverUserId) }"
          @click="$emit('select-driver', driver)"
        >
          <span class="driver-card__avatar">{{ initial(driver.driverName) }}</span>
          <span class="driver-card__main">
            <span class="driver-card__name-line">
              <strong>{{ driver.driverName || '未命名司机' }}</strong>
              <em :class="{ online: driver._online }">
                <i></i>{{ driver._onlineLabel }}
              </em>
            </span>
            <small>{{ driver._taskLabel }}</small>
            <span class="driver-card__stage">{{ driver._stageLabel }}</span>
          </span>
        </button>
      </div>
      <div v-else class="left-panel__empty">
        <strong>暂无司机数据</strong>
        <span>请检查司机当班信息或稍后刷新</span>
      </div>
    </template>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  orders: {
    type: Object,
    required: true,
  },
  drivers: {
    type: Array,
    default: () => [],
  },
  selectedStopKey: {
    type: String,
    default: null,
  },
  selectedDriverUserId: {
    type: [String, Number],
    default: null,
  },
});

defineEmits(['select-stop', 'select-driver']);

const mode = ref('orders');
const orderFilter = ref('today');

const orderFilters = computed(() => [
  { key: 'today', label: '今日', hint: '今日全部调度站点', count: props.orders.today?.length || 0 },
  { key: 'pending', label: '待派', hint: '分派中与未分配客户', count: props.orders.pending?.length || 0 },
  { key: 'delivery', label: '配送中', hint: '已进入配送执行的客户', count: props.orders.delivery?.length || 0 },
]);

const activeOrderFilter = computed(() => (
  orderFilters.value.find((filter) => filter.key === orderFilter.value) || orderFilters.value[0]
));

const visibleOrders = computed(() => props.orders[orderFilter.value] || []);

function initial(name) {
  return String(name || '司').trim().slice(0, 1);
}

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right);
}
</script>

<style scoped>
.left-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  padding: 14px;
  border: 1px solid #dde5ee;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 30px rgba(33, 54, 85, .05);
}

.left-panel__switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  border-radius: 11px;
  background: #edf2f7;
}

.left-panel__switch button {
  padding: 9px 12px;
  border: 0;
  border-radius: 8px;
  color: #66758b;
  background: transparent;
  font-weight: 700;
  cursor: pointer;
}

.left-panel__switch button.active {
  color: #1f4fa3;
  background: #fff;
  box-shadow: 0 2px 9px rgba(35, 62, 98, .1);
}

.left-panel__filters {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin: 13px 0;
}

.left-panel__filters button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 9px;
  border: 1px solid #e1e8ef;
  border-radius: 9px;
  color: #66758b;
  background: #fff;
  cursor: pointer;
}

.left-panel__filters button.active {
  border-color: #93b8f0;
  color: #1d57ad;
  background: #eff6ff;
}

.left-panel__filters span {
  font-size: 12px;
}

.left-panel__filters strong {
  font-size: 13px;
}

.left-panel__section-title {
  display: flex;
  align-items: end;
  justify-content: space-between;
  padding: 4px 2px 11px;
  border-bottom: 1px solid #edf1f5;
}

.left-panel__section-title--driver {
  margin-top: 14px;
}

.left-panel__section-title h2,
.left-panel__section-title p {
  margin: 0;
}

.left-panel__section-title h2 {
  color: #1d2b40;
  font-size: 16px;
}

.left-panel__section-title p {
  margin-bottom: 3px;
  color: #8290a3;
  font-size: 10px;
}

.left-panel__section-title > span {
  color: #697a91;
  font-size: 11px;
}

.left-panel__list {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding-top: 10px;
}

.order-card,
.driver-card {
  width: 100%;
  border: 1px solid #e1e7ee;
  border-radius: 11px;
  color: inherit;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.order-card:hover,
.driver-card:hover {
  border-color: #a9c2e8;
}

.order-card.selected,
.driver-card.selected {
  border-color: #4c83d7;
  background: #f3f7ff;
  box-shadow: 0 0 0 2px rgba(76, 131, 215, .1);
}

.order-card {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
  padding: 11px 10px;
}

.order-card__sequence {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border-radius: 7px;
  color: #2d66b8;
  background: #eaf2ff;
  font-size: 11px;
  font-weight: 800;
}

.order-card__main,
.driver-card__main {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.order-card__main strong {
  overflow: hidden;
  color: #213047;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-card__main small {
  overflow: hidden;
  margin-top: 4px;
  color: #68788f;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-card__main em {
  margin-top: 6px;
  color: #8795a8;
  font-size: 10px;
  font-style: normal;
}

.order-card__status {
  max-width: 72px;
  padding: 4px 6px;
  border-radius: 99px;
  color: #42617c;
  background: #edf3f7;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
}

.driver-card {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 10px;
  padding: 11px;
}

.driver-card__avatar {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, #3877d3, #1e4e98);
  font-size: 14px;
  font-weight: 800;
}

.driver-card__name-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.driver-card__name-line strong {
  color: #213047;
  font-size: 13px;
}

.driver-card__name-line em {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #8b98a9;
  font-size: 10px;
  font-style: normal;
}

.driver-card__name-line i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a5b0bd;
}

.driver-card__name-line em.online {
  color: #18815c;
}

.driver-card__name-line em.online i {
  background: #20a875;
  box-shadow: 0 0 0 3px rgba(32, 168, 117, .12);
}

.driver-card__main small {
  overflow: hidden;
  margin-top: 5px;
  color: #6d7d92;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.driver-card__stage {
  margin-top: 5px;
  color: #3568b2;
  font-size: 10px;
  font-weight: 700;
}

.left-panel__empty {
  display: grid;
  min-height: 180px;
  place-items: center;
  align-content: center;
  color: #8693a5;
  text-align: center;
}

.left-panel__empty strong {
  color: #5e6c7e;
  font-size: 13px;
}

.left-panel__empty span {
  margin-top: 6px;
  font-size: 10px;
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
</style>
