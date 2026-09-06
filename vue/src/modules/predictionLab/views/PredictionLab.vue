<template>
  <main class="procurement-page" aria-label="智能备货">
    <Teleport to="#product-header-context">
      <div class="prediction-header-controls" aria-label="智能备货快捷操作">
        <div class="header-date-range" :class="{ 'is-custom': dateMode === 'CUSTOM' }" aria-label="备货日期">
          <span>备货日期</span>
          <label>
            <input v-model="form.startDate" type="date" :min="forecastToday()" aria-label="采购开始日期" @change="setCustomRange('start')" />
            <i aria-hidden="true">→</i>
            <input v-model="form.endDate" type="date" :min="form.startDate || forecastToday()" aria-label="采购结束日期" @change="setCustomRange('end')" />
          </label>
        </div>
        <div class="header-range-presets" role="group" aria-label="常用采购时间">
          <button v-for="option in rangeOptions" :key="option.key" type="button" :class="{ active: dateMode === option.key }" @click="selectDateMode(option.key)">{{ option.label }}</button>
        </div>
        <button class="header-refresh" type="button" :disabled="loading || catalogLoading" @click="refreshWithLatestCatalog">
          <span aria-hidden="true">↻</span><b>{{ loading ? loadingProgress || '汇总中' : '刷新' }}</b>
        </button>
      </div>
    </Teleport>

    <section class="workspace-top">
      <aside class="store-directory" aria-label="采购门店">
        <header><strong>采购门店</strong><span>{{ departments.length }} 家</span></header>
        <label class="store-search">
          <span aria-hidden="true">⌕</span>
          <input v-model.trim="departmentSearch" type="search" autocomplete="off" placeholder="输入门店名称" :disabled="catalogLoading" />
        </label>
        <nav class="store-list" aria-label="全部门店">
          <button type="button" :class="{ active: !form.departmentId }" @click="selectDepartment('')">
            <i>全</i><span><strong>全部门店</strong><small>汇总所有有效门店</small></span><em>›</em>
          </button>
          <button v-for="department in filteredDepartments" :key="department.departmentId" type="button" :class="{ active: String(form.departmentId) === String(department.departmentId) }" @click="selectDepartment(department.departmentId)">
            <i>{{ String(department.departmentName || '店').charAt(0) }}</i>
            <span><strong>{{ department.departmentName }}</strong><small>{{ departmentHistoryLabel(department) }}</small></span><em>›</em>
          </button>
        </nav>
        <p v-if="departmentSearch && !filteredDepartments.length" class="store-empty">没有找到“{{ departmentSearch }}”</p>
      </aside>

      <section class="overview-panel" aria-label="商品采购明细">
        <section v-if="catalogError || actionError" class="notice error-notice">
          <b>暂时无法读取智能备货数据</b><span>{{ actionError || catalogError }}</span>
          <button type="button" @click="catalogError ? loadCatalog() : refreshWithLatestCatalog()">重新读取</button>
        </section>
        <section v-else-if="catalogLoading || loading" class="loading-state">
          <span></span><strong>{{ catalogLoading ? '正在读取门店信息' : `正在汇总智能备货数据 ${loadingProgress}` }}</strong>
        </section>

        <section v-else-if="runResult && !presentation.products.length" class="empty-state result-empty-state">
          <i aria-hidden="true">✓</i>
          <strong>{{ emptyResult.title }}</strong>
          <p>{{ emptyResult.description }}</p>
          <small>{{ emptyResult.note }}</small>
          <button type="button" @click="refreshWithLatestCatalog">重新查看</button>
        </section>

        <section v-else-if="runResult" class="product-board">
          <section class="product-detail">
            <header class="product-detail__header">
              <div>
                <h2>商品采购明细</h2>
                <div class="detail-level-filter" role="group" aria-label="按可信等级筛选">
                  <button v-for="level in levelOptions" :key="level.key" type="button" :class="[`is-${level.key.toLowerCase()}`, { active: activeLevelFilter === level.key }]" :aria-pressed="String(activeLevelFilter === level.key)" @click="selectLevel(level.key)">
                    <i>{{ level.key === 'LEVEL_A' ? 'A' : 'B' }}</i><span>{{ level.shortLabel }}</span><b>{{ presentation.byLevel[level.key].length }}</b>
                  </button>
                </div>
              </div>
              <label class="goods-search"><span aria-hidden="true">⌕</span><input v-model.trim="searchText" type="search" placeholder="输入商品名称、规格" /></label>
            </header>

            <nav class="category-tabs" aria-label="商品大类">
              <button type="button" :class="{ active: !activeCategory }" @click="selectCategory('')"><span>全部</span><b>{{ activeLevelProducts.length }}</b></button>
              <button v-for="category in categories" :key="category.key" type="button" :class="{ active: activeCategory === category.key }" @click="selectCategory(category.key)">
                <span>{{ category.label }}</span><b>{{ category.count }}</b>
              </button>
            </nav>

            <div class="product-table">
              <div class="product-table__head">
                <span>序号</span><span>商品名称 / 规格</span><span>预估数量</span><span>订货单位</span><span>库存数量</span><span>可信度</span><span>需求门店</span><span>采购订货</span>
              </div>
              <div v-if="!visibleProducts.length" class="empty-products">当前分类下没有符合条件的商品</div>
              <template v-for="(product, productIndex) in visibleProducts" :key="`${product.level}-${product.goodsId}-${product.predictedUnit}`">
                <article class="product-row" :class="`is-${product.level.toLowerCase()}`">
                  <i class="goods-sequence">{{ productIndex + 1 }}</i>
                  <div class="goods-name">
                    <div>
                      <strong>{{ product.goodsName }}</strong>
                      <span class="goods-specification">
                        <small v-if="goodsDetailText(product)" class="is-detail">{{ goodsDetailText(product) }}</small>
                        <small v-if="goodsStandardText(product)" class="is-standard">规格 {{ goodsStandardText(product) }}</small>
                        <small v-if="goodsCartonText(product)" class="is-carton">大包装 {{ goodsCartonText(product) }}</small>
                      </span>
                    </div>
                  </div>
                  <div class="quantity-cell">
                    <span v-if="product.predictedQuantity !== null"><strong>{{ number(product.predictedQuantity) }}</strong></span>
                  </div>
                  <div class="unit-cell">{{ product.predictedUnit }}</div>
                  <div class="stock-cell">
                    <span v-if="productContextLoading(product)">查询中</span>
                    <template v-else><strong>{{ number(productContext(product).stockQuantity) }}</strong><small>{{ productContext(product).stockUnit || product.predictedUnit }}</small></template>
                  </div>
                  <div class="trust-cell"><strong>{{ percent(product.trustPercent) }}</strong></div>
                  <div class="department-cell" :title="departmentForecastText(product)">
                    <span v-for="line in departmentForecastLines(product)" :key="line.key" class="department-order-line">
                      <strong>{{ line.departmentName }}</strong><small>{{ line.text }}</small>
                    </span>
                  </div>
                  <div class="procurement-cell">
                    <span v-if="productContextLoading(product)" class="procurement-pending">查询中</span>
                    <span v-else-if="productContext(product).error" class="procurement-unknown">状态未知</span>
                    <span v-else-if="productContext(product).hasActivePurchase" class="procurement-active">采购中<small v-if="Number(productContext(product).activePurchaseCount) > 1">{{ productContext(product).activePurchaseCount }}笔</small></span>
                    <button v-else type="button" :disabled="Boolean(creatingPurchases[Number(product.goodsId)])" @click="addProcurement(product)">
                      {{ creatingPurchases[Number(product.goodsId)] ? '添加中' : '+ 添加采购' }}
                    </button>
                  </div>
                </article>
              </template>
            </div>
            <footer class="product-detail__footer"><span>共 {{ categories.length }} 个大类，{{ visibleProducts.length }} 种商品</span></footer>
          </section>
        </section>

        <section v-else-if="!catalogLoading && !catalogError" class="empty-state">
          <button type="button" @click="refreshWithLatestCatalog">刷新</button>
        </section>
      </section>
    </section>
    <div v-if="purchaseFeedback.text" class="procurement-toast" :class="`is-${purchaseFeedback.type}`">{{ purchaseFeedback.text }}</div>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useStore } from 'vuex';
