<template>
  <section v-if="checking" class="dispatch-map-loader" aria-label="正在读取华为地图配置">
    <span></span>
    <strong>正在打开 Huawei 地图</strong>
  </section>

  <HuaweiJsDispatchMap
    v-else-if="useJavascriptMap"
    v-bind="$attrs"
    :map-overview="mapOverview"
    :selected-stop="selectedStop"
    :selected-driver-user-id="selectedDriverUserId"
    :sdk-config="sdkConfig"
    @select-marker="$emit('select-marker', $event)"
    @select-line="$emit('select-line', $event)"
    @unavailable="fallbackToTileMap"
  />

  <HuaweiDispatchMap
    v-else
    v-bind="$attrs"
    :map-overview="mapOverview"
    :selected-stop="selectedStop"
    :selected-driver-user-id="selectedDriverUserId"
    @select-marker="$emit('select-marker', $event)"
    @select-line="$emit('select-line', $event)"
  />
</template>

<script setup>
import { onMounted, ref } from 'vue';
import HuaweiDispatchMap from './HuaweiDispatchMap.vue';
import HuaweiJsDispatchMap from './HuaweiJsDispatchMap.vue';

defineOptions({ inheritAttrs: false });

defineProps({
  mapOverview: { type: Object, default: () => ({}) },
  selectedStop: { type: Object, default: null },
  selectedDriverUserId: { type: [String, Number], default: null },
});

defineEmits(['select-marker', 'select-line']);

const checking = ref(true);
const useJavascriptMap = ref(false);
const sdkConfig = ref(null);

function fallbackToTileMap(error) {
  useJavascriptMap.value = false;
  console.warn('[dispatch-map] Huawei JS 地图不可用，已切换瓦片地图:', error?.message || error);
}

onMounted(async () => {
  try {
    const loadConfig = window.electronAPI?.dispatchMap?.loadConfig;
    const result = loadConfig ? await loadConfig() : null;
    if (result?.ok && result.data?.available && result.data?.apiKey) {
      sdkConfig.value = result.data;
      useJavascriptMap.value = true;
    }
  } catch (error) {
    console.warn('[dispatch-map] Huawei JS 地图配置读取失败，继续使用瓦片地图:', error?.message || error);
  } finally {
    checking.value = false;
  }
});
</script>

<style scoped>
.dispatch-map-loader {
  position: relative;
  display: grid;
  min-height: 470px;
  flex: 1;
  place-items: center;
  align-content: center;
  border: 1px solid #dce7e2;
  border-radius: 12px;
  color: #536a61;
  background: #f4f8f6;
}

.dispatch-map-loader span {
  width: 27px;
  height: 27px;
  margin-bottom: 10px;
  border: 3px solid #d5e7df;
  border-top-color: #109869;
  border-radius: 50%;
  animation: map-spin .8s linear infinite;
}

.dispatch-map-loader strong { font-size: 11px; }

@keyframes map-spin {
  to { transform: rotate(360deg); }
}
</style>
