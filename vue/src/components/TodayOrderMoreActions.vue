<template>
  <div class="order-action-overlay" @click.self.stop.prevent="close">
    <section class="order-action-dialog" role="dialog" aria-modal="true" @click.stop>
      <header class="order-action-header">
        <div>
          <div class="order-action-eyebrow">订单操作</div>
          <h5>{{ goodsName }}</h5>
          <small>{{ order.nxDoQuantity }}{{ order.nxDoStandard }}</small>
        </div>
        <button class="btn-close" type="button" aria-label="关闭" @click.stop.prevent="close"></button>
      </header>

      <div v-if="mode === 'menu'" class="order-action-menu">
        <button
          v-if="policy.canReplaceGoods"
          type="button"
          class="order-action-item"
          @click.stop="openMode('replace')"
        >
          <span class="order-action-icon">⇄</span>
          <span><strong>替换订货商品</strong><small>保留数量、备注和订单位置</small></span>
        </button>
        <button
          v-if="policy.canInsertBefore"
          type="button"
          class="order-action-item"
          @click.stop="openMode('insert')"
        >
          <span class="order-action-icon">＋</span>
          <span><strong>在之前添加新订单</strong><small>新商品会插入到当前订单前面</small></span>
        </button>
        <button
          v-if="policy.canViewGoods"
          type="button"
          class="order-action-item"
          @click.stop="openMode('detail')"
        >
          <span class="order-action-icon">◌</span>
          <span><strong>商品详情</strong><small>查看商品规格和价格资料</small></span>
        </button>
      </div>

      <div v-else-if="mode === 'replace' || mode === 'insert'" class="order-action-body">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <button class="btn btn-sm btn-light border" type="button" @click.stop="resetMode">返回</button>
          <strong>{{ mode === 'replace' ? '替换订货商品' : '在之前添加新订单' }}</strong>
          <span></span>
        </div>

        <label class="form-label fw-bold">搜索配送商品</label>
        <div class="input-group mb-2">
          <input
            v-model.trim="searchText"
            class="form-control"
            type="search"
            placeholder="输入商品名称"
            @keyup.enter="searchGoods"
          >
          <button class="btn btn-success" type="button" :disabled="searching || searchText.length < 1" @click.stop="searchGoods">
            {{ searching ? '搜索中…' : '搜索' }}
          </button>
        </div>
        <div v-if="searchMessage" class="small text-muted mb-2">{{ searchMessage }}</div>

        <div v-if="results.length" class="order-goods-results">
          <button
            v-for="goods in results"
            :key="goods.nxDistributerGoodsId"
            type="button"
            class="order-goods-result"
            :class="{ selected: selectedGoods?.nxDistributerGoodsId === goods.nxDistributerGoodsId }"
            @click.stop="selectGoods(goods)"
          >
            <span>
              <strong>{{ goods.nxDgGoodsName }}</strong>
              <small>{{ goodsDescription(goods) }}</small>
            </span>
            <span>{{ mode === 'replace' ? '选择' : '添加' }}</span>
          </button>
        </div>

        <div v-if="mode === 'insert' && selectedGoods" class="order-insert-form">
          <div class="mb-3">
            <label class="form-label fw-bold">已选商品</label>
            <div>{{ selectedGoods.nxDgGoodsName }}</div>
          </div>
          <div class="row g-2">
            <div class="col-6">
              <label class="form-label">订货数量</label>
              <input v-model.trim="insertForm.quantity" class="form-control" type="number" step="any" min="0">
            </div>
            <div class="col-6">
              <label class="form-label">单位</label>
              <input v-model.trim="insertForm.standard" class="form-control" type="text">
            </div>
          </div>
          <div class="mt-2">
            <label class="form-label">备注</label>
            <input v-model.trim="insertForm.remark" class="form-control" type="text" maxlength="15">
          </div>
          <button class="btn btn-success w-100 mt-3" type="button" :disabled="submitting" @click.stop="saveInsertBefore">
            {{ submitting ? '保存中…' : '确认添加' }}
          </button>
        </div>
      </div>

      <div v-else-if="mode === 'detail'" class="order-action-body">
        <div class="d-flex align-items-center justify-content-between mb-3">
          <button class="btn btn-sm btn-light border" type="button" @click.stop="resetMode">返回</button>
          <strong>商品详情</strong>
          <span></span>
        </div>
        <div v-if="detailLoading" class="text-center text-muted py-4">加载中…</div>
        <dl v-else class="order-goods-detail">
          <div><dt>商品名称</dt><dd>{{ detailGoods?.nxDgGoodsName || goodsName }}</dd></div>
          <div><dt>商品品牌</dt><dd>{{ displayValue(detailGoods?.nxDgGoodsBrand) }}</dd></div>
          <div><dt>基本单位</dt><dd>{{ displayValue(detailGoods?.nxDgGoodsStandardname) }}</dd></div>
          <div><dt>规格重量</dt><dd>{{ displayValue(detailGoods?.nxDgGoodsStandardWeight) }}</dd></div>
          <div><dt>包装数量</dt><dd>{{ displayValue(detailGoods?.nxDgItemsPerCarton) }} {{ displayValue(detailGoods?.nxDgCartonUnit, '') }}</dd></div>
          <div><dt>商品描述</dt><dd>{{ displayValue(detailGoods?.nxDgGoodsDetail) }}</dd></div>
        </dl>
      </div>
    </section>
    <AlertDialog ref="alertDialog" />
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useStore } from 'vuex';
import api from '../api/all';
import { getTodayOrderActionPolicy } from '../modules/order/services/todayOrderActionPolicy';
import AlertDialog from './AlertDialog.vue';

