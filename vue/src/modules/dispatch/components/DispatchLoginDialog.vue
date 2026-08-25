<template>
  <div class="dialog-backdrop" role="presentation" @mousedown.self="close">
    <section class="login-dialog" role="dialog" aria-modal="true" aria-labelledby="dispatch-login-title">
      <button class="dialog-close" type="button" aria-label="关闭" @click="close">×</button>
      <header>
        <span>安全登录</span>
        <h2 id="dispatch-login-title">手机扫码登录桌面端</h2>
        <p>请直接使用微信扫一扫，无需在小程序里再点击“电脑登录”。</p>
        <p class="login-dialog__role-note">系统自动识别账号角色：老板进入配送调度，文员进入订单工作台。</p>
      </header>

      <div class="login-dialog__qr">
        <img v-if="qrDataUrl" :src="qrDataUrl" alt="桌面端登录二维码">
        <div v-else class="login-dialog__placeholder">
          <i></i>
          <strong>{{ stateLabel }}</strong>
        </div>
      </div>

      <div class="login-dialog__state" :class="{ error: Boolean(error) }">
        <strong>{{ error || stateLabel }}</strong>
        <span v-if="expiresLabel">{{ expiresLabel }}</span>
      </div>

      <label class="login-dialog__remember">
        <input v-model="persistSession" type="checkbox" :disabled="Boolean(qrDataUrl)">
        <span>
          <strong>在本机安全保存登录</strong>
          <small>仅主进程可读取；使用操作系统安全存储加密，渲染页面不会获得 Token。</small>
        </span>
      </label>

      <footer>
        <button type="button" class="secondary" @click="close">取消</button>
        <button
          type="button"
          class="primary"
          :disabled="loading"
          @click="generate"
        >
          {{ qrDataUrl ? '重新生成二维码' : '生成二维码' }}
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useStore } from 'vuex';

const emit = defineEmits(['close', 'authenticated']);
const store = useStore();
const loading = ref(false);
const qrDataUrl = ref('');
const expiresAt = ref(null);
const error = ref('');
const persistSession = ref(true);
let pollTimer = null;

const stateLabel = computed(() => {
  if (loading.value) return '正在生成安全二维码';
  if (qrDataUrl.value) return '等待手机确认';
  return '准备生成二维码';
});

const expiresLabel = computed(() => {
  if (!expiresAt.value) return '';
  const date = new Date(expiresAt.value);
  if (Number.isNaN(date.getTime())) return '二维码将在数分钟后失效';
  return `有效期至 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
});

function stopPolling() {
  if (pollTimer) window.clearInterval(pollTimer);
  pollTimer = null;
}

async function poll() {
  const result = await store.dispatch('dispatch/pollQrLogin');
  if (result?.ok && result.data?.status === 'authenticated') {
    stopPolling();
    emit('authenticated', result.data.session);
    return;
  }
  if (!result?.ok) {
    stopPolling();
    error.value = result?.message || '扫码登录失败，请重新生成二维码';
  }
}

async function generate() {
  stopPolling();
  loading.value = true;
  error.value = '';
  qrDataUrl.value = '';
  const result = await store.dispatch('dispatch/beginQrLogin', {
    persistSession: persistSession.value,
  });
  loading.value = false;
  if (!result?.ok) {
    error.value = result?.message || '二维码生成失败';
    return;
  }
  qrDataUrl.value = result.data?.qrDataUrl || '';
  expiresAt.value = result.data?.expiresAt || null;
  pollTimer = window.setInterval(poll, 1800);
}

async function close() {
  stopPolling();
  await store.dispatch('dispatch/cancelQrLogin');
  emit('close');
}

onMounted(generate);
onBeforeUnmount(stopPolling);
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  z-index: 1000;
  display: grid;
  inset: 0;
  place-items: center;
  padding: 24px;
  background: rgba(14, 25, 40, .56);
  backdrop-filter: blur(5px);
}

.login-dialog {
  position: relative;
  width: min(460px, 92vw);
  padding: 28px;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 24px 80px rgba(9, 22, 40, .28);
}

.dialog-close {
  position: absolute;
  top: 13px;
  right: 14px;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  color: #64748a;
  background: #eef2f6;
  font-size: 22px;
  cursor: pointer;
}

header span {
  color: #23745a;
  font-size: 11px;
  font-weight: 800;
}

header h2 {
  margin: 5px 0 7px;
  color: #18283d;
  font-size: 21px;
}

header p {
  margin: 0;
  color: #6f7f93;
  font-size: 12px;
  line-height: 1.7;
}

header .login-dialog__role-note {
  margin-top: 4px;
  color: #23745a;
  font-weight: 800;
}

.login-dialog__qr {
  display: grid;
  width: 230px;
  height: 230px;
  place-items: center;
  margin: 20px auto 10px;
  overflow: hidden;
  border: 1px solid #dce5ee;
  border-radius: 16px;
  background: #f8fafc;
}

.login-dialog__qr img {
  width: 100%;
  height: 100%;
}

.login-dialog__placeholder {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 12px;
  color: #718096;
  font-size: 12px;
}

.login-dialog__placeholder i {
  width: 28px;
  height: 28px;
  border: 3px solid #d4dde7;
  border-top-color: #246b50;
  border-radius: 50%;
  animation: spin .8s linear infinite;
}

.login-dialog__state {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 3px;
  min-height: 38px;
  color: #246b50;
  font-size: 11px;
}

.login-dialog__state.error {
  color: #b23b3b;
}

.login-dialog__state span {
  color: #8995a6;
  font-size: 9px;
}

.login-dialog__remember {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-top: 13px;
  padding: 11px 12px;
  border-radius: 11px;
  background: #f5f8fb;
  cursor: pointer;
}

.login-dialog__remember input {
  margin-top: 3px;
}

.login-dialog__remember span {
  display: flex;
  flex-direction: column;
}

.login-dialog__remember strong {
  color: #33445b;
  font-size: 11px;
}

.login-dialog__remember small {
  margin-top: 3px;
  color: #8491a2;
  font-size: 9px;
  line-height: 1.5;
}

footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 20px;
}

footer button {
  padding: 9px 16px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

footer .secondary {
  border: 1px solid #d3dce6;
  color: #5f7085;
  background: #fff;
}

footer .primary {
  border: 1px solid #226c51;
  color: #fff;
  background: #226c51;
}

footer button:disabled {
  cursor: wait;
  opacity: .6;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
