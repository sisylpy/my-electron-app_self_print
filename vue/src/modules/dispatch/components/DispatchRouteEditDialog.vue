<template>
  <div class="route-editor-backdrop" role="presentation" @mousedown.self="$emit('close')">
    <section class="route-editor" role="dialog" aria-modal="true" aria-labelledby="route-editor-title">
      <header class="route-editor__header">
        <div>
          <span>单司机路线编辑</span>
          <h2 id="route-editor-title">{{ route.driverName || '当前司机' }}</h2>
          <p>本页的时间、距离和客户锁定只影响这一位司机。</p>
        </div>
        <button type="button" aria-label="关闭路线调整" @click="$emit('close')">×</button>
      </header>

      <section class="route-editor__planner" aria-label="AI 路线增补">
        <strong>AI 补充客户</strong>
        <span class="route-editor__planner-copy">保留当前人工路线，从未确认沙箱客户中尽量补充</span>
        <label>
          <input v-model.trim="maxActiveMinutes" type="number" min="1" step="1" placeholder="自动判断">
          <span>最长分钟</span>
        </label>
        <label>
          <input v-model.trim="maxRoadKm" type="number" min="0.1" step="0.1" placeholder="自动判断">
          <span>最长公里</span>
        </label>
        <button type="button" class="route-editor__plan-action" :disabled="busy" @click="generateRouteExpansion">
          {{ expanding ? '正在分析…' : '生成 AI 建议' }}
        </button>
        <small>{{ driverEstimateLabel }}</small>
      </section>

      <div class="route-editor__body">
        <section class="route-editor__map">
          <div class="route-editor__map-head">
            <strong>路线预览</strong>
            <span v-if="previewMetrics">{{ previewMetrics.totalDistanceText || previewMetrics.totalRoundTripDistanceText || '后台已重新计算' }}</span>
            <span v-else>调整后重新计算，道路路线才会更新</span>
          </div>
          <HuaweiDispatchMap
            :map-overview="previewMapOverview"
            :selected-stop="selectedStop"
            :selected-driver-user-id="route.driverUserId"
            @select-marker="selectMarker"
          />
        </section>

        <aside class="route-editor__order">
          <div class="route-editor__order-head">
            <div><strong>当前路线</strong><span>{{ stops.length }} 站</span></div>
            <button type="button" :disabled="!dirty || busy" @click="resetOrder">恢复</button>
          </div>

          <ol>
            <li
              v-for="(stop, index) in stops"
              :key="stop._stopKey"
              :class="{ active: selectedStop?._stopKey === stop._stopKey, dragging: dragIndex === index }"
              draggable="true"
              @dragstart="startDrag(index)"
              @dragover.prevent
              @drop.prevent="dropAt(index)"
              @dragend="dragIndex = null"
            >
              <span class="route-editor__handle" title="拖动调整顺序">⋮⋮</span>
              <button type="button" class="route-editor__stop" @click="selectedStop = stop">
                <span>{{ index + 1 }}</span>
                <span>
                  <strong>{{ stop.customerName || '未命名客户' }}</strong>
                  <small>{{ stop.goodsSummary || stop._customerAddress || '暂无商品摘要' }}</small>
                </span>
              </button>
              <span class="route-editor__stop-actions">
                <button
                  type="button"
                  :class="{ locked: isLockedToCurrentDriver(stop) }"
                  :disabled="busy || !stop.depFatherId"
                  :title="lockButtonTitle(stop)"
                  @click="toggleStopLock(stop)"
                >{{ isLockedToCurrentDriver(stop) ? '已锁' : '锁定' }}</button>
                <button
                  type="button"
                  class="remove"
                  :disabled="busy || Boolean(currentLock(stop))"
                  title="从本次调整移除"
                  @click="removeStop(stop)"
                >移除</button>
              </span>
              <span class="route-editor__move">
                <button type="button" :disabled="index === 0 || busy" title="上移" @click="move(index, -1)">↑</button>
                <button type="button" :disabled="index === stops.length - 1 || busy" title="下移" @click="move(index, 1)">↓</button>
              </span>
            </li>
          </ol>

          <section v-if="availableStops.length" class="route-editor__candidates">
            <div><strong>可加入客户</strong><span>{{ availableStops.length }} 个</span></div>
            <input v-model.trim="candidateSearch" type="search" placeholder="搜索客户名称、地址或商品">
            <ul>
              <li v-for="candidate in filteredAvailableStops" :key="candidate._stopKey">
                <span>
                  <strong>{{ candidate.customerName }}</strong>
                  <small>{{ candidate.constraintHint || candidate.goodsSummary || candidate._customerAddress }}</small>
                </span>
                <button
                  type="button"
                  :disabled="busy || candidate.blocked"
                  :title="candidate.blockedReason || '加入当前司机路线'"
                  @click="addCandidate(candidate)"
                >{{ candidate.blocked ? '不可加入' : '+ 加入' }}</button>
              </li>
            </ul>
          </section>

          <div class="route-editor__return">
            <span>仓</span><strong>返回仓库</strong><small>{{ previewReturnLabel }}</small>
          </div>
        </aside>
      </div>

      <div v-if="message" class="route-editor__message" :class="`is-${messageTone}`">{{ message }}</div>

      <div v-if="expansionReviewVisible" class="route-expansion-backdrop" role="presentation">
        <section class="route-expansion" role="dialog" aria-modal="true" aria-labelledby="route-expansion-title">
          <header>
            <div>
              <span>AI 路线增补建议</span>
              <h3 id="route-expansion-title">先看变化，再决定是否采用</h3>
              <p>{{ expansionProposal?.summary || '建议不会直接修改正式路线。' }}</p>
            </div>
            <button type="button" aria-label="关闭增补建议" @click="cancelExpansion">×</button>
          </header>

          <div class="route-expansion__body">
            <section class="route-expansion__routes">
              <article>
                <div><strong>原路线</strong><span>{{ expansionProposal?.preservedStopKeys?.length || stops.length }} 家人工保留</span></div>
                <ol><li v-for="(stop, index) in stops" :key="`base-${stop._stopKey}`"><b>{{ index + 1 }}</b>{{ stop.customerName }}</li></ol>
              </article>
              <article class="is-added">
                <div><strong>AI 新增客户</strong><span>{{ expansionProposal?.addedStopCount || 0 }} 家</span></div>
                <ol v-if="expansionProposal?.addedStops?.length">
                  <li v-for="(stop, index) in expansionProposal.addedStops" :key="`added-${stop.stopKey}`"><b>+</b>{{ stop.customerName || `新增客户${index + 1}` }}</li>
                </ol>
                <p v-else>当前能力范围内没有适合补充的客户。</p>
              </article>
              <article class="is-final">
                <div><strong>最终建议路线</strong><span>保持原客户相对顺序</span></div>
                <ol><li v-for="(stop, index) in proposedRouteStops" :key="`final-${stop._stopKey}`"><b>{{ index + 1 }}</b>{{ stop.customerName }}</li></ol>
              </article>
            </section>

            <section class="route-expansion__metrics">
              <div><span>指标</span><span>原路线</span><span>建议后</span><span>变化</span></div>
              <div v-for="row in expansionMetricRows" :key="row.label">
                <strong>{{ row.label }}</strong><span>{{ row.before }}</span><span>{{ row.after }}</span><b :class="row.tone">{{ row.delta }}</b>
              </div>
            </section>

            <section class="route-expansion__excluded">
              <div><strong>未采用客户</strong><span>{{ expansionProposal?.notSelectedStops?.length || 0 }} 家</span></div>
              <ul v-if="expansionProposal?.notSelectedStops?.length">
                <li v-for="stop in expansionProposal.notSelectedStops" :key="`excluded-${stop.stopKey}`">
                  <strong>{{ stop.customerName || '未命名客户' }}</strong><span>{{ stop.reason || '同等客户数方案中未被最终采用' }}</span>
                </li>
              </ul>
              <p v-else>候选客户已全部加入，或当前没有其它候选客户。</p>
            </section>
          </div>

          <footer>
            <span>采用后仍需重新预览并点击“确认保存路线”，取消不会改变当前路线。</span>
            <div>
              <button type="button" @click="cancelExpansion">保持原路线</button>
              <button type="button" class="primary" :disabled="!expansionProposal?.addedStops?.length || busy" @click="adoptExpansion">采用这份建议</button>
            </div>
          </footer>
        </section>
      </div>

      <footer class="route-editor__footer">
        <span :class="{ ready: previewReady && !dirty }">{{ footerHint }}</span>
        <div>
          <button type="button" :disabled="busy" @click="$emit('close')">取消</button>
          <button type="button" :disabled="!dirty || busy" @click="previewRoute">{{ previewing ? '正在计算…' : '重新计算路线' }}</button>
          <button type="button" class="primary" :disabled="!previewReady || dirty || busy" @click="saveRoute">{{ saving ? '正在保存…' : '确认保存路线' }}</button>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import HuaweiDispatchMap from '@/modules/map/components/HuaweiStyledDispatchMap.vue';
