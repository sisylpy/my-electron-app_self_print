<template>
  <main class="settings-center" aria-label="设备与设置">
    <section class="settings-center__summary">
      <article>
        <span class="summary-icon is-printer">印</span>
        <div>
          <small>默认打印机</small>
          <strong>{{ printerName || '未选择' }}</strong>
          <p>{{ printerDetail }}</p>
        </div>
      </article>
      <article>
        <span class="summary-icon is-mcp">M</span>
        <div>
          <small>本机打印服务</small>
          <strong>{{ mcpStatus.running ? '运行中' : '未运行' }}</strong>
          <p>{{ mcpDetail }}</p>
        </div>
      </article>
      <article>
        <span class="summary-icon is-runtime">端</span>
        <div>
          <small>运行环境</small>
          <strong>{{ runtimeLabel }}</strong>
          <p>{{ platformLabel }}</p>
        </div>
      </article>
    </section>

    <section class="settings-center__grid">
      <article class="settings-card">
        <header>
          <div>
            <span>打印设备</span>
            <h2>当前打印环境</h2>
          </div>
          <button type="button" :disabled="loading" @click="loadStatus">
            {{ loading ? '读取中…' : '重新读取' }}
          </button>
        </header>
        <dl>
          <div>
            <dt>打印机</dt>
            <dd>{{ printerName || '未配置默认打印机' }}</dd>
          </div>
          <div>
            <dt>分辨率</dt>
            <dd>{{ dpiLabel }}</dd>
          </div>
          <div>
            <dt>系统纸张</dt>
            <dd>{{ paperLabel }}</dd>
          </div>
          <div>
            <dt>配置状态</dt>
            <dd :class="{ warning: printerError }">
              {{ printerError || '已读取桌面打印配置' }}
            </dd>
          </div>
        </dl>
        <p class="settings-card__note">
          本页只展示运行状态，不会改变 Epson 纸型、DPI、边距或现有打印模板。
        </p>
      </article>

      <article class="settings-card">
        <header>
          <div>
            <span>连接器授权</span>
            <h2>WorkBuddy 连接</h2>
          </div>
          <button
            type="button"
            :disabled="!canIssue || issuing"
            @click="generateCredential"
          >
            {{ issuing ? '生成中…' : '生成连接器凭证' }}
          </button>
        </header>
        <dl>
          <div>
            <dt>配送商</dt>
            <dd :title="distributerName">{{ distributerName || '—' }}</dd>
          </div>
          <div>
            <dt>操作账号</dt>
            <dd :title="accountLabel">{{ accountLabel }}</dd>
          </div>
          <div>
            <dt>授权用途</dt>
            <dd>打印投递单（print:delivery）</dd>
          </div>
        </dl>

        <p v-if="issueHint" class="settings-card__feedback">{{ issueHint }}</p>
        <p v-if="issueError" class="settings-card__feedback is-error">{{ issueError }}</p>

        <div v-if="issuedCredential" class="connector-token">
          <label>连接器凭证（仅显示一次）</label>
          <textarea
            readonly
            rows="3"
            :value="issuedCredential.accessToken"
            @focus="$event.target.select()"
          ></textarea>
          <div class="connector-token__actions">
            <button type="button" @click="copyToken">
              {{ copied ? '已复制' : '复制' }}
            </button>
            <span class="connector-token__exp">
              有效期至 {{ formatDateTime(issuedCredential.expiresAt) }}
            </span>
          </div>
          <p class="connector-token__note">
            请将上方凭证粘贴到 WorkBuddy 连接器的配置中。「凭证已生成」不代表 WorkBuddy 已连接，需在其侧完成配置与连接验证。
          </p>
        </div>

        <div class="connector-list">
          <div class="connector-list__head">
            <span>已有授权（不含明文）</span>
            <button
              type="button"
              :disabled="!runtimeAvailable || loadingCredentials"
              @click="loadCredentials"
            >
              {{ loadingCredentials ? '刷新中…' : '刷新' }}
            </button>
          </div>
          <ul v-if="credentials.length">
            <li v-for="c in credentials" :key="c.credentialId">
              <span class="connector-list__scope">{{ c.scope }}</span>
              <span>签发 {{ formatDateTime(c.createdAt) }}</span>
              <span :class="{ 'is-revoked': c.revokedAt }">
                {{ c.revokedAt ? '已撤销' : '有效至 ' + formatDateTime(c.expiresAt) }}
              </span>
            </li>
          </ul>
          <p v-else class="connector-list__empty">暂无授权记录</p>
          <p v-if="revokeError" class="settings-card__feedback is-error">{{ revokeError }}</p>
          <button
            type="button"
            class="connector-revoke"
            :disabled="!canIssue || revoking || credentials.length === 0"
            @click="showRevokeConfirm = true"
          >撤销全部本人授权</button>
        </div>

        <p v-if="showRevokeConfirm" class="connector-confirm">
          撤销后，所有使用该账号授权的 WorkBuddy 连接器将无法继续访问数据。确定撤销吗？
          <span class="connector-confirm__actions">
            <button type="button" :disabled="revoking" @click="confirmRevokeAll">确定撤销</button>
            <button type="button" @click="showRevokeConfirm = false">取消</button>
          </span>
        </p>

        <p class="settings-card__note">
          凭证由当前登录身份签发，归属以服务端为准；不自动修改 WorkBuddy 配置，请手动复制到连接器。
        </p>
      </article>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useStore } from 'vuex';

