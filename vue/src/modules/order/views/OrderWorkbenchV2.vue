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
        <button
          type="button"
          class="is-wechat-scan"
          :disabled="wechatScanBusy"
          :title="wechatScanMessage || '在微信窗口逐个打开已绑定的未读会话并生成待确认订单'"
          @click="handleWechatScan"
        >
          <span class="order-workbench__stage-icon is-wechat-scan" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 11a7 7 0 0 1-7 7H8l-4 3 1.2-4.2A7 7 0 1 1 20 11Z" />
              <path d="m9 11 2 2 4-4" />
            </svg>
          </span>
          <strong>{{ wechatScanLabel }}</strong>
          <em v-if="wechatImportQueue.length">{{ wechatImportQueue.length }}</em>
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
      :pending-wechat-import="activeWechatImport"
      @select-customer="customerContext.selectCustomer"
      @select-department="customerContext.selectDepartment"
      @retry-customers="customerContext.reload"
      @order-saved="handleOrderChanged"
      @task-added="handleTaskAdded"
      @wechat-import-error="handleWechatImportError"
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

    <aside
      v-if="wechatScanMessage"
      :class="['order-workbench__wechat-status', `is-${wechatScanStatus}`]"
      role="status"
    >
      <span>{{ wechatScanMessage }}</span>
      <button type="button" aria-label="关闭提示" @click="wechatScanMessage = ''">×</button>
    </aside>
  </main>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useStore } from 'vuex';
