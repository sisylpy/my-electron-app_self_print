<template>
  <div class="route-editor-backdrop" role="presentation" @mousedown.self="closeEditor">
    <section class="route-editor" role="dialog" aria-modal="true" aria-labelledby="route-editor-title">
      <header class="route-editor__header">
        <div>
          <span>编辑路线</span>
          <h2 id="route-editor-title">
            {{ route.driverName || '当前司机' }}
            <em>{{ routePhaseLabel }}</em>
          </h2>
          <p>调整饭店部门顺序、增减站点或使用 AI 补充路线</p>
        </div>
        <button type="button" aria-label="关闭路线调整" :disabled="closing" @click="closeEditor">×</button>
      </header>

      <section v-if="page?.actions?.reassignDriverVisible" class="route-editor__reassign">
        <div>
          <strong>更换整条路线司机</strong>
          <span>客户、顺序、距离、时间和装车进度保持不变</span>
        </div>
        <button
          type="button"
          :disabled="busy || dirty || page.actions.reassignDriverEnabled === false"
          :title="page.actions.reassignDriverDisabledReason || ''"
          @click="reassignVisible = true"
        >{{ reassigning ? '更换中…' : '更换司机' }}</button>
      </section>

      <section class="route-editor__overview" aria-label="当前路线指标">
        <span><strong>{{ stops.length }} 站</strong></span>
        <span><strong>{{ editorDistanceLabel }}</strong></span>
        <span><strong>{{ editorDurationLabel }}</strong></span>
        <span><strong>建议出发 {{ plannedDepartLabel }}</strong></span>
        <span><strong>首站到达 {{ firstStopArrivalLabel }}</strong></span>
        <span><strong>{{ page?.routeEndLabel || (returnToDepotRequired ? '预计返回' : '预计完成') }} {{ previewReturnLabel }}</strong></span>
      </section>

      <div class="route-editor__body">
        <section class="route-editor__map">
          <div class="route-editor__map-head">
            <strong>路线预览</strong>
            <button type="button" @click="selectedStop = null">▱ 显示全部站点</button>
          </div>
          <div class="route-editor__map-viewport">
            <HuaweiDispatchMap
              :map-overview="previewMapOverview"
              :selected-stop="selectedStop"
              :selected-driver-user-id="route.driverUserId"
              @select-marker="selectMarker"
            />
          </div>

          <section class="route-editor__planner" :class="{ 'is-disabled': !expansionCapability.enabled }" aria-label="AI 路线增补">
            <div class="route-editor__planner-heading">
              <div>
                <strong>AI 补充饭店部门</strong>
                <span>按整条路线的工作时长、完成时间或里程生成建议</span>
              </div>
              <small>⌃</small>
            </div>
            <p v-if="!expansionCapability.enabled" class="route-editor__planner-disabled">{{ expansionCapability.message }}</p>
            <div v-else class="route-editor__constraint-grid">
              <label class="route-editor__duration-field">
                <span>工作时长</span>
                <span class="route-editor__duration-inputs">
                  <input v-model.trim="expansionForm.durationHours" type="number" min="0" max="24" step="1" placeholder="小时">
                  <em>时</em>
                  <input v-model.trim="expansionForm.durationMinutes" type="number" min="0" max="59" step="1" placeholder="分钟">
                  <em>分</em>
                </span>
              </label>
              <label>
                <span>最晚完成</span>
                <input v-model="expansionForm.latestFinishTime" type="time">
              </label>
              <label>
                <span>里程上限</span>
                <span class="route-editor__value-input"><input v-model.trim="expansionForm.maxRoadDistanceKm" type="number" min="0.001" max="2000" step="0.001" placeholder="公里"><em>公里</em></span>
              </label>
              <label>
                <span>最多新增</span>
                <span class="route-editor__value-input"><input v-model.trim="expansionForm.maxAddedStops" type="number" min="1" max="20" step="1" placeholder="家"><em>家</em></span>
              </label>
              <button type="button" class="route-editor__plan-action" :disabled="busy" @click="generateRouteExpansion">{{ expanding ? '正在分析…' : '生成 AI 建议' }}</button>
            </div>
            <p v-if="constraintError" class="route-editor__constraint-error">{{ constraintError }}</p>
            <p v-else-if="expansionCapability.enabled" class="route-editor__constraint-help">至少填写一项；AI 建议不会直接保存路线</p>
          </section>
        </section>

        <aside class="route-editor__order">
          <div class="route-editor__order-head">
            <div><strong>路线站点</strong><span>{{ stops.length }} 站</span><small>可拖动排序，也可使用上移、下移；锁定后 AI 不会移动该站点</small></div>
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
                <span class="route-editor__stop-copy">
                  <span class="route-editor__stop-title">
                    <strong>{{ stop.customerName || '未命名客户' }}</strong>
                    <em v-if="stop.windowRequirementLabel">{{ stop.windowRequirementLabel }}</em>
                    <em
                      v-if="currentLock(stop)"
                      class="route-editor__driver-lock"
                      :class="{ 'is-other-driver': !isLockedToCurrentDriver(stop) }"
                    >🔒 {{ stopLockLabel(stop) }}</em>
                  </span>
                  <small>{{ stop.goodsSummary || stop._customerAddress || '暂无商品摘要' }}</small>
                </span>
                <span class="route-editor__stop-times">
                  <b><small>{{ stop.arrivalFieldLabel || '到达' }}</small>{{ stop.plannedArrivalLabel || '—' }}</b>
                  <b><small>服务</small>{{ stop.serviceDurationLabel || stop.unloadDurationText || '—' }}</b>
                  <b><small>{{ stop.departureFieldLabel || '离开' }}</small>{{ stop.plannedDepartureLabel || '—' }}</b>
                </span>
              </button>
              <span class="route-editor__move">
                <button type="button" :disabled="index === 0 || busy" title="上移" @click="move(index, -1)">↑ 上移</button>
                <button type="button" :disabled="index === stops.length - 1 || busy" title="下移" @click="move(index, 1)">↓ 下移</button>
              </span>
              <span class="route-editor__stop-actions">
                <button
                  type="button"
                  :class="{ locked: isLockedToCurrentDriver(stop), 'other-driver-lock': currentLock(stop) && !isLockedToCurrentDriver(stop) }"
                  :disabled="busy || !stop.depFatherId"
                  :title="lockButtonTitle(stop)"
                  @click="toggleStopLock(stop)"
                >▣ {{ lockActionLabel(stop) }}</button>
                <button
                  type="button"
                  class="remove"
                  :disabled="busy"
                  title="从本次调整移除"
                  @click="removeStop(stop)"
                >移出</button>
              </span>
            </li>
          </ol>

          <div class="route-editor__return">
            <span>{{ returnToDepotRequired ? '仓' : '终' }}</span><strong>{{ routeEndName }}</strong><small>{{ previewReturnLabel }}</small>
          </div>

          <p class="route-editor__remove-note">ⓘ 移出路线后，该饭店部门将回到未分派池，可继续分给其他司机。</p>

          <section v-if="availableStops.length" class="route-editor__candidates">
            <div><strong>可加入饭店部门</strong><span>{{ availableStops.length }} 个</span><em>⌃</em></div>
            <input v-model.trim="candidateSearch" type="search" placeholder="⌕ 搜索饭店部门、地址或商品">
            <ul>
              <li v-for="candidate in filteredAvailableStops" :key="candidate._stopKey">
                <span class="route-editor__candidate-copy">
                  <strong>{{ candidate.customerName }}</strong>
                  <em
                    v-if="currentLock(candidate)"
                    class="route-editor__driver-lock"
                    :class="{ 'is-other-driver': !isLockedToCurrentDriver(candidate) }"
                  >🔒 {{ candidateLockLabel(candidate) }}</em>
                  <small>{{ candidate.constraintHint || candidate.goodsSummary || candidate._customerAddress }}</small>
                </span>
                <button
                  type="button"
                  :disabled="busy || candidate.blocked"
                  :title="candidateActionTitle(candidate)"
                  @click="addCandidate(candidate)"
                >{{ candidate.blocked ? '不可加入' : '加入' }}</button>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      <div v-if="message" class="route-editor__message" :class="`is-${messageTone}`">{{ message }}</div>

      <div v-if="expansionReviewVisible" class="route-expansion-backdrop" role="presentation">
        <section class="route-expansion" role="dialog" aria-modal="true" aria-labelledby="route-expansion-title">
          <header>
            <div>
              <span>AI 路线增补建议</span>
              <h3 id="route-expansion-title">先看变化，再决定是否采用</h3>
              <p>{{ expansionResultSummary }}</p>
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
                <p v-else>{{ expansionEmptyExplanation }}</p>
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

            <section class="route-expansion__summary-grid">
              <article>
                <div><strong>实际约束</strong><span>全部同时满足</span></div>
                <ul>
                  <li v-for="item in expansionConstraintRows" :key="item.label"><span>{{ item.label }}</span><b>{{ item.value }}</b></li>
                </ul>
              </article>
              <article>
                <div><strong>来源路线调整</strong><span>{{ expansionSourceRoutes.length }} 条</span></div>
                <ul v-if="expansionSourceRoutes.length">
                  <li v-for="item in expansionSourceRoutes" :key="item.driverUserId">
                    <span>{{ item.driverName || `司机${item.driverUserId}` }}</span>
                    <b>{{ item.movedCount }} 家调入 · {{ item.routeEmptied ? '原路线清空' : `剩余${item.afterStopCount || 0}家` }}</b>
                  </li>
                </ul>
                <p v-else>本次没有调整其他司机路线。</p>
              </article>
            </section>

            <section class="route-expansion__analysis">
              <div><strong>试算结果</strong><span>沙箱重平衡·不改正式路线</span></div>
              <dl>
                <div v-for="item in expansionAnalysisRows" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
              </dl>
            </section>

            <section v-if="candidateExclusionRows.length" class="route-expansion__excluded">
              <div><strong>候选排除原因</strong><span>{{ candidateExclusionRows.length }} 类</span></div>
              <ul>
                <li v-for="item in candidateExclusionRows" :key="item.reason"><strong>{{ item.label }}</strong><span>{{ item.count }} 家</span></li>
              </ul>
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
              <button type="button" class="primary" :disabled="!expansionProposal?.addedStops?.length || busy" @click="adoptExpansion">采用并进入路线预览</button>
            </div>
          </footer>
        </section>
      </div>

      <div v-if="reassignVisible" class="route-reassign-backdrop" role="presentation" @mousedown.self="reassignVisible = false">
        <section class="route-reassign" role="dialog" aria-modal="true" aria-labelledby="route-reassign-title">
          <header>
            <div><span>装车中路线</span><h3 id="route-reassign-title">选择接管司机</h3><p>仅展示服务端确认的沙箱空闲可派司机。</p></div>
            <button type="button" :disabled="reassigning" @click="reassignVisible = false">×</button>
          </header>
          <div class="route-reassign__list">
            <button
              v-for="candidate in page?.reassignDriverCandidates || []"
              :key="candidate.driverUserId"
              type="button"
              :disabled="reassigning"
              @click="submitRouteReassignment(candidate)"
            >
              <b>司</b>
              <span><strong>{{ candidate.driverName || `司机${candidate.driverUserId}` }}</strong><small>{{ candidate.driverPhone || '未登记手机号' }} · {{ candidate.statusLabel || '空闲可派' }}</small></span>
              <em>选择</em>
            </button>
            <p v-if="!page?.reassignDriverCandidates?.length">当前没有可接管路线的沙箱司机。</p>
          </div>
        </section>
      </div>

      <footer class="route-editor__footer">
        <span :class="{ ready: previewReady && !dirty }">{{ footerHint }}</span>
        <div>
          <button type="button" :disabled="busy || closing" @click="closeEditor">{{ closing ? '正在关闭…' : '取消' }}</button>
          <button type="button" :disabled="!dirty || busy" @click="previewRoute">{{ previewing ? '正在计算…' : '重新计算路线' }}</button>
          <button type="button" class="primary" :disabled="!previewReady || dirty || busy" @click="saveRoute">{{ saving ? '正在保存…' : '保存并确认路线' }}</button>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useStore } from 'vuex';