const props = defineProps({
  order: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['close', 'updated']);
const store = useStore();
const alertDialog = ref(null);
const mode = ref('menu');
const searchText = ref('');
const searching = ref(false);
const submitting = ref(false);
const searchMessage = ref('');
const results = ref([]);
const selectedGoods = ref(null);
const detailGoods = ref(null);
const detailLoading = ref(false);
const insertForm = reactive({ quantity: '', standard: '', remark: '' });

const policy = computed(() => getTodayOrderActionPolicy(props.order));
const goodsName = computed(() => (
  props.order?.nxDistributerGoodsEntity?.nxDgGoodsName
  || props.order?.nxDoGoodsName
  || '未知商品'
));
const disUser = computed(() => store.state.disUser || {});
const distributorId = computed(() => (
  props.order?.nxDoDistributerId
  || disUser.value?.nxDiuDistributerId
  || disUser.value?.nxDistributerId
));
const departmentId = computed(() => props.order?.nxDoDepartmentId || props.order?.nxDoDepartmentFatherId);

function close() {
  emit('close');
}

function resetMode() {
  mode.value = 'menu';
  searchText.value = '';
  searchMessage.value = '';
  results.value = [];
  selectedGoods.value = null;
}

async function openMode(nextMode) {
  mode.value = nextMode;
  if (nextMode === 'detail') await loadGoodsDetail();
}

function goodsDescription(goods) {
  const parts = [goods?.nxDgGoodsBrand, goods?.nxDgGoodsStandardWeight, goods?.nxDgGoodsStandardname]
    .filter(value => value && value !== 'null');
  return parts.join(' · ') || '配送商品';
}

function displayValue(value, fallback = '—') {
  return value === null || value === undefined || value === '' || value === 'null' ? fallback : value;
}

async function searchGoods() {
  if (!searchText.value || !distributorId.value || !departmentId.value) {
    searchMessage.value = '当前订单缺少配送商或客户信息，无法搜索';
    return;
  }
  searching.value = true;
  searchMessage.value = '';
  results.value = [];
  try {
    const res = await api.queryDisGoodsByQuickSearchWithDepId({
      disId: distributorId.value,
      depId: departmentId.value,
      searchStr: searchText.value,
    });
    if (res?.data?.code !== 0) {
      searchMessage.value = res?.data?.msg || '没有找到商品';
      return;
    }
    results.value = (res.data.data?.disArr || []).filter(item => item?.nxDistributerGoodsId);
    searchMessage.value = results.value.length ? `找到 ${results.value.length} 个配送商品` : '没有找到配送商品';
  } catch (error) {
    console.error('搜索配送商品失败:', error);
    searchMessage.value = '搜索失败，请检查网络后重试';
  } finally {
    searching.value = false;
  }
}

async function selectGoods(goods) {
  if (mode.value === 'replace') {
    const confirmed = await alertDialog.value?.confirm(
      `确定将“${goodsName.value}”替换为“${goods.nxDgGoodsName}”吗？\n\n原订单的数量、备注和位置会保留。`
    );
    if (!confirmed) return;
    submitting.value = true;
    try {
      const res = await api.exchangeDepApplyGoods({
        orderId: props.order.nxDepartmentOrdersId,
        goodsId: goods.nxDistributerGoodsId,
      });
      if (res?.data?.code !== 0) {
        await alertDialog.value?.alert(res?.data?.msg || '替换商品失败', 'error');
        return;
      }
      emit('updated', '商品已替换');
    } catch (error) {
      console.error('替换商品失败:', error);
      await alertDialog.value?.alert('替换商品失败，请检查网络后重试', 'error');
    } finally {
      submitting.value = false;
    }
    return;
  }

  selectedGoods.value = goods;
  insertForm.quantity = '';
  insertForm.standard = goods.nxDgGoodsStandardname || props.order?.nxDoStandard || '';
  insertForm.remark = '';
}

async function saveInsertBefore() {
  const quantity = Number(insertForm.quantity);
  if (!selectedGoods.value || !Number.isFinite(quantity) || quantity <= 0) {
    await alertDialog.value?.alert('请选择商品并填写大于 0 的订货数量', 'warning');
    return;
  }
  if (!insertForm.standard) {
    await alertDialog.value?.alert('请填写订货单位', 'warning');
    return;
  }

  submitting.value = true;
  try {
    const goods = selectedGoods.value;
    const payload = {
      nxDoOrderUserId: props.order?.nxDoOrderUserId || disUser.value?.nxDepartmentUserId || disUser.value?.nxDistributerUserId || -1,
      nxDoDisGoodsId: goods.nxDistributerGoodsId,
      nxDoDepartmentId: props.order?.nxDoDepartmentId,
      nxDoDepartmentFatherId: props.order?.nxDoDepartmentFatherId,
      nxDoDistributerId: distributorId.value,
      nxDoQuantity: String(quantity),
      nxDoStandard: insertForm.standard,
      nxDoPrintStandard: goods.nxDgGoodsStandardname || insertForm.standard,
      nxDoRemark: insertForm.remark || '',
      nxDoIsAgent: -1,
      nxDoPurchaseUserId: props.order.nxDepartmentOrdersId,
      nxDoGoodsName: goods.nxDgGoodsName || '',
      nxDoOcrTaskId: props.order?.nxDoOcrTaskId || null,
    };
    const res = await api.manualOrderBefore(payload);
    if (res?.data?.code !== 0) {
      await alertDialog.value?.alert(res?.data?.msg || '添加订单失败', 'error');
      return;
    }
    emit('updated', '新订单已添加');
  } catch (error) {
    console.error('在之前添加订单失败:', error);
    await alertDialog.value?.alert('添加订单失败，请检查网络后重试', 'error');
  } finally {
    submitting.value = false;
  }
}

async function loadGoodsDetail() {
  const goodsId = props.order?.nxDoDisGoodsId || props.order?.nxDistributerGoodsEntity?.nxDistributerGoodsId;
  detailGoods.value = props.order?.nxDistributerGoodsEntity || null;
  if (!goodsId) return;
  detailLoading.value = true;
  try {
    const res = await api.disGetGoods(goodsId);
    if (res?.data?.code === 0 && res.data.data) detailGoods.value = res.data.data;
  } catch (error) {
    console.error('加载商品详情失败:', error);
  } finally {
    detailLoading.value = false;
  }
}
</script>

<style scoped>
.order-action-overlay {
  position: fixed;
  inset: 0;
  z-index: 1080;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(24, 40, 33, 0.48);
}

.order-action-dialog {
  width: min(680px, 94vw);
  max-height: 88vh;
  overflow: auto;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(20, 45, 33, 0.24);
}

.order-action-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid #dce9e2;
  background: #fff;
}

