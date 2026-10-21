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
      <div class="forecast-check__columns">
        <section
          v-for="section in reminderPresentation.sections"
          :key="section.key"
          :class="['forecast-check__group', `is-${section.key.toLocaleLowerCase()}`]"
          :aria-label="section.title"
        >
          <header class="forecast-check__group-title">
            <strong>{{ section.title }}</strong>
            <span>{{ section.rows.length }} 种</span>
          </header>
          <div class="forecast-check__group-body">
            <div v-if="!section.rows.length" class="forecast-check__empty">暂无此类商品</div>
            <div
              v-for="(row, index) in section.rows"
              :key="row.key"
              class="forecast-check__row"
            >
              <div class="forecast-check__goods">
                <div class="forecast-check__goods-name">
                  <span class="forecast-check__row-number">{{ index + 1 }}.</span>
                  <strong>{{ row.goodsName }}</strong>
                  <span v-if="row.departmentNames.length">{{ row.departmentNames.join('、') }}</span>
                </div>
                <div v-if="section.key !== 'MATCHED'" class="forecast-check__headline-quantity">
                  <span>{{ section.key === 'REMINDER' ? '预估' : '实订' }}</span>
                  <strong>{{ section.key === 'REMINDER' ? predictedQuantityText(row) : actualQuantityText(row) }}</strong>
                </div>
              </div>
              <div class="forecast-check__metrics">
                <div v-if="section.key === 'MATCHED'"><span>AI预估</span><strong>{{ predictedQuantityText(row) }}</strong></div>
                <div v-if="section.key === 'MATCHED'"><span>客户实订</span><strong>{{ actualQuantityText(row) }}</strong></div>
                <div><span>订货习惯</span><strong>{{ intervalText(row) }}</strong></div>
                <div><span>上次订单时间</span><strong>{{ lastOrderText(row) }}</strong></div>
              </div>
            </div>
          </div>
        </section>
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
  if (!row.hasActual) return '—';
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
  if (!match) return '—';
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}
</script>

<style scoped>
.forecast-check{display:grid;height:100%;min-width:0;min-height:0;grid-template-rows:minmax(0,1fr);padding:12px;overflow:hidden;background:var(--product-tint);color:var(--product-text)}
.forecast-check__columns{display:grid;min-width:0;min-height:0;grid-template-columns:repeat(3,minmax(270px,1fr));align-items:stretch;gap:10px;overflow-x:auto;overflow-y:hidden}
.forecast-check__group{display:flex;min-width:0;min-height:0;height:100%;flex-direction:column;overflow:hidden;border:1px solid var(--product-border);border-radius:8px;background:var(--product-surface)}
.forecast-check__group-title{display:flex;min-height:42px;align-items:center;justify-content:space-between;gap:8px;padding:0 11px;border-bottom:1px solid var(--product-tint);font-size:13px}
.forecast-check__group-body{min-height:0;flex:1;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable}
.forecast-check__group-title span{flex:none;padding:3px 8px;border-radius:999px;background:rgba(var(--product-tint-rgb), 0.8);font-size:10px;font-weight:800}
.forecast-check__group.is-reminder .forecast-check__group-title{color:var(--product-warning);background:var(--product-warning-soft)}
.forecast-check__group.is-matched .forecast-check__group-title{color:var(--product-primary-strong);background:var(--product-primary-soft)}
.forecast-check__group.is-customer_ordered .forecast-check__group-title{color:var(--product-info);background:var(--product-info-soft)}
.forecast-check__row{min-width:0;padding:9px 11px;border-bottom:1px solid var(--product-tint);background:var(--product-surface)}
.forecast-check__group.is-reminder .forecast-check__row{background:var(--product-warning-soft)}
.forecast-check__row:last-child{border-bottom:0}
.forecast-check__goods{display:flex;min-width:0;align-items:baseline;justify-content:space-between;gap:8px}
.forecast-check__goods-name{display:flex;min-width:0;flex:1;align-items:baseline;gap:5px}
.forecast-check__goods-name strong{min-width:0;overflow:hidden;font-size:13px;text-overflow:ellipsis;white-space:nowrap}
.forecast-check__goods-name>span:not(.forecast-check__row-number){overflow:hidden;color:var(--product-text-muted);font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.forecast-check__row-number{flex:none;color:var(--product-text-muted);font-size:11px;font-variant-numeric:tabular-nums;font-weight:700}
.forecast-check__headline-quantity{display:flex;flex:none;align-items:baseline;gap:4px;white-space:nowrap}
.forecast-check__headline-quantity span{color:var(--product-text-muted);font-size:10px}
.forecast-check__headline-quantity strong{font-size:13px;font-variant-numeric:tabular-nums}
.forecast-check__metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 10px;margin-top:5px}
.forecast-check__metrics>div{display:flex;min-width:0;align-items:baseline;gap:5px}
.forecast-check__metrics span{flex:none;color:var(--product-text-muted);font-size:10px}
.forecast-check__metrics strong{min-width:0;overflow:hidden;font-size:11px;font-variant-numeric:tabular-nums;text-overflow:ellipsis;white-space:nowrap}
.forecast-check__empty{display:flex;min-height:100%;align-items:center;justify-content:center;color:var(--product-text-muted);font-size:11px}
.forecast-check__state{display:flex;grid-row:1/-1;height:100%;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:var(--product-text-muted);font-size:12px}
.forecast-check__state strong{color:var(--product-text);font-size:17px}
.forecast-check__state i{width:26px;height:26px;border:3px solid var(--product-primary-soft);border-top-color:var(--product-primary);border-radius:50%;animation:forecast-spin .75s linear infinite}
.forecast-check__state.is-error{color:var(--product-danger)}
.forecast-check__state button{padding:8px 12px;border:1px solid var(--product-danger);border-radius:5px;color:#fff;background:var(--product-danger);font-size:11px;font-weight:800}
@keyframes forecast-spin{to{transform:rotate(360deg)}}
</style>
