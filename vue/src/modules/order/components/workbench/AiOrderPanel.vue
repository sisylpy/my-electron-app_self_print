<template>
  <section :class="['ai-order-panel', { 'is-wechat-import': wechatImportMode }]" aria-label="AI 下单">
    <div v-if="!wechatImportMode" class="ai-order-panel__toolbar">
      <button type="button" class="ai-order-panel__back" @click="$emit('show-today-orders')">
        <span>←</span>
        返回订单主页
      </button>

      <CustomerContextPicker
        class="ai-order-panel__customer"
        compact
        :customers="customers"
        :selected-customer="selectedCustomer"
        :selected-department-id="selectedDepartmentId"
        :loading="customerLoading"
        :error="customerError"
        @select-customer="$emit('select-customer', $event)"
        @select-department="$emit('select-department', $event)"
        @retry="$emit('retry-customers')"
      />

      <div v-if="selectedCustomer" class="ai-order-panel__modes">
        <span>选择下单方式</span>
        <OrderModeSelector
          :model-value="selectedMode"
          variant="toolbar"
          @change="handleModeChange"
        />
        <button
          v-if="hasWechatContact"
          type="button"
          :class="['ai-order-panel__wechat-mode', { 'is-active': selectedMode === 'wechat' }]"
          :disabled="wechatPulling"
          title="获取当前客户的微信新消息并解析"
          @click="handleWechatQuickAction"
        >
          {{ wechatPulling ? '正在获取…' : '微信聊天' }}
        </button>
      </div>
    </div>

    <div v-if="selectedCustomer" class="ai-order-panel__workspace">
      <PlaceOrderWorkspace
        ref="placeOrderRef"
        :key="workspaceKey"
        :selected-all-customer="selectedCustomerId"
        :selected-sub-department="selectedDepartmentId"
        :selected-customer-entity="selectedCustomer"
        :selected-customer-name="selectedCustomerName"
        initial-upload-type="paste"
        new-task-only
        :show-mode-selector="false"
        :show-wechat-order-source="!wechatImportMode"
        :external-paste-actions-target="wechatImportMode ? '#wechat-import-active-actions' : ''"
        @upload-type-change="selectedMode = $event"
        @order-saved="$emit('order-saved', $event)"
        @task-added="handleTaskAdded"
        @wechat-tasks-loaded="handleWechatTasksLoaded"
        @switch-to-today-orders="$emit('show-today-orders')"
      />
    </div>

    <div v-else class="ai-order-panel__empty">
      <div class="ai-order-panel__mark">AI</div>
      <strong>选择客户后开始下单</strong>
      <p>客户只在需要时搜索，不再常驻显示客户列表。</p>
      <span>支持复制粘贴、图片识别、Excel 粘贴和手工录入</span>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import PlaceOrderWorkspace from '../PlaceOrderWorkspace.vue';
import OrderModeSelector from '../OrderModeSelector.vue';
import CustomerContextPicker from './CustomerContextPicker.vue';
import { customerHasWechatContact } from '../../services/wechatOrderAvailability';

const props = defineProps({
  customers: { type: Array, default: () => [] },
  selectedCustomer: { type: Object, default: null },
  selectedCustomerId: { type: [Number, String], default: null },
  selectedCustomerName: { type: String, default: '' },
  selectedDepartmentId: { type: [Number, String], default: null },
  customerLoading: { type: Boolean, default: false },
  customerError: { type: String, default: '' },
  pendingWechatImport: { type: Object, default: null },
  wechatImportMode: { type: Boolean, default: false },
});

const emit = defineEmits([
  'select-customer',
  'select-department',
  'retry-customers',
  'order-saved',
  'task-added',
  'show-today-orders',
  'wechat-import-error',
  'wechat-tasks-loaded',
]);

const newTaskSequence = ref(0);
const workspaceKey = computed(() => (
  `${props.selectedCustomerId || 'none'}:${props.selectedDepartmentId || 'root'}:${newTaskSequence.value}`
));
const placeOrderRef = ref(null);
const selectedMode = ref('paste');
const wechatPulling = ref(false);
const appliedWechatImportToken = ref(null);
const hasWechatContact = computed(() => customerHasWechatContact(props.selectedCustomer));
let workspaceResetTimer = null;

watch(() => [props.selectedCustomerId, props.selectedDepartmentId], () => {
  selectedMode.value = 'paste';
});

watch(
  () => [
    props.pendingWechatImport?.token || null,
    props.pendingWechatImport?.customerId || null,
    props.selectedCustomerId,
    workspaceKey.value,
  ],
  async ([token, importCustomerId, selectedCustomerId]) => {
    const pendingImport = props.pendingWechatImport;
    if (!token || appliedWechatImportToken.value === token) return;
    if (String(importCustomerId) !== String(selectedCustomerId)) return;
    // Keep the payload that belongs to this watcher run. The user can switch
    // from a text task to an image task while the next tick or OCR is pending.
    if (!pendingImport || pendingImport.token !== token) return;
    const payload = pendingImport.payload;
    try {
      selectedMode.value = 'wechat';
      await nextTick();
      if (props.pendingWechatImport?.token !== token) return;
      const workspace = placeOrderRef.value;
      if (!workspace?.applyWechatImport) throw new Error('订单录入区尚未就绪');
      await workspace.applyWechatImport(payload);
      if (props.pendingWechatImport?.token !== token) return;
      appliedWechatImportToken.value = token;
    } catch (error) {
      if (props.pendingWechatImport?.token === token) {
        emit('wechat-import-error', { token, message: error?.message || '微信订单载入失败' });
      }
    }
  },
  { flush: 'post', immediate: true }
);

