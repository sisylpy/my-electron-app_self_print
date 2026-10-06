<template>
  <Teleport to="body" :disabled="embedded">
    <Transition name="customer-drawer" :css="!embedded">
      <div
        v-if="visible"
        class="drawer-backdrop"
        :class="{ embedded }"
        @click.self="embedded ? null : $emit('close')"
      >
        <aside
          class="customer-drawer"
          :role="embedded ? 'region' : 'dialog'"
          :aria-modal="embedded ? null : 'true'"
          aria-labelledby="product-customer-title"
        >
          <header class="drawer-header">
            <div class="drawer-product-identity">
              <div class="drawer-product-image"><img :src="goodsImage(summary)" :alt="summary.goodsName || '商品详情'" /></div>
              <div>
                <span>商品客户分布 · 当前商品内</span>
                <h2 id="product-customer-title">{{ summary.goodsName || '商品详情' }}</h2>
                <p>{{ summary.goodsStandard || '未标规格' }} · 按成交销售额贡献排序</p>
              </div>
            </div>
            <button v-if="!embedded" type="button" aria-label="关闭商品客户分布" @click="$emit('close')">×</button>
          </header>

          <div v-if="!hasProduct" class="drawer-state empty-product">
            <strong>请选择商品</strong>
            <span>点击中间的商品后，这里会显示商品销售情况和客户分布。</span>
          </div>
          <div v-else class="drawer-body">
            <section class="customer-section" aria-labelledby="customer-share-title">
              <header>
                <div>
                  <h3 id="customer-share-title">客户占比</h3>
                </div>
                <span>{{ customerCount }} 家</span>
              </header>

              <div v-if="loading" class="drawer-state">正在加载客户分布…</div>
              <div v-else-if="error" class="drawer-state error">{{ error }}</div>
              <div v-else-if="customers.length" class="customer-list">
                <article
                  v-for="customer in customers"
                  :key="customer.customerId || customer.customerName"
                  :class="{ aggregate: !customer.customerId }"
                >
                  <header>
                    <div>
                      <strong>{{ customer.customerName }}</strong>
                      <small v-if="!customer.customerId">剩余客户合计</small>
                    </div>
                    <div class="customer-amount">
                      <b>{{ formatMoney(customer.salesAmount) }}</b>
                      <em>商品内占比 {{ percentageLabel(customer.share) }}</em>
                    </div>
                  </header>
                  <div class="share-track" aria-hidden="true">
                    <i :style="{ width: `${barWidth(customer.share)}%` }"></i>
                  </div>
                  <dl>
                    <div><dt>销售数量</dt><dd>{{ formatQuantities(customer.quantities) }}</dd></div>
                    <div><dt>平均单价</dt><dd>{{ formatAveragePrices(customer.averagePrices) }}</dd></div>
                    <div><dt>可核算毛利</dt><dd :class="{ negative: Number(customer.grossProfit) < 0 }">{{ formatOptionalMoney(customer.grossProfit) }}</dd></div>
                    <div><dt>毛利率</dt><dd :class="{ negative: Number(customer.grossMarginRate) < 0 }">{{ optionalPercentageLabel(customer.grossMarginRate) }}</dd></div>
                    <div><dt>订货日数</dt><dd>{{ customer.orderDays || 0 }} 天</dd></div>
                    <div><dt>最近成交</dt><dd>{{ customer.lastOrderDate || '-' }}</dd></div>
                  </dl>
                </article>
              </div>
              <div v-else class="drawer-state">当前范围暂无客户成交明细</div>
            </section>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script>
import {
  formatAveragePrices,
  formatMoney,
  formatOptionalMoney,
  formatQuantities,
  optionalPercentageLabel,
  percentageLabel,
  resolveGoodsImage,
} from '../presentation/salesAnalysisPresentation';

export default {
  name: 'ProductCustomerDrawer',
  props: {
    visible: { type: Boolean, default: false },
    embedded: { type: Boolean, default: false },
    product: { type: Object, default: null },
    detail: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
    imageServer: { type: String, default: '' },
  },
  emits: ['close'],
  computed: {
    hasProduct() { return Boolean(this.product || this.detail?.product); },
    summary() { return this.detail?.product || this.product || {}; },
    customerCount() {
      return Number(this.detail?.customerCount ?? this.product?.customerCount ?? 0);
    },
    customers() {
      const rows = this.detail?.customers || [];
      return this.detail?.others ? [...rows, this.detail.others] : rows;
    },
  },
  watch: {
    visible() { this.updateKeydownListener(); },
    embedded() { this.updateKeydownListener(); },
  },
  mounted() { this.updateKeydownListener(); },
  beforeUnmount() { window.removeEventListener('keydown', this.handleKeydown); },
  methods: {
    formatAveragePrices,
    formatMoney,
    formatOptionalMoney,
    formatQuantities,
    optionalPercentageLabel,
    percentageLabel,
    goodsImage(product) {
      return resolveGoodsImage(product, this.imageServer, 'goodsImage/logo.jpg');
    },
    barWidth(value) { return Math.max(2, Math.min(100, Number(value || 0))); },
    updateKeydownListener() {
      window.removeEventListener('keydown', this.handleKeydown);
      if (this.visible && !this.embedded) window.addEventListener('keydown', this.handleKeydown);
    },
    handleKeydown(event) {
      if (!this.embedded && event.key === 'Escape') this.$emit('close');
    },
  },
};
</script>

