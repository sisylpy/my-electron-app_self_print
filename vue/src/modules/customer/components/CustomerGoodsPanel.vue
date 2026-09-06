<template>
  <div class="goods-panel">
    <div class="goods-overview">
      <section class="summary-strip" aria-label="客户商品概览">
        <template v-if="viewMode === 'frequency'">
          <div><span>商品</span><strong>{{ stats.total }}</strong></div>
          <div><span>有要求</span><strong class="green">{{ stats.requirement }}</strong></div>
          <div><span>周期稳定</span><strong>{{ stats.stable }}</strong></div>
          <div><span>近7天订货</span><strong>{{ stats.recent }}</strong></div>
        </template>
        <template v-else>
          <div><span>统计范围</span><strong class="scope-label">{{ selectedAmountWindow.label }}</strong></div>
          <div><span>订货总额</span><strong class="green">{{ formatCurrency(amountStats.totalAmount) }}</strong></div>
          <div><span>核心商品</span><strong>{{ amountStats.core }}</strong></div>
          <div><span>有金额</span><strong>{{ amountStats.withAmount }}</strong></div>
        </template>
      </section>
      <div class="goods-tools">
        <div class="view-toggle" aria-label="客户商品排序方式">
          <button type="button" :class="{ active: viewMode === 'frequency' }" @click="viewMode = 'frequency'">订货频率</button>
          <button type="button" :class="{ active: viewMode === 'amount' }" @click="viewMode = 'amount'">订货金额</button>
        </div>
        <select v-if="viewMode === 'amount'" v-model="amountWindow" class="amount-window" aria-label="订货金额统计范围">
          <option v-for="window in amountWindows" :key="window.key" :value="window.key">{{ window.label }}</option>
        </select>
        <label class="search-box">
          <span>⌕</span>
          <input v-model.trim="keyword" placeholder="搜索商品名称、规格" />
          <button v-if="keyword" type="button" aria-label="清空搜索" @click="keyword = ''">×</button>
        </label>
      </div>
    </div>

    <div v-if="loading" class="panel-state">正在加载客户商品…</div>
    <div v-else-if="errorText" class="panel-state error">
      {{ errorText }}
      <button type="button" @click="loadGoods">重新加载</button>
    </div>
    <template v-else>
      <div v-if="visibleGroups.length" class="frequency-groups">
        <section
          v-for="group in visibleGroups"
          :key="group.key"
          class="frequency-group"
          :class="`tone-${group.tone}`"
        >
          <header class="group-head">
            <div><i></i><strong>{{ group.title }}</strong><span>（{{ group.range }}）</span></div>
            <b>{{ group.items.length }}</b>
          </header>

          <article v-for="item in group.items" :key="item.relationId" class="goods-row">
            <div class="goods-avatar">
              <img v-if="item.imageUrl" :src="item.imageUrl" alt="" />
              <span v-else>{{ item.initials }}</span>
            </div>

            <div class="goods-identity">
              <strong>{{ item.goodsName }}</strong>
              <span v-if="item.spec">{{ item.spec }}</span>
              <div v-if="item.hasRequirement || item.imageCount" class="goods-tags">
                <em v-if="item.hasRequirement">有要求</em>
                <em v-if="item.imageCount" class="image-count">▧ {{ item.imageCount }} 张标准图</em>
              </div>
            </div>

            <div v-if="viewMode === 'amount'" class="amount-value">
              <strong>{{ formatCurrency(item.amountValue) }}</strong>
              <span>占总额 {{ formatPercent(item.amountShare) }}</span>
            </div>
            <div v-else class="frequency-value">
              <strong>{{ item.intervalText }}</strong>
              <span>天/次</span>
            </div>

            <div class="order-metrics">
              <span class="average-order-quantity">{{ averageOrderQuantityText(item) }}</span>
              <span
                v-if="viewMode === 'amount'"
                class="order-cadence"
                title="按近90天已完成历史订单计算"
              >{{ orderCadenceText(item) }}</span>
            </div>

            <div class="last-order">
              <span>上次订货</span>
              <strong>{{ item.lastOrderText }}</strong>
            </div>

            <div class="goods-actions">
              <button type="button" class="requirement-button" @click="openStandard(item)">
                商品要求<span v-if="item.requirementCount"> {{ item.requirementCount }}</span>
              </button>
              <button type="button" class="order-price-button" @click="orderPriceGoods = item">
                订货单价
              </button>
              <button type="button" class="price-button" @click="$emit('open-price', item)">
                历史单价
              </button>
            </div>
          </article>
        </section>
      </div>

      <div v-else class="panel-state">
        <template v-if="keyword">
          <strong>没有找到商品</strong><span>换个名称或规格试试</span>
        </template>
        <template v-else>
          <strong>暂无客户商品</strong><span>有真实订货记录后会显示在这里</span>
        </template>
      </div>
    </template>

    <CustomerGoodsOrderPriceDialog
      v-if="orderPriceGoods"
      :goods="orderPriceGoods"
      @close="orderPriceGoods = null"
      @updated="handleOrderPriceUpdated"
    />
  </div>
