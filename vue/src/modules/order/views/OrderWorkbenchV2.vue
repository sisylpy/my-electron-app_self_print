<template>
  <main class="order-workbench">
    <Teleport v-if="activeView === 'overview'" to="#product-header-context">
      <nav class="order-workbench__header-stages" aria-label="订单阶段">
        <button
          v-for="stage in stageOptions"
          :key="stage.key"
          type="button"
          :class="[`is-${stage.key}`, { 'is-active': !smartModeActive && stageFilter === stage.key }]"
          @click="selectStage(stage.key)"
        >
          <span class="order-workbench__stage-icon" :class="`is-${stage.key}`" aria-hidden="true">
            <svg v-if="stage.key === 'review'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3.2 2" />
            </svg>
            <svg v-else-if="stage.key === 'progress'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7h11v9H3z" />
              <path d="M14 10h4l3 3v3h-7z" />
              <circle cx="7.5" cy="18.5" r="1.6" />
              <circle cx="16.5" cy="18.5" r="1.6" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 8V4h10v4" />
              <rect x="4" y="8" width="16" height="8" rx="2" />
              <path d="M7 13h10v7H7z" />
            </svg>
          </span>
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
      @task-added="handleTaskAdded"
      @wechat-tasks-loaded="handleDirectWechatTasks"
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
      :smart-mode="smartModeActive"
      :distributer-id="disUser?.nxDiuDistributerId"
      :selected-customer="todayInbox.selectedCustomer.value"
      :snapshot="todayInbox.snapshot.value"
      :stage-filter="stageFilter"
      :list-loading="overviewLoading"
      :detail-loading="todayInbox.detailLoading.value"
      :list-error="overviewError"
      :detail-error="todayInbox.detailError.value"
      :wechat-scan-busy="wechatScanBusy"
      :wechat-scan-label="wechatScanLabel"
      :wechat-import-count="wechatImportQueue.length"
      @select-customer="todayInbox.selectCustomer"
      @refresh-list="refreshAll"
      @refresh-detail="todayInbox.refreshSelected"
      @continue-order="openCreateOrder"
      @smart-mode-change="handleSmartModeChange"
      @scan-wechat="handleWechatScan"
      @new-order="openCreateOrder"
      @data-changed="handleOrderChanged"
    />

    <WechatOrderImportModal
      :open="wechatImportModalOpen"
      :items="wechatImportBatch"
      :active-item="activeWechatImport"
      :completed-tokens="wechatImportCompletedTokens"
      :busy="wechatScanBusy"
      :scan-message="wechatScanMessage"
      :scan-status="wechatScanStatus"
      :scan-report-open="wechatScanReportOpen"
      :scan-progress="wechatScanProgress"
      :scan-results="wechatScanResults"
      :refreshing="wechatImportRefreshing"
      :workspace-warning="wechatWorkspaceWarning"
      :selected-import-busy="wechatSelectedImportBusy"
      :show-selected-import-action="showCurrentWechatReadButton"
      :launcher-current-title="observedWechatConversationTitle"
      :launcher-current-avatar="observedWechatConversationAvatar"
      :action-message="wechatSelectedImportMessage"
      :action-status="wechatSelectedImportStatus"
      :unmatched-conversation-title="wechatUnmatchedConversationTitle"
      :customer-match-open="wechatCustomerMatchOpen"
      :customer-match-customers="customerContext.customers.value"
      :customer-match-busy="wechatCustomerMatchBusy"
      :customer-match-error="wechatCustomerMatchError"
      :group-mode-request="wechatGroupModeRequest"
      @close="closeWechatImportModal"
      @refresh="refreshActiveWechatImport({ manual: true })"
      @merge-new="mergeActiveWechatImport"
      @select-item="selectWechatImport"
      @remove-item="removeWechatImport"
      @scan-unread="readUnreadWechatOrders"
      @scan-all="scanAllBoundWechatOrders"
      @dismiss-scan-report="dismissWechatScanReport"
      @import-selected="importSelectedWechatConversation"
      @start-customer-match="openWechatCustomerMatcher"
      @cancel-customer-match="closeWechatCustomerMatcher"
      @confirm-customer-match="confirmWechatCustomerMatch"
      @select-group-mode="selectWechatGroupMode"
      @cancel-group-mode="cancelWechatGroupMode"
      @dismiss-action-message="dismissWechatSelectedAction"
    >
      <AiOrderPanel
        v-if="activeWechatImport"
        :key="activeWechatImport.token"
        class="order-workbench__wechat-import-panel"
        :customers="customerContext.customers.value"
        :selected-customer="customerContext.selectedCustomer.value"
        :selected-customer-id="customerContext.selectedCustomerId.value"
        :selected-customer-name="customerContext.selectedCustomerName.value"
        :selected-department-id="customerContext.selectedDepartmentId.value"
        :customer-loading="customerContext.loading.value"
        :customer-error="customerContext.error.value"
        :pending-wechat-import="activeWechatImport"
        wechat-import-mode
        @select-customer="customerContext.selectCustomer"
        @select-department="customerContext.selectDepartment"
        @retry-customers="customerContext.reload"
        @order-saved="handleOrderChanged"
        @task-added="handleTaskAdded"
        @wechat-import-error="handleWechatImportError"
        @show-today-orders="closeWechatImportModal"
      />
    </WechatOrderImportModal>

    <Teleport to="body">
      <Transition name="wechat-status-pop">
        <div
          v-if="wechatScanMessage && !wechatImportModalOpen"
          :class="['order-workbench__wechat-status-mask', { 'is-blocking': wechatScanBusy }]"
          @click.stop
        >
          <aside
            :class="['order-workbench__wechat-status', `is-${wechatScanStatus}`, { 'is-busy': wechatScanBusy }]"
            role="dialog"
            aria-modal="true"
            aria-live="polite"
            :aria-busy="wechatScanBusy"
          >
            <div class="order-workbench__wechat-status-icon" aria-hidden="true">
              <span v-if="wechatScanBusy" class="order-workbench__wechat-spinner"></span>
              <svg v-else-if="wechatScanStatus === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m5 12 4 4L19 6" />
              </svg>
              <svg v-else-if="wechatScanStatus === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3 2.8 19h18.4L12 3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              <svg v-else-if="wechatScanStatus === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="m9 9 6 6m0-6-6 6" />
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 17.5 4 20v-5.2A8 8 0 1 1 7 17.5Z" />
                <path d="M8 10h8M8 14h5" />
              </svg>
            </div>
            <div class="order-workbench__wechat-status-copy">
              <small>微信订单</small>
              <strong>{{ wechatScanBusy ? '正在读取微信' : '读取结果' }}</strong>
              <p>{{ wechatScanMessage }}</p>
            </div>
            <button
              v-if="!wechatScanBusy"
              type="button"
              aria-label="关闭提示"
              @click="wechatScanMessage = ''"
            >×</button>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useStore } from 'vuex';
import AiOrderPanel from '../components/workbench/AiOrderPanel.vue';
import OrderFlowInbox from '../components/workbench/OrderFlowInbox.vue';
import WechatOrderImportModal from '../components/workbench/WechatOrderImportModal.vue';
import { useOrderCustomerContext } from '../composables/useOrderCustomerContext';
import { useTodayOrderInbox } from '../composables/useTodayOrderInbox';
import { customerVisibleInStage } from '../services/orderWorkbenchStage';
import { blockingCustomerDirectoryError } from '../services/smartReplenishmentComparison';
import {
  buildWechatReconciliationPlan,
  loadCustomerWechatBinding,
  loadWechatConversationAvatar,
  mergeWechatOrderPayload,
  normalizeWechatAvatarSource,
  prepareWechatOrderImport,
  removeWechatImportQueueItem,
} from '../services/wechatOrderImport';
import {
  splitWechatOrderPayloads,
  wechatOrderTaskLabel,
} from '../services/wechatOrderTaskSplit';
import {
  buildWechatCustomerAssociationDirectory,
  ensureWechatCustomerBinding,
  findWechatCustomerProfileMatches,
  resolveWechatCustomerAssociation,
  WECHAT_GROUP_MODE_REQUIRED,
} from '../services/wechatCustomerAssociation';
import {
  GROUP_ALL_MEMBER_MESSAGES,
  GROUP_MENTION_SELF_ONLY,
} from '../services/wechatOrderMessagePolicy';
import {
  readWechatCustomerDatabaseFirst,
  scanAllBoundWechatCustomers,
} from '../services/wechatAllCustomerScan';
import {
  customerId,
  loadSmartReplenishmentCustomerDirectory,
  loadOrderWorkbenchOverview,
  orderWorkbenchError,
} from '../services/orderWorkbenchService';
import { writeAppLog } from '../../../utils/appLog';

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
const wechatScanReportOpen = ref(false);
const wechatScanProgress = ref({ current: 0, total: 0, title: '', customerName: '' });
const wechatScanResults = ref([]);
const wechatImportQueue = ref([]);
const wechatImportBatch = ref([]);
const wechatImportCompletedTokens = ref([]);
const activeWechatImportToken = ref(null);
const observedWechatConversationTitle = ref('');
const observedWechatConversationAvatar = ref('');
const wechatImportModalOpen = ref(false);
const wechatImportRefreshing = ref(false);
const wechatWorkspaceWarning = ref('');
const wechatWorkspaceReady = ref(false);
const wechatSelectedImportBusy = ref(false);
const wechatSelectedImportMessage = ref('');
const wechatSelectedImportStatus = ref('warning');
const wechatUnmatchedConversationTitle = ref('');
const wechatCustomerMatchOpen = ref(false);
const wechatCustomerMatchBusy = ref(false);
const wechatCustomerMatchError = ref('');
const wechatGroupModeRequest = ref(null);
let wechatGroupModeResolver = null;
let wechatImportSequence = 0;
let wechatConversationFocusDepth = 0;
let wechatReaderWarmupStarted = false;
let wechatOrderTimingSequence = 0;
const wechatConversationAvatars = new Map();
const selectedWechatRetryDelaysMs = Object.freeze([650]);

