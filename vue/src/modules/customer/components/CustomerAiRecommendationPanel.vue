<template>
  <div class="ai-panel">
    <div class="panel-toolbar">
      <div><h3>AI 今日预计订单</h3><p>按前厅、后厨等内部订货部门分别预测，避免把不同部门的用量混在一起。</p></div>
      <span class="ai-badge">AI 智能补货</span>
    </div>

    <div class="department-tabs">
      <button v-for="department in departments" :key="department.nxDepartmentId"
              :class="{ active: String(activeDepartmentId) === String(department.nxDepartmentId) }"
              @click="selectDepartment(department)">
        <span>{{ department.nxDepartmentName }}</span><small>{{ cachedCount(department.nxDepartmentId) }}</small>
      </button>
    </div>

    <div v-if="loading" class="panel-state ai-loading"><span>AI</span><b>正在分析 {{ activeDepartmentName }} 近期订货规律…</b></div>
    <div v-else-if="errorText" class="panel-state error">{{ errorText }} <button @click="loadRecommendations(true)">重新分析</button></div>
    <div v-else-if="!recommendations.length" class="panel-state"><b>{{ activeDepartmentName }} 暂无补货建议</b><p>积累更多历史订单后，推荐会更准确。</p></div>

    <div v-else class="recommendation-grid">
      <article v-for="item in recommendations" :key="item.nxDepartmentDisGoodsId">
        <div class="goods-image"><img v-if="goodsImage(item)" :src="goodsImage(item)" alt="" /><span v-else>AI</span></div>
        <div class="recommend-main">
          <div class="recommend-title"><h4>{{ item.nxDdgDepGoodsName || goods(item).nxDgGoodsName }}</h4><span>{{ activeDepartmentName }}</span></div>
          <div class="suggestion"><small>建议今天订货</small><strong>{{ item.aiOrderQuantity }} {{ item.aiOrderStandard }}</strong></div>
          <div class="metrics">
            <div><span>近期日均</span><b>{{ item.aiDailyUsage || '-' }} {{ item.aiOrderStandard }}</b></div>
            <div><span>安全库存</span><b>{{ item.aiSafetyStock || '-' }} {{ item.aiOrderStandard }}</b></div>
            <div><span>距上次订货</span><b>{{ item.aiDaysSinceLastOrder ?? '-' }} 天</b></div>
          </div>
          <button @click="openOrder(item)">按建议直接订货</button>
        </div>
      </article>
    </div>

    <div v-if="orderOpen" class="order-layer" @click.self="closeOrder">
      <aside class="order-drawer">
        <header><div><span>QUICK ORDER</span><h3>直接订货</h3><p>{{ activeDepartmentName }} · {{ orderGoodsName }}</p></div><button @click="closeOrder">×</button></header>
        <div class="order-body">
          <section class="ai-advice"><span>AI 建议</span><strong>{{ selectedItem.aiOrderQuantity }} {{ selectedItem.aiOrderStandard }}</strong><p>近期日均 {{ selectedItem.aiDailyUsage || '-' }}，距上次订货 {{ selectedItem.aiDaysSinceLastOrder ?? '-' }} 天。</p></section>
          <label>订货数量<input v-model.number="orderForm.quantity" type="number" min="0.01" step="0.1" /></label>
          <label>订货规格<input v-model.trim="orderForm.standard" /></label>
          <label>订单备注<textarea v-model.trim="orderForm.remark" rows="4" placeholder="可不填写" /></label>
          <div class="order-target"><span>下单客户</span><strong>{{ customerName }}</strong><span>订货部门</span><strong>{{ activeDepartmentName }}</strong></div>
        </div>
        <footer><span>{{ orderError }}</span><button class="outline" @click="closeOrder">取消</button><button class="primary" :disabled="savingOrder" @click="saveOrder">{{ savingOrder ? '正在下单…' : '确认下单' }}</button></footer>
      </aside>
    </div>
  </div>
</template>

