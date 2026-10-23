<template>
  <section class="order-flow" aria-label="进行中订单工作台">
    <Teleport defer to="#product-header-context">
      <div class="order-flow__header-tools" aria-label="客户操作">
        <div class="order-flow__refresh-group">
          <button
            type="button"
            :class="['order-flow__refresh', { 'is-processing': asyncTaskProgress.remaining > 0, 'is-loading': listLoading }]"
            :disabled="listLoading"
            :title="asyncTaskProgress.remaining > 0 ? '图片订单处理中，点击刷新订单' : '刷新订单'"
            aria-label="刷新订单"
            @click="$emit('refresh-list')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 11a8 8 0 1 0-2.2 6.5" />
              <path d="M20 4v7h-7" />
            </svg>
          </button>
          <div
            v-if="asyncTaskProgress.visible"
            :class="['order-flow__async-progress', { 'has-expired': asyncTaskProgress.delayed > 0 || asyncTaskProgress.syncError || asyncTaskProgress.failed > 0 }]"
            role="status"
            aria-live="polite"
          >
            <span class="order-flow__async-copy">
              <strong>{{ asyncTaskProgress.syncError ? '状态查询异常，正在重试' : asyncTaskProgress.remaining > 0 ? '图片订单处理中' : asyncTaskProgress.failed > 0 ? '图片任务需检查' : '图片订单已处理完' }}</strong>
              <small>已完成 {{ asyncTaskProgress.completed }}/{{ asyncTaskProgress.total }} · 剩余 {{ asyncTaskProgress.remaining }}<template v-if="asyncTaskProgress.failed"> · 失败 {{ asyncTaskProgress.failed }}</template><template v-if="asyncTaskProgress.delayed"> · {{ asyncTaskProgress.delayed }} 项较久</template></small>
            </span>
            <span class="order-flow__async-track" aria-hidden="true"><i :style="{ width: `${asyncTaskProgress.total ? asyncTaskProgress.completed / asyncTaskProgress.total * 100 : 0}%` }"></i></span>
          </div>
        </div>
        <button
          type="button"
          class="order-flow__wechat-scan"
          :disabled="wechatScanBusy"
          @click="$emit('scan-wechat')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 11a7 7 0 0 1-7 7H8l-4 3 1.2-4.2A7 7 0 1 1 20 11Z" />
            <path d="m9 11 2 2 4-4" />
          </svg>
          <strong>{{ wechatScanLabel }}</strong>
          <em v-if="wechatImportCount">{{ wechatImportCount }}</em>
        </button>
        <button
          type="button"
          class="order-flow__new-order"
          :title="selectedCustomer ? `为“${customerName(selectedCustomer)}”添加订单` : '添加订单'"
          :aria-label="selectedCustomer ? `为“${customerName(selectedCustomer)}”添加订单` : '添加订单'"
          @click="$emit('new-order', selectedCustomer)"
        >＋</button>
      </div>
    </Teleport>
    <aside class="order-flow__queue">
      <label class="order-flow__queue-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          v-model="query"
          type="search"
          placeholder="搜索客户"
          aria-label="搜索客户"
          @keydown.enter.prevent="submitSearch"
          @keydown.esc.prevent="closeSearch"
        >
        <button v-if="query" type="button" title="清空搜索" aria-label="清空搜索" @click="closeSearch">×</button>
      </label>
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
          @click="selectCustomer(customer)"
        >
          <span class="order-flow__queue-head">
            <strong>{{ customerName(customer) }}</strong>
            <span v-if="!smartMode && stats(customer).needsReview > 0" class="order-flow__pending">
              ({{ stats(customer).needsReview }}个待处理)
            </span>
          </span>
          <span class="order-flow__queue-wechat">{{ customerWechatName(customer) }}</span>
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
            v-if="!smartMode && stageFilter !== 'review'"
            class="order-flow__customer-status"
            aria-label="客户订单状态"
          >
            <span>待确认: <strong class="text-danger">{{ currentStatusSummary.awaitingConfirmation }}</strong></span>
            <span>出货中: <strong class="text-warning">{{ currentStatusSummary.inProgress }}</strong></span>
            <span>
              {{ stageFilter === 'ready' ? '可打印' : '完成' }}:
              <strong class="text-success">
                {{ stageFilter === 'ready' ? currentStatusSummary.printable : currentStatusSummary.completed }}
              </strong>
            </span>
          </div>
          <div
            v-if="smartMode && reminderSummary"
            class="order-flow__reminder-summary"
            aria-label="今日订单提醒统计"
          >
            <article class="is-reminder">
              <span>预估未下单</span><strong>{{ reminderSummary.reminderProducts }}</strong><em>种</em>
            </article>
            <article class="is-matched">
              <span>预估订单</span><strong>{{ reminderSummary.matchedProducts }}</strong><em>种</em>
            </article>
            <article class="is-customer-ordered">
              <span>客户自订</span><strong>{{ reminderSummary.customerOrderedProducts }}</strong><em>种</em>
            </article>
          </div>
          <div class="order-flow__detail-actions">
            <button type="button" class="is-secondary" :disabled="detailLoading" @click="$emit('refresh-detail')">
              <img :src="iconRefresh" alt="" class="order-flow__btn-icon">{{ detailLoading ? '读取中…' : '刷新' }}
            </button>
            <button
              type="button"
              :class="['is-smart', { 'is-active': smartMode }]"
              :aria-pressed="smartMode"
              @click="$emit('smart-mode-change', !smartMode)"
            >
              <svg class="order-flow__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
              {{ smartMode ? '返回订单' : '订单提醒' }}
            </button>
            <span id="order-flow-print-actions" aria-label="批量打印操作"></span>
            <div class="order-flow__pick-print">
              <div class="pick-list-mode is-inline" role="group" aria-label="拣货单打印模式">
                <button
                  type="button"
                  :class="{ 'is-active': pickMode === 'goods' }"
                  :aria-pressed="pickMode === 'goods'"
                  @click="setPickMode('goods')"
                >按商品</button>
                <button
                  type="button"
                  :class="{ 'is-active': pickMode === 'shelf' }"
                  :aria-pressed="pickMode === 'shelf'"
                  @click="setPickMode('shelf')"
                >按货架</button>
              </div>
              <button
                type="button"
                class="is-primary"
                :disabled="pickPrinting"
                @click="handlePrintPickList"
              >
                {{ pickPrinting ? '打印中…' : '打印拣货单' }}
              </button>
            </div>
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

        <div v-else-if="stageFilter === 'progress' || stageFilter === 'price'" class="order-flow__stage-page is-progress">
          <div class="order-flow__progress-orders">
            <TodayOrders
              :today-order-list="stageOrders"
              :today-order-dep-arr="stageDepartments"
              :today-order-trade-no="snapshot.tradeNo"
              :has-sub-departments="snapshot.hasSubDepartments"
              :selected-sub-department="null"
              :today-order-total="stageTotal"
              :show-list-end="hasStageOrders"
              :selected-all-customer="customerId(selectedCustomer)"
              :selected-customer-name="customerName(selectedCustomer)"
              :selected-customer-entity="selectedCustomer"
              :selected-customer-dep-print-name="selectedCustomer.nxDepartmentPrintName || 'ApplyPanel'"
              hide-footer
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
            :show-list-end="hasStageOrders"
            :selected-all-customer="customerId(selectedCustomer)"
            :selected-customer-name="customerName(selectedCustomer)"
            :selected-customer-entity="selectedCustomer"
            :selected-customer-dep-print-name="selectedCustomer.nxDepartmentPrintName || 'ApplyPanel'"
            hide-footer
            @order-updated="handleOrdersChanged"
            @order-deleted="handleOrdersChanged"
          />
        </div>
      </template>

      <div v-else class="order-flow__detail-state">
        <div class="order-flow__empty-mark">单</div>
        <strong>{{ emptyMessage }}</strong>
        <span>可以选择其他阶段，或点击顶部“＋”添加订单</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useStore } from 'vuex';