import HuaweiDispatchMap from '@/modules/map/components/HuaweiStyledDispatchMap.vue';
import {
  buildPlanningStopLockPayload,
  buildReturnStopToSandboxCommand,
  buildRouteEditConfirmPayload,
  buildRouteExpansionPayload,
  buildRoutePreviewReleasePayload,
  buildRoutePreviewPayload,
  buildRouteReassignmentConfirmPayload,
  buildRouteReassignmentPreviewPayload,
  dispatchErrorPresentation,
} from '../services/writeContract';

const props = defineProps({
  route: { type: Object, required: true },
  routeDate: { type: String, required: true },
  batchCode: { type: String, default: 'MORNING' },
  initialMapOverview: { type: Object, default: () => ({}) },
  planning: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['close', 'saved', 'changed', 'stale']);
const store = useStore();
const page = ref(null);
const loading = ref(false);
const originalStops = ref(normalizeStops(props.route._stops || []));
const stops = ref(originalStops.value.slice());
const candidates = ref([]);
const selectedStop = ref(stops.value[0] || null);
const previewMapOverview = ref(props.initialMapOverview || {});
const previewMetrics = ref(null);
const previewReturnLabel = ref(
  props.route.plannedReturnLabel || props.route.plannedFinishLabel || '等待重新计算'
);
const dirty = ref(false);
const previewReady = ref(false);
const previewing = ref(false);
const saving = ref(false);
const removing = ref(false);
const locking = ref(false);
const expanding = ref(false);
const expansionProposal = ref(null);
const expansionReviewVisible = ref(false);
const pendingExpansionProposalId = ref(null);
const pendingRemovedStopKeys = ref([]);
const pendingRemovalCommandId = ref('');
const reassignVisible = ref(false);
const reassigning = ref(false);
const closing = ref(false);
const previewReleased = ref(false);
const expansionForm = reactive({
  durationHours: '',
  durationMinutes: '',
  latestFinishTime: '',
  maxRoadDistanceKm: '',
  maxAddedStops: '',
});
const constraintError = ref('');
let expansionDefaultsInitialized = false;
const candidateSearch = ref('');
const message = ref('');
const messageTone = ref('success');
const dragIndex = ref(null);
const busy = computed(() => loading.value || previewing.value || saving.value || locking.value
  || expanding.value || removing.value || reassigning.value);
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
  return distance || duration ? `当前约 ${distance || '--'} · ${duration || '--'}` : '当前路线指标以服务端为准';
});
const editorMetricSource = computed(() => previewMetrics.value || page.value?.driver || props.route || {});
const editorDistanceLabel = computed(() => (
  editorMetricSource.value.totalRoundTripDistanceText
  || editorMetricSource.value.totalDistanceText
  || '等待试算'
));
const editorDurationLabel = computed(() => (
  editorMetricSource.value.totalRoundTripDurationText
  || editorMetricSource.value.totalDurationText
  || editorMetricSource.value.durationText
  || '等待试算'
));
const plannedDepartLabel = computed(() => (
  editorMetricSource.value.plannedDepartLabel
  || editorMetricSource.value.suggestedDepartureLabel
  || props.route.plannedDepartLabel
  || '—'
));
const firstStopArrivalLabel = computed(() => (
  stops.value[0]?.plannedArrivalLabel
  || stops.value[0]?.timeRight
  || props.route.firstStopPlannedArrivalLabel
  || '—'
));
const routePhaseLabel = computed(() => {
  const phase = String(props.route._phase || props.route.phase || '').toLowerCase();
  if (phase === 'loading') return '装车中';
  if (phase === 'delivery') return '配送中';
  return '分派中';
});
const routeEstimateLabel = computed(() => {
  if (previewing.value) return '路线计算中';
  if (dirty.value) return '路线已改变，需重新计算';
  if (previewReady.value) return '路线试算已完成';
  return '当前显示服务端权威路线';
});
const expansionCapability = computed(() => {
  const source = page.value || props.route || {};
  const policy = source.candidatePolicy
    || props.route.candidatePolicy
    || props.route.routeEditAction?.candidatePolicy;
  if (policy !== 'SANDBOX_REBALANCE') {
    return {
      enabled: false,
      message: '路线增补合同已更新，请刷新页面或升级桌面端',
    };
  }
  const enabled = source.canExpandRoute === true
    || (source.canExpandRoute == null && props.route.canExpandRoute === true);
  return {
    enabled,
    message: enabled
      ? ''
      : (source.expandDisabledMessage || props.route.expandDisabledMessage || '当前路线不可执行AI增补'),
  };
});
const returnToDepotRequired = computed(() => {
  const value = page.value?.returnToDepotRequired
    ?? page.value?.driver?.returnToDepot
    ?? props.route.returnToDepotRequired
    ?? props.route.returnToDepot;
  return value !== false;
});
const routeEndName = computed(() => (
  returnToDepotRequired.value ? '返回仓库' : '最后一家完成后结束'
));
const routeEndPolicyLabel = computed(() => (
  returnToDepotRequired.value ? '专职口径：终点为仓库' : '兼职口径：终点为最后一家饭店部门'
));
const proposedRouteStops = computed(() => resolveProposedRouteStops(expansionProposal.value));
const expansionMetricRows = computed(() => buildExpansionMetricRows(expansionProposal.value));
const expansionConstraintRows = computed(() => buildExpansionConstraintRows(expansionProposal.value));
const expansionSourceRoutes = computed(() => (
  (Array.isArray(expansionProposal.value?.sourceRouteChanges)
    ? expansionProposal.value.sourceRouteChanges
    : (Array.isArray(expansionProposal.value?.affectedRoutes)
      ? expansionProposal.value.affectedRoutes.filter((route) => !route.targetRoute)
      : [])).map((route) => ({
      ...route,
      movedCount: Math.max(0, Number(route.beforeStopCount || 0) - Number(route.afterStopCount || 0)),
    }))
));
const expansionAnalysisRows = computed(() => [
  { label: '可移动候选', value: `${Number(expansionProposal.value?.candidatePoolCount || 0)} 家` },
  { label: '试算方案', value: `${Number(expansionProposal.value?.evaluatedRouteStateCount || 0)} 个` },
  { label: '新增客户', value: `${Number(expansionProposal.value?.addedStopCount || 0)} 家` },
  { label: '受影响路线', value: `${Number(expansionProposal.value?.affectedRouteCount || 1)} 条` },
  {
    label: '停止原因',
    value: expansionProposal.value?.searchStopReason || expansionProposal.value?.searchStopReasonCode || '已完成全部试算',
  },
]);
const candidateExclusionRows = computed(() => {
  const summary = expansionProposal.value?.candidateExclusionSummary || {};
  return Object.entries(summary).map(([reason, count]) => ({
    reason,
    count,
    label: exclusionReasonLabel(reason),
  }));
});
const expansionEmptyExplanation = computed(() => {
  if (Number(expansionProposal.value?.candidatePoolCount || 0) > 0) {
    return expansionProposal.value?.searchStopReason
      || '候选已进入路线试算，但没有方案能同时满足全部硬约束。';
  }
  if (candidateExclusionRows.value.length) {
    return `没有客户进入路线试算：${candidateExclusionRows.value
      .map((item) => `${item.label}${item.count}家`)
      .join('；')}。`;
  }
  return expansionProposal.value?.searchStopReason
    || '当前沙箱没有可移动或真正未分配的客户。';
});
const expansionResultSummary = computed(() => {
  if (!expansionProposal.value) return '建议不会直接修改正式路线。';
  if (Number(expansionProposal.value.addedStopCount || 0) > 0) {
    return expansionProposal.value.summary || '已生成可采用的路线增补建议。';
  }
  return expansionEmptyExplanation.value;
});