const loading = ref(false);
const printerName = ref('');
const printerConfig = ref(null);
const printerError = ref('');
const mcpStatus = reactive({
  running: false,
});

const runtimeAvailable = computed(() => Boolean(window.electronAPI));
const runtimeLabel = computed(() => (runtimeAvailable.value ? 'Electron 桌面端' : '浏览器预览'));
const platformLabel = computed(() => navigator.userAgentData?.platform || navigator.platform || '未知平台');
const dpiLabel = computed(() => {
  const hDpi = printerConfig.value?.hDpi;
  const vDpi = printerConfig.value?.vDpi;
  return hDpi && vDpi ? `${hDpi} × ${vDpi} DPI` : '由打印驱动决定';
});
const paperLabel = computed(() => {
  const width = printerConfig.value?.widthMm;
  const height = printerConfig.value?.heightMm;
  return width && height ? `${width} × ${height} mm` : '由打印驱动决定';
});
const printerDetail = computed(() => (
  printerConfig.value
    ? `${dpiLabel.value} · ${paperLabel.value}`
    : (runtimeAvailable.value ? '等待读取系统配置' : '启动桌面客户端后显示')
));
const mcpDetail = computed(() => (
  runtimeAvailable.value
    ? (mcpStatus.running ? '已启用本机鉴权保护' : '打印主流程不受影响')
    : '启动桌面客户端后显示'
));
async function loadStatus() {
  const api = window.electronAPI;
  if (!api) {
    printerError.value = '当前为浏览器预览';
    return;
  }

  loading.value = true;
  const requests = await Promise.allSettled([
    api.getDefaultPrinter?.(),
    api.getPrinterSystemConfig?.(),
    api.getMcpStatus?.(),
  ]);

  const defaultPrinter = requests[0];
  if (defaultPrinter.status === 'fulfilled' && defaultPrinter.value?.success) {
    printerName.value = defaultPrinter.value.printerName || '';
  }

  const systemConfig = requests[1];
  if (systemConfig.status === 'fulfilled' && systemConfig.value?.success) {
    printerConfig.value = systemConfig.value.config || null;
    printerError.value = '';
    printerName.value ||= systemConfig.value.config?.name || '';
  } else {
    printerConfig.value = null;
    printerError.value = systemConfig.status === 'rejected'
      ? systemConfig.reason?.message || '系统配置读取失败'
      : systemConfig.value?.error || '未读取到系统配置';
  }

  const mcp = requests[2];
  if (mcp.status === 'fulfilled' && mcp.value) {
    mcpStatus.running = Boolean(mcp.value.running);
  }

  loading.value = false;
}

