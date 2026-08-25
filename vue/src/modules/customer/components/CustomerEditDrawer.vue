<template>
  <div class="drawer-layer" @click.self="$emit('close')">
    <aside class="customer-drawer">
      <header class="drawer-header">
        <div>
          <div class="drawer-eyebrow">CUSTOMER PROFILE</div>
          <h3>编辑客户资料</h3>
          <p>{{ customer?.nxDepartmentAttrName || customer?.nxDepartmentName }}</p>
        </div>
        <button class="icon-button" type="button" @click="$emit('close')">×</button>
      </header>

      <nav class="drawer-tabs">
        <button v-for="tab in tabs" :key="tab.key" type="button"
                :class="{ active: activeTab === tab.key }" @click="activeTab = tab.key">
          {{ tab.label }}
        </button>
      </nav>

      <div class="drawer-body">
        <section v-if="activeTab === 'base'" class="form-section">
          <h4>打印与订货信息</h4>
          <label>客户名称（配送单打印）<input v-model.trim="form.nxDepartmentName" /></label>
          <label>简称（标签打印）<input v-model.trim="form.nxDepartmentAttrName" /></label>
          <label>对外订货代号<input v-model.trim="form.nxDepartmentOrderCode" /></label>
          <label>拣货名称<input v-model.trim="form.nxDepartmentPickName" /></label>
          <label>每日录音时长（分钟）<input v-model.number="form.nxDepartmentRecordMinutes" type="number" min="0" /></label>
          <label>配送单格式
            <select v-model="form.nxDepartmentPrintName">
              <option v-for="option in printOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>

          <h4>交易信息</h4>
          <div class="choice-row">
            <span>支付方式</span>
            <label><input v-model.number="form.nxDepartmentSettleType" type="radio" :value="0" /> 现金</label>
            <label><input v-model.number="form.nxDepartmentSettleType" type="radio" :value="1" /> 记账</label>
          </div>
          <div class="choice-row">
            <span>定价方式</span>
            <label><input v-model="form.nxDepartmentType" type="radio" value="unFixed" /> 市场变动</label>
            <label><input v-model="form.nxDepartmentType" type="radio" value="fixed" /> 固定价格</label>
          </div>
          <div class="choice-row">
            <span>交付方式</span>
            <label><input v-model="form.nxDepartmentDeliveryMode" type="radio" value="DELIVERY" /> 送货</label>
            <label><input v-model="form.nxDepartmentDeliveryMode" type="radio" value="SELF_PICKUP" /> 自提</label>
          </div>
        </section>

        <section v-else-if="activeTab === 'delivery'" class="form-section">
          <h4>配送位置与时间</h4>
          <label>详细地址<textarea v-model.trim="form.nxDepartmentAddress" rows="3" /></label>
          <div class="two-columns">
            <label>纬度<input v-model.trim="form.nxDepartmentLat" placeholder="例如 39.9042" /></label>
            <label>经度<input v-model.trim="form.nxDepartmentLng" placeholder="例如 116.4074" /></label>
          </div>
          <div class="two-columns">
            <label>最早配送时间<input v-model="earliestTime" type="time" /></label>
            <label>最晚配送时间<input v-model="latestTime" type="time" /></label>
          </div>
          <label>卸货时间（分钟）<input v-model.number="form.nxDepartmentUnloadDuration" type="number" min="0" /></label>
          <label>配送优先级
            <select v-model.number="form.nxDepartmentDispatchPriorityWeight">
              <option :value="1">最低</option><option :value="2">较低</option><option :value="3">普通</option>
              <option :value="4">较高</option><option :value="5">最高</option>
            </select>
          </label>
          <label>配送备注<textarea v-model.trim="form.nxDepartmentDispatchRemark" rows="4" /></label>
          <label class="switch-line">
            <input v-model="allowEarlyDelivery" type="checkbox" /> 允许司机提前配送
          </label>
        </section>

        <section v-else-if="activeTab === 'labels'" class="form-section">
          <h4>客户标签</h4>
          <p class="section-tip">标签用于客户搜索、分组和业务员快速识别。</p>
          <div v-if="labels.length" class="label-grid">
            <label v-for="label in labels" :key="label.nxDistributerLabelId"
                   :class="['label-option', { selected: selectedLabelIds.includes(label.nxDistributerLabelId) }]">
              <input v-model="selectedLabelIds" type="checkbox" :value="label.nxDistributerLabelId" />
              {{ label.nxDlName }}
            </label>
          </div>
          <div v-else class="empty-note">配送商暂时没有可用标签。</div>
        </section>

        <section v-else class="form-section">
          <h4>门店内部订货部门</h4>
          <p class="section-tip">这些部门仅用于区分前厅、后厨等订货来源，客户售后仍按整家门店汇总。</p>
          <div v-if="subDepartments.length" class="department-list">
            <div v-for="department in subDepartments" :key="department.nxDepartmentId">
              <span>{{ department.nxDepartmentName }}</span>
              <small>{{ department.nxDepartmentAttrName || '订货部门' }}</small>
            </div>
          </div>
          <div v-else class="empty-note">当前客户没有下级订货部门。</div>

          <div class="danger-zone">
            <h4>低频操作</h4>
            <p>小程序用户和部门记录转移不常使用，统一收在这里。</p>
            <div class="rare-actions">
              <button type="button" @click="$emit('manage-users')"><span>用</span><div><strong>小程序用户</strong><small>查看绑定用户、管理员与移除用户</small></div><b>›</b></button>
              <button type="button" @click="$emit('transfer')"><span>转</span><div><strong>转移部门订单</strong><small>把部门已有记录调整到其他客户部门</small></div><b>›</b></button>
            </div>
            <p class="delete-tip">删除后客户相关数据可能无法恢复，请谨慎操作。</p>
            <button type="button" class="danger-button" @click="$emit('delete', customer)">删除客户</button>
          </div>
        </section>
      </div>

      <footer class="drawer-footer">
        <span class="save-error">{{ errorText }}</span>
        <button type="button" class="secondary-button" @click="$emit('close')">取消</button>
        <button type="button" class="primary-button" :disabled="saving" @click="submit">
          {{ saving ? '保存中…' : '保存客户资料' }}
        </button>
      </footer>
    </aside>
  </div>
