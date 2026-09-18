<template>
  <section class="order-flow" aria-label="进行中订单工作台">
    <Teleport to="#product-header-context">
      <div class="order-flow__header-tools" aria-label="客户操作">
        <label class="order-flow__search">
          <span aria-hidden="true">⌕</span>
          <input v-model="query" type="search" placeholder="搜索客户" aria-label="搜索客户">
        </label>
        <button type="button" class="order-flow__new-order" title="新建订单" aria-label="新建订单" @click="$emit('new-order')">＋</button>
      </div>
    </Teleport>
    <aside class="order-flow__queue">
      <div v-if="activeListError" class="order-flow__notice is-error">
        <span>{{ activeListError }}</span>
        <button type="button" @click="$emit('refresh-list')">重新读取</button>
      </div>
      <div v-else-if="activeListLoading && !filteredCustomers.length" class="order-flow__notice">
        {{ smartMode ? '正在读取订单提醒客户…' : '正在读取订单…' }}
      </div>
      <div v-else-if="!visibleCustomers.length" class="order-flow__notice">
        {{ query.trim() ? '没有匹配的客户' : emptyMessage }}
      </div>

      <div v-else class="order-flow__list">
        <button
          v-for="customer in visibleCustomers"
          :key="customerId(customer)"
          type="button"
          :class="{ 'is-active': isSelected(customer) }"
          @click="$emit('select-customer', customer)"
        >
          <span class="order-flow__queue-head">
            <strong>{{ customerName(customer) }}</strong>
            <span v-if="!smartMode && stats(customer).needsReview > 0" class="order-flow__pending">
              ({{ stats(customer).needsReview }}个待处理)
            </span>
          </span>
          <span v-if="!smartMode" class="order-flow__queue-metrics">
            <span>商品: {{ stats(customer).total }}个</span>
            <span>金额: {{ stats(customer).subtotalText }}元</span>
            <span>有单价: <em :class="{ 'is-incomplete': stats(customer).priced < stats(customer).total }">{{ stats(customer).priced }}个</em></span>
            <span>已出库: <em :class="{ 'is-incomplete': stats(customer).weighted < stats(customer).total }">{{ stats(customer).weighted }}个</em></span>
          </span>
          <span v-if="smartMode" class="order-flow__queue-state">查看提醒</span>
        </button>
      </div>
    </aside>

    <div class="order-flow__detail">
      <template v-if="selectedCustomer">
        <header class="order-flow__detail-header">
          <div class="order-flow__customer-title">
            <h2>{{ customerName(selectedCustomer) }}</h2>
          </div>
          <div
            v-if="smartMode && reminderSummary"
            class="order-flow__reminder-summary"
            aria-label="今日订单提醒统计"
          >
            <article class="is-reminder">
              <span>待提醒</span><strong>{{ reminderSummary.reminderProducts }}</strong><em>种</em>
            </article>
            <article class="is-matched">
              <span>预估已订</span><strong>{{ reminderSummary.matchedProducts }}</strong><em>种</em>
            </article>
            <article class="is-customer-ordered">
              <span>客户自订</span><strong>{{ reminderSummary.customerOrderedProducts }}</strong><em>种</em>
            </article>
          </div>
          <div class="order-flow__detail-actions">
            <button type="button" class="is-secondary" :disabled="detailLoading" @click="$emit('refresh-detail')">
              {{ detailLoading ? '读取中…' : '刷新' }}
            </button>
            <button
              type="button"
              :class="['is-smart', { 'is-active': smartMode }]"
              :aria-pressed="smartMode"
              @click="toggleSmartMode"
            >
              订单提醒
            </button>
            <button type="button" class="is-primary" @click="$emit('continue-order', selectedCustomer)">
              ＋ 追加订单
            </button>
          </div>
        </header>

        <div v-if="smartMode" class="order-flow__workspace is-smart">
          <SmartReplenishmentComparison
            :distributer-id="distributerId"
            :selected-customer="selectedCustomer"
            :snapshot="snapshot"
            :actual-loading="detailLoading"
            :actual-error="detailError"
            @retry-actual="$emit('refresh-detail')"
            @summary-change="reminderSummary = $event"
          />
        </div>

        <div v-else-if="detailError && stageFilter !== 'review'" class="order-flow__detail-state is-error">
          <strong>订单暂未读取成功</strong>
          <span>{{ detailError }}</span>
          <button type="button" @click="$emit('refresh-detail')">重新读取</button>
        </div>
        <div v-else-if="detailLoading && stageFilter !== 'review'" class="order-flow__detail-state">
          <i></i>
          <strong>正在读取最新状态</strong>
        </div>

        <div v-else-if="stageFilter === 'review'" class="order-flow__workspace is-review">
          <TaskOrderWorkspace
            :key="`task:${customerId(selectedCustomer)}`"
            :selected-all-customer="customerId(selectedCustomer)"
            :selected-sub-department="null"
            @order-saved="handleTaskChanged"
            @order-updated="handleTaskChanged"
            @task-list-changed="handleTaskChanged"
            @taskListChanged="handleTaskChanged"
          />
        </div>

        <div v-else-if="stageFilter === 'all' || stageFilter === 'progress' || stageFilter === 'price'" class="order-flow__stage-page is-progress">
          <div class="order-flow__progress-orders">
            <TodayOrders
              :today-order-list="stageOrders"
              :today-order-dep-arr="stageDepartments"
              :today-order-trade-no="snapshot.tradeNo"
              :has-sub-departments="snapshot.hasSubDepartments"
              :selected-sub-department="null"
              :today-order-total="stageTotal"
              :selected-all-customer="customerId(selectedCustomer)"
              :selected-customer-name="customerName(selectedCustomer)"
              :selected-customer-entity="selectedCustomer"
              :selected-customer-dep-print-name="selectedCustomer.nxDepartmentPrintName || 'ApplyPanel'"
              @order-updated="handleOrdersChanged"
              @order-deleted="handleOrdersChanged"
            />
          </div>
        </div>

        <div v-else class="order-flow__workspace is-orders">
          <TodayOrders
            batch-print-mode
            :today-order-list="stageOrders"
            :today-order-dep-arr="stageDepartments"
            :today-order-trade-no="snapshot.tradeNo"
            :has-sub-departments="snapshot.hasSubDepartments"
            :selected-sub-department="null"
            :today-order-total="stageTotal"
            :selected-all-customer="customerId(selectedCustomer)"
            :selected-customer-name="customerName(selectedCustomer)"
            :selected-customer-entity="selectedCustomer"
            :selected-customer-dep-print-name="selectedCustomer.nxDepartmentPrintName || 'ApplyPanel'"
            @order-updated="handleOrdersChanged"
            @order-deleted="handleOrdersChanged"
          />
        </div>
      </template>

      <div v-else class="order-flow__detail-state">
        <div class="order-flow__empty-mark">单</div>
        <strong>{{ emptyMessage }}</strong>
        <span>可以选择其他阶段，或直接新建订单</span>
        <button v-if="allCustomers.length" type="button" class="is-smart-entry" @click="toggleSmartMode">订单提醒</button>
        <button type="button" @click="$emit('new-order')">新建订单</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import TodayOrders from '@/components/TodayOrders.vue';