import TodayOrders from '@/components/TodayOrders.vue';
import TaskOrderWorkspace from '../TaskOrderWorkspace.vue';
import SmartReplenishmentComparison from './SmartReplenishmentComparison.vue';
import { customerId, customerName } from '../../services/orderWorkbenchService';
import {
  customerVisibleInStage,
  ordersVisibleInStage,
  orderStatusSummary,
} from '../../services/orderWorkbenchStage';
import iconRefresh from '@/assets/order-actions/refresh.png';
import {
  getPickListPrintConfig,
  printCustomerPickList,
  savePickListPrintConfig,
} from '@/modules/print/services/pickListPrint';

const store = useStore();
const disUser = computed(() => store.state.disUser);
const pickMode = ref('goods');
const pickPrinting = ref(false);

async function setPickMode(mode) {
  pickMode.value = mode;
  try {
    await savePickListPrintConfig({ pickListMode: mode });
  } catch (error) {
    // 记住模式失败不影响本次打印
    console.warn('[拣货单] 保存打印模式失败:', error);
  }
}

async function handlePrintPickList() {
  if (pickPrinting.value) return;
  const customer = props.selectedCustomer;
  const depId = customerId(customer);
  const disId = props.distributerId || disUser.value?.nxDiuDistributerId;
  if (!depId || !disId) {
    window.alert('未获取到客户或配送商信息，请重新进入客户');
    return;
  }
  pickPrinting.value = true;
  try {
    const result = await printCustomerPickList({
      nxDepIds: String(depId),
      gbDepIds: '0',
      nxDisId: disId,
      supplierId: '',
      customerName: customerName(customer),
      mode: pickMode.value,
      pickerUserId: disUser.value?.nxDistributerUserId,
    });
    const finish = result?.finish;
    window.alert(
      `拣货单已发送到：${result?.printerName || 'A4 打印机'}\n`
      + (finish?.total ? `固定规格自动出库 ${finish.total - (finish.failed || 0)}/${finish.total} 项` : '无可自动出库的固定规格商品')
    );
    emit('refresh-detail');
  } catch (error) {
    window.alert(error?.message || '打印失败');
  } finally {
    pickPrinting.value = false;
  }
}

