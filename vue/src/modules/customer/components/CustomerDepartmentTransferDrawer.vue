<template>
  <div class="drawer-layer" @click.self="$emit('close')">
    <aside class="transfer-drawer">
      <header>
        <div><span>TRANSFER DEPARTMENT</span><h3>转移部门订单</h3><p>低频操作 · 仅调整已有订单和商品关系归属</p></div>
        <button type="button" @click="$emit('close')">×</button>
      </header>
      <div class="drawer-body">
        <section>
          <h4>1. 选择要转移的部门</h4>
          <div class="option-list">
            <label v-for="row in sourceDepartments" :key="row.nxDepartmentId" :class="{ selected: String(sourceId) === String(row.nxDepartmentId) }">
              <input v-model="sourceId" type="radio" :value="row.nxDepartmentId" />
              <span><strong>{{ row.nxDepartmentName }}</strong><small>{{ sourceDescription(row) }}</small></span>
            </label>
          </div>
        </section>
        <section>
          <h4>2. 选择新的归属部门</h4>
          <label class="target-search"><span>⌕</span><input v-model.trim="keyword" placeholder="搜索目标客户或部门" /></label>
          <div class="option-list targets">
            <label v-for="row in filteredTargets" :key="row.nxDepartmentId" :class="{ selected: String(targetId) === String(row.nxDepartmentId) }">
              <input v-model="targetId" type="radio" :value="row.nxDepartmentId" />
              <span><strong>{{ row.displayName }}</strong><small>{{ row.description }}</small></span>
            </label>
            <div v-if="!filteredTargets.length" class="empty">没有可转入的客户部门</div>
          </div>
        </section>
        <div class="transfer-warning"><b>注意</b><p>此操作会把所选部门已有的订单、历史订单、账单和客户商品关系改到目标部门，不会修改当前客户的基础资料。</p></div>
      </div>
      <footer><span>{{ errorText }}</span><button class="outline" type="button" @click="$emit('close')">取消</button><button class="primary" type="button" :disabled="saving || !sourceId || !targetId" @click="submit">{{ saving ? '正在转移…' : '确认转移' }}</button></footer>
    </aside>
  </div>
</template>

<script>
import customerApi from '../api/customerApi';

export default {
  name: 'CustomerDepartmentTransferDrawer',
  props: {
    customer: { type: Object, required: true },
    customers: { type: Array, default: () => [] },
  },
  emits: ['close', 'transferred', 'notice'],
  data() { return { sourceId: null, targetId: null, keyword: '', saving: false, errorText: '' }; },
  computed: {
    sourceDepartments() {
      const children = this.customer.nxDepartmentEntities || [];
      return children.length ? children : [this.customer];
    },
    targets() {
      const currentIds = new Set([this.customer.nxDepartmentId, ...(this.customer.nxDepartmentEntities || []).map((row) => row.nxDepartmentId)].map(String));
      const result = [];
      this.customers.forEach((customer) => {
        if (!currentIds.has(String(customer.nxDepartmentId))) {
          result.push({ ...customer, displayName: customer.nxDepartmentAttrName || customer.nxDepartmentName, description: '目标客户（整店）' });
        }
        (customer.nxDepartmentEntities || []).forEach((department) => {
          if (!currentIds.has(String(department.nxDepartmentId))) result.push({ ...department, displayName: `${customer.nxDepartmentAttrName || customer.nxDepartmentName} · ${department.nxDepartmentName}`, description: '目标客户内部部门' });
        });
      });
      return result;
    },
    filteredTargets() {
      const key = this.keyword.toLowerCase();
      return key ? this.targets.filter((row) => `${row.displayName} ${row.description}`.toLowerCase().includes(key)) : this.targets;
    },
  },
  mounted() { this.sourceId = this.sourceDepartments[0]?.nxDepartmentId || null; },
  methods: {
    sourceDescription(row) { return String(row.nxDepartmentId) === String(this.customer.nxDepartmentId) ? '当前客户整店' : '当前客户内部订货部门'; },
    async submit() {
      const source = this.sourceDepartments.find((row) => String(row.nxDepartmentId) === String(this.sourceId));
      const target = this.targets.find((row) => String(row.nxDepartmentId) === String(this.targetId));
      if (!source || !target) return;
      if (!window.confirm(`确认把“${source.nxDepartmentName}”已有业务记录转到“${target.displayName}”？`)) return;
      this.saving = true; this.errorText = '';
      try {
        const response = await customerApi.transferDepartment(this.sourceId, this.targetId);
        if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '部门转移失败');
        this.$emit('notice', '部门已有业务记录已转移');
        this.$emit('transferred');
        this.$emit('close');
      } catch (error) { this.errorText = error?.message || '部门转移失败'; }
      finally { this.saving = false; }
    },
  },
};
</script>

<style scoped>
.drawer-layer{position:fixed;inset:0;z-index:1120;background:rgba(15,31,24,.23);display:flex;justify-content:flex-end}.transfer-drawer{width:min(650px,94vw);height:100%;background:#f7faf8;display:flex;flex-direction:column;box-shadow:-18px 0 45px rgba(17,52,37,.18);animation:slide-in .22s ease}.transfer-drawer>header{padding:23px 25px;background:#fff;border-bottom:1px solid #e0e9e4;display:flex;justify-content:space-between}.transfer-drawer header span{font-size:10px;letter-spacing:.13em;color:#d17d12;font-weight:900}.transfer-drawer h3{margin:3px 0;font-size:23px}.transfer-drawer header p{margin:0;color:#7d8983}.transfer-drawer header button{border:0;background:#edf3f0;border-radius:10px;width:40px;height:40px;font-size:27px}.drawer-body{flex:1;overflow:auto;padding:21px 24px}.drawer-body section+section{margin-top:24px}.drawer-body h4{font-size:15px;margin:0 0 11px}.option-list{display:grid;gap:8px}.option-list label{display:flex;gap:10px;align-items:center;padding:12px 13px;border:1px solid #dce6e1;border-radius:11px;background:#fff;cursor:pointer}.option-list label.selected{border-color:#2aaa6d;background:#edf8f2}.option-list label>span{min-width:0}.option-list strong,.option-list small{display:block}.option-list small{margin-top:3px;color:#89958f;font-size:10px}.targets{max-height:310px;overflow:auto}.target-search{height:40px;margin-bottom:10px;border:1px solid #d5e1db;border-radius:10px;background:#fff;display:flex;align-items:center;gap:8px;padding:0 11px;color:#0a8a51}.target-search input{border:0;outline:0;width:100%}.empty{padding:30px;text-align:center;color:#87938d}.transfer-warning{margin-top:22px;padding:15px;border-radius:12px;background:#fff5e4;border:1px solid #f1ddb9}.transfer-warning b{color:#a9670a}.transfer-warning p{margin:5px 0 0;color:#7c694b;font-size:12px}.transfer-drawer>footer{padding:15px 20px;border-top:1px solid #dfe8e3;background:#fff;display:flex;gap:9px}.transfer-drawer footer>span{margin-right:auto;color:#bd414b;align-self:center;font-size:12px}.transfer-drawer footer button{border-radius:9px;padding:9px 15px;font-weight:800}.outline{border:1px solid #d1dcd6;background:#fff}.primary{border:0;background:#109d5d;color:#fff}.primary:disabled{opacity:.5}@keyframes slide-in{from{opacity:.4;transform:translateX(36px)}to{opacity:1;transform:none}}
</style>