</template>

<script>
import customerApi from '../api/customerApi';
import CustomerGoodsOrderPriceDialog from './CustomerGoodsOrderPriceDialog.vue';
import {
  CUSTOMER_GOODS_AMOUNT_GROUPS,
  CUSTOMER_GOODS_AMOUNT_WINDOWS,
  buildCustomerGoodsAmountRows,
  resolveCustomerGoodsAverageQuantity,
  summarizeCustomerGoodsAmountRows,
} from '../presentation/customerGoodsAmountPresentation';

const FREQUENCY_GROUPS = [
  { key: 'high', title: '高频订货', range: '每天 / 隔天', tone: 'green' },
  { key: 'regular', title: '常购', range: '3–7 天', tone: 'blue' },
  { key: 'periodic', title: '周期采购', range: '8–15 天', tone: 'orange' },
  { key: 'occasional', title: '偶尔采购', range: '15 天以上', tone: 'gray' },
  { key: 'unknown', title: '记录不足', range: '暂未形成周期', tone: 'light' },
];

export default {
  name: 'CustomerGoodsPanel',
  components: { CustomerGoodsOrderPriceDialog },
  props: {
    customerId: { type: [Number, String], required: true },
    customerName: { type: String, default: '' },
  },
  emits: ['open-standard', 'open-price', 'notice'],
  data() {
    return {
      goods: [],
      keyword: '',
      viewMode: 'frequency',
      amountWindow: '90',
      amountWindows: CUSTOMER_GOODS_AMOUNT_WINDOWS,
      orderPriceGoods: null,
      loading: false,
      errorText: '',
      imageServer: customerApi.imageServerUrl(),
    };
  },
  computed: {
    stats() {
      return {
        total: this.goods.length,
        requirement: this.goods.filter((item) => item.hasRequirement).length,
        stable: this.goods.filter((item) => item.intervalDays !== null && item.intervalDays <= 15).length,
        recent: this.goods.filter((item) => item.lastOrderDays !== null && item.lastOrderDays <= 7).length,
      };
    },
    selectedAmountWindow() {
      return CUSTOMER_GOODS_AMOUNT_WINDOWS.find((item) => item.key === this.amountWindow)
        || CUSTOMER_GOODS_AMOUNT_WINDOWS[1];
    },
    amountRows() {
      return buildCustomerGoodsAmountRows(this.goods, this.selectedAmountWindow.field);
    },
    amountStats() {
      return summarizeCustomerGoodsAmountRows(this.amountRows);
    },
    displayGoods() {
      return this.viewMode === 'amount' ? this.amountRows : this.goods;
    },
    filteredGoods() {
      const key = this.keyword.toLowerCase();
      if (!key) return this.displayGoods;
      return this.displayGoods.filter((item) => [item.goodsName, item.originalGoodsName, item.spec, item.categoryName]
        .some((value) => String(value || '').toLowerCase().includes(key)));
    },
    visibleGroups() {
      const groups = this.viewMode === 'amount' ? CUSTOMER_GOODS_AMOUNT_GROUPS : FREQUENCY_GROUPS;
      const groupField = this.viewMode === 'amount' ? 'amountKey' : 'frequencyKey';
      return groups.map((group) => ({
        ...group,
        items: this.filteredGoods.filter((item) => item[groupField] === group.key),
      })).filter((group) => group.items.length);
    },
  },
  watch: {
    customerId: {
      immediate: true,
      handler() {
        this.keyword = '';
        this.loadGoods();
      },
    },
  },
  methods: {
    async loadGoods() {
      if (!this.customerId) return;
      this.loading = true;
      this.errorText = '';
      try {
        const response = await customerApi.getCustomerGoodsProfile(this.customerId);
        if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '客户商品加载失败');
        this.goods = this.normalizeGoods(response.data.data || []);
      } catch (error) {
        this.goods = [];
        this.errorText = error?.message || '客户商品加载失败';
      } finally {
        this.loading = false;
      }
    },
    normalizeGoods(source) {
      return source.map((row) => {
        const intervalDays = this.toPositiveNumber(row.averageOrderIntervalDays);
        const lastOrder = this.lastOrderView(row.lastOrderDate);
        const goodsName = this.text(row.goodsName) || '未命名商品';
        const requirementCount = this.toInteger(row.requirementCount);
        const imageCount = this.toInteger(row.standardImageCount);
        return {
          relationId: row.relationId,
          goodsId: row.goodsId,
          goodsName,
          originalGoodsName: this.text(row.originalGoodsName),
          spec: this.text(row.specification),
          categoryName: this.text(row.categoryName),
          customerName: this.text(row.customerName) || this.customerName,
          orderPrice: this.text(row.orderPrice),
          intervalDays,
          intervalText: intervalDays === null ? '—' : this.formatNumber(intervalDays),
          frequencyKey: this.frequencyKey(intervalDays),
          lastOrderDate: lastOrder.date,
          lastOrderText: lastOrder.text,
          lastOrderDays: lastOrder.days,
          orderDayCount: this.toInteger(row.orderDayCount),
          ordersLast30Days: this.toInteger(row.ordersLast30Days),
          orderAmount30Days: this.toAmount(row.orderAmount30Days),
          orderAmount90Days: this.toAmount(row.orderAmount90Days),
          orderAmount365Days: this.toAmount(row.orderAmount365Days),
          orderAmountAll: this.toAmount(row.orderAmountAll),
          averageOrderQuantity30Days: this.toPositiveNumber(row.averageOrderQuantity30Days),
          averageOrderQuantity90Days: this.toPositiveNumber(row.averageOrderQuantity90Days),
          averageOrderQuantity365Days: this.toPositiveNumber(row.averageOrderQuantity365Days),
          averageOrderQuantityAll: this.toPositiveNumber(row.averageOrderQuantityAll),
          averageOrderQuantityUnit: this.text(row.averageOrderQuantityUnit),
          requirementCount,
          imageCount,
          hasRequirement: requirementCount > 0,
          imagePath: this.text(row.imagePath),
          imageUrl: this.imageUrl(row.imagePath),
          initials: goodsName.slice(0, 1),
        };
      }).sort((a, b) => {
        const aInterval = a.intervalDays === null ? Number.MAX_SAFE_INTEGER : a.intervalDays;
        const bInterval = b.intervalDays === null ? Number.MAX_SAFE_INTEGER : b.intervalDays;
        if (aInterval !== bInterval) return aInterval - bInterval;
        const aLast = a.lastOrderDays === null ? Number.MAX_SAFE_INTEGER : a.lastOrderDays;
        const bLast = b.lastOrderDays === null ? Number.MAX_SAFE_INTEGER : b.lastOrderDays;
        if (aLast !== bLast) return aLast - bLast;
        return a.goodsName.localeCompare(b.goodsName, 'zh-CN');
      });
    },
    openStandard(item) {
      this.$emit('open-standard', {
        nxDepartmentDisGoodsId: item.relationId,
        nxDdgDisGoodsId: item.goodsId,
        nxDdgOrderGoodsName: item.goodsName,
        nxDdgDepGoodsName: item.goodsName,
        nxDdgOrderStandard: item.spec,
        nxDdgDepGoodsStandardname: item.spec,
        nxDistributerGoodsEntity: {
          nxDistributerGoodsId: item.goodsId,
          nxDgGoodsName: item.originalGoodsName || item.goodsName,
          nxDgGoodsStandardname: item.spec,
          nxDgGoodsFileLarge: item.imagePath,
        },
        nxDepartmentEntity: {
          nxDepartmentId: this.customerId,
          nxDepartmentAttrName: item.customerName || this.customerName,
        },
      });
    },
    async handleOrderPriceUpdated() {
      this.orderPriceGoods = null;
      this.$emit('notice', '订货单价已更新');
      await this.loadGoods();
    },
    frequencyKey(days) {
      if (days === null) return 'unknown';
      if (days <= 2) return 'high';
      if (days <= 7) return 'regular';
      if (days <= 15) return 'periodic';
      return 'occasional';
    },
    lastOrderView(value) {
      if (!value) return { date: '', days: null, text: '暂无记录' };
      const normalized = String(value).replace(/[./]/g, '-').slice(0, 10);
      const parts = normalized.split('-').map(Number);
      if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
        return { date: normalized, days: null, text: normalized };
      }
      const orderDate = new Date(parts[0], parts[1] - 1, parts[2]);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const days = Math.max(0, Math.round((today.getTime() - orderDate.getTime()) / 86400000));
      return { date: normalized, days, text: days === 0 ? '今天' : `${days}天前` };
    },
    imageUrl(value) {
      const path = this.text(value);
      if (!path) return '';
      if (/^https?:/i.test(path)) return path;
      return `${this.imageServer}${path.replace(/^\//, '')}`;
    },
    formatNumber(value) {
      return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
    },
    formatCurrency(value) {
      return `¥${Number(value || 0).toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`;
    },
    formatPercent(value) {
      if (!Number.isFinite(Number(value)) || Number(value) <= 0) return '0%';
      return `${Number(value).toFixed(Number(value) >= 10 ? 1 : 2).replace(/\.0$/, '')}%`;
    },
    averageOrderQuantityText(item) {
      const average = resolveCustomerGoodsAverageQuantity(
        item,
        this.viewMode,
        this.selectedAmountWindow,
      );
      if (average.value === null) return '平均每次 暂无数据';
      const value = Number(average.value).toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
      return `平均每次约 ${value}${average.unit}`;
    },
    orderCadenceText(item) {
      if (item.intervalDays === null) return '订货频率：暂未形成周期';
      return `订货频率：约 ${this.formatNumber(item.intervalDays)} 天一次`;
    },
    toAmount(value) {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : 0;
    },
    toPositiveNumber(value) {
      if (value === null || value === undefined || value === '') return null;
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : null;
    },
    toInteger(value) {
      const number = Number(value);
      return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
    },
    text(value) {
      return value === null || value === undefined ? '' : String(value).trim();
    },
  },
};
</script>