import {
  buildPlanningStopLockPayload,
  buildRouteEditConfirmPayload,
  buildRouteExpansionPayload,
  buildRoutePreviewPayload,
  dispatchErrorPresentation,
} from '../services/writeContract';

const props = defineProps({
  route: { type: Object, required: true },
  routeDate: { type: String, required: true },
  batchCode: { type: String, default: 'MORNING' },
  initialMapOverview: { type: Object, default: () => ({}) },
  planning: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close', 'saved', 'changed']);
const store = useStore();
const page = ref(null);
const loading = ref(false);
const originalStops = ref(normalizeStops(props.route._stops || []));
const stops = ref(originalStops.value.slice());
const candidates = ref([]);
const selectedStop = ref(stops.value[0] || null);
const previewMapOverview = ref(props.initialMapOverview || {});
const previewMetrics = ref(null);
const previewReturnLabel = ref(props.route.plannedReturnLabel || '等待重新计算');
const dirty = ref(false);
const previewReady = ref(false);
const previewing = ref(false);
const saving = ref(false);
const locking = ref(false);
const expanding = ref(false);
const expansionProposal = ref(null);
const expansionReviewVisible = ref(false);
const pendingExpansionProposalId = ref(null);
const maxActiveMinutes = ref('');
const maxRoadKm = ref('');
const candidateSearch = ref('');
const message = ref('');
const messageTone = ref('success');
const dragIndex = ref(null);
const busy = computed(() => loading.value || previewing.value || saving.value || locking.value || expanding.value);
const planningState = computed(() => page.value?.planning || props.planning || {});
const availableStops = computed(() => {
  const current = new Set(stops.value.map((stop) => stop._stopKey));
  return candidates.value.filter((stop) => !current.has(stop._stopKey));
});
const filteredAvailableStops = computed(() => {
  const keyword = candidateSearch.value.trim().toLowerCase();
  if (!keyword) return availableStops.value;
  return availableStops.value.filter((stop) => [
    stop.customerName,
    stop._customerAddress,
    stop.goodsSummary,
    stop.constraintHint,
  ].some((value) => String(value || '').toLowerCase().includes(keyword)));
});
const footerHint = computed(() => {
  if (loading.value) return '正在读取该司机的可派客户和锁定关系';
  if (previewing.value) return '后台正在按这位司机的新路线计算';
  if (saving.value) return '正在保存这位司机的路线';
  if (locking.value) return '正在更新客户锁定关系';
  if (expanding.value) return '后台正在用 Huawei 道路成本分析可补充客户';
  if (dirty.value) return '路线已改变，请先重新计算路线';
  if (previewReady.value) return '路线计算完成，可以确认保存';
  return '可拖动排序、添加或移除客户；AI 建议不会直接保存路线';
});
const driverEstimateLabel = computed(() => {
  const metrics = previewMetrics.value || page.value?.driver || props.route;
  const distance = metrics?.totalDistanceText || metrics?.totalRoundTripDistanceText;
  const duration = metrics?.totalDurationText || metrics?.durationText;
  return distance || duration ? `当前约 ${distance || '--'} · ${duration || '--'}` : '留空能力上限时由当前计划规则自动判断';
});
const proposedRouteStops = computed(() => resolveProposedRouteStops(expansionProposal.value));
const expansionMetricRows = computed(() => buildExpansionMetricRows(expansionProposal.value));

onMounted(loadRouteEditPage);

function normalizeStops(list) {
  return (Array.isArray(list) ? list : []).map((stop, index) => {
    const key = String(stop?.sandboxStopKey ?? stop?.stopKey ?? stop?._stopKey ?? '').trim();
    return {
      ...stop,
      sandboxStopKey: key,
      stopKey: key,
      _stopKey: key || `route-stop-${index}`,
      depFatherId: stop?.depFatherId ?? stop?.departmentId ?? stop?.depId ?? null,
      departmentId: stop?.departmentId ?? stop?.depFatherId ?? stop?.depId ?? null,
      _customerAddress: stop?._customerAddress || stop?.address || '',
      liveOrderIds: Array.isArray(stop?.liveOrderIds) ? stop.liveOrderIds : [],
    };
  });
}

function stopKeys() {
  return stops.value.map((stop) => String(stop.sandboxStopKey || stop.stopKey || '').trim()).filter(Boolean);
}

function routeRequestPayload(keys = stopKeys(), proposalId = null, includePreviewToken = true) {
  return buildRoutePreviewPayload({
    route: props.route,
    stopKeys: keys,
    routeDate: props.routeDate,
    batchCode: props.batchCode,
    previewToken: includePreviewToken ? page.value?.previewToken : null,
    routeExpansionProposalId: proposalId,
  });
}

async function loadRouteEditPage(options = {}) {
  loading.value = true;
  try {
    const result = await store.dispatch(
      'dispatch/loadRouteEditPage',
      routeRequestPayload(stopKeys(), null, false)
    );
    if (!result?.ok) { showError(result); return; }
    const nextPage = result.data?.pageViewModel || result.data || {};
    page.value = nextPage;
    const loadedStops = normalizeStops(nextPage.routeStops || []);
    if (loadedStops.length) {
      stops.value = loadedStops;
      selectedStop.value = loadedStops.find((stop) => stop._stopKey === selectedStop.value?._stopKey) || loadedStops[0];
      if (!options.keepOriginal) {
        originalStops.value = loadedStops.slice();
      }
    }
    candidates.value = normalizeStops(nextPage.availableCustomers || nextPage.addableStops || []);
    previewMapOverview.value = nextPage.mapOverview || previewMapOverview.value;
    previewMetrics.value = nextPage.driver || null;
    previewReturnLabel.value = nextPage.driver?.plannedReturnLabel || nextPage.pageHeader?.plannedReturnLabel || previewReturnLabel.value;
  } catch (error) {
    messageTone.value = 'error';
    message.value = error?.message || '司机路线数据读取失败';
  } finally {
    loading.value = false;
  }
}

function setDirty() { dirty.value = true; previewReady.value = false; message.value = ''; }
function move(index, offset) {
  const target = index + offset;
  if (target < 0 || target >= stops.value.length) return;
  const next = stops.value.slice();
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  stops.value = next; selectedStop.value = item; setDirty();
}
function startDrag(index) { dragIndex.value = index; }
function dropAt(index) {
  if (dragIndex.value == null || dragIndex.value === index) return;
  const next = stops.value.slice();
  const [item] = next.splice(dragIndex.value, 1);
  next.splice(index, 0, item);
  stops.value = next; selectedStop.value = item; dragIndex.value = null; setDirty();
}
function resetOrder() {
  stops.value = originalStops.value.slice(); selectedStop.value = stops.value[0] || null;
  previewMapOverview.value = page.value?.mapOverview || props.initialMapOverview || {};
  previewMetrics.value = page.value?.driver || null;
  previewReturnLabel.value = page.value?.driver?.plannedReturnLabel || props.route.plannedReturnLabel || '等待重新计算';
  dirty.value = false; previewReady.value = false; pendingExpansionProposalId.value = null; message.value = '';
}
function addCandidate(candidate) {
  if (!candidate || candidate.blocked) return;
  stops.value = [...stops.value, candidate]; selectedStop.value = candidate; setDirty();
}
function removeStop(stop) {
  if (!stop) return;
  if (currentLock(stop)) {
    messageTone.value = 'warning'; message.value = '该客户当前存在司机保留关系，请先解除后再移除。'; return;
  }
  if (stops.value.length <= 1) {
    messageTone.value = 'warning'; message.value = '路线至少需要保留一个客户。'; return;
  }
  stops.value = stops.value.filter((item) => item._stopKey !== stop._stopKey);
  if (!candidates.value.some((item) => item._stopKey === stop._stopKey)) {
    candidates.value = [...candidates.value, stop];
  }
  selectedStop.value = stops.value[0] || null; setDirty();
}
function selectMarker(marker) {
  const matched = stops.value.find((stop) => marker?.depFatherId != null && stop.depFatherId != null && String(marker.depFatherId) === String(stop.depFatherId));
  if (matched) selectedStop.value = matched;
}

function currentLock(stop) {
  return (Array.isArray(planningState.value?.stopLocks) ? planningState.value.stopLocks : [])
    .find((item) => String(item.depFatherId) === String(stop?.depFatherId));
}
function isLockedToCurrentDriver(stop) {
  const lock = currentLock(stop);
  return Boolean(lock && String(lock.driverUserId) === String(props.route.driverUserId));
}
function lockButtonTitle(stop) {
  const lock = currentLock(stop);
  if (!lock) return `锁定给${props.route.driverName || '当前司机'}`;
  if (isLockedToCurrentDriver(stop)) return '解除这个客户与当前司机的锁定';
  return `已锁定给${lock.driverName || '其他司机'}`;
}
async function toggleStopLock(stop) {
  const lock = currentLock(stop);
  if (lock && !isLockedToCurrentDriver(stop)) {
    messageTone.value = 'warning'; message.value = `该客户已经锁定给${lock.driverName || '其他司机'}。`; return;
  }
  locking.value = true; message.value = '';
  try {
    const locked = isLockedToCurrentDriver(stop);
    const payload = buildPlanningStopLockPayload({
      planning: planningState.value,
      stop,
      driver: locked ? null : { driverUserId: props.route.driverUserId, driverName: props.route.driverName },
      routeDate: props.routeDate,
      batchCode: props.batchCode,
    });
    const result = await store.dispatch(locked ? 'dispatch/unlockPlanningStop' : 'dispatch/lockPlanningStop', payload);
    if (!result?.ok) { showError(result); return; }
    await loadRouteEditPage({ keepOriginal: true });
    emit('changed');
    messageTone.value = 'success';
    message.value = locked ? '已解除客户与当前司机的锁定。' : '客户已锁定给当前司机，重新规划时会保留。';
  } catch (error) {
    messageTone.value = 'error'; message.value = error?.message || '客户锁定更新失败';
  } finally { locking.value = false; }
}

function showError(result) {
  const presentation = dispatchErrorPresentation(result);
  messageTone.value = presentation.tone; message.value = presentation.message;
}
function optionalPositive(value, multiplier = 1) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * multiplier) : null;
}

