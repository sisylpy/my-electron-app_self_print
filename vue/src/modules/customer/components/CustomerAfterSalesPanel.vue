<template>
  <div class="after-sales-panel">
    <div class="panel-toolbar">
      <div><h3>售后问题</h3><p>统一汇总该客户整家门店的售后记录，不区分前厅、后厨等内部订货部门。</p></div>
      <div class="filters">
        <select v-model="statusFilter" @change="load"><option value="">全部状态</option><option v-for="row in dictionaries.statuses" :key="row.code" :value="row.code">{{ row.label }}</option></select>
        <input v-model="startDate" type="date" @change="load" /><span>至</span><input v-model="endDate" type="date" @change="load" />
      </div>
    </div>

    <div v-if="loading" class="panel-state">正在加载售后记录…</div>
    <div v-else-if="errorText" class="panel-state error">{{ errorText }} <button @click="load">重新加载</button></div>
    <div v-else-if="!cases.length" class="panel-state">该客户暂时没有售后问题</div>
    <div v-else class="case-list">
      <article v-for="item in cases" :key="item.afterSalesId" @click="openDetail(item)">
        <div class="case-status"><span :class="severityClass(item.severity)">{{ label('severities', item.severity) }}</span><b>{{ label('statuses', item.status) }}</b></div>
        <div class="case-main"><h4>{{ label('issueTypes', item.issueType) }}</h4><p>{{ item.issueItemSummary || '未填写问题说明' }}</p><small>{{ formatTime(item.createdAt) }} · {{ item.afterSalesNo }}</small></div>
        <div class="case-tail"><span v-if="Number(item.hasReplenishment)">{{ item.status === 'COMPLETED' ? '已补货' : '正在补货' }}</span><b>›</b></div>
      </article>
    </div>

    <div v-if="detailOpen" class="detail-layer" @click.self="detailOpen = false">
      <aside class="detail-drawer">
        <header><div><span>AFTER SALES</span><h3>售后问题详情</h3><p>{{ selectedCase?.afterSalesNo }}</p></div><button @click="detailOpen = false">×</button></header>
        <div v-if="detailLoading" class="panel-state">正在加载详情…</div>
        <div v-else class="detail-body">
          <section><h4>问题概况</h4><div class="detail-grid"><div><span>问题类型</span><strong>{{ label('issueTypes', detail.nxDasIssueType) }}</strong></div><div><span>严重程度</span><strong>{{ label('severities', detail.nxDasSeverity) }}</strong></div><div><span>处理状态</span><strong>{{ label('statuses', detail.nxDasStatus) }}</strong></div><div><span>客户确认</span><strong>{{ detail.nxDasCustomerConfirmStatus || '待确认' }}</strong></div></div><p class="description">{{ detail.nxDasIssueDescription || selectedCase?.issueItemSummary || '暂无说明' }}</p></section>
          <section><h4>问题商品</h4><div v-if="!(detail.items || []).length" class="empty-small">整单问题或暂无商品明细</div><div v-for="row in detail.items || []" :key="row.nxDasiId" class="detail-row"><strong>{{ row.nxDasiGoodsName }}</strong><span>{{ row.nxDasiIssueDescription || row.nxDasiIssueTag || '商品问题' }}</span><em>{{ row.nxDasiIssueQuantity || '' }}</em></div></section>
          <section><h4>处理记录</h4><div v-if="!(detail.actions || []).length" class="empty-small">尚未记录处理动作</div><div v-for="row in detail.actions || []" :key="row.nxDasaId" class="timeline-row"><i></i><div><strong>{{ row.nxDasaRemark || row.nxDasaActionType }}</strong><p>{{ row.nxDasaResult || '处理中' }}</p><small>{{ formatTime(row.nxDasaCreatedAt) }}</small></div></div></section>
        </div>
      </aside>
    </div>
  </div>
</template>

<script>
import customerApi from '../api/customerApi';
function today(offset = 0) { const date = new Date(); date.setDate(date.getDate() + offset); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export default {
  name: 'CustomerAfterSalesPanel',
  props: { customerId: { type: [Number, String], required: true }, distributerId: { type: [Number, String], required: true }, operatorUserId: { type: [Number, String], required: true } },
  data() { return { loading: false, errorText: '', cases: [], dictionaries: { statuses: [], severities: [], issueTypes: [] }, statusFilter: '', startDate: today(-365), endDate: today(), detailOpen: false, detailLoading: false, detail: {}, selectedCase: null }; },
  watch: { customerId: { immediate: true, handler() { this.load(); } } },
  methods: {
    async load() {
      if (!this.customerId || !this.distributerId || !this.operatorUserId) return;
      this.loading = true; this.errorText = '';
      try {
        if (!this.dictionaries.statuses.length) { const dict = await customerApi.getAfterSalesDictionaries(); if (dict?.data?.code !== 0) throw new Error(dict?.data?.msg || '售后字典加载失败'); this.dictionaries = { ...this.dictionaries, ...(dict.data.data || {}) }; }
        const response = await customerApi.getAfterSalesList({ distributerId: this.distributerId, operatorUserId: this.operatorUserId, departmentFatherId: this.customerId, startDate: this.startDate, endDate: this.endDate, status: this.statusFilter || undefined });
        if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '售后列表加载失败');
        this.cases = response.data.data || [];
      } catch (error) { this.errorText = error?.message || '售后列表加载失败'; }
      finally { this.loading = false; }
    },
    label(type, code) { return (this.dictionaries[type] || []).find((row) => row.code === code)?.label || code || '-'; },
    severityClass(value) { return `severity ${String(value || '').toLowerCase()}`; },
    formatTime(value) { return value ? String(value).replace('T', ' ').slice(0, 16) : ''; },
    async openDetail(item) { this.selectedCase = item; this.detail = {}; this.detailOpen = true; this.detailLoading = true; try { const response = await customerApi.getAfterSalesDetail(item.afterSalesId, { distributerId: this.distributerId, operatorUserId: this.operatorUserId }); if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '详情加载失败'); this.detail = response.data.data || {}; } catch (error) { this.detail = { nxDasIssueDescription: error?.message || '详情加载失败' }; } finally { this.detailLoading = false; } },
  },
};
</script>