import predictionLabApi from '../api/predictionLabApi';
import { aggregateProcurementRuns, buildCategoryGroups, buildProcurementPresentation, LEVEL_META } from '../presentation/procurementProductPresentation';
import { resolveForecastDate } from '../services/predictionDateSemantics';

const STABLE_BASELINE_CODE = 'V8_REPLENISHMENT_STATE';
const MAX_RANGE_DAYS = 31;
const rangeOptions = Object.freeze([
  Object.freeze({ key: 'TODAY', label: '今天' }), Object.freeze({ key: 'TOMORROW', label: '明天' }),
  Object.freeze({ key: 'NEXT_7', label: '未来7天' }), Object.freeze({ key: 'CUSTOM', label: '自定义' }),
]);

const store = useStore();
const catalog = ref(null);
const catalogLoading = ref(false);
const catalogError = ref('');
const loading = ref(false);
const loadingCompleted = ref(0);
const loadingTotal = ref(0);
const actionError = ref('');
const runResult = ref(null);
const goodsDetails = reactive({});
const departmentSearch = ref('');
const dateMode = ref('TODAY');
const activeLevelFilter = ref('');
const activeCategory = ref('');
const searchText = ref('');
const procurementContexts = reactive({});
const creatingPurchases = reactive({});
const purchaseFeedback = reactive({ type: 'success', text: '' });
let catalogController = null;
let runController = null;
let contextController = null;
let feedbackTimer = null;

const form = reactive({ departmentId: '', startDate: forecastToday(), endDate: forecastToday(), historyWindowDays: 30, algorithmVersion: STABLE_BASELINE_CODE });
const levelOptions = Object.values(LEVEL_META);
const currentDisId = computed(() => { const user = store.state.disUser || {}; return user.nxDiuDistributerId || user.nxDistributerId || null; });
const departments = computed(() => catalog.value?.departments || []);
const filteredDepartments = computed(() => {
  const query = departmentSearch.value.toLocaleLowerCase('zh-CN');
  return query ? departments.value.filter((department) => String(department.departmentName || '').toLocaleLowerCase('zh-CN').includes(query)) : departments.value;
});
const selectedDepartment = computed(() => departments.value.find((department) => String(department.departmentId) === String(form.departmentId)));
const selectedDepartmentName = computed(() => selectedDepartment.value?.departmentName || '全部门店');
const departmentCount = computed(() => form.departmentId ? 1 : departments.value.filter((item) => Number(item.historicalLineCount) > 0).length);
const predictionDates = computed(() => datesBetween(form.startDate, form.endDate));
const loadingProgress = computed(() => loadingTotal.value > 1 ? `${loadingCompleted.value}/${loadingTotal.value}` : '');
const presentationRun = computed(() => {
  if (!runResult.value) return null;
  return {
    ...runResult.value,
      items: (runResult.value.items || []).map((item) => {
      const goods = goodsDetails[Number(item?.goodsId)] || {};
      const itemHasTopLevelCategory = Number(item.goodsCategoryLevel) === 0
        && item.goodsCategoryId && item.goodsCategoryName;
      return {
        ...item,
        ...goods,
        goodsCategoryName: itemHasTopLevelCategory ? item.goodsCategoryName : null,
        goodsCategoryId: itemHasTopLevelCategory ? item.goodsCategoryId : null,
        goodsCategoryLevel: itemHasTopLevelCategory ? 0 : null,
        };
      }),
  };
});
const presentation = computed(() => buildProcurementPresentation(presentationRun.value, departmentCount.value));
const activeLevelProducts = computed(() => activeLevelFilter.value
  ? (presentation.value.byLevel[activeLevelFilter.value] || [])
  : (presentation.value.products || []));