// ---- WorkBuddy 连接器凭证 ----
const store = useStore();
const currentDisId = computed(() => store.state.disUser?.nxDiuDistributerId ?? null);
const currentUserId = computed(() => store.state.disUser?.nxDistributerUserId ?? null);
const distributerName = computed(
  () => store.state.disUser?.nxDistributerEntity?.nxDistributerName || ''
);
const accountLabel = computed(() => {
  const id = currentUserId.value;
  return id != null ? `账号 ${id}` : '—';
});

// 主进程持有的 dispatch 会话摘要；token 不进入渲染进程。
const dispatchSession = reactive({ authenticated: false, userId: null, disId: null, loading: true });

// 仅当主进程会话严格匹配当前登录身份时允许生成：
// 必须同时校验 disId 与 userId，避免借用上一个账号残留的主进程会话。
const canIssue = computed(() => {
  if (!runtimeAvailable.value || dispatchSession.loading || !dispatchSession.authenticated) return false;
  const disId = currentDisId.value;
  const userId = currentUserId.value;
  if (disId == null || userId == null) return false;
  return String(dispatchSession.disId) === String(disId)
    && String(dispatchSession.userId) === String(userId);
});

const issueHint = computed(() => {
  if (!runtimeAvailable.value) return '请在桌面客户端中打开本页完成授权';
  if (dispatchSession.loading) return '正在校验桌面登录会话…';
  if (!dispatchSession.authenticated) return '桌面登录会话已失效，请重新登录桌面端后再生成凭证';
  if (!canIssue.value) return '当前登录账号暂不支持生成连接器凭证，请以配送商管理员身份登录后重试';
  return '';
});

const issuing = ref(false);
const issueError = ref('');
const issuedCredential = ref(null);
const copied = ref(false);

async function loadDispatchSession() {
  dispatchSession.loading = true;
  dispatchSession.authenticated = false;
  if (!window.electronAPI?.dispatchAuth?.getSession) {
    dispatchSession.loading = false;
    return;
  }
  try {
    const res = await window.electronAPI.dispatchAuth.getSession();
    // 网关返回 { ok, data: { authenticated, userId, disId, ... } }，会话字段在 data 里。
    const sessionData = res && res.ok === false ? {} : (res?.data ?? {});
    dispatchSession.authenticated = Boolean(sessionData.authenticated);
    dispatchSession.userId = sessionData.userId ?? null;
    dispatchSession.disId = sessionData.disId ?? null;
  } catch (error) {
    dispatchSession.authenticated = false;
  } finally {
    dispatchSession.loading = false;
  }
}

async function generateCredential() {
  if (!canIssue.value || issuing.value) return;
  issuing.value = true;
  issueError.value = '';
  copied.value = false;
  const requestDisId = currentDisId.value;
  const requestUserId = currentUserId.value;
  try {
    const res = await window.electronAPI.connectorCredential.issue({ scope: 'print:delivery' });
    // 账号已切换则丢弃本次异步结果，避免旧账号响应显示到新账号页面。
    if (String(currentDisId.value) !== String(requestDisId)
        || String(currentUserId.value) !== String(requestUserId)) {
      return;
    }
    if (!res?.ok) {
      issueError.value = res?.message || '凭证生成失败';
      return;
    }
    issuedCredential.value = res.data;
    await loadCredentials();
  } catch (error) {
    issueError.value = error?.message || '凭证生成失败';
  } finally {
    issuing.value = false;
  }
}

