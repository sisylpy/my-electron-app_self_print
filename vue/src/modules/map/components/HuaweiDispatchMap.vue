<template>
  <section class="dispatch-real-map" aria-label="Huawei 配送路线地图">
    <div v-if="loading" class="dispatch-real-map__state">
      <span></span>
      <strong>正在打开 Huawei 地图</strong>
    </div>

    <div v-show="!failed" ref="mapElement" class="dispatch-real-map__canvas"></div>

    <div v-if="ready" class="dispatch-real-map__hint">
      <span>Huawei 地图 · 可拖动、缩放</span>
      <button type="button" @click="fitViewport">显示全部路线</button>
    </div>

    <ReadOnlyDispatchMap
      v-if="failed"
      prominent
      :map-overview="mapOverview"
      :selected-stop="selectedStop"
      :selected-driver-user-id="selectedDriverUserId"
      @select-marker="$emit('select-marker', $event)"
      @select-line="$emit('select-line', $event)"
    />
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
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import ReadOnlyDispatchMap from './ReadOnlyDispatchMap.vue';

const HUAWEI_TILE_PROTOCOL = 'nxl-huawei';
let huaweiProtocolInstalled = false;

function huaweiMapStyle() {
  return {
    version: 8,
    sources: {
      'huawei-map-kit': {
        type: 'raster',
        tiles: [`${HUAWEI_TILE_PROTOCOL}://tiles/{z}/{x}/{y}`],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 20,
        attribution: '© Huawei Map Kit',
      },
    },
    layers: [{
      id: 'huawei-map-kit-base',
      type: 'raster',
      source: 'huawei-map-kit',
      minzoom: 0,
      maxzoom: 20,
      paint: {
        // 保留道路和地貌辨识度，只轻度降低底图色彩；路线自身通过层级、
        // 描边与透明度形成重点，避免整张地图出现灰雾感。
        'raster-opacity': 0.76,
        'raster-saturation': -0.32,
        'raster-contrast': -0.06,
        'raster-brightness-min': 0.12,
        'raster-brightness-max': 0.98,
        'raster-fade-duration': 0,
      },
    }],
  };
}

function installHuaweiTileProtocol() {
  if (huaweiProtocolInstalled) return;
  maplibregl.addProtocol(HUAWEI_TILE_PROTOCOL, async (params) => {
    const matched = String(params?.url || '').match(/\/(\d+)\/(\d+)\/(\d+)(?:\.png)?(?:\?.*)?$/);
    if (!matched) throw new Error('Huawei 地图瓦片地址无效');
    const loadTile = window.electronAPI?.dispatchMap?.loadTile;
    if (!loadTile) throw new Error('当前环境不支持 Huawei 地图瓦片');
    const result = await loadTile({
      z: Number(matched[1]),
      x: Number(matched[2]),
      y: Number(matched[3]),
    });
    if (!result?.ok || !result.data) {
      throw new Error(result?.message || 'Huawei 地图瓦片读取失败');
    }
    const binary = window.atob(result.data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return { data: bytes.buffer, cacheControl: 'private, max-age=21600' };
  });
  huaweiProtocolInstalled = true;
}

const props = defineProps({
  mapOverview: { type: Object, default: () => ({}) },
  selectedStop: { type: Object, default: null },
  selectedDriverUserId: { type: [String, Number], default: null },
});

const emit = defineEmits(['select-marker', 'select-line']);
const mapElement = ref(null);
const loading = ref(true);
const ready = ref(false);
const failed = ref(false);
let map = null;
let resizeObserver = null;
let renderSequence = 0;
let renderedMarkers = [];
let renderedLayers = [];
let renderedSources = [];
let layerListeners = [];

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

function mapLngLat(source) {
  const point = coordinate(source);
  if (!point) return null;
  return [point.lng, point.lat];
}

function safeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '-');
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52"><path d="M22 1C10.4 1 1 10.4 1 22c0 15.2 21 29 21 29s21-13.8 21-29C43 10.4 33.6 1 22 1z" fill="${depot ? '#17243a' : color}" stroke="${stroke}" stroke-width="${selected ? 4 : 2}"/><circle cx="22" cy="22" r="13" fill="rgba(255,255,255,.14)"/><text x="22" y="27" text-anchor="middle" fill="#fff" font-size="14" font-weight="800" font-family="Arial, sans-serif">${label}</text></svg>`;
}

function markerElement(item, selected, depot = false) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `nxl-map-marker${selected ? ' is-selected' : ''}${depot ? ' is-depot' : ''}`;
  const title = document.createElement('span');
  title.className = 'nxl-map-marker__title';
  title.textContent = depot
    ? (props.mapOverview?.depotName || item?.name || '仓库')
    : (item?.customerName || item?.name || '客户');
  const icon = document.createElement('span');
  icon.className = 'nxl-map-marker__pin';
  const color = item?.color || (item?.markerType === 'UNASSIGNED_CUSTOMER' ? '#8a97a6' : '#2563eb');
  const svg = markerSvg(color, depot ? '仓' : (item?.badgeText || item?.stopSeq || '?'), selected, depot);
  icon.style.backgroundImage = `url("data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}")`;
  element.append(title, icon);
  return element;
}