const categories = computed(() => buildCategoryGroups(activeLevelProducts.value));
const selectedCategory = computed(() => categories.value.find((category) => category.key === activeCategory.value));
const visibleProducts = computed(() => {
  const source = selectedCategory.value?.products || activeLevelProducts.value;
  const query = searchText.value.toLocaleLowerCase('zh-CN');
  return query ? source.filter((item) => [item.goodsName, goodsDetailText(item), goodsStandardText(item), goodsCartonText(item)]
    .some((value) => String(value || '').toLocaleLowerCase('zh-CN').includes(query))) : source;
});
const emptyResult = computed(() => {
  const result = runResult.value || {};
  const historyLabel = shortDate(result.historyCutoffDate);
  const rangeLabel = dateRangeLabel(result.predictionDate, result.predictionEndDate);
  const storeLabel = selectedDepartmentName.value;
  const common = {
    title: '当前无需备货',
    note: '页面已正常读取数据，并不是系统故障。你可以稍后重新查看，或直接联系门店确认。',
  };
  if (result.orderEvaluation?.predictedOrder === false) {
    const probability = Number(result.orderEvaluation?.probabilityPercent);
    const probabilityText = Number.isFinite(probability)
      ? `当前估计 ${number(probability)}%，未达到 50% 的主动备货门槛。` : '';
    return {
      ...common,
      description: `根据${historyLabel ? `截至${historyLabel}` : ''}的下单记录，${storeLabel}在${rangeLabel}下单的可能性暂时不高。${probabilityText}`,
      note: '页面也会展示历史同星期窗口提示；如果仍然为空，表示当前两类依据都不足。',
    };
  }
  if ((result.items || []).length) {
    return {
      ...common,
      description: `系统找到了一些${rangeLabel}可能需要的商品，但目前把握还不够高，所以没有列入提前备货清单。`,
    };
  }
  return {
    ...common,
    description: `根据${storeLabel}现有的历史订单，暂时没有发现${rangeLabel}需要提前准备的商品。`,
  };
});

onMounted(loadCatalog);
onBeforeUnmount(() => { catalogController?.abort(); runController?.abort(); contextController?.abort(); if (feedbackTimer) clearTimeout(feedbackTimer); });

async function loadCatalog(options = {}) {
  if (!currentDisId.value) { catalogError.value = '当前账号缺少配送商信息，请重新登录后再试。'; return; }
  const preserveDepartment = options.preserveDepartment === true;
  const previousDepartmentId = form.departmentId;
  runController?.abort();
  catalogController?.abort();
  catalogController = new AbortController();
  catalogLoading.value = true; catalogError.value = ''; actionError.value = '';
  try {
    catalog.value = await predictionLabApi.getCatalog(currentDisId.value, catalogController.signal);
    const firstDepartment = departments.value.find((item) => Number(item.historicalLineCount) > 0) || departments.value[0];
    const previousDepartmentStillExists = departments.value.some((department) => (
      String(department.departmentId) === String(previousDepartmentId)
    ));
    form.departmentId = preserveDepartment && previousDepartmentStillExists
      ? String(previousDepartmentId)
      : (firstDepartment ? String(firstDepartment.departmentId) : '');
    synchronizeSelectedDateRange();
    await refreshProcurement();
  } catch (error) {
    if (error?.name !== 'CanceledError' && error?.name !== 'AbortError') catalogError.value = error?.message || '门店信息读取失败。';
  } finally { catalogLoading.value = false; }
}

function refreshWithLatestCatalog() {
  return loadCatalog({ preserveDepartment: true });
}

function selectionChanged() { actionError.value = ''; runResult.value = null; resetProductFilters(); }
function selectDepartment(departmentId) {
  form.departmentId = departmentId === '' ? '' : String(departmentId);
  selectionChanged();
  void refreshProcurement();
}
function departmentHistoryLabel(department) {
  const count = Number(department?.historicalLineCount || 0);
  return count > 0 ? `历史 ${count.toLocaleString('zh-CN')} 条` : '暂无历史数据';
}
function selectDateMode(mode, clear = true) {
  dateMode.value = mode;
  const base = forecastToday();
  if (mode === 'TODAY') form.startDate = form.endDate = base;
  else if (mode === 'TOMORROW') form.startDate = form.endDate = addDays(base, 1);
  else if (mode === 'NEXT_7') { form.startDate = base; form.endDate = addDays(base, 6); }
  if (clear) {
    selectionChanged();
    void refreshProcurement();
  }
}
function setCustomRange(changed) {
  dateMode.value = 'CUSTOM';
  const minimumDate = forecastToday();
  if (!form.startDate || form.startDate < minimumDate) form.startDate = minimumDate;
  if (!form.endDate || form.endDate < minimumDate) form.endDate = form.startDate;
  if (form.startDate > form.endDate) { if (changed === 'start') form.endDate = form.startDate; else form.startDate = form.endDate; }
  selectionChanged();
  void refreshProcurement();
}

async function refreshProcurement() {
  if (!currentDisId.value) return;
  const dates = predictionDates.value;
  if (!dates.length) { actionError.value = '请选择有效的采购日期范围。'; return; }
  if (dates.length > MAX_RANGE_DAYS) { actionError.value = `单次最多查看 ${MAX_RANGE_DAYS} 天，请缩短自定义日期范围。`; return; }
  runController?.abort(); runController = new AbortController();
  loading.value = true; loadingCompleted.value = 0; actionError.value = '';
  try {
    if (form.startDate < forecastToday()) throw new Error('采购开始日期不能早于服务器今天。');
    loadingTotal.value = 1;
    const payload = { distributerId: Number(currentDisId.value), departmentId: form.departmentId ? Number(form.departmentId) : null, predictionDate: form.startDate, predictionEndDate: form.endDate, historyWindowDays: Number(form.historyWindowDays), algorithmVersion: STABLE_BASELINE_CODE };
    const result = await predictionLabApi.forecast(payload, runController.signal);
    loadingCompleted.value = 1;
    runResult.value = aggregateProcurementRuns([result], { startDate: form.startDate, endDate: form.endDate, departmentId: form.departmentId ? Number(form.departmentId) : null, departmentName: selectedDepartmentName.value });
    void loadGoodsDetails(runResult.value?.items || []);
    void loadProcurementContexts(runResult.value?.items || []);
    resetProductFilters();
  } catch (error) {
    if (error?.name !== 'CanceledError' && error?.name !== 'AbortError') actionError.value = error?.message || '智能备货数据生成失败。';
  } finally { loading.value = false; }
}

function resetProductFilters() {
  activeLevelFilter.value = ''; searchText.value = ''; activeCategory.value = '';
}
function selectLevel(level) { activeLevelFilter.value = activeLevelFilter.value === level ? '' : level; activeCategory.value = ''; searchText.value = ''; }
function selectCategory(category) { activeCategory.value = category; }

async function loadGoodsDetails(items) {
  const goodsIds = Array.from(new Set((items || [])
    .map((item) => Number(item?.goodsId))
    .filter((goodsId) => Number.isFinite(goodsId) && goodsId > 0 && !goodsDetails[goodsId])));
  const batchSize = 6;
  for (let index = 0; index < goodsIds.length; index += batchSize) {
    const batch = goodsIds.slice(index, index + batchSize);
    const results = await Promise.allSettled(batch.map((goodsId) => predictionLabApi.getGoodsDetail(goodsId)));
    results.forEach((result, resultIndex) => {
      if (result.status === 'fulfilled' && result.value) goodsDetails[batch[resultIndex]] = result.value;
    });
  }
}