onMounted(async () => {
  try {
    const config = await getPickListPrintConfig();
    pickMode.value = config.pickListMode || 'goods';
  } catch (error) {
    console.warn('[拣货单] 读取打印模式失败:', error);
  }
});

const props = defineProps({
  customers: { type: Array, default: () => [] },
  allCustomers: { type: Array, default: () => [] },
  allCustomersLoading: { type: Boolean, default: false },
  allCustomersError: { type: String, default: '' },
  smartMode: { type: Boolean, default: false },
  distributerId: { type: [Number, String], default: null },
  selectedCustomer: { type: Object, default: null },
  snapshot: { type: Object, required: true },
  stageFilter: { type: String, default: 'review' },
  listLoading: { type: Boolean, default: false },
  detailLoading: { type: Boolean, default: false },
  listError: { type: String, default: '' },
  detailError: { type: String, default: '' },
  wechatScanBusy: { type: Boolean, default: false },
  wechatScanLabel: { type: String, default: '读取微信订单' },
  wechatImportCount: { type: Number, default: 0 },
  asyncTaskProgress: { type: Object, default: () => ({ total: 0, completed: 0, failed: 0, delayed: 0, remaining: 0, syncError: '', visible: false }) },
});

const emit = defineEmits([
  'select-customer',
  'refresh-list',
  'refresh-detail',
  'smart-mode-change',
  'scan-wechat',
  'new-order',
  'data-changed',
]);

const query = ref('');
const reminderSummary = ref(null);

