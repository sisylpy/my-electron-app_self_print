<template>
  <section class="route-map" :class="{ 'is-prominent': prominent }" aria-labelledby="route-map-title">
    <div v-if="!prominent" class="route-map__header">
      <div>
        <p class="route-map__eyebrow">服务端路线坐标</p>
        <h2 id="route-map-title">路线地图</h2>
      </div>
      <span class="route-map__badge">只读</span>
    </div>

    <div v-if="hasCoordinates" class="route-map__canvas">
      <svg viewBox="0 0 1000 600" role="img" aria-label="今日配送路线坐标概览">
        <defs>
          <pattern id="dispatch-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#dbe5ef" stroke-width="1" />
          </pattern>
          <filter id="dispatch-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#23334d" flood-opacity="0.22" />
          </filter>
        </defs>
        <rect width="1000" height="600" rx="20" fill="#f4f8fb" />
        <rect width="1000" height="600" rx="20" fill="url(#dispatch-grid)" />

        <g
          v-for="line in projectedLines"
          :key="line.key"
          class="route-map__line"
          role="button"
          tabindex="0"
          :aria-label="`${line.driverName || '司机'}的配送路线`"
          @click="$emit('select-line', line.raw)"
          @keydown.enter.prevent="$emit('select-line', line.raw)"
          @keydown.space.prevent="$emit('select-line', line.raw)"
        >
          <polyline
            :points="line.points"
            fill="none"
            stroke="transparent"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="16"
          />
          <polyline
            :points="line.points"
            fill="none"
            :stroke="line.color"
            :stroke-dasharray="line.dashed ? '13 10' : null"
            stroke-linecap="round"
            stroke-linejoin="round"
            :stroke-width="isSelectedLine(line) ? 8 : 5"
            :opacity="lineOpacity(line)"
          />
        </g>

        <g v-if="projectedDepot" filter="url(#dispatch-shadow)">
          <circle :cx="projectedDepot.x" :cy="projectedDepot.y" r="22" fill="#172033" />
          <text
            :x="projectedDepot.x"
            :y="projectedDepot.y + 6"
            fill="#fff"
            font-size="18"
            text-anchor="middle"
          >仓</text>
        </g>

        <g
          v-for="marker in projectedMarkers"
          :key="marker.key"
          class="route-map__marker"
          role="button"
          tabindex="0"
          :aria-label="`${marker.customerName || marker.title || '客户'}，${marker.assignmentLabel || ''}`"
          @click="$emit('select-marker', marker.raw)"
          @keydown.enter.prevent="$emit('select-marker', marker.raw)"
          @keydown.space.prevent="$emit('select-marker', marker.raw)"
        >
          <circle
            :cx="marker.x"
            :cy="marker.y"
            :r="isSelected(marker.raw) ? 23 : 19"
            :fill="marker.color"
            :stroke="isSelected(marker.raw) ? '#0f172a' : '#fff'"
            :stroke-width="isSelected(marker.raw) ? 6 : 4"
            filter="url(#dispatch-shadow)"
          />
          <text
            :x="marker.x"
            :y="marker.y + 6"
            fill="#fff"
            font-size="16"
            font-weight="700"
            text-anchor="middle"
          >{{ marker.badgeText || marker.stopSeq || '?' }}</text>
          <text
            :x="marker.x"
            :y="marker.y - 31"
            fill="#22324b"
            font-size="15"
            font-weight="700"
            text-anchor="middle"
          >{{ marker.displayTitle || compactName(marker.customerName || marker.title) }}</text>
        </g>
      </svg>
    </div>

    <div v-else class="route-map__empty">
      <span>⌖</span>
      <strong>暂无可绘制坐标</strong>
      <p>{{ emptyHint }}</p>
    </div>

    <div v-if="legend.length" class="route-map__legend" aria-label="路线图例">
      <span v-for="item in legend" :key="`${item.kind}-${item.driverUserId || item.label}`">
        <i :style="{ backgroundColor: item.color || '#64748b' }"></i>
        {{ item.label }}
      </span>
    </div>

    <p v-if="missingCount" class="route-map__missing">
      {{ missingCount }} 个站点缺少坐标，仍可在路线和详情中查看。
    </p>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  mapOverview: {
    type: Object,
    default: () => ({}),
  },
  selectedStop: {
    type: Object,
    default: null,
  },
  selectedDriverUserId: {
    type: [String, Number],
    default: null,
  },
  prominent: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['select-marker', 'select-line']);

const WIDTH = 1000;
const HEIGHT = 600;
const PADDING = 70;

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function coordinate(item) {
  const lat = number(item?.lat);
  const lng = number(item?.lng);
  return lat === null || lng === null ? null : { lat, lng };
}

const markers = computed(() => (
  Array.isArray(props.mapOverview?.markers) ? props.mapOverview.markers : []
));

const lines = computed(() => (
  Array.isArray(props.mapOverview?.polylines) ? props.mapOverview.polylines : []
));

const allCoordinates = computed(() => {
  const values = [];
  const depot = coordinate(props.mapOverview?.depot);
  if (depot) values.push(depot);
  markers.value.forEach((marker) => {
    const value = coordinate(marker);
    if (value) values.push(value);
  });
  lines.value.forEach((line) => {
    (Array.isArray(line?.points) ? line.points : []).forEach((point) => {
      const value = coordinate(point);
      if (value) values.push(value);
    });
  });
  return values;
});

