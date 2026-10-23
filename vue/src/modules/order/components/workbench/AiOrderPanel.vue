<template>
  <section :class="['ai-order-panel', { 'is-wechat-import': wechatImportMode }]" aria-label="AI 下单">
    <div v-if="!wechatImportMode" class="ai-order-panel__toolbar">
      <button type="button" class="ai-order-panel__back" @click="$emit('show-today-orders')">
        <span>←</span>
        {{ returnLabel }}
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
        :wechat-conversation-name="pendingWechatImport
          ? (pendingWechatImport.conversationTitle || selectedCustomer?.nxDepartmentWechatDisplayName || '')
          : ''"
        initial-upload-type="paste"
        new-task-only
        :show-mode-selector="false"
        :show-wechat-order-source="!wechatImportMode"
        :external-paste-actions-target="wechatImportMode ? '#wechat-import-active-actions' : ''"
        @upload-type-change="selectedMode = $event"
        @order-saved="$emit('order-saved', $event)"
        @task-added="handleTaskAdded"
        @wechat-draft-changed="$emit('wechat-draft-changed', $event)"
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
  // MCP「保存微信订单」批量模式：由 OrderWorkbenchV2 置位。
  // 解析完成后自动静默校验 + 提交，并把结果 emit 回父组件统一汇总。
  batchSaveMode: { type: Boolean, default: false },
  // 巡查报告显示时保留任务数据，但不在报告背后自动解析或弹出图片裁剪窗。
  suspendWechatImport: { type: Boolean, default: false },
  returnLabel: { type: String, default: '返回订单主页' },
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
  'wechat-draft-changed',
  'wechat-batch-save-result',
]);