watch(() => props.smartMode, () => {
  reminderSummary.value = null;
  query.value = '';
});

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

// 与客户中心 customerWechatName 口径一致：显示本客户绑定的微信名称，未绑定时给出明确状态。
function customerWechatName(customer) {
  const name = String(customer?.nxDepartmentWechatDisplayName || '').trim();
  return name ? `微信：${name}` : '微信：未绑定';
}

// 普通模式展示未完成订单客户；订单提醒覆盖有实际订单或有 A 级提醒基线的客户。
const filteredCustomers = computed(() => props.smartMode ? props.allCustomers : props.customers);
const activeListLoading = computed(() => props.smartMode ? props.allCustomersLoading : props.listLoading);
const activeListError = computed(() => props.smartMode ? props.allCustomersError : props.listError);

const stageOrders = computed(() => ordersVisibleInStage(props.snapshot.orders, props.stageFilter));
const currentStatusSummary = computed(() => orderStatusSummary(stageOrders.value));
const stageSubtotalFields = {
  ready: { department: 'depPrintableSubtotal', snapshot: 'printableSubtotal' },
  progress: { department: 'depProgressSubtotal', snapshot: 'progressSubtotal' },
  price: { department: 'depPriceSubtotal', snapshot: 'priceSubtotal' },
};
const stageDepartments = computed(() => {
  const departments = Array.isArray(props.snapshot.departments) ? props.snapshot.departments : [];
  if (!['ready', 'progress', 'price'].includes(props.stageFilter)) return departments;
  const amountField = stageSubtotalFields[props.stageFilter].department;
  return departments.map(department => {
    const depOrders = ordersVisibleInStage(department.depOrders, props.stageFilter);
    return {
      ...department,
      depOrders,
      depSubtotal: Number(department[amountField]) || 0,
    };
  }).filter(department => department.depOrders.length > 0);
});
const stageTotal = computed(() => {
  if (!['ready', 'progress', 'price'].includes(props.stageFilter)) return props.snapshot.total;
  return Number(props.snapshot[stageSubtotalFields[props.stageFilter].snapshot]) || 0;
});
const hasStageOrders = computed(() => props.snapshot.hasSubDepartments
  ? stageDepartments.value.some(department => (department.depOrders || []).length > 0)
  : stageOrders.value.length > 0);

const visibleCustomers = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  return filteredCustomers.value.filter(
    customer => (props.smartMode || customerVisibleInStage(customer, props.stageFilter))
      && (!keyword || customerName(customer).toLocaleLowerCase().includes(keyword))
  );
});

const emptyMessage = computed(() => {
  if (props.smartMode) return '当前没有需要提醒的客户';
  if (props.stageFilter === 'all') return '当前没有订单';
  if (props.stageFilter === 'review') return '当前没有待确认任务';
  if (props.stageFilter === 'price') return '当前没有待写单价的订单';
  if (props.stageFilter === 'ready') return '当前没有可打印订单';
  return '当前没有出货中的订单';
});

function isSelected(customer) {
  return String(customerId(customer)) === String(customerId(props.selectedCustomer));
}

function closeSearch() {
  query.value = '';
}

function selectCustomer(customer) {
  emit('select-customer', customer);
  closeSearch();
}

function submitSearch() {
  const [firstMatch] = visibleCustomers.value;
  if (!firstMatch) return;
  selectCustomer(firstMatch);
}

function handleOrdersChanged() {
  emit('refresh-detail');
  emit('data-changed');
}

function handleTaskChanged(change) {
  emit('data-changed', change);
}
</script>

<style scoped>
.order-flow {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: 238px minmax(0, 1fr);
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--product-surface);
  box-shadow: none;
}