<style scoped>
.goods-panel{min-height:480px}.panel-toolbar{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:16px}.panel-toolbar h3{margin:0 0 5px;font-size:25px}.panel-toolbar p{margin:0;color:#77847f;font-size:14px}.search-box{width:340px;height:45px;border:1px solid #d5e1db;border-radius:10px;padding:0 13px;background:#fff;display:flex;align-items:center;gap:9px}.search-box input{border:0;outline:0;width:100%;font-size:14px}.search-box>button{border:0;background:transparent;color:#7c8882;font-size:19px;cursor:pointer}.panel-state{min-height:210px;padding:55px;text-align:center;color:#84908b;background:#fff;border:1px dashed #d5e0db;border-radius:14px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px}.panel-state strong{color:#34413b;font-size:17px}.panel-state.error{color:#bd444e}.panel-state button{margin-top:8px;border:1px solid #d5e1db;background:#fff;border-radius:8px;padding:7px 12px;cursor:pointer}.summary-strip{background:#fff;border:1px solid #dfe8e3;border-radius:12px;display:grid;grid-template-columns:repeat(4,1fr);margin-bottom:14px}.summary-strip>div{display:flex;align-items:baseline;justify-content:center;gap:5px;padding:14px;border-right:1px solid #e8eeeb}.summary-strip>div:last-child{border-right:0}.summary-strip span{color:#798680;font-size:13px;margin-right:10px}.summary-strip strong{font-size:27px;color:#17241e}.summary-strip strong.green{color:#0a8c50}.summary-strip small{color:#7d8983}.sort-line{display:flex;align-items:center;justify-content:space-between;margin:16px 2px 10px}.sort-line strong{font-size:15px}.sort-line span{font-size:12px;color:#89948f}.frequency-groups{display:grid;gap:14px}.frequency-group{background:#fff;border:1px solid #dfe8e3;border-radius:13px;overflow:hidden}.group-head{display:flex;justify-content:space-between;align-items:center;padding:11px 15px;background:#fbfcfb;border-bottom:1px solid #e8eeeb}.group-head>div{display:flex;align-items:center}.group-head i{width:4px;height:22px;border-radius:4px;background:#14985a;margin-right:10px}.group-head strong{font-size:16px}.group-head span{font-size:13px;color:#79857f;margin-left:3px}.group-head b{font-size:12px;background:#eaf4ef;color:#168551;border-radius:12px;min-width:25px;text-align:center;padding:4px 7px}.tone-blue .group-head i{background:#4285f4}.tone-blue .group-head b{background:#edf4ff;color:#3975d2}.tone-orange .group-head i{background:#ef8b22}.tone-orange .group-head b{background:#fff2e4;color:#cc6e10}.tone-gray .group-head i{background:#687681}.tone-gray .group-head b{background:#eef1f3;color:#5e6b75}.tone-light .group-head i{background:#aeb7b2}.tone-light .group-head b{background:#f1f3f2;color:#7c8781}.goods-row{display:grid;grid-template-columns:52px minmax(160px,1fr) 140px 190px 135px 245px;align-items:center;gap:16px;min-height:76px;padding:10px 15px;border-bottom:1px solid #edf1ef}.goods-row:last-child{border-bottom:0}.goods-avatar{width:46px;height:46px;border-radius:9px;background:#e8f5ee;color:#0a8750;display:grid;place-items:center;overflow:hidden;font-weight:900}.goods-avatar img{width:100%;height:100%;object-fit:cover}.goods-identity{min-width:0}.goods-identity>strong{display:block;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.goods-identity>span{display:block;color:#75827c;font-size:12px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.goods-tags{display:flex;gap:7px;margin-top:6px}.goods-tags em{font-style:normal;font-size:11px;color:#c14e47;background:#fff1f0;border-radius:5px;padding:2px 6px}.goods-tags em.image-count{background:transparent;color:#65736c;padding-left:0}.order-metrics{min-width:0;display:flex;flex-direction:column;justify-content:center;gap:5px}.order-metrics>span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}.order-metrics>span.average-order-quantity{color:#148655;font-weight:700}.order-metrics>span.order-cadence{color:#566860;font-weight:700}.frequency-value,.amount-value,.last-order{display:flex;flex-direction:column}.frequency-value strong,.amount-value strong{font-size:19px;color:#0b8850}.frequency-value span,.amount-value span,.last-order span{font-size:11px;color:#87928d;margin-top:3px}.last-order strong{font-size:14px;margin-top:4px}.goods-actions{display:flex;justify-content:flex-end;gap:8px}.goods-actions button{height:35px;border-radius:8px;padding:0 10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}.requirement-button{border:1px solid #b7dec9;background:#eef9f3;color:#087b48}.order-price-button{border:1px solid #99d1b5;background:#fff;color:#087b48}.price-button{border:1px solid #d7e0db;background:#fff;color:#46534d}.goods-actions button:hover{filter:brightness(.97)}@media(max-width:1150px){.goods-row{grid-template-columns:48px minmax(130px,1fr) 115px 165px 110px 205px}.goods-actions{gap:7px}.goods-actions button{padding:0 7px}}@media(max-width:820px){.panel-toolbar{align-items:stretch;flex-direction:column}.search-box{width:auto}.summary-strip{grid-template-columns:repeat(2,1fr)}.goods-row{grid-template-columns:48px minmax(0,1fr) 145px}.goods-avatar{grid-column:1;grid-row:1}.goods-identity{grid-column:2;grid-row:1}.order-metrics{grid-column:3;grid-row:1}.frequency-value,.amount-value{grid-column:2;grid-row:2}.last-order{display:none}.goods-actions{grid-column:3;grid-row:2;justify-content:flex-end;flex-wrap:wrap}.goods-actions button{height:31px}}
.goods-overview{
  display:flex;
  align-items:center;
  justify-content:space-between;
  flex-wrap:wrap;
  gap:18px;
  margin-bottom:10px;
  padding:0 2px;
}
.goods-tools{display:flex;align-items:center;justify-content:flex-end;flex:0 0 auto;gap:8px;min-width:0;margin-left:auto}
.view-toggle{height:38px;display:flex;flex:0 0 auto;min-width:158px;border:1px solid #cfdcd5;border-radius:9px;overflow:hidden;background:#fff;white-space:nowrap}
.view-toggle button{min-width:79px;flex:0 0 79px;border:0;border-right:1px solid #e1e9e5;background:#fff;color:#58665f;padding:0 10px;font-size:12px;font-weight:700;cursor:pointer}
.view-toggle button:last-child{border-right:0}.view-toggle button.active{background:#10965a;color:#fff}
.amount-window{height:38px;flex:0 0 auto;border:1px solid #d5e1db;border-radius:9px;background:#fff;color:#46544d;padding:0 27px 0 10px;font-size:12px;outline:none}
.goods-overview .search-box{
  flex:0 0 310px;
  width:auto;
  height:38px;
  border-radius:9px;
  padding:0 12px;
}
.goods-overview .search-box input{font-size:13px}
.goods-overview .summary-strip{
  flex:1 1 520px;
  min-width:0;
  display:flex;
  align-items:center;
  gap:22px;
  flex-wrap:wrap;
  margin:0;
  border:0;
  border-radius:0;
  background:transparent;
}
.goods-overview .summary-strip>div{
  display:flex;
  align-items:baseline;
  justify-content:flex-start;
  gap:6px;
  padding:0;
  border:0;
  white-space:nowrap;
}
.goods-overview .summary-strip span{
  margin:0;
  color:#798680;
  font-size:12px;
}
.goods-overview .summary-strip strong{font-size:20px}
.goods-overview .summary-strip strong.scope-label{font-size:15px}
@media(max-width:1150px){
  .goods-overview{flex-wrap:wrap}
  .goods-overview .summary-strip{gap:12px}
  .goods-overview .search-box{flex-basis:260px}
  .goods-tools{width:100%}
}
@media(max-width:820px){
  .goods-overview{align-items:stretch;flex-direction:column}
  .goods-overview .search-box{width:auto;flex-basis:auto}
  .goods-overview .summary-strip{flex:0 0 auto;justify-content:space-between}
  .goods-tools{min-width:0;flex-wrap:wrap;justify-content:flex-start}
  .goods-tools .search-box{flex:1 0 100%}
}
</style>