import TaskOrderWorkspace from '../TaskOrderWorkspace.vue';
import SmartReplenishmentComparison from './SmartReplenishmentComparison.vue';
import { customerId, customerName } from '../../services/orderWorkbenchService';
import { customerVisibleInStage, ordersVisibleInStage } from '../../services/orderWorkbenchStage';

const props = defineProps({
  customers: { type: Array, default: () => [] },
  allCustomers: { type: Array, default: () => [] },
  allCustomersLoading: { type: Boolean, default: false },
  allCustomersError: { type: String, default: '' },
  distributerId: { type: [Number, String], default: null },
  selectedCustomer: { type: Object, default: null },
  snapshot: { type: Object, required: true },
  stageFilter: { type: String, default: 'review' },
  listLoading: { type: Boolean, default: false },
  detailLoading: { type: Boolean, default: false },
  listError: { type: String, default: '' },
  detailError: { type: String, default: '' },
});

const emit = defineEmits([
  'select-customer',
  'refresh-list',
  'refresh-detail',
  'continue-order',
  'new-order',
  'data-changed',
  'smart-mode-change',
]);

const query = ref('');
const smartMode = ref(false);
const reminderSummary = ref(null);

function stats(customer) {
  return customer?._workbenchStats || {
    needsReview: 0,
    total: 0,
    all: 0,
    weighted: 0,
    priced: 0,
    needsPrice: 0,
    readyToPrint: 0,
    inProgress: 0,
    subtotalText: '0.0',
    allDone: false,
  };
}