async function loadProcurementContexts(items) {
  const goodsIds = Array.from(new Set((items || []).map((item) => Number(item?.goodsId))
    .filter((goodsId) => Number.isFinite(goodsId) && goodsId > 0)));
  contextController?.abort();
  if (!goodsIds.length || !currentDisId.value) return;
  contextController = new AbortController();
  goodsIds.forEach((goodsId) => { procurementContexts[goodsId] = { goodsId, loading: true, stockQuantity: null, stockUnit: '', activePurchaseCount: 0, hasActivePurchase: false }; });
  try {
    const contexts = await predictionLabApi.getProcurementContexts({ distributerId: Number(currentDisId.value), goodsIds }, contextController.signal);
    (contexts || []).forEach((context) => { procurementContexts[Number(context.goodsId)] = { ...context, loading: false }; });
    goodsIds.forEach((goodsId) => {
      if (procurementContexts[goodsId]?.loading) procurementContexts[goodsId] = { goodsId, loading: false, stockQuantity: 0, stockUnit: '', activePurchaseCount: 0, hasActivePurchase: false };
    });
  } catch (error) {
    if (error?.name === 'CanceledError' || error?.name === 'AbortError') return;
    goodsIds.forEach((goodsId) => { procurementContexts[goodsId] = { goodsId, loading: false, stockQuantity: null, stockUnit: '', activePurchaseCount: 0, hasActivePurchase: false, error: true }; });
    showPurchaseFeedback(error?.message || '库存和采购状态读取失败', 'error');
  }
}

function productContext(product) {
  return procurementContexts[Number(product?.goodsId)] || { stockQuantity: null, stockUnit: '', activePurchaseCount: 0, hasActivePurchase: false, loading: true };
}
function productContextLoading(product) { return productContext(product).loading === true; }

async function addProcurement(product) {
  const goodsId = Number(product?.goodsId);
  const quantity = Number(product?.predictedQuantity);
  const unit = String(product?.predictedUnit || '').trim();
  if (!Number.isFinite(goodsId) || goodsId <= 0 || !Number.isFinite(quantity) || quantity <= 0 || !unit) {
    showPurchaseFeedback('商品的预估数量或订货单位不完整，暂时不能加入采购', 'error');
    return;
  }
  if (!window.confirm(`确认将“${product.goodsName}” ${number(quantity)}${unit}加入采购吗？\n入库时再选择实际货架。`)) return;
  creatingPurchases[goodsId] = true;
  try {
    const result = await predictionLabApi.createProcurementItem({ distributerId: Number(currentDisId.value), goodsId, quantity, unit });
    procurementContexts[goodsId] = { ...(result?.context || productContext(product)), loading: false };
    showPurchaseFeedback(result?.created ? `${product.goodsName}已加入采购` : `${product.goodsName}已有采购任务，未重复添加`, 'success');
  } catch (error) {
    showPurchaseFeedback(error?.message || '加入采购失败', 'error');
  } finally {
    delete creatingPurchases[goodsId];
  }
}

function showPurchaseFeedback(text, type) {
  purchaseFeedback.text = text;
  purchaseFeedback.type = type || 'success';
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => { purchaseFeedback.text = ''; }, 3500);
}

function cleanCatalogValue(value) {
  const text = String(value ?? '').trim();
  return text && text !== 'null' && text !== 'undefined' && text !== '-1' ? text : '';
}
function productCatalog(product) {
  return { ...(product || {}), ...(goodsDetails[Number(product?.goodsId)] || {}) };
}
function goodsDetailText(product) {
  const goods = productCatalog(product);
  const brand = cleanCatalogValue(goods.nxDgGoodsBrand || goods.goodsBrand);
  const detail = cleanCatalogValue(goods.nxDgGoodsDetail || goods.goodsDetail);
  return Array.from(new Set([brand, detail].filter((value) => value && value !== product.goodsName))).join(' · ');
}
function goodsStandardText(product) {
  const goods = productCatalog(product);
  const weight = cleanCatalogValue(goods.nxDgGoodsStandardWeight || goods.goodsStandardWeight);
  const standard = cleanCatalogValue(goods.nxDgGoodsStandardname || goods.goodsStandardName);
  if (weight && standard) return `${weight}/${standard}`;
  return weight || (standard && standard !== product.predictedUnit ? standard : '');
}
function goodsCartonText(product) {
  const goods = productCatalog(product);
  const itemsPerCarton = cleanCatalogValue(goods.nxDgItemsPerCarton || goods.itemsPerCarton);
  const standard = cleanCatalogValue(goods.nxDgGoodsStandardname || goods.goodsStandardName);
  const cartonUnit = cleanCatalogValue(goods.nxDgCartonUnit || goods.cartonUnit);
  if (!itemsPerCarton || (Number.isFinite(Number(itemsPerCarton)) && Number(itemsPerCarton) <= 0)) return '';
  return `${itemsPerCarton}${standard || '件'}${cartonUnit ? `/${cartonUnit}` : ''}`;
}
function datesBetween(start, end) {
  if (!start || !end || start > end) return [];
  const result = []; let cursor = parseDate(start); const finalDate = parseDate(end);
  while (cursor <= finalDate && result.length <= MAX_RANGE_DAYS) { result.push(toDateInput(cursor)); cursor.setDate(cursor.getDate() + 1); }
  if (cursor <= finalDate) result.push('OVER_LIMIT');
  return result;
}
function forecastToday() {
  return resolveForecastDate(catalog.value);
}

function synchronizeSelectedDateRange() {
  const base = forecastToday();
  if (dateMode.value === 'TODAY') form.startDate = form.endDate = base;
  else if (dateMode.value === 'TOMORROW') form.startDate = form.endDate = addDays(base, 1);
  else if (dateMode.value === 'NEXT_7') {
    form.startDate = base;
    form.endDate = addDays(base, 6);
  } else {
    if (!form.startDate || form.startDate < base) form.startDate = base;
    if (!form.endDate || form.endDate < form.startDate) form.endDate = form.startDate;
  }
}

