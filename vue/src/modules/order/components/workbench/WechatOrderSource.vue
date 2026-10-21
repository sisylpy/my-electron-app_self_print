<template>
  <section class="wechat-order-source">
    <div class="wechat-order-source__title">
      <div>
        <strong>微信聊天订单</strong>
        <span>客户：{{ customerName || customerId }}</span>
      </div>
      <button v-if="binding?.bound" type="button" class="link-button" :disabled="busy" @click="clearBinding">
        更换微信聊天
      </button>
    </div>

    <div v-if="loadingBinding" class="wechat-order-source__message">正在读取客户绑定…</div>

    <template v-else-if="binding?.bound">
      <div class="wechat-order-source__bound">
        <div>
          <span class="wechat-order-source__label">{{ boundTypeLabel }}</span>
          <strong>{{ binding.displayName }}</strong>
          <small v-if="binding.conversationKind === CONVERSATION_GROUP">{{ groupModeLabel }}</small>
          <small>{{ cursorText }}</small>
        </div>
        <button type="button" class="primary-button" :disabled="busy" @click="pullMessages">
          {{ busy ? '正在获取…' : '获取新消息并解析' }}
        </button>
      </div>
    </template>

    <template v-else>
      <div class="wechat-order-source__bind-row">
        <input
          v-model.trim="searchName"
          type="text"
          maxlength="255"
          placeholder="输入该客户对应的微信好友或群名称"
          @keyup.enter="searchConversation"
        >
        <button type="button" class="primary-button" :disabled="busy || !searchName" @click="searchConversation">
          {{ busy ? '正在搜索…' : '搜索微信' }}
        </button>
      </div>
      <div v-if="matches.length" class="wechat-order-source__matches">
        <button
          v-for="match in matches"
          :key="match.id"
          type="button"
          :disabled="busy"
          @click="chooseConversation(match)"
        >
          <strong>{{ match.displayName }}</strong>
          <span>{{ match.kind === CONVERSATION_GROUP ? '群聊' : '好友' }} · 最近活跃 {{ formatTime(match.lastMessageAt) }}</span>
        </button>
      </div>
    </template>

    <p v-if="statusMessage" :class="['wechat-order-source__status', statusType]">
      {{ statusMessage }}
    </p>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import {
  CONVERSATION_GROUP,
  GROUP_ALL_MEMBER_MESSAGES,
} from '../../services/wechatOrderMessagePolicy';
import {
  loadCustomerWechatBinding,
  normalizeWechatBinding,
  prepareWechatOrderImport,
  unwrapWechatReader,
  unwrapWechatServer,
} from '../../services/wechatOrderImport';
import { splitWechatOrderPayloads } from '../../services/wechatOrderTaskSplit';

const props = defineProps({
  customerId: { type: [Number, String], required: true },
  customerName: { type: String, default: '' },
});

const emit = defineEmits(['messages-loaded']);
const loadingBinding = ref(true);
const busy = ref(false);
const binding = ref(null);
const searchName = ref('');
const matches = ref([]);
const statusMessage = ref('');
const statusType = ref('info');
let bindingLoadPromise = null;

const cursorText = computed(() => {
  if (!binding.value?.cursorTimeMs) return '尚未生成过微信订单，首次默认读取最近 24 小时';
  return `上次订单消息：${new Date(binding.value.cursorTimeMs).toLocaleString()}`;
});
const boundTypeLabel = computed(() => binding.value?.conversationKind === CONVERSATION_GROUP
  ? '已绑定群聊' : '已绑定好友');
const groupModeLabel = computed(() => binding.value?.groupMode === GROUP_ALL_MEMBER_MESSAGES
  ? '专属客户群 · 接收群内全部成员消息'
  : '混合业务群 · 仅接收 @ 当前账号的消息');

watch(() => props.customerId, () => { void loadBinding(); });
onMounted(() => { void loadBinding(); });

function setStatus(message, type = 'info') {
  statusMessage.value = message;
  statusType.value = type;
}

function loadBinding() {
  if (bindingLoadPromise) return bindingLoadPromise;
  bindingLoadPromise = performLoadBinding();
  return bindingLoadPromise.finally(() => {
    bindingLoadPromise = null;
  });
}