.order-action-header h5 { margin: 2px 0; }
.order-action-header small { color: #718078; }
.order-action-eyebrow { color: #168553; font-size: 11px; font-weight: 800; letter-spacing: .12em; }
.order-action-menu { padding: 8px 0; }

.order-action-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border: 0;
  border-bottom: 1px solid #edf2ef;
  text-align: left;
  background: #fff;
}

.order-action-item:hover { background: #f2faf6; }
.order-action-item span:last-child { display: flex; flex-direction: column; gap: 3px; }
.order-action-item small { color: #74827b; }
.order-action-icon { width: 34px; color: #108554; font-size: 25px; text-align: center; }
.order-action-body { padding: 20px; }
.order-goods-results { max-height: 260px; overflow: auto; border: 1px solid #dce9e2; border-radius: 8px; }

.order-goods-result {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 13px;
  border: 0;
  border-bottom: 1px solid #edf2ef;
  text-align: left;
  background: #fff;
}

.order-goods-result:hover,
.order-goods-result.selected { background: #eaf8f1; }
.order-goods-result span:first-child { display: flex; flex-direction: column; }
.order-goods-result small { color: #718078; }
.order-insert-form { margin-top: 16px; padding: 16px; border-radius: 9px; background: #f5faf7; }
.order-goods-detail { margin: 0; }
.order-goods-detail > div { display: grid; grid-template-columns: 120px 1fr; gap: 16px; padding: 11px 0; border-bottom: 1px solid #edf2ef; }
.order-goods-detail dt { color: #718078; font-weight: 500; }
.order-goods-detail dd { margin: 0; font-weight: 600; }
</style>