</template>

<script>
const PRINT_OPTIONS = [
  ['ApplyPanel', '一张一列'], ['ApplyFiftyPanel', '一张两列'],
  ['ApplyHalfWholePanel', '半张一列'], ['ApplyHalfPanel', '半张两列'],
  ['ApplyThirtyWholePanel', '三分之一张一列'], ['ApplyThirtyPanel', '三分之一张两列'],
];

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function secondsToTime(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) return value.padStart(5, '0');
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 86400) return '';
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}`;
}

function timeToSeconds(value) {
  if (!value) return null;
  const parts = String(value).split(':').map(Number);
  return parts.length === 2 ? parts[0] * 3600 + parts[1] * 60 : null;
}

export default {
  name: 'CustomerEditDrawer',
  props: {
    customer: { type: Object, required: true },
    labels: { type: Array, default: () => [] },
    initialLabelIds: { type: Array, default: () => [] },
    saving: Boolean,
    errorText: { type: String, default: '' },
  },
  emits: ['close', 'save', 'delete', 'manage-users', 'transfer'],
  data() {
    const form = clone(this.customer);
    if (!form.nxDepartmentDeliveryMode) form.nxDepartmentDeliveryMode = 'DELIVERY';
    if (!form.nxDepartmentDispatchPriorityWeight) form.nxDepartmentDispatchPriorityWeight = 3;
    return {
      activeTab: 'base',
      tabs: [
        { key: 'base', label: '基本资料' }, { key: 'delivery', label: '配送设置' },
        { key: 'labels', label: '客户标签' }, { key: 'more', label: '更多' },
      ],
      printOptions: PRINT_OPTIONS.map(([value, label]) => ({ value, label })),
      form,
      earliestTime: secondsToTime(form.nxDepartmentEarliestDeliveryTime),
      latestTime: secondsToTime(form.nxDepartmentLatestDeliveryTime),
      allowEarlyDelivery: form.nxDepartmentAllowEarlyDelivery !== 0,
      selectedLabelIds: this.initialLabelIds.slice(),
    };
  },
  computed: {
    subDepartments() { return this.form.nxDepartmentEntities || []; },
  },
  methods: {
    submit() {
      if (!this.form.nxDepartmentName || !this.form.nxDepartmentAttrName) return;
      this.form.nxDepartmentEarliestDeliveryTime = timeToSeconds(this.earliestTime);
      this.form.nxDepartmentLatestDeliveryTime = timeToSeconds(this.latestTime);
      this.form.nxDepartmentAllowEarlyDelivery = this.allowEarlyDelivery ? 1 : 0;
      this.$emit('save', { customer: clone(this.form), labelIds: this.selectedLabelIds.slice() });
    },
  },
};
</script>

<style scoped>
.drawer-layer{position:fixed;inset:0;z-index:1080;background:rgba(16,30,25,.22);display:flex;justify-content:flex-end;animation:fade-in .18s ease}
.customer-drawer{width:min(640px,92vw);height:100%;background:#fff;box-shadow:-18px 0 48px rgba(20,55,43,.18);display:flex;flex-direction:column;animation:slide-in .24s ease}
.drawer-header{padding:25px 28px 18px;display:flex;justify-content:space-between;border-bottom:1px solid #e7efeb}.drawer-header h3{margin:3px 0;font-size:25px}.drawer-header p{margin:0;color:#76847e}.drawer-eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:#139d61}.icon-button{border:0;background:#eff6f2;border-radius:12px;width:40px;height:40px;font-size:28px;color:#52615b}.drawer-tabs{padding:12px 20px;display:flex;gap:7px;border-bottom:1px solid #edf2ef}.drawer-tabs button{border:0;background:transparent;padding:9px 13px;border-radius:10px;color:#66736e;font-weight:700}.drawer-tabs button.active{background:#e7f6ee;color:#087a48}.drawer-body{flex:1;overflow:auto;padding:24px 28px}.form-section h4{font-size:16px;margin:0 0 15px}.form-section h4:not(:first-child){margin-top:28px}.form-section>label{display:flex;flex-direction:column;gap:7px;margin-bottom:15px;color:#53615b;font-size:14px;font-weight:700}.form-section input:not([type=radio]):not([type=checkbox]),.form-section select,.form-section textarea{width:100%;border:1px solid #cfddd5;border-radius:10px;padding:11px 12px;background:#fff;color:#17211d;outline:none}.form-section input:focus,.form-section select:focus,.form-section textarea:focus{border-color:#12a260;box-shadow:0 0 0 3px rgba(18,162,96,.1)}.two-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px}.two-columns label{display:flex;flex-direction:column;gap:7px;font-size:14px;font-weight:700;color:#53615b}.choice-row{display:grid;grid-template-columns:120px 1fr 1fr;align-items:center;padding:13px 0;border-bottom:1px solid #eef2f0}.choice-row>span{font-weight:700}.choice-row label,.switch-line{font-weight:500!important;margin:0!important;display:block!important}.section-tip{font-size:13px;color:#7c8984;margin-top:-7px}.label-grid{display:flex;flex-wrap:wrap;gap:10px}.label-option{border:1px solid #d7e3dd;border-radius:999px;padding:8px 13px;cursor:pointer}.label-option input{display:none}.label-option.selected{background:#e4f6ec;border-color:#19a564;color:#087b48}.department-list{display:grid;gap:9px}.department-list div{display:flex;justify-content:space-between;padding:13px;border:1px solid #e0e8e4;border-radius:10px}.department-list small{color:#8b9691}.empty-note{padding:24px;text-align:center;background:#f7faf8;color:#84908b;border-radius:12px}.danger-zone{margin-top:35px;padding:20px;border:1px solid #f1d6d6;border-radius:14px;background:#fff9f9}.danger-zone p{font-size:13px;color:#8e6868}.danger-button{border:1px solid #dc5962;background:#fff;color:#c63843;border-radius:10px;padding:9px 14px}.drawer-footer{padding:16px 24px;border-top:1px solid #e5ece8;display:flex;align-items:center;gap:10px}.save-error{color:#cf3e49;font-size:13px;margin-right:auto}.primary-button,.secondary-button{border-radius:10px;padding:10px 17px;font-weight:800}.primary-button{border:0;background:#119e5e;color:#fff}.primary-button:disabled{opacity:.55}.secondary-button{border:1px solid #d5dfda;background:#fff;color:#53615b}@keyframes slide-in{from{transform:translateX(40px);opacity:.4}to{transform:none;opacity:1}}@keyframes fade-in{from{opacity:0}to{opacity:1}}@media(max-width:700px){.two-columns{grid-template-columns:1fr}.choice-row{grid-template-columns:1fr;gap:8px}}
.danger-zone{border-color:#e2e9e5;background:#fafcfb}.danger-zone p{color:#75827c}.rare-actions{display:grid;gap:8px;margin:14px 0 18px}.rare-actions>button{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;padding:11px;border:1px solid #dce6e1;border-radius:10px;background:#fff;text-align:left;color:#33413a}.rare-actions>button>span{width:34px;height:34px;border-radius:9px;background:#edf4f1;display:grid;place-items:center;color:#5f7168;font-weight:900}.rare-actions>button div{min-width:0}.rare-actions strong,.rare-actions small{display:block}.rare-actions small{margin-top:3px;color:#8b9691;font-size:10px}.rare-actions b{font-size:19px;color:#96a19c}.delete-tip{padding-top:15px;border-top:1px solid #eee1e1;color:#8e6868!important}
</style>
