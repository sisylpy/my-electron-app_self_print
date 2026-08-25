<template>
  <main class="order-workbench">
    <Teleport v-if="activeView === 'overview'" to="#product-header-context">
      <nav class="order-workbench__header-stages" aria-label="订单阶段">
        <button
          v-for="stage in stageOptions"
          :key="stage.key"
          type="button"
          :class="[`is-${stage.key}`, { 'is-active': stageFilter === stage.key }]"
          @click="selectStage(stage.key)"
        >
          <strong>{{ stage.label }}</strong>
          <em>{{ stage.count }}</em>
        </button>
      </nav>
    </Teleport>

    <AiOrderPanel
      v-if="activeView === 'create'"
      class="order-workbench__content"
      :customers="customerContext.customers.value"
      :selected-customer="customerContext.selectedCustomer.value"
      :selected-customer-id="customerContext.selectedCustomerId.value"
      :selected-customer-name="customerContext.selectedCustomerName.value"
      :selected-department-id="customerContext.selectedDepartmentId.value"
      :customer-loading="customerContext.loading.value"
      :customer-error="customerContext.error.value"
      @select-customer="customerContext.selectCustomer"
      @select-department="customerContext.selectDepartment"
      @retry-customers="customerContext.reload"
      @order-saved="handleOrderChanged"
      @task-added="handleOrderChanged"
      @show-today-orders="returnToOverview"
    />

    <OrderFlowInbox
      v-else
      class="order-workbench__content"
      :customers="overview.customers"
      :all-customers="smartModeCustomers"
      :all-customers-loading="smartCustomersLoading || overviewLoading"
      :all-customers-error="smartModeCustomersError"
      :distributer-id="disUser?.nxDiuDistributerId"
      :selected-customer="todayInbox.selectedCustomer.value"
      :snapshot="todayInbox.snapshot.value"
      :stage-filter="stageFilter"
      :list-loading="overviewLoading"
      :detail-loading="todayInbox.detailLoading.value"
      :list-error="overviewError"
      :detail-error="todayInbox.detailError.value"
      @select-customer="todayInbox.selectCustomer"
      @refresh-list="refreshAll"
      @refresh-detail="todayInbox.refreshSelected"
      @continue-order="openCreateOrder"
      @new-order="openCreateOrder"
      @data-changed="handleOrderChanged"
      @smart-mode-change="handleSmartModeChange"
    />
  </main>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useStore } from 'vuex';
import AiOrderPanel from '../components/workbench/AiOrderPanel.vue';
import OrderFlowInbox from '../components/workbench/OrderFlowInbox.vue';
import { useOrderCustomerContext } from '../composables/useOrderCustomerContext';
import { useTodayOrderInbox } from '../composables/useTodayOrderInbox';
import { blockingCustomerDirectoryError } from '../services/smartReplenishmentComparison';
import {
  customerId,
  loadSmartReplenishmentCustomerDirectory,
  loadOrderWorkbenchOverview,
  orderWorkbenchError,
} from '../services/orderWorkbenchService';

const store = useStore();
const disUser = computed(() => store.state.disUser);
const customerContext = useOrderCustomerContext(disUser);
const todayInbox = useTodayOrderInbox(disUser);
const activeView = ref('overview');
const stageFilter = ref('review');
const overviewLoading = ref(false);
const overviewError = ref('');
const smartCustomers = ref([]);
const smartCustomersLoading = ref(false);
const smartCustomersError = ref('');
const smartModeActive = ref(false);
const overview = reactive({
  customers: [],
  totals: { needsReview: 0, inProgress: 0, readyToPrint: 0 },
});
// 订单提醒同时覆盖“有实际订单”和“有 A 级提醒基线”的客户。
const smartModeCustomers = computed(() => {
  const customersById = new Map();
  overview.customers.forEach((customer) => {
    const id = customerId(customer);
    if (id !== null && id !== undefined) customersById.set(String(id), customer);
  });
  smartCustomers.value.forEach((customer) => {
    const id = customerId(customer);
    if (id === null || id === undefined) return;
    const key = String(id);
    const actualCustomer = customersById.get(key);
    customersById.set(key, actualCustomer
      ? {
        ...customer,
        ...actualCustomer,
        _smartReplenishmentState: customer._smartReplenishmentState,
      }
      : customer);
  });
  return Array.from(customersById.values());
});
const smartModeCustomersError = computed(() => blockingCustomerDirectoryError(
  smartModeCustomers.value,
  smartCustomersError.value,
  overviewError.value
));
let overviewRequestId = 0;
let smartCustomersRequestId = 0;
let stageInitialized = false;

const stageOptions = computed(() => [
  {
    key: 'review',
    label: '待确认',
    count: overview.totals.needsReview,
  },
  {
    key: 'progress',
    label: '出货中',
    count: overview.totals.inProgress,
  },
  {
    key: 'ready',
    label: '可打印',
    count: overview.totals.readyToPrint,
  },
]);

watch(
  () => disUser.value?.nxDiuDistributerId,
  async (disId, previousDisId) => {
    if (!disId) return;
    if (previousDisId && String(disId) !== String(previousDisId)) {
      customerContext.selectCustomer(null);
      todayInbox.selectCustomer(null);
      stageInitialized = false;
    }
    await Promise.all([
      customerContext.reload(),
      refreshSmartCustomers(),
      refreshOverview({ selectFirst: true }),
    ]);
  },
  { immediate: true }
);

