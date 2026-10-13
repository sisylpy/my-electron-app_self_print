<template>
  <div class="product-shell">
    <ProductSidebar :network-online="networkOnline" />
    <section class="product-shell__main" :class="{ 'has-header': isOrderWorkbench }">
      <ProductWorkspace class="product-shell__workspace">
        <slot />
      </ProductWorkspace>
      <ProductHeader
        v-if="isOrderWorkbench"
        class="product-shell__header"
        :network-online="networkOnline"
        :printer-name="printerName"
        :mcp-running="mcpRunning"
        :runtime-available="runtimeAvailable"
      />
      <PrintJobStatus />
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import ProductHeader from './ProductHeader.vue';
import ProductSidebar from './ProductSidebar.vue';
import ProductWorkspace from './ProductWorkspace.vue';
import PrintJobStatus from '@/modules/print/components/PrintJobStatus.vue';

const networkOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
const printerName = ref('');
const mcpRunning = ref(false);
const runtimeAvailable = ref(false);
const route = useRoute();
const isOrderWorkbench = computed(() => route.name === 'OrderWorkbenchV2');

function updateOnlineStatus() {
  networkOnline.value = navigator.onLine;
}

async function loadRuntimeSummary() {
  const api = window.electronAPI;
  runtimeAvailable.value = Boolean(api);
  if (!api) return;
  const [printerResult, mcpResult] = await Promise.allSettled([
    api.getDefaultPrinter?.(),
    api.getMcpStatus?.(),
  ]);
  if (printerResult.status === 'fulfilled' && printerResult.value?.success) {
    printerName.value = printerResult.value.printerName || '';
  }
  if (mcpResult.status === 'fulfilled') {
    mcpRunning.value = Boolean(mcpResult.value?.running);
  }
}

onMounted(() => {
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  window.addEventListener('focus', loadRuntimeSummary);
  loadRuntimeSummary();
});

onBeforeUnmount(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
  window.removeEventListener('focus', loadRuntimeSummary);
});
</script>

<style scoped>
.product-shell {
  --product-sidebar-width: 104px;
  display: grid;
  width: 100vw;
  height: 100vh;
  min-width: 1180px;
  grid-template-columns: var(--product-sidebar-width) minmax(0, 1fr);
  overflow: hidden;
  color: var(--product-text);
  background: var(--product-bg);
}

/*
 * Windows 常见的 125%/150% 缩放会显著压缩可用 CSS 高度。
 * 侧栏在正常高度下把入口均匀铺满；窗口被 DevTools 或系统缩放压低时，
 * 菜单项保持可读的最小高度并在侧栏内部滚动，避免图标和文字互相覆盖。
 */
.product-shell :deep(.product-sidebar) {
  height: 100vh;
  overflow: hidden;
}

.product-shell :deep(.product-sidebar__navigation) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
}

.product-shell :deep(.product-sidebar__navigation section) {
  display: contents;
}

.product-shell :deep(.product-sidebar__navigation a) {
  flex: 1 0 54px;
  min-height: 54px;
  justify-content: center;
  margin: 0;
  padding-block: 4px;
}

.product-shell__main {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr);
  overflow: hidden;
}

.product-shell__main.has-header {
  grid-template-rows: var(--product-header-height) minmax(0, 1fr);
}

.product-shell__workspace {
  grid-row: 1;
}

.product-shell__main.has-header .product-shell__workspace {
  grid-row: 2;
}

.product-shell__header {
  grid-row: 1;
}
</style>
