<template>
  <div v-if="categories.length" class="category-map">
    <button
      v-for="(category, index) in categories"
      :key="category.id"
      type="button"
      :class="['category-tile', { active: same(category.id, selectedId), primary: index === 0 }]"
      :style="tileStyle(category, index)"
      @click="$emit('select', category)"
    >
      <span>{{ percentageLabel(category.share) }}</span>
      <strong>{{ category.name }}</strong>
      <b>{{ formatMoney(category.salesAmount) }}</b>
      <small>{{ category.customerCount }} 家客户 · {{ category.goodsCount }} 种商品</small>
      <small>{{ formatQuantities(category.quantities) }}</small>
    </button>
  </div>
  <div v-else class="category-empty">当前时间范围没有已完成的商品销售记录</div>
</template>

<script>
import {
  categoryTileStyle,
  formatMoney,
  formatQuantities,
  percentageLabel,
} from '../presentation/salesAnalysisPresentation';

export default {
  name: 'SalesCategoryTreemap',
  props: {
    categories: { type: Array, default: () => [] },
    selectedId: { type: [Number, String], default: null },
  },
  emits: ['select'],
  methods: {
    categoryTileStyle,
    formatMoney,
    formatQuantities,
    percentageLabel,
    tileStyle(category, index) { return categoryTileStyle(category, index); },
    same(left, right) { return String(left) === String(right); },
  },
};
</script>

<style scoped>
.category-map{min-height:248px;display:flex;align-content:stretch;flex-wrap:wrap;gap:8px;padding:12px}.category-tile{position:relative;min-width:150px;min-height:112px;padding:14px;border:0;border-radius:11px;background:var(--product-primary-soft);color:var(--product-text);text-align:left;cursor:pointer;overflow:hidden}.category-tile:nth-child(2){background:var(--product-warning-soft)}.category-tile:nth-child(3){background:var(--product-info-soft)}.category-tile.primary{min-height:128px;background:var(--product-primary-soft)}.category-tile:hover{box-shadow:inset 0 0 0 1px var(--product-primary)}.category-tile.active{box-shadow:inset 0 0 0 2px var(--product-primary-strong)}.category-tile>span{position:absolute;right:12px;top:11px;color:var(--product-primary-strong);font-size:11px;font-weight:800}.category-tile strong,.category-tile b,.category-tile small{display:block}.category-tile strong{max-width:80%;font-size:15px}.category-tile b{margin-top:7px;font-size:21px}.category-tile small{margin-top:5px;color:var(--product-text-muted);font-size:10px;line-height:1.35}.category-empty{min-height:248px;display:grid;place-items:center;color:var(--product-text-muted);font-size:12px}@media(max-width:760px){.category-map{min-height:0}.category-tile{min-width:130px;flex-basis:calc(50% - 8px)!important}.category-tile.primary{flex-basis:100%!important}}

.category-map { gap: 0; padding: 0; }
.category-tile { border-radius: 0; }
.category-tile:hover { box-shadow: inset 3px 0 0 var(--product-primary); }
.category-tile.active { box-shadow: inset 3px 0 0 var(--product-primary-strong); }
</style>