onMounted(loadRouteEditPage);
onBeforeUnmount(() => {
  void releaseActivePreview();
});

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

function routeRequestPayload(keys = stopKeys(), proposalId = null, options = {}) {
  const includePreviewToken = options.includePreviewToken !== false;
  return buildRoutePreviewPayload({
    route: effectiveRoute(),
    stopKeys: keys,
    routeDate: props.routeDate,
    batchCode: props.batchCode,
    previewToken: includePreviewToken ? page.value?.previewToken : null,
    routeExpansionProposalId: proposalId,
    removedStopKeys: options.includeRemovals === false ? [] : pendingRemovedStopKeys.value,
    removalCommandId: options.includeRemovals === false ? '' : pendingRemovalCommandId.value,
    initialAddStopKeys: options.initialAddStopKeys || [],
  });
}

function effectiveRoute() {
  return {
    ...props.route,
    ...(page.value?.driver || {}),
    _phase: props.route._phase,
    _routeEditPayload: props.route._routeEditPayload,
    _routeEditPage: page.value,
    _stops: Array.isArray(props.route._stops) ? props.route._stops : [],
  };
}

async function releaseActivePreview() {
  const token = page.value?.previewToken;
  if (!token || previewReleased.value) return;
  previewReleased.value = true;
  try {
    const payload = buildRoutePreviewReleasePayload({
      route: effectiveRoute(),
      routeDate: props.routeDate,
      batchCode: props.batchCode,
      previewToken: token,
    });
    const result = await store.dispatch('dispatch/releaseRoutePreview', payload);
    if (!result?.ok) previewReleased.value = false;
  } catch (ignored) {
    // 关闭编辑页必须继续；服务端 TTL 仍是网络失败时的最终保护。
    previewReleased.value = false;
  }
}

async function closeEditor() {
  if (closing.value) return;
  closing.value = true;
  await releaseActivePreview();
  emit('close');
}

