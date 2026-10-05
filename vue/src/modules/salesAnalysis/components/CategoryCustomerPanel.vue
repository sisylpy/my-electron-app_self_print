<template>
  <section class="category-customer-panel">
    <header class="customer-panel-heading">
      <div>
        <h2>{{ category?.name || '商品大类' }} / 按客户</h2>
        <p>按成交销售额从高到低，查看购买该大类的全部客户</p>
      </div>
      <span v-if="totalCount">共 {{ totalCount }} 家</span>
    </header>

    <div class="customer-mode-summary" aria-label="当前大类客户销售概览">
      <article><strong>{{ formatMoney(category?.salesAmount || 0) }}</strong><span>销售额</span></article>
      <article><strong>{{ category?.customerCount || totalCount || 0 }} 家</strong><span>客户数</span></article>
      <article><strong>{{ category?.goodsCount || 0 }} 种</strong><span>商品数</span></article>
      <article><strong>{{ percentageLabel(fallbackCategory?.share ?? category?.share ?? 0) }}</strong><span>在总销售中的占比</span></article>
    </div>

    <div v-if="error" class="customer-mode-state error">{{ error }}</div>
    <div v-else-if="loading" class="customer-mode-state">正在加载客户数据…</div>
    <div v-else class="category-customer-table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>客户名称</th>
            <th>成交销售额</th>
            <th>占比</th>
            <th>商品</th>
            <th>订货次数</th>
            <th>订货天数</th>
            <th>最近订货</th>
            <th aria-label="查看商品"></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(customer, index) in customers"
            :key="customer.customerId"
            :class="{ selected: same(customer.customerId, selectedCustomerId) }"
            tabindex="0"
            @click="$emit('select', customer)"
            @keydown.enter.prevent="$emit('select', customer)"
          >
            <td>{{ rowNumber(index) }}</td>
            <td>
              <strong>{{ customer.customerName || '未命名客户' }}</strong>
              <small>{{ formatQuantities(customer.quantities, '暂无数量') }}</small>
            </td>
            <td class="money">{{ formatMoney(customer.salesAmount) }}</td>
            <td>{{ percentageLabel(customer.share) }}</td>
            <td>{{ customer.goodsCount || 0 }} 种</td>
            <td>{{ customer.orderCount || 0 }} 次</td>
            <td>{{ customer.orderDays || 0 }} 天</td>
            <td>{{ customer.lastOrderDate || '—' }}</td>
            <td><button type="button" :aria-label="`查看${customer.customerName}购买的商品`" @click.stop="$emit('select', customer)">›</button></td>
          </tr>
          <tr v-if="!customers.length"><td colspan="9" class="empty-cell">该大类暂无客户成交数据</td></tr>
        </tbody>
      </table>
    </div>

    <footer class="customer-panel-footer">
      <span>共 {{ totalCount }} 家客户</span>
      <nav v-if="totalPages > 1" aria-label="客户列表分页">
        <button type="button" :disabled="loading || page <= 1" @click="$emit('page', page - 1)">上一页</button>
        <b>第 {{ page }} / {{ totalPages }} 页</b>
        <button type="button" :disabled="loading || page >= totalPages" @click="$emit('page', page + 1)">下一页</button>
      </nav>
    </footer>
  </section>
</template>

<script>
import {
  formatMoney,
  formatQuantities,
  percentageLabel,
} from '../presentation/salesAnalysisPresentation';

export default {
  name: 'CategoryCustomerPanel',
  props: {
    detail: { type: Object, default: null },
    fallbackCategory: { type: Object, default: null },
    selectedCustomerId: { type: [Number, String], default: null },
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
  },
  emits: ['select', 'page'],
  computed: {
    category() { return this.detail?.category || this.fallbackCategory || {}; },
    customers() { return this.detail?.customers || []; },
    page() { return Number(this.detail?.page) || 1; },
    pageSize() { return Number(this.detail?.pageSize) || 20; },
    totalCount() { return Number(this.detail?.totalCount) || 0; },
    totalPages() { return Math.max(1, Number(this.detail?.totalPages) || 1); },
  },
  methods: {
    formatMoney,
    formatQuantities,
    percentageLabel,
    same(left, right) { return String(left) === String(right); },
    rowNumber(index) { return (this.page - 1) * this.pageSize + index + 1; },
  },
};
</script>

<style scoped>
* { box-sizing: border-box; }
.category-customer-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: #fff; }
.customer-panel-heading { min-height: 58px; flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; border-bottom: 1px solid #dfe8e3; border-left: 3px solid #10a05d; }
.customer-panel-heading h2,.customer-panel-heading p { margin: 0; }
.customer-panel-heading h2 { color: #202d27; font-size: 16px; }
.customer-panel-heading p { margin-top: 4px; color: #7d8983; font-size: 10px; }
.customer-panel-heading > span { color: #0b8b52; font-size: 11px; font-weight: 800; white-space: nowrap; }
.customer-mode-summary { flex: none; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin: 14px; border: 1px solid #dfe8e3; }
.customer-mode-summary article { min-width: 0; padding: 13px 9px; border-right: 1px solid #dfe8e3; text-align: center; }
.customer-mode-summary article:last-child { border-right: 0; }
.customer-mode-summary strong,.customer-mode-summary span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.customer-mode-summary strong { color: #17241e; font-size: 20px; }
.customer-mode-summary span { margin-top: 5px; color: #7c8982; font-size: 10px; }
.category-customer-table-wrap { flex: 1; min-height: 0; overflow: auto; }
table { width: 100%; min-width: 850px; border-collapse: collapse; }
th,td { padding: 10px 9px; border-bottom: 1px solid #e8eeeb; text-align: left; vertical-align: middle; }
th { position: sticky; top: 0; z-index: 1; background: #f5f8f6; color: #78857f; font-size: 10px; white-space: nowrap; }
td { color: #34423b; font-size: 12px; }
tbody tr[tabindex] { cursor: pointer; outline: none; }
tbody tr[tabindex]:hover,tbody tr.selected { background: #eff9f4; }
tbody tr[tabindex]:focus-visible { box-shadow: inset 0 0 0 2px #159d60; }
td:first-child { width: 38px; color: #68776f; text-align: center; }
td:nth-child(2) { min-width: 170px; }
td strong,td small { display: block; }
td strong { color: #23342c; font-size: 13px; }
td small { max-width: 220px; margin-top: 3px; overflow: hidden; color: #8a9690; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
td.money { color: #07814b; font-weight: 800; white-space: nowrap; }
td:last-child { width: 40px; }
td:last-child button { width: 27px; height: 27px; display: grid; place-items: center; border: 1px solid #d9e4de; border-radius: 6px; background: #fff; color: #0b8b52; font-size: 19px; cursor: pointer; }
.empty-cell { padding: 35px !important; color: #87938d; text-align: center !important; }
.customer-mode-state { flex: 1; min-height: 180px; display: grid; place-items: center; color: #84918b; font-size: 11px; }
.customer-mode-state.error { color: #ac3c45; }
.customer-panel-footer { min-height: 38px; flex: none; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 13px; border-top: 1px solid #e2eae6; color: #7f8c85; font-size: 10px; }
.customer-panel-footer nav { display: flex; align-items: center; gap: 8px; }
.customer-panel-footer nav button { min-width: 54px; height: 27px; border: 1px solid #cfe0d7; border-radius: 6px; background: #fff; color: #167144; cursor: pointer; }
.customer-panel-footer nav button:disabled { opacity: .45; cursor: default; }
.customer-panel-footer nav b { color: #5f6e67; font-weight: 600; }
</style>