<script>
import customerApi from '../api/customerApi';
function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export default {
  name: 'CustomerAiRecommendationPanel',
  props: { customer: { type: Object, required: true }, distributerId: { type: [Number, String], required: true }, operatorUserId: { type: [Number, String], required: true } },
  emits: ['notice', 'order-saved'],
  data() { return { activeDepartmentId: null, cache: {}, loading: false, errorText: '', imageServer: customerApi.imageServerUrl(), orderOpen: false, selectedItem: {}, orderForm: { quantity: '', standard: '', remark: '' }, savingOrder: false, orderError: '' }; },
  computed: {
    customerId() { return this.customer.nxDepartmentId; }, customerName() { return this.customer.nxDepartmentAttrName || this.customer.nxDepartmentName; },
    departments() { const children = this.customer.nxDepartmentEntities || []; return children.length ? children : [{ nxDepartmentId: this.customerId, nxDepartmentName: this.customerName }]; },
    activeDepartment() { return this.departments.find((row) => String(row.nxDepartmentId) === String(this.activeDepartmentId)) || this.departments[0] || {}; },
    activeDepartmentName() { return this.activeDepartment.nxDepartmentName || '当前客户'; },
    recommendations() { return this.cache[this.activeDepartmentId] || []; },
    orderGoodsName() { return this.selectedItem.nxDdgDepGoodsName || this.goods(this.selectedItem).nxDgGoodsName || ''; },
  },
  watch: { customerId: { immediate: true, handler() { this.cache = {}; this.activeDepartmentId = this.departments[0]?.nxDepartmentId || null; this.loadRecommendations(); } } },
  methods: {
    goods(item) { return item?.nxDistributerGoodsEntity || {}; },
    goodsImage(item) { const value = this.goods(item).nxDgGoodsFileLarge || this.goods(item).nxDgGoodsFile; if (!value) return ''; return /^https?:/i.test(value) ? value : this.imageServer + String(value).replace(/^\//, ''); },
    cachedCount(id) { return this.cache[id] ? `${this.cache[id].length}项` : '待分析'; },
    selectDepartment(department) { this.activeDepartmentId = department.nxDepartmentId; this.loadRecommendations(); },
    async loadRecommendations(force = false) {
      if (!this.activeDepartmentId || (!force && this.cache[this.activeDepartmentId])) return;
      this.loading = true; this.errorText = '';
      try { const response = await customerApi.getAiRecommendations(this.activeDepartmentId, 1, 50); if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '智能推荐加载失败'); this.cache = { ...this.cache, [this.activeDepartmentId]: response.data.page?.list || [] }; }
      catch (error) { this.errorText = error?.message || '智能推荐加载失败'; }
      finally { this.loading = false; }
    },
    openOrder(item) { this.selectedItem = item; this.orderForm = { quantity: Number(item.aiOrderQuantity || item.nxDdgOrderQuantity || 1), standard: item.aiOrderStandard || item.nxDdgOrderStandard || this.goods(item).nxDgGoodsStandardname || '斤', remark: item.nxDdgOrderRemark || '' }; this.orderError = ''; this.orderOpen = true; },
    closeOrder() { if (!this.savingOrder) this.orderOpen = false; },
    buildOrder() {
      const item = this.selectedItem; const goods = this.goods(item); const quantity = Number(this.orderForm.quantity); const standard = this.orderForm.standard || goods.nxDgGoodsStandardname || '斤'; const level = String(item.nxDdgOrderPriceLevel || '1');
      const price = Number(item.nxDdgOrderPrice || (level === '2' ? goods.nxDgWillPriceTwo : goods.nxDgWillPriceOne) || 0); const costPrice = Number(level === '2' ? goods.nxDgBuyingPriceTwo : goods.nxDgBuyingPriceOne) || 0; const weight = quantity; const subtotal = price > 0 ? (price * quantity).toFixed(1) : null; const costSubtotal = (costPrice * quantity).toFixed(1); const profitSubtotal = subtotal ? (Number(subtotal) - Number(costSubtotal)).toFixed(1) : 0; const profitScale = price > 0 ? Number(((price - costPrice) / price * 100).toFixed(2)) : 0;
      return { nxDoOrderUserId: this.operatorUserId, nxDoDepDisGoodsId: item.nxDepartmentDisGoodsId || -1, nxDoDisGoodsFatherId: goods.nxDgDfgGoodsFatherId || -1, nxDoDisGoodsGrandId: goods.nxDgDfgGoodsGrandId || -1, nxDoDisGoodsId: goods.nxDistributerGoodsId, nxDoDepartmentId: this.activeDepartmentId, nxDoDistributerId: this.distributerId, nxDoDepartmentFatherId: this.customerId, nxDoQuantity: quantity, nxDoPrice: price, nxDoWeight: weight, nxDoSubtotal: subtotal, nxDoStandard: standard, nxDoRemark: this.orderForm.remark || '', nxDoIsAgent: -1, nxDoArriveDate: today(), nxDoArriveWeeksYear: '', nxDoArriveOnlyDate: today().slice(-2), nxDoArriveWhatDay: '', nxDoCostPriceUpdate: level === '2' ? goods.nxDgBuyingPriceTwoUpdate : goods.nxDgBuyingPriceOneUpdate, nxDoCostPrice: costPrice, nxDoPurchaseGoodsId: -1, nxDoCostSubtotal: costSubtotal, nxDoProfitSubtotal: profitSubtotal, nxDoProfitScale: profitScale, nxDoNxGoodsId: goods.nxDgNxGoodsId || -1, nxDoNxGoodsFatherId: goods.nxDgNxFatherId || -1, nxDoGoodsType: goods.nxDgPurchaseAuto || 0, nxDoPurchaseUserId: this.operatorUserId, nxDoPrintStandard: level === '2' ? (goods.nxDgWillPriceTwoStandard || standard) : (goods.nxDgGoodsStandardname || standard), nxDoCostPriceLevel: level, nxDoGoodsName: goods.nxDgGoodsName || item.nxDdgDepGoodsName || '' };
    },
    async saveOrder() { if (!(Number(this.orderForm.quantity) > 0)) { this.orderError = '请输入正确的订货数量'; return; } this.savingOrder = true; this.orderError = ''; try { const response = await customerApi.saveOrder(this.buildOrder()); if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '下单失败'); this.orderOpen = false; this.$emit('notice', `${this.activeDepartmentName}已成功下单`); this.$emit('order-saved', response.data.data); } catch (error) { this.orderError = error?.message || '下单失败'; } finally { this.savingOrder = false; } },
  },
};
</script>

