<template>
  <!--
    地图 SDK 会维护自己的 DOM。外层节点必须稳定存在，不能在登录校验、
    配置读取和地图实例之间直接替换组件根节点，否则 SDK 清理 DOM 时会与
    Vue 的 vnode 更新发生竞争。
  -->
  <section class="dispatch-map-shell" aria-label="Huawei 配送路线地图">
    <section
      v-if="mapAuthBlocked || checking"
      class="dispatch-map-loader"
      :aria-label="mapAuthBlocked ? '正在恢复桌面登录' : '正在读取华为地图配置'"
    >
      <span></span>
      <strong>{{ mapAuthBlocked ? '正在恢复桌面登录' : '正在打开 Huawei 地图' }}</strong>
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
      @unavailable="handleTileUnavailable"
    />
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import HuaweiDispatchMap from './HuaweiDispatchMap.vue';
import HuaweiJsDispatchMap from './HuaweiJsDispatchMap.vue';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  mapOverview: { type: Object, default: () => ({}) },
  selectedStop: { type: Object, default: null },
  selectedDriverUserId: { type: [String, Number], default: null },
  authenticated: { type: Boolean, default: true },
  authChecking: { type: Boolean, default: false },
});

const emit = defineEmits(['select-marker', 'select-line', 'session-expired']);

const internalChecking = ref(false);
const useJavascriptMap = ref(false);
const sdkConfig = ref(null);
const accessBlocked = ref(false);
let requestSequence = 0;

const mapAuthBlocked = computed(() => (
  !props.authChecking && (!props.authenticated || accessBlocked.value)
));
const checking = computed(() => (
  props.authChecking || (props.authenticated && internalChecking.value)
));

function fallbackToTileMap(error) {
  useJavascriptMap.value = false;
  console.warn('[dispatch-map] Huawei JS 地图不可用，已切换瓦片地图:', error?.message || error);
}

function handleTileUnavailable(error) {
  if (Number(error?.status) === 401 || error?.errorCode === 'UNAUTHENTICATED') {
    accessBlocked.value = true;
    emit('session-expired', error);
  }
}

async function loadMapMode() {
  if (!props.authenticated || props.authChecking) return;
  const sequence = ++requestSequence;
  internalChecking.value = true;
  accessBlocked.value = false;
  useJavascriptMap.value = false;
  sdkConfig.value = null;
  try {
    const loadConfig = window.electronAPI?.dispatchMap?.loadConfig;
    const result = loadConfig ? await loadConfig() : null;
    if (sequence !== requestSequence) return;
    if (Number(result?.status) === 401 || result?.errorCode === 'UNAUTHENTICATED') {
      accessBlocked.value = true;
      emit('session-expired', result);
      return;
    }
    if (result?.ok && result.data?.available && result.data?.apiKey) {
      sdkConfig.value = result.data;
      useJavascriptMap.value = true;
    }
  } catch (error) {
    console.warn('[dispatch-map] Huawei JS 地图配置读取失败，继续使用瓦片地图:', error?.message || error);
  } finally {
    if (sequence === requestSequence) internalChecking.value = false;
  }
}

watch(
  () => [props.authenticated, props.authChecking],
  ([authenticated, authChecking]) => {
    if (authChecking) return;
    if (authenticated) {
      loadMapMode();
    } else {
      requestSequence += 1;
      internalChecking.value = false;
      accessBlocked.value = false;
      useJavascriptMap.value = false;
      sdkConfig.value = null;
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.dispatch-map-shell {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
}

.dispatch-map-shell > :deep(.dispatch-huawei-map),
.dispatch-map-shell > :deep(.dispatch-real-map) {
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
}

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