const newTaskSequence = ref(0);
const workspaceKey = computed(() => (
  `${props.selectedCustomerId || 'none'}:${props.selectedDepartmentId || 'root'}:${newTaskSequence.value}`
));
const placeOrderRef = ref(null);
const selectedMode = ref('paste');
const appliedWechatImportToken = ref(null);
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
    props.suspendWechatImport,
  ],
  async ([token, importCustomerId, selectedCustomerId, , suspended]) => {
    // 批量保存由父组件原子驱动（解析 + 校验 + 保存一次完成）。
    // 这里必须跳过：切换客户会让 workspaceKey 变化而重复触发本 watch，
    // 重复解析会对着刚重建的空工作台做校验，把已成功的任务误判成「没有可保存的订单」。
    if (props.batchSaveMode || suspended) return;
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
  // 批量保存必须由 runWechatImportAndSave 收到服务端成功结果后，再由父组件
  // 统一移出当前任务。这里不能再 emit 人工保存事件：父页面收到后会刷新订单
  // 总览，而打包版的该刷新仍是普通 Axios 请求，既无必要又会因缺少主进程
  // 会话 Cookie 把已经保存成功的无人值守流程误判为登录失效。
  if (props.batchSaveMode) {
    appliedWechatImportToken.value = null;
    return;
  }
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

// 巡查报告里的图片缩略图由用户主动点击后才进入图片识别。
// 这条命令式入口刻意不受 suspendWechatImport 影响；后者只阻止巡查期间自动弹图。
async function previewWechatImport(payload) {
  selectedMode.value = 'wechat';
  await nextTick();
  const target = placeOrderRef.value;
  if (!target?.applyWechatImport) throw new Error('图片识别区尚未就绪');
  await target.applyWechatImport(payload);
  appliedWechatImportToken.value = props.pendingWechatImport?.token || null;
}

async function appendWechatImport(payload, incrementalPayload) {
  await nextTick();
  const target = placeOrderRef.value;
  if (!target?.appendWechatImport) throw new Error('订单录入区尚未就绪');
  return target.appendWechatImport(payload, incrementalPayload);
}

// 批量保存的原子入口：解析 → 静默校验 → 提交，一次完成并返回结果。
// 由父组件（OrderWorkbenchV2）在「客户上下文 + 工作区实例」都稳定之后调用，
// 刻意不经过上面的 watch —— 否则切换客户引发的 workspaceKey 变化会重复触发解析，
// 第二次就对着刚重建的空工作台校验，把本已成功的任务误判成「没有可保存的订单」。
async function runWechatImportAndSave(payload) {
  try {
    // 任务可能在自动保存前已被人工预览过。清掉预览阶段留下的 token，避免
    // 千问成功事件被误当成人工保存事件，导致父页面过早切走当前任务。
    appliedWechatImportToken.value = null;
    selectedMode.value = 'wechat';
    await nextTick();
    let target = placeOrderRef.value;
    if (!target?.applyWechatImport) return { ok: false, reason: '订单录入区尚未就绪' };
    // 图片订单交给千问：autoRecognize 让服务端一次完成「识别 + 落库」，不再弹裁剪窗等人确认。
    const importPayload = { ...payload, autoRecognize: true };
    const autoSaved = await target.applyWechatImport(importPayload);
    // 千问接口本身已经落库。直接使用这次请求的返回值作为唯一成功凭证，
    // 绝不能因为界面组件在请求期间被重建，就把同一张图片再提交一次。
    if (autoSaved && autoSaved.taskId != null) {
      return {
        ok: true,
        taskId: autoSaved.taskId,
        count: Number(autoSaved.count) || 0,
        engine: 'qwen',
      };
    }
    // 文本任务只做本地解析，没有服务端落库副作用；若工作区确实发生重建，
    // 可以安全地在当前实例重新载入一次文本后再校验。
    if (placeOrderRef.value !== target && !(Array.isArray(payload?.images) && payload.images.length)) {
      target = placeOrderRef.value;
      if (!target?.applyWechatImport) return { ok: false, reason: '订单录入区尚未就绪' };
      await target.applyWechatImport(payload);
    }
    // 千问链路已在服务端落库，直接采纳结果，避免再走一次 pasteSearchGoods 造成重复订单。
    if (target.wechatQwenAutoSaved) {
      const qwenSaved = target.wechatQwenAutoSaved;
      target.wechatQwenAutoSaved = null;
      return { ok: true, taskId: qwenSaved.taskId, count: qwenSaved.count, engine: 'qwen' };
    }
    if (!target.isOrderContentReady || !target.saveCurrentOrdersSilently) {
      return { ok: false, reason: '订单录入区尚未就绪' };
    }
    let ready = target.isOrderContentReady();
    // 兜底：判定为「没有商品」时，多半是解析结果没落到当前实例上，重新解析一次再判，
    // 避免把已经能解析出来的订单误报成「没有可保存的订单」。
    if (ready && !ready.ok && /未解析出可保存的商品|没有可保存的订单/.test(ready.reason || '')) {
      await target.applyWechatImport(payload);
      ready = target.isOrderContentReady();
    }
    if (!ready || !ready.ok) return { ok: false, reason: (ready && ready.reason) || '订单内容不完整' };
    const saved = await target.saveCurrentOrdersSilently();
    return saved && saved.ok
      ? { ok: true, taskId: saved.taskId, count: saved.count }
      : { ok: false, reason: (saved && saved.error) || '保存失败' };
  } catch (error) {
    return { ok: false, reason: (error && error.message) || '保存失败' };
  }
}

defineExpose({
  appendWechatImport,
  dismissPendingWechatImport,
  previewWechatImport,
  runWechatImportAndSave,
});

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
  border: 1px solid var(--product-primary-strong);
  border-radius: 6px;
  color: #fff;
  background: var(--product-primary-strong);
  font-size: 11px;
  font-weight: 900;
  box-shadow: 0 4px 10px rgba(var(--product-primary-strong-rgb), 0.16);
}

.ai-order-panel__back:hover { background: var(--product-text); }
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
    radial-gradient(circle at 50% 30%, rgba(var(--product-primary-strong-rgb), 0.07), transparent 34%),
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
  box-shadow: 0 12px 24px rgba(var(--product-primary-strong-rgb), 0.18);
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
