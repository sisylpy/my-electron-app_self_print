<template>
  <div v-if="customers.length" class="customer-bars">
    <article v-for="customer in customers" :key="customer.customerId || customer.customerName">
      <div><strong>{{ customer.customerName }}</strong><small>{{ customer.goodsCount }} 种商品</small></div>
      <span><i :style="{ width: relativeBarWidth(customers, customer.salesAmount) }"></i></span>
      <b>{{ formatMoney(customer.salesAmount) }}</b>
      <em>{{ percentageLabel(customer.share) }}</em>
    </article>
  </div>
  <div v-else class="customer-empty">暂无客户贡献数据</div>
</template>

<script>
import {
  formatMoney,
  percentageLabel,
  relativeBarWidth,
} from '../presentation/salesAnalysisPresentation';

export default {
  name: 'CustomerContributionBars',
  props: { customers: { type: Array, default: () => [] } },
  methods: { formatMoney, percentageLabel, relativeBarWidth },
};
</script>

<style scoped>
.customer-bars{display:grid;gap:15px;padding:17px}.customer-bars article{display:grid;grid-template-columns:minmax(80px,1fr) minmax(80px,1.3fr) auto 42px;align-items:center;gap:9px}.customer-bars article>div{min-width:0}.customer-bars strong,.customer-bars small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.customer-bars strong{font-size:12px}.customer-bars small{margin-top:2px;color:#89958f;font-size:9px}.customer-bars article>span{height:8px;border-radius:6px;background:#edf2ef;overflow:hidden}.customer-bars i{display:block;height:100%;border-radius:6px;background:#119b5c}.customer-bars b{font-size:11px;white-space:nowrap}.customer-bars em{color:#728078;font-size:9px;font-style:normal;text-align:right}.customer-empty{min-height:220px;display:grid;place-items:center;color:#85918b;font-size:12px}@media(max-width:520px){.customer-bars article{grid-template-columns:minmax(70px,1fr) minmax(70px,1fr) auto}.customer-bars em{display:none}}
</style>