const wechatOrderTimingLabels = Object.freeze({
  'current-conversation-cached': '读取已监听的当前微信名称',
  'current-conversation-api': '识别当前微信名称',
  'customer-directory-load': '首次加载客户目录',
  'customer-directory-reload': '刷新客户目录后重试',
  'customer-profile-match': '按微信名称匹配客户',
  'binding-load': '读取客户微信绑定',
  'binding-directory-build': '建立客户绑定索引',
  'binding-reuse': '复用已有微信绑定',
  'reader-list-accounts': '读取本机微信账号',
  'reader-find-conversation': '搜索微信会话',
  'group-mode-selection': '等待选择群接收方式',
  'server-save-binding': '保存客户微信绑定',
  'customer-match-remember': '更新本次客户匹配',
  'reader-self-participant': '识别当前微信账号',
  'reader-participants': '读取群成员资料',
  'reader-stability-wait': '等待微信消息写入稳定',
  'reader-messages': '读取微信消息',
  'message-filter': '筛选可转订单消息',
  'server-prepare-messages': '向服务端核对未处理消息',
  'reader-attachments': '读取微信图片附件',
  'payload-build': '组装微信订单内容',
  'import-result': '确认读取结果',
  'task-enqueue': '生成确认任务',
  'confirmation-state-open': '准备订单确认页面',
  'confirmation-page-visible': '订单确认页面完成显示',
});

function timingNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function roundedMs(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function createWechatOrderTiming(action) {
  const startedAt = timingNow();
  let previousAt = startedAt;
  let finished = false;
  const phases = [];
  const traceId = `${Date.now().toString(36)}-${++wechatOrderTimingSequence}`;
  writeAppLog('info', 'wechat-order-timing', 'started', { traceId, action });
  return {
    phase(stage, meta = {}) {
      if (finished) return;
      const now = timingNow();
      const { durationMs: operationDurationMs, ...details } = meta || {};
      const entry = {
        stage,
        label: wechatOrderTimingLabels[stage] || stage,
        phaseMs: roundedMs(now - previousAt),
        totalMs: roundedMs(now - startedAt),
        ...(Number.isFinite(Number(operationDurationMs))
          ? { operationMs: roundedMs(operationDurationMs) }
          : {}),
        ...details,
      };
      phases.push(entry);
      previousAt = now;
      writeAppLog('info', 'wechat-order-timing', 'phase', { traceId, action, ...entry });
    },
    finish(outcome, meta = {}) {
      if (finished) return;
      finished = true;
      writeAppLog(outcome === 'success' ? 'info' : 'warn', 'wechat-order-timing', 'summary', {
        traceId,
        action,
        outcome,
        totalMs: roundedMs(timingNow() - startedAt),
        phases,
        ...meta,
      });
    },
  };
}

async function timeWechatOrderPhase(timing, stage, task, meta = {}) {
  const startedAt = timingNow();
  try {
    const value = await task();
    timing?.phase(stage, { ...meta, durationMs: timingNow() - startedAt });
    return value;
  } catch (error) {
    timing?.phase(stage, {
      ...meta,
      durationMs: timingNow() - startedAt,
      failed: true,
    });
    throw error;
  }
}

function timeWechatOrderSyncPhase(timing, stage, task, meta = {}) {
  const startedAt = timingNow();
  const value = task();
  timing?.phase(stage, { ...meta, durationMs: timingNow() - startedAt });
  return value;
}

function recordWechatServiceTiming(timing, event) {
  if (!event?.stage) return;
  timing?.phase(event.stage, event);
}

async function waitForWechatConfirmationPaint() {
  await nextTick();
  if (typeof window.requestAnimationFrame !== 'function') {
    await new Promise(resolve => setTimeout(resolve, 0));
    return;
  }
  await new Promise(resolve => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
}
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
const activeWechatImport = computed(() => (
  wechatImportQueue.value.find(item => item?.token === activeWechatImportToken.value)
  || wechatImportQueue.value[0]
  || null
));
const showCurrentWechatReadButton = computed(() => {
  const title = normalizeObservedWechatConversationTitle(observedWechatConversationTitle.value);
  if (!title) return true;
  return !wechatImportBatch.value.some(item => (
    normalizeObservedWechatConversationTitle(item?.conversationTitle) === title
  ));
});
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
  if (!smartModeActive.value) return;
  const selectedId = customerId(todayInbox.selectedCustomer.value);
  if (!smartModeCustomers.value.some(customer => String(customerId(customer)) === String(selectedId))) {
    await todayInbox.selectCustomer(smartModeCustomers.value[0] || null);
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

function wechatScanCustomerName(row, fallback = '') {
  return String(
    row?.customer?.nxDepartmentAttrName
    || row?.customer?.nxDepartmentName
    || row?.customer?.departmentName
    || row?.customerName
    || fallback
    || ''
  ).trim();
}

function beginWechatScanReport() {
  wechatScanReportOpen.value = true;
  wechatScanProgress.value = { current: 0, total: 0, title: '', customerName: '' };
  wechatScanResults.value = [];
}

function updateWechatScanResult(result) {
  const title = String(result?.title || '').trim();
  if (!title) return;
  const next = {
    title,
    customerName: String(result?.customerName || title).trim(),
    status: result?.status || 'checking',
    itemCount: Number(result?.itemCount) || 0,
    message: String(result?.message || '').trim(),
    conversationAvatar: normalizeWechatAvatarSource(
      result?.conversationAvatar || wechatConversationAvatars.get(title)
    ),
  };
  const index = wechatScanResults.value.findIndex(item => item.title === title);
  if (index < 0) {
    wechatScanResults.value = [...wechatScanResults.value, next];
    return;
  }
  wechatScanResults.value = wechatScanResults.value.map((item, itemIndex) => (
    itemIndex === index
      ? { ...item, ...next, conversationAvatar: next.conversationAvatar || item.conversationAvatar || '' }
      : item
  ));
}

function beginWechatScanStep({ current, total, title, customerName = '' }) {
  wechatScanProgress.value = { current, total, title, customerName };
  updateWechatScanResult({
    title,
    customerName,
    status: 'checking',
    message: '正在打开微信并核对新消息…',
  });
}

function completeWechatScanStep({ title, customerName = '', status, itemCount = 0, message = '' }) {
  const normalizedStatus = status === 'error' && /搜索不到|没有找到|未找到|找不到/.test(message)
    ? 'not-found'
    : status;
  updateWechatScanResult({ title, customerName, status: normalizedStatus, itemCount, message });
}

async function dismissWechatScanReport() {
  if (wechatScanBusy.value) return;
  wechatScanReportOpen.value = false;
  if (!activeWechatImport.value) return;

  // Let Vue remove the report immediately. Switching the visible WeChat chat
  // can then continue alongside the close transition instead of delaying the
  // completed report by another full conversation search.
  await nextTick();
  await openActiveWechatImport({
    preserveScanMessage: true,
    openWorkspace: false,
    focusConversation: true,
  });
}

function messageFingerprints(payload) {
  return new Set((payload?.source?.messages || []).map(message => String(message.messageFingerprint)));
}

function replaceWechatImportItem(token, replacement) {
  wechatImportQueue.value = wechatImportQueue.value.map(item => (
    item.token === token ? replacement : item
  ));
  wechatImportBatch.value = wechatImportBatch.value.map(item => (
    item.token === token ? replacement : item
  ));
}

async function refreshActiveWechatImport(options = {}) {
  const item = activeWechatImport.value;
  if (!item || wechatImportRefreshing.value || !wechatImportModalOpen.value) return false;
  wechatImportRefreshing.value = true;
  try {
    if (options.manual) {
      wechatWorkspaceWarning.value = await focusWechatImportConversation(item);
    }
    const result = await prepareWechatOrderImport({
      customerId: item.customerId,
      binding: item.binding,
      // 用户手动触发时做一次短暂、有限的稳定性复查；页面不再后台轮询。
      retryDelaysMs: selectedWechatRetryDelaysMs,
    });
    if (!result.payload) {
      if (options.manual) {
        replaceWechatImportItem(item.token, {
          ...item,
          refreshNote: '当前会话没有新增订单消息',
          refreshError: '',
        });
      }
      return false;
    }
    if (options.manual) {
      // The first focus makes WeChat hydrate its local database. A message can
      // finish arriving while the Reader is doing its stability checks, after
      // that first focus already happened, and WeChat then shows it as unread
      // even though the order was successfully collected. Activate and verify
      // the same conversation again only after payload retrieval succeeds so
      // the visible WeChat unread state matches the imported order state.
      const markReadWarning = await focusWechatImportConversation(item);
      if (markReadWarning) {
        wechatWorkspaceWarning.value = [wechatWorkspaceWarning.value, markReadWarning]
          .filter(Boolean)
          .join('；');
      }
    }
    result.conversationAvatar = await resolveWechatConversationAvatar(
      item.conversationTitle,
      result.binding || item.binding,
      item.conversationAvatar
    );
    const incomingItems = createWechatImportItems({
      customerId: item.customerId,
      customerName: item.customerName,
      binding: item.binding,
    }, item.conversationTitle, result);
    const matchingItem = incomingItems.find(candidate => (
      wechatImportTaskKey(candidate) === wechatImportTaskKey(item)
    ));
    const otherItems = incomingItems.filter(candidate => candidate !== matchingItem);
    if (otherItems.length) enqueueWechatImportItems(otherItems, { activate: false });
    if (!matchingItem) {
      if (options.manual) {
        replaceWechatImportItem(item.token, {
          ...item,
          refreshNote: otherItems.length ? '发现另一类微信订单任务，已加入待处理列表' : '当前任务没有新增订单消息',
          refreshError: '',
        });
      }
      return otherItems.length > 0;
    }
    const existing = messageFingerprints(item.payload);
    const incoming = messageFingerprints(matchingItem.payload);
    const lateMessageCount = Array.from(incoming).filter(id => !existing.has(id)).length;
    if (!lateMessageCount) {
      if (options.manual) {
        replaceWechatImportItem(item.token, {
          ...item,
          refreshNote: '当前会话已经是最新内容',
          refreshError: '',
        });
      }
      return false;
    }
    const mergedPayload = mergeWechatOrderPayload(item.payload, matchingItem.payload);
    replaceWechatImportItem(item.token, {
      ...item,
      binding: result.binding || item.binding,
      pendingRefreshPayload: mergedPayload,
      pendingMessageCount: mergedPayload.source.messages.length,
      lateMessageCount,
      refreshNote: `发现 ${lateMessageCount} 条后来到达的新消息`,
      refreshError: '',
    });
    return true;
  } catch (error) {
    replaceWechatImportItem(item.token, {
      ...item,
      refreshError: error?.message || '同步当前微信会话失败',
      refreshNote: '',
    });
    return false;
  } finally {
    wechatImportRefreshing.value = false;
  }
}

function mergeActiveWechatImport() {
  const item = activeWechatImport.value;
  if (!item?.pendingRefreshPayload) return;
  const refreshed = {
    ...item,
    token: `wechat:${Date.now()}:${++wechatImportSequence}`,
    payload: item.pendingRefreshPayload,
    messageCount: Number(item.pendingMessageCount) || item.messageCount,
    pendingRefreshPayload: null,
    pendingMessageCount: 0,
    lateMessageCount: 0,
    refreshNote: '已合并新增消息并重新解析订单',
    refreshError: '',
  };
  replaceWechatImportItem(item.token, refreshed);
  activeWechatImportToken.value = refreshed.token;
}

async function focusWechatImportConversation(item) {
  const conversationTitle = String(item?.conversationTitle || '').trim();
  const focusApi = window.electronAPI?.wechatUi?.focusConversation;
  if (!conversationTitle || !focusApi) return '';
  wechatConversationFocusDepth += 1;
  try {
    const result = await focusApi(conversationTitle);
    return result?.ok
      ? ''
      : result?.error?.message || '左侧微信未能自动切换到对应会话';
  } catch (error) {
    return error?.message || '左侧微信未能自动切换到对应会话';
  } finally {
    wechatConversationFocusDepth = Math.max(0, wechatConversationFocusDepth - 1);
  }
}

async function openWechatWorkspace() {
  wechatWorkspaceWarning.value = '';
  wechatWorkspaceReady.value = false;
  try {
    const openWorkspace = window.electronAPI?.wechatUi?.openWorkspace;
    if (!openWorkspace) {
      wechatWorkspaceWarning.value = '当前安装包不支持微信窗口停靠';
      return false;
    }
    const result = await openWorkspace();
    if (result && !result.ok) {
      wechatWorkspaceWarning.value = result.error?.message || '微信窗口未能停靠到左侧';
      return false;
    } else if (result?.result?.message) {
      wechatWorkspaceWarning.value = result.result.message;
    }
    wechatWorkspaceReady.value = true;
    return true;
  } catch (error) {
    wechatWorkspaceWarning.value = error?.message || '微信窗口未能停靠到左侧';
    return false;
  }
}

function prewarmWechatReader() {
  if (wechatReaderWarmupStarted) return;
  const warmUp = window.electronAPI?.wechatReader?.warmUp;
  if (!warmUp) return;
  wechatReaderWarmupStarted = true;
  void warmUp().then((result) => {
    if (!result?.ok) wechatReaderWarmupStarted = false;
  }).catch(() => {
    // Prewarming is an invisible optimization. A failure falls back to the
    // normal on-demand Reader path and remains retryable on the next opening.
    wechatReaderWarmupStarted = false;
  });
}

async function openActiveWechatImport(options = {}) {
  const item = activeWechatImport.value;
  if (!item) return false;
  smartModeActive.value = false;
  activeView.value = 'overview';
  const customer = customerContext.customers.value.find(
    candidate => String(customerId(candidate)) === String(item.customerId)
  );
  if (!customer) {
    setWechatScanStatus(`找不到“${item.customerName}”的客户资料，暂时不能生成微信订单`, 'error');
    return false;
  }
  customerContext.selectCustomer(customer);
  if (options.preserveScanMessage !== true) wechatScanMessage.value = '';
  // Opening the workspace raises WeChat on macOS. A task-card change only
  // changes the right-side draft, so keep the existing side-by-side windows
  // untouched unless this is an initial/manual workspace entry.
  if (options.openWorkspace !== false) {
    await openWechatWorkspace();
  } else if (options.focusConversation !== false) {
    // A new automatic/manual switch supersedes an earlier focus warning.
    // Keep the warning actionable instead of carrying a stale mismatch into
    // the next customer.
    wechatWorkspaceWarning.value = '';
  }
  if (options.focusConversation !== false) {
    observedWechatConversationTitle.value = normalizeObservedWechatConversationTitle(
      item.conversationTitle
    );
  }
  const focusWarning = options.focusConversation === false
    ? ''
    : await focusWechatImportConversation(item);
  const focusedTitle = normalizeObservedWechatConversationTitle(item.conversationTitle);
  if (options.focusConversation !== false) {
    if (!focusWarning) observedWechatConversationTitle.value = focusedTitle;
    else if (observedWechatConversationTitle.value === focusedTitle) {
      observedWechatConversationTitle.value = '';
    }
  }
  wechatWorkspaceWarning.value = [wechatWorkspaceWarning.value, focusWarning]
    .filter(Boolean)
    .join('；');
  wechatImportModalOpen.value = true;
  return true;
}

async function selectWechatImport(token) {
  const item = wechatImportQueue.value.find(candidate => candidate?.token === token);
  if (!item) return;
  activeWechatImportToken.value = item.token;
  // Keep the native WeChat selection aligned with the task card. Re-clicking
  // the active card intentionally focuses the conversation again, which gives
  // the user a quick way to recover if WeChat was changed manually.
  await openActiveWechatImport({ openWorkspace: false, focusConversation: true });
}

async function removeWechatImport(token) {
  const item = wechatImportBatch.value.find(candidate => candidate?.token === token);
  const wasActive = activeWechatImport.value?.token === token;
  const update = removeWechatImportQueueItem(wechatImportQueue.value, token);
  if (!update.removed) return;

  wechatImportQueue.value = update.items;
  wechatImportBatch.value = wechatImportBatch.value.filter(candidate => candidate?.token !== token);
  wechatImportCompletedTokens.value = wechatImportCompletedTokens.value.filter(
    completedToken => completedToken !== token
  );
  if (wasActive) activeWechatImportToken.value = update.nextToken;

  if (!wechatImportQueue.value.length) {
    activeWechatImportToken.value = null;
    await closeWechatImportModal();
    setWechatScanStatus(
      `已从本轮列表移除“${item?.conversationTitle || item?.customerName || '该会话'}”，当前没有待确认的微信订单`,
      'success'
    );
    return;
  }
  if (wasActive) {
    await openActiveWechatImport({ openWorkspace: false, focusConversation: true });
  }
}

function normalizeObservedWechatConversationTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s*\(\d+\)\s*$/u, '')
    .trim();
}

function normalizeObservedWechatConversationAvatar(value) {
  const avatar = normalizeWechatAvatarSource(value);
  return avatar.startsWith('data:image/png;base64,') ? avatar : '';
}

function applyWechatConversationAvatar(titleValue, avatarValue) {
  const title = normalizeObservedWechatConversationTitle(titleValue);
  const avatar = normalizeWechatAvatarSource(avatarValue);
  if (!title || !avatar) return '';
  wechatConversationAvatars.set(title, avatar);
  const addAvatar = item => (
    normalizeObservedWechatConversationTitle(item?.conversationTitle || item?.title) === title
      ? { ...item, conversationAvatar: avatar }
      : item
  );
  wechatImportQueue.value = wechatImportQueue.value.map(addAvatar);
  wechatImportBatch.value = wechatImportBatch.value.map(addAvatar);
  wechatScanResults.value = wechatScanResults.value.map(addAvatar);
  return avatar;
}

async function resolveWechatConversationAvatar(title, binding, preferredAvatar = '') {
  const normalizedTitle = normalizeObservedWechatConversationTitle(title);
  if (!normalizedTitle) return '';
  const preferred = applyWechatConversationAvatar(normalizedTitle, preferredAvatar);
  if (preferred) return preferred;
  const cached = normalizeWechatAvatarSource(wechatConversationAvatars.get(normalizedTitle));
  if (cached) return cached;
  const avatar = await loadWechatConversationAvatar({
    binding,
    conversationTitle: normalizedTitle,
  });
  return applyWechatConversationAvatar(normalizedTitle, avatar);
}

async function syncWechatSelectionFromDesktop(payload) {
  const title = normalizeObservedWechatConversationTitle(payload?.title);
  if (!title) return;
  const previousTitle = normalizeObservedWechatConversationTitle(
    observedWechatConversationTitle.value
  );
  if (previousTitle && previousTitle !== title) observedWechatConversationAvatar.value = '';
  observedWechatConversationTitle.value = title;
  const avatarDataUrl = normalizeObservedWechatConversationAvatar(payload?.avatarDataUrl);
  if (avatarDataUrl) {
    observedWechatConversationAvatar.value = avatarDataUrl;
    applyWechatConversationAvatar(title, avatarDataUrl);
  }
  if (!wechatImportModalOpen.value
      || wechatScanBusy.value
      || wechatSelectedImportBusy.value
      || wechatCustomerMatchBusy.value
      || wechatConversationFocusDepth > 0) return;

  const currentTitle = normalizeObservedWechatConversationTitle(
    activeWechatImport.value?.conversationTitle
  );
  if (currentTitle === title) return;

  const matchingItem = wechatImportQueue.value.find(item => (
    normalizeObservedWechatConversationTitle(item?.conversationTitle) === title
  ));
  if (!matchingItem) return;

  activeWechatImportToken.value = matchingItem.token;
  // This event already came from a real WeChat selection. Only update the
  // right-side draft; focusing WeChat again would create a feedback loop.
  await openActiveWechatImport({ openWorkspace: false, focusConversation: false });
}

const removeWechatConversationListener = window.electronAPI?.wechatUi
  ?.onConversationChanged?.((payload) => {
    void syncWechatSelectionFromDesktop(payload);
  });

async function closeWechatImportModal() {
  cancelWechatGroupMode();
  const shouldCloseWechatWorkspace = wechatWorkspaceReady.value;
  wechatImportModalOpen.value = false;
  wechatScanReportOpen.value = false;
  wechatWorkspaceReady.value = false;
  observedWechatConversationTitle.value = '';
  observedWechatConversationAvatar.value = '';
  wechatScanMessage.value = '';
  dismissWechatSelectedAction();
  activeView.value = 'overview';
  if (!shouldCloseWechatWorkspace) return;
  try {
    await window.electronAPI?.wechatUi?.closeWorkspace?.();
  } catch {
    // 窗口恢复失败不影响订单数据；主进程退出时仍会再做一次兜底恢复。
  }
}

onBeforeUnmount(() => {
  cancelWechatGroupMode();
  removeWechatConversationListener?.();
  void window.electronAPI?.wechatUi?.closeWorkspace?.();
});

async function loadBoundWechatCustomers({ refreshCustomers = false } = {}) {
  if (refreshCustomers || !customerContext.customers.value.length) await customerContext.reload();
  const customersById = new Map();
  customerContext.customers.value.forEach((customer) => {
    const id = customerId(customer);
    if (id !== null && id !== undefined) customersById.set(String(id), customer);
  });

  const rows = await Promise.all(Array.from(customersById.values()).map(async (customer) => {
    try {
      const binding = await loadCustomerWechatBinding(customerId(customer));
      return { customer, binding };
    } catch (error) {
      return { customer, error };
    }
  }));
  const failedCount = rows.filter(row => row?.error).length;
  const associationDirectory = buildWechatCustomerAssociationDirectory(rows);
  const unique = new Map();
  let ambiguousCount = 0;
  // The visible WeChat name belongs to the customer profile first. Search the
  // complete, freshly loaded customer directory instead of limiting the scan
  // to rows that already have a technical conversation fingerprint. A unique
  // profile match can repair that fingerprint after WeChat opens the chat.
  associationDirectory.allowedTitles.forEach((title) => {
    try {
      unique.set(title, resolveWechatCustomerAssociation(associationDirectory, title));
    } catch {
      ambiguousCount += 1;
    }
  });
  return { unique, failedCount, ambiguousCount, associationDirectory };
}

function wechatImportTaskKey(item) {
  const conversationFingerprint = item?.payload?.source?.conversationFingerprint
    || item?.binding?.conversationFingerprint
    || item?.conversationTitle
    || '';
  // Text messages intentionally remain one paste task per conversation. Each
  // image carries its source-message fingerprint so independently editable
  // visual recognition tasks never merge into one another.
  const taskFingerprint = item?.payload?.taskFingerprint || '';
  return [item?.customerId, conversationFingerprint, item?.taskType || 'mixed', taskFingerprint].join('|');
}

function createWechatImportItemsFromTasks(row, title, taskPayloads, options = {}) {
  const customerName = row.customerName
    || row.customer?.nxDepartmentAttrName
    || row.customer?.nxDepartmentName
    || title;
  const customer = row.customer || { nxDepartmentId: row.customerId };
  const binding = options.binding || row.binding;
  const pendingCount = options.pendingCount;
  const conversationAvatar = normalizeWechatAvatarSource(
    options.conversationAvatar
    || row.conversationAvatar
    || wechatConversationAvatars.get(normalizeObservedWechatConversationTitle(title))
  );
  return (Array.isArray(taskPayloads) ? taskPayloads : []).map((payload) => {
    const taskType = payload.taskType || 'mixed';
    return {
      token: `wechat:${Date.now()}:${++wechatImportSequence}`,
      customerId: customerId(customer) || row.customerId,
      customerName,
      conversationTitle: title,
      conversationAvatar,
      taskType,
      taskLabel: wechatOrderTaskLabel(taskType),
      messageCount: payload?.source?.messages?.length || pendingCount,
      payload,
      binding,
      lateMessageCount: 0,
      refreshNote: '',
      refreshError: '',
    };
  });
}

function createWechatImportItems(row, title, result) {
  return createWechatImportItemsFromTasks(
    row,
    title,
    splitWechatOrderPayloads(result.payload),
    {
      binding: result.binding || row.binding,
      pendingCount: result.pendingCount,
      conversationAvatar: result.conversationAvatar,
    }
  );
}

function rememberWechatCustomerMatch(customer, conversationTitle) {
  const selectedCustomerId = customerId(customer);
  customerContext.customers.value.forEach((candidate) => {
    if (String(candidate?.nxDepartmentWechatDisplayName || '').trim() !== conversationTitle) return;
    if (String(customerId(candidate)) !== String(selectedCustomerId)) {
      candidate.nxDepartmentWechatDisplayName = '';
    }
  });
  customer.nxDepartmentWechatDisplayName = conversationTitle;
}

function enqueueWechatImportItems(incomingItems, { activate = true } = {}) {
  let firstToken = null;
  (Array.isArray(incomingItems) ? incomingItems : []).forEach((incomingItem) => {
    const existing = wechatImportQueue.value.find(item => (
      wechatImportTaskKey(item) === wechatImportTaskKey(incomingItem)
    ));
    if (existing) {
      const payload = mergeWechatOrderPayload(existing.payload, incomingItem.payload);
      const replacement = {
        ...existing,
        ...incomingItem,
        // Keep the queue identity stable: refreshes must not make the active
        // task disappear merely because a newer payload was merged into it.
        token: existing.token,
        payload,
        messageCount: payload?.source?.messages?.length || incomingItem.messageCount,
        conversationAvatar: incomingItem.conversationAvatar || existing.conversationAvatar || '',
      };
      replaceWechatImportItem(existing.token, replacement);
      if (!firstToken) firstToken = replacement.token;
      return;
    }
    wechatImportQueue.value = [...wechatImportQueue.value, incomingItem];
    wechatImportBatch.value = [...wechatImportBatch.value, incomingItem];
    if (!firstToken) firstToken = incomingItem.token;
  });
  // `splitWechatOrderPayloads` deliberately returns text before images, so
  // manual conversion should begin with the instant text task rather than
  // blocking it behind a potentially slow OCR request.
  if (activate && firstToken) activeWechatImportToken.value = firstToken;
  return firstToken;
}

function enqueueWechatImport(row, title, result) {
  return enqueueWechatImportItems(createWechatImportItems(row, title, result));
}

async function handleDirectWechatTasks(event) {
  const tasks = Array.isArray(event?.tasks) ? event.tasks : [];
  const customer = event?.customer || customerContext.selectedCustomer.value;
  const selectedCustomerId = event?.customerId ?? customerId(customer);
  if (!tasks.length || selectedCustomerId === null || selectedCustomerId === undefined) {
    setWechatScanStatus('当前客户信息不完整，无法创建微信订单任务', 'error');
    return;
  }

  const conversationTitle = String(
    event?.conversationTitle
    || event?.binding?.displayName
    || customer?.nxDepartmentWechatDisplayName
    || event?.customerName
    || ''
  ).trim();
  const row = {
    customer,
    customerId: selectedCustomerId,
    customerName: event?.customerName,
    binding: event?.binding || null,
  };
  const imports = createWechatImportItemsFromTasks(row, conversationTitle, tasks, {
    binding: event?.binding || null,
    pendingCount: event?.pendingCount,
  });
  if (!imports.length) {
    setWechatScanStatus('当前微信会话没有可处理的订单消息', 'info');
    return;
  }

  enqueueWechatImportItems(imports);
  setWechatScanStatus(
    `已生成 ${imports.length} 个微信订单任务，请在任务列表中切换处理`,
    'success'
  );
  await openActiveWechatImport();
}

function requestWechatGroupMode(row, selectedTitle) {
  return new Promise((resolve) => {
    if (wechatGroupModeResolver) wechatGroupModeResolver(null);
    wechatGroupModeResolver = resolve;
    wechatGroupModeRequest.value = {
      title: selectedTitle,
      customerName: row?.customer?.nxDepartmentAttrName
        || row?.customer?.nxDepartmentName
        || row?.customer?.departmentName
        || selectedTitle,
    };
  });
}

function settleWechatGroupMode(groupMode) {
  const resolve = wechatGroupModeResolver;
  wechatGroupModeResolver = null;
  wechatGroupModeRequest.value = null;
  if (resolve) resolve(groupMode);
}

function selectWechatGroupMode(groupMode) {
  if (![GROUP_ALL_MEMBER_MESSAGES, GROUP_MENTION_SELF_ONLY].includes(groupMode)) return;
  settleWechatGroupMode(groupMode);
}

function cancelWechatGroupMode() {
  settleWechatGroupMode(null);
}

async function ensureWechatBindingWithGroupMode(options) {
  try {
    return await ensureWechatCustomerBinding(options);
  } catch (error) {
    if (error?.code !== WECHAT_GROUP_MODE_REQUIRED) throw error;
    const groupModeStartedAt = timingNow();
    const groupMode = await requestWechatGroupMode(options.row, options.selectedTitle);
    if (typeof options.onTiming === 'function') {
      options.onTiming({
        stage: 'group-mode-selection',
        durationMs: timingNow() - groupModeStartedAt,
        cancelled: !groupMode,
      });
    }
    if (!groupMode) throw new Error('已取消选择群订单接收方式');
    return ensureWechatCustomerBinding({ ...options, groupMode });
  }
}

async function importWechatConversationForCustomer(
  customer,
  title,
  timing = null,
  preferredAvatar = ''
) {
  const selectedCustomerId = customerId(customer);
  const onTiming = event => recordWechatServiceTiming(timing, event);
  const binding = await timeWechatOrderPhase(
    timing,
    'binding-load',
    () => loadCustomerWechatBinding(selectedCustomerId)
  );
  const row = { customer, binding };
  const directory = timeWechatOrderSyncPhase(
    timing,
    'binding-directory-build',
    () => buildWechatCustomerAssociationDirectory([row])
  );
  row.binding = await ensureWechatBindingWithGroupMode({
    row,
    selectedTitle: title,
    directory,
    onTiming,
  });
  timeWechatOrderSyncPhase(
    timing,
    'customer-match-remember',
    () => rememberWechatCustomerMatch(customer, title)
  );
  const result = await prepareWechatOrderImport({
    customerId: selectedCustomerId,
    binding: row.binding,
    retryDelaysMs: selectedWechatRetryDelaysMs,
    onTiming,
  });
  timing?.phase('import-result', {
    status: result.status,
    pendingCount: Number(result.pendingCount) || 0,
  });
  if (!result.payload) {
    throw new Error(result.message || '已关联该微信好友，但当前没有未处理的新订单');
  }
  result.conversationAvatar = await resolveWechatConversationAvatar(
    title,
    result.binding || row.binding,
    preferredAvatar
  );
  timeWechatOrderSyncPhase(
    timing,
    'task-enqueue',
    () => enqueueWechatImport(row, title, result),
    { taskCount: splitWechatOrderPayloads(result.payload).length }
  );
  wechatSelectedImportMessage.value = '';
  wechatUnmatchedConversationTitle.value = '';
  wechatCustomerMatchOpen.value = false;
  wechatCustomerMatchError.value = '';
  await timeWechatOrderPhase(
    timing,
    'confirmation-state-open',
    () => openActiveWechatImport({ focusConversation: false })
  );
}

async function importSelectedWechatConversation() {
  if (wechatSelectedImportBusy.value || wechatScanBusy.value) return;
  const timing = createWechatOrderTiming('read-selected-wechat');
  let outcome = 'needs-customer-match';
  let confirmationReady = false;
  wechatSelectedImportBusy.value = true;
  wechatSelectedImportMessage.value = '';
  wechatSelectedImportStatus.value = 'warning';
  wechatUnmatchedConversationTitle.value = '';
  wechatCustomerMatchOpen.value = false;
  wechatCustomerMatchError.value = '';
  try {
    const cachedTitle = normalizeObservedWechatConversationTitle(
      observedWechatConversationTitle.value
    );
    const currentConversationApi = window.electronAPI?.wechatUi?.currentConversation;
    if (!currentConversationApi) {
      throw new Error('当前安装包不支持识别所选微信好友');
    }
    // The observer is intentionally lightweight and only runs while WeChat is
    // frontmost. A very quick WeChat -> GrainPrint switch can therefore leave
    // its displayed title one beat behind. Always verify the live header when
    // the user commits the action; the cached title remains presentation only.
    const selected = await timeWechatOrderPhase(
      timing,
      'current-conversation-api',
      () => currentConversationApi()
    );
    if (!selected?.ok) {
      throw new Error(selected?.error?.message || '没有识别到当前微信好友');
    }
    const title = normalizeObservedWechatConversationTitle(selected.result?.title);
    if (!title) throw new Error('没有识别到当前微信好友名称');
    const avatarDataUrl = normalizeObservedWechatConversationAvatar(
      selected.result?.avatarDataUrl
    );
    if (cachedTitle && cachedTitle !== title) observedWechatConversationAvatar.value = '';
    observedWechatConversationTitle.value = title;
    if (avatarDataUrl) observedWechatConversationAvatar.value = avatarDataUrl;
    if (avatarDataUrl) applyWechatConversationAvatar(title, avatarDataUrl);
    if (cachedTitle && cachedTitle !== title) {
      timing.phase('current-conversation-cache-corrected', {
        cachedConversationTitle: cachedTitle,
        conversationTitle: title,
      });
    }
    if (!customerContext.customers.value.length) {
      await timeWechatOrderPhase(
        timing,
        'customer-directory-load',
        () => customerContext.reload()
      );
    }
    let matches = timeWechatOrderSyncPhase(
      timing,
      'customer-profile-match',
      () => findWechatCustomerProfileMatches(customerContext.customers.value, title),
      { pass: 1 }
    );
    // 客户资料可能刚在客户中心修改过；仅在首次未命中时刷新一次目录，
    // 不再逐个查询所有客户的微信技术绑定。
    if (!matches.length) {
      await timeWechatOrderPhase(
        timing,
        'customer-directory-reload',
        () => customerContext.reload()
      );
      matches = timeWechatOrderSyncPhase(
        timing,
        'customer-profile-match',
        () => findWechatCustomerProfileMatches(customerContext.customers.value, title),
        { pass: 2 }
      );
    }
    if (matches.length === 1) {
      await importWechatConversationForCustomer(matches[0], title, timing, avatarDataUrl);
      confirmationReady = true;
      outcome = 'success';
      return;
    }
    wechatUnmatchedConversationTitle.value = title;
    if (matches.length > 1) {
      wechatCustomerMatchError.value = '多个客户使用了这个微信好友名，请选择本次订单对应的客户';
    }
  } catch (error) {
    outcome = 'failed';
    wechatSelectedImportStatus.value = 'warning';
    wechatSelectedImportMessage.value = error?.message || '转所选微信好友订单失败';
  } finally {
    wechatSelectedImportBusy.value = false;
    if (confirmationReady) {
      await waitForWechatConfirmationPaint();
      timing.phase('confirmation-page-visible', {
        taskCount: wechatImportBatch.value.length,
      });
    }
    timing.finish(outcome, {
      taskCount: wechatImportBatch.value.length,
      error: outcome === 'failed' ? wechatSelectedImportMessage.value : undefined,
    });
  }
}

async function openWechatCustomerMatcher() {
  if (!wechatUnmatchedConversationTitle.value) return;
  wechatCustomerMatchError.value = '';
  if (!customerContext.customers.value.length) await customerContext.reload();
  if (!customerContext.customers.value.length) {
    wechatCustomerMatchError.value = customerContext.error.value || '没有可关联的客户';
    return;
  }
  wechatCustomerMatchOpen.value = true;
}

function closeWechatCustomerMatcher() {
  if (wechatCustomerMatchBusy.value) return;
  wechatCustomerMatchOpen.value = false;
  wechatCustomerMatchError.value = '';
}

async function confirmWechatCustomerMatch(selectedCustomerId) {
  if (wechatCustomerMatchBusy.value) return;
  const timing = createWechatOrderTiming('confirm-selected-wechat-customer');
  let outcome = 'failed';
  let confirmationReady = false;
  const customer = customerContext.customers.value.find(candidate => (
    String(customerId(candidate)) === String(selectedCustomerId)
  ));
  if (!customer) {
    wechatCustomerMatchError.value = '请选择要关联的客户';
    timing.finish('failed', { error: wechatCustomerMatchError.value });
    return;
  }
  const title = wechatUnmatchedConversationTitle.value;
  timing.phase('customer-profile-match', { manuallySelected: true });
  wechatCustomerMatchBusy.value = true;
  wechatCustomerMatchError.value = '';
  try {
    await importWechatConversationForCustomer(customer, title, timing);
    confirmationReady = true;
    outcome = 'success';
  } catch (error) {
    wechatCustomerMatchError.value = error?.message || '关联客户并转订单失败';
  } finally {
    wechatCustomerMatchBusy.value = false;
    if (confirmationReady) {
      await waitForWechatConfirmationPaint();
      timing.phase('confirmation-page-visible', {
        taskCount: wechatImportBatch.value.length,
      });
    }
    timing.finish(outcome, {
      taskCount: wechatImportBatch.value.length,
      error: outcome === 'failed' ? wechatCustomerMatchError.value : undefined,
    });
  }
}

function dismissWechatSelectedAction() {
  if (wechatSelectedImportBusy.value || wechatCustomerMatchBusy.value) return;
  wechatSelectedImportMessage.value = '';
  wechatUnmatchedConversationTitle.value = '';
  wechatCustomerMatchOpen.value = false;
  wechatCustomerMatchError.value = '';
}

async function handleWechatScan() {
  if (wechatScanBusy.value || wechatSelectedImportBusy.value) return;
  wechatScanReportOpen.value = false;
  if (wechatImportQueue.value.length) {
    // “稍后处理”会恢复原来的全屏窗口布局。继续现有任务时需要重新
    // 建立左侧微信、右侧订单的并排工作区，但不重复搜索或切换会话。
    await openActiveWechatImport({ openWorkspace: true, focusConversation: false });
    return;
  }

  wechatSelectedImportMessage.value = '';
  wechatScanMessage.value = '';
  wechatScanStatus.value = 'info';
  smartModeActive.value = false;
  activeView.value = 'overview';
  wechatImportModalOpen.value = true;
  prewarmWechatReader();
  await openWechatWorkspace();
}

async function readUnreadWechatOrders() {
  if (wechatScanBusy.value || wechatSelectedImportBusy.value) return;
  wechatScanBusy.value = true;
  beginWechatScanReport();
  wechatSelectedImportMessage.value = '';
  wechatImportQueue.value = [];
  wechatImportBatch.value = [];
  wechatImportCompletedTokens.value = [];
  activeWechatImportToken.value = null;
  setWechatScanStatus('正在核对客户微信绑定，请稍候…');
  wechatImportModalOpen.value = true;
  try {
    if (!wechatWorkspaceReady.value && !await openWechatWorkspace()) {
      throw new Error(wechatWorkspaceWarning.value || '微信窗口未能停靠到屏幕左侧');
    }
    const {
      unique,
      failedCount,
      ambiguousCount,
      associationDirectory,
    } = await loadBoundWechatCustomers({ refreshCustomers: true });
    const allowedTitles = Array.from(unique.keys());
    if (!allowedTitles.length) {
      throw new Error(ambiguousCount
        ? '已绑定的微信名称存在重复，无法安全判断对应客户，请先改成唯一名称'
        : '还没有客户绑定微信好友或群聊');
    }
    const scanApi = window.electronAPI?.wechatUi?.readUnread;
    if (!scanApi) throw new Error('当前安装包不支持可见地读取微信未读会话');

    setWechatScanStatus('即将切换到微信，只检查本次未读的已绑定会话…');
    const scan = await scanApi(allowedTitles);
    if (!scan?.ok) throw new Error(scan?.error?.message || '微信未读会话扫描失败');

    const openedTitles = Array.isArray(scan.result?.openedTitles)
      ? scan.result.openedTitles
      : [];
    // macOS reports the exact unread chats it opened plus the single chat that
    // was selected before scanning. Reconcile only those candidates so a run
    // with 2 unread customers does not query every bound customer.
    const candidateTitles = Array.isArray(scan.result?.candidateTitles)
      ? scan.result.candidateTitles
      : allowedTitles;
    const reconciliationPlan = buildWechatReconciliationPlan(candidateTitles, openedTitles);
    const imports = [];
    let prepareFailedCount = 0;
    setWechatScanStatus(
      `微信读取完成，正在整理 ${reconciliationPlan.length} 个会话的订单…`
    );
    for (let index = 0; index < reconciliationPlan.length; index += 1) {
      const candidate = reconciliationPlan[index];
      const { title } = candidate;
      const row = unique.get(title);
      if (!row) continue;
      const customerName = wechatScanCustomerName(row, title);
      beginWechatScanStep({
        current: index + 1,
        total: reconciliationPlan.length,
        title,
        customerName,
      });
      try {
        row.binding = await ensureWechatBindingWithGroupMode({
          row,
          selectedTitle: title,
          directory: associationDirectory,
        });
        const conversationAvatarPromise = resolveWechatConversationAvatar(title, row.binding);
        const result = await prepareWechatOrderImport({
          customerId: customerId(row.customer),
          binding: row.binding,
          // 已经由界面打开的会话需要等待微信本地库稳定；其余绑定会话做即时
          // 补查，避免当前选中会话在微信激活时先被标成已读而漏单。
          retryDelaysMs: candidate.opened ? undefined : [],
        });
        if (!result.payload) {
          completeWechatScanStep({
            title,
            customerName,
            status: 'empty',
            message: '没有未处理的新订单',
          });
          continue;
        }
        result.conversationAvatar = await resolveWechatConversationAvatar(
          title,
          result.binding || row.binding,
          await conversationAvatarPromise
        );
        const items = createWechatImportItems(row, title, result);
        imports.push(...items);
        completeWechatScanStep({
          title,
          customerName,
          status: 'found',
          itemCount: items.length,
          message: `发现 ${items.length} 个订单任务`,
        });
      } catch (error) {
        prepareFailedCount += 1;
        completeWechatScanStep({
          title,
          customerName,
          status: 'error',
          message: error?.message || '整理该微信会话失败',
        });
      }
    }

    if (!imports.length) {
      const warningCount = failedCount + ambiguousCount + prepareFailedCount;
      setWechatScanStatus(
        `已核对 ${reconciliationPlan.length} 个已绑定微信会话，没有发现未处理的新订单${warningCount ? `；另有 ${warningCount} 项需检查` : ''}`,
        warningCount ? 'warning' : 'success'
      );
      return;
    }

    wechatImportQueue.value = imports;
    wechatImportBatch.value = imports;
    wechatImportCompletedTokens.value = [];
    activeWechatImportToken.value = imports[0]?.token || null;
    const totalMessages = imports.reduce((sum, item) => sum + item.messageCount, 0);
    const customerCount = new Set(imports.map(item => String(item.customerId))).size;
    setWechatScanStatus(
      `发现 ${customerCount} 位客户的 ${imports.length} 个订单任务（${totalMessages} 条新消息）；请确认并保存，保存后会自动进入下一项任务`,
      'success'
    );
    await openActiveWechatImport({ preserveScanMessage: true });
  } catch (error) {
    setWechatScanStatus(error?.message || '读取微信订单失败', 'error');
  } finally {
    wechatScanBusy.value = false;
  }
}

async function scanAllBoundWechatOrders() {
  if (wechatScanBusy.value || wechatSelectedImportBusy.value) return;
  const timing = createWechatOrderTiming('scan-all-bound-wechat');
  let timingOutcome = 'failed';
  let timingSummary = {
    checkedCount: 0,
    orderCustomerCount: 0,
    taskCount: 0,
    messageCount: 0,
    warningCount: 0,
    databaseOnlyCount: 0,
    conversationVerificationCount: 0,
  };
  let databaseOnlyCount = 0;
  let conversationVerificationCount = 0;
  const preservedTaskCount = wechatImportBatch.value.length;
  wechatScanBusy.value = true;
  beginWechatScanReport();
  wechatSelectedImportMessage.value = '';
  setWechatScanStatus('正在从客户中心加载全部微信关联，请稍候…');
  wechatImportModalOpen.value = true;

  try {
    if (!wechatWorkspaceReady.value) {
      await timeWechatOrderPhase(timing, 'scan-workspace-open', async () => {
        if (!await openWechatWorkspace()) {
          throw new Error(wechatWorkspaceWarning.value || '微信窗口未能停靠到屏幕左侧');
        }
      });
    } else {
      timing.phase('scan-workspace-open', { durationMs: 0, reused: true });
    }
    const {
      unique,
      failedCount,
      ambiguousCount,
      associationDirectory,
    } = await timeWechatOrderPhase(
      timing,
      'scan-customer-directory-load',
      () => loadBoundWechatCustomers({ refreshCustomers: true })
    );
    const entries = Array.from(unique.entries()).map(([title, row]) => ({ title, row }));
    timing.phase('scan-customer-directory-ready', {
      customerCount: entries.length,
      failedCount,
      ambiguousCount,
    });
    if (!entries.length) {
      throw new Error(ambiguousCount
        ? '客户中心的微信名称存在重复，无法安全匹配，请先改成唯一名称'
        : '客户中心还没有关联微信好友或群聊');
    }
    if (!window.electronAPI?.wechatUi?.focusConversation) {
      throw new Error('当前安装包不支持逐个打开微信会话');
    }

    const entriesByTitle = new Map(entries.map(entry => [entry.title, entry]));
    const result = await scanAllBoundWechatCustomers({
      entries,
      onProgress: ({ current, total, title }) => {
        setWechatScanStatus(`正在巡查 ${current}/${total}：“${title}”`);
        const entry = entriesByTitle.get(title);
        beginWechatScanStep({
          current,
          total,
          title,
          customerName: wechatScanCustomerName(entry?.row, title),
        });
      },
      onResult: ({ title, status, itemCount, message }) => {
        const entry = entriesByTitle.get(title);
        completeWechatScanStep({
          title,
          customerName: wechatScanCustomerName(entry?.row, title),
          status,
          itemCount,
          message,
        });
      },
      scanEntry: async ({ title, row }, progress = {}) => {
        const customerStartedAt = timingNow();
        const customerMeta = {
          conversationTitle: title,
          customerName: wechatScanCustomerName(row, title),
          current: Number(progress.current || 0),
          total: Number(progress.total || entries.length),
        };
        const onTiming = event => recordWechatServiceTiming(timing, {
          ...event,
          ...customerMeta,
        });
        try {
          row.binding = await timeWechatOrderPhase(
            timing,
            'scan-binding-check',
            () => ensureWechatBindingWithGroupMode({
              row,
              selectedTitle: title,
              directory: associationDirectory,
              onTiming,
            }),
            customerMeta
          );
          const conversationAvatarPromise = resolveWechatConversationAvatar(title, row.binding);
          const readDatabase = ({ mode }) => timeWechatOrderPhase(
            timing,
            'scan-order-read',
            () => prepareWechatOrderImport({
              customerId: customerId(row.customer),
              binding: row.binding,
              // Database-first reads use three snapshots. Only a complete,
              // stable payload may skip visible WeChat navigation. After a
              // conversation is opened, one short verification read is enough
              // because the focus flow already waits for the exact chat header.
              retryDelaysMs: mode === 'database' ? [250, 500] : [250],
              onTiming,
            }),
            { ...customerMeta, readMode: mode }
          );
          const databaseFirst = await readWechatCustomerDatabaseFirst({
            readDatabase,
            focusConversation: async ({ databaseResult, databaseError }) => {
              conversationVerificationCount += 1;
              timing.phase('scan-database-fallback', {
                ...customerMeta,
                status: databaseResult?.status || 'error',
                reason: databaseError?.message || databaseResult?.message || '',
              });
              await timeWechatOrderPhase(timing, 'scan-conversation-focus', async () => {
                const focusWarning = await focusWechatImportConversation({ conversationTitle: title });
                if (focusWarning) throw new Error(focusWarning);
              }, customerMeta);
            },
          });
          if (!databaseFirst.verifiedByConversation) databaseOnlyCount += 1;
          const prepared = databaseFirst.result;
          prepared.conversationAvatar = await conversationAvatarPromise;
          const items = prepared.payload ? createWechatImportItems(row, title, prepared) : [];
          timing.phase('scan-customer-complete', {
            ...customerMeta,
            durationMs: Math.max(0, timingNow() - customerStartedAt),
            status: items.length ? 'found' : 'empty',
            taskCount: items.length,
            readMode: databaseFirst.mode,
          });
          return items;
        } catch (error) {
          timing.phase('scan-customer-complete', {
            ...customerMeta,
            durationMs: Math.max(0, timingNow() - customerStartedAt),
            status: 'error',
            failed: true,
            error: error?.message || String(error),
          });
          throw error;
        }
      },
    });

    const warningCount = failedCount + ambiguousCount + result.failures.length;
    const totalMessages = result.imports.reduce((sum, item) => sum + item.messageCount, 0);
    const customerCount = new Set(result.imports.map(item => String(item.customerId))).size;
    timingOutcome = warningCount ? 'warning' : 'success';
    timingSummary = {
      checkedCount: result.checkedCount,
      orderCustomerCount: customerCount,
      taskCount: result.imports.length,
      messageCount: totalMessages,
      warningCount,
      databaseOnlyCount,
      conversationVerificationCount,
    };
    const checkedSummary = `已巡查 ${result.checkedCount} 个关联微信会话`;
    const warningSummary = warningCount ? `；另有 ${warningCount} 项需检查` : '';
    if (!result.imports.length) {
      const preservedSummary = preservedTaskCount
        ? `；已保留当前 ${preservedTaskCount} 个未保存任务`
        : '';
      setWechatScanStatus(
        `${checkedSummary}，没有发现未处理的新订单${warningSummary}${preservedSummary}`,
        warningCount ? 'warning' : 'success'
      );
      return;
    }

    // A full recheck is available from inside an active draft. Never clear the
    // existing queue before a long external scan: a failed customer or a lost
    // permission must not discard the operator's unsaved edits. Stable task
    // keys merge refreshed messages into the existing token; newly discovered
    // tasks append to the same confirmation list.
    const firstScannedToken = enqueueWechatImportItems(result.imports, { activate: false });
    if (!activeWechatImportToken.value) {
      activeWechatImportToken.value = firstScannedToken;
    }
    setWechatScanStatus(
      `${checkedSummary}，发现 ${customerCount} 位客户的 ${result.imports.length} 个订单任务（${totalMessages} 条新消息）${warningSummary}`,
      warningCount ? 'warning' : 'success'
    );
    timing.phase('scan-results-ready', timingSummary);
    if (warningCount) {
      const failedTitles = result.failures.slice(0, 3).map(item => `“${item.title}”`).join('、');
      wechatWorkspaceWarning.value = [
        wechatWorkspaceWarning.value,
        `巡查已继续完成，但有 ${warningCount} 项需要检查${failedTitles ? `：${failedTitles}` : ''}`,
      ].filter(Boolean).join('；');
    }
  } catch (error) {
    timingOutcome = 'failed';
    timingSummary = {
      ...timingSummary,
      error: error?.message || String(error),
    };
    setWechatScanStatus(error?.message || '巡查全部关联微信失败', 'error');
  } finally {
    wechatScanBusy.value = false;
    await timeWechatOrderPhase(
      timing,
      'scan-report-visible',
      waitForWechatConfirmationPaint,
      timingSummary
    );
    timing.finish(timingOutcome, timingSummary);
  }
}

async function handleTaskAdded(change) {
  const current = activeWechatImport.value;
  if (current && change?.wechatImportToken === current.token) {
    const queueUpdate = removeWechatImportQueueItem(wechatImportQueue.value, current.token);
    const batchUpdate = removeWechatImportQueueItem(wechatImportBatch.value, current.token);
    wechatImportQueue.value = queueUpdate.items;
    wechatImportBatch.value = batchUpdate.items;
    wechatImportCompletedTokens.value = wechatImportCompletedTokens.value.filter(
      token => token !== current.token
    );
    activeWechatImportToken.value = queueUpdate.nextToken;
  }
  await handleOrderChanged(change);
  if (!current || change?.wechatImportToken !== current.token) return;
  if (wechatImportQueue.value.length) {
    await openActiveWechatImport({ openWorkspace: false, focusConversation: true });
  } else {
    activeWechatImportToken.value = null;
    await closeWechatImportModal();
    setWechatScanStatus('本轮微信订单已全部确认保存', 'success');
  }
}

function handleWechatImportError(event) {
  const current = activeWechatImport.value;
  if (!current || current.token !== event?.token) return;
  setWechatScanStatus(`“${current.customerName}”载入失败：${event.message}。返回订单主页后可点击继续重试`, 'error');
}

async function selectStage(stage) {
  smartModeActive.value = false;
  stageFilter.value = stage;
  if (customerVisibleInStage(todayInbox.selectedCustomer.value, stage)
    && todayInbox.selectedCustomer.value) return;
  const first = overview.customers.find(customer => customerVisibleInStage(customer, stage));
  await todayInbox.selectCustomer(first || null);
}

function openCreateOrder(customer) {
  smartModeActive.value = false;
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
  padding: 0;
  overflow: hidden;
  color: var(--product-text);
  background: var(--product-bg);
}

.order-workbench__header-stages {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  overflow-x: auto;
  scrollbar-width: none;
}
.order-workbench__header-stages::-webkit-scrollbar { display: none; }
.order-workbench__header-stages > button:first-child { margin-left: auto; }

.order-workbench__header-stages > button {
  display: flex;
  flex: none;
  align-items: center;
  gap: 7px;
  padding: 4px 13px 4px 5px;
  border: 1px solid #e7edea;
  border-radius: 999px;
  color: var(--product-text-secondary);
  background: #fff;
  box-shadow: 0 1px 2px rgba(14, 34, 26, .06);
  cursor: pointer;
  transition: border-color .16s ease, color .16s ease, background .16s ease;
}

.order-workbench__header-stages > button:hover { border-color: #d5e2db; color: var(--product-text); }
.order-workbench__header-stages > button.is-active {
  border-color: var(--product-primary);
  color: var(--product-primary-strong);
  background: #f3fbf7;
}
.order-workbench__header-stages > button.is-reminder.is-active {
  border-color: #dfaa42;
  color: #966008;
  background: #fff8e9;
}

.order-workbench__stage-icon {
  display: grid;
  width: 22px;
  height: 22px;
  flex: none;
  place-items: center;
  border-radius: 7px;
}

.order-workbench__stage-icon svg { width: 13px; height: 13px; }
.order-workbench__stage-icon.is-review { color: #d97a16; background: #fff3e3; }
.order-workbench__stage-icon.is-progress { color: #2f6fd0; background: #e8f1fe; }
.order-workbench__stage-icon.is-ready { color: var(--product-primary-strong); background: #e6f6ee; }
.order-workbench__stage-icon.is-reminder { color: #966008; background: #fff3de; }
.order-workbench__header-stages > button:disabled { cursor: wait; opacity: .65; }

.order-workbench__header-stages strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-workbench__header-stages em {
  color: inherit;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}

.order-workbench__content { min-width: 0; min-height: 0; border-radius: 0; box-shadow: none; border-top: 0; border-left: 0; }

.order-workbench__wechat-status-mask {
  position: fixed;
  z-index: 1500;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(19, 42, 32, .18);
  backdrop-filter: blur(1.5px);
}
.order-workbench__wechat-status-mask.is-blocking { cursor: wait; }

.order-workbench__wechat-status {
  position: relative;
  display: flex;
  width: min(430px, calc(100vw - 48px));
  min-height: 132px;
  align-items: center;
  gap: 18px;
  padding: 24px 54px 24px 24px;
  border: 1px solid #b9dacb;
  border-radius: 18px;
  color: #155f40;
  background: rgba(249, 255, 251, .98);
  box-shadow: 0 24px 70px rgba(14, 50, 36, .25), 0 2px 8px rgba(14, 50, 36, .08);
}

.order-workbench__wechat-status.is-warning { border-color: #e3c77a; color: #8b5d08; background: rgba(255, 251, 241, .98); }
.order-workbench__wechat-status.is-error { border-color: #efb8b8; color: #ad2929; background: rgba(255, 247, 247, .98); }
.order-workbench__wechat-status.is-info { border-color: #acd5c1; }

.order-workbench__wechat-status-icon {
  display: grid;
  width: 54px;
  height: 54px;
  flex: none;
  place-items: center;
  border-radius: 16px;
  background: currentColor;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .18);
}

.order-workbench__wechat-status-icon svg { width: 29px; height: 29px; color: #fff; }
.order-workbench__wechat-status-copy { min-width: 0; }
.order-workbench__wechat-status-copy small { display: block; margin-bottom: 3px; opacity: .7; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
.order-workbench__wechat-status-copy strong { display: block; color: #203a2f; font-size: 18px; line-height: 1.35; }
.order-workbench__wechat-status-copy p { margin: 7px 0 0; color: #50645b; font-size: 13px; font-weight: 650; line-height: 1.65; }
.order-workbench__wechat-status.is-warning .order-workbench__wechat-status-copy strong,
.order-workbench__wechat-status.is-warning .order-workbench__wechat-status-copy p { color: #775313; }
.order-workbench__wechat-status.is-error .order-workbench__wechat-status-copy strong,
.order-workbench__wechat-status.is-error .order-workbench__wechat-status-copy p { color: #923535; }

.order-workbench__wechat-status > button {
  position: absolute;
  top: 15px;
  right: 17px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #718078;
  background: rgba(21, 68, 48, .06);
  font-size: 20px;
  line-height: 26px;
  cursor: pointer;
}
.order-workbench__wechat-status > button:hover { color: #244d3b; background: rgba(21, 68, 48, .12); }

.order-workbench__wechat-spinner {
  width: 27px;
  height: 27px;
  border: 3px solid rgba(255, 255, 255, .4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: wechat-status-spin .8s linear infinite;
}

.wechat-status-pop-enter-active,
.wechat-status-pop-leave-active { transition: opacity .18s ease; }
.wechat-status-pop-enter-active .order-workbench__wechat-status,
.wechat-status-pop-leave-active .order-workbench__wechat-status { transition: transform .18s ease, opacity .18s ease; }
.wechat-status-pop-enter-from,
.wechat-status-pop-leave-to { opacity: 0; }
.wechat-status-pop-enter-from .order-workbench__wechat-status,
.wechat-status-pop-leave-to .order-workbench__wechat-status { opacity: 0; transform: translateY(8px) scale(.97); }

@keyframes wechat-status-spin { to { transform: rotate(360deg); } }
</style>
