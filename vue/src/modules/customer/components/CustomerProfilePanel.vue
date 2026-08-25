<template>
  <div class="profile-grid">
    <section class="info-card wide">
      <div class="section-head"><span class="section-mark">基</span><h3>客户基础信息</h3><button @click="$emit('edit')">编辑资料</button></div>
      <div class="detail-grid">
        <div><span>配送单名称</span><strong>{{ customer.nxDepartmentName || '-' }}</strong></div>
        <div><span>标签打印简称</span><strong>{{ customer.nxDepartmentAttrName || '-' }}</strong></div>
        <div><span>对外订货代号</span><strong>{{ customer.nxDepartmentOrderCode || '-' }}</strong></div>
        <div><span>拣货名称</span><strong>{{ customer.nxDepartmentPickName || '-' }}</strong></div>
        <div><span>支付方式</span><strong>{{ customer.nxDepartmentSettleType == 0 ? '现金' : '记账' }}</strong></div>
        <div><span>定价方式</span><strong>{{ customer.nxDepartmentType === 'fixed' ? '固定价格' : '市场变动' }}</strong></div>
        <div><span>交付方式</span><strong>{{ customer.nxDepartmentDeliveryMode === 'SELF_PICKUP' ? '客户自提' : '配送到店' }}</strong></div>
        <div><span>配送单格式</span><strong>{{ printName }}</strong></div>
      </div>
    </section>

    <section class="info-card">
      <div class="section-head"><span class="section-mark delivery">配</span><h3>配送设置</h3></div>
      <div class="stacked-details">
        <div><span>地址</span><strong>{{ customer.nxDepartmentAddress || '尚未设置' }}</strong></div>
        <div><span>配送时间</span><strong>{{ deliveryWindow }}</strong></div>
        <div><span>卸货时间</span><strong>{{ customer.nxDepartmentUnloadDuration ? customer.nxDepartmentUnloadDuration + '分钟' : '尚未设置' }}</strong></div>
        <div><span>配送备注</span><strong>{{ customer.nxDepartmentDispatchRemark || '无' }}</strong></div>
      </div>
    </section>

    <section class="info-card">
      <div class="section-head"><span class="section-mark labels">标</span><h3>标签与部门</h3></div>
      <div class="tag-list">
        <span v-for="label in selectedLabels" :key="label.nxDistributerLabelId">{{ label.nxDlName }}</span>
        <em v-if="!selectedLabels.length">暂无客户标签</em>
      </div>
      <div class="department-summary">
        <div v-for="department in departments" :key="department.nxDepartmentId">
          <strong>{{ department.nxDepartmentName }}</strong><span>内部订货部门</span>
        </div>
        <div v-if="!departments.length"><strong>整店订货</strong><span>没有下级订货部门</span></div>
      </div>
    </section>
  </div>
</template>

<script>
const PRINT_NAMES = {
  ApplyPanel: '一张一列', ApplyFiftyPanel: '一张两列', ApplyHalfWholePanel: '半张一列',
  ApplyHalfPanel: '半张两列', ApplyThirtyWholePanel: '三分之一张一列', ApplyThirtyPanel: '三分之一张两列',
};
function time(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' && value.includes(':')) return value;
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return '';
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}`;
}
export default {
  name: 'CustomerProfilePanel',
  props: { customer: { type: Object, required: true }, selectedLabels: { type: Array, default: () => [] } },
  emits: ['edit'],
  computed: {
    departments() { return this.customer.nxDepartmentEntities || []; },
    printName() { return PRINT_NAMES[this.customer.nxDepartmentPrintName] || '半张一列'; },
    deliveryWindow() {
      const start = time(this.customer.nxDepartmentEarliestDeliveryTime);
      const end = time(this.customer.nxDepartmentLatestDeliveryTime);
      return start && end ? `${start} - ${end}` : '尚未设置';
    },
  },
};
</script>

<style scoped>
.profile-grid{
  display:grid;
  grid-template-columns:1.25fr .75fr;
  gap:0;
  overflow:hidden;
  background:#fff;
  border:1px solid #dfe7e3;
  border-radius:6px;
}
.info-card{
  min-width:0;
  padding:25px 28px;
  background:#fff;
  border:0;
  border-radius:0;
  box-shadow:none;
}
.info-card.wide{
  grid-column:1/-1;
  border-bottom:1px solid #e4ebe7;
}
.info-card:not(.wide)+.info-card{border-left:1px solid #e4ebe7}
.section-head{
  display:flex;
  align-items:center;
  gap:10px;
  margin-bottom:15px;
}
.section-head h3{
  margin:0;
  font-size:18px;
  font-weight:800;
  color:#26312d;
}
.section-head button{
  margin-left:auto;
  padding:4px 0 3px;
  border:0;
  border-bottom:1px solid #96cdb1;
  border-radius:0;
  background:transparent;
  color:#087b48;
  font-size:13px;
  font-weight:800;
}
.section-head button:hover{border-bottom-color:#087b48}
.section-mark{
  width:auto;
  height:auto;
  padding-left:9px;
  border-left:3px solid #119d5d;
  border-radius:0;
  background:transparent;
  color:#087b48;
  display:block;
  font-size:11px;
  line-height:18px;
  font-weight:900;
}
.section-mark.delivery{
  border-left-color:#5e83c8;
  background:transparent;
  color:#4268b4;
}
.section-mark.labels{
  border-left-color:#d49a2d;
  background:transparent;
  color:#a86b08;
}
.detail-grid{
  display:grid;
  grid-template-columns:repeat(4,minmax(0,1fr));
  gap:0 30px;
}
.detail-grid div,.stacked-details div{
  display:flex;
  flex-direction:column;
  gap:5px;
  padding:11px 0;
  border-top:1px solid #edf1ef;
}
.detail-grid span,.stacked-details span{
  font-size:12px;
  color:#84908b;
}
.detail-grid strong,.stacked-details strong{
  font-size:15px;
  color:#26312d;
  overflow-wrap:anywhere;
}
.stacked-details{display:grid;gap:0}
.tag-list{
  display:flex;
  flex-wrap:wrap;
  gap:9px 18px;
  margin:2px 0 16px;
}
.tag-list span{
  position:relative;
  padding:0 0 0 11px;
  border-radius:0;
  background:transparent;
  color:#087c49;
  font-size:13px;
  font-weight:750;
}
.tag-list span::before{
  content:'';
  position:absolute;
  left:0;
  top:50%;
  width:5px;
  height:5px;
  border-radius:50%;
  background:#119d5d;
  transform:translateY(-50%);
}
.tag-list em{font-style:normal;color:#8c9893}
.department-summary{display:grid;gap:0}
.department-summary div{
  display:flex;
  justify-content:space-between;
  gap:16px;
  padding:11px 0;
  border-top:1px solid #edf1ef;
}
.department-summary span{font-size:12px;color:#8d9994}
@media(max-width:1100px){
  .detail-grid{grid-template-columns:repeat(2,1fr)}
}
@media(max-width:800px){
  .profile-grid{grid-template-columns:1fr}
  .info-card:not(.wide)+.info-card{border-left:0;border-top:1px solid #e4ebe7}
  .detail-grid{grid-template-columns:1fr}
}
</style>