import AiOrderPanel from '../components/workbench/AiOrderPanel.vue';
import OrderFlowInbox from '../components/workbench/OrderFlowInbox.vue';
import { useOrderCustomerContext } from '../composables/useOrderCustomerContext';
import { useTodayOrderInbox } from '../composables/useTodayOrderInbox';
import { customerVisibleInStage } from '../services/orderWorkbenchStage';
import { blockingCustomerDirectoryError } from '../services/smartReplenishmentComparison';
import {
  loadCustomerWechatBinding,
  prepareWechatOrderImport,
} from '../services/wechatOrderImport';
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
const stageFilter = ref('all');
const overviewLoading = ref(false);
const overviewError = ref('');
const smartCustomers = ref([]);
const smartCustomersLoading = ref(false);
const smartCustomersError = ref('');
const smartModeActive = ref(false);
const wechatScanBusy = ref(false);
const wechatScanMessage = ref('');
const wechatScanStatus = ref('info');
const wechatImportQueue = ref([]);
let wechatImportSequence = 0;
const overview = reactive({
  customers: [],
  totals: { all: 0, needsReview: 0, needsPrice: 0, inProgress: 0, readyToPrint: 0 },
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
const activeWechatImport = computed(() => wechatImportQueue.value[0] || null);
const wechatScanLabel = computed(() => {
  if (wechatScanBusy.value) return '正在读微信…';
  if (wechatImportQueue.value.length) return '继续微信订单';
  return '读取微信订单';
});
let overviewRequestId = 0;
let smartCustomersRequestId = 0;

const stageOptions = computed(() => [
  {
    key: 'all',
    label: '全部',
    count: overview.totals.all,
  },
  {
    key: 'review',
    label: '待确认',
    count: overview.totals.needsReview,
  },
  {
    key: 'price',
    label: '待写单价',
    count: overview.totals.needsPrice,
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
      stageFilter.value = 'all';
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

    const selectedId = customerId(todayInbox.selectedCustomer.value);
    const refreshed = selectedId
      ? overview.customers.find(customer => String(customerId(customer)) === String(selectedId))
      : null;
    if (refreshed && (smartModeActive.value || customerVisibleInStage(refreshed, stageFilter.value))) {
      todayInbox.selectedCustomer.value = refreshed;
    } else if (!smartModeActive.value && options.selectFirst !== false) {
      const first = overview.customers.find(customer => customerVisibleInStage(customer, stageFilter.value));
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
  if (!active) {
    const selectedId = customerId(todayInbox.selectedCustomer.value);
    const selectedVisible = overview.customers.some(customer =>
      String(customerId(customer)) === String(selectedId)
        && customerVisibleInStage(customer, stageFilter.value)
    );
    if (!selectedVisible) {
      const first = overview.customers.find(customer => customerVisibleInStage(customer, stageFilter.value));
      await todayInbox.selectCustomer(first || null);
    }
    return;
  }
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

async function handleOrderChanged(change) {
  await refreshOverview({ selectFirst: change?.preserveSelection !== true });
  if (activeView.value === 'overview' && todayInbox.selectedCustomer.value) {
    await todayInbox.refreshSelected({ preserveView: change?.preserveSelection === true });
  }
}

function setWechatScanStatus(message, status = 'info') {
  wechatScanMessage.value = message;
  wechatScanStatus.value = status;
}

function openActiveWechatImport() {
  const item = activeWechatImport.value;
  if (!item) return false;
  smartModeActive.value = false;
  activeView.value = 'create';
  const customer = customerContext.customers.value.find(
    candidate => String(customerId(candidate)) === String(item.customerId)
  );
  if (!customer) {
    setWechatScanStatus(`找不到“${item.customerName}”的客户资料，暂时不能生成微信订单`, 'error');
    return false;
  }
  customerContext.selectCustomer(customer);
  return true;
}

async function loadBoundWechatCustomers() {
  if (!customerContext.customers.value.length) await customerContext.reload();
  const customersById = new Map();
  customerContext.customers.value.forEach((customer) => {
    const id = customerId(customer);
    if (id !== null && id !== undefined) customersById.set(String(id), customer);
  });

  const rows = await Promise.all(Array.from(customersById.values()).map(async (customer) => {
    try {
      const binding = await loadCustomerWechatBinding(customerId(customer));
      return binding.bound ? { customer, binding } : null;
    } catch (error) {
      return { customer, error };
    }
  }));
  const failedCount = rows.filter(row => row?.error).length;
  const byTitle = new Map();
  rows.filter(row => row?.binding).forEach((row) => {
    const title = String(row.binding.displayName || '').trim();
    if (!title) return;
    if (!byTitle.has(title)) byTitle.set(title, []);
    byTitle.get(title).push(row);
  });
  const unique = new Map();
  let ambiguousCount = 0;
  byTitle.forEach((items, title) => {
    if (items.length === 1) unique.set(title, items[0]);
    else ambiguousCount += items.length;
  });
  return { unique, failedCount, ambiguousCount };
}

async function handleWechatScan() {
  if (wechatScanBusy.value) return;
  if (wechatImportQueue.value.length) {
    openActiveWechatImport();
    return;
  }

  wechatScanBusy.value = true;
  setWechatScanStatus('正在核对客户微信绑定，请稍候…');
  try {
    const { unique, failedCount, ambiguousCount } = await loadBoundWechatCustomers();
    const allowedTitles = Array.from(unique.keys());
    if (!allowedTitles.length) {
      throw new Error(ambiguousCount
        ? '已绑定的微信名称存在重复，无法安全判断对应客户，请先改成唯一名称'
        : '还没有客户绑定微信好友或群聊');
    }
    const scanApi = window.electronAPI?.wechatUi?.readUnread;
    if (!scanApi) throw new Error('当前安装包不支持可见地读取微信未读会话');

    setWechatScanStatus(`即将切换到微信，逐个读取 ${allowedTitles.length} 个已绑定会话…`);
    const scan = await scanApi(allowedTitles);
    if (!scan?.ok) throw new Error(scan?.error?.message || '微信未读会话扫描失败');

    const openedTitles = Array.isArray(scan.result?.openedTitles)
      ? scan.result.openedTitles
      : [];
    const imports = [];
    let prepareFailedCount = 0;
    for (const title of openedTitles) {
      const row = unique.get(title);
      if (!row) continue;
      try {
        const result = await prepareWechatOrderImport({
          customerId: customerId(row.customer),
          binding: row.binding,
        });
        if (!result.payload) continue;
        imports.push({
          token: `wechat:${Date.now()}:${++wechatImportSequence}`,
          customerId: customerId(row.customer),
          customerName: row.customer.nxDepartmentAttrName
            || row.customer.nxDepartmentName
            || title,
          conversationTitle: title,
          messageCount: result.pendingCount,
          payload: result.payload,
        });
      } catch {
        prepareFailedCount += 1;
      }
    }

    if (!imports.length) {
      const warningCount = failedCount + ambiguousCount + prepareFailedCount;
      setWechatScanStatus(
        openedTitles.length
          ? `已读完 ${openedTitles.length} 个未读会话，没有发现未处理的新订单${warningCount ? `；另有 ${warningCount} 项需检查` : ''}`
          : '已检查微信，没有发现已绑定客户的未读会话',
        warningCount ? 'warning' : 'success'
      );
      return;
    }

    wechatImportQueue.value = imports;
    const totalMessages = imports.reduce((sum, item) => sum + item.messageCount, 0);
    setWechatScanStatus(
      `发现 ${imports.length} 位客户的 ${totalMessages} 条新订单消息；请确认并保存，保存后会自动进入下一位客户`,
      'success'
    );
    openActiveWechatImport();
  } catch (error) {
    setWechatScanStatus(error?.message || '读取微信订单失败', 'error');
  } finally {
    wechatScanBusy.value = false;
  }
}

async function handleTaskAdded(change) {
  const current = activeWechatImport.value;
  if (current && change?.wechatImportToken === current.token) {
    wechatImportQueue.value = wechatImportQueue.value.slice(1);
  }
  await handleOrderChanged(change);
  if (!current || change?.wechatImportToken !== current.token) return;
  if (wechatImportQueue.value.length) {
    setWechatScanStatus(`“${current.customerName}”已保存，继续处理剩余 ${wechatImportQueue.value.length} 位客户`, 'success');
    openActiveWechatImport();
  } else {
    activeView.value = 'overview';
    setWechatScanStatus('本轮微信订单已全部确认保存', 'success');
  }
}

function handleWechatImportError(event) {
  const current = activeWechatImport.value;
  if (!current || current.token !== event?.token) return;
  setWechatScanStatus(`“${current.customerName}”载入失败：${event.message}。返回订单主页后可点击继续重试`, 'error');
}

async function selectStage(stage) {
  stageFilter.value = stage;
  if (customerVisibleInStage(todayInbox.selectedCustomer.value, stage)
    && todayInbox.selectedCustomer.value) return;
  const first = overview.customers.find(customer => customerVisibleInStage(customer, stage));
  await todayInbox.selectCustomer(first || null);
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
  if (matchingCustomer && customerVisibleInStage(matchingCustomer, stageFilter.value)) {
    await todayInbox.selectCustomer(matchingCustomer);
  }
}
</script>

<style scoped>
.order-workbench {
  position: relative;
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
  flex: 1;
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

.order-workbench__stage-icon.is-wechat-scan {
  display: grid;
  width: 22px;
  height: 22px;
  flex: none;
  place-items: center;
  border-radius: 7px;
  color: #116a45;
  background: #e5f7ed;
}
.order-workbench__stage-icon.is-wechat-scan svg { width: 13px; height: 13px; }
.order-workbench__header-stages > button.is-wechat-scan { border-color: #b9dacb; color: #116a45; }
.order-workbench__header-stages > button.is-wechat-scan:hover { border-color: #178454; background: #f3fbf7; }
.order-workbench__header-stages > button:disabled { cursor: wait; opacity: .65; }

.order-workbench__content { min-width: 0; min-height: 0; }

.order-workbench__wechat-status {
  position: fixed;
  z-index: 1500;
  right: 22px;
  bottom: 22px;
  display: flex;
  max-width: min(560px, calc(100vw - 44px));
  align-items: flex-start;
  gap: 12px;
  padding: 11px 12px 11px 14px;
  border: 1px solid #b9dacb;
  border-radius: 8px;
  color: #155f40;
  background: #f1fbf5;
  box-shadow: 0 10px 30px rgba(14, 50, 36, .16);
  font-size: 12px;
  font-weight: 700;
}
.order-workbench__wechat-status.is-warning { border-color: #e3c77a; color: #8b5d08; background: #fffaf0; }
.order-workbench__wechat-status.is-error { border-color: #efb8b8; color: #ad2929; background: #fff5f5; }
.order-workbench__wechat-status button { padding: 0; border: 0; color: inherit; background: transparent; font-size: 18px; line-height: 1; cursor: pointer; }

@media (max-width: 1250px) {
  .order-workbench__header-stages { gap: 10px; }
}
</style>