async function refreshOverview(options = {}) {
  const requestId = ++overviewRequestId;
  overviewLoading.value = true;
  overviewError.value = '';
  try {
    const result = await loadOrderWorkbenchOverview(disUser.value);
    if (requestId !== overviewRequestId) return;
    overview.customers = result.customers;
    overview.totals = result.totals;

    if (!stageInitialized) {
      const firstAvailable = ['review', 'ready', 'progress'].find(
        stage => Number(result.totals[stage === 'review' ? 'needsReview' : stage === 'ready' ? 'readyToPrint' : 'inProgress']) > 0
      );
      stageFilter.value = firstAvailable || 'review';
      stageInitialized = true;
    }

    const selectedId = customerId(todayInbox.selectedCustomer.value);
    const refreshed = selectedId
      ? overview.customers.find(customer => String(customerId(customer)) === String(selectedId))
      : null;
    if (refreshed) {
      todayInbox.selectedCustomer.value = refreshed;
    } else if (!smartModeActive.value && options.selectFirst !== false) {
      const first = overview.customers[0];
      await todayInbox.selectCustomer(first || null);
    }
  } catch (error) {
    if (requestId !== overviewRequestId) return;
    overviewError.value = orderWorkbenchError(error, '订单工作台读取失败');
  } finally {
    if (requestId === overviewRequestId) overviewLoading.value = false;
  }
}

async function refreshSmartCustomers() {
  const requestId = ++smartCustomersRequestId;
  smartCustomersLoading.value = true;
  smartCustomersError.value = '';
  try {
    const result = await loadSmartReplenishmentCustomerDirectory(disUser.value);
    if (requestId !== smartCustomersRequestId) return;
    smartCustomers.value = result.customers;
  } catch (error) {
    if (requestId !== smartCustomersRequestId) return;
    smartCustomers.value = [];
    smartCustomersError.value = orderWorkbenchError(error, '订单提醒客户读取失败');
  } finally {
    if (requestId === smartCustomersRequestId) smartCustomersLoading.value = false;
  }
}

async function handleSmartModeChange(active) {
  smartModeActive.value = active;
  if (!active) return;
  if (!smartCustomers.value.length && !smartCustomersLoading.value) {
    await refreshSmartCustomers();
  }
  if (!todayInbox.selectedCustomer.value && smartModeCustomers.value.length) {
    await todayInbox.selectCustomer(smartModeCustomers.value[0]);
  }
}

async function refreshAll() {
  await Promise.all([
    refreshOverview({ selectFirst: !smartModeActive.value }),
    smartModeActive.value ? refreshSmartCustomers() : Promise.resolve(),
  ]);
  if (todayInbox.selectedCustomer.value) await todayInbox.refreshSelected();
}

async function handleOrderChanged() {
  await refreshOverview({ selectFirst: true });
  if (activeView.value === 'overview' && todayInbox.selectedCustomer.value) {
    await todayInbox.refreshSelected();
  }
}

async function selectStage(stage) {
  stageFilter.value = stage;
  if (todayInbox.selectedCustomer.value || !overview.customers.length) return;
  await todayInbox.selectCustomer(overview.customers[0]);
}

function openCreateOrder(customer) {
  activeView.value = 'create';
  if (!customer) return;
  const matchingCustomer = customerContext.customers.value.find(
    item => String(customerId(item)) === String(customerId(customer))
  );
  customerContext.selectCustomer(matchingCustomer || customer);
}

async function returnToOverview() {
  activeView.value = 'overview';
  const createdForId = customerContext.selectedCustomerId.value;
  await refreshOverview({ selectFirst: true });
  if (!createdForId) return;
  const matchingCustomer = overview.customers.find(
    item => String(customerId(item)) === String(createdForId)
  );
  if (matchingCustomer) await todayInbox.selectCustomer(matchingCustomer);
}
</script>

<style scoped>
.order-workbench {
  box-sizing: border-box;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr);
  padding: 14px 16px 16px;
  overflow: hidden;
  color: var(--product-text);
  background: var(--product-bg);
}

.order-workbench__header-stages {
  display: flex;
  min-width: 0;
  width: 100%;
  align-items: center;
  justify-content: flex-end;
  gap: 20px;
}

.order-workbench__header-stages > button {
  position: relative;
  display: flex;
  min-width: 92px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 4px 7px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  color: var(--product-text-secondary);
  background: transparent;
}

.order-workbench__header-stages > button:hover { color: var(--product-text); }
.order-workbench__header-stages > button.is-active { border-bottom-color: var(--product-primary); color: var(--product-primary-strong); }
.order-workbench__header-stages strong { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; }
.order-workbench__header-stages em {
  min-width: auto;
  padding: 0;
  border-radius: 0;
  text-align: center;
  color: inherit;
  background: transparent;
  font-size: 9px;
  font-style: normal;
  font-weight: 900;
}

.order-workbench__content { min-width: 0; min-height: 0; }

@media (max-width: 1250px) {
  .order-workbench__header-stages { gap: 10px; }
}
</style>