function resolveProposedRouteStops(proposal) {
  if (!proposal || !Array.isArray(proposal.proposedStopKeys)) return [];
  const known = new Map();
  [...stops.value, ...candidates.value, ...(proposal.addedStops || [])]
    .forEach((item, index) => {
      const normalized = normalizeStops([item])[0];
      const key = normalized?._stopKey || `proposal-stop-${index}`;
      if (!known.has(key)) known.set(key, normalized);
    });
  return proposal.proposedStopKeys.map((key, index) => {
    const normalizedKey = String(key || '').trim();
    return known.get(normalizedKey) || normalizeStops([{
      stopKey: normalizedKey,
      customerName: `客户${index + 1}`,
    }])[0];
  });
}

function formatDistance(meters) {
  const value = Number(meters);
  return Number.isFinite(value) ? `${(value / 1000).toFixed(1)} 公里` : '--';
}

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return '--';
  const minutes = Math.round(value / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  return `${Math.floor(minutes / 60)}小时${minutes % 60}分`;
}

function formatDelta(before, after, formatter) {
  const left = Number(before); const right = Number(after);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return '—';
  const delta = right - left;
  if (Math.abs(delta) < 1) return '不变';
  return `${delta > 0 ? '+' : '-'}${formatter(Math.abs(delta))}`;
}