async function performLoadBinding() {
  loadingBinding.value = true;
  searchName.value = '';
  matches.value = [];
  setStatus('');
  try {
    const loaded = await loadCustomerWechatBinding(Number(props.customerId));
    binding.value = loaded;
    if (!loaded.bound && loaded.displayName) searchName.value = loaded.displayName;
  } catch (error) {
    binding.value = normalizeWechatBinding(null);
    setStatus(error.message, 'error');
  } finally {
    loadingBinding.value = false;
  }
}

async function activeAccount() {
  const accounts = unwrapWechatReader(await window.electronAPI?.wechatReader?.listAccounts?.());
  const candidates = Array.isArray(accounts) ? accounts : [];
  const account = candidates.find((item) => item.isCurrentLogin && item.hasAccessMaterial)
    || candidates.find((item) => item.hasAccessMaterial);
  if (!account) throw new Error('当前微信账号的本地数据访问材料未就绪');
  return account;
}

async function searchConversation() {
  if (!searchName.value || busy.value) return;
  busy.value = true;
  matches.value = [];
  setStatus('');
  try {
    const account = await activeAccount();
    const found = unwrapWechatReader(await window.electronAPI.wechatReader.findConversation(account.id, searchName.value));
    matches.value = (Array.isArray(found?.matches) ? found.matches : [])
      .filter((item) => item.kind === 'direct' || item.kind === CONVERSATION_GROUP);
    binding.value = { ...normalizeWechatBinding(binding.value), pendingAccountFingerprint: account.id };
    if (!matches.value.length) setStatus('没有找到同名微信好友或群聊，请确认名称后重试', 'warning');
    else if (matches.value.length > 1) setStatus('找到多个同名微信聊天，请按类型和最近活跃时间选择', 'warning');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    busy.value = false;
  }
}

function chooseConversation(conversation) {
  if (binding.value?.profileConfigured !== true) {
    setStatus('请先在客户中心设置该微信名称是好友还是微信群', 'warning');
    return;
  }
  if (binding.value.conversationKind !== conversation.kind) {
    setStatus(`客户资料设置为${binding.value.conversationKind === CONVERSATION_GROUP ? '微信群' : '微信好友'}，与所选微信会话类型不一致`, 'warning');
    return;
  }
  void bindConversation(
    conversation,
    conversation.kind === CONVERSATION_GROUP ? binding.value.groupMode : null,
  );
}