<style scoped>
.panel-toolbar{display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:18px}.panel-toolbar h3{margin:0 0 5px;font-size:21px}.panel-toolbar p{margin:0;color:var(--product-text-secondary)}.filters{display:flex;align-items:center;gap:7px}.filters select,.filters input{border:1px solid var(--product-border);background: var(--product-surface);border-radius:9px;padding:8px}.filters span{color:var(--product-text-muted)}.panel-state{padding:70px;text-align:center;color:var(--product-text-muted);background: var(--product-surface);border:1px dashed var(--product-border);border-radius:16px}.panel-state.error{color:var(--product-danger)}.case-list{background: var(--product-surface);border:1px solid var(--product-border);border-radius:16px;overflow:hidden}.case-list article{display:grid;grid-template-columns:130px 1fr auto;gap:18px;align-items:center;padding:17px 19px;border-bottom:1px solid var(--product-border);cursor:pointer}.case-list article:last-child{border-bottom:0}.case-list article:hover{background:var(--product-primary-soft)}.case-status{display:flex;flex-direction:column;align-items:flex-start;gap:7px}.case-status span{font-size:12px;padding:5px 8px;border-radius:999px;background:var(--product-border)}.case-status span.serious{background:var(--product-danger-soft);color:var(--product-danger)}.case-status span.medium{background:var(--product-warning-soft);color:var(--product-warning)}.case-status span.light{background:var(--product-primary-soft);color:var(--product-primary-strong)}.case-status b{font-size:12px;color:var(--product-text-muted)}.case-main h4{font-size:16px;margin:0 0 5px}.case-main p{margin:0 0 5px;color:var(--product-text-secondary)}.case-main small{color:var(--product-text-muted)}.case-tail{display:flex;align-items:center;gap:15px}.case-tail span{font-size:12px;color:var(--product-primary-strong)}.case-tail b{font-size:24px;color:var(--product-text-muted)}.detail-layer{position:fixed;inset:0;z-index:1100;background:rgba(var(--product-text-rgb), 0.25);display:flex;justify-content:flex-end}.detail-drawer{width:min(650px,93vw);height:100%;background:var(--product-tint);box-shadow:-18px 0 45px rgba(var(--product-text-rgb), 0.18);display:flex;flex-direction:column}.detail-drawer>header{background: var(--product-surface);padding:23px 26px;border-bottom:1px solid var(--product-tint);display:flex;justify-content:space-between}.detail-drawer header span{font-size:11px;letter-spacing:.13em;color:var(--product-primary-strong);font-weight:900}.detail-drawer h3{margin:3px 0}.detail-drawer header p{margin:0;color:var(--product-text-muted)}.detail-drawer header button{border:0;background:var(--product-primary-soft);border-radius:10px;width:40px;height:40px;font-size:26px}.detail-body{padding:22px 26px;overflow:auto;display:grid;gap:16px}.detail-body section{background: var(--product-surface);border:1px solid var(--product-border);border-radius:14px;padding:18px}.detail-body h4{font-size:16px;margin:0 0 14px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.detail-grid div{display:flex;flex-direction:column}.detail-grid span{font-size:12px;color:var(--product-text-muted)}.description{margin:17px 0 0;padding-top:14px;border-top:1px solid var(--product-border);color:var(--product-text-secondary)}.detail-row{display:grid;grid-template-columns:1fr 1fr auto;gap:9px;padding:10px 0;border-top:1px solid var(--product-border)}.detail-row span{color:var(--product-text-muted)}.detail-row em{font-style:normal;color:var(--product-primary-strong)}.empty-small{padding:15px;background:var(--product-tint);color:var(--product-text-muted);text-align:center;border-radius:9px}.timeline-row{display:flex;gap:11px;padding:9px 0}.timeline-row i{width:9px;height:9px;border-radius:50%;background:var(--product-primary-strong);margin-top:6px}.timeline-row p{margin:3px 0;color:var(--product-text-secondary)}.timeline-row small{color:var(--product-text-muted)}@media(max-width:900px){.panel-toolbar{align-items:flex-start;flex-direction:column}.filters{flex-wrap:wrap}.case-list article{grid-template-columns:1fr}.case-status{flex-direction:row}}
</style>
