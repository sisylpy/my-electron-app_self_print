<template>
  <section class="forecast-check" aria-label="今日订单提醒">
    <div v-if="loading" class="forecast-check__state">
      <i></i>
      <strong>正在读取今日订单提醒</strong>
    </div>

    <div v-else-if="error" class="forecast-check__state is-error">
      <strong>订单提醒暂时无法读取</strong>
      <span>{{ error }}</span>
      <button type="button" @click="retry">重新读取</button>
    </div>

    <template v-else>
      <div class="forecast-check__table">
        <div class="forecast-check__table-head">
          <span>商品</span>
          <span>AI预估</span>
          <span>客户实订</span>
          <span>订货习惯</span>
          <span>状态</span>
        </div>

        <div v-if="!hasReminderRows" class="forecast-check__empty">
          <strong>今天暂时没有订单提醒</strong>
        </div>

        <template v-else>
          <div
            v-for="section in reminderPresentation.sections"
            :key="section.key"
            :class="['forecast-check__group', `is-${section.key.toLocaleLowerCase()}`]"
          >
            <template v-if="section.rows.length">
              <div class="forecast-check__group-title">
                <strong>{{ section.title }}</strong>
                <span>{{ section.rows.length }} 种</span>
              </div>
              <div
                v-for="row in section.rows"
                :key="row.key"
                class="forecast-check__row"
              >
                <div class="forecast-check__goods">
                  <strong>{{ row.goodsName }}</strong>
                  <span v-if="row.departmentNames.length">{{ row.departmentNames.join('、') }}</span>
                </div>
                <div class="forecast-check__quantity">
                  <strong>{{ predictedQuantityText(row) }}</strong>
                </div>
                <div class="forecast-check__quantity">
                  <strong>{{ actualQuantityText(row) }}</strong>
                </div>
                <div class="forecast-check__cadence">
                  <strong>{{ intervalText(row) }}</strong>
                  <span>{{ lastOrderText(row) }}</span>
                </div>
                <div class="forecast-check__outcome">
                  <strong>{{ actionText(section.key) }}</strong>
                  <span v-if="section.key === 'REMINDER'">A级</span>
                </div>
              </div>
            </template>
          </div>
        </template>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import predictionLabApi from '../../../predictionLab/api/predictionLabApi';
import customerApi from '../../../customer/api/customerApi';
import { customerId } from '../../services/orderWorkbenchService';
import {
  buildOrderForecastReconciliation,
  buildOrderReminderPresentation,
} from '../../services/smartReplenishmentComparison';

const STABLE_BASELINE_CODE = 'V8_REPLENISHMENT_STATE';

const props = defineProps({
  distributerId: { type: [Number, String], default: null },
  selectedCustomer: { type: Object, default: null },
  snapshot: { type: Object, required: true },
  actualLoading: { type: Boolean, default: false },
  actualError: { type: String, default: '' },
});
const emit = defineEmits(['retry-actual', 'summary-change']);

const forecastRun = ref(null);
const customerGoodsProfile = ref([]);
const forecastLoading = ref(false);
const forecastError = ref('');
let controller = null;
let requestId = 0;

const reconciliation = computed(() => buildOrderForecastReconciliation(
  forecastRun.value,
  props.snapshot,
  customerGoodsProfile.value
));
const reminderPresentation = computed(() => buildOrderReminderPresentation(
  reconciliation.value
));
const hasReminderRows = computed(() => reminderPresentation.value.sections
  .some(section => section.rows.length));
const loading = computed(() => forecastLoading.value || props.actualLoading);
const error = computed(() => forecastError.value || props.actualError);

watch(
  [reminderPresentation, loading, error],
  ([presentation, isLoading, currentError]) => {
    emit('summary-change', isLoading || currentError ? null : presentation.summary);
  },
  { immediate: true, deep: true }
);

watch(
  [() => props.distributerId, () => customerId(props.selectedCustomer)],
  () => { void loadForecast(); },
  { immediate: true }
);

onBeforeUnmount(() => controller?.abort());

function retry() {
  if (props.actualError) emit('retry-actual');
  void loadForecast();
}

async function loadForecast() {
  const distributerId = Number(props.distributerId);
  const departmentId = Number(customerId(props.selectedCustomer));
  if (!Number.isFinite(distributerId) || distributerId <= 0
    || !Number.isFinite(departmentId) || departmentId <= 0) {
    forecastRun.value = null;
    forecastError.value = '缺少配送商或客户信息，无法读取订单提醒。';
    return;
  }

  const currentRequest = ++requestId;
  controller?.abort();
  const requestController = new AbortController();
  controller = requestController;
  forecastRun.value = null;
  customerGoodsProfile.value = [];
  forecastLoading.value = true;
  forecastError.value = '';
  try {
    const profilePromise = loadCustomerGoodsProfile(departmentId, requestController.signal);
    const forecastPromise = (async () => {
      const catalog = await predictionLabApi.getCatalog(distributerId, requestController.signal);
      const date = catalog.businessDate;
      return predictionLabApi.reconciliationForecast({
        distributerId,
        departmentId,
        predictionDate: date,
        predictionEndDate: date,
        historyWindowDays: 30,
        algorithmVersion: STABLE_BASELINE_CODE,
      }, requestController.signal);
    })();
    const [result, profiles] = await Promise.all([forecastPromise, profilePromise]);
    if (currentRequest === requestId) {
      forecastRun.value = result;
      customerGoodsProfile.value = profiles;
    }
  } catch (loadError) {
    if (loadError?.name === 'CanceledError' || loadError?.name === 'AbortError') return;
    if (currentRequest === requestId) {
      forecastRun.value = null;
      forecastError.value = loadError?.message || '订单提醒读取失败。';
    }
  } finally {
    if (currentRequest === requestId) forecastLoading.value = false;
  }
}