function removeDynamicContent() {
  layerListeners.forEach(({ event, layerId, handler }) => {
    if (map?.getLayer(layerId)) map.off(event, layerId, handler);
  });
  layerListeners = [];
  renderedLayers.slice().reverse().forEach((id) => {
    if (map?.getLayer(id)) map.removeLayer(id);
  });
  renderedLayers = [];
  renderedSources.forEach((id) => {
    if (map?.getSource(id)) map.removeSource(id);
  });
  renderedSources = [];
  renderedMarkers.forEach((item) => item.remove());
  renderedMarkers = [];
}

function addRoute(line, index) {
  const coordinates = (Array.isArray(line?.points) ? line.points : [])
    .map(mapLngLat)
    .filter(Boolean);
  if (coordinates.length < 2) return;
  const suffix = safeId(`${line.driverUserId ?? 'route'}-${index}`);
  const sourceId = `dispatch-route-source-${suffix}`;
  const casingId = `dispatch-route-casing-${suffix}`;
  const routeId = `dispatch-route-line-${suffix}`;
  const arrowId = `dispatch-route-arrow-${suffix}`;
  const color = line.color || '#2563eb';
  const selected = isSelectedDriver(line.driverUserId);
  map.addSource(sourceId, {
    type: 'geojson',
    data: {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates },
    },
  });
  renderedSources.push(sourceId);
  map.addLayer({
    id: casingId,
    type: 'line',
    source: sourceId,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#ffffff',
      'line-width': selected ? 9 : 6,
      'line-opacity': selected ? 0.96 : 0.62,
    },
  });
  map.addLayer({
    id: routeId,
    type: 'line',
    source: sourceId,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': color,
      'line-width': selected ? 6 : 4,
      'line-opacity': selected ? 1 : 0.68,
      ...(String(line.lineStyle || '').toUpperCase() === 'DASHED'
        ? { 'line-dasharray': [2, 1.6] }
        : {}),
    },
  });
  map.addLayer({
    id: arrowId,
    type: 'symbol',
    source: sourceId,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': selected ? 145 : 190,
      'text-field': '▶',
      'text-size': selected ? 11 : 8,
      'text-rotation-alignment': 'map',
      'text-keep-upright': false,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': color,
      'text-halo-width': selected ? 1.7 : 1.2,
      'text-opacity': selected ? 1 : 0.62,
    },
  });
  renderedLayers.push(casingId, routeId, arrowId);
  const selectRoute = () => emit('select-line', line);
  const showPointer = () => { map.getCanvas().style.cursor = 'pointer'; };
  const clearPointer = () => { map.getCanvas().style.cursor = ''; };
  [casingId, routeId, arrowId].forEach((layerId) => {
    map.on('click', layerId, selectRoute);
    map.on('mouseenter', layerId, showPointer);
    map.on('mouseleave', layerId, clearPointer);
    layerListeners.push(
      { event: 'click', layerId, handler: selectRoute },
      { event: 'mouseenter', layerId, handler: showPointer },
      { event: 'mouseleave', layerId, handler: clearPointer }
    );
  });
}

function addMarker(item, depot = false) {
  const lngLat = mapLngLat(item);
  if (!lngLat) return;
  const selected = !depot && isSelectedMarker(item);
  const element = markerElement(item, selected, depot);
  if (!depot) {
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      emit('select-marker', item);
    });
  }
  const marker = new maplibregl.Marker({ element, anchor: 'bottom' })
    .setLngLat(lngLat)
    .addTo(map);
  renderedMarkers.push(marker);
}

function buildMapLayers() {
  if (!map || !ready.value || !map.isStyleLoaded()) return;
  removeDynamicContent();
  polylines.value.forEach(addRoute);
  const depot = coordinate(props.mapOverview?.depot);
  if (depot) addMarker({ ...props.mapOverview.depot, name: props.mapOverview?.depotName }, true);
  markers.value.forEach((item) => addMarker(item, false));
  fitViewport();
}

function allMapPoints() {
  const points = [];
  const depot = mapLngLat(props.mapOverview?.depot);
  if (depot) points.push(depot);
  markers.value.forEach((item) => {
    const point = mapLngLat(item);
    if (point) points.push(point);
  });
  polylines.value.forEach((line) => {
    (Array.isArray(line?.points) ? line.points : []).forEach((item) => {
      const point = mapLngLat(item);
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
    map.jumpTo({ center: points[0], zoom: 14 });
    return;
  }
  const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
  points.slice(1).forEach((point) => bounds.extend(point));
  map.fitBounds(bounds, { padding: 72, maxZoom: 15, duration: 0 });
}

async function waitForMapContainer(sequence) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await nextTick();
    if (sequence !== renderSequence || !mapElement.value) return false;
    const rect = mapElement.value.getBoundingClientRect();
    if (rect.width > 1 && rect.height > 1) return true;
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  }
  throw new Error('地图容器尺寸未就绪');
}

function waitForStyleLoad(sequence) {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      map?.off('load', complete);
      map?.off('error', fail);
      reject(new Error('Huawei 底图加载超时'));
    }, 15_000);
    const complete = () => {
      window.clearTimeout(timeout);
      map?.off('error', fail);
      if (sequence === renderSequence) resolve();
    };
    const fail = (event) => {
      if (!map?.isStyleLoaded()) {
        window.clearTimeout(timeout);
        map?.off('load', complete);
        reject(event?.error || new Error('Huawei 底图加载失败'));
      }
    };
    map.once('load', complete);
    map.once('error', fail);
  });
}