<style scoped>
.panel-toolbar{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:17px}.panel-toolbar h3{margin:0 0 5px;font-size:21px}.panel-toolbar p{margin:0;color:#77847f}.ai-badge{padding:8px 12px;border-radius:999px;background:linear-gradient(135deg,#e6efff,#e4f8ee);color:#3b65b5;font-weight:900;font-size:12px}.department-tabs{display:flex;gap:9px;overflow:auto;margin-bottom:17px}.department-tabs button{border:1px solid #d5e1db;background:#fff;border-radius:11px;padding:10px 14px;display:flex;gap:11px;align-items:center;white-space:nowrap}.department-tabs button.active{background:#e7f7ee;border-color:#29a86b;color:#087c49}.department-tabs small{font-size:11px;color:#8b9691}.panel-state{padding:70px;text-align:center;color:#84908b;background:#fff;border:1px dashed #d5e0db;border-radius:16px}.panel-state b,.panel-state p{display:block}.panel-state p{margin:7px 0}.panel-state.error{color:#bd444e}.ai-loading span{display:inline-grid;place-items:center;width:45px;height:45px;border-radius:15px;background:linear-gradient(135deg,#3e79eb,#0fa263);color:#fff;margin-right:12px}.ai-loading b{display:inline}.recommendation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.recommendation-grid>article{background:#fff;border:1px solid #dfe8e4;border-radius:15px;padding:15px;display:flex;gap:14px}.goods-image{width:74px;height:74px;flex:none;border-radius:13px;background:linear-gradient(135deg,#e9f0ff,#e6f8ee);display:grid;place-items:center;color:#3970d2;font-weight:900;overflow:hidden}.goods-image img{width:100%;height:100%;object-fit:cover}.recommend-main{flex:1;min-width:0}.recommend-title{display:flex;justify-content:space-between;gap:8px}.recommend-title h4{font-size:16px;margin:0}.recommend-title span{font-size:10px;background:#f0f4f2;border-radius:6px;padding:4px 6px;white-space:nowrap}.suggestion{margin:12px 0;padding:10px;background:#fff8e9;border-radius:9px;display:flex;justify-content:space-between;align-items:center}.suggestion small{color:#8c7951}.suggestion strong{color:#e07b0b;font-size:17px}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.metrics div{display:flex;flex-direction:column}.metrics span{font-size:10px;color:#8b9691}.metrics b{font-size:12px}.recommend-main>button{width:100%;margin-top:13px;border:0;background:#e5f6ed;color:#087c49;border-radius:8px;padding:8px;font-weight:800}.order-layer{position:fixed;inset:0;z-index:1100;background:rgba(14,31,23,.24);display:flex;justify-content:flex-end}.order-drawer{width:min(520px,92vw);height:100%;background:#f7faf8;box-shadow:-18px 0 45px rgba(17,52,37,.18);display:flex;flex-direction:column}.order-drawer header{padding:23px 25px;background:#fff;border-bottom:1px solid #e0e9e4;display:flex;justify-content:space-between}.order-drawer header span{font-size:11px;letter-spacing:.13em;color:#3c6dc7;font-weight:900}.order-drawer h3{margin:3px 0}.order-drawer header p{margin:0;color:#7d8984}.order-drawer header button{border:0;background:#eff4f1;border-radius:10px;width:40px;height:40px;font-size:26px}.order-body{padding:24px;overflow:auto;flex:1}.ai-advice{background:linear-gradient(135deg,#edf3ff,#eaf8f0);border-radius:14px;padding:17px;margin-bottom:21px}.ai-advice span{font-size:11px;color:#426cc0;font-weight:900}.ai-advice strong{display:block;font-size:24px;margin:4px 0}.ai-advice p{margin:0;color:#68756f}.order-body>label{display:flex;flex-direction:column;gap:7px;margin-bottom:16px;font-size:13px;font-weight:800;color:#5c6963}.order-body input,.order-body textarea{border:1px solid #cfddd6;border-radius:10px;padding:11px}.order-target{display:grid;grid-template-columns:100px 1fr;gap:9px;padding:17px;background:#fff;border:1px solid #e0e8e4;border-radius:12px}.order-target span{color:#81908a}.order-drawer footer{background:#fff;border-top:1px solid #dfe8e3;padding:15px 21px;display:flex;gap:9px}.order-drawer footer>span{margin-right:auto;color:#c03f49;font-size:13px;align-self:center}.order-drawer footer button{padding:10px 15px;border-radius:9px;font-weight:800}.order-drawer .outline{border:1px solid #cfdbd5;background:#fff}.order-drawer .primary{border:0;background:#109d5d;color:#fff}@media(max-width:1050px){.recommendation-grid{grid-template-columns:1fr}}@media(max-width:650px){.metrics{grid-template-columns:1fr}}
</style>