// 普通模式展示未完成订单客户；订单提醒覆盖有实际订单或有 A 级提醒基线的客户。
const filteredCustomers = computed(() => smartMode.value ? props.allCustomers : props.customers);
const activeListLoading = computed(() => smartMode.value ? props.allCustomersLoading : props.listLoading);
const activeListError = computed(() => smartMode.value ? props.allCustomersError : props.listError);

const stageOrders = computed(() => ordersVisibleInStage(props.snapshot.orders, props.stageFilter));
const stageDepartments = computed(() => {
  const departments = Array.isArray(props.snapshot.departments) ? props.snapshot.departments : [];
  if (!['ready', 'progress', 'price'].includes(props.stageFilter)) return departments;
  return departments.map(department => {
    const depOrders = ordersVisibleInStage(department.depOrders, props.stageFilter);
    return {
      ...department,
      depOrders,
      depSubtotal: depOrders.reduce((total, order) => total + (Number(order.nxDoSubtotal) || 0), 0),
    };
  }).filter(department => department.depOrders.length > 0);
});
const stageTotal = computed(() => {
  if (!['ready', 'progress', 'price'].includes(props.stageFilter)) return props.snapshot.total;
  const orders = props.snapshot.hasSubDepartments
    ? stageDepartments.value.flatMap(department => department.depOrders)
    : stageOrders.value;
  return orders.reduce((total, order) => total + (Number(order.nxDoSubtotal) || 0), 0);
});

const visibleCustomers = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  return filteredCustomers.value.filter(
    customer => (smartMode.value || customerVisibleInStage(customer, props.stageFilter))
      && (!keyword || customerName(customer).toLocaleLowerCase().includes(keyword))
  );
});

const emptyMessage = computed(() => {
  if (smartMode.value) return '当前没有需要提醒的客户';
  if (props.stageFilter === 'all') return '当前没有订单';
  if (props.stageFilter === 'review') return '当前没有待确认任务';
  if (props.stageFilter === 'price') return '当前没有待写单价的订单';
  if (props.stageFilter === 'ready') return '当前没有可打印订单';
  return '当前没有出货中的订单';
});

function isSelected(customer) {
  return String(customerId(customer)) === String(customerId(props.selectedCustomer));
}

function toggleSmartMode() {
  smartMode.value = !smartMode.value;
  reminderSummary.value = null;
  query.value = '';
  emit('smart-mode-change', smartMode.value);
  if (smartMode.value) {
    const selectedId = customerId(props.selectedCustomer);
    const selectedCanBeChecked = props.allCustomers.some(
      customer => String(customerId(customer)) === String(selectedId)
    );
    if (!selectedCanBeChecked) {
      emit('select-customer', props.allCustomers[0] || null);
    }
  }
}

function handleOrdersChanged() {
  emit('refresh-detail');
  emit('data-changed');
}

function handleTaskChanged() {
  emit('data-changed');
}
</script>

<style scoped>
.order-flow {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: 238px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--product-border);
  border-radius: var(--product-radius-lg);
  background: var(--product-surface);
  box-shadow: var(--product-shadow);
}

.order-flow__queue {
  display: grid;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr);
  padding: 14px 11px 11px;
  border-right: 1px solid var(--product-border);
  background: #fbfcfb;
}

.order-flow__detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.order-flow__header-tools {
  display: flex;
  width: 216px;
  min-width: 216px;
  flex: none;
  align-items: center;
  gap: 8px;
  order: -1;
}
.order-flow__header-tools .order-flow__new-order {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  padding: 0;
  border: 1px solid var(--product-primary);
  border-radius: 6px;
  color: #fff;
  background: var(--product-primary);
  font-size: 21px;
  font-weight: 900;
}
.order-flow__search {
  display: flex;
  height: 35px;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 7px;
  padding: 0 9px;
  border: 1px solid var(--product-border);
  border-radius: 5px;
  background: #fff;
}

.order-flow__search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 11px;
}

