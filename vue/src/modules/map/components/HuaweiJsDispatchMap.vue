<template>
  <section class="dispatch-huawei-map" aria-label="Huawei 配送路线地图">
    <div v-if="loading" class="dispatch-huawei-map__state">
      <span></span>
      <strong>正在加载自定义 Huawei 地图</strong>
    </div>

    <div ref="mapElement" class="dispatch-huawei-map__canvas"></div>

    <div v-if="ready" class="dispatch-huawei-map__hint">
      <span>Huawei 地图 · 中文道路底图</span>
      <button type="button" @click="fitViewport">显示全部路线</button>
    </div>
  </section>
</template>

<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

let sdkPromise = null;

function loadHuaweiMapSdk(apiKey) {
  if (window.HWMapJsSDK?.HWMap) return Promise.resolve(window.HWMapJsSDK);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const callbackName = `__nxlHuaweiMapReady_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => {
      cleanup();
      sdkPromise = null;
      reject(new Error('Huawei JavaScript 地图加载超时'));
    }, 20_000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      try { delete window[callbackName]; } catch (ignored) { window[callbackName] = undefined; }
    };

    window[callbackName] = () => {
      cleanup();
      if (window.HWMapJsSDK?.HWMap) resolve(window.HWMapJsSDK);
      else {
        sdkPromise = null;
        reject(new Error('Huawei JavaScript 地图初始化失败'));
      }
    };
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      cleanup();
      sdkPromise = null;
      reject(new Error('Huawei JavaScript 地图网络加载失败'));
    };
    const query = new URLSearchParams({ callback: callbackName, key: apiKey });
    script.src = `https://mapapi.cloud.huawei.com/mapjs/v1/api/js?${query.toString()}`;
    document.head.appendChild(script);
  });
  return sdkPromise;
}

const props = defineProps({
  mapOverview: { type: Object, default: () => ({}) },
  selectedStop: { type: Object, default: null },
  selectedDriverUserId: { type: [String, Number], default: null },
  sdkConfig: { type: Object, required: true },
});

const emit = defineEmits(['select-marker', 'select-line', 'unavailable']);
const mapElement = ref(null);
const loading = ref(true);
const ready = ref(false);
let sdk = null;
let map = null;
let resizeObserver = null;
let renderSequence = 0;
let overlays = [];

const markers = computed(() => (
  Array.isArray(props.mapOverview?.markers) ? props.mapOverview.markers : []
));
const polylines = computed(() => (
  Array.isArray(props.mapOverview?.polylines) ? props.mapOverview.polylines : []
));

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coordinate(source) {
  const lat = number(source?.lat ?? source?.latitude);
  const lng = number(source?.lng ?? source?.longitude);
  return lat == null || lng == null ? null : { lat, lng };
}

function isSelectedMarker(marker) {
  if (!props.selectedStop) return false;
  if (marker?.depFatherId != null && props.selectedStop.depFatherId != null) {
    return String(marker.depFatherId) === String(props.selectedStop.depFatherId);
  }
  return marker?.customerName && marker.customerName === props.selectedStop.customerName;
}

function isSelectedDriver(driverUserId) {
  return props.selectedDriverUserId != null
    && driverUserId != null
    && String(props.selectedDriverUserId) === String(driverUserId);
}

function markerSvg(color, text, selected, depot = false) {
  const stroke = selected ? '#102338' : '#ffffff';
  const label = String(text || (depot ? '仓' : '•')).slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52"><path d="M22 1C10.4 1 1 10.4 1 22c0 15.2 21 29 21 29s21-13.8 21-29C43 10.4 33.6 1 22 1z" fill="${depot ? '#17243a' : color}" stroke="${stroke}" stroke-width="${selected ? 4 : 2}"/><circle cx="22" cy="22" r="13" fill="rgba(255,255,255,.14)"/><text x="22" y="27" text-anchor="middle" fill="#fff" font-size="14" font-weight="800" font-family="Arial, sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function removeOverlays() {
  overlays.forEach((overlay) => {
    try { overlay?.setMap?.(null); } catch (ignored) { /* map is being destroyed */ }
  });
  overlays = [];
}