.order-flow__queue {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  padding: 4px 0 11px;
  border-right: 1px solid var(--product-border);
  background: var(--product-surface);
}
.order-flow__queue-search {
  display: flex;
  box-sizing: border-box;
  height: 32px;
  align-items: center;
  gap: 6px;
  margin: 0 10px 8px;
  padding: 0 6px 0 9px;
  border: 1px solid var(--product-border);
  border-radius: 6px;
  background: var(--product-surface);
}
.order-flow__queue-search:focus-within {
  border-color: var(--product-primary);
  box-shadow: 0 0 0 3px rgba(var(--product-primary-strong-rgb), 0.08);
}
.order-flow__queue-search > svg { width: 14px; height: 14px; flex: none; color: var(--product-primary-strong); }
.order-flow__queue-search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 11px;
}
.order-flow__queue-search input::-webkit-search-cancel-button { display: none; }
.order-flow__queue-search button {
  display: grid;
  width: 22px;
  height: 22px;
  flex: none;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--product-text-muted);
  background: transparent;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}
.order-flow__queue-search button:hover { color: var(--product-text); background: var(--product-primary-soft); }

.order-flow__detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.order-flow__header-tools {
  display: flex;
  min-width: 0;
  flex: none;
  align-items: center;
  gap: 8px;
  order: -1;
}
.order-flow__refresh-group { display: flex; flex: none; align-items: center; gap: 8px; }
.order-flow__refresh {
  /* 刷新按钮按要求隐藏（保留 DOM 以免影响异步进度逻辑） */
  display: none;
}
.order-flow__refresh svg { width: 18px; height: 18px; }
.order-flow__refresh:hover { transform: translateY(-1px); border-color: var(--product-primary); box-shadow: 0 4px 12px rgba(var(--product-primary-strong-rgb), 0.18); }
.order-flow__refresh.is-processing { box-shadow: 0 0 0 3px rgba(var(--product-primary-rgb), 0.11), 0 0 13px rgba(var(--product-primary-rgb), 0.2); animation: order-flow-refresh-glow 2.8s ease-in-out infinite; }
.order-flow__refresh.is-processing svg,
.order-flow__refresh.is-loading svg { animation: order-flow-refresh-spin 2.5s linear infinite; }
.order-flow__refresh:disabled { opacity: .5; cursor: wait; }
.order-flow__async-progress {
  position: relative;
  display: grid;
  min-width: 156px;
  gap: 3px;
  overflow: hidden;
  padding: 5px 10px 7px;
  border: 1px solid var(--product-primary-soft);
  border-radius: 9px;
  color: var(--product-primary-strong);
  background: linear-gradient(115deg, var(--product-primary-soft), var(--product-primary-soft));
  box-shadow: 0 3px 12px rgba(var(--product-primary-strong-rgb), 0.1);
}
.order-flow__async-progress.has-expired { border-color: var(--product-warning); color: var(--product-warning); background: var(--product-warning-soft); }
.order-flow__async-copy { display: grid; gap: 1px; white-space: nowrap; }
.order-flow__async-copy strong { font-size: 11px; line-height: 1.2; }
.order-flow__async-copy small { font-size: 11px; line-height: 1.2; }
.order-flow__async-track { height: 3px; overflow: hidden; border-radius: 4px; background: rgba(var(--product-primary-strong-rgb), 0.16); }
.order-flow__async-track i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--product-primary), var(--product-primary-strong)); transition: width .3s ease; }
@keyframes order-flow-refresh-spin { to { transform: rotate(360deg); } }
@keyframes order-flow-refresh-glow { 50% { box-shadow: 0 0 0 5px rgba(var(--product-primary-rgb), 0.07), 0 0 18px rgba(var(--product-primary-rgb), 0.38); } }
@media (prefers-reduced-motion: reduce) {
  .order-flow__refresh.is-processing,
  .order-flow__refresh.is-processing svg,
  .order-flow__refresh.is-loading svg { animation: none; }
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
  cursor: pointer;
}

