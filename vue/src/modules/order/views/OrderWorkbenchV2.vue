<template>
  <main class="order-workbench">
    <Teleport v-if="activeView === 'overview'" defer to="#product-header-context">
      <button
        type="button"
        class="order-workbench__pick-print"
        :disabled="pickList.busy"
        @click="openBatchPickList"
      >
        {{ pickList.busy ? '打印中…' : '批量打印拣货单' }}
      </button>
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
      :async-task-progress="asyncImageTaskProgress"
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
      :active-item="modalActiveWechatImport"
      :selected-conversation="selectedWechatConversation"
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
      :conversation-switching="wechatConversationSwitching"
      :conversation-switching-title="wechatConversationSwitchingTitle"
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
      @dismiss-action-message="dismissWechatSelectedAction"
      @refresh-selected-conversation="refreshSelectedWechatConversation"
    >
      <AiOrderPanel
        v-if="activeWechatImport && !selectedWechatConversation"
        ref="activeWechatImportPanelRef"
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
        :batch-save-mode="wechatBatchSaving"
        @select-customer="customerContext.selectCustomer"
        @select-department="customerContext.selectDepartment"
        @retry-customers="customerContext.reload"
        @order-saved="handleOrderChanged"
        @task-added="handleTaskAdded"
        @wechat-import-error="handleWechatImportError"
        @show-today-orders="closeWechatImportModal"
      />
      <template #selected-conversation>
        <section class="order-workbench__wechat-history" aria-live="polite">
          <div
            v-if="selectedWechatTodayInbox.detailLoading.value"
            class="order-workbench__wechat-history-state"
          >
            <i aria-hidden="true"></i>
            <strong>正在读取今天的订单</strong>
            <span>读取完成后，可以直接查看和修改已经保存的商品。</span>
          </div>
          <div
            v-else-if="selectedWechatTodayInbox.detailError.value"
            class="order-workbench__wechat-history-state is-error"
          >
            <strong>今天的订单暂时没有读取成功</strong>
            <span>{{ selectedWechatTodayInbox.detailError.value }}</span>
            <button type="button" @click="refreshSelectedWechatTodayOrders">重新读取</button>
          </div>
          <TodayOrders
            v-else-if="selectedWechatConversation?.customer"
            :today-order-list="selectedWechatTodayInbox.snapshot.value.orders"
            :today-order-dep-arr="selectedWechatTodayInbox.snapshot.value.departments"
            :today-order-trade-no="selectedWechatTodayInbox.snapshot.value.tradeNo"
            :has-sub-departments="selectedWechatTodayInbox.snapshot.value.hasSubDepartments"
            :selected-sub-department="null"
            :today-order-total="selectedWechatTodayInbox.snapshot.value.total"
            :show-list-end="selectedWechatTodayInbox.snapshot.value.totalCount > 0"
            :selected-all-customer="customerId(selectedWechatConversation.customer)"
            :selected-customer-name="customerName(selectedWechatConversation.customer)"
            :selected-customer-entity="selectedWechatConversation.customer"
            :selected-customer-dep-print-name="selectedWechatConversation.customer.nxDepartmentPrintName || 'ApplyPanel'"
            hide-footer
            @order-updated="handleSelectedWechatTodayOrdersChanged"
            @order-deleted="handleSelectedWechatTodayOrdersChanged"
          />
          <div v-else class="order-workbench__wechat-history-state is-empty">
            <strong>还没有找到对应客户</strong>
            <span>可以使用上方按钮重新识别当前微信并完成客户关联。</span>
          </div>
        </section>
      </template>
    </WechatOrderImportModal>

    <Teleport to="body">
      <Transition name="wechat-status-pop">
        <div
          v-if="wechatScanMessage && wechatScanStatus !== 'success' && !wechatImportModalOpen"
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

    <!-- 批量打印拣货单：选择客户 + 打印模式 -->
    <div
      v-if="pickList.showDialog"
      class="pick-list-dialog-mask"
      @click.self="pickList.showDialog = false"
    >
      <div class="pick-list-dialog" role="dialog" aria-modal="true" aria-label="批量打印拣货单">
        <header class="pick-list-dialog__header">
          <h3>批量打印拣货单</h3>
          <button
            type="button"
            class="pick-list-dialog__close"
            aria-label="关闭"
            @click="pickList.showDialog = false"
          >×</button>
        </header>

        <div class="pick-list-dialog__body">
          <div class="pick-list-field">
            <span class="pick-list-field__label">打印模式</span>
            <div class="pick-list-mode">
              <button
                type="button"
                :class="{ 'is-active': pickList.mode === 'goods' }"
                @click="pickList.mode = 'goods'"
              >按商品</button>
              <button
                type="button"
                :class="{ 'is-active': pickList.mode === 'shelf' }"
                @click="pickList.mode = 'shelf'"
              >按货架</button>
            </div>
          </div>

          <div class="pick-list-field">
            <span class="pick-list-field__label">选择客户</span>
            <div class="pick-list-customers__toolbar">
              <label>
                <input
                  type="checkbox"
                  :checked="allPickCustomersSelected"
                  @change="toggleAllPickCustomers($event.target.checked)"
                />
                全选
              </label>
              <span class="pick-list-customers__count">已选 {{ pickList.selectedIds.length }} 个</span>
            </div>
            <ul class="pick-list-customers__list">
              <li v-for="customer in pickList.customers" :key="pickCustomerKey(customer)">
                <label>
                  <input
                    type="checkbox"
                    :value="String(pickCustomerId(customer))"
                    v-model="pickList.selectedIds"
                  />
                  <span>{{ pickCustomerName(customer) }}</span>
                </label>
              </li>
            </ul>
            <p v-if="pickList.customers.length === 0" class="pick-list-empty">暂无可选客户</p>
          </div>
        </div>

        <footer class="pick-list-dialog__footer">
          <button type="button" class="is-secondary" @click="pickList.showDialog = false">取消</button>
          <button
            type="button"
            class="is-primary"
            :disabled="pickList.busy || pickList.selectedIds.length === 0"
            @click="confirmBatchPickList"
          >
            {{ pickList.busy ? '打印中…' : '打印' }}
          </button>
        </footer>
        <p
          v-if="pickList.message"
          class="pick-list-dialog__message"
          :class="{ 'is-error': pickList.error }"
        >{{ pickList.message }}</p>
      </div>
    </div>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useStore } from 'vuex';
import AiOrderPanel from '../components/workbench/AiOrderPanel.vue';
import OrderFlowInbox from '../components/workbench/OrderFlowInbox.vue';
import WechatOrderImportModal from '../components/workbench/WechatOrderImportModal.vue';
import TodayOrders from '@/components/TodayOrders.vue';
import { useOrderCustomerContext } from '../composables/useOrderCustomerContext';
import { useTodayOrderInbox } from '../composables/useTodayOrderInbox';
import orderApi from '../services/orderApi';
import {
  getPickListPrintConfig,
  printBatchPickList,
  savePickListPrintConfig,
} from '@/modules/print/services/pickListPrint';
import { customerVisibleInStage } from '../services/orderWorkbenchStage';
import { blockingCustomerDirectoryError } from '../services/smartReplenishmentComparison';
import {
  buildWechatReconciliationPlan,
  loadCustomerWechatBinding,
  loadWechatConversationAvatar,
  loadWechatConversationSnapshot,
  mergeWechatOrderPayload,
  normalizeWechatAvatarSource,
  prepareWechatOrderImport,
  WECHAT_IMAGE_DOWNLOAD_RETRY_DELAYS_MS,
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
} from '../services/wechatCustomerAssociation';
import {
  customerParticipatesInAutoRead,
  databaseResultCoversConversation,
  readWechatCustomerDatabaseFirst,
  scanAllBoundWechatCustomers,
} from '../services/wechatAllCustomerScan';
import {
  customerId,
  customerName,
  loadSmartReplenishmentCustomerDirectory,
  loadOrderWorkbenchOverview,
  orderWorkbenchError,
} from '../services/orderWorkbenchService';
import { writeAppLog } from '../../../utils/appLog';