function buildExpansionMetricRows(proposal) {
  const before = proposal?.beforeMetrics || {};
  const after = proposal?.afterMetrics || {};
  return [
    ['道路距离', 'totalRoadDistanceM', formatDistance],
    ['驾驶时间', 'totalDriveDurationS', formatDuration],
    ['司机占用', 'activeRouteDurationS', formatDuration],
    ['等待时间', 'totalWaitingDurationS', formatDuration],
  ].map(([label, field, formatter]) => {
    const delta = Number(after[field]) - Number(before[field]);
    return {
      label,
      before: formatter(before[field]),
      after: formatter(after[field]),
      delta: formatDelta(before[field], after[field], formatter),
      tone: Number.isFinite(delta) && delta > 0 ? 'is-more' : 'is-less',
    };
  });
}

async function generateRouteExpansion() {
  if (dirty.value) {
    const previewed = await previewRoute();
    if (!previewed) return;
  }
  if (!page.value?.previewToken) {
    messageTone.value = 'warning'; message.value = '请先重新计算当前路线，再生成 AI 建议。'; return;
  }
  expanding.value = true; message.value = '';
  try {
    const payload = buildRouteExpansionPayload({
      route: props.route,
      routeDate: props.routeDate,
      batchCode: props.batchCode,
      previewToken: page.value.previewToken,
      maxActiveRouteDurationS: optionalPositive(maxActiveMinutes.value, 60),
      maxRoadDistanceM: optionalPositive(maxRoadKm.value, 1000),
    });
    const result = await store.dispatch('dispatch/previewRouteExpansion', payload);
    if (!result?.ok) { showError(result); return; }
    expansionProposal.value = result.data || {};
    expansionReviewVisible.value = true;
  } catch (error) {
    messageTone.value = 'error'; message.value = error?.message || 'AI 路线增补失败';
  } finally { expanding.value = false; }
}