.order-flow__wechat-scan {
  display: inline-flex;
  height: 34px;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 0 11px;
  border: 1px solid var(--product-primary);
  border-radius: 999px;
  color: #fff;
  background: var(--product-primary);
  cursor: pointer;
  transition: border-color .16s ease, background .16s ease, transform .16s ease;
}
.order-flow__wechat-scan:hover { border-color: var(--product-primary-strong); background: var(--product-primary-strong); transform: translateY(-1px); }
.order-flow__wechat-scan:disabled { cursor: wait; opacity: .65; transform: none; }
.order-flow__wechat-scan svg { width: 15px; height: 15px; flex: none; }
.order-flow__wechat-scan strong { font-size: 11px; white-space: nowrap; }
.order-flow__wechat-scan em {
  display: grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  padding: 0 4px;
  border-radius: 999px;
  color: var(--product-primary);
  background: var(--product-surface);
  font-size: 9px;
  font-style: normal;
  font-weight: 900;
}

.order-flow__list { min-height: 0; overflow: auto; }
.order-flow__list > button {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  margin-bottom: 5px;
  padding: 11px 10px 11px 14px;
  border: 1px solid transparent;
  border-radius: 6px;
  text-align: left;
  color: var(--product-text);
  background: transparent;
}
.order-flow__list > button:hover { background: var(--product-primary-soft); }
.order-flow__list > button.is-active { border-color: var(--product-primary-soft); background: var(--product-primary-soft); }
.order-flow__queue-head { display: flex; min-width: 0; align-items: center; gap: 4px; }
.order-flow__queue-head strong { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; }
.order-flow__queue-wechat {
  overflow: hidden;
  margin-top: -3px;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--product-text-secondary);
  font-size: 13px;
  font-weight: 600;
}
.order-flow__pending { flex: none; color: var(--product-danger); font-size: 10px; }
.order-flow__queue-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; color: var(--product-text-secondary); font-size: 11px; }
.order-flow__queue-metrics > span { white-space: nowrap; }
.order-flow__queue-metrics > span:nth-child(-n + 2) { font-size: 12px; font-weight: 700; }
.order-flow__queue-metrics em { color: var(--product-primary-strong); font-style: normal; font-weight: 800; }
.order-flow__queue-metrics em.is-incomplete { color: var(--product-primary-strong); }
.order-flow__queue-state { flex: 0 0 auto; color: var(--product-text-muted); font-size: 10px; white-space: nowrap; }

