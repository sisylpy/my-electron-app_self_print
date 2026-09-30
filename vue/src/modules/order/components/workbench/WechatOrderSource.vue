<template>
  <section class="wechat-order-source">
    <div class="wechat-order-source__title">
      <div>
        <strong>微信好友订单</strong>
        <span>客户：{{ customerName || customerId }}</span>
      </div>
      <button v-if="binding?.bound" type="button" class="link-button" :disabled="busy" @click="clearBinding">
        更换好友
      </button>
    </div>

    <div v-if="loadingBinding" class="wechat-order-source__message">正在读取客户绑定…</div>

    <template v-else-if="binding?.bound">
      <div class="wechat-order-source__bound">
        <div>
          <span class="wechat-order-source__label">已绑定好友</span>
          <strong>{{ binding.displayName }}</strong>
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
          placeholder="输入该客户对应的微信好友昵称"
          @keyup.enter="searchFriend"
        >
        <button type="button" class="primary-button" :disabled="busy || !searchName" @click="searchFriend">
          {{ busy ? '正在搜索…' : '搜索好友' }}
        </button>
      </div>
      <div v-if="matches.length" class="wechat-order-source__matches">
        <button
          v-for="match in matches"
          :key="match.id"
          type="button"
          :disabled="busy"
          @click="bindFriend(match)"
        >
          <strong>{{ match.displayName }}</strong>
          <span>好友 · 最近活跃 {{ formatTime(match.lastMessageAt) }}</span>
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

const cursorText = computed(() => {
  if (!binding.value?.cursorTimeMs) return '尚未生成过微信订单，首次默认读取最近 24 小时';
  return `上次订单消息：${new Date(binding.value.cursorTimeMs).toLocaleString()}`;
});

watch(() => props.customerId, () => loadBinding());
onMounted(() => loadBinding());

function setStatus(message, type = 'info') {
  statusMessage.value = message;
  statusType.value = type;
}

function unwrapReader(response) {
  if (response?.ok) return response.result;
  throw new Error(response?.error?.message || '读取本地微信数据失败');
}

function unwrapServer(response) {
  if (response?.ok) return response.data;
  throw new Error(response?.message || '服务器请求失败');
}

function normalizeBinding(data) {
  return {
    ...(data || {}),
    bound: Number(data?.enabled) === 1
      && Boolean(data?.accountFingerprint)
      && Boolean(data?.conversationFingerprint),
  };
}

async function loadBinding() {
  loadingBinding.value = true;
  searchName.value = '';
  matches.value = [];
  setStatus('');
  try {
    const api = window.electronAPI?.customerWechatOrders;
    if (!api?.loadBinding) throw new Error('当前安装包不支持微信好友订单');
    const loaded = normalizeBinding(unwrapServer(await api.loadBinding(Number(props.customerId))));
    binding.value = loaded;
    if (!loaded.bound && loaded.displayName) searchName.value = loaded.displayName;
  } catch (error) {
    binding.value = normalizeBinding(null);
    setStatus(error.message, 'error');
  } finally {
    loadingBinding.value = false;
  }
}

async function activeAccount() {
  const accounts = unwrapReader(await window.electronAPI?.wechatReader?.listAccounts?.());
  const candidates = Array.isArray(accounts) ? accounts : [];
  const account = candidates.find((item) => item.isCurrentLogin && item.hasAccessMaterial)
    || candidates.find((item) => item.hasAccessMaterial);
  if (!account) throw new Error('当前微信账号的本地数据访问材料未就绪');
  return account;
}

async function searchFriend() {
  if (!searchName.value || busy.value) return;
  busy.value = true;
  matches.value = [];
  setStatus('');
  try {
    const account = await activeAccount();
    const found = unwrapReader(await window.electronAPI.wechatReader.findConversation(account.id, searchName.value));
    matches.value = (Array.isArray(found?.matches) ? found.matches : [])
      .filter((item) => item.kind === 'direct');
    binding.value = { ...normalizeBinding(binding.value), pendingAccountFingerprint: account.id };
    if (!matches.value.length) setStatus('没有找到同名微信好友，请确认昵称后重试', 'warning');
    else if (matches.value.length > 1) setStatus('找到多个同名好友，请按最近活跃时间选择', 'warning');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    busy.value = false;
  }
}

