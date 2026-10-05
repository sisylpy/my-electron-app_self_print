<template>
  <section class="customer-product-panel">
    <header>
      <div>
        <span>客户购买明细</span>
        <h2>{{ resolvedCustomer?.customerName || '请选择客户' }}</h2>
        <p v-if="resolvedCustomer">{{ categoryName }} · 最近订货 {{ resolvedCustomer.lastOrderDate || '暂无日期' }}</p>
      </div>
    </header>

    <template v-if="resolvedCustomer">
      <section class="customer-product-summary">
        <article><strong>{{ formatMoney(resolvedCustomer.salesAmount) }}</strong><span>成交额</span></article>
        <article><strong>{{ resolvedCustomer.goodsCount || totalCount || 0 }}</strong><span>商品数</span></article>
        <article><strong>{{ resolvedCustomer.orderCount || 0 }}</strong><span>订货次数</span></article>
      </section>

      <div v-if="error" class="customer-product-state error">{{ error }}</div>
      <div v-else-if="loading" class="customer-product-state">正在加载该客户购买的商品…</div>
      <div v-else class="customer-product-table-wrap">
        <table>
          <thead><tr><th>商品</th><th>数量</th><th>成交额</th><th>均价</th><th>次数</th></tr></thead>
          <tbody>
            <tr v-for="product in products" :key="product.goodsId">
              <td>
                <span class="customer-product-identity">
                  <span class="customer-product-thumb"><img :src="goodsImage(product)" :alt="product.goodsName" /></span>
                  <span><strong>{{ product.goodsName }}</strong><small>{{ product.goodsStandard || '未标规格' }}</small></span>
                </span>
              </td>
              <td>{{ formatQuantities(product.quantities) }}</td>
              <td class="money">{{ formatMoney(product.salesAmount) }}</td>
              <td>{{ formatAveragePrices(product.averagePrices) }}</td>
              <td>{{ product.orderCount || 0 }}</td>
            </tr>
            <tr v-if="!products.length"><td colspan="5" class="empty-cell">该客户在此大类下暂无商品数据</td></tr>
          </tbody>
        </table>
      </div>

      <footer>
        <span>共 {{ totalCount }} 种商品</span>
        <nav v-if="totalPages > 1" aria-label="客户商品分页">
          <button type="button" :disabled="loading || page <= 1" @click="$emit('page', page - 1)">上一页</button>
          <b>{{ page }} / {{ totalPages }}</b>
          <button type="button" :disabled="loading || page >= totalPages" @click="$emit('page', page + 1)">下一页</button>
        </nav>
      </footer>
    </template>
    <div v-else class="customer-product-state">请先从左侧选择一个客户</div>
  </section>
</template>

<script>
import {
  formatAveragePrices,
  formatMoney,
  formatQuantities,
  resolveGoodsImage,
} from '../presentation/salesAnalysisPresentation';

export default {
  name: 'CustomerProductPanel',
  props: {
    customer: { type: Object, default: null },
    detail: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
    categoryName: { type: String, default: '商品大类' },
    imageServer: { type: String, required: true },
  },
  emits: ['page'],
  computed: {
    resolvedCustomer() { return this.detail?.customer || this.customer; },
    products() { return this.detail?.products || []; },
    page() { return Number(this.detail?.page) || 1; },
    totalCount() { return Number(this.detail?.totalCount) || 0; },
    totalPages() { return Math.max(1, Number(this.detail?.totalPages) || 1); },
  },
  methods: {
    formatAveragePrices,
    formatMoney,
    formatQuantities,
    goodsImage(product) {
      return resolveGoodsImage(product, this.imageServer, 'goodsImage/logo.jpg');
    },
  },
};
</script>

<style scoped>
* { box-sizing: border-box; }
.customer-product-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
.customer-product-panel > header { min-height: 58px; flex: none; display: flex; align-items: center; padding: 9px 14px; border-bottom: 1px solid #dfe8e3; border-left: 3px solid #10a05d; }
.customer-product-panel header span,.customer-product-panel header h2,.customer-product-panel header p { display: block; margin: 0; }
.customer-product-panel header span { color: #0b8b52; font-size: 9px; font-weight: 800; }
.customer-product-panel header h2 { margin-top: 2px; color: #202d27; font-size: 16px; }
.customer-product-panel header p { margin-top: 2px; color: #829089; font-size: 9px; }
.customer-product-summary { flex: none; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid #dfe8e3; }
.customer-product-summary article { min-width: 0; padding: 11px 7px; border-right: 1px solid #e3ebe7; text-align: center; }
.customer-product-summary article:last-child { border-right: 0; }
.customer-product-summary strong,.customer-product-summary span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.customer-product-summary strong { color: #183026; font-size: 15px; }
.customer-product-summary span { margin-top: 3px; color: #839089; font-size: 9px; }
.customer-product-table-wrap { flex: 1; min-height: 0; overflow: auto; }
table { width: 100%; min-width: 610px; border-collapse: collapse; }
th,td { padding: 9px 7px; border-bottom: 1px solid #e8eeeb; text-align: left; vertical-align: middle; }
th { position: sticky; top: 0; z-index: 1; background: #f5f8f6; color: #78857f; font-size: 9px; white-space: nowrap; }
td { color: #34423b; font-size: 11px; }
td:first-child { min-width: 160px; }
td:nth-child(2),td:nth-child(4) { min-width: 110px; }
td.money { color: #07814b; font-weight: 800; white-space: nowrap; }
.customer-product-identity { display: flex; align-items: center; gap: 7px; }
.customer-product-identity > span:last-child { min-width: 0; }
.customer-product-identity strong,.customer-product-identity small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.customer-product-identity strong { color: #26372f; font-size: 12px; }
.customer-product-identity small { margin-top: 2px; color: #8a9690; font-size: 9px; }
.customer-product-thumb { width: 34px; height: 34px; flex: none; overflow: hidden; border: 1px solid #e0e9e4; border-radius: 7px; background: #f3f7f5; }
.customer-product-thumb img { width: 100%; height: 100%; display: block; object-fit: cover; }
.empty-cell { padding: 35px !important; color: #87938d; text-align: center !important; }
.customer-product-state { flex: 1; min-height: 180px; display: grid; place-items: center; padding: 20px; color: #84918b; font-size: 11px; text-align: center; }
.customer-product-state.error { color: #ac3c45; }
.customer-product-panel > footer { min-height: 38px; flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 11px; border-top: 1px solid #e2eae6; color: #7f8c85; font-size: 9px; }
.customer-product-panel footer nav { display: flex; align-items: center; gap: 6px; }
.customer-product-panel footer button { height: 26px; padding: 0 8px; border: 1px solid #cfe0d7; border-radius: 6px; background: #fff; color: #167144; cursor: pointer; }
.customer-product-panel footer button:disabled { opacity: .45; cursor: default; }
.customer-product-panel footer b { color: #5f6e67; font-weight: 600; }
</style>