function addDays(value, days) { const date = parseDate(value); date.setDate(date.getDate() + days); return toDateInput(date); }
function parseDate(value) { const [year, month, day] = String(value).split('-').map(Number); return new Date(year, month - 1, day); }
function toDateInput(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function number(value) { if (value === null || value === undefined || value === '') return '—'; const numeric = Number(value); return Number.isFinite(numeric) ? numeric.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : String(value); }
function percent(value) { return value === null || value === undefined ? '—' : `${number(value)}%`; }
function shortDate(value) {
  const parts = String(value || '').split('-');
  return parts.length === 3 ? `${Number(parts[1])}月${Number(parts[2])}日` : String(value || '');
}
function dateRangeLabel(start, end) {
  const startLabel = shortDate(start || form.startDate);
  const endLabel = shortDate(end || form.endDate);
  if (!startLabel) return '所选日期';
  return !endLabel || startLabel === endLabel ? startLabel : `${startLabel}至${endLabel}`;
}
function dateForecastItems(product) {
  return Array.isArray(product?.dateForecasts) ? product.dateForecasts : [];
}
function dateForecastText(product) {
  const forecasts = dateForecastItems(product);
  if (Number(product?.forecastDateCount) > 1 && forecasts.length) {
    return forecasts.map((item) => `${shortDate(item.date)} ${number(item.quantity)}${item.unit || product.predictedUnit || ''}`).join('、');
  }
  return `预估 ${number(product?.predictedQuantity)} ${product?.predictedUnit || ''}`.trim();
}
function departmentForecastLines(product) {
  const departments = Array.isArray(product?.departmentForecasts) ? product.departmentForecasts : [];
  if (!departments.length) return [{
    key: `${product?.departmentName || '当前门店'}-summary`,
    departmentName: product?.departmentName || '当前门店',
    text: dateForecastText(product),
  }];
  return departments.map((department, index) => {
    const forecasts = Array.isArray(department.dateForecasts) ? department.dateForecasts : [];
    const text = forecasts.length
      ? forecasts.map((item) => `${shortDate(item.date)} ${number(item.quantity)}${item.unit || department.unit || ''}`).join('、')
      : `预估 ${number(department.predictedQuantity)}${department.unit || ''}`;
    return {
      key: `${department.departmentId || index}-${department.unit || ''}`,
      departmentName: department.departmentName || `门店${index + 1}`,
      text,
    };
  });
}
function departmentForecastText(product) {
  return departmentForecastLines(product).map((line) => `${line.departmentName} ${line.text}`).join('；');
}
</script>

<style scoped>
*{box-sizing:border-box}
button{cursor:pointer}
.procurement-page{height:100%;min-width:0;min-height:0;overflow:hidden;padding:10px;background:#f4f7f5;color:#1f2b25}
.workspace-top{height:100%;min-height:0;display:grid;grid-template-columns:270px minmax(0,1fr);align-items:stretch;gap:10px}
.store-directory{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;border:1px solid #dbe5df;border-radius:14px;background:#fff;box-shadow:0 7px 22px rgba(39,78,61,.045)}
.store-directory>header{height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 16px}
.store-directory>header strong{font-size:20px}.store-directory>header span{min-width:33px;height:27px;display:grid;place-items:center;padding:0 8px;border-radius:9px;background:#e8f6ee;color:#087b48;font-size:12px;font-weight:900}
.store-search{height:38px;display:flex;align-items:center;gap:8px;margin:0 11px 9px;padding:0 11px;border:1px solid #d5e1db;border-radius:9px;color:#0a8a51;background:#f9fbfa}
.store-search:focus-within,.goods-search:focus-within{border-color:#159159;box-shadow:0 0 0 3px rgba(21,145,89,.08)}
.store-search input,.goods-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#26332c;font-size:13px}
.store-list{flex:1;min-height:0;display:grid;align-content:start;gap:3px;overflow-y:auto;padding:0 8px 15px;scrollbar-width:thin;scrollbar-color:#d5e2db transparent}
.store-list button{min-height:54px;display:grid;grid-template-columns:34px minmax(0,1fr) 12px;align-items:center;gap:9px;padding:7px 9px;border:1px solid transparent;border-radius:10px;background:transparent;color:#34423b;text-align:left}
.store-list button:hover{background:#f5f9f7}.store-list button.active{border-color:#cae4d6;background:#edf8f2;color:#087747;box-shadow:inset 3px 0 0 #119e5e}
.store-list button>i{width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:9px;background:#e4f4eb;color:#087b48;font-size:12px;font-style:normal;font-weight:900}
.store-list button.active>i{background:#119e5e;color:#fff}.store-list button>span{min-width:0}.store-list strong,.store-list small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.store-list strong{font-size:13px}.store-list small{margin-top:3px;color:#8a9690;font-size:10px;font-weight:500}.store-list em{color:#95a09b;font-size:18px;font-style:normal}
.store-empty{margin:0;padding:24px 12px;color:#8a9690;text-align:center;font-size:13px}
.prediction-header-controls{height:100%;min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:8px}
.header-range-presets,.header-level-tabs{display:flex;align-items:center;overflow:hidden;border:1px solid #d7e1db;border-radius:8px;background:#fff}
.header-range-presets button,.header-level-tabs button{height:32px;padding:0 11px;border:0;border-right:1px solid #e5ebe7;background:#fff;color:#536159;font-size:11px;white-space:nowrap}
.header-range-presets button:last-child,.header-level-tabs button:last-child{border-right:0}.header-range-presets button.active{background:#108e56;color:#fff;font-weight:900}
.header-level-tabs button{display:flex;align-items:center;gap:6px;padding:0 10px}.header-level-tabs button span{display:flex;align-items:center;gap:4px}.header-level-tabs button i,.header-level-tabs button em{font-style:normal}.header-level-tabs button b{min-width:19px;padding:2px 5px;border-radius:99px;background:#edf3f0;color:#617168;font-size:9px}.header-level-tabs button.active{background:#edf8f2;color:#087b48;font-weight:900}.header-level-tabs button.is-level_b.active{background:#fff6e7;color:#a96b0f}.header-level-tabs button.is-level_b.active b{background:#ffe9c1;color:#9d620a}
.header-refresh{height:32px;display:flex;align-items:center;gap:6px;padding:0 11px;border:0;border-radius:8px;background:#108e56;color:#fff;box-shadow:0 4px 10px rgba(16,142,86,.14)}.header-refresh span{font-size:16px}.header-refresh b{font-size:11px}.header-refresh:disabled{opacity:.55}
.overview-panel{height:100%;min-width:0;min-height:0;display:flex;flex-direction:column;gap:8px;overflow:hidden}
.time-toolbar{flex:none;min-height:54px;display:grid;grid-template-columns:auto minmax(340px,560px) minmax(180px,1fr);align-items:center;gap:14px;padding:7px 13px;border:1px solid #dbe5df;border-radius:11px;background:#fff;box-shadow:0 3px 11px rgba(29,61,45,.03)}
.time-heading{font-size:14px;white-space:nowrap}
.range-dates{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:end;gap:7px}.range-dates label{display:grid;gap:4px}.range-dates label>span{color:#7b8780;font-size:10px;font-weight:800}.range-dates input{width:100%;height:34px;padding:0 9px;border:1px solid #d6e0da;border-radius:8px;outline:0;background:#fff;color:#2a372f;font-size:12px}.range-dates input:focus,.range-dates.is-custom input{border-color:#add4be}.range-dates>i{padding-bottom:9px;color:#9aa59f;font-size:13px;font-style:normal}
.selected-range{min-width:0;display:grid;gap:5px;padding-bottom:2px}.selected-range strong{font-size:13px}.selected-range span{overflow:hidden;color:#7e8b84;font-size:10px;text-overflow:ellipsis;white-space:nowrap}
.summary-grid{flex:none;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.summary-grid article{min-height:62px;display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid #dfe6e2;border-radius:10px;background:#fff;box-shadow:0 2px 9px rgba(29,60,44,.02)}.summary-icon{width:32px;height:32px;flex:none;display:grid;place-items:center;border:1px solid #b9d9c8;border-radius:8px;background:#edf8f2;color:#0c8751;font-size:11px;font-weight:900}.summary-grid article.is-b,.summary-grid article.needs-confirmation{border-color:#ead8b7}.summary-grid article.is-b .summary-icon,.summary-grid article.needs-confirmation .summary-icon{border-color:#e8c987;background:#fff6e7;color:#b67414}.summary-grid small{display:block;color:#75827b;font-size:10px}.summary-grid strong{display:inline-block;margin-top:3px;color:#173d2e;font-size:21px;line-height:1}.summary-grid em{margin-left:3px;color:#829088;font-size:10px;font-style:normal}
.notice{flex:none;display:flex;align-items:center;gap:10px;padding:13px 15px;border-radius:9px}.error-notice{border:1px solid #efc9cd;background:#fff4f5;color:#a63c47}.notice b{font-size:13px}.notice span{flex:1;font-size:12px}.notice button{padding:7px 11px;border:0;border-radius:7px;background:#aa3e49;color:#fff;font-size:11px}
.loading-state,.empty-state{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#78857e;text-align:center}.loading-state>span{width:36px;height:36px;border:3px solid #d7e9df;border-top-color:#138e56;border-radius:50%;animation:spin .85s linear infinite}.loading-state strong{margin-top:14px;color:#324239;font-size:14px}.empty-state button{height:40px;padding:0 19px;border:0;border-radius:9px;background:#108d55;color:#fff;font-size:13px;font-weight:800}.result-empty-state{padding:32px;border:1px solid #dbe8e1;border-radius:12px;background:#fff;box-shadow:0 5px 18px rgba(39,78,61,.04)}.result-empty-state>i{width:48px;height:48px;display:grid;place-items:center;border-radius:50%;background:#e8f6ee;color:#108d55;font-size:22px;font-style:normal;font-weight:900}.result-empty-state>strong{margin-top:16px;color:#26372e;font-size:18px}.result-empty-state>p{max-width:620px;margin:10px 0 0;color:#52625a;font-size:14px;line-height:1.7}.result-empty-state>small{max-width:620px;margin-top:7px;color:#87938c;font-size:12px;line-height:1.6}.result-empty-state>button{margin-top:20px}
.product-board{flex:1;min-height:0;display:grid;grid-template-columns:220px minmax(0,1fr);border:1px solid #dce4df;border-radius:12px;background:#fff;overflow:hidden;box-shadow:0 5px 18px rgba(39,78,61,.04)}
.category-panel{min-width:0;min-height:0;display:flex;flex-direction:column;padding:12px 7px 9px 12px;background:#fff}.category-panel>header{flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 8px 8px}.category-panel>header strong{font-size:16px}.category-panel>header small{color:#0c8751;font-size:11px}.category-panel nav{min-height:0;display:grid;align-content:start;gap:3px;overflow-y:auto}.category-panel nav button{min-height:46px;display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:9px;padding:6px 9px;border:0;border-radius:8px;background:transparent;color:#3b4941;text-align:left}.category-panel nav button:hover{background:#f4f8f5}.category-panel nav button.active{background:linear-gradient(90deg,#e5f5ec,#f3faf6);color:#087747}.category-panel nav button i{width:29px;height:29px;display:grid;place-items:center;border:1px solid #d7e2dc;border-radius:8px;background:#fff;color:#536159;font-size:11px;font-style:normal;font-weight:900}.category-panel nav button.active i{border-color:#acd3bd;color:#0d8751}.category-panel nav button span{font-size:13px;font-weight:800}.category-panel nav button b{font-size:11px}.category-panel>footer{flex:none;display:flex;justify-content:space-between;margin-top:auto;padding:9px 8px 1px}.category-panel>footer strong,.category-panel>footer span{font-size:11px}.category-panel>footer span{color:#69776f}
.product-detail{min-width:0;min-height:0;display:flex;flex-direction:column;padding:10px 12px 0 4px;overflow:hidden}.product-detail__header{flex:none;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 8px 8px}.product-detail__header>div{display:flex;align-items:center;gap:8px;min-width:0}.product-detail__header h2{margin:0;font-size:17px;white-space:nowrap}.level-tag{padding:4px 8px;border-radius:999px;background:#e8f6ee;color:#087747;font-size:11px;font-weight:900;white-space:nowrap}.level-tag.is-level_b{background:#fff2dc;color:#a5680c}.goods-search{width:210px;height:36px;display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid #d7e0db;border-radius:9px;background:#fff;color:#85918a}
.product-table{min-width:0;min-height:0;flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#d5e2db transparent}.product-table__head,.product-row{display:grid;grid-template-columns:minmax(230px,1.65fr) 82px 76px 105px minmax(130px,1fr) 100px 82px;align-items:center;gap:10px}.product-table__head{position:sticky;top:0;z-index:2;min-height:38px;padding:0 14px;border-radius:8px;background:#f6f8f7;color:#7f8b84;font-size:11px;font-weight:900}.product-row{min-height:76px;padding:7px 14px;border-bottom:1px solid #f0f3f1}.product-row:hover{background:#fbfdfc}.goods-name{display:flex;align-items:center;gap:10px;min-width:0}.goods-name>i{width:25px;height:25px;flex:none;display:grid;place-items:center;border-radius:8px;background:#e8f6ee;color:#087747;font-size:11px;font-style:normal;font-weight:900}.product-row.is-level_b .goods-name>i{background:#fff0d5;color:#a5680c}.goods-name>div{min-width:0}.goods-name strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}.goods-specification{display:flex;align-items:center;flex-wrap:wrap;gap:4px;min-width:0;margin-top:4px}.goods-specification small{flex:none;max-width:100%;overflow:hidden;padding:2px 5px;border-radius:4px;background:#f2f5f3;color:#7d8982;font-size:9px;line-height:1.2;text-overflow:ellipsis;white-space:nowrap}.goods-specification small.is-detail{max-width:120px}.goods-specification small.is-standard{background:#edf7f2;color:#237250}.goods-specification small.is-carton{background:#fff3dd;color:#9c620d}.row-level{padding:5px 8px;border-radius:999px;background:#e8f6ee;color:#087747;font-size:11px;font-weight:900}.is-level_b .row-level{background:#fff2dc;color:#a5680c}.unit-cell{color:#4f5e56;font-size:12px}.quantity-cell strong,.quantity-cell small,.department-cell strong,.department-cell small{display:block}.quantity-cell strong{color:#153d2e;font-size:18px}.quantity-cell small{margin-top:3px;color:#aa711e;font-size:10px}.department-cell strong{max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.department-cell small{margin-top:2px;color:#929c97;font-size:9px}.department-cell small.department-estimate{color:#0b8050;font-size:10px;font-weight:800}.trust-cell strong{display:block;color:#0d7f4d;font-size:14px}.trust-cell>span{display:block;width:74px;height:4px;margin-top:5px;border-radius:99px;background:#e4ebe7;overflow:hidden}.trust-cell>span i{display:block;height:100%;background:#1a9b60}.is-level_b .trust-cell strong{color:#b17216}.is-level_b .trust-cell>span i{background:#d79b40}.detail-button{padding:6px 0;border:0;background:transparent;color:#66766d;font-size:11px}.product-evidence{display:grid;grid-template-columns:1.15fr .85fr;gap:20px;margin:0 5px;padding:12px 19px 14px;border-radius:9px;background:#f5faf7}.product-evidence strong{display:block;color:#395047;font-size:12px}.product-evidence ul{display:grid;gap:6px;margin:9px 0 0;padding:0;list-style:none}.product-evidence li{position:relative;padding-left:15px;color:#5e6d65;font-size:11px;line-height:1.5}.product-evidence li::before{content:'✓';position:absolute;left:0;color:#128d56;font-weight:900}.product-evidence p{margin:9px 0 5px;color:#5e6d65;font-size:11px;line-height:1.5}.product-evidence span{color:#a06d1d;font-size:11px}.empty-products{padding:60px 20px;text-align:center;color:#89948e;font-size:13px}.product-detail__footer{flex:none;display:flex;align-items:center;justify-content:flex-start;padding:8px}.product-detail__footer span{color:#415149;font-size:12px;font-weight:900}
@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1350px){.workspace-top{grid-template-columns:220px minmax(0,1fr)}.header-range-presets button{padding:0 7px}.header-level-tabs button em{display:none}.time-toolbar{grid-template-columns:auto minmax(340px,1fr) auto}.product-board{grid-template-columns:195px minmax(0,1fr)}.product-table__head,.product-row{grid-template-columns:minmax(190px,1.5fr) 68px 60px 88px 105px 80px 60px}.goods-specification small.is-detail{display:none}}
@media(max-width:1020px){.workspace-top{grid-template-columns:190px minmax(0,1fr)}.header-range-presets button:nth-child(4){display:none}.time-toolbar{grid-template-columns:auto minmax(0,1fr)}.selected-range{display:none}.product-board{grid-template-columns:175px minmax(0,1fr)}.product-table__head,.product-row{grid-template-columns:minmax(125px,1.4fr) 65px 60px 86px 68px}.product-table__head span:nth-child(5),.product-table__head span:nth-child(6),.department-cell,.trust-cell{display:none}.product-evidence{grid-template-columns:1fr}}

/* 商品优先布局：顶部只保留日期和快捷操作，右侧主体全部交给商品明细。 */
.prediction-header-controls{gap:6px;overflow:hidden}.header-date-range{height:36px;display:flex;align-items:center;gap:8px;padding:3px 8px 3px 10px;border:1px solid #d7e1db;border-radius:8px;background:#fff}.header-date-range>span{color:#6f7d75;font-size:9px;font-weight:900;white-space:nowrap}.header-date-range label{height:28px;display:flex;align-items:center;gap:5px}.header-date-range input{width:116px;border:0;outline:0;background:transparent;color:#28352e;font-size:11px;font-weight:700}.header-date-range label>i{color:#9aa69f;font-size:11px;font-style:normal}.header-date-range.is-custom{border-color:#a9d4bc}.header-range-presets button{height:36px}.header-refresh{height:36px}.header-level-tabs{height:36px;display:flex;align-items:center;gap:2px;padding:0 5px}.header-level-tabs>span{display:flex;align-items:center;gap:4px;padding:0 4px}.header-level-tabs>span i{width:18px;height:18px;display:grid;place-items:center;border-radius:99px;background:#e8f6ee;color:#087747;font-size:9px;font-style:normal;font-weight:900}.header-level-tabs>span.is-level_b i{background:#fff0d7;color:#ad6b0a}.header-level-tabs>span b{color:#5f6e66;font-size:10px}
.overview-panel{gap:0}.product-board{flex:1;min-height:0;display:flex;border-radius:12px}.product-detail{width:100%;padding:9px 12px 0}.product-detail__header{min-height:40px;padding:0 4px 6px}.product-detail__header h2{font-size:17px}.detail-level-filter{display:flex;align-items:center;gap:5px;margin-left:3px}.detail-level-filter button{height:27px;display:flex;align-items:center;gap:5px;padding:0 8px;border:1px solid #dbe5df;border-radius:7px;background:#fff;color:#617068}.detail-level-filter button i{width:18px;height:18px;display:grid;place-items:center;border-radius:50%;background:#e9f6ef;color:#087b48;font-size:9px;font-style:normal;font-weight:900}.detail-level-filter button b{font-size:10px}.detail-level-filter button.active{border-color:#9fd3b8;background:#edf8f2;color:#087b48;box-shadow:0 3px 8px rgba(17,145,86,.1)}.detail-level-filter button.is-level_b i{background:#fff0d6;color:#a96a0e}.detail-level-filter button.is-level_b.active{border-color:#edca8d;background:#fff6e7;color:#a5680c}.goods-search{width:260px;height:32px}.category-tabs{flex:none;display:flex;align-items:center;align-content:flex-start;flex-wrap:wrap;gap:7px;min-width:0;overflow:visible;padding:2px 4px 8px}.category-tabs button{height:32px;display:flex;align-items:center;gap:9px;padding:0 13px;border:1px solid #dfe7e2;border-radius:7px;background:#fff;color:#536159;font-size:13px;font-weight:900;white-space:nowrap}.category-tabs button b{min-width:21px;padding:2px 5px;border-radius:99px;background:#f0f4f2;color:#718078;font-size:11px}.category-tabs button.active{border-color:#15965a;background:#15965a;color:#fff;box-shadow:0 4px 10px rgba(21,150,90,.13)}.category-tabs button.active b{background:rgba(255,255,255,.18);color:#fff}
.detail-level-filter button>span{font-size:10px;font-weight:800;white-space:nowrap}
.product-table{border:1px solid #e1e8e4;border-radius:9px;background:#fff;overflow-x:hidden}.product-table__head,.product-row{grid-template-columns:34px minmax(170px,240px) 100px 86px 105px 100px minmax(120px,1fr) 112px;gap:10px}.product-table__head{min-height:38px;padding:0 14px;border-radius:8px 8px 0 0;background:#f7f9f8}.product-row{min-height:49px;padding:4px 14px}.goods-sequence{display:block;color:#75847c;font-size:12px;font-style:normal;font-weight:800;text-align:center}.product-row.is-level_b>.goods-sequence{color:#a66d17}.goods-name{gap:0}.goods-name strong,.quantity-cell strong,.unit-cell{color:#1f2b25;font-size:13px;font-weight:800;line-height:1.15}.goods-specification{margin-top:2px}.goods-specification:empty{display:none}.goods-specification small{padding:0;border-radius:0;background:transparent;color:#68776f;font-size:11px;line-height:1.15}.goods-specification small+small::before{content:'·';margin-right:4px;color:#a8b2ac}.goods-specification small.is-standard,.goods-specification small.is-carton{background:transparent}.goods-specification small.is-standard{color:#50675b}.goods-specification small.is-carton{color:#946111}.row-level{padding:4px 7px}.department-cell strong{font-size:12px}.department-cell small.department-estimate{display:block;margin-top:2px;color:#087b48;font-size:10px;font-weight:800}.trust-cell strong{font-size:13px}.trust-cell>span{margin-top:3px}.product-detail__footer{justify-content:space-between;min-height:34px;padding:5px 6px}.product-detail__footer small{color:#7d8a83;font-size:10px}:global(.product-header__page p){display:none}
.row-level,.is-level_b .row-level{padding:0;border-radius:0;background:transparent}.row-level{color:#087747}.is-level_b .row-level{color:#a5680c}.department-cell{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:3px 7px;min-width:0;white-space:normal}.department-cell strong{line-height:1.35}.department-cell small.department-estimate{display:flex;min-width:0;flex-wrap:wrap;gap:2px 8px;margin:0;color:#1f2b25;font-size:12px;font-weight:400;line-height:1.35;white-space:normal}.department-cell small.department-estimate span{display:inline-block;white-space:nowrap}
.department-cell{display:flex;flex-direction:column;align-items:stretch;gap:3px;min-width:0}.department-order-line{display:flex;align-items:flex-start;gap:7px;min-width:0;white-space:normal}.department-order-line strong{flex:none;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.department-order-line small{display:block;min-width:0;margin:0;color:#1f2b25;font-size:11px;line-height:1.35;white-space:normal;overflow-wrap:anywhere}.product-row:has(.department-order-line:nth-child(2)){min-height:58px}
@media(max-width:1480px){.header-date-range>span{display:none}.header-date-range{gap:3px;padding-left:5px}.header-date-range input{width:104px}.product-table__head,.product-row{grid-template-columns:30px minmax(150px,200px) 88px 72px 86px 86px minmax(90px,1fr) 98px}.goods-specification small.is-detail{display:none}}
@media(max-width:1180px){.header-date-range{display:none}.workspace-top{grid-template-columns:205px minmax(0,1fr)}.product-table__head,.product-row{grid-template-columns:26px minmax(150px,210px) 82px 68px 60px 82px}.product-table__head span:nth-child(7),.product-table__head span:nth-child(8),.department-cell,.procurement-cell{display:none}}
.quantity-cell{display:flex;align-items:center;gap:8px}.quantity-cell>span{min-width:0}
.stock-cell{display:flex;align-items:baseline;gap:4px;color:#69766f;font-size:11px}.stock-cell strong{color:#24342b;font-size:13px}.stock-cell small{color:#7d8982;font-size:10px}.procurement-cell{display:flex;align-items:center}.procurement-cell>button{min-width:84px;height:28px;padding:0 9px;border:1px solid #15965a;border-radius:7px;background:#fff;color:#087b48;font-size:11px;font-weight:900}.procurement-cell>button:hover{background:#edf8f2}.procurement-cell>button:disabled{cursor:default;opacity:.55}.procurement-active{display:flex;align-items:center;gap:5px;color:#087b48;font-size:11px;font-weight:900}.procurement-active::before{content:'✓';width:16px;height:16px;display:grid;place-items:center;border-radius:50%;background:#e6f5ed;font-size:9px}.procurement-active small{color:#738078;font-size:9px;font-weight:700}.procurement-pending,.procurement-unknown{color:#87938c;font-size:11px}.procurement-unknown{color:#a0691a}.procurement-toast{position:fixed;right:28px;bottom:26px;z-index:20;max-width:420px;padding:11px 15px;border-radius:9px;background:#177d50;color:#fff;box-shadow:0 8px 24px rgba(25,60,43,.22);font-size:12px;font-weight:800}.procurement-toast.is-error{background:#a63c47}
</style>
