<template>
  <Teleport to="body">
    <Transition name="customer-drawer">
      <div v-if="visible" class="drawer-backdrop" @click.self="$emit('close')">
        <aside
          class="customer-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-customer-title"
        >
          <header class="drawer-header">
            <div class="drawer-product-identity">
              <div class="drawer-product-image"><img :src="goodsImage(summary)" :alt="summary.goodsName || '商品详情'" /></div>
              <div>
                <span>商品客户分布</span>
                <h2 id="product-customer-title">{{ summary.goodsName || '商品详情' }}</h2>
                <p>{{ summary.goodsStandard || '未标规格' }} · 按成交销售额贡献排序</p>
              </div>
            </div>
            <button type="button" aria-label="关闭商品客户分布" @click="$emit('close')">×</button>
          </header>

          <div class="drawer-body">
            <section class="product-summary" aria-label="商品销售汇总">
              <article>
                <span>成交销售额</span>
                <strong>{{ formatMoney(summary.salesAmount) }}</strong>
              </article>
              <article>
                <span>使用客户</span>
                <strong>{{ customerCount }} 家</strong>
              </article>
              <article>
                <span>销售数量</span>
                <strong>{{ formatQuantities(summary.quantities) }}</strong>
              </article>
              <article>
                <span>加权平均单价</span>
                <strong>{{ formatAveragePrices(summary.averagePrices) }}</strong>
              </article>
            </section>

            <section class="customer-section">
              <header>
                <div>
                  <h3>客户分布</h3>
                  <p>每位客户在当前商品成交销售额中的占比</p>
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
                      <em>{{ percentageLabel(customer.share) }}</em>
                    </div>
                  </header>
                  <div class="share-track" aria-hidden="true">
                    <i :style="{ width: `${barWidth(customer.share)}%` }"></i>
                  </div>
                  <dl>
                    <div><dt>销售数量</dt><dd>{{ formatQuantities(customer.quantities) }}</dd></div>
                    <div><dt>平均单价</dt><dd>{{ formatAveragePrices(customer.averagePrices) }}</dd></div>
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
  formatQuantities,
  percentageLabel,
  resolveGoodsImage,
} from '../presentation/salesAnalysisPresentation';

export default {
  name: 'ProductCustomerDrawer',
  props: {
    visible: { type: Boolean, default: false },
    product: { type: Object, default: null },
    detail: { type: Object, default: null },
    loading: { type: Boolean, default: false },
    error: { type: String, default: '' },
    imageServer: { type: String, default: '' },
  },
  emits: ['close'],
  computed: {
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
    visible(value) {
      if (value) window.addEventListener('keydown', this.handleKeydown);
      else window.removeEventListener('keydown', this.handleKeydown);
    },
  },
  beforeUnmount() { window.removeEventListener('keydown', this.handleKeydown); },
  methods: {
    formatAveragePrices,
    formatMoney,
    formatQuantities,
    percentageLabel,
    goodsImage(product) {
      return resolveGoodsImage(product, this.imageServer, 'goodsImage/logo.jpg');
    },
    barWidth(value) { return Math.max(2, Math.min(100, Number(value || 0))); },
    handleKeydown(event) {
      if (event.key === 'Escape') this.$emit('close');
    },
  },
};
</script>

<style scoped>
.drawer-backdrop{position:fixed;inset:0;z-index:2200;display:flex;justify-content:flex-end;background:rgba(20,37,29,.28);backdrop-filter:blur(1px)}.customer-drawer{width:min(560px,calc(100vw - 28px));height:100%;display:flex;flex-direction:column;background:#f5f8f6;box-shadow:-14px 0 36px rgba(21,52,37,.2)}.drawer-header{flex:none;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:22px 22px 18px;background:#fff;border-bottom:1px solid #dce6e1}.drawer-header span{color:#0a9457;font-size:11px;font-weight:800}.drawer-header h2{margin:5px 0 0;color:#213029;font-size:24px}.drawer-header p{margin:5px 0 0;color:#7b8982;font-size:11px}.drawer-header button{width:34px;height:34px;border:1px solid #d9e3de;border-radius:9px;background:#fff;color:#65736c;font-size:24px;line-height:1;cursor:pointer}.drawer-body{flex:1;min-height:0;overflow-y:auto;padding:14px}.product-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.product-summary article{min-width:0;padding:13px 14px;border:1px solid #dfe8e3;border-radius:10px;background:#fff}.product-summary span,.product-summary strong{display:block}.product-summary span{color:#819089;font-size:10px}.product-summary strong{margin-top:5px;overflow:hidden;color:#26362e;font-size:15px;text-overflow:ellipsis;white-space:nowrap}.product-summary article:first-child strong{color:#07844e;font-size:19px}.customer-section{margin-top:12px;border:1px solid #dfe8e3;border-radius:12px;background:#fff;overflow:hidden}.customer-section>header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #e4ebe7}.customer-section h3,.customer-section p{margin:0}.customer-section h3{font-size:16px}.customer-section p{margin-top:3px;color:#84918b;font-size:10px}.customer-section>header>span{padding:4px 9px;border-radius:12px;background:#e9f6ef;color:#08814d;font-size:10px;font-weight:800}.customer-list article{padding:15px 16px;border-bottom:1px solid #e7edea}.customer-list article:last-child{border-bottom:0}.customer-list article.aggregate{background:#f7f9f8}.customer-list article>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.customer-list article>header>div:first-child{min-width:0}.customer-list strong,.customer-list small{display:block}.customer-list strong{overflow:hidden;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.customer-list small{margin-top:2px;color:#8a9690;font-size:9px}.customer-amount{flex:none;text-align:right}.customer-amount b,.customer-amount em{display:block}.customer-amount b{color:#07844e;font-size:15px}.customer-amount em{margin-top:2px;color:#77857e;font-size:10px;font-style:normal}.share-track{height:7px;margin-top:10px;border-radius:6px;background:#edf2ef;overflow:hidden}.share-track i{display:block;height:100%;border-radius:6px;background:#10a05d}.customer-list dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;margin:12px 0 0}.customer-list dl>div{min-width:0}.customer-list dt{color:#8a9690;font-size:9px}.customer-list dd{margin:3px 0 0;overflow:hidden;color:#405049;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.drawer-state{min-height:220px;display:grid;place-items:center;padding:24px;color:#829089;font-size:12px}.drawer-state.error{color:#b43d47}.customer-drawer-enter-active,.customer-drawer-leave-active{transition:background .2s ease}.customer-drawer-enter-active .customer-drawer,.customer-drawer-leave-active .customer-drawer{transition:transform .22s ease}.customer-drawer-enter-from,.customer-drawer-leave-to{background:rgba(20,37,29,0)}.customer-drawer-enter-from .customer-drawer,.customer-drawer-leave-to .customer-drawer{transform:translateX(100%)}@media(max-width:560px){.customer-drawer{width:100vw}.drawer-header{padding:18px 16px 15px}.drawer-body{padding:10px}.product-summary{grid-template-columns:1fr}.customer-list dl{grid-template-columns:1fr}}
.drawer-product-identity{min-width:0;display:flex;align-items:center;gap:13px}.drawer-product-image{width:64px;height:64px;flex:none;overflow:hidden;border:1px solid #e0e9e4;border-radius:13px;background:#f1f6f3}.drawer-product-image img{width:100%;height:100%;display:block;object-fit:cover}.drawer-product-identity>div:last-child{min-width:0}.drawer-product-identity h2,.drawer-product-identity p{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