const store = useStore();
const disUser = computed(() => store.state.disUser);
const customerContext = useOrderCustomerContext(disUser);
const todayInbox = useTodayOrderInbox(disUser);
const selectedWechatTodayInbox = useTodayOrderInbox(disUser);
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
const pendingAsyncImageTaskIds = new Map();
const asyncImageTaskProgress = ref({ total: 0, completed: 0, failed: 0, delayed: 0, remaining: 0, syncError: '', visible: false });
let asyncImageTaskPollTimer = null;
let asyncImageTaskProgressTimer = null;
let asyncImageTaskPolling = false;
let asyncImagePollCount = 0;
// MCP「保存微信订单」批量流程状态：置位后 AiOrderPanel 进入批量模式（解析完即静默保存）。
const wechatBatchSaving = ref(false);
const wechatBatchSaveProgress = ref({ done: 0, total: 0 });
const wechatImportCompletedTokens = ref([]);
const activeWechatImportToken = ref(null);
const activeWechatImportPanelRef = ref(null);
const observedWechatConversationTitle = ref('');
const observedWechatConversationAvatar = ref('');
const selectedWechatConversation = ref(null);
const wechatImportModalOpen = ref(false);
const wechatImportRefreshing = ref(false);
const wechatWorkspaceWarning = ref('');
const wechatWorkspaceReady = ref(false);
const wechatSelectedImportBusy = ref(false);
const wechatConversationSwitching = ref(false);
const wechatConversationSwitchingTitle = ref('');
const wechatSelectedImportMessage = ref('');
const wechatSelectedImportStatus = ref('warning');
const wechatUnmatchedConversationTitle = ref('');
const wechatCustomerMatchOpen = ref(false);
const wechatCustomerMatchBusy = ref(false);
const wechatCustomerMatchError = ref('');
let wechatImportSequence = 0;
let wechatConversationFocusDepth = 0;
let wechatReaderWarmupStarted = false;
let wechatOrderTimingSequence = 0;
let selectedWechatConversationRequestId = 0;
let wechatConversationObservationRequestId = 0;
let wechatConversationObservationRunning = false;
let lastWechatConversationObservationAt = 0;
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
  'current-conversation-focus': '切换并核验当前微信会话',
  'current-conversation-reuse': '复用已选中的微信会话',
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
const modalActiveWechatImport = computed(() => (
  selectedWechatConversation.value ? null : activeWechatImport.value
));
const showCurrentWechatReadButton = computed(() => {
  if (selectedWechatConversation.value) return false;
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

/* ==================== 批量打印拣货单（A4） ==================== */
const pickList = reactive({
  showDialog: false,
  busy: false,
  mode: 'goods',
  customers: [],
  selectedIds: [],
  message: '',
  error: false,
});

function pickCustomerId(customer) {
  return customer?.nxDepartmentId ?? customer?.departmentId ?? null;
}

function pickCustomerName(customer) {
  return customer?.nxDepartmentAttrName
    || customer?.nxDepartmentName
    || customer?.depName
    || '未命名客户';
}

function pickCustomerKey(customer) {
  return String(pickCustomerId(customer) ?? pickCustomerName(customer));
}

const allPickCustomersSelected = computed(() => (
  pickList.customers.length > 0
  && pickList.selectedIds.length === pickList.customers.length
));

function toggleAllPickCustomers(checked) {
  pickList.selectedIds = checked
    ? pickList.customers.map((c) => String(pickCustomerId(c))).filter((id) => id && id !== 'null')
    : [];
}

async function openBatchPickList() {
  pickList.message = '';
  pickList.error = false;
  const config = await getPickListPrintConfig();
  pickList.mode = config.pickListMode || 'goods';
  pickList.customers = overview.customers || customerContext.customers.value || [];
  pickList.selectedIds = [];
  pickList.showDialog = true;
}

async function confirmBatchPickList() {
  if (pickList.busy) return;
  const disId = disUser.value?.nxDiuDistributerId;
  const userId = disUser.value?.nxDistributerUserId;
  if (!disId) {
    pickList.error = true;
    pickList.message = '未获取到配送商身份，请重新登录';
    return;
  }
  const customers = pickList.customers
    .filter((c) => pickList.selectedIds.includes(String(pickCustomerId(c))))
    .map((c) => ({ nxDepId: pickCustomerId(c), gbDepId: 0, name: pickCustomerName(c) }));
  if (customers.length === 0) {
    pickList.error = true;
    pickList.message = '请至少选择一个客户';
    return;
  }
  pickList.busy = true;
  pickList.message = '正在生成拣货单…';
  pickList.error = false;
  try {
    // 记住本次模式，单客户打印入口复用同一个偏好
    await savePickListPrintConfig({ pickListMode: pickList.mode });
    const result = await printBatchPickList({
      customers,
      nxDisId: disId,
      mode: pickList.mode,
      pickerUserId: userId,
    });
    pickList.showDialog = false;
    const finish = result?.finish;
    window.alert(
      `拣货单已发送到：${result?.printerName || 'A4 打印机'}\n`
      + `打印模式：${pickList.mode === 'shelf' ? '按货架' : '按商品'}\n`
      + (finish?.total ? `固定规格自动出库 ${finish.total - (finish.failed || 0)}/${finish.total} 项` : '无可自动出库的固定规格商品')
    );
    await refreshOverview({ selectFirst: false });
  } catch (error) {
    pickList.error = true;
    pickList.message = error?.message || '打印失败';
  } finally {
    pickList.busy = false;
  }
}

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

function watchAsyncImageTask(taskId) {
  const id = Number(taskId);
  if (Number.isSafeInteger(id) && id > 0 && !pendingAsyncImageTaskIds.has(id)) {
    if (asyncImageTaskProgressTimer !== null) window.clearTimeout(asyncImageTaskProgressTimer);
    asyncImageTaskProgressTimer = null;
    const previous = asyncImageTaskProgress.value;
    if (!previous.remaining) asyncImagePollCount = 0;
    asyncImageTaskProgress.value = previous.remaining
      ? { ...previous, total: previous.total + 1, remaining: previous.remaining + 1, visible: true }
      : { total: 1, completed: 0, failed: 0, delayed: 0, remaining: 1, syncError: '', visible: true };
    pendingAsyncImageTaskIds.set(id, Date.now() + 10 * 60 * 1000);
  }
}

function stopAsyncImageTaskPoller() {
  if (asyncImageTaskPollTimer !== null) window.clearInterval(asyncImageTaskPollTimer);
  asyncImageTaskPollTimer = null;
}

async function pollAsyncImageTasks() {
  if (asyncImageTaskPolling || !pendingAsyncImageTaskIds.size) return;
  asyncImageTaskPolling = true;
  let completed = false;
  let finished = 0;
  let failed = 0;
  let delayed = 0;
  let pollError = '';
  try {
    for (const [taskId, expiresAt] of pendingAsyncImageTaskIds) {
      try {
        const response = await orderApi.getOcrTaskStatus(taskId);
        if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '任务状态响应异常');
        const rawStatus = response?.data?.task?.nxOcrTaskStatus;
        const status = Number(rawStatus);
        if (rawStatus == null || !Number.isFinite(status)) throw new Error('任务状态缺失');
        if (status !== 0) {
          pendingAsyncImageTaskIds.delete(taskId);
          if (status === 1 || status === 2) finished += 1;
          else failed += 1;
          completed = true;
        }
      } catch (error) {
        pollError ||= error?.message || '任务状态读取失败';
        if (!asyncImageTaskProgress.value.syncError) {
          writeAppLog('warn', 'order', 'async-image-status:poll-failed', { taskId, message: pollError });
        }
      }
      if (pendingAsyncImageTaskIds.has(taskId) && Date.now() >= expiresAt) delayed += 1;
    }
    const previous = asyncImageTaskProgress.value;
    if (finished || failed || delayed !== previous.delayed || pollError !== previous.syncError) {
      if (previous.syncError && !pollError) {
        writeAppLog('info', 'order', 'async-image-status:poll-recovered', {});
      }
      asyncImageTaskProgress.value = {
        ...previous,
        completed: previous.completed + finished,
        failed: previous.failed + failed,
        delayed,
        remaining: pendingAsyncImageTaskIds.size,
        syncError: pollError,
      };
    }
    // 状态查询暂时不可用时，订单列表也要定期重新读取，让已落库订单及时出现。
    if (completed || ++asyncImagePollCount % 2 === 0) await refreshAll();
    if (!pendingAsyncImageTaskIds.size) {
      stopAsyncImageTaskPoller();
      if (!asyncImageTaskProgress.value.failed) {
        asyncImageTaskProgressTimer = window.setTimeout(() => {
          asyncImageTaskProgress.value = { ...asyncImageTaskProgress.value, visible: false };
          asyncImageTaskProgressTimer = null;
        }, 8000);
      }
    }
  } finally {
    asyncImageTaskPolling = false;
  }
}

function startAsyncImageTaskPoller() {
  if (!pendingAsyncImageTaskIds.size || asyncImageTaskPollTimer !== null) return;
  void pollAsyncImageTasks();
  asyncImageTaskPollTimer = window.setInterval(() => { void pollAsyncImageTasks(); }, 15000);
}

async function handleOrderChanged(change) {
  // 无人值守批量保存由 batchSaveAllWechatOrders 负责移除任务和收尾。
  // 图片识别组件在落库成功时仍可能发出兼容事件；批量期间如果刷新订单总览，
  // 打包版会绕过主进程持有的会话 Cookie，产生一次无关的 401 并误退出登录。
  if (wechatBatchSaving.value) return;
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

  // Closing the report only selects the first collected customer and displays
  // its existing task data. It must not imply that WeChat has switched to that
  // customer: a later explicit read/switch still performs live title
  // verification before messages can be attributed to the selected customer.
  await nextTick();
  await openActiveWechatImport({
    preserveScanMessage: true,
    openWorkspace: false,
    focusConversation: false,
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
  const timing = createWechatOrderTiming('refresh-selected-wechat');
  let outcome = 'failed';
  let resultStatus = 'unknown';
  let lateMessageCount = 0;
  wechatImportRefreshing.value = true;
  try {
    const expectedTitle = normalizeObservedWechatConversationTitle(item.conversationTitle);
    const observedTitle = normalizeObservedWechatConversationTitle(
      observedWechatConversationTitle.value
    );
    const needsFocusBeforeRead = Boolean(
      options.manual && expectedTitle && observedTitle !== expectedTitle
    );
    if (options.manual) wechatWorkspaceWarning.value = '';
    if (needsFocusBeforeRead) {
      const focusWarning = await timeWechatOrderPhase(
        timing,
        'current-conversation-focus',
        () => focusWechatImportConversation(item),
        { reason: 'selection-mismatch', expectedTitle, observedTitle }
      );
      wechatWorkspaceWarning.value = focusWarning;
      if (!focusWarning) observedWechatConversationTitle.value = expectedTitle;
    } else {
      timing.phase('current-conversation-reuse', {
        expectedTitle,
        observedTitle,
        matched: Boolean(expectedTitle && expectedTitle === observedTitle),
      });
    }
    const result = await prepareWechatOrderImport({
      customerId: item.customerId,
      binding: item.binding,
      // 用户手动触发时做一次短暂、有限的稳定性复查；页面不再后台轮询。
      retryDelaysMs: selectedWechatRetryDelaysMs,
      knownMessageFingerprints: messageFingerprints(item.payload),
      deferPrepareUntilStable: true,
      onTiming: event => recordWechatServiceTiming(timing, event),
    });
    resultStatus = result.status;
    timing.phase('import-result', {
      status: result.status,
      pendingCount: Number(result.pendingCount) || 0,
      skippedCount: Number(result.skippedCount) || 0,
    });
    if (!result.payload) {
      if (options.manual) {
        const isCurrent = ['current', 'duplicate'].includes(result.status);
        const isBlocking = ['conflict', 'unbound'].includes(result.status);
        replaceWechatImportItem(item.token, {
          ...item,
          refreshNote: isBlocking
            ? ''
            : isCurrent
              ? '当前会话已经是最新内容'
              : '当前会话没有新增订单消息',
          refreshError: isBlocking ? result.message : '',
        });
      }
      outcome = ['conflict', 'unbound'].includes(result.status) ? 'failed' : 'success';
      return false;
    }
    if (options.manual && !needsFocusBeforeRead) {
      // The already-open conversation needs no UI work for a no-change check.
      // When new data is actually found, click it once after the stable DB read
      // so WeChat clears its unread badge without paying for two focus passes.
      const markReadWarning = await timeWechatOrderPhase(
        timing,
        'current-conversation-focus',
        () => focusWechatImportConversation(item),
        { reason: 'mark-new-messages-read', expectedTitle }
      );
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
      outcome = 'success';
      return otherItems.length > 0;
    }
    const existing = messageFingerprints(item.payload);
    const incoming = messageFingerprints(matchingItem.payload);
    lateMessageCount = Array.from(incoming).filter(id => !existing.has(id)).length;
    if (!lateMessageCount) {
      if (options.manual) {
        replaceWechatImportItem(item.token, {
          ...item,
          refreshNote: '当前会话已经是最新内容',
          refreshError: '',
        });
      }
      outcome = 'success';
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
    outcome = 'success';
    return true;
  } catch (error) {
    resultStatus = 'error';
    replaceWechatImportItem(item.token, {
      ...item,
      refreshError: error?.message || '同步当前微信会话失败',
      refreshNote: '',
    });
    return false;
  } finally {
    wechatImportRefreshing.value = false;
    timing.finish(outcome, { status: resultStatus, lateMessageCount });
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

async function focusWechatImportConversation(item, options = {}) {
  const conversationTitle = String(item?.conversationTitle || '').trim();
  const focusApi = window.electronAPI?.wechatUi?.focusConversation;
  if (!conversationTitle || !focusApi) return '';
  wechatConversationFocusDepth += 1;
  wechatConversationSwitching.value = true;
  wechatConversationSwitchingTitle.value = conversationTitle;
  try {
    const result = await focusApi(conversationTitle, {
      forceReselect: options.forceReselect === true,
    });
    if (result?.error?.code === 'UNSUPPORTED_PLATFORM') return '';
    return result?.ok
      ? ''
      : result?.error?.message || '左侧微信未能自动切换到对应会话';
  } catch (error) {
    return error?.message || '左侧微信未能自动切换到对应会话';
  } finally {
    wechatConversationFocusDepth = Math.max(0, wechatConversationFocusDepth - 1);
    if (wechatConversationFocusDepth === 0) {
      wechatConversationSwitching.value = false;
      wechatConversationSwitchingTitle.value = '';
    }
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

async function focusWechatWorkspaceApp() {
  try {
    await window.electronAPI?.wechatUi?.focusWorkspace?.();
  } catch {
    // The report is already complete. Focus recovery is presentation-only and
    // must never change or discard the collected order results.
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
  clearSelectedWechatConversation();
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
      observedWechatConversationAvatar.value = '';
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

  // Close the deleted task's image preview before advancing the queue. This
  // also cancels a preview that is still waiting for Vue's next tick.
  if (wasActive) activeWechatImportPanelRef.value?.dismissPendingWechatImport?.();

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
    const nextItem = wechatImportQueue.value.find(
      candidate => candidate?.token === update.nextToken
    );
    if (nextItem) {
      replaceWechatImportItem(nextItem.token, {
        ...nextItem,
        refreshNote: `已移除“${item?.taskLabel || '订单任务'}”，下面显示的是下一项订单任务`,
        refreshError: '',
      });
    }
    await openActiveWechatImport({ openWorkspace: false, focusConversation: true });
  }
}

function normalizeObservedWechatConversationTitle(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s*\(\s*\d+\s*\)\s*$/u, '')
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

function clearSelectedWechatConversation() {
  selectedWechatConversationRequestId += 1;
  selectedWechatConversation.value = null;
  void selectedWechatTodayInbox.selectCustomer(null);
}

function selectedWechatHistoryMessage(result) {
  const savedCount = Number(selectedWechatTodayInbox.snapshot.value.totalCount) || 0;
  if (['conflict', 'unbound'].includes(result?.status)) {
    return [
      savedCount > 0 ? `已显示今天保存的 ${savedCount} 项商品。` : '',
      result.message || '新消息状态需要重新检查。',
    ].filter(Boolean).join(' ');
  }
  if (savedCount > 0) {
    return `今天的订单已经全部转存，下面显示已保存的 ${savedCount} 项商品，可直接修改。`;
  }
  return result?.message || '当前没有未处理的新订单，今天也没有已保存的订单。';
}

async function showSelectedWechatConversation(title, avatarDataUrl = '', options = {}) {
  const normalizedTitle = normalizeObservedWechatConversationTitle(title);
  if (!normalizedTitle) return;
  if (!options.force
      && normalizeObservedWechatConversationTitle(selectedWechatConversation.value?.title)
        === normalizedTitle) {
    if (avatarDataUrl) {
      selectedWechatConversation.value = {
        ...selectedWechatConversation.value,
        conversationAvatar: avatarDataUrl,
      };
    }
    return;
  }

  const requestId = ++selectedWechatConversationRequestId;
  void selectedWechatTodayInbox.selectCustomer(null);
  selectedWechatConversation.value = {
    title: normalizedTitle,
    conversationAvatar: avatarDataUrl || wechatConversationAvatars.get(normalizedTitle) || '',
    customer: null,
    orderCount: 0,
    status: 'checking',
    message: '正在查找客户，并读取今天已经保存的订单…',
  };

  try {
    if (!customerContext.customers.value.length) await customerContext.reload();
    if (requestId !== selectedWechatConversationRequestId) return;
    let matches = findWechatCustomerProfileMatches(
      customerContext.customers.value,
      normalizedTitle
    );
    if (!matches.length) {
      await customerContext.reload();
      if (requestId !== selectedWechatConversationRequestId) return;
      matches = findWechatCustomerProfileMatches(
        customerContext.customers.value,
        normalizedTitle
      );
    }
    if (matches.length !== 1) {
      selectedWechatConversation.value = {
        ...selectedWechatConversation.value,
        status: 'warning',
        message: matches.length > 1
          ? '多个客户使用了这个微信名称，请先保留唯一的客户关联。'
          : '这个微信还没有关联客户，可以重新识别并完成关联。',
      };
      return;
    }

    const customer = matches[0];
    customerContext.selectCustomer(customer);
    selectedWechatConversation.value = {
      ...selectedWechatConversation.value,
      customer,
      status: 'checking',
      message: '正在检查新消息，同时读取今天已经保存的订单…',
    };
    const historyPromise = selectedWechatTodayInbox.selectCustomer(customer);
    let prepared;
    try {
      prepared = await prepareWechatConversationForCustomer(
        customer,
        normalizedTitle,
        null,
        avatarDataUrl,
        { repairBinding: options.repairBinding === true }
      );
    } catch (error) {
      await historyPromise;
      if (requestId !== selectedWechatConversationRequestId) return;
      selectedWechatConversation.value = {
        ...selectedWechatConversation.value,
        status: 'warning',
        orderCount: Number(selectedWechatTodayInbox.snapshot.value.totalCount) || 0,
        message: selectedWechatTodayInbox.detailError.value
          ? `新消息检查失败：${error?.message || '请稍后重试'}；今天订单也未读取成功。`
          : `已显示今天保存的订单；新消息检查失败：${error?.message || '请稍后重试'}`,
      };
      return;
    }
    await historyPromise;

    const { row, result } = prepared;
    if (result.payload) {
      const imports = createWechatImportItems(row, normalizedTitle, result);
      if (requestId !== selectedWechatConversationRequestId) {
        enqueueWechatImportItems(imports, { activate: false });
        return;
      }
      enqueueWechatImportItems(imports);
      await openActiveWechatImport({ openWorkspace: false, focusConversation: false });
      return;
    }
    if (requestId !== selectedWechatConversationRequestId) return;
    const historyError = selectedWechatTodayInbox.detailError.value;
    selectedWechatConversation.value = {
      ...selectedWechatConversation.value,
      status: historyError || ['conflict', 'unbound'].includes(result.status) ? 'warning' : 'ready',
      orderCount: Number(selectedWechatTodayInbox.snapshot.value.totalCount) || 0,
      message: historyError
        ? `${result.message || '新消息检查完成'}；今天订单读取失败，请点击下方“重新读取”。`
        : selectedWechatHistoryMessage(result),
    };
  } catch (error) {
    if (requestId !== selectedWechatConversationRequestId) return;
    selectedWechatConversation.value = {
      ...selectedWechatConversation.value,
      status: 'warning',
      message: error?.message || '当前微信的订单情况读取失败，请稍后重试。',
    };
  }
}

async function refreshSelectedWechatConversation() {
  const current = selectedWechatConversation.value;
  if (!current?.title) return;
  await showSelectedWechatConversation(
    current.title,
    current.conversationAvatar,
    { force: true, repairBinding: true }
  );
}

async function refreshSelectedWechatTodayOrders() {
  await selectedWechatTodayInbox.refreshSelected({ preserveView: true });
  if (selectedWechatConversation.value) {
    const orderCount = Number(selectedWechatTodayInbox.snapshot.value.totalCount) || 0;
    selectedWechatConversation.value = {
      ...selectedWechatConversation.value,
      orderCount,
      status: selectedWechatTodayInbox.detailError.value ? 'warning' : 'ready',
      message: selectedWechatTodayInbox.detailError.value
        ? '今天订单仍未读取成功，请检查网络后重试。'
        : orderCount > 0
          ? `今天的订单已经全部转存，下面显示已保存的 ${orderCount} 项商品，可直接修改。`
          : '当前没有未处理的新订单，今天也没有已保存的订单。',
    };
  }
}

async function handleSelectedWechatTodayOrdersChanged() {
  await Promise.all([
    selectedWechatTodayInbox.refreshSelected({ preserveView: true }),
    handleOrderChanged({ preserveSelection: true }),
  ]);
  if (selectedWechatConversation.value) {
    const orderCount = Number(selectedWechatTodayInbox.snapshot.value.totalCount) || 0;
    selectedWechatConversation.value = {
      ...selectedWechatConversation.value,
      orderCount,
      message: orderCount > 0
        ? `今天已保存 ${orderCount} 项商品，刚才的修改已经同步。`
        : '这个客户今天已经没有已保存的订单。',
    };
  }
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

  // The launcher is a deliberate choice screen. Opening the side-by-side
  // workspace makes WeChat publish its already-selected conversation a few
  // moments later; that passive observation must only update button 2's name
  // and avatar. Reading that conversation starts only after the user chooses
  // an action. Once a task/history view is open, real WeChat selections still
  // keep the right-hand page in sync as before.
  if (!activeWechatImport.value && !selectedWechatConversation.value) return;

  const matchingItem = wechatImportQueue.value.find(item => (
    normalizeObservedWechatConversationTitle(item?.conversationTitle) === title
  ));
  if (matchingItem) {
    const currentTitle = normalizeObservedWechatConversationTitle(
      activeWechatImport.value?.conversationTitle
    );
    if (currentTitle === title && !selectedWechatConversation.value) return;
    activeWechatImportToken.value = matchingItem.token;
    // This event already came from a real WeChat selection. Only update the
    // right-side draft; focusing WeChat again would create a feedback loop.
    await openActiveWechatImport({ openWorkspace: false, focusConversation: false });
    return;
  }

  await showSelectedWechatConversation(title, avatarDataUrl);
}

async function refreshObservedWechatConversation({ force = false } = {}) {
  if (!wechatImportModalOpen.value
      || wechatScanBusy.value
      || wechatSelectedImportBusy.value
      || wechatCustomerMatchBusy.value
      || wechatConversationFocusDepth > 0) return false;
  const currentConversationApi = window.electronAPI?.wechatUi?.currentConversation;
  if (!currentConversationApi || wechatConversationObservationRunning) return false;
  const now = Date.now();
  if (!force && now - lastWechatConversationObservationAt < 800) return false;

  const requestId = ++wechatConversationObservationRequestId;
  const titleBeforeRequest = normalizeObservedWechatConversationTitle(
    observedWechatConversationTitle.value
  );
  wechatConversationObservationRunning = true;
  lastWechatConversationObservationAt = now;
  try {
    const selected = await currentConversationApi({ requireForeground: !force });
    if (requestId !== wechatConversationObservationRequestId
        || !wechatImportModalOpen.value
        || !selected?.ok
        || !selected.result?.title) return false;
    const selectedTitle = normalizeObservedWechatConversationTitle(selected.result.title);
    await syncWechatSelectionFromDesktop(selected.result);
    // A passive Windows read may start before Weixin finishes painting the
    // newly clicked row. Keep polling while the title is unchanged, and only
    // return input focus after a genuinely different conversation has been
    // adopted by the right-hand workbench.
    if (selectedTitle && selectedTitle !== titleBeforeRequest) {
      await focusWechatWorkspaceApp();
    }
    return true;
  } catch {
    // This is a presentation-only observation. Button 2 still performs a
    // fresh authoritative lookup when the user explicitly starts the import.
    return false;
  } finally {
    if (requestId === wechatConversationObservationRequestId) {
      wechatConversationObservationRunning = false;
    }
  }
}

const wechatConversationObservationPoller = /^Win/i.test(String(navigator.platform || ''))
  ? window.setInterval(() => {
    if (document.hasFocus()
        || !wechatWorkspaceReady.value
        || !wechatImportModalOpen.value) return;
    // Windows has no passive Accessibility notification for a manual WeChat
    // selection. Observe only while WeChat is still frontmost. The renderer
    // returns focus after a changed title has been confirmed and applied.
    void refreshObservedWechatConversation();
  }, 650)
  : null;

async function handleWechatConversationChanged(payload) {
  const shouldRefocusWorkspace = payload?.selectionChanged === true
    && wechatImportModalOpen.value
    && !wechatScanBusy.value
    && !wechatSelectedImportBusy.value
    && !wechatCustomerMatchBusy.value
    && wechatConversationFocusDepth === 0;

  try {
    await syncWechatSelectionFromDesktop(payload);
  } finally {
    // A manual conversation change activates WeChat. Return keyboard/mouse
    // focus only after the right-hand page has adopted that conversation, so
    // the user's very next click operates the order workbench immediately.
    if (shouldRefocusWorkspace) await focusWechatWorkspaceApp();
  }
}

const removeWechatConversationListener = window.electronAPI?.wechatUi
  ?.onConversationChanged?.((payload) => {
    void handleWechatConversationChanged(payload);
  });

function discardWechatImportSession() {
  // The native window close button means “结束本轮处理”. Close any image
  // preview first, then remove every task collected for this confirmation
  // session. The in-page “稍后处理” action intentionally does not call this
  // function, so its queue remains available from “继续微信订单”.
  activeWechatImportPanelRef.value?.dismissPendingWechatImport?.();
  wechatImportQueue.value = [];
  wechatImportBatch.value = [];
  wechatImportCompletedTokens.value = [];
  activeWechatImportToken.value = null;
  wechatScanResults.value = [];
  wechatScanProgress.value = { current: 0, total: 0, title: '', customerName: '' };
  wechatScanMessage.value = '';
  wechatScanStatus.value = 'info';
  wechatWorkspaceWarning.value = '';
}

function resetWechatImportModalState() {
  wechatConversationObservationRequestId += 1;
  wechatConversationObservationRunning = false;
  wechatImportModalOpen.value = false;
  wechatScanReportOpen.value = false;
  wechatWorkspaceReady.value = false;
  wechatConversationSwitching.value = false;
  wechatConversationSwitchingTitle.value = '';
  observedWechatConversationTitle.value = '';
  observedWechatConversationAvatar.value = '';
  clearSelectedWechatConversation();
  wechatScanMessage.value = '';
  dismissWechatSelectedAction();
  activeView.value = 'overview';
}

const removeWechatWorkspaceCloseRequestedListener = window.electronAPI?.wechatUi
  ?.onWorkspaceCloseRequested?.(() => {
    // The main process has intercepted the native red close button and is
    // already restoring the BrowserWindow. Native close discards this round's
    // fetched task cache; “稍后处理” uses closeWechatImportModal instead and
    // deliberately preserves it. Calling closeWorkspace here would race the
    // same recovery a second time.
    discardWechatImportSession();
    resetWechatImportModalState();
    void refreshAll();
    startAsyncImageTaskPoller();
  });

async function closeWechatImportModal() {
  const shouldCloseWechatWorkspace = wechatWorkspaceReady.value;
  resetWechatImportModalState();
  if (shouldCloseWechatWorkspace) {
    try {
      await window.electronAPI?.wechatUi?.closeWorkspace?.();
    } catch {
      // 窗口恢复失败不影响订单数据；主进程退出时仍会再做一次兜底恢复。
    }
  }
  await refreshAll();
  startAsyncImageTaskPoller();
}

onBeforeUnmount(() => {
  stopAsyncImageTaskPoller();
  if (asyncImageTaskProgressTimer !== null) window.clearTimeout(asyncImageTaskProgressTimer);
  if (wechatConversationObservationPoller !== null) {
    window.clearInterval(wechatConversationObservationPoller);
  }
  removeWechatConversationListener?.();
  removeWechatWorkspaceCloseRequestedListener?.();
  window.removeEventListener('grain-mcp-wechat-scan', onMcpWechatScan);
  window.removeEventListener('grain-mcp-wechat-save-orders', onMcpWechatSaveOrders);
  window.removeEventListener('grain-wechat-auto-read', onScheduledWechatAutoRead);
  void window.electronAPI?.wechatUi?.closeWorkspace?.();
});

// 由 MCP「打开微信订单」指令触发：进入本视图后运行全面检查。
// 两种场景都覆盖：① 冷启动导航——App.vue 先置位 window.__grainPendingWechatScan，
//    本视图挂载后再消费；② 已在视图内——App.vue 直接派发 grain-mcp-wechat-scan 事件。
function onMcpWechatScan() {
  if (window.__grainPendingWechatScan) {
    window.__grainPendingWechatScan = false;
    void scanAllBoundWechatOrders();
  }
}

// 由 MCP「保存微信订单」指令触发：进入本视图后逐个保存「解析完整」的订单。
// 与巡查同样覆盖两种场景：冷启动导航（App.vue 置位任务号）与已在视图内（直接派发事件）。
function onMcpWechatSaveOrders() {
  if (!window.__grainMcpWechatSaveTaskId) return;
  void batchSaveAllWechatOrders();
}

async function onScheduledWechatAutoRead() {
  const trigger = window.__grainPendingWechatAutoRead;
  if (!trigger?.runId) return;
  window.__grainPendingWechatAutoRead = null;
  try {
    await scanAllBoundWechatOrders({
      automatic: true,
      excludedCustomerKeys: trigger.excludedCustomerKeys,
    });
  } finally {
    await window.electronAPI?.wechatAutoRead?.finish?.(trigger.runId);
  }
}

onMounted(() => {
  window.addEventListener('grain-mcp-wechat-scan', onMcpWechatScan);
  window.addEventListener('grain-mcp-wechat-save-orders', onMcpWechatSaveOrders);
  window.addEventListener('grain-wechat-auto-read', onScheduledWechatAutoRead);
  // 进入视图前若已置位待执行标记（冷启动导航场景），立即消费并运行全面检查。
  onMcpWechatScan();
  onMcpWechatSaveOrders();
  void onScheduledWechatAutoRead();
});

async function loadBoundWechatCustomers({ refreshCustomers = false, customerFilter = null } = {}) {
  if (refreshCustomers || !customerContext.customers.value.length) await customerContext.reload();
  const customersById = new Map();
  customerContext.customers.value.forEach((customer) => {
    const id = customerId(customer);
    if (
      id !== null
      && id !== undefined
      && (typeof customerFilter !== 'function' || customerFilter(customer))
    ) customersById.set(String(id), customer);
  });

  const rows = await Promise.all(Array.from(customersById.values()).map(async (customer) => {
    try {
      const binding = await loadCustomerWechatBinding(customerId(customer));
      return { customer, binding };
    } catch (error) {
      if (error?.code === 'SERVER_AUTH_FAILED') throw error;
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
  return {
    unique, failedCount, ambiguousCount, associationDirectory,
    directoryCustomerCount: customerContext.customers.value.length,
    participatingCustomerCount: customersById.size,
  };
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

// 好友/群类型与群规则只允许在客户资料中设置。读单（包括定时任务）不得
// 再弹出选择框，否则无人值守自动读取会停在交互界面。
async function ensureWechatBindingFromCustomerProfile(options) {
  return ensureWechatCustomerBinding(options);
}

async function prepareWechatConversationForCustomer(
  customer,
  title,
  timing = null,
  preferredAvatar = '',
  { repairBinding = true } = {}
) {
  const selectedCustomerId = customerId(customer);
  const onTiming = event => recordWechatServiceTiming(timing, event);
  const binding = await timeWechatOrderPhase(
    timing,
    'binding-load',
    () => loadCustomerWechatBinding(selectedCustomerId)
  );
  const row = { customer, binding };
  if (repairBinding) {
    const directory = timeWechatOrderSyncPhase(
      timing,
      'binding-directory-build',
      () => buildWechatCustomerAssociationDirectory([row])
    );
    row.binding = await ensureWechatBindingFromCustomerProfile({
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
  } else if (!binding.bound
      || normalizeObservedWechatConversationTitle(binding.displayName)
        !== normalizeObservedWechatConversationTitle(title)) {
    return {
      row,
      result: {
        status: 'unbound',
        message: '客户的微信绑定与当前会话不一致，请点击“再次检查新订单”完成校准。',
        binding,
        pendingCount: 0,
      },
    };
  }
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
  if (result.payload) {
    result.conversationAvatar = await resolveWechatConversationAvatar(
      title,
      result.binding || row.binding,
      preferredAvatar
    );
  }
  return { row, result };
}

async function importWechatConversationForCustomer(
  customer,
  title,
  timing = null,
  preferredAvatar = ''
) {
  const prepared = await prepareWechatConversationForCustomer(
    customer,
    title,
    timing,
    preferredAvatar
  );
  const { row } = prepared;
  let { result } = prepared;
  if (!result.payload) {
    // “读取当前微信”强调的是用户眼前这个会话。未读图片可能已经画在
    // 微信窗口里，但本地消息库尚未把它提交到 Reader 的第一份快照。
    // 主动点开当前会话后再读一次，避免仅凭旧快照误报“已经生成过订单”。
    timing?.phase('selected-conversation-fallback', {
      status: result.status || '',
      latestObservedMessageTimeMs: result.latestObservedMessageTimeMs,
    });
    const focusWarning = await timeWechatOrderPhase(
      timing,
      'selected-conversation-focus',
      () => focusWechatImportConversation(
        { conversationTitle: title },
        { forceReselect: true }
      )
    );
    if (focusWarning) throw new Error(focusWarning);
    result = await prepareWechatOrderImport({
      customerId: customerId(customer),
      binding: row.binding,
      retryDelaysMs: selectedWechatRetryDelaysMs,
      onTiming: event => recordWechatServiceTiming(timing, event),
    });
    timing?.phase('import-result', {
      status: result.status,
      pendingCount: Number(result.pendingCount) || 0,
      readMode: 'focused-verification',
    });
    if (result.payload) {
      result.conversationAvatar = await resolveWechatConversationAvatar(
        title,
        result.binding || row.binding,
        preferredAvatar
      );
    }
  }
  if (!result.payload) {
    throw new Error(result.message || '已关联该微信好友，但当前没有未处理的新订单');
  }
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
      // The order import needs an authoritative live title, but not a fresh
      // desktop screenshot of the avatar. The avatar is presentation-only and
      // already has observer/cache/Reader fallbacks; awaiting desktopCapturer
      // here added several seconds to every explicit order read on macOS.
      () => currentConversationApi({ includeAvatar: false })
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
  if (await openWechatWorkspace()) {
    // Show the choice page first; name/avatar discovery is deliberately
    // background-only and must never delay or auto-trigger button 2.
    void refreshObservedWechatConversation({ force: true });
  }
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
        row.binding = await ensureWechatBindingFromCustomerProfile({
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
          const deferred = result.status === 'deferred';
          if (deferred) prepareFailedCount += 1;
          completeWechatScanStep({
            title,
            customerName,
            status: deferred ? 'warning' : 'empty',
            message: deferred ? result.message : '没有未处理的新订单',
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
        if (result.warning) prepareFailedCount += 1;
        completeWechatScanStep({
          title,
          customerName,
          status: 'found',
          itemCount: items.length,
          message: `发现 ${items.length} 个订单任务${result.warning ? `；${result.warning}` : ''}`,
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

// Markdown 表格里不能让竖线/换行破坏结构。
function scanReportCell(value) {
  return String(value == null ? '' : value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

// 与「微信订单工作台」巡查卡片同构的状态文案。
function scanReportResultMark(item) {
  const status = item && item.status;
  const label = status === 'found'
    ? '🟢 发现订单'
    : status === 'empty'
      ? '⚪ 没有新订单'
      : status === 'not-found'
        ? '🟠 未找到会话'
        : status === 'error'
          ? '🔴 检查失败'
          : status === 'warning'
            ? '🟡 等待原图'
            : '⚪ 未完成';
  const detail = scanReportCell(item && item.message);
  return detail ? `${label} · ${detail}` : label;
}

// 把巡查结果整理成一份与 GrainPrint 界面逐项一致的 Markdown 报告（汇总统计 + 逐条会话明细），
// 供 WorkBuddy 侧原样呈现。信息口径与卡片一致：
//   已巡查 N 个会话 / M 位客户 / K 个订单任务 / P 条新消息，以及每一家会话的结果。
function buildWechatScanReportMarkdown(summary) {
  const checkedCount = Number(summary && summary.checkedCount) || 0;
  const orderingCount = Number(summary && summary.orderCustomerCount) || 0;
  const taskCount = Number(summary && summary.taskCount) || 0;
  const messageCount = Number(summary && summary.messageCount) || 0;
  const warningCount = Number(summary && summary.warningCount) || 0;
  const rows = wechatScanResults.value.filter(item => item && item.title && item.status !== 'checking');

  const lines = [];
  lines.push('## ✅ 巡查完成');
  lines.push('');
  lines.push(taskCount
    ? `已巡查 ${checkedCount} 个关联微信会话，发现 ${orderingCount} 位客户的 ${taskCount} 个订单任务（${messageCount} 条新消息）`
    : `已巡查 ${checkedCount} 个关联微信会话，没有发现未处理的新订单`);
  lines.push('');
  lines.push(`**本次巡查结果：${orderingCount} 家订货** · 已搜索 ${checkedCount} 家关联微信`);
  lines.push('');
  lines.push('| 已搜索 | 订货客户 | 订单任务 |');
  lines.push('| :---: | :---: | :---: |');
  lines.push(`| ${checkedCount} | ${orderingCount} | ${taskCount} |`);

  if (rows.length) {
    lines.push('');
    lines.push(`**实时查询结果 ${rows.length} / ${checkedCount || rows.length}**`);
    lines.push('');
    lines.push('| 微信会话 | 客户 | 结果 |');
    lines.push('| --- | --- | --- |');
    rows.forEach(item => {
      const customer = item.customerName && item.customerName !== item.title ? item.customerName : '—';
      lines.push(`| ${scanReportCell(item.title)} | ${scanReportCell(customer)} | ${scanReportResultMark(item)} |`);
    });
  }

  if (warningCount) {
    lines.push('');
    lines.push(`> 另有 ${warningCount} 项需人工检查（会话未找到、读取失败或图片等待原图），详见工作台。`);
  }
  lines.push('');
  if (summary.saveOutcome) {
    const saved = summary.saveOutcome.saved || [];
    const skipped = summary.saveOutcome.skipped || [];
    lines.push('');
    if (saved.length) {
      lines.push(`### ✅ 已自动保存 ${saved.length} 个订单`);
      lines.push('');
      lines.push('| 微信会话 | 客户 | 订单条数 | 订单任务号 |');
      lines.push('| --- | --- | :---: | --- |');
      saved.forEach((row) => lines.push(`| ${row.conversation} | ${row.customer} | ${row.count} | ${row.taskId} |`));
    } else {
      lines.push('### ⚠️ 没有自动保存任何订单');
    }
    if (skipped.length) {
      lines.push('');
      lines.push(`**另有 ${skipped.length} 个任务未保存（仍保留在微信订单任务列表中，可手动处理）：**`);
      lines.push('');
      lines.push('| 微信会话 | 客户 | 未保存原因 |');
      lines.push('| --- | --- | --- |');
      skipped.forEach((row) => lines.push(`| ${row.conversation} | ${row.customer} | ${row.reason} |`));
    }
    lines.push('');
    lines.push('> 已保存的订单已从「微信订单任务」列表移出，可在订单任务中查看。');
  } else {
    lines.push('> 结果已在 GrainPrint「微信订单工作台」中保留，可先检查异常项，再逐条确认为订单任务。');
  }
  return lines.join('\n');
}

// 巡查结束后，若本次巡查由 MCP「打开微信订单」指令触发，则把结果回报给桥（3011），
// 让 MCP 侧任务卡从「已受理」闭环为「已完成/失败」。用户手动点击全面检查时任务号为空，不回报。
function reportMcpWechatScanResult(outcome, summary) {
  const taskId = window.__grainMcpWechatScanTaskId;
  if (!taskId) return;
  window.__grainMcpWechatScanTaskId = null;
  const report = window.electronAPI?.reportPrintResult;
  if (typeof report !== 'function') return;
  try {
    if (outcome === 'failed') {
      report(taskId, false, (summary && summary.error) || '未知错误');
      return;
    }
    report(taskId, true, buildWechatScanReportMarkdown(summary));
  } catch {
    // 回报失败不影响工作台本身；MCP 侧仍可通过 get_print_task_status 查询。
  }
}

// ===== MCP「保存微信订单」批量流程 =====

// 每个任务都在「切换客户 → 等工作区重建结束 → 原子执行解析/校验/保存」之后才取结果，
// 避免对着刚重建的空工作台做校验（那会把已成功的任务误判成「没有可保存的订单」）。

function buildWechatSaveReportMarkdown(saved, skipped) {
  const lines = [];
  if (saved.length) {
    lines.push(`## ✅ 已保存 ${saved.length} 个微信订单`);
    lines.push('');
    lines.push('| 微信会话 | 客户 | 订单条数 | 订单任务号 |');
    lines.push('| --- | --- | :---: | --- |');
    saved.forEach((row) => {
      lines.push(`| ${row.conversation} | ${row.customer} | ${row.count} | ${row.taskId} |`);
    });
  } else {
    lines.push('## ⚠️ 没有保存任何订单');
  }
  if (skipped.length) {
    lines.push('');
    lines.push(`**另有 ${skipped.length} 个任务未保存（仍保留在微信订单任务列表中，可手动处理）：**`);
    lines.push('');
    lines.push('| 微信会话 | 客户 | 未保存原因 |');
    lines.push('| --- | --- | --- |');
    skipped.forEach((row) => {
      lines.push(`| ${row.conversation} | ${row.customer} | ${row.reason} |`);
    });
  }
  lines.push('');
  lines.push('> 已保存的订单已从「微信订单任务」列表移出，可在订单任务中查看。');
  return lines.join('\n');
}

// 批量保存结束后回报给桥（3011），闭环 MCP 侧任务卡。
function reportMcpWechatSaveResult(outcome, payload) {
  const taskId = window.__grainMcpWechatSaveTaskId;
  if (!taskId) return;
  window.__grainMcpWechatSaveTaskId = null;
  const report = window.electronAPI?.reportPrintResult;
  if (typeof report !== 'function') return;
  try {
    if (outcome === 'failed') {
      report(taskId, false, (payload && payload.error) || '未知错误');
      return;
    }
    report(taskId, true, buildWechatSaveReportMarkdown((payload && payload.saved) || [], (payload && payload.skipped) || []));
  } catch {
    // 回报失败不影响工作台本身；MCP 侧仍可通过 get_print_task_status 查询。
  }
}

// 逐个保存：只处理「解析完整」的任务；保存成功的从微信订单任务列表移出（后端订单任务保留）。
// reportMode：'own'    = 用自己的 MCP 任务号单独回报（独立的「保存微信订单」指令）
//              'merged' = 不单独回报，由巡查流程把结果并进巡查报告（用户说「打开并保存」时走这条）
async function batchSaveAllWechatOrders({ reportMode = 'own' } = {}) {
  const own = reportMode !== 'merged';
  const bail = (error) => {
    if (own) reportMcpWechatSaveResult('failed', { error });
    return { saved: [], skipped: [], error };
  };
  if (wechatBatchSaving.value) return bail('批量保存正在进行中，本次指令未执行');
  if (!wechatImportModalOpen.value) return bail('微信订单工作台未打开，请先执行「打开微信客户订单」');
  const snapshot = wechatImportBatch.value.slice();
  if (!snapshot.length) return bail('当前没有待处理的微信订单任务，请先执行「打开微信客户订单」');
  const saved = [];
  const skipped = [];
  wechatBatchSaving.value = true;
  wechatBatchSaveProgress.value = { done: 0, total: snapshot.length };
  try {
    for (const item of snapshot) {
      const label = {
        conversation: item.conversationTitle || item.customerName || '未知会话',
        customer: item.customerName || '未知客户',
      };
      // 图片任务交给千问视觉模型：runWechatImportAndSave 内部带 autoRecognize，
      // 由服务端一次完成「识别 + 落库」，不再要求人工点「直接识别 / AI识别」。
      // 千问解析或落库失败时 outcome.ok=false，会自然落入下方 skipped 分支，
      // 任务仍保留在微信订单列表里交人工处理，不会丢单。
      // 人工在界面上点识别的两条入口（单列 / 多列）也已统一走千问，
      // 这里只负责连接器批量保存时的无弹窗调用。
      // 切到该任务：设置激活项并同步客户上下文（不打开工作台、不切换微信窗口）。
      activeWechatImportToken.value = item.token;
      const opened = await openActiveWechatImport({ openWorkspace: false, focusConversation: false });
      if (!opened) {
        skipped.push({ ...label, reason: '无法匹配客户资料' });
        wechatBatchSaveProgress.value.done += 1;
        continue;
      }
      // 等客户切换引起的工作区重建彻底结束，再取到稳定的录入区实例做「解析→校验→保存」。
      await nextTick();
      await nextTick();
      await nextTick();
      const panel = activeWechatImportPanelRef.value;
      if (!panel?.runWechatImportAndSave) {
        skipped.push({ ...label, reason: '订单录入区尚未就绪' });
        wechatBatchSaveProgress.value.done += 1;
        continue;
      }
      const outcome = await panel.runWechatImportAndSave(item.payload);
      if (outcome && outcome.ok) {
        saved.push({ ...label, count: outcome.count, taskId: outcome.taskId });
        try {
          // 保存成功：把该任务从微信订单任务列表移出（仅移除待处理卡片，不删后端订单任务）。
          await removeWechatImport(item.token);
        } catch (error) {
          console.warn('[MCP] 移出微信任务列表失败:', item.token, error);
        }
      } else {
        skipped.push({ ...label, reason: (outcome && outcome.reason) || '保存失败' });
      }
      wechatBatchSaveProgress.value.done += 1;
    }
  } finally {
    wechatBatchSaving.value = false;
  }
  if (own) reportMcpWechatSaveResult('success', { saved, skipped });
  return { saved, skipped };
}

async function scanAllBoundWechatOrders(options = {}) {
  if (wechatScanBusy.value || wechatSelectedImportBusy.value) {
    reportMcpWechatScanResult('failed', { error: '工作台正在巡查中，本次指令未执行' });
    return;
  }
  const timing = createWechatOrderTiming('scan-all-bound-wechat');
  let timingOutcome = 'failed';
  let timingSummary = {
    automatic: options?.automatic === true,
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
  const automatic = options?.automatic === true;
  const excludedCustomerKeys = new Set(
    Array.isArray(options?.excludedCustomerKeys) ? options.excludedCustomerKeys : []
  );
  const currentDistributerId = String(
    disUser.value?.nxDiuDistributerId || disUser.value?.nxDistributerId || ''
  ).trim();
  const customerFilter = automatic
    ? customer => customerParticipatesInAutoRead(
      currentDistributerId,
      customerId(customer),
      excludedCustomerKeys
    )
    : null;
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
      directoryCustomerCount,
      participatingCustomerCount,
    } = await timeWechatOrderPhase(
      timing,
      'scan-customer-directory-load',
      () => loadBoundWechatCustomers({ refreshCustomers: true, customerFilter })
    );
    const entries = Array.from(unique.entries()).map(([title, row]) => ({ title, row }));
    timing.phase('scan-customer-directory-ready', {
      customerCount: entries.length,
      directoryCustomerCount,
      participatingCustomerCount,
      failedCount,
      ambiguousCount,
    });
    if (!entries.length) {
      throw new Error(
        automatic
          ? '没有已开启“参与自动读取”的微信绑定客户'
          : (ambiguousCount
            ? '客户中心的微信名称存在重复，无法安全匹配，请先改成唯一名称'
            : '客户中心还没有关联微信好友或群聊')
      );
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
            () => ensureWechatBindingFromCustomerProfile({
              row,
              selectedTitle: title,
              directory: associationDirectory,
              onTiming,
            }),
            customerMeta
          );
          const conversationSnapshotPromise = loadWechatConversationSnapshot({
            binding: row.binding,
            conversationTitle: title,
          });
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
              returnFirstEmpty: mode === 'database',
              // Opening the exact conversation makes WeChat fetch the full
              // image asynchronously. Retry the same attachment while it is
              // being written instead of requiring an operator to open it.
              attachmentRetryDelaysMs: mode === 'conversation'
                ? WECHAT_IMAGE_DOWNLOAD_RETRY_DELAYS_MS
                : [],
              onTiming,
            }),
            { ...customerMeta, readMode: mode }
          );
          const databaseFirst = await readWechatCustomerDatabaseFirst({
            readDatabase,
            canTrustDatabaseResult: async (databaseResult) => {
              const snapshot = await conversationSnapshotPromise;
              if (snapshot.available && snapshot.exists === false) {
                throw new Error(`微信本地会话中已找不到“${title}”，请检查客户关联`);
              }
              const covered = databaseResultCoversConversation(databaseResult, snapshot);
              if (covered) {
                timing.phase('scan-database-freshness', {
                  ...customerMeta,
                  status: databaseResult?.status || '',
                  lastMessageTimeMs: snapshot.lastMessageTimeMs,
                  latestObservedMessageTimeMs: databaseResult?.latestObservedMessageTimeMs,
                });
              }
              return covered;
            },
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
          const conversationSnapshot = await conversationSnapshotPromise;
          prepared.conversationAvatar = applyWechatConversationAvatar(
            title,
            conversationSnapshot.avatarUrl
          );
          const items = prepared.payload ? createWechatImportItems(row, title, prepared) : [];
          timing.phase('scan-customer-complete', {
            ...customerMeta,
            durationMs: Math.max(0, timingNow() - customerStartedAt),
            status: items.length ? 'found' : prepared.status === 'deferred' ? 'warning' : 'empty',
            taskCount: items.length,
            readMode: databaseFirst.mode,
          });
          return {
            items,
            warning: prepared.warning || (prepared.status === 'deferred' ? prepared.message : ''),
          };
        } catch (error) {
          timing.phase('scan-customer-complete', {
            ...customerMeta,
            durationMs: Math.max(0, timingNow() - customerStartedAt),
            status: error?.code === 'SERVER_AUTH_FAILED' ? 'auth-error' : 'error',
            failed: true,
            error: error?.message || String(error),
          });
          throw error;
        }
      },
    });

    const warningCount = failedCount + ambiguousCount
      + result.failures.length + result.warnings.length;
    const totalMessages = result.imports.reduce((sum, item) => sum + item.messageCount, 0);
    const customerCount = new Set(result.imports.map(item => String(item.customerId))).size;
    timingOutcome = warningCount ? 'warning' : 'success';
    timingSummary = {
      automatic,
      eligibleCustomerCount: entries.length,
      directoryCustomerCount,
      participatingCustomerCount,
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
      const failedTitles = [...result.failures, ...result.warnings]
        .slice(0, 3)
        .map(item => `“${item.title}”`)
        .join('、');
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
    await focusWechatWorkspaceApp();
    // 定时自动读取是无人值守流程；与 WorkBuddy「打开并保存」复用同一批量保存入口。
    // 人工点击“全部读”不带 automatic，仍只保留任务供人工检查，不会自动保存。
    const shouldAutoSave = automatic || window.__grainAutoSaveWechatOrders;
    if (timingOutcome !== 'failed' && shouldAutoSave && wechatImportBatch.value.length) {
      try {
        const saveOutcome = await batchSaveAllWechatOrders({ reportMode: 'merged' });
        if (saveOutcome) {
          timingSummary = { ...timingSummary, saveOutcome };
          if (saveOutcome.error || saveOutcome.skipped?.length) timingOutcome = 'warning';
        }
      } catch (error) {
        timingOutcome = 'warning';
        timingSummary = {
          ...timingSummary,
          saveOutcome: { saved: [], skipped: [], error: error?.message || String(error) },
        };
      }
    } else if (shouldAutoSave) {
      timingSummary = {
        ...timingSummary,
        saveOutcome: { saved: [], skipped: [], reason: timingOutcome === 'failed' ? 'scan-failed' : 'no-tasks' },
      };
    }
    window.__grainAutoSaveWechatOrders = false;
    timing.finish(timingOutcome, timingSummary);
    // 由 MCP 指令触发时，把最终结果回报给桥，完成「受理 → 执行 → 结果」闭环。
    reportMcpWechatScanResult(timingOutcome, timingSummary);
  }
}

async function handleTaskAdded(change) {
  if (change?.asyncImage) watchAsyncImageTask(change.taskId);
  // 自动批量保存必须只有 batchSaveAllWechatOrders 一个队列所有者。
  // 这里既不刷新总览，也不提前切换任务；保存结果返回后由批量循环统一处理。
  if (wechatBatchSaving.value) return;
  const current = activeWechatImport.value;
  if (current && change?.wechatImportToken === current.token) {
    const queueUpdate = removeWechatImportQueueItem(wechatImportQueue.value, current.token);
    const batchUpdate = removeWechatImportQueueItem(wechatImportBatch.value, current.token);
    wechatImportQueue.value = queueUpdate.items;
    wechatImportBatch.value = batchUpdate.items;
    wechatImportCompletedTokens.value = wechatImportCompletedTokens.value.filter(
      token => token !== current.token
    );
    activeWechatImportToken.value = queueUpdate.items[0]?.token || null;
  }
  await handleOrderChanged(change);
  if (!current || change?.wechatImportToken !== current.token) return;
  if (wechatImportQueue.value.length) {
    await openActiveWechatImport({ openWorkspace: false, focusConversation: true });
  } else {
    activeWechatImportToken.value = null;
    await closeWechatImportModal();
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
  startAsyncImageTaskPoller();
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

.order-workbench__wechat-history {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background: var(--product-surface);
}

.order-workbench__wechat-history-state {
  display: grid;
  height: 100%;
  min-height: 240px;
  place-content: center;
  justify-items: center;
  gap: 8px;
  padding: 28px;
  color: var(--product-primary-strong);
  text-align: center;
}
.order-workbench__wechat-history-state i {
  width: 28px;
  height: 28px;
  border: 3px solid var(--product-primary-soft);
  border-top-color: var(--product-primary-strong);
  border-radius: 50%;
  animation: wechat-status-spin .8s linear infinite;
}
.order-workbench__wechat-history-state strong { color: var(--product-text); font-size: 17px; }
.order-workbench__wechat-history-state span { font-size: 12px; }
.order-workbench__wechat-history-state.is-error strong { color: var(--product-danger); }
.order-workbench__wechat-history-state button {
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid var(--product-primary);
  border-radius: 9px;
  color: var(--product-primary-strong);
  background: var(--product-primary-soft);
  font-weight: 800;
  cursor: pointer;
}
.order-workbench__wechat-history :deep(.saved-orders-tab) { background: var(--product-surface); }

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

.order-workbench__pick-print {
  flex: none;
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid var(--product-primary);
  border-radius: 9px;
  background: var(--product-primary);
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
.order-workbench__pick-print:disabled { opacity: .65; cursor: wait; }

/* 批量打印拣货单弹窗 */
.pick-list-dialog-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(var(--product-text-rgb), 0.35);
}
.pick-list-dialog {
  display: flex;
  width: 420px;
  max-width: 92vw;
  max-height: 82vh;
  flex-direction: column;
  border-radius: 12px;
  background: var(--product-surface);
  box-shadow: 0 18px 46px rgba(var(--product-text-rgb), 0.2);
}
.pick-list-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--product-tint);
}
.pick-list-dialog__header h3 { margin: 0; font-size: 16px; }
.pick-list-dialog__close {
  border: none;
  background: none;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  color: var(--product-text-muted);
}
.pick-list-dialog__body { padding: 14px 18px; overflow-y: auto; }
.pick-list-field { margin-bottom: 14px; }
.pick-list-field__label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--product-text-muted);
}
.pick-list-mode { display: flex; gap: 8px; }
.pick-list-mode button {
  min-height: 30px;
  padding: 0 14px;
  border: 1px solid var(--product-primary-soft);
  border-radius: 8px;
  background: var(--product-surface);
  font-size: 13px;
  cursor: pointer;
}
.pick-list-mode button.is-active {
  border-color: var(--product-primary);
  background: var(--product-primary-soft);
  color: var(--product-primary-strong);
}
.pick-list-customers__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
}
.pick-list-customers__count { color: var(--product-text-muted); }
.pick-list-customers__list {
  max-height: 260px;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  border: 1px solid var(--product-tint);
  border-radius: 8px;
  list-style: none;
}
.pick-list-customers__list li { border-bottom: 1px solid var(--product-tint); }
.pick-list-customers__list li:last-child { border-bottom: none; }
.pick-list-customers__list label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
}
.pick-list-empty { margin: 8px 0 0; font-size: 13px; color: var(--product-text-muted); }
.pick-list-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px;
  border-top: 1px solid var(--product-tint);
}
.pick-list-dialog__footer button {
  min-height: 32px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}
.pick-list-dialog__footer .is-secondary {
  border: 1px solid var(--product-primary-soft);
  background: var(--product-surface);
}
.pick-list-dialog__footer .is-primary {
  border: 1px solid var(--product-primary);
  background: var(--product-primary);
  color: #fff;
}
.pick-list-dialog__footer .is-primary:disabled { opacity: .6; cursor: not-allowed; }
.pick-list-dialog__message {
  margin: 0;
  padding: 0 18px 14px;
  font-size: 12px;
  color: var(--product-text-muted);
}
.pick-list-dialog__message.is-error { color: var(--product-danger); }

.order-workbench__header-stages > button {
  display: flex;
  flex: none;
  align-items: center;
  gap: 7px;
  padding: 4px 13px 4px 5px;
  border: 1px solid var(--product-tint);
  border-radius: 999px;
  color: var(--product-text-secondary);
  background: var(--product-surface);
  box-shadow: 0 1px 2px rgba(var(--product-text-rgb), 0.06);
  cursor: pointer;
  transition: border-color .16s ease, color .16s ease, background .16s ease;
}

.order-workbench__header-stages > button:hover { border-color: var(--product-primary-soft); color: var(--product-text); }
.order-workbench__header-stages > button.is-active {
  border-color: var(--product-primary);
  color: var(--product-primary-strong);
  background: var(--product-primary-soft);
}
.order-workbench__header-stages > button.is-reminder.is-active {
  border-color: var(--product-warning);
  color: var(--product-warning);
  background: var(--product-warning-soft);
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
.order-workbench__stage-icon.is-review { color: var(--product-warning); background: var(--product-warning-soft); }
.order-workbench__stage-icon.is-progress { color: var(--product-info); background: var(--product-info-soft); }
.order-workbench__stage-icon.is-ready { color: var(--product-primary-strong); background: var(--product-primary-soft); }
.order-workbench__stage-icon.is-reminder { color: var(--product-warning); background: var(--product-warning-soft); }
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
  background: rgba(var(--product-text-rgb), 0.18);
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
  border: 1px solid var(--product-primary-soft);
  border-radius: 18px;
  color: var(--product-primary-strong);
  background: rgba(var(--product-primary-soft-rgb), 0.98);
  box-shadow: 0 24px 70px rgba(var(--product-text-rgb), 0.25), 0 2px 8px rgba(var(--product-text-rgb), 0.08);
}

.order-workbench__wechat-status.is-warning { border-color: var(--product-warning); color: var(--product-warning); background: rgba(var(--product-warning-soft-rgb), 0.98); }
.order-workbench__wechat-status.is-error { border-color: var(--product-danger); color: var(--product-danger); background: rgba(var(--product-danger-soft-rgb), 0.98); }
.order-workbench__wechat-status.is-info { border-color: var(--product-primary-soft); }

.order-workbench__wechat-status-icon {
  display: grid;
  width: 54px;
  height: 54px;
  flex: none;
  place-items: center;
  border-radius: 16px;
  background: currentColor;
  box-shadow: inset 0 0 0 1px rgba(var(--product-tint-rgb), 0.18);
}

.order-workbench__wechat-status-icon svg { width: 29px; height: 29px; color: #fff; }
.order-workbench__wechat-status-copy { min-width: 0; }
.order-workbench__wechat-status-copy small { display: block; margin-bottom: 3px; opacity: .7; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
.order-workbench__wechat-status-copy strong { display: block; color: var(--product-text); font-size: 18px; line-height: 1.35; }
.order-workbench__wechat-status-copy p { margin: 7px 0 0; color: var(--product-text-secondary); font-size: 13px; font-weight: 650; line-height: 1.65; }
.order-workbench__wechat-status.is-warning .order-workbench__wechat-status-copy strong,
.order-workbench__wechat-status.is-warning .order-workbench__wechat-status-copy p { color: var(--product-warning); }
.order-workbench__wechat-status.is-error .order-workbench__wechat-status-copy strong,
.order-workbench__wechat-status.is-error .order-workbench__wechat-status-copy p { color: var(--product-danger); }

.order-workbench__wechat-status > button {
  position: absolute;
  top: 15px;
  right: 17px;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--product-text-muted);
  background: rgba(var(--product-text-rgb), 0.06);
  font-size: 20px;
  line-height: 26px;
  cursor: pointer;
}
.order-workbench__wechat-status > button:hover { color: var(--product-primary-strong); background: rgba(var(--product-text-rgb), 0.12); }

.order-workbench__wechat-spinner {
  width: 27px;
  height: 27px;
  border: 3px solid rgba(var(--product-tint-rgb), 0.4);
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
