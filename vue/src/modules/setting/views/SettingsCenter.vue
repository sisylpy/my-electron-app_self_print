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
          <small>MCP 打印服务</small>
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
            <span>桌面服务</span>
            <h2>MCP 与应用日志</h2>
          </div>
          <button
            type="button"
            :disabled="!canOpenLogs"
            @click="openLogDirectory"
          >
            打开日志
          </button>
        </header>
        <dl>
          <div>
            <dt>MCP 状态</dt>
            <dd :class="{ success: mcpStatus.running }">
              {{ mcpStatus.running ? '本机服务运行中' : '本机服务未运行' }}
            </dd>
          </div>
          <div>
            <dt>访问保护</dt>
            <dd>{{ mcpStatus.authRequired === false ? '请检查配置' : '已启用鉴权' }}</dd>
          </div>
          <div>
            <dt>监听地址</dt>
            <dd>{{ mcpAddress }}</dd>
          </div>
          <div>
            <dt>日志目录</dt>
            <dd :title="logDirectory">{{ logDirectory || '仅桌面客户端可用' }}</dd>
          </div>
        </dl>
        <p v-if="feedback" class="settings-card__feedback">{{ feedback }}</p>
      </article>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';

const loading = ref(false);
const printerName = ref('');
const printerConfig = ref(null);
const printerError = ref('');
const logDirectory = ref('');
const feedback = ref('');
const mcpStatus = reactive({
  running: false,
  authRequired: true,
  host: '',
  port: '',
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
const mcpAddress = computed(() => {
  if (!runtimeAvailable.value) return '仅桌面客户端可用';
  if (!mcpStatus.host && !mcpStatus.port) return '未读取';
  return `${mcpStatus.host || '127.0.0.1'}:${mcpStatus.port || '-'}`;
});
const canOpenLogs = computed(() => (
  runtimeAvailable.value
  && typeof window.electronAPI?.openAppLogDirectory === 'function'
));

async function loadStatus() {
  const api = window.electronAPI;
  if (!api) {
    printerError.value = '当前为浏览器预览';
    return;
  }

  loading.value = true;
  feedback.value = '';
  const requests = await Promise.allSettled([
    api.getDefaultPrinter?.(),
    api.getPrinterSystemConfig?.(),
    api.getMcpStatus?.(),
    api.getAppLogDirectory?.(),
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
    Object.assign(mcpStatus, {
      running: Boolean(mcp.value.running),
      authRequired: mcp.value.authRequired !== false,
      host: mcp.value.host || '',
      port: mcp.value.port || '',
    });
  }

  const log = requests[3];
  if (log.status === 'fulfilled' && typeof log.value === 'string') {
    logDirectory.value = log.value;
  }
  loading.value = false;
}

async function openLogDirectory() {
  if (!canOpenLogs.value) return;
  try {
    const result = await window.electronAPI.openAppLogDirectory();
    feedback.value = result?.success === false
      ? result.error || '日志目录打开失败'
      : '日志目录已打开';
  } catch (error) {
    feedback.value = error?.message || '日志目录打开失败';
  }
}

onMounted(loadStatus);
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
  font-size: 13px;
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
  font-size: 9px;
}

.settings-center__summary strong {
  margin-top: 3px;
  font-size: 13px;
}

.settings-center__summary p {
  margin-top: 3px;
  color: var(--product-text-secondary);
  font-size: 9px;
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
  font-size: 9px;
  font-weight: 900;
}

.settings-card h2 {
  margin: 4px 0 0;
  font-size: 15px;
  font-weight: 900;
}

.settings-card button {
  flex: none;
  padding: 7px 11px;
  border: 1px solid var(--product-border-strong);
  border-radius: var(--product-radius-sm);
  color: var(--product-text-secondary);
  background: #fff;
  font-size: 10px;
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
  min-height: 52px;
  grid-template-columns: 95px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  border-bottom: 1px solid #edf1f5;
}

.settings-card dl > div:last-child {
  border-bottom: 0;
}

.settings-card dt {
  color: var(--product-text-muted);
  font-size: 10px;
  font-weight: 700;
}

.settings-card dd {
  overflow: hidden;
  margin: 0;
  color: var(--product-text);
  font-size: 11px;
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
  font-size: 9px;
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
</style>
