<template>
  <div class="product-shell">
    <ProductSidebar :network-online="networkOnline" />
    <section class="product-shell__main">
      <ProductHeader
        :network-online="networkOnline"
        :printer-name="printerName"
        :mcp-running="mcpRunning"
        :runtime-available="runtimeAvailable"
      />
      <ProductWorkspace>
        <slot />
      </ProductWorkspace>
      <PrintJobStatus />
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import ProductHeader from './ProductHeader.vue';
import ProductSidebar from './ProductSidebar.vue';
import ProductWorkspace from './ProductWorkspace.vue';
import PrintJobStatus from '@/modules/print/components/PrintJobStatus.vue';

const networkOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
const printerName = ref('');
const mcpRunning = ref(false);
const runtimeAvailable = ref(false);

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
  display: grid;
  width: 100vw;
  height: 100vh;
  min-width: 1180px;
  grid-template-columns: var(--product-sidebar-width) minmax(0, 1fr);
  overflow: hidden;
  color: var(--product-text);
  background: var(--product-bg);
}

.product-shell__main {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: var(--product-header-height) minmax(0, 1fr);
  overflow: hidden;
}
</style>