.order-flow__list { min-height: 0; overflow: auto; }
.order-flow__list > button {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  margin-bottom: 5px;
  padding: 11px 9px;
  border: 1px solid transparent;
  border-radius: 6px;
  text-align: left;
  color: var(--product-text);
  background: transparent;
}
.order-flow__list > button:hover { background: #f3f7f5; }
.order-flow__list > button.is-active { border-color: #b9dfca; background: #eaf7f0; }
.order-flow__queue-head { display: flex; min-width: 0; align-items: center; gap: 4px; }
.order-flow__queue-head strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
.order-flow__pending { flex: none; color: #cb3b3b; font-size: 10px; }
.order-flow__queue-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; color: var(--product-text-secondary); font-size: 11px; }
.order-flow__queue-metrics > span { white-space: nowrap; }
.order-flow__queue-metrics > span:nth-child(-n + 2) { font-size: 12px; font-weight: 700; }
.order-flow__queue-metrics em { color: #08794b; font-style: normal; font-weight: 800; }
.order-flow__queue-metrics em.is-incomplete { color: #087f73; }
.order-flow__queue-state { flex: 0 0 auto; color: var(--product-text-muted); font-size: 10px; white-space: nowrap; }

.order-flow__detail {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.order-flow__detail-header {
  min-height: 62px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--product-border);
}
.order-flow__customer-title {
  width: 150px;
  flex: none;
}
.order-flow__customer-title h2 { overflow: hidden; margin: 0; font-size: 18px; text-overflow: ellipsis; white-space: nowrap; }
.order-flow__reminder-summary {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
}
.order-flow__reminder-summary article {
  display: flex;
  min-width: 120px;
  align-items: baseline;
  justify-content: center;
  gap: 5px;
  padding: 5px 18px;
  border-right: 1px solid #e2eae6;
}
.order-flow__reminder-summary article:last-child { border-right: 0; }
.order-flow__reminder-summary span { color: var(--product-text-secondary); font-size: 10px; font-weight: 800; white-space: nowrap; }
.order-flow__reminder-summary strong { font-size: 20px; line-height: 1; }
.order-flow__reminder-summary em { color: var(--product-text-muted); font-size: 9px; font-style: normal; }
.order-flow__reminder-summary .is-reminder strong { color: #c45c20; }
.order-flow__reminder-summary .is-matched strong { color: #08794b; }
.order-flow__reminder-summary .is-customer-ordered strong { color: #41637f; }
.order-flow__detail-actions { display: flex; flex: none; gap: 6px; margin-left: auto; }
.order-flow__detail-actions button,
.order-flow__detail-state button,
.order-flow__stage-heading button {
  padding: 7px 11px;
  border: 1px solid var(--product-border);
  border-radius: 5px;
  font-size: 10px;
  font-weight: 800;
}
.order-flow__detail-actions .is-secondary,
.order-flow__detail-actions .is-secondary { color: var(--product-text-secondary); background: #fff; }
.order-flow__detail-actions .is-smart { border-color: #b9dfca; color: var(--product-primary-strong); background: #eff9f3; }
.order-flow__detail-actions .is-smart.is-active { border-color: #dfaa42; color: #966008; background: #fff8e9; }
.order-flow__detail-actions .is-primary,
.order-flow__detail-state button,
.order-flow__stage-heading button { border-color: var(--product-primary); color: #fff; background: var(--product-primary); }
.order-flow__detail-state .is-smart-entry { border-color: #dfaa42; color: #8f5c08; background: #fff8e9; }

.order-flow__stage-page {
  min-height: 0;
  padding: 20px;
  overflow: auto;
  background: #fafcfb;
}
.order-flow__stage-page.is-progress {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  padding: 12px;
  overflow: hidden;
}
.order-flow__stage-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.order-flow__stage-heading strong,
.order-flow__stage-heading span { display: block; }
.order-flow__stage-heading strong { font-size: 15px; }
.order-flow__stage-heading span { margin-top: 4px; color: var(--product-text-muted); font-size: 10px; }

.order-flow__workspace { min-width: 0; min-height: 0; overflow: hidden; }
.order-flow__workspace.is-review { padding: 9px; background: #f7faf8; }
.order-flow__workspace.is-smart { background: #f6f9f7; }
.order-flow__workspace.is-review :deep(.save-order-tab) { border: 1px solid var(--product-border); border-radius: 6px; background: #fff; }

.order-flow__progress-orders {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--product-border);
  border-radius: 7px;
  background: #fff;
}

/* TodayOrders 的旧列宽总和大于工作台右侧可用宽度。
 * 在订单工作台内使用自适应商品列并收紧其余固定列，保证操作列完整可见。 */
.order-flow__progress-orders :deep(.table-header-fixed > .table-cell:nth-child(1)),
.order-flow__progress-orders :deep(.order-item > .d-flex > .table-cell:nth-child(1)),
.order-flow__workspace.is-orders :deep(.table-header-fixed > .table-cell:nth-child(1)),
.order-flow__workspace.is-orders :deep(.order-item > .d-flex > .table-cell:nth-child(1)) {
  width: 56px !important;
}
.order-flow__progress-orders :deep(.table-header-fixed > .table-cell:nth-child(2)),
.order-flow__progress-orders :deep(.order-item > .d-flex > .table-cell:nth-child(2)),
.order-flow__workspace.is-orders :deep(.table-header-fixed > .table-cell:nth-child(2)),
.order-flow__workspace.is-orders :deep(.order-item > .d-flex > .table-cell:nth-child(2)) {
  width: auto !important;
  min-width: 130px;
  flex: 1 1 auto !important;
}
.order-flow__progress-orders :deep(.table-header-fixed > .table-cell:nth-child(3)),
.order-flow__progress-orders :deep(.table-header-fixed > .table-cell:nth-child(4)),
.order-flow__progress-orders :deep(.table-header-fixed > .table-cell:nth-child(5)),
.order-flow__progress-orders :deep(.order-item > .d-flex > .table-cell:nth-child(3)),
.order-flow__progress-orders :deep(.order-item > .d-flex > .table-cell:nth-child(4)),
.order-flow__progress-orders :deep(.order-item > .d-flex > .table-cell:nth-child(5)),
.order-flow__workspace.is-orders :deep(.table-header-fixed > .table-cell:nth-child(3)),
.order-flow__workspace.is-orders :deep(.table-header-fixed > .table-cell:nth-child(4)),
.order-flow__workspace.is-orders :deep(.table-header-fixed > .table-cell:nth-child(5)),
.order-flow__workspace.is-orders :deep(.order-item > .d-flex > .table-cell:nth-child(3)),
.order-flow__workspace.is-orders :deep(.order-item > .d-flex > .table-cell:nth-child(4)),
.order-flow__workspace.is-orders :deep(.order-item > .d-flex > .table-cell:nth-child(5)) {
  width: 78px !important;
}
.order-flow__progress-orders :deep(.table-header-fixed > .table-cell:nth-child(6)),
.order-flow__progress-orders :deep(.order-item > .d-flex > .table-cell:nth-child(6)),
.order-flow__workspace.is-orders :deep(.table-header-fixed > .table-cell:nth-child(6)),
.order-flow__workspace.is-orders :deep(.order-item > .d-flex > .table-cell:nth-child(6)) {
  width: 112px !important;
}
.order-flow__progress-orders :deep(.table-header-fixed > .table-cell:nth-child(7)),
.order-flow__progress-orders :deep(.table-header-fixed > .table-cell:nth-child(8)),
.order-flow__progress-orders :deep(.order-item > .d-flex > .table-cell:nth-child(7)),
.order-flow__progress-orders :deep(.order-item > .d-flex > .table-cell:nth-child(8)),
.order-flow__workspace.is-orders :deep(.table-header-fixed > .table-cell:nth-child(7)),
.order-flow__workspace.is-orders :deep(.table-header-fixed > .table-cell:nth-child(8)),
.order-flow__workspace.is-orders :deep(.order-item > .d-flex > .table-cell:nth-child(7)),
.order-flow__workspace.is-orders :deep(.order-item > .d-flex > .table-cell:nth-child(8)) {
  width: 92px !important;
}
.order-flow__progress-orders :deep(.table-header-fixed > .table-cell:nth-child(9)),
.order-flow__progress-orders :deep(.order-item > .d-flex > .table-cell:nth-child(9)),
.order-flow__workspace.is-orders :deep(.table-header-fixed > .table-cell:nth-child(9)),
.order-flow__workspace.is-orders :deep(.order-item > .d-flex > .table-cell:nth-child(9)) {
  width: 72px !important;
}

.order-flow__detail-state,
.order-flow__notice {
  display: flex;
  min-height: 0;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 7px;
  color: var(--product-text-muted);
  text-align: center;
  font-size: 10px;
}
.order-flow__detail-state { grid-row: 2; }
.order-flow__detail-state strong { color: var(--product-text); font-size: 14px; }
.order-flow__detail-state.is-error,
.order-flow__notice.is-error { color: #b14343; }
.order-flow__empty-mark { display: grid; width: 46px; height: 46px; place-items: center; border-radius: 10px; color: var(--product-primary-strong); background: var(--product-primary-soft); font-size: 15px; font-weight: 900; }

.is-spinning { display: inline-block; animation: order-flow-spin .75s linear infinite; }
@keyframes order-flow-spin { to { transform: rotate(360deg); } }

@media (max-width: 1120px) {
  .order-flow { grid-template-columns: 210px minmax(0, 1fr); }
  .order-flow__reminder-summary article { min-width: 96px; padding: 5px 9px; }
}
</style>