async function loadRouteEditPage(options = {}) {
  loading.value = true;
  try {
    const initialAdds = !page.value && props.route._routeEditPayload?.manualDispatch === true
      ? (props.route._routeEditPayload.initialAddStopKeys
        || props.route._routeEditPayload.stopKeys
        || stopKeys())
      : [];
    const result = await store.dispatch('dispatch/loadRouteEditPage', routeRequestPayload(
      [],
      null,
      {
        includePreviewToken: false,
        includeRemovals: false,
        initialAddStopKeys: initialAdds,
      }
    ));
    if (!result?.ok) { showError(result, 'page'); return; }
    const nextPage = result.data?.pageViewModel || result.data || {};
    page.value = nextPage;
    const loadedStops = normalizeStops(nextPage.routeStops || []);
    if (Array.isArray(nextPage.routeStops)) {
      stops.value = loadedStops;
      selectedStop.value = loadedStops.find((stop) => stop._stopKey === selectedStop.value?._stopKey)
        || loadedStops[0]
        || null;
      if (!options.keepOriginal) {
        originalStops.value = loadedStops.slice();
      }
    }
    candidates.value = normalizeStops(nextPage.availableCustomers || nextPage.addableStops || []);
    previewMapOverview.value = nextPage.mapOverview || previewMapOverview.value;
    previewMetrics.value = nextPage.driver || null;
    previewReturnLabel.value = nextPage.driver?.plannedReturnLabel
      || nextPage.driver?.plannedFinishLabel
      || nextPage.routeEndTimeLabel
      || nextPage.pageHeader?.plannedReturnLabel
      || previewReturnLabel.value;
    initializeExpansionDefaults(nextPage.expansionConstraintDefaults);
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
  previewReturnLabel.value = page.value?.driver?.plannedReturnLabel
    || page.value?.driver?.plannedFinishLabel
    || page.value?.routeEndTimeLabel
    || props.route.plannedReturnLabel
    || props.route.plannedFinishLabel
    || '等待重新计算';
  pendingRemovedStopKeys.value = [];
  pendingRemovalCommandId.value = '';
  dirty.value = false; previewReady.value = false; pendingExpansionProposalId.value = null; message.value = '';
}
function addCandidate(candidate) {
  if (!candidate || candidate.blocked) return;
  stops.value = [...stops.value, candidate];
  pendingRemovedStopKeys.value = pendingRemovedStopKeys.value.filter(
    (key) => key !== candidate._stopKey
  );
  if (!pendingRemovedStopKeys.value.length) pendingRemovalCommandId.value = '';
  selectedStop.value = candidate; setDirty();
  const lock = currentLock(candidate);
  if (lock && !isLockedToCurrentDriver(candidate)) {
    messageTone.value = 'warning';
    message.value = `${candidate.customerName || '该饭店部门'}当前锁定给${lockDriverName(lock)}；确认改派给${props.route.driverName || '当前司机'}后，原司机锁将自动取消。`;
  }
}
async function removeStop(stop) {
  if (!stop) return;
  if (props.route._phase === 'loading') {
    if (!window.confirm(stop.removeConfirmMessage || '移除后该客户将回到待分配区域，是否确认？')) return;
    removing.value = true;
    message.value = '';
    try {
      const command = buildReturnStopToSandboxCommand({
        stop,
        routeDate: props.routeDate,
        batchCode: props.batchCode,
      });
      const result = await store.dispatch('dispatch/returnStopToSandbox', command);
      if (!result?.ok) { showError(result); return; }
      if (result.data?.exitedLoading) {
        emit('saved', result);
        return;
      }
      await loadRouteEditPage();
      emit('changed');
      messageTone.value = 'success';
      message.value = '客户已从装车路线移除，并回到待分配区域。';
    } catch (error) {
      messageTone.value = 'error';
      message.value = error?.message || '移除客户失败';
    } finally {
      removing.value = false;
    }
    return;
  }
  stops.value = stops.value.filter((item) => item._stopKey !== stop._stopKey);
  if (!candidates.value.some((item) => item._stopKey === stop._stopKey)) {
    candidates.value = [...candidates.value, stop];
  }
  if (originalStops.value.some((item) => item._stopKey === stop._stopKey)) {
    pendingRemovedStopKeys.value = [...new Set([
      ...pendingRemovedStopKeys.value,
      stop._stopKey,
    ])];
    if (!pendingRemovalCommandId.value) {
      pendingRemovalCommandId.value = `owner-remove-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
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
function lockDriverName(lock) {
  return lock?.driverName || (lock?.driverUserId != null ? `司机${lock.driverUserId}` : '其他司机');
}
function stopLockLabel(stop) {
  const lock = currentLock(stop);
  if (!lock) return '';
  if (isLockedToCurrentDriver(stop)) return `已锁定给${props.route.driverName || '当前司机'}`;
  return `已锁定给${lockDriverName(lock)} · 保存改派后自动取消`;
}
function candidateLockLabel(candidate) {
  const lock = currentLock(candidate);
  if (!lock) return '';
  if (isLockedToCurrentDriver(candidate)) return `已锁定给${props.route.driverName || '当前司机'}`;
  return `已锁定给${lockDriverName(lock)}；加入并保存后自动取消原锁`;
}
function lockActionLabel(stop) {
  const lock = currentLock(stop);
  if (!lock) return '锁定';
  if (isLockedToCurrentDriver(stop)) return '已锁';
  return `原锁:${lockDriverName(lock)}`;
}
function candidateActionTitle(candidate) {
  if (candidate?.blocked) return candidate.blockedReason || '当前不可加入';
  const lock = currentLock(candidate);
  if (lock && !isLockedToCurrentDriver(candidate)) {
    return `加入当前路线；确认保存后自动取消${lockDriverName(lock)}的当日锁定`;
  }
  return '加入当前司机路线';
}
function lockButtonTitle(stop) {
  const lock = currentLock(stop);
  if (!lock) return `锁定给${props.route.driverName || '当前司机'}`;
  if (isLockedToCurrentDriver(stop)) return '解除这个客户与当前司机的锁定';
  return `已锁定给${lockDriverName(lock)}；确认改派后会自动取消原锁`;
}
async function toggleStopLock(stop) {
  const lock = currentLock(stop);
  if (lock && !isLockedToCurrentDriver(stop)) {
    messageTone.value = 'warning'; message.value = `该客户已经锁定给${lockDriverName(lock)}；无需手动解锁，确认改派后会自动取消原锁。`; return;
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

function showError(result, context = '') {
  const presentation = dispatchErrorPresentation(result);
  messageTone.value = presentation.tone; message.value = presentation.message;
  if (presentation.refresh) {
    expansionProposal.value = null;
    expansionReviewVisible.value = false;
    pendingExpansionProposalId.value = null;
    previewReady.value = false;
    if (context === 'page') {
      emit('stale', presentation.message);
    } else {
      message.value = `${presentation.message}。当前编辑内容仍保留，请重新计算；如状态仍冲突，再关闭后重新打开。`;
    }
  }
  if (presentation.roadUnavailable) {
    message.value = 'Huawei道路服务暂不可用，未生成直线距离建议，请稍后重试。';
  }
}

function initializeExpansionDefaults(defaults = {}) {
  if (expansionDefaultsInitialized) return;
  const durationS = Number(defaults?.maxActiveRouteDurationS);
  if (Number.isFinite(durationS) && durationS > 0) {
    expansionForm.durationHours = String(Math.floor(durationS / 3600));
    expansionForm.durationMinutes = String(Math.floor((durationS % 3600) / 60));
  }
  const finishMatch = String(defaults?.latestRouteFinishAt || '').match(/T(\d{2}:\d{2})/);
  if (finishMatch) expansionForm.latestFinishTime = finishMatch[1];
  const distanceM = Number(defaults?.maxRoadDistanceM);
  if (Number.isFinite(distanceM) && distanceM > 0) {
    expansionForm.maxRoadDistanceKm = String(distanceM / 1000);
  }
  const maxAdded = Number(defaults?.maxAddedStops);
  if (Number.isSafeInteger(maxAdded) && maxAdded > 0) {
    expansionForm.maxAddedStops = String(maxAdded);
  }
  expansionDefaultsInitialized = true;
}

function parseWhole(value, label, { max, positive = false } = {}) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) throw new Error(`${label}必须是整数`);
  const number = Number(text);
  if (!Number.isSafeInteger(number) || (positive && number <= 0)) {
    throw new Error(`${label}必须大于0`);
  }
  if (max != null && number > max) throw new Error(`${label}不能超过${max}`);
  return number;
}

function buildExpansionConstraints() {
  const hours = parseWhole(expansionForm.durationHours, '工作时长小时', { max: 24 }) ?? 0;
  const minutes = parseWhole(expansionForm.durationMinutes, '工作时长分钟', { max: 59 }) ?? 0;
  const durationConfigured = String(expansionForm.durationHours).trim()
    || String(expansionForm.durationMinutes).trim();
  const maxActiveRouteDurationS = durationConfigured ? hours * 3600 + minutes * 60 : null;
  if (durationConfigured && maxActiveRouteDurationS <= 0) {
    throw new Error('可工作时长必须大于0');
  }
  let latestRouteFinishAt = null;
  if (String(expansionForm.latestFinishTime || '').trim()) {
    const time = String(expansionForm.latestFinishTime).trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
        || !/^\d{4}-\d{2}-\d{2}$/.test(props.routeDate)) {
      throw new Error('最晚完成时间格式无效');
    }
    latestRouteFinishAt = `${props.routeDate}T${time}:00+08:00`;
  }
  let maxRoadDistanceM = null;
  if (String(expansionForm.maxRoadDistanceKm || '').trim()) {
    const text = String(expansionForm.maxRoadDistanceKm).trim();
    if (!/^\d+(?:\.\d{1,3})?$/.test(text)) {
      throw new Error('全程距离请填写最多三位小数的正数');
    }
    const km = Number(text);
    if (!(km > 0) || km > 2000) throw new Error('全程距离必须大于0且不超过2000公里');
    maxRoadDistanceM = Math.round(km * 1000);
  }
  const maxAddedStops = parseWhole(expansionForm.maxAddedStops, '最多新增饭店部门', {
    max: 20,
    positive: true,
  });
  if (!maxActiveRouteDurationS && !latestRouteFinishAt && !maxRoadDistanceM) {
    throw new Error('可工作时长、最晚完成时间、全程距离上限至少填写一项');
  }
  return {
    maxActiveRouteDurationS,
    latestRouteFinishAt,
    maxRoadDistanceM,
    maxAddedStops,
  };
}

function exclusionReasonLabel(reason) {
  const labels = {
    MANUAL_DRIVER_LOCK: '人工司机锁',
    MANUAL_STOP_SEQUENCE_LOCK: '人工站序锁',
    MANUAL_REMOVAL_HOLD: '明确人工移除保护',
    FORMAL_ROUTE_OR_TASK: '已进入正式路线或任务',
    FORMAL_STATE_UNKNOWN: '正式状态无法确认',
    NO_FORMAL_ASSIGNMENT: '无正式归属',
    ACTIVE_MANUAL_PREVIEW: '其他司机编辑窗口正在占用',
    ACTIVE_EDIT_PREVIEW: '其他司机编辑窗口正在占用',
    INVALID_COORDINATE: '缺少有效坐标',
    MISSING_COORDINATE: '缺少有效坐标',
    SOURCE_ROUTE_NOT_RECALCULABLE: '来源路线无法安全重算',
    SANDBOX_DUPLICATE_OWNERSHIP: '沙箱客户出现重复归属',
    CANONICAL_OWNERSHIP_MISSING: '沙箱客户归属证据缺失',
    TIME_WINDOW_INFEASIBLE: '配送时间窗不可行',
    LEGACY_INFERRED_REMOVAL: '旧版推断删除（不视为人工意图）',
    ALGORITHMIC_TRANSIENT: '算法临时状态',
    OTHER_SANDBOX_SUGGESTION: '其他司机可移动沙箱建议',
  };
  return labels[reason] || reason;
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

function formatFinishAt(value) {
  const match = String(value || '').match(/T(\d{2}:\d{2})/);
  return match ? match[1] : '未设置';
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
    ['服务时间', 'totalServiceDurationS', formatDuration],
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

function buildExpansionConstraintRows(proposal) {
  const effective = proposal?.constraints?.effective || proposal?.constraints?.requested || {};
  return [
    {
      label: '最大工作时长',
      value: effective.maxActiveRouteDurationS == null
        ? '未设置'
        : formatDuration(effective.maxActiveRouteDurationS),
    },
    {
      label: '最晚完成时间',
      value: formatFinishAt(effective.latestRouteFinishAt),
    },
    {
      label: '最大道路距离',
      value: effective.maxRoadDistanceM == null
        ? '未设置'
        : formatDistance(effective.maxRoadDistanceM),
    },
    {
      label: '最多新增',
      value: effective.maxAddedStops == null ? '未设置' : `${effective.maxAddedStops} 家`,
    },
  ];
}

async function generateRouteExpansion() {
  if (!expansionCapability.value.enabled) {
    messageTone.value = 'warning';
    message.value = expansionCapability.value.message;
    return;
  }
  if (dirty.value) {
    const previewed = await previewRoute();
    if (!previewed) return;
  }
  if (!page.value?.previewToken) {
    messageTone.value = 'warning'; message.value = '请先重新计算当前路线，再生成 AI 建议。'; return;
  }
  let constraints;
  try {
    constraints = buildExpansionConstraints();
    constraintError.value = '';
  } catch (error) {
    constraintError.value = error?.message || 'AI增补条件无效';
    messageTone.value = 'warning';
    message.value = constraintError.value;
    return;
  }
  expanding.value = true; message.value = '';
  try {
    const payload = buildRouteExpansionPayload({
      route: effectiveRoute(),
      routeDate: props.routeDate,
      batchCode: props.batchCode,
      previewToken: page.value.previewToken,
      ...constraints,
    });
    const result = await store.dispatch('dispatch/previewRouteExpansion', payload);
    if (!result?.ok) { showError(result, 'expansion'); return; }
    if (result.data?.candidatePolicy !== 'SANDBOX_REBALANCE') {
      showError({
        status: 409,
        errorCode: 'ROUTE_EXPANSION_CLIENT_CONTRACT_MISMATCH',
        message: '服务端候选策略已变化，请刷新或升级后重试',
      }, 'expansion');
      return;
    }
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
  await emit('changed');
  messageTone.value = 'success';
  message.value = 'AI建议已原子更新沙箱组合并进入路线预览；其他受影响司机路线已刷新。';
}

async function previewRoute(proposalId = null) {
  previewing.value = true;
  try {
    const result = await store.dispatch('dispatch/previewRoute', routeRequestPayload(stopKeys(), proposalId));
    if (!result?.ok) { showError(result, proposalId ? 'adoption' : 'preview'); return false; }
    const nextPage = result.data?.pageViewModel || result.data || {};
    page.value = { ...(page.value || {}), ...nextPage };
    const previewStops = normalizeStops(nextPage.routeStops || []);
    if (Array.isArray(nextPage.routeStops)) {
      stops.value = previewStops;
      selectedStop.value = previewStops.find((stop) => stop._stopKey === selectedStop.value?._stopKey)
        || previewStops[0]
        || null;
    }
    previewMapOverview.value = nextPage.mapOverview || previewMapOverview.value;
    previewMetrics.value = nextPage.driver || nextPage.topMetrics || null;
    previewReturnLabel.value = nextPage.driver?.plannedReturnLabel
      || nextPage.driver?.plannedFinishLabel
      || nextPage.routeEndTimeLabel
      || nextPage.pageHeader?.plannedReturnLabel
      || props.route.plannedReturnLabel
      || props.route.plannedFinishLabel
      || '已重新计算';
    pendingRemovedStopKeys.value = [];
    pendingRemovalCommandId.value = '';
    dirty.value = false;
    previewReady.value = Boolean(nextPage.actions?.confirmEnabled);
    if (previewReady.value) {
      const reassignedLockCount = stops.value.filter(
        (stop) => currentLock(stop) && !isLockedToCurrentDriver(stop)
      ).length;
      messageTone.value = reassignedLockCount ? 'warning' : 'success';
      message.value = reassignedLockCount
        ? `路线已经重新计算；保存后将自动取消${reassignedLockCount}个原司机的当日锁定。`
        : '当前司机的路线已经重新计算，请确认地图、时间和客户顺序后保存。';
    }
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
      route: effectiveRoute(),
      stops: stops.value,
      stopKeys: stopKeys(),
      routeDate: props.routeDate,
      batchCode: props.batchCode,
      previewToken: page.value?.previewToken,
    });
    const result = await store.dispatch('dispatch/confirmRouteEdit', payload);
    if (!result?.ok) { showError(result, 'confirm'); return; }
    previewReleased.value = true;
    emit('saved', result);
  } catch (error) {
    messageTone.value = 'error'; message.value = error?.message || '路线保存失败';
  } finally { saving.value = false; }
}

async function submitRouteReassignment(candidate) {
  if (reassigning.value || !candidate) return;
  const currentDriverName = page.value?.driver?.driverName || props.route.driverName || '当前司机';
  const targetName = candidate.driverName || '目标司机';
  if (!window.confirm(`确认将整条装车路线从“${currentDriverName}”交给“${targetName}”？\n客户、顺序和路线数据不会改变。`)) return;
  reassigning.value = true;
  message.value = '';
  try {
    const previewPayload = buildRouteReassignmentPreviewPayload({
      route: { ...effectiveRoute(), _stops: stops.value },
      candidate,
      routeDate: props.routeDate,
      batchCode: props.batchCode,
      previewToken: page.value?.previewToken,
    });
    const previewResult = await store.dispatch('dispatch/previewRouteReassignment', previewPayload);
    if (!previewResult?.ok) { showError(previewResult); return; }
    const previewPage = previewResult.data?.pageViewModel || previewResult.data || {};
    const confirmPayload = buildRouteReassignmentConfirmPayload({ previewPayload, previewPage });
    const confirmResult = await store.dispatch('dispatch/confirmRouteReassignment', confirmPayload);
    if (!confirmResult?.ok) { showError(confirmResult); return; }
    if (!confirmResult.data?.routeReassigned) {
      messageTone.value = 'error';
      message.value = '服务端未确认路线换绑，请刷新后重试。';
      return;
    }
    reassignVisible.value = false;
    emit('saved', confirmResult);
  } catch (error) {
    messageTone.value = 'error';
    message.value = error?.message || '更换路线司机失败';
  } finally {
    reassigning.value = false;
  }
}
</script>

<style scoped>
.route-editor-backdrop { position: fixed; z-index: 1200; display: grid; inset: 0; place-items: center; padding: 20px; background: rgba(12, 28, 22, .62); backdrop-filter: blur(4px); }
.route-editor { position: relative; display: flex; width: min(1320px, 96vw); height: min(870px, 94vh); min-height: 0; flex-direction: column; overflow: hidden; border-radius: 17px; background: #f6f9f7; box-shadow: 0 26px 90px rgba(6, 25, 18, .32); }
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
.route-editor__reassign { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 16px; border-bottom: 1px solid #dfe8e3; background: #f1f8f5; }
.route-editor__reassign div { display: flex; flex-direction: column; }
.route-editor__reassign strong { color: #23483b; font-size: 10px; }
.route-editor__reassign span { margin-top: 2px; color: #778a82; font-size: 8px; }
.route-editor__reassign button { padding: 7px 12px; border: 1px solid #159467; border-radius: 7px; color: #fff; background: #159467; font-size: 9px; font-weight: 800; }
.route-reassign-backdrop { position: absolute; z-index: 20; display: grid; inset: 0; place-items: center; padding: 24px; background: rgba(10, 27, 21, .58); }
.route-reassign { width: min(520px, 88vw); max-height: 72vh; overflow: hidden; border-radius: 14px; background: #fff; box-shadow: 0 24px 70px rgba(7, 30, 22, .3); }
.route-reassign header { display: flex; justify-content: space-between; padding: 15px 17px; border-bottom: 1px solid #e3ebe7; }
.route-reassign header span, .route-reassign header h3, .route-reassign header p { margin: 0; }
.route-reassign header span { color: #14845d; font-size: 8px; font-weight: 800; }
.route-reassign header h3 { margin-top: 2px; color: #1b352c; font-size: 17px; }
.route-reassign header p { margin-top: 3px; color: #7b8984; font-size: 8px; }
.route-reassign header button { width: 30px; height: 30px; border: 1px solid #d6e0db; border-radius: 7px; background: #fff; font-size: 18px; }
.route-reassign__list { max-height: 52vh; overflow-y: auto; padding: 10px; }
.route-reassign__list > button { display: grid; width: 100%; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 10px; align-items: center; margin-bottom: 7px; padding: 10px; border: 1px solid #dce7e2; border-radius: 9px; color: inherit; background: #fff; text-align: left; }
.route-reassign__list b { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 50%; color: #fff; background: #159467; }
.route-reassign__list span { display: flex; min-width: 0; flex-direction: column; }
.route-reassign__list strong { color: #243c34; font-size: 10px; }
.route-reassign__list small { margin-top: 2px; color: #7d8b86; font-size: 8px; }
.route-reassign__list em { color: #14815c; font-size: 9px; font-style: normal; font-weight: 800; }
.route-reassign__list p { color: #7d8b86; text-align: center; }
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
.route-editor__stop-copy { display: flex; min-width: 0; flex-direction: column; }
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

/* Readable desktop route editor, aligned with the information hierarchy of the Boss mini program. */
.route-editor { width: min(1540px, 97vw); height: min(940px, 95vh); }
.route-editor__header { padding: 19px 24px 15px; }
.route-editor__header span { font-size: 12px; }
.route-editor__header h2 { margin-top: 4px; font-size: 27px; }
.route-editor__header p { margin-top: 5px; font-size: 12px; }
.route-editor__planner { display: block; min-height: auto; padding: 13px 20px 14px; }
.route-editor__planner.is-disabled { background: #f6f8f7; }
.route-editor__planner-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
.route-editor__planner-heading > div { display: flex; min-width: 0; flex-direction: column; }
.route-editor__planner-heading strong { color: #213f35; font-size: 15px; }
.route-editor__planner-heading span { margin-top: 4px; color: #6f8179; font-size: 12px; line-height: 1.45; }
.route-editor__planner-heading small { flex: none; color: #35705c; font-size: 11px; }
.route-editor__planner-disabled { margin: 9px 0 0; padding: 8px 10px; border-radius: 8px; color: #8c641d; background: #fff5dc; font-size: 12px; }
.route-editor__constraint-grid { display: grid; grid-template-columns: 1.2fr .9fr .9fr .75fr auto; gap: 12px; align-items: end; margin-top: 12px; }
.route-editor__constraint-grid label { display: flex; align-items: stretch; flex-direction: column; gap: 6px; }
.route-editor__constraint-grid label > span:first-child { color: #536b62; font-size: 11px; font-weight: 700; }
.route-editor__planner input { box-sizing: border-box; width: 100%; height: 40px; padding: 8px 10px; border-radius: 9px; font-size: 13px; }
.route-editor__duration-inputs { display: grid; grid-template-columns: minmax(55px, 1fr) auto minmax(55px, 1fr) auto; gap: 5px; align-items: center; }
.route-editor__duration-inputs em,
.route-editor__value-input em { color: #73867e; font-size: 11px; font-style: normal; }
.route-editor__value-input { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; align-items: center; }
.route-editor__plan-action { min-width: 120px; height: 40px; padding: 0 14px; font-size: 13px; }
.route-editor__constraint-help,
.route-editor__constraint-error { margin: 8px 0 0; font-size: 11px; }
.route-editor__constraint-help { color: #75867f; }
.route-editor__constraint-error { color: #b1433b; }
.route-editor__reassign { padding: 11px 20px; }
.route-editor__reassign strong { font-size: 13px; }
.route-editor__reassign span { font-size: 11px; }
.route-editor__reassign button { padding: 9px 15px; font-size: 12px; }
.route-editor__overview { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) auto; gap: 1px; align-items: stretch; flex: none; margin: 10px 12px 0; overflow: hidden; border: 1px solid #dce7e2; border-radius: 11px; background: #dce7e2; }
.route-editor__overview > span { display: flex; min-width: 0; justify-content: center; flex-direction: column; padding: 8px 12px; background: #fff; text-align: center; }
.route-editor__overview small { color: #84938d; font-size: 10px; }
.route-editor__overview strong { margin-top: 4px; overflow: hidden; color: #29473c; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.route-editor__overview > em { display: flex; align-items: center; min-width: 190px; justify-content: center; padding: 8px 13px; color: #157b57; background: #eff9f5; font-size: 11px; font-style: normal; font-weight: 800; text-align: center; }
.route-editor__overview > em.is-dirty { color: #9a6b17; background: #fff6df; }
.route-editor__body { grid-template-columns: minmax(560px, 1.45fr) minmax(470px, .8fr); gap: 12px; padding: 12px; }
.route-editor__map { padding: 14px; }
.route-editor__map-head strong,
.route-editor__order-head strong,
.route-editor__candidates strong { font-size: 14px; }
.route-editor__map-head span,
.route-editor__order-head span,
.route-editor__candidates span { font-size: 11px; }
.route-editor__order-head { padding: 13px 13px 0; }
.route-editor__order-head > button { padding: 7px 10px; font-size: 11px; }
.route-editor__order ol { padding: 0 10px; }
.route-editor__order ol > li { grid-template-columns: 18px minmax(0, 1fr) auto auto; gap: 7px; margin-bottom: 8px; padding: 8px; border-radius: 10px; }
.route-editor__stop { grid-template-columns: 31px minmax(0, 1fr); gap: 9px; }
.route-editor__stop > span:first-child { width: 30px; height: 30px; font-size: 11px; }
.route-editor__stop-title { display: flex; align-items: center; gap: 7px; }
.route-editor__stop-title strong { font-size: 13px; }
.route-editor__stop-title em { flex: none; padding: 2px 6px; border-radius: 5px; color: #cc7f16; background: #fff3d8; font-size: 10px; font-style: normal; }
.route-editor__stop small,
.route-editor__candidates small { margin-top: 3px; font-size: 10px; }
.route-editor__stop-times { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin-top: 7px; overflow: hidden; border-radius: 7px; background: #e8efec; }
.route-editor__stop-times b { display: flex; align-items: center; flex-direction: column; padding: 5px 3px; color: #345147; background: #f8fbfa; font-size: 11px; }
.route-editor__stop-times b small { margin: 0 0 2px; color: #899790; font-size: 9px; font-weight: 400; }
.route-editor__stop-actions button,
.route-editor__move button { min-width: 34px; height: 31px; padding: 0 7px; font-size: 10px; }
.route-editor__candidates { min-height: 130px; margin: 7px 10px 0; padding-top: 9px; }
.route-editor__candidates > input { padding: 8px 10px; font-size: 11px; }
.route-editor__candidates li { padding: 8px; }
.route-editor__candidates li button { padding: 7px 9px; font-size: 10px; }
.route-editor__return { margin: 7px 11px 10px; padding: 10px; }
.route-editor__return span { width: 32px; height: 32px; font-size: 11px; }
.route-editor__return strong { font-size: 13px; }
.route-editor__return small { font-size: 11px; }
.route-editor__message { margin: 0 12px 10px; padding: 9px 12px; font-size: 12px; }
.route-expansion { width: min(1080px, 94vw); }
.route-expansion > header span { font-size: 11px; }
.route-expansion > header h3 { font-size: 22px; }
.route-expansion > header p { font-size: 12px; }
.route-expansion__routes strong,
.route-expansion__excluded strong { font-size: 13px; }
.route-expansion__routes span,
.route-expansion__excluded span { font-size: 11px; }
.route-expansion__routes li { font-size: 12px; }
.route-expansion__routes p,
.route-expansion__excluded p { font-size: 11px; }
.route-expansion__metrics > div { padding: 9px 12px; font-size: 11px; }
.route-expansion__summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin-top: 9px; }
.route-expansion__summary-grid article { padding: 11px; border: 1px solid #dce7e2; border-radius: 10px; background: #fff; }
.route-expansion__summary-grid article > div { display: flex; justify-content: space-between; gap: 8px; }
.route-expansion__summary-grid strong { color: #294038; font-size: 13px; }
.route-expansion__summary-grid span { color: #7a8b84; font-size: 11px; }
.route-expansion__summary-grid ul { margin: 8px 0 0; padding: 0; list-style: none; }
.route-expansion__summary-grid li { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-top: 1px solid #edf2ef; font-size: 11px; }
.route-expansion__summary-grid li b { color: #315a4b; text-align: right; }
.route-expansion__analysis { margin-top: 9px; padding: 11px; border: 1px solid #dce7e2; border-radius: 10px; background: #fff; }
.route-expansion__analysis > div { display: flex; justify-content: space-between; gap: 12px; }
.route-expansion__analysis > div strong { color: #294038; font-size: 13px; }
.route-expansion__analysis > div span { color: #647a71; font-size: 11px; }
.route-expansion__analysis dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)) 1.5fr; gap: 8px; margin: 9px 0 0; }
.route-expansion__analysis dl > div { min-width: 0; padding: 8px; border-radius: 8px; background: #f5f8f6; }
.route-expansion__analysis dt { color: #87948f; font-size: 10px; }
.route-expansion__analysis dd { overflow: hidden; margin: 4px 0 0; color: #315047; font-size: 11px; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.route-expansion > footer > span { font-size: 11px; }
.route-expansion > footer button,
.route-editor__footer button { min-height: 38px; padding: 8px 15px; font-size: 12px; }
.route-editor__footer { padding: 12px 18px; }
.route-editor__footer > span { font-size: 12px; }
.route-reassign header span { font-size: 11px; }
.route-reassign header h3 { font-size: 20px; }
.route-reassign header p { font-size: 11px; }
.route-reassign__list strong { font-size: 13px; }
.route-reassign__list small { font-size: 11px; }
.route-reassign__list em { font-size: 12px; }

/* Approved desktop route-editor composition. */
.route-editor-backdrop {
  padding: 15px;
  background: rgba(25, 38, 33, .68);
}

.route-editor {
  width: min(1500px, calc(100vw - 24px));
  height: min(920px, calc(100vh - 30px));
  border: 1px solid #d9e2de;
  border-radius: 13px;
  background: #fff;
  box-shadow: 0 24px 75px rgba(9, 27, 20, .3);
}

.route-editor__header {
  min-height: 86px;
  align-items: center;
  padding: 15px 25px 13px;
  border-bottom: 1px solid #e1e7e4;
}

.route-editor__header > div {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
}

.route-editor__header span {
  color: #16251f;
  font-size: 21px;
  line-height: 1.1;
  font-weight: 900;
}

.route-editor__header h2 {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 7px;
  color: #1d3029;
  font-size: 16px;
  line-height: 1;
}

.route-editor__header h2 em {
  padding: 4px 8px;
  border-radius: 99px;
  color: #0a8352;
  background: #e7f6ef;
  font-size: 10px;
  font-style: normal;
}

.route-editor__header p {
  margin-top: 8px;
  font-size: 10px;
}

.route-editor__header > button {
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.route-editor__overview {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0;
  min-height: 55px;
  margin: 0;
  border: 0;
  border-bottom: 1px solid #e2e8e5;
  border-radius: 0;
  background: #fff;
}

.route-editor__overview > span {
  position: relative;
  justify-content: center;
  padding: 10px 12px;
  background: #fff;
}

.route-editor__overview > span::before {
  position: absolute;
  top: 11px;
  bottom: 11px;
  left: 0;
  width: 1px;
  background: #e3e9e6;
  content: '';
}

.route-editor__overview > span:first-child::before {
  display: none;
}

.route-editor__overview strong {
  margin: 0;
  color: #263931;
  font-size: 13px;
}

.route-editor__reassign {
  flex: none;
  padding: 7px 20px;
}

.route-editor__body {
  display: grid;
  min-height: 0;
  flex: 1;
  grid-template-columns: minmax(590px, 1.26fr) minmax(520px, 1fr);
  gap: 0;
  padding: 0;
}

.route-editor__map,
.route-editor__order {
  border: 0;
  border-radius: 0;
  background: #fff;
}

.route-editor__map {
  display: grid;
  grid-template-rows: 44px minmax(210px, 1fr) auto;
  padding: 0 14px 12px;
  border-right: 1px solid #e1e7e4;
}

.route-editor__map-head,
.route-editor__order-head {
  min-height: 44px;
  margin: 0;
}

.route-editor__map-head {
  padding: 0 2px;
}

.route-editor__map-head strong,
.route-editor__order-head strong,
.route-editor__candidates strong {
  font-size: 13px;
}

.route-editor__map-head > button {
  min-height: 31px;
  padding: 6px 10px;
  border: 1px solid #d4dfda;
  border-radius: 7px;
  color: #596e65;
  background: #fff;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.route-editor__map :deep(.dispatch-real-map),
.route-editor__map :deep(.dispatch-huawei-map) {
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1 1 auto;
  border-radius: 8px;
}

.route-editor__map :deep(.dispatch-map-shell),
.route-editor__map :deep(.dispatch-map-loader) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.route-editor__map-viewport {
  display: flex;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
}

.route-editor__map-viewport :deep(.dispatch-huawei-map__canvas),
.route-editor__map-viewport :deep(.dispatch-real-map__canvas) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.route-editor__map :deep(.dispatch-real-map__hint),
.route-editor__map :deep(.dispatch-huawei-map__hint) {
  display: none;
}

.route-editor__planner {
  display: block;
  flex: none;
  min-height: 0;
  margin-top: 10px;
  padding: 10px 13px 8px;
  border: 1px solid #dce4e0;
  border-radius: 8px;
  background: #fff;
}

.route-editor__planner-heading {
  align-items: flex-start;
}

.route-editor__planner-heading strong {
  font-size: 13px;
}

.route-editor__planner-heading span {
  margin-top: 3px;
  font-size: 10px;
}

.route-editor__planner-heading small {
  color: #63766d;
  font-size: 14px;
}

.route-editor__constraint-grid {
  grid-template-columns: 1.25fr .9fr .9fr .75fr auto;
  gap: 7px;
  margin-top: 9px;
}

.route-editor__constraint-grid label {
  gap: 3px;
  padding: 5px 8px;
  border: 1px solid #e0e6e3;
  border-radius: 7px;
  background: #fff;
}

.route-editor__constraint-grid label > span:first-child {
  font-size: 9px;
}

.route-editor__planner input {
  height: 25px;
  padding: 2px 4px;
  border: 0;
  border-radius: 0;
  font-size: 11px;
  background: transparent;
}

.route-editor__duration-inputs em,
.route-editor__value-input em {
  font-size: 9px;
}

.route-editor__plan-action {
  min-width: 112px;
  height: 50px;
  border-radius: 7px;
  font-size: 11px;
}

.route-editor__constraint-help,
.route-editor__constraint-error {
  margin: 6px 0 0;
  font-size: 9px;
}

.route-editor__order {
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.route-editor__order-head {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 0 16px;
  border-bottom: 1px solid #e6ebe8;
  background: #fff;
}

.route-editor__order-head > div {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}

.route-editor__order-head small {
  overflow: hidden;
  color: #7b8a84;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-editor__order-head > button {
  padding: 5px 8px;
  font-size: 9px;
}

.route-editor__order ol {
  min-height: 0;
  max-height: none;
  flex: 0 0 auto;
  overflow: visible;
  padding: 0;
}

.route-editor__order ol > li {
  grid-template-columns: 16px minmax(0, 1fr) auto auto;
  gap: 6px;
  min-height: 68px;
  margin: 0;
  padding: 7px 10px;
  border: 0;
  border-bottom: 1px solid #e7ece9;
  border-radius: 0;
}

.route-editor__order ol > li.active {
  border-color: #d9e7e0;
  background: #f5fbf8;
}

.route-editor__handle {
  font-size: 13px;
}

.route-editor__stop {
  grid-template-columns: 29px minmax(105px, 1fr) minmax(195px, 1.1fr);
  gap: 8px;
}

.route-editor__stop > span:first-child {
  width: 27px;
  height: 27px;
  color: #fff;
  background: #2e69ed;
  font-size: 11px;
}

.route-editor__stop-title strong {
  font-size: 12px;
}

.route-editor__stop-title em {
  display: none;
}

.route-editor__stop small {
  max-width: 160px;
  font-size: 9px;
}

.route-editor__stop-times {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin: 0;
  border-radius: 0;
  background: transparent;
}

.route-editor__stop-times b {
  justify-content: center;
  padding: 3px 7px;
  border-left: 1px solid #e6ebe8;
  color: #263b33;
  background: transparent;
  font-size: 10px;
}

.route-editor__stop-times b small {
  font-size: 8px;
}

.route-editor__move,
.route-editor__stop-actions {
  display: flex;
  gap: 4px;
}

.route-editor__move button,
.route-editor__stop-actions button {
  min-width: 48px;
  height: 29px;
  padding: 0 6px;
  font-size: 9px;
  white-space: nowrap;
}

.route-editor__move button:not(:disabled) {
  border-color: #7ac3a8;
  color: #087c51;
}

.route-editor__stop-actions button.remove {
  border-color: #efb5b1;
  color: #d24b44;
}

.route-editor__return {
  min-height: 48px;
  margin: 0;
  padding: 7px 25px;
  border-top: 0;
  border-bottom: 1px solid #e5ebe8;
}

.route-editor__return span {
  width: 27px;
  height: 27px;
  font-size: 9px;
}

.route-editor__return strong {
  font-size: 11px;
}

.route-editor__return small {
  font-size: 10px;
}

.route-editor__remove-note {
  flex: none;
  margin: 7px 16px 0;
  padding: 9px 11px;
  border: 1px solid #b9d4fa;
  border-radius: 7px;
  color: #4070ae;
  background: #eef5ff;
  font-size: 9px;
}

.route-editor__candidates {
  min-height: 0;
  max-height: none;
  flex: 0 0 auto;
  margin: 8px 16px 0;
  padding: 0;
  border-top: 0;
  overflow: visible;
}

.route-editor__candidates > div {
  min-height: 30px;
  margin: 0;
}

.route-editor__candidates > div em {
  margin-left: auto;
  color: #64776f;
  font-size: 13px;
  font-style: normal;
}

.route-editor__candidates > input {
  width: 100%;
  margin: 0 0 5px;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 10px;
}

.route-editor__candidates ul {
  max-height: none;
  overflow: visible;
}

.route-editor__candidates li {
  min-height: 48px;
  padding: 9px 6px;
}

.route-editor__candidates li button {
  min-width: 54px;
  padding: 6px 8px;
  color: #0a8354;
  background: #fff;
  font-size: 9px;
}

.route-editor__message {
  position: static;
  flex: none;
  margin: 0 16px 8px;
}

.route-editor__footer {
  min-height: 54px;
  padding: 8px 22px;
}

.route-editor__footer > span::before {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 8px;
  border-radius: 50%;
  background: #f4a100;
  content: '';
}

.route-editor__footer > span.ready::before {
  background: #12a16d;
}

.route-editor__footer button {
  min-width: 112px;
  min-height: 38px;
}

.route-editor__footer button.primary {
  min-width: 170px;
  background: linear-gradient(135deg, #078149, #079d61);
}

@media (max-width: 1280px) {
  .route-editor__body {
    grid-template-columns: minmax(520px, 1.12fr) minmax(470px, 1fr);
  }

  .route-editor__stop {
    grid-template-columns: 28px minmax(96px, 1fr) minmax(170px, 1fr);
  }

  .route-editor__move button,
  .route-editor__stop-actions button {
    min-width: 40px;
    padding: 0 4px;
    font-size: 8px;
  }
}

/* Final density tuning: readable AI constraints and balanced route rows. */
.route-editor__planner {
  padding: 12px 15px 10px;
}

.route-editor__planner-heading strong {
  font-size: 15px;
}

.route-editor__planner-heading span {
  margin-top: 5px;
  font-size: 11px;
}

.route-editor__constraint-grid {
  gap: 9px;
  margin-top: 11px;
}

.route-editor__constraint-grid label {
  min-height: 62px;
  justify-content: center;
  gap: 5px;
  padding: 7px 10px;
}

.route-editor__constraint-grid label > span:first-child {
  color: #52685f;
  font-size: 11px;
}

.route-editor__planner input {
  height: 29px;
  padding: 2px 3px;
  color: #20372e;
  font-size: 15px;
  line-height: 1.2;
  font-weight: 700;
}

.route-editor__planner input::placeholder {
  color: #9aa7a2;
  font-size: 12px;
  font-weight: 400;
}

.route-editor__duration-inputs {
  grid-template-columns: minmax(38px, 1fr) auto minmax(38px, 1fr) auto;
  gap: 7px;
}

.route-editor__duration-inputs em,
.route-editor__value-input em {
  color: #6e8179;
  font-size: 11px;
}

.route-editor__plan-action {
  min-width: 130px;
  height: 78px;
  font-size: 13px;
}

.route-editor__constraint-help,
.route-editor__constraint-error {
  margin-top: 8px;
  font-size: 10px;
}

.route-editor__order-head {
  min-height: 48px;
}

.route-editor__order-head strong {
  font-size: 15px;
}

.route-editor__order-head span {
  font-size: 11px;
}

.route-editor__order-head small {
  font-size: 10px;
}

.route-editor__order ol {
  min-height: 0;
  max-height: none;
  flex: 0 0 auto;
}

.route-editor__order ol > li {
  min-height: 72px;
  padding: 7px 12px;
}

.route-editor__stop {
  grid-template-columns: 31px minmax(118px, 1fr) minmax(220px, 1.15fr);
  gap: 10px;
}

.route-editor__stop > span:first-child {
  width: 30px;
  height: 30px;
  font-size: 12px;
}

.route-editor__stop-copy {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  flex-direction: column;
}

.route-editor__stop-title strong {
  font-size: 14px;
}

.route-editor__stop-copy > small {
  max-width: 190px;
  margin-top: 5px;
  font-size: 10px;
}

.route-editor__stop > span.route-editor__stop-times {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-self: stretch;
}

.route-editor__stop-times b {
  min-width: 0;
  min-height: 46px;
  justify-content: center;
  padding: 4px 8px;
  font-size: 12px;
}

.route-editor__stop-times b small {
  margin-bottom: 5px;
  font-size: 9px;
}

.route-editor__move,
.route-editor__stop-actions {
  align-items: center;
}

.route-editor__move button,
.route-editor__stop-actions button {
  min-width: 50px;
  height: 33px;
  padding: 0 7px;
  font-size: 10px;
}

.route-editor__return {
  min-height: 50px;
}

.route-editor__return strong {
  font-size: 12px;
}

.route-editor__candidates > div strong {
  font-size: 14px;
}

.route-editor__candidates > div span,
.route-editor__candidates li small {
  font-size: 10px;
}

.route-editor__candidates li strong {
  font-size: 12px;
}

.route-editor__candidates li button {
  min-width: 58px;
  min-height: 30px;
  font-size: 10px;
}

.route-editor__stop-title em.route-editor__driver-lock,
.route-editor__driver-lock {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  padding: 3px 7px;
  border: 1px solid #63ae91;
  border-radius: 999px;
  overflow: hidden;
  color: #08744f;
  background: #e8f7f0;
  font-size: 9px;
  line-height: 1.2;
  font-style: normal;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.route-editor__driver-lock.is-other-driver {
  border-color: #efae50;
  color: #925b08;
  background: #fff4d9;
}

.route-editor__candidate-copy {
  align-items: flex-start;
  gap: 3px;
}

.route-editor__stop-actions button.other-driver-lock {
  border-color: #efae50;
  color: #925b08;
  background: #fff8e8;
}

@media (max-width: 1360px) {
  .route-editor__stop {
    grid-template-columns: 30px minmax(105px, .9fr) minmax(190px, 1fr);
    gap: 7px;
  }

  .route-editor__move button,
  .route-editor__stop-actions button {
    min-width: 43px;
    padding: 0 4px;
    font-size: 9px;
  }
}
</style>