<style scoped>
.drawer-backdrop{position:fixed;inset:0;z-index:2200;display:flex;justify-content:flex-end;background:rgba(20,37,29,.28);backdrop-filter:blur(1px)}.customer-drawer{width:min(560px,calc(100vw - 28px));height:100%;display:flex;flex-direction:column;background:#f5f8f6;box-shadow:-14px 0 36px rgba(21,52,37,.2)}.drawer-header{flex:none;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:22px 22px 18px;background:#fff;border-bottom:1px solid #dce6e1}.drawer-header span{color:#0a9457;font-size:11px;font-weight:800}.drawer-header h2{margin:5px 0 0;color:#213029;font-size:24px}.drawer-header p{margin:5px 0 0;color:#7b8982;font-size:11px}.drawer-header button{width:34px;height:34px;border:1px solid #d9e3de;border-radius:9px;background:#fff;color:#65736c;font-size:24px;line-height:1;cursor:pointer}.drawer-body{flex:1;min-height:0;overflow-y:auto;padding:14px}.customer-section{border:1px solid #dfe8e3;border-radius:12px;background:#fff;overflow:hidden}.customer-section>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 16px;border-bottom:1px solid #e4ebe7}.customer-section h3{margin:0;font-size:21px}.customer-section>header>span{padding:4px 9px;border-radius:12px;background:#e9f6ef;color:#08814d;font-size:10px;font-weight:800}.customer-list article{padding:15px 16px;border-bottom:1px solid #e7edea}.customer-list article:last-child{border-bottom:0}.customer-list article.aggregate{background:#f7f9f8}.customer-list article>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.customer-list article>header>div:first-child{min-width:0}.customer-list strong,.customer-list small{display:block}.customer-list strong{overflow:hidden;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.customer-list small{margin-top:2px;color:#8a9690;font-size:9px}.customer-amount{flex:none;text-align:right}.customer-amount b,.customer-amount em{display:block}.customer-amount b{color:#07844e;font-size:15px}.customer-amount em{margin-top:2px;color:#77857e;font-size:10px;font-style:normal}.share-track{height:7px;margin-top:10px;border-radius:6px;background:#edf2ef;overflow:hidden}.share-track i{display:block;height:100%;border-radius:6px;background:#10a05d}.customer-list dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px 16px;margin:14px 0 0}.customer-list dl>div{min-width:0}.customer-list dt{color:#78867f;font-size:11px}.customer-list dd{margin:4px 0 0;overflow:hidden;color:#405049;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.drawer-state{min-height:220px;display:grid;place-items:center;padding:24px;color:#829089;font-size:12px}.drawer-state.error{color:#b43d47}.customer-drawer-enter-active,.customer-drawer-leave-active{transition:background .2s ease}.customer-drawer-enter-active .customer-drawer,.customer-drawer-leave-active .customer-drawer{transition:transform .22s ease}.customer-drawer-enter-from,.customer-drawer-leave-to{background:rgba(20,37,29,0)}.customer-drawer-enter-from .customer-drawer,.customer-drawer-leave-to .customer-drawer{transform:translateX(100%)}@media(max-width:560px){.customer-drawer{width:100vw}.drawer-header{padding:18px 16px 15px}.drawer-body{padding:10px}.customer-list dl{grid-template-columns:1fr}}
.drawer-product-identity{min-width:0;display:flex;align-items:center;gap:13px}.drawer-product-image{width:64px;height:64px;flex:none;overflow:hidden;border:1px solid #e0e9e4;border-radius:13px;background:#f1f6f3}.drawer-product-image img{width:100%;height:100%;display:block;object-fit:cover}.drawer-product-identity>div:last-child{min-width:0}.drawer-product-identity h2,.drawer-product-identity p{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.drawer-backdrop.embedded{position:static;inset:auto;z-index:auto;width:100%;height:100%;min-width:0;min-height:0;display:flex;border-left:1px solid #dce7e1;background:#f5f8f6;backdrop-filter:none;overflow:hidden}.drawer-backdrop.embedded .customer-drawer{width:100%;max-width:none;height:100%;box-shadow:none}.drawer-backdrop.embedded .drawer-header{padding:15px 14px 13px}.drawer-backdrop.embedded .drawer-header h2{font-size:18px}.drawer-backdrop.embedded .drawer-header p{font-size:9px}.drawer-backdrop.embedded .drawer-product-image{width:50px;height:50px;border-radius:10px}.drawer-backdrop.embedded .drawer-body{padding:10px}.drawer-backdrop.embedded .customer-list article{padding:12px}.drawer-backdrop.embedded .customer-list dl{gap:7px 10px}.empty-product{flex:1;min-height:0;align-content:center;gap:6px}.empty-product strong,.empty-product span{display:block}.empty-product strong{color:#33463c;font-size:15px}.empty-product span{max-width:260px;line-height:1.6}.customer-list dd.negative{color:#c43e48}@media(max-width:1120px){.drawer-backdrop.embedded{grid-column:1/-1;min-height:540px;border-top:1px solid #dce7e1;border-left:0}}
</style>