async function initialize() {
  const sequence = ++renderSequence;
  loading.value = true;
  failed.value = false;
  ready.value = false;
  try {
    if (!await waitForMapContainer(sequence)) return;
    installHuaweiTileProtocol();
    const centerSource = coordinate({
      lat: props.mapOverview?.centerLat,
      lng: props.mapOverview?.centerLng,
    }) || coordinate(props.mapOverview?.depot) || coordinate(markers.value[0]);
    if (!centerSource) throw new Error('暂无可显示的客户坐标');
    const center = mapLngLat(centerSource);
    map = new maplibregl.Map({
      container: mapElement.value,
      style: huaweiMapStyle(),
      center,
      zoom: number(props.mapOverview?.suggestedScale) || 12,
      pitch: 0,
      bearing: 0,
      attributionControl: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    await waitForStyleLoad(sequence);
    if (sequence !== renderSequence) return;
    ready.value = true;
    loading.value = false;
    buildMapLayers();
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(mapElement.value);
    }
  } catch (error) {
    loading.value = false;
    ready.value = false;
    failed.value = true;
    map?.remove?.();
    map = null;
    console.warn('[dispatch-map] Huawei 地图不可用，已切换坐标图:', error?.message || error);
  }
}

watch(
  () => [props.mapOverview, props.selectedStop, props.selectedDriverUserId],
  () => {
    if (ready.value && map?.isStyleLoaded()) {
      try {
        buildMapLayers();
      } catch (error) {
        ready.value = false;
        failed.value = true;
        console.warn('[dispatch-map] 地图数据更新失败，已切换坐标图:', error?.message || error);
      }
    } else if (!loading.value && !map) initialize();
  },
  { deep: true }
);

onMounted(initialize);

onBeforeUnmount(() => {
  renderSequence += 1;
  resizeObserver?.disconnect?.();
  removeDynamicContent();
  map?.remove?.();
  map = null;
});
</script>

<style scoped>
.dispatch-real-map {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.dispatch-real-map__canvas {
  min-height: 470px;
  flex: 1;
  overflow: hidden;
  border: 1px solid #d9e4df;
  border-radius: 12px;
  background: #eef4f1;
}

.dispatch-real-map__state {
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

.dispatch-real-map__state span {
  width: 27px;
  height: 27px;
  margin-bottom: 10px;
  border: 3px solid #d5e7df;
  border-top-color: #109869;
  border-radius: 50%;
  animation: map-spin .8s linear infinite;
}

.dispatch-real-map__state strong {
  font-size: 11px;
}

.dispatch-real-map__hint {
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

.dispatch-real-map__hint span {
  color: #6c7f77;
  font-size: 8px;
}

.dispatch-real-map__hint button {
  padding: 5px 8px;
  border: 0;
  border-radius: 6px;
  color: #fff;
  background: #128a61;
  font-size: 8px;
  font-weight: 800;
  cursor: pointer;
}

.dispatch-real-map__canvas :deep(.nxl-map-marker) {
  display: flex;
  width: max-content;
  min-width: 35px;
  padding: 0;
  border: 0;
  outline: 0;
  flex-direction: column;
  align-items: center;
  color: #18342b;
  background: transparent;
  font-family: inherit;
  cursor: pointer;
  filter: drop-shadow(0 4px 7px rgba(14, 37, 29, .2));
}

.dispatch-real-map__canvas :deep(.nxl-map-marker__title) {
  max-width: 150px;
  margin-bottom: 2px;
  padding: 3px 7px;
  overflow: hidden;
  border: 1px solid rgba(198, 215, 208, .96);
  border-radius: 6px;
  background: rgba(255, 255, 255, .96);
  box-shadow: 0 2px 7px rgba(20, 47, 37, .1);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dispatch-real-map__canvas :deep(.nxl-map-marker__pin) {
  display: block;
  width: 35px;
  height: 42px;
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}

.dispatch-real-map__canvas :deep(.nxl-map-marker.is-selected) {
  z-index: 3;
  transform: scale(1.05);
}

.dispatch-real-map__canvas :deep(.nxl-map-marker.is-selected .nxl-map-marker__title),
.dispatch-real-map__canvas :deep(.nxl-map-marker.is-depot .nxl-map-marker__title) {
  border-color: #18342b;
  color: #fff;
  background: #18342b;
}

.dispatch-real-map__canvas :deep(.maplibregl-ctrl-attrib) {
  color: #4e625a;
  font-size: 10px;
}

@keyframes map-spin {
  to { transform: rotate(360deg); }
}
</style>