function handleTaskAdded(event) {
  const token = appliedWechatImportToken.value;
  emit('task-added', token
    ? { ...(event && typeof event === 'object' ? event : {}), wechatImportToken: token }
    : event);
  appliedWechatImportToken.value = null;
  clearTimeout(workspaceResetTimer);
  workspaceResetTimer = setTimeout(() => {
    selectedMode.value = 'paste';
    newTaskSequence.value += 1;
    workspaceResetTimer = null;
  }, 0);
}

function handleWechatTasksLoaded(event) {
  const tasks = Array.isArray(event?.tasks) ? event.tasks : [];
  if (!tasks.length) return;
  emit('wechat-tasks-loaded', {
    ...event,
    tasks,
    customer: props.selectedCustomer,
    customerId: props.selectedCustomerId,
    customerName: props.selectedCustomerName,
  });
}

function dismissPendingWechatImport() {
  appliedWechatImportToken.value = null;
  placeOrderRef.value?.dismissWechatImport?.();
}

defineExpose({ dismissPendingWechatImport });

onBeforeUnmount(() => {
  clearTimeout(workspaceResetTimer);
  dismissPendingWechatImport();
});

async function handleModeChange(mode) {
  if (mode === selectedMode.value) return;
  selectedMode.value = mode;
  await nextTick();
  placeOrderRef.value?.handleUploadTypeChange?.(mode);
}

async function handleWechatQuickAction() {
  if (wechatPulling.value) return;
  wechatPulling.value = true;
  try {
    selectedMode.value = 'wechat';
    await nextTick();
    await placeOrderRef.value?.pullWechatMessages?.();
  } finally {
    wechatPulling.value = false;
  }
}
</script>

<style scoped>
.ai-order-panel {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}

.ai-order-panel.is-wechat-import {
  height: 100%;
  grid-template-rows: minmax(0, 1fr);
  gap: 0;
}

.ai-order-panel.is-wechat-import .ai-order-panel__workspace {
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 12px;
  box-shadow: none;
}

.ai-order-panel__workspace {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 12px;
  border: 1px solid var(--product-border);
  border-radius: var(--product-radius-lg);
  background: var(--product-surface);
  box-shadow: var(--product-shadow);
}

.ai-order-panel__toolbar {
  position: relative;
  z-index: 20;
  display: flex;
  min-width: 0;
  min-height: 52px;
  align-items: center;
  gap: 10px;
  padding: 7px 9px;
  border: 1px solid var(--product-border);
  border-radius: var(--product-radius-lg);
  background: var(--product-surface);
  box-shadow: var(--product-shadow);
}

.ai-order-panel__back {
  display: flex;
  height: 38px;
  flex: none;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border: 1px solid #176b48;
  border-radius: 6px;
  color: #fff;
  background: #176b48;
  font-size: 11px;
  font-weight: 900;
  box-shadow: 0 4px 10px rgba(23, 107, 72, .16);
}

.ai-order-panel__back:hover { background: #115a3c; }
.ai-order-panel__back span { font-size: 16px; line-height: 1; }

.ai-order-panel__customer {
  width: 280px;
  min-width: 240px;
  max-width: 280px;
  flex: 0 1 280px;
}

.ai-order-panel__customer :deep(.customer-context__picker) {
  min-width: 0;
}

.ai-order-panel__modes {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 7px;
}

.ai-order-panel__modes > span {
  color: var(--product-text-secondary);
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.ai-order-panel__modes :deep(.order-mode-selector--toolbar) {
  width: min(100%, 720px);
}

.ai-order-panel__wechat-mode {
  height: 38px;
  flex: none;
  padding: 0 14px;
  border: 1px solid var(--product-border-strong);
  border-radius: 6px;
  color: var(--product-text-secondary);
  background: var(--product-surface);
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.ai-order-panel__wechat-mode:hover,
.ai-order-panel__wechat-mode.is-active {
  border-color: #178454;
  color: #fff;
  background: #178454;
}

@media (max-width: 1180px) {
  .ai-order-panel__modes > span { display: none; }
}

.ai-order-panel__empty {
  display: flex;
  min-height: 0;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border: 1px dashed var(--product-border-strong);
  border-radius: var(--product-radius-lg);
  color: var(--product-text-secondary);
  background:
    radial-gradient(circle at 50% 30%, rgba(17, 155, 93, .07), transparent 34%),
    var(--product-surface);
}

.ai-order-panel__mark {
  display: grid;
  width: 54px;
  height: 54px;
  margin-bottom: 14px;
  place-items: center;
  border-radius: 10px;
  color: #fff;
  background: linear-gradient(135deg, var(--product-primary), var(--product-primary-strong));
  font-size: 15px;
  font-weight: 900;
  box-shadow: 0 12px 24px rgba(17, 155, 93, .18);
}

.ai-order-panel__empty strong {
  color: var(--product-text);
  font-size: 17px;
}

.ai-order-panel__empty p {
  margin: 7px 0 15px;
  color: var(--product-text-secondary);
  font-size: 12px;
}

.ai-order-panel__empty span {
  padding: 7px 11px;
  border-radius: 4px;
  color: var(--product-text-muted);
  background: var(--product-surface-soft);
  font-size: 10px;
}

.ai-order-panel__workspace :deep(.save-order-tab .row.g-3) {
  --bs-gutter-x: 10px;
}

.ai-order-panel__workspace :deep(.save-order-tab .card) {
  border-color: var(--product-border) !important;
  box-shadow: none !important;
}

.ai-order-panel__workspace :deep(.save-order-tab .card-header) {
  border-color: var(--product-border);
  background: var(--product-surface-soft);
}
</style>