async function loadCustomerGoodsProfile(departmentId, signal) {
  try {
    const response = await customerApi.getCustomerGoodsProfile(departmentId, signal);
    if (Number(response?.data?.code) !== 0) return [];
    return Array.isArray(response?.data?.data) ? response.data.data : [];
  } catch (loadError) {
    if (loadError?.name === 'CanceledError' || loadError?.name === 'AbortError') throw loadError;
    return [];
  }
}

function numberText(value) {
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function quantityText(value, unit) {
  return `${numberText(value)} ${unit || ''}`.trim();
}

function predictedQuantityText(row) {
  if (!row.hasPrediction) return '—';
  if (row.predictedQuantity === null) return '数量待确认';
  return quantityText(row.predictedQuantity, row.predictedUnit);
}

function actualQuantityText(row) {
  if (!row.hasActual) return '未下单';
  if (row.actualQuantity === null) return '数量待确认';
  return quantityText(row.actualQuantity, row.actualUnit);
}

function intervalText(row) {
  if (row.averageOrderIntervalDays === null) return '周期记录不足';
  return `约 ${numberText(row.averageOrderIntervalDays)} 天一次`;
}

function lastOrderText(row) {
  const value = String(row.lastOrderDate || '').trim();
  const match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return '上次订货 暂无记录';
  return `上次订货 ${Number(match[2])}月${Number(match[3])}日`;
}

function actionText(sectionKey) {
  if (sectionKey === 'REMINDER') return '提醒客户';
  if (sectionKey === 'MATCHED') return '已下单';
  return '客户自订';
}
</script>

<style scoped>
.forecast-check{display:grid;height:100%;min-width:0;min-height:0;grid-template-rows:minmax(0,1fr);padding:12px;overflow:hidden;background:#f6f9f7;color:var(--product-text)}
.forecast-check__table{min-width:0;min-height:0;overflow:auto;border:1px solid var(--product-border);border-radius:9px;background:#fff}
.forecast-check__table-head,.forecast-check__row{display:grid;min-width:820px;grid-template-columns:minmax(220px,1.4fr) minmax(145px,.8fr) minmax(145px,.8fr) minmax(145px,.8fr) minmax(150px,.8fr);align-items:center}
.forecast-check__table-head{position:sticky;z-index:3;top:0;min-height:48px;border-bottom:1px solid var(--product-border);color:var(--product-text-secondary);background:#f5f8f6;font-size:11px;font-weight:900}
.forecast-check__table-head span,.forecast-check__row>div{min-width:0;padding:10px 16px}
.forecast-check__group-title{position:sticky;z-index:2;top:48px;display:flex;min-height:43px;align-items:center;gap:10px;padding:0 16px;border-bottom:1px solid #e8eeeb;font-size:13px}
.forecast-check__group-title span{padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.75);font-size:10px;font-weight:800}
.forecast-check__group.is-reminder .forecast-check__group-title{color:#a64b18;background:#fff1e7}
.forecast-check__group.is-matched .forecast-check__group-title{color:#08794b;background:#edf8f2}
.forecast-check__group.is-customer_ordered .forecast-check__group-title{color:#41637f;background:#f0f5f8}
.forecast-check__row{min-height:76px;border-bottom:1px solid #edf1ef;background:#fff}
.forecast-check__group.is-reminder .forecast-check__row{background:#fffaf6}
.forecast-check__row:last-child{border-bottom:0}
.forecast-check__goods strong,.forecast-check__quantity strong,.forecast-check__cadence strong,.forecast-check__outcome strong{display:block;font-size:15px;line-height:1.25}
.forecast-check__goods span,.forecast-check__cadence span,.forecast-check__outcome span{display:block;margin-top:4px;color:var(--product-text-muted);font-size:11px}
.forecast-check__group.is-reminder .forecast-check__outcome strong{color:#bb4d1d}
.forecast-check__group.is-matched .forecast-check__outcome strong{color:#08794b}
.forecast-check__group.is-customer_ordered .forecast-check__outcome strong{color:#41637f}
.forecast-check__empty{display:flex;min-height:220px;align-items:center;justify-content:center;color:var(--product-text-muted)}
.forecast-check__empty strong{color:var(--product-text);font-size:17px}
.forecast-check__state{display:flex;height:100%;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:var(--product-text-muted);font-size:12px}
.forecast-check__state strong{color:var(--product-text);font-size:17px}
.forecast-check__state i{width:26px;height:26px;border:3px solid #d9e7df;border-top-color:var(--product-primary);border-radius:50%;animation:forecast-spin .75s linear infinite}
.forecast-check__state.is-error{color:#b14343}
.forecast-check__state button{padding:8px 12px;border:1px solid #b14343;border-radius:5px;color:#fff;background:#b14343;font-size:11px;font-weight:800}
@keyframes forecast-spin{to{transform:rotate(360deg)}}
</style>