function addRoute(line) {
  const path = (Array.isArray(line?.points) ? line.points : [])
    .map(coordinate)
    .filter(Boolean);
  if (path.length < 2) return;
  const selected = isSelectedDriver(line.driverUserId);
  const color = line.color || '#2563eb';
  const casing = new sdk.HWPolyline({
    map,
    path,
    strokeColor: selected ? 'rgba(255,255,255,.98)' : 'rgba(255,255,255,.72)',
    strokeWeight: selected ? 7 : 5,
    zIndex: selected ? 20 : 10,
  });
  const route = new sdk.HWPolyline({
    map,
    path,
    strokeColor: color,
    strokeWeight: selected ? 4 : 3,
    strokeLineDash: String(line.lineStyle || '').toUpperCase() === 'DASHED' ? [8, 6] : undefined,
    zIndex: selected ? 21 : 11,
  });
  if (typeof route.setShowDir === 'function') route.setShowDir(true);
  const select = () => emit('select-line', line);
  casing.addListener?.('click', select);
  route.addListener?.('click', select);
  overlays.push(casing, route);
}

function addMarker(item, depot = false) {
  const position = coordinate(item);
  if (!position) return;
  const selected = !depot && isSelectedMarker(item);
  const color = item?.color || (item?.markerType === 'UNASSIGNED_CUSTOMER' ? '#8a97a6' : '#2563eb');
  const name = depot
    ? (props.mapOverview?.depotName || item?.name || '仓库')
    : (item?.customerName || item?.name || '客户');
  const marker = new sdk.HWMarker({
    map,
    position,
    zIndex: selected || depot ? 60 : 50,
    icon: {
      url: markerSvg(color, depot ? '仓' : (item?.badgeText || item?.stopSeq || '?'), selected, depot),
      scale: selected ? 1.08 : 1,
      anchor: [0.5, 1],
      anchorUnit: 'fraction',
    },
    label: {
      text: name,
      color: depot ? '#17243a' : '#18342b',
      fontSize: selected ? '14px' : '13px',
      fontWeight: '700',
      offsetY: -57,
      strokeColor: '#ffffff',
      strokeWeight: 4,
    },
  });
  if (!depot) marker.addListener?.('click', () => emit('select-marker', item));
  overlays.push(marker);
}

function buildMapOverlays() {
  if (!map || !sdk || !ready.value) return;
  removeOverlays();
  polylines.value.forEach(addRoute);
  const depot = coordinate(props.mapOverview?.depot);
  if (depot) addMarker({ ...props.mapOverview.depot, name: props.mapOverview?.depotName }, true);
  markers.value.forEach((item) => addMarker(item));
  fitViewport();
}

function allMapPoints() {
  const points = [];
  const depot = coordinate(props.mapOverview?.depot);
  if (depot) points.push(depot);
  markers.value.forEach((item) => {
    const point = coordinate(item);
    if (point) points.push(point);
  });
  polylines.value.forEach((line) => {
    (Array.isArray(line?.points) ? line.points : []).forEach((item) => {
      const point = coordinate(item);
      if (point) points.push(point);
    });
  });
  return points;
}

function fitViewport() {
  if (!map || !ready.value) return;
  const points = allMapPoints();
  if (!points.length) return;
  if (points.length === 1) {
    map.setCenter?.(points[0]);
    map.setZoom?.(14);
    return;
  }
  if (typeof map.setFitView === 'function') {
    map.setFitView(points);
    window.setTimeout(() => {
      const zoom = Number(map?.getZoom?.());
      if (Number.isFinite(zoom)) map.setZoom?.(Math.min(14.25, Math.max(1, zoom - 0.8)));
    }, 0);
  }
}