function cancelExpansion() {
  expansionReviewVisible.value = false;
  expansionProposal.value = null;
}

async function adoptExpansion() {
  const proposal = expansionProposal.value;
  if (!proposal?.proposalId || !proposal?.addedStops?.length) return;
  const previousStops = stops.value.slice();
  const suggestedStops = proposedRouteStops.value;
  if (!suggestedStops.length) return;
  stops.value = suggestedStops;
  selectedStop.value = suggestedStops[0] || null;
  pendingExpansionProposalId.value = proposal.proposalId;
  expansionReviewVisible.value = false;
  setDirty();
  const previewed = await previewRoute(proposal.proposalId);
  if (!previewed) {
    stops.value = previousStops;
    selectedStop.value = previousStops[0] || null;
    dirty.value = false;
    previewReady.value = false;
    pendingExpansionProposalId.value = null;
    return;
  }
  expansionProposal.value = null;
  pendingExpansionProposalId.value = null;
  messageTone.value = 'success';
  message.value = 'AI 建议已进入路线预览；请核对地图和顺序后，再确认保存路线。';
}

async function previewRoute(proposalId = null) {
  previewing.value = true;
  try {
    const result = await store.dispatch('dispatch/previewRoute', routeRequestPayload(stopKeys(), proposalId));
    if (!result?.ok) { showError(result); return false; }
    const nextPage = result.data?.pageViewModel || result.data || {};
    page.value = { ...(page.value || {}), ...nextPage };
    const previewStops = normalizeStops(nextPage.routeStops || []);
    if (previewStops.length) {
      stops.value = previewStops;
      selectedStop.value = previewStops.find((stop) => stop._stopKey === selectedStop.value?._stopKey) || previewStops[0];
    }
    previewMapOverview.value = nextPage.mapOverview || previewMapOverview.value;
    previewMetrics.value = nextPage.driver || nextPage.topMetrics || null;
    previewReturnLabel.value = nextPage.driver?.plannedReturnLabel || nextPage.pageHeader?.plannedReturnLabel || props.route.plannedReturnLabel || '已重新计算';
    dirty.value = false;
    previewReady.value = Boolean(nextPage.actions?.confirmEnabled);
    if (previewReady.value) { messageTone.value = 'success'; message.value = '当前司机的路线已经重新计算，请确认地图和客户顺序后保存。'; }
    else { messageTone.value = 'warning'; message.value = nextPage.actions?.disabledReason || '服务端暂不允许保存这条路线。'; }
    return previewReady.value;
  } catch (error) {
    messageTone.value = 'error'; message.value = error?.message || '路线计算失败';
    return false;
  } finally { previewing.value = false; }
}
async function saveRoute() {
  saving.value = true; message.value = '';
  try {
    const payload = buildRouteEditConfirmPayload({
      route: props.route,
      stops: stops.value,
      stopKeys: stopKeys(),
      routeDate: props.routeDate,
      batchCode: props.batchCode,
      previewToken: page.value?.previewToken,
    });
    const result = await store.dispatch('dispatch/confirmRouteEdit', payload);
    if (!result?.ok) { showError(result); return; }
    emit('saved', result);
  } catch (error) {
    messageTone.value = 'error'; message.value = error?.message || '路线保存失败';
  } finally { saving.value = false; }
}
</script>