async function bindConversation(conversation, groupMode) {
  if (busy.value) return;
  busy.value = true;
  setStatus('');
  try {
    const accountFingerprint = binding.value?.pendingAccountFingerprint;
    if (!accountFingerprint) throw new Error('微信账号状态已变化，请重新搜索');
    const saved = unwrapWechatServer(await window.electronAPI.customerWechatOrders.saveBinding({
      customerId: Number(props.customerId),
      displayName: conversation.displayName,
      accountFingerprint,
      conversationFingerprint: conversation.id,
      conversationKind: conversation.kind,
      groupMode,
    }));
    binding.value = normalizeWechatBinding(saved);
    matches.value = [];
    setStatus(`已把 ${conversation.displayName} 绑定到当前客户`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    busy.value = false;
  }
}

async function clearBinding() {
  if (busy.value || !window.confirm(`确定解除“${binding.value.displayName}”与当前客户的绑定吗？`)) return;
  busy.value = true;
  setStatus('');
  try {
    const cleared = unwrapWechatServer(
      await window.electronAPI.customerWechatOrders.clearBinding(Number(props.customerId))
    );
    binding.value = normalizeWechatBinding({
      ...cleared,
      conversationKind: binding.value.conversationKind,
      groupMode: binding.value.groupMode,
      profileConfigured: binding.value.profileConfigured,
    });
    searchName.value = '';
    matches.value = [];
    setStatus('已解除绑定，可以重新选择微信好友或群聊', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    busy.value = false;
  }
}

async function pullMessages() {
  if (busy.value) return;
  if (bindingLoadPromise) await bindingLoadPromise;
  if (!binding.value?.bound) {
    if (statusType.value !== 'error') {
      setStatus('当前客户尚未绑定微信好友或群聊，请先完成绑定', 'warning');
    }
    return false;
  }
  busy.value = true;
  setStatus('');
  try {
    const prepared = await prepareWechatOrderImport({
      customerId: Number(props.customerId),
      binding: binding.value,
    });
    binding.value = prepared.binding;
    setStatus(prepared.message, ['ready', 'duplicate'].includes(prepared.status) ? 'success' : 'info');
    if (!prepared.payload) return false;
    const tasks = splitWechatOrderPayloads(prepared.payload);
    emit('messages-loaded', {
      tasks: tasks.length ? tasks : [prepared.payload],
      binding: prepared.binding,
      conversationTitle: prepared.binding?.displayName || binding.value?.displayName || '',
      pendingCount: prepared.pendingCount,
    });
    return true;
  } catch (error) {
    setStatus(error.message, 'error');
    return false;
  } finally {
    busy.value = false;
  }
}

defineExpose({ pullMessages });

function formatTime(value) {
  if (!value) return '未知';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : '未知';
}
</script>

<style scoped>
.wechat-order-source {
  flex: none;
  margin-bottom: 10px;
  padding: 12px 14px;
  border: 1px solid var(--product-primary-soft);
  border-radius: 8px;
  background: var(--product-primary-soft);
  color: var(--product-text);
}

.wechat-order-source__title,
.wechat-order-source__bound,
.wechat-order-source__bind-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.wechat-order-source__title > div,
.wechat-order-source__bound > div { display: grid; gap: 3px; }
.wechat-order-source__title span,
.wechat-order-source__bound small { color: var(--product-text-muted); font-size: 12px; }
.wechat-order-source__label { color: var(--product-text-muted); font-size: 11px; }
.wechat-order-source__message { padding: 10px 0 2px; color: var(--product-text-muted); }
.wechat-order-source__bound { margin-top: 10px; }
.wechat-order-source__bind-row { margin-top: 10px; justify-content: flex-start; }
.wechat-order-source__bind-row input {
  width: min(420px, 70%);
  height: 38px;
  padding: 0 12px;
  border: 1px solid var(--product-primary);
  border-radius: 6px;
  background: var(--product-surface);
}

.primary-button,
.link-button,
.wechat-order-source__matches button {
  border: 0;
  cursor: pointer;
}
.primary-button {
  height: 38px;
  padding: 0 16px;
  border-radius: 6px;
  color: #fff;
  background: var(--product-primary-strong);
  font-weight: 700;
}
.link-button { color: var(--product-primary-strong); background: transparent; }
button:disabled { cursor: not-allowed; opacity: .55; }
.wechat-order-source__matches { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.wechat-order-source__matches button {
  display: grid;
  min-width: 210px;
  gap: 3px;
  padding: 9px 11px;
  border: 1px solid var(--product-primary-soft);
  border-radius: 6px;
  text-align: left;
  background: var(--product-surface);
}
.wechat-order-source__matches span { color: var(--product-text-muted); font-size: 11px; }
.wechat-order-source__group-mode { margin-top: 10px; padding: 11px; border: 1px solid var(--product-warning); border-radius: 7px; background: var(--product-warning-soft); }
.wechat-order-source__group-mode > p { margin: 5px 0 9px; color: var(--product-warning); font-size: 12px; }
.wechat-order-source__group-mode > div { display: flex; flex-wrap: wrap; gap: 8px; }
.wechat-order-source__group-mode button { display: grid; gap: 3px; min-width: 240px; padding: 9px 11px; border: 1px solid var(--product-warning); border-radius: 6px; background: var(--product-surface); text-align: left; color: var(--product-text); cursor: pointer; }
.wechat-order-source__group-mode button span { color: var(--product-warning); font-size: 11px; }
.wechat-order-source__status { margin: 9px 0 0; font-size: 12px; }
.wechat-order-source__status.error { color: var(--product-danger); }
.wechat-order-source__status.warning { color: var(--product-warning); }
.wechat-order-source__status.success { color: var(--product-primary-strong); }
</style>