async function waitForContainer(sequence) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await nextTick();
    if (sequence !== renderSequence || !mapElement.value) return false;
    const rect = mapElement.value.getBoundingClientRect();
    if (rect.width > 1 && rect.height > 1) return true;
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  }
  throw new Error('地图容器尺寸未就绪');
}

async function initialize() {
  const sequence = ++renderSequence;
  loading.value = true;
  ready.value = false;
  try {
    if (!await waitForContainer(sequence)) return;
    sdk = await loadHuaweiMapSdk(props.sdkConfig.apiKey);
    if (sequence !== renderSequence) return;
    const center = coordinate({
      lat: props.mapOverview?.centerLat,
      lng: props.mapOverview?.centerLng,
    }) || coordinate(props.mapOverview?.depot) || coordinate(markers.value[0]);
    if (!center) throw new Error('暂无可显示的客户坐标');
    map = new sdk.HWMap(mapElement.value, {
      center,
      zoom: number(props.mapOverview?.suggestedScale) || 12,
      language: props.sdkConfig.language || 'zh-CN',
      sourceType: props.sdkConfig.sourceType || 'vector',
      zoomControl: true,
      scaleControl: false,
      navigationControl: false,
    });
    // 正式桌面优先使用已发布样式。previewId 仅用于样式编辑期间预览，
    // 在自动缩放到其它层级时可能没有完整底图资源。
    if (props.sdkConfig.styleId && typeof map.setStyleId === 'function') {
      map.setStyleId(String(props.sdkConfig.styleId));
    } else if (props.sdkConfig.previewId && typeof map.setPreviewId === 'function') {
      map.setPreviewId(String(props.sdkConfig.previewId));
    }
    if (sequence !== renderSequence) return;
    ready.value = true;
    loading.value = false;
    buildMapOverlays();
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => map?.resize?.());
      resizeObserver.observe(mapElement.value);
    }
  } catch (error) {
    loading.value = false;
    ready.value = false;
    emit('unavailable', error instanceof Error ? error : new Error(String(error)));
  }
}

watch(
  () => [props.mapOverview, props.selectedStop, props.selectedDriverUserId],
  () => {
    if (ready.value && map) buildMapOverlays();
  },
  { deep: true }
);

onMounted(initialize);

onBeforeUnmount(() => {
  renderSequence += 1;
  resizeObserver?.disconnect?.();
  removeOverlays();
  try { map?.destroy?.(); } catch (ignored) { /* SDK cleanup best effort */ }
  map = null;
});
</script>

<style scoped>
.dispatch-huawei-map {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.dispatch-huawei-map__canvas {
  min-height: 470px;
  flex: 1;
  overflow: hidden;
  border: 1px solid #d9e4df;
  border-radius: 12px;
  background: #eef4f1;
}

.dispatch-huawei-map__state {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: grid;
  place-items: center;
  align-content: center;
  border: 1px solid #dce7e2;
  border-radius: 12px;
  color: #536a61;
  background: #f4f8f6;
}

.dispatch-huawei-map__state span {
  width: 27px;
  height: 27px;
  margin-bottom: 10px;
  border: 3px solid #d5e7df;
  border-top-color: #109869;
  border-radius: 50%;
  animation: map-spin .8s linear infinite;
}

.dispatch-huawei-map__state strong { font-size: 11px; }

.dispatch-huawei-map__hint {
  position: absolute;
  z-index: 5;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 7px 6px 10px;
  border: 1px solid rgba(204, 218, 212, .9);
  border-radius: 9px;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 5px 18px rgba(21, 47, 37, .12);
}

.dispatch-huawei-map__hint span { color: #6c7f77; font-size: 8px; }

.dispatch-huawei-map__hint button {
  padding: 5px 8px;
  border: 0;
  border-radius: 6px;
  color: #fff;
  background: #128a61;
  font-size: 8px;
  font-weight: 800;
  cursor: pointer;
}

@keyframes map-spin {
  to { transform: rotate(360deg); }
}
</style>