async function copyToken() {
  if (!issuedCredential.value?.accessToken) return;
  try {
    await navigator.clipboard.writeText(issuedCredential.value.accessToken);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch (error) {
    issueError.value = '复制失败，请手动选择文本复制';
  }
}

const credentials = ref([]);
const loadingCredentials = ref(false);

async function loadCredentials() {
  if (!runtimeAvailable.value || !window.electronAPI?.connectorCredential?.list) return;
  loadingCredentials.value = true;
  try {
    const res = await window.electronAPI.connectorCredential.list();
    if (res?.ok && Array.isArray(res.data)) {
      credentials.value = res.data;
    }
  } catch (error) {
    // 列表读取失败不影响页面其它部分；保留上次结果。
  } finally {
    loadingCredentials.value = false;
  }
}

const revoking = ref(false);
const revokeError = ref('');
const showRevokeConfirm = ref(false);

async function confirmRevokeAll() {
  if (!canIssue.value || revoking.value) return;
  revoking.value = true;
  revokeError.value = '';
  showRevokeConfirm.value = false;
  try {
    const res = await window.electronAPI.connectorCredential.revokeAll();
    if (!res?.ok) {
      revokeError.value = res?.message || '撤销失败';
      return;
    }
    issuedCredential.value = null;
    await loadCredentials();
  } catch (error) {
    revokeError.value = error?.message || '撤销失败';
  } finally {
    revoking.value = false;
  }
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

// 账号切换或退出：清除凭证明文与旧账号授权信息，并重新校验会话与列表。
watch(
  () => [currentDisId.value, currentUserId.value],
  () => {
    issuedCredential.value = null;
    credentials.value = [];
    issueError.value = '';
    revokeError.value = '';
    showRevokeConfirm.value = false;
    loadDispatchSession();
    loadCredentials();
  }
);

onMounted(() => {
  loadStatus();
  loadDispatchSession();
  loadCredentials();
});

onUnmounted(() => {
  issuedCredential.value = null;
  credentials.value = [];
});

</script>

<style scoped>
.settings-center {
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
  padding: 18px;
  color: var(--product-text);
}

.settings-center__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.settings-center__summary article {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
  padding: 15px;
  border: 1px solid var(--product-border);
  border-radius: var(--product-radius-md);
  background: rgba(255, 255, 255, .96);
  box-shadow: var(--product-shadow);
}

.summary-icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  color: var(--product-primary);
  background: var(--product-primary-soft);
  font-size: 16px;
  font-weight: 900;
}

.summary-icon.is-mcp {
  color: #69519f;
  background: #f0ebfb;
}

.summary-icon.is-runtime {
  color: var(--product-blue);
  background: var(--product-blue-soft);
}

.settings-center__summary article div {
  min-width: 0;
}

.settings-center__summary small,
.settings-center__summary strong,
.settings-center__summary p {
  display: block;
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-center__summary small {
  color: var(--product-text-muted);
  font-size: 12px;
}

.settings-center__summary strong {
  margin-top: 4px;
  font-size: 16px;
}

.settings-center__summary p {
  margin-top: 4px;
  color: var(--product-text-secondary);
  font-size: 12px;
}

.settings-center__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.settings-card {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--product-border);
  border-radius: var(--product-radius-lg);
  background: var(--product-surface);
  box-shadow: var(--product-shadow);
}

.settings-card header {
  display: flex;
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--product-border);
  background: var(--product-surface-soft);
}

.settings-card header span {
  color: var(--product-primary);
  font-size: 12px;
  font-weight: 900;
}

.settings-card h2 {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 900;
}

.settings-card button {
  flex: none;
  padding: 7px 11px;
  border: 1px solid var(--product-border-strong);
  border-radius: var(--product-radius-sm);
  color: var(--product-text-secondary);
  background: #fff;
  font-size: 13px;
  font-weight: 800;
}

.settings-card button:disabled {
  cursor: not-allowed;
  opacity: .5;
}

.settings-card dl {
  margin: 0;
  padding: 5px 16px;
}

.settings-card dl > div {
  display: grid;
  min-height: 58px;
  grid-template-columns: 110px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  border-bottom: 1px solid #edf1f5;
}

.settings-card dl > div:last-child {
  border-bottom: 0;
}