<style scoped>
.route-editor-backdrop { position: fixed; z-index: 1200; display: grid; inset: 0; place-items: center; padding: 20px; background: rgba(12, 28, 22, .62); backdrop-filter: blur(4px); }
.route-editor { display: flex; width: min(1320px, 96vw); height: min(870px, 94vh); min-height: 0; flex-direction: column; overflow: hidden; border-radius: 17px; background: #f6f9f7; box-shadow: 0 26px 90px rgba(6, 25, 18, .32); }
.route-editor__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex: none; padding: 15px 20px 12px; border-bottom: 1px solid #dfe8e3; background: #fff; }
.route-editor__header span, .route-editor__header h2, .route-editor__header p { margin: 0; }
.route-editor__header span { color: #14845d; font-size: 9px; font-weight: 800; }
.route-editor__header h2 { margin-top: 2px; color: #183128; font-size: 20px; }
.route-editor__header p { margin-top: 3px; color: #7c8b85; font-size: 9px; }
.route-editor__header > button { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid #d5dfda; border-radius: 9px; color: #687972; background: #fff; font-size: 22px; cursor: pointer; }
.route-editor__planner { display: flex; align-items: center; gap: 9px; flex: none; min-height: 48px; padding: 8px 16px; border-bottom: 1px solid #dfe8e3; background: #fbfdfc; }
.route-editor__planner > strong { margin-right: 3px; color: #2e463d; font-size: 10px; }
.route-editor__planner-copy { color: #6f8179; font-size: 8px; }
.route-editor__plan-action { padding: 7px 10px; border: 1px solid #cedbd5; border-radius: 8px; color: #65766f; background: #fff; font-size: 9px; font-weight: 800; cursor: pointer; }
.route-editor__planner label { display: flex; align-items: center; gap: 5px; }
.route-editor__planner input { width: 92px; padding: 7px 8px; border: 1px solid #cbd9d3; border-radius: 8px; outline: 0; font-size: 10px; }
.route-editor__planner label span, .route-editor__planner small { color: #7a8983; font-size: 8px; }
.route-editor__planner small { margin-left: auto; }
.route-editor__plan-action { border-color: #128b60; color: #fff; background: #128b60; }
.route-editor__body { display: grid; min-height: 0; flex: 1; grid-template-columns: minmax(540px, 1.55fr) minmax(390px, .85fr); gap: 10px; padding: 10px; }
.route-editor__map, .route-editor__order { display: flex; min-width: 0; min-height: 0; flex-direction: column; overflow: hidden; border: 1px solid #dae5df; border-radius: 12px; background: #fff; }
.route-editor__map { padding: 12px; }
.route-editor__map-head, .route-editor__order-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex: none; margin-bottom: 9px; }
.route-editor__map-head strong, .route-editor__order-head strong, .route-editor__candidates strong { color: #294038; font-size: 10px; }
.route-editor__map-head span, .route-editor__order-head span, .route-editor__candidates span { color: #7b8b85; font-size: 8px; }
.route-editor__order-head { padding: 11px 11px 0; }
.route-editor__order-head > div { display: flex; align-items: baseline; gap: 7px; }
.route-editor__order-head > button { padding: 5px 8px; border: 1px solid #d1ddd7; border-radius: 7px; color: #62736c; background: #fff; font-size: 8px; cursor: pointer; }
.route-editor__order ol { min-height: 120px; flex: 1 1 55%; overflow-y: auto; margin: 0; padding: 0 8px; list-style: none; }
.route-editor__order ol > li { display: grid; grid-template-columns: 16px minmax(0, 1fr) auto auto; gap: 4px; align-items: center; margin-bottom: 5px; padding: 5px; border: 1px solid #e0e8e4; border-radius: 8px; background: #fff; }
.route-editor__order ol > li.active { border-color: #62ba98; background: #eff9f5; }
.route-editor__order ol > li.dragging { opacity: .48; }
.route-editor__handle { color: #a3afaa; font-size: 12px; letter-spacing: -3px; cursor: grab; }
.route-editor__stop { display: grid; min-width: 0; grid-template-columns: 25px minmax(0, 1fr); gap: 7px; align-items: center; padding: 2px; border: 0; color: inherit; background: transparent; text-align: left; cursor: pointer; }
.route-editor__stop > span:first-child { display: grid; width: 24px; height: 24px; place-items: center; border-radius: 50%; color: #137b55; background: #dff2ea; font-size: 8px; font-weight: 900; }
.route-editor__stop > span:last-child { display: flex; min-width: 0; flex-direction: column; }
.route-editor__stop strong { overflow: hidden; color: #263c34; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.route-editor__stop small, .route-editor__candidates small { overflow: hidden; margin-top: 2px; color: #85918c; font-size: 7px; text-overflow: ellipsis; white-space: nowrap; }
.route-editor__stop-actions, .route-editor__move { display: flex; gap: 3px; }
.route-editor__stop-actions button, .route-editor__move button { min-width: 27px; height: 25px; padding: 0 5px; border: 1px solid #cedbd5; border-radius: 6px; color: #4d665d; background: #fff; font-size: 7px; cursor: pointer; }
.route-editor__stop-actions button.locked { border-color: #2c9d73; color: #12734f; background: #e7f6ef; }
.route-editor__stop-actions button.remove { color: #a45b5b; }
.route-editor__candidates { flex: 1 1 36%; min-height: 110px; overflow: hidden; margin: 5px 8px 0; padding-top: 7px; border-top: 1px solid #e4ebe7; }
.route-editor__candidates > div { display: flex; align-items: baseline; gap: 6px; margin: 0 3px 6px; }
.route-editor__candidates > input { box-sizing: border-box; width: calc(100% - 6px); margin: 0 3px 5px; padding: 6px 8px; border: 1px solid #d4dfda; border-radius: 7px; outline: 0; color: #344b42; background: #fbfdfc; font-size: 8px; }
.route-editor__candidates ul { max-height: 145px; overflow-y: auto; margin: 0; padding: 0; list-style: none; }
.route-editor__candidates li { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px; border-bottom: 1px solid #edf1ef; }
.route-editor__candidates li > span { display: flex; min-width: 0; flex-direction: column; }
.route-editor__candidates li button { flex: none; padding: 5px 7px; border: 1px solid #87cbb1; border-radius: 6px; color: #137b55; background: #f2faf7; font-size: 7px; cursor: pointer; }
.route-editor__return { display: grid; grid-template-columns: 29px minmax(0, 1fr) auto; gap: 8px; align-items: center; flex: none; margin: 5px 9px 8px; padding: 8px; border-top: 1px solid #e4ebe7; }
.route-editor__return span { display: grid; width: 27px; height: 27px; place-items: center; border-radius: 50%; color: #fff; background: #243b32; font-size: 8px; font-weight: 900; }
.route-editor__return strong { color: #3c5149; font-size: 9px; }
.route-editor__return small { color: #83908b; font-size: 8px; }
.route-editor__message { flex: none; margin: 0 10px 8px; padding: 7px 10px; border: 1px solid #b8dfcf; border-radius: 8px; color: #1c7253; background: #eff9f5; font-size: 9px; }
.route-editor__message.is-warning { border-color: #ead49f; color: #81631c; background: #fff9e9; }
.route-editor__message.is-error { border-color: #e9b9b9; color: #9b4141; background: #fff2f2; }
.route-expansion-backdrop { position: absolute; z-index: 20; display: grid; inset: 0; place-items: center; padding: 22px; background: rgba(12, 28, 22, .62); backdrop-filter: blur(3px); }
.route-expansion { display: flex; width: min(900px, 92vw); max-height: min(760px, 88vh); min-height: 0; flex-direction: column; overflow: hidden; border-radius: 15px; background: #f6f9f7; box-shadow: 0 22px 70px rgba(6, 25, 18, .35); }
.route-expansion > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; padding: 16px 18px; border-bottom: 1px solid #dce7e2; background: #eff9f5; }
.route-expansion > header span { color: #16805b; font-size: 9px; font-weight: 900; }
.route-expansion > header h3 { margin: 3px 0; color: #1e392f; font-size: 18px; }
.route-expansion > header p { margin: 0; color: #71827b; font-size: 9px; }
.route-expansion > header button { width: 31px; height: 31px; border: 1px solid #cbd9d3; border-radius: 8px; color: #62736c; background: #fff; font-size: 20px; cursor: pointer; }
.route-expansion__body { min-height: 0; overflow-y: auto; padding: 12px; }
.route-expansion__routes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.route-expansion__routes article { min-height: 125px; padding: 10px; border: 1px solid #dce7e2; border-radius: 10px; background: #fff; }
.route-expansion__routes article.is-added { border-color: #a8dbc7; background: #f2faf7; }
.route-expansion__routes article.is-final { border-color: #70bd9e; }
.route-expansion__routes article > div, .route-expansion__excluded > div { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.route-expansion__routes strong, .route-expansion__excluded strong { color: #294038; font-size: 10px; }
.route-expansion__routes span, .route-expansion__excluded span { color: #7a8b84; font-size: 8px; }
.route-expansion__routes ol { margin: 9px 0 0; padding: 0; list-style: none; }
.route-expansion__routes li { display: flex; gap: 6px; align-items: center; padding: 4px 0; color: #4d6159; font-size: 9px; }
.route-expansion__routes li b { display: grid; width: 19px; height: 19px; place-items: center; border-radius: 50%; color: #147b56; background: #dff2ea; font-size: 7px; }
.route-expansion__routes p, .route-expansion__excluded p { color: #86938e; font-size: 8px; }
.route-expansion__metrics { margin-top: 9px; overflow: hidden; border: 1px solid #dce7e2; border-radius: 10px; background: #fff; }
.route-expansion__metrics > div { display: grid; grid-template-columns: 1.2fr repeat(3, 1fr); gap: 8px; padding: 7px 10px; border-bottom: 1px solid #edf2ef; color: #687a72; font-size: 8px; }
.route-expansion__metrics > div:first-child { background: #f3f7f5; font-weight: 800; }
.route-expansion__metrics > div:last-child { border-bottom: 0; }
.route-expansion__metrics strong { color: #344b42; }
.route-expansion__metrics b { color: #167e5a; }
.route-expansion__metrics b.is-more { color: #976d24; }
.route-expansion__excluded { margin-top: 9px; padding: 10px; border: 1px solid #dce7e2; border-radius: 10px; background: #fff; }
.route-expansion__excluded ul { max-height: 120px; margin: 7px 0 0; padding: 0; overflow-y: auto; list-style: none; }
.route-expansion__excluded li { display: grid; grid-template-columns: minmax(120px, .6fr) 1.4fr; gap: 8px; padding: 5px 0; border-top: 1px solid #edf2ef; }
.route-expansion > footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 11px 16px; border-top: 1px solid #dce7e2; background: #fff; }
.route-expansion > footer > span { color: #7e8d87; font-size: 8px; }
.route-expansion > footer > div { display: flex; gap: 7px; }
.route-expansion > footer button { padding: 8px 12px; border: 1px solid #cbd9d3; border-radius: 8px; color: #536860; background: #fff; font-size: 9px; font-weight: 800; cursor: pointer; }
.route-expansion > footer button.primary { border-color: #128b60; color: #fff; background: #128b60; }
.route-editor__footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; flex: none; padding: 10px 15px; border-top: 1px solid #dce6e1; background: #fff; }
.route-editor__footer > span { color: #8b9792; font-size: 9px; }
.route-editor__footer > span.ready { color: #16805b; font-weight: 800; }
.route-editor__footer > div { display: flex; gap: 7px; }
.route-editor__footer button { padding: 8px 13px; border: 1px solid #cddad4; border-radius: 8px; color: #526860; background: #fff; font-size: 9px; font-weight: 800; cursor: pointer; }
.route-editor__footer button.primary { border-color: #128b60; color: #fff; background: #128b60; }
button:disabled { cursor: not-allowed !important; opacity: .38; }
</style>