.order-flow__detail {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.order-flow__detail-header {
  min-height: 0;
  padding: 8px 12px;
  border-bottom: 0;
}
.order-flow__customer-title {
  width: 150px;
  flex: none;
}
.order-flow__customer-title h2 { overflow: hidden; margin: 0; font-size: 18px; text-overflow: ellipsis; white-space: nowrap; }
.order-flow__customer-status { display: flex; min-width: 0; flex: 1; align-items: center; justify-content: flex-end; gap: 14px; padding-right: 20px; color: var(--product-text-muted); font-size: 10px; }
.order-flow__customer-status span { white-space: nowrap; }
.order-flow__customer-status strong { font-size: 11px; }
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
  border-right: 1px solid var(--product-tint);
}
.order-flow__reminder-summary article:last-child { border-right: 0; }
.order-flow__reminder-summary span { color: var(--product-text-secondary); font-size: 10px; font-weight: 800; white-space: nowrap; }
.order-flow__reminder-summary strong { font-size: 20px; line-height: 1; }
.order-flow__reminder-summary em { color: var(--product-text-muted); font-size: 9px; font-style: normal; }
.order-flow__reminder-summary .is-reminder strong { color: var(--product-warning); }
.order-flow__reminder-summary .is-matched strong { color: var(--product-primary-strong); }
.order-flow__reminder-summary .is-customer-ordered strong { color: var(--product-info); }
.order-flow__detail-actions { display: flex; flex: none; gap: 6px; margin-left: auto; }
.order-flow__btn-icon { width: 12px; height: 12px; object-fit: contain; flex: none; }
.order-flow__detail-actions button,
.order-flow__detail-state button,
.order-flow__stage-heading button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 11px;
  border: 1px solid var(--product-border);
  border-radius: 5px;
  font-size: 10px;
  font-weight: 800;
}
.order-flow__detail-actions .is-secondary,
.order-flow__detail-actions .is-secondary { color: var(--product-text-secondary); background: var(--product-surface); }
.order-flow__detail-actions .is-smart { border-color: var(--product-warning); color: var(--product-warning); background: var(--product-warning-soft); }
.order-flow__detail-actions .is-smart.is-active { border-color: var(--product-warning); color: #fff; background: var(--product-warning); }
.order-flow__detail-actions .is-primary,
.order-flow__detail-state button,
.order-flow__stage-heading button { border-color: var(--product-primary); color: #fff; background: var(--product-primary); }

/* 单客户打印拣货单：模式切换 + 打印按钮 */
.order-flow__pick-print { display: flex; flex: none; align-items: center; gap: 6px; }
.pick-list-mode.is-inline button {
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid var(--product-primary-soft);
  border-radius: 8px;
  background: var(--product-surface);
  font-size: 12px;
  cursor: pointer;
}
.pick-list-mode.is-inline button.is-active {
  border-color: var(--product-primary);
  background: var(--product-primary-soft);
  color: var(--product-primary-strong);
}

.order-flow__stage-page {
  min-height: 0;
  padding: 20px;
  overflow: auto;
  background: var(--product-primary-soft);
}
.order-flow__stage-page.is-progress {
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  padding: 0;
  overflow: hidden;
}
.order-flow__stage-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.order-flow__stage-heading strong,
.order-flow__stage-heading span { display: block; }
.order-flow__stage-heading strong { font-size: 15px; }
.order-flow__stage-heading span { margin-top: 4px; color: var(--product-text-muted); font-size: 10px; }

.order-flow__workspace { min-width: 0; min-height: 0; overflow: hidden; }
.order-flow__workspace.is-review { padding: 9px; background: var(--product-primary-soft); }
.order-flow__workspace.is-smart { background: var(--product-tint); }
.order-flow__workspace.is-review :deep(.save-order-tab) { border: 1px solid var(--product-border); border-radius: 6px; background: var(--product-surface); }

.order-flow__progress-orders {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--product-surface);
}

.order-flow__progress-orders :deep(.order-list-scroll > .mb-3),
.order-flow__workspace.is-orders :deep(.order-list-scroll > .mb-3) {
  margin-bottom: 0 !important;
}
.order-flow__progress-orders :deep(.order-list-scroll > .mb-3 > .bg-light),
.order-flow__workspace.is-orders :deep(.order-list-scroll > .mb-3 > .bg-light) {
  padding: 6px 10px !important;
  border-bottom: 0 !important;
  background: var(--product-surface) !important;
}

/* 工作台表格采用紧凑商品列，并为操作按钮保留固定空间。 */
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
  width: 220px !important;
  min-width: 160px;
  flex: 0 1 220px !important;
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
  width: 224px !important;
  min-width: 224px;
  flex: 0 0 224px !important;
  margin-left: auto;
}
.order-flow__progress-orders :deep(.today-order-actions),
.order-flow__workspace.is-orders :deep(.today-order-actions) {
  flex-wrap: nowrap;
  gap: 6px;
  white-space: nowrap;
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
.order-flow__notice.is-error { color: var(--product-danger); }
.order-flow__empty-mark { display: grid; width: 46px; height: 46px; place-items: center; border-radius: 10px; color: var(--product-primary-strong); background: var(--product-primary-soft); font-size: 15px; font-weight: 900; }

.is-spinning { display: inline-block; animation: order-flow-spin .75s linear infinite; }
@keyframes order-flow-spin { to { transform: rotate(360deg); } }

@media (max-width: 1120px) {
  .order-flow { grid-template-columns: 210px minmax(0, 1fr); }
  .order-flow__reminder-summary article { min-width: 96px; padding: 5px 9px; }
}
</style>