.settings-card dt {
  color: var(--product-text-muted);
  font-size: 13px;
  font-weight: 700;
}

.settings-card dd {
  overflow: hidden;
  margin: 0;
  color: var(--product-text);
  font-size: 14px;
  font-weight: 800;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-card dd.success {
  color: var(--product-primary);
}

.settings-card dd.warning {
  color: var(--product-warning);
}

.settings-card__note,
.settings-card__feedback {
  margin: 0;
  padding: 12px 16px;
  border-top: 1px solid var(--product-border);
  color: var(--product-text-secondary);
  background: var(--product-surface-soft);
  font-size: 12px;
  line-height: 1.6;
}

.settings-card__feedback {
  color: var(--product-primary);
}

@media (max-width: 1280px) {
  .settings-center__grid {
    grid-template-columns: 1fr;
  }
}

.settings-card__feedback.is-error {
  color: #d9363e;
}

.connector-token {
  padding: 12px 16px 4px;
  border-top: 1px solid var(--product-border);
}

.connector-token label {
  display: block;
  margin-bottom: 6px;
  color: var(--product-text-muted);
  font-size: 13px;
  font-weight: 700;
}

.connector-token textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--product-border-strong);
  border-radius: var(--product-radius-sm);
  color: var(--product-text);
  background: #fff;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  word-break: break-all;
}

.connector-token__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.connector-token__actions button {
  flex: none;
  padding: 6px 12px;
  border: 1px solid var(--product-border-strong);
  border-radius: var(--product-radius-sm);
  color: var(--product-primary);
  background: #fff;
  font-size: 13px;
  font-weight: 800;
}

.connector-token__exp {
  color: var(--product-text-secondary);
  font-size: 12px;
}

.connector-token__note {
  margin: 8px 0 0;
  color: var(--product-text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.connector-list {
  padding: 12px 16px;
  border-top: 1px solid var(--product-border);
}

.connector-list__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: var(--product-text-muted);
  font-size: 13px;
  font-weight: 700;
}

.connector-list__head button {
  flex: none;
  padding: 5px 10px;
  border: 1px solid var(--product-border-strong);
  border-radius: var(--product-radius-sm);
  color: var(--product-text-secondary);
  background: #fff;
  font-size: 13px;
  font-weight: 800;
}

.connector-list ul {
  margin: 0 0 10px;
  padding: 0;
  list-style: none;
}

.connector-list li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
  min-height: 44px;
  padding: 6px 0;
  border-bottom: 1px solid #edf1f5;
  color: var(--product-text);
  font-size: 13px;
  font-weight: 700;
}

.connector-list li span:not(.connector-list__scope) {
  color: var(--product-text-secondary);
  font-weight: 600;
  text-align: right;
}

.connector-list li .is-revoked {
  color: var(--product-text-muted);
}

.connector-list__empty {
  margin: 0 0 10px;
  color: var(--product-text-muted);
  font-size: 12px;
}

.connector-revoke {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #f0c2c2;
  border-radius: var(--product-radius-sm);
  color: #d9363e;
  background: #fff;
  font-size: 13px;
  font-weight: 800;
}

.connector-revoke:disabled {
  cursor: not-allowed;
  opacity: .5;
}

.connector-confirm {
  margin: 0;
  padding: 12px 16px;
  border-top: 1px solid var(--product-border);
  color: var(--product-text);
  background: var(--product-surface-soft);
  font-size: 13px;
  line-height: 1.7;
}

.connector-confirm__actions {
  display: inline-flex;
  gap: 8px;
  margin-top: 8px;
}

.connector-confirm__actions button {
  padding: 5px 10px;
  border: 1px solid var(--product-border-strong);
  border-radius: var(--product-radius-sm);
  background: #fff;
  font-size: 13px;
  font-weight: 800;
}

.connector-confirm__actions button:first-child {
  color: #fff;
  border-color: #d9363e;
  background: #d9363e;
}
</style>