async function bindFriend(friend) {
  if (busy.value) return;
  busy.value = true;
  setStatus('');
  try {
    const accountFingerprint = binding.value?.pendingAccountFingerprint;
    if (!accountFingerprint) throw new Error('微信账号状态已变化，请重新搜索');
    const saved = unwrapServer(await window.electronAPI.customerWechatOrders.saveBinding({
      customerId: Number(props.customerId),
      displayName: friend.displayName,
      accountFingerprint,
      conversationFingerprint: friend.id,
    }));
    binding.value = normalizeBinding(saved);
    matches.value = [];
    setStatus(`已把 ${friend.displayName} 绑定到当前客户`, 'success');
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
    const cleared = unwrapServer(
      await window.electronAPI.customerWechatOrders.clearBinding(Number(props.customerId))
    );
    binding.value = normalizeBinding(cleared);
    searchName.value = '';
    matches.value = [];
    setStatus('已解除绑定，可以重新选择微信好友', 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    busy.value = false;
  }
}

async function pullMessages() {
  if (busy.value) return;
  busy.value = true;
  setStatus('');
  try {
    const reader = window.electronAPI?.wechatReader;
    const participants = unwrapReader(
      await reader.getParticipants(binding.value.conversationFingerprint)
    );
    const selfIds = new Set(
      (Array.isArray(participants) ? participants : [])
        .filter((item) => item.isSelf)
        .map((item) => item.id)
    );
    if (!selfIds.size) throw new Error('无法识别当前微信账号，请先确认 Reader 数据状态');

    const now = Date.now();
    const cursor = Number(binding.value.cursorTimeMs);
    const startMs = Number.isFinite(cursor) && cursor > 0
      ? Math.max(0, cursor - 2 * 60 * 1000)
      : now - 24 * 60 * 60 * 1000;
    const page = unwrapReader(await reader.getMessages(
      binding.value.conversationFingerprint,
      { start: new Date(startMs).toISOString(), end: new Date(now).toISOString() },
      { offset: 0, limit: 200 }
    ));

    const incoming = (Array.isArray(page?.items) ? page.items : [])
      .filter((message) => message?.type === 'text')
      .filter((message) => typeof message.text === 'string' && message.text.trim())
      .filter((message) => !selfIds.has(message.senderId))
      .map((message) => ({
        ...message,
        messageTimeMs: Date.parse(message.timestamp),
      }))
      .filter((message) => Number.isFinite(message.messageTimeMs))
      .sort((left, right) => left.messageTimeMs - right.messageTimeMs || left.id.localeCompare(right.id));

    if (!incoming.length) {
      setStatus('所选时间范围内没有新的好友文字消息', 'info');
      return;
    }

    const refs = incoming.map((message) => ({
      messageFingerprint: message.id,
      messageTimeMs: message.messageTimeMs,
    }));
    const prepared = unwrapServer(
      await window.electronAPI.customerWechatOrders.prepareMessages(Number(props.customerId), refs)
    );
    const pendingIds = new Set(prepared?.pendingMessageFingerprints || []);
    const pending = incoming.filter((message) => pendingIds.has(message.id));
    binding.value = normalizeBinding(prepared?.binding || binding.value);
    if (!pending.length) {
      setStatus('读取到的消息都已经生成过订单，没有重复导入', 'success');
      return;
    }

    emit('messages-loaded', {
      text: pending.map((message) => message.text.trim()).join('\n'),
      source: {
        customerId: Number(props.customerId),
        accountFingerprint: binding.value.accountFingerprint,
        conversationFingerprint: binding.value.conversationFingerprint,
        messages: pending.map((message) => ({
          messageFingerprint: message.id,
          messageTimeMs: message.messageTimeMs,
        })),
      },
    });
    const skipped = incoming.length - pending.length;
    setStatus(`已载入 ${pending.length} 条新消息${skipped ? `，跳过 ${skipped} 条已处理消息` : ''}`, 'success');
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    busy.value = false;
  }
}

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
  border: 1px solid #b9dacb;
  border-radius: 8px;
  background: #f6fcf8;
  color: #183f30;
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
.wechat-order-source__bound small { color: #64766e; font-size: 12px; }
.wechat-order-source__label { color: #64766e; font-size: 11px; }
.wechat-order-source__message { padding: 10px 0 2px; color: #64766e; }
.wechat-order-source__bound { margin-top: 10px; }
.wechat-order-source__bind-row { margin-top: 10px; justify-content: flex-start; }
.wechat-order-source__bind-row input {
  width: min(420px, 70%);
  height: 38px;
  padding: 0 12px;
  border: 1px solid #aac7ba;
  border-radius: 6px;
  background: #fff;
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
  background: #178454;
  font-weight: 700;
}
.link-button { color: #16744c; background: transparent; }
button:disabled { cursor: not-allowed; opacity: .55; }
.wechat-order-source__matches { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.wechat-order-source__matches button {
  display: grid;
  min-width: 210px;
  gap: 3px;
  padding: 9px 11px;
  border: 1px solid #b9dacb;
  border-radius: 6px;
  text-align: left;
  background: #fff;
}
.wechat-order-source__matches span { color: #64766e; font-size: 11px; }
.wechat-order-source__status { margin: 9px 0 0; font-size: 12px; }
.wechat-order-source__status.error { color: #bd2c2c; }
.wechat-order-source__status.warning { color: #9a6300; }
.wechat-order-source__status.success { color: #16744c; }
</style>