const bounds = computed(() => {
  if (!allCoordinates.value.length) return null;
  const lats = allCoordinates.value.map((point) => point.lat);
  const lngs = allCoordinates.value.map((point) => point.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
});

function project(item) {
  const value = coordinate(item);
  if (!value || !bounds.value) return null;
  const lngSpan = Math.max(bounds.value.maxLng - bounds.value.minLng, 0.002);
  const latSpan = Math.max(bounds.value.maxLat - bounds.value.minLat, 0.002);
  return {
    x: PADDING + ((value.lng - bounds.value.minLng) / lngSpan) * (WIDTH - PADDING * 2),
    y: HEIGHT - PADDING - ((value.lat - bounds.value.minLat) / latSpan) * (HEIGHT - PADDING * 2),
  };
}

const projectedDepot = computed(() => project(props.mapOverview?.depot));

const projectedMarkers = computed(() => markers.value.flatMap((marker, index) => {
  const point = project(marker);
  if (!point) return [];
  return [{
    ...marker,
    ...point,
    raw: marker,
    key: `${marker.driverUserId || 'unassigned'}-${marker.depFatherId || marker.customerName || index}-${index}`,
    color: marker.color || (marker.markerType === 'UNASSIGNED_CUSTOMER' ? '#94a3b8' : '#2563eb'),
  }];
}));

const projectedLines = computed(() => lines.value.flatMap((line, index) => {
  const points = (Array.isArray(line?.points) ? line.points : [])
    .map(project)
    .filter(Boolean);
  if (points.length < 2) return [];
  return [{
    raw: line,
    key: line.routeKey || `${line.driverUserId || 'route'}-${index}`,
    points: points.map((point) => `${point.x},${point.y}`).join(' '),
    color: line.color || '#2563eb',
    dashed: String(line.lineStyle || '').toUpperCase() === 'DASHED',
    driverUserId: line.driverUserId,
    driverName: line.driverName,
  }];
}));

const hasCoordinates = computed(() => allCoordinates.value.length > 0);
const legend = computed(() => (
  Array.isArray(props.mapOverview?.legend) ? props.mapOverview.legend : []
));
const missingCount = computed(() => (
  Array.isArray(props.mapOverview?.missingCoordinateStops)
    ? props.mapOverview.missingCoordinateStops.length
    : 0
));
const emptyHint = computed(() => (
  props.mapOverview?.emptyHint || '服务端尚未返回客户经纬度。'
));

function compactName(value) {
  const name = String(value || '客户');
  return name.length > 8 ? `${name.slice(0, 8)}…` : name;
}

function isSelected(marker) {
  if (!props.selectedStop) return false;
  if (marker.depFatherId != null && props.selectedStop.depFatherId != null) {
    return String(marker.depFatherId) === String(props.selectedStop.depFatherId);
  }
  return marker.customerName && marker.customerName === props.selectedStop.customerName;
}

function isSelectedLine(line) {
  if (props.selectedDriverUserId == null || line.driverUserId == null) return false;
  return String(props.selectedDriverUserId) === String(line.driverUserId);
}

function lineOpacity(line) {
  if (props.selectedDriverUserId == null) return 0.86;
  return isSelectedLine(line) ? 1 : 0.28;
}
</script>

<style scoped>
.route-map {
  flex: 0 0 auto;
  min-height: 0;
}

.route-map.is-prominent {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.route-map__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.route-map__header h2,
.route-map__header p {
  margin: 0;
}

.route-map__header h2 {
  color: #172033;
  font-size: 17px;
}

.route-map__eyebrow {
  margin-bottom: 3px !important;
  color: #7a8aa2;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.route-map__badge {
  padding: 4px 9px;
  border-radius: 99px;
  color: #42617c;
  background: #eef4f8;
  font-size: 11px;
  font-weight: 700;
}

.route-map__canvas {
  overflow: hidden;
  border: 1px solid #d9e3ec;
  border-radius: 14px;
  background: #f4f8fb;
}

.route-map.is-prominent .route-map__canvas {
  min-height: 0;
  flex: 1;
}

.route-map__canvas svg {
  display: block;
  width: 100%;
  height: clamp(165px, 22vh, 220px);
}

.route-map.is-prominent .route-map__canvas svg {
  height: 100%;
  min-height: 470px;
}

.route-map__line {
  cursor: pointer;
  outline: none;
}

.route-map__line:focus polyline:last-child {
  filter: drop-shadow(0 0 5px rgba(15, 23, 42, .35));
}

.route-map__marker {
  cursor: pointer;
  outline: none;
}

.route-map__marker:focus circle {
  stroke: #0f172a;
  stroke-width: 7;
}

.route-map__empty {
  display: grid;
  min-height: 240px;
  place-items: center;
  align-content: center;
  border: 1px dashed #c4d1de;
  border-radius: 14px;
  color: #718096;
  background: #f7fafc;
  text-align: center;
}

.route-map__empty span {
  margin-bottom: 8px;
  color: #8aa2b8;
  font-size: 34px;
}

.route-map__empty strong {
  color: #3e5068;
}

.route-map__empty p {
  margin: 5px 20px 0;
  font-size: 12px;
}

.route-map__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 13px;
  margin-top: 10px;
  color: #617087;
  font-size: 11px;
}

.route-map.is-prominent .route-map__legend {
  flex: none;
  margin: 10px 2px 0;
}

.route-map__legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.route-map__legend i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.route-map__missing {
  margin: 10px 0 0;
  color: #9a6916;
  font-size: 11px;
}

.route-map.is-prominent .route-map__empty {
  min-height: 0;
  flex: 1;
}
</style>
