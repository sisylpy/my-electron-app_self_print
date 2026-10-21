<template>
  <div class="order-price-layer" @click.self="$emit('close')">
    <form class="order-price-dialog" @submit.prevent="save">
      <header>
        <div>
          <span>客户商品</span>
          <h3>设置订货单价</h3>
        </div>
        <button type="button" aria-label="关闭" @click="$emit('close')">×</button>
      </header>

      <section class="goods-copy">
        <strong>{{ goods.goodsName }}</strong>
        <span>{{ goods.customerName }}<template v-if="goods.spec"> · {{ goods.spec }}</template></span>
      </section>

      <label class="price-field">
        <span>订货单价</span>
        <div>
          <b>¥</b>
          <input
            ref="priceInput"
            v-model.trim="price"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            placeholder="请输入单价"
          />
          <em>元 / {{ goods.spec || '订货单位' }}</em>
        </div>
      </label>

      <p class="price-note">用于该客户以后订货时的默认单价；已完成订单的成交记录请查看“历史单价”。</p>
      <p v-if="errorText" class="price-error">{{ errorText }}</p>

      <footer>
        <button type="button" class="cancel-button" :disabled="saving" @click="$emit('close')">取消</button>
        <button type="submit" class="save-button" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
      </footer>
    </form>
  </div>
</template>

<script>
import customerApi from '../api/customerApi';

export default {
  name: 'CustomerGoodsOrderPriceDialog',
  props: {
    goods: { type: Object, required: true },
  },
  emits: ['close', 'updated'],
  data() {
    return {
      price: this.goods.orderPrice || '',
      saving: false,
      errorText: '',
    };
  },
  mounted() {
    this.$nextTick(() => {
      this.$refs.priceInput?.focus();
      this.$refs.priceInput?.select();
    });
  },
  methods: {
    async save() {
      const value = String(this.price || '').trim();
      if (!/^\d+(?:\.\d{1,4})?$/.test(value) || Number(value) <= 0) {
        this.errorText = '请输入大于 0 的正确单价，最多保留 4 位小数';
        return;
      }
      this.saving = true;
      this.errorText = '';
      try {
        const response = await customerApi.updateCustomerGoodsOrderPrice(this.goods.relationId, value);
        if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '订货单价保存失败');
        this.$emit('updated', { relationId: this.goods.relationId, orderPrice: value });
      } catch (error) {
        this.errorText = error?.message || '订货单价保存失败';
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.order-price-layer{position:fixed;inset:0;z-index:1500;background:rgba(var(--product-text-rgb), 0.42);display:grid;place-items:center;padding:24px}.order-price-dialog{width:min(440px,100%);background:var(--product-surface);border-radius:16px;box-shadow:0 22px 70px rgba(var(--product-text-rgb), 0.24);overflow:hidden}.order-price-dialog header{display:flex;align-items:flex-start;justify-content:space-between;padding:22px 24px 16px;border-bottom:1px solid var(--product-tint)}.order-price-dialog header span{display:block;color:var(--product-primary-strong);font-size:11px;font-weight:900;letter-spacing:1.5px}.order-price-dialog header h3{margin:5px 0 0;font-size:21px;color:var(--product-text)}.order-price-dialog header button{border:0;background:transparent;color:var(--product-text-muted);font-size:25px;line-height:1;cursor:pointer}.goods-copy{display:flex;flex-direction:column;gap:4px;margin:20px 24px 0;padding:14px 16px;border-radius:10px;background:var(--product-primary-soft)}.goods-copy strong{font-size:16px;color:var(--product-text)}.goods-copy span{font-size:12px;color:var(--product-text-muted)}.price-field{display:block;margin:20px 24px 0}.price-field>span{display:block;margin-bottom:8px;color:var(--product-text-secondary);font-size:13px;font-weight:800}.price-field>div{height:46px;border:1px solid var(--product-primary-soft);border-radius:9px;display:flex;align-items:center;overflow:hidden}.price-field b{padding-left:14px;color:var(--product-primary-strong)}.price-field input{min-width:0;flex:1;border:0;outline:0;padding:0 8px;font-size:18px;font-weight:800;color:var(--product-text)}.price-field em{padding-right:13px;color:var(--product-text-muted);font-size:12px;font-style:normal;white-space:nowrap}.price-note{margin:12px 24px 0;color:var(--product-text-muted);font-size:12px;line-height:1.6}.price-error{margin:9px 24px 0;color:var(--product-danger);font-size:12px}.order-price-dialog footer{display:flex;justify-content:flex-end;gap:10px;padding:20px 24px 24px}.order-price-dialog footer button{height:38px;border-radius:8px;padding:0 20px;font-weight:800;cursor:pointer}.order-price-dialog footer button:disabled{opacity:.6;cursor:default}.cancel-button{border:1px solid var(--product-primary-soft);background:var(--product-surface);color:var(--product-text-secondary)}.save-button{border:1px solid var(--product-primary-strong);background:var(--product-primary-strong);color:#fff}
</style>
