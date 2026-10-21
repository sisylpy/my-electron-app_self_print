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
          <label>客户微信名称（好友／群昵称）
            <input
              v-model.trim="form.nxDepartmentWechatDisplayName"
              type="text"
              maxlength="255"
              placeholder="与微信中的好友昵称或群名称一致"
            />
            <small class="field-tip">用于微信聊天订单搜索；保存后可在订单录入页通过“转所选微信好友订单”自动完成关联或迁移。</small>
          </label>
          <div class="wechat-mode-field">
            <span>微信会话类型</span>
            <div class="wechat-mode-options">
              <label :class="{ selected: wechatConversationKind === WECHAT_CONVERSATION_DIRECT }">
                <input v-model="wechatConversationKind" type="radio" :value="WECHAT_CONVERSATION_DIRECT" />
                <strong>微信好友</strong>
                <small>客户通过好友单聊发送订单</small>
              </label>
              <label :class="{ selected: wechatConversationKind === WECHAT_CONVERSATION_GROUP }">
                <input v-model="wechatConversationKind" type="radio" :value="WECHAT_CONVERSATION_GROUP" />
                <strong>微信群</strong>
                <small>客户通过微信群发送订单</small>
              </label>
            </div>
            <div v-if="wechatConversationKind === WECHAT_CONVERSATION_GROUP" class="wechat-mode-options wechat-group-options">
              <label :class="{ selected: wechatGroupMode === WECHAT_GROUP_ALL_MEMBERS }">
                <input v-model="wechatGroupMode" type="radio" :value="WECHAT_GROUP_ALL_MEMBERS" />
                <strong>专属群</strong>
                <small>群内其他成员发送的文字和图片都可以作为订单</small>
              </label>
              <label :class="{ selected: wechatGroupMode === WECHAT_GROUP_MENTION_SELF }">
                <input v-model="wechatGroupMode" type="radio" :value="WECHAT_GROUP_MENTION_SELF" />
                <strong>混合群</strong>
                <small>只接收明确 @ 当前微信账号的文字消息</small>
              </label>
            </div>
          </div>
          <div class="auto-read-field">
            <div>
              <strong>参与自动读取</strong>
              <small>仅控制定时“全部读”；关闭后仍保留客户资料、微信绑定和手动读取。</small>
            </div>
            <label class="auto-read-switch">
              <input v-model="autoReadParticipation" type="checkbox" />
              <span>{{ autoReadParticipation ? '已开启' : '已关闭' }}</span>
            </label>
          </div>
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

        <section v-else-if="activeTab === 'delivery' && showDeliverySettings" class="form-section">
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
        <span class="save-error">{{ localError || errorText }}</span>
        <button type="button" class="secondary-button" @click="$emit('close')">取消</button>
        <button type="button" class="primary-button" :disabled="saving" @click="submit">
          {{ saving ? '保存中…' : '保存客户资料' }}
        </button>
      </footer>
    </aside>
  </div>
</template>

<script>
import {
  WECHAT_CONVERSATION_DIRECT,
  WECHAT_CONVERSATION_GROUP,
  WECHAT_GROUP_ALL_MEMBERS,
  WECHAT_GROUP_MENTION_SELF,
} from '../presentation/customerWechatBinding';

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
    wechatBinding: { type: Object, default: null },
    participatesInAutoRead: { type: Boolean, default: true },
    showDeliverySettings: { type: Boolean, default: false },
  },
  emits: ['close', 'save', 'delete', 'manage-users', 'transfer'],
  data() {
    const form = clone(this.customer);
    if (!form.nxDepartmentWechatDisplayName && this.wechatBinding?.displayName) {
      form.nxDepartmentWechatDisplayName = this.wechatBinding.displayName;
    }
    if (!form.nxDepartmentDeliveryMode) form.nxDepartmentDeliveryMode = 'DELIVERY';
    if (!form.nxDepartmentDispatchPriorityWeight) form.nxDepartmentDispatchPriorityWeight = 3;
    return {
      activeTab: 'base',
      printOptions: PRINT_OPTIONS.map(([value, label]) => ({ value, label })),
      WECHAT_CONVERSATION_DIRECT,
      WECHAT_CONVERSATION_GROUP,
      WECHAT_GROUP_ALL_MEMBERS,
      WECHAT_GROUP_MENTION_SELF,
      form,
      localError: '',
      wechatConversationKind: (this.wechatBinding?.bound || this.wechatBinding?.profileConfigured)
        ? this.wechatBinding.conversationKind
        : null,
      wechatGroupMode: this.wechatBinding?.groupMode === WECHAT_GROUP_ALL_MEMBERS
        ? WECHAT_GROUP_ALL_MEMBERS
        : WECHAT_GROUP_MENTION_SELF,
      earliestTime: secondsToTime(form.nxDepartmentEarliestDeliveryTime),
      latestTime: secondsToTime(form.nxDepartmentLatestDeliveryTime),
      allowEarlyDelivery: form.nxDepartmentAllowEarlyDelivery !== 0,
      autoReadParticipation: this.participatesInAutoRead,
      selectedLabelIds: this.initialLabelIds.slice(),
    };
  },
  computed: {
    // 配送设置只跟随桌面端“配送调度”模块开放，不能单独产生另一套平台判断。
    tabs() {
      return [
        { key: 'base', label: '基本资料' },
        ...(this.showDeliverySettings ? [{ key: 'delivery', label: '配送设置' }] : []),
        { key: 'labels', label: '客户标签' },
        { key: 'more', label: '更多' },
      ];
    },
    subDepartments() { return this.form.nxDepartmentEntities || []; },
  },
  methods: {
    submit() {
      if (!this.form.nxDepartmentName || !this.form.nxDepartmentAttrName) return;
      this.localError = '';
      const wechatName = String(this.form.nxDepartmentWechatDisplayName || '').trim();
      if (wechatName && ![WECHAT_CONVERSATION_DIRECT, WECHAT_CONVERSATION_GROUP].includes(this.wechatConversationKind)) {
        this.localError = '设置微信名称时，请同时选择微信好友或微信群';
        return;
      }
      if (wechatName && this.wechatConversationKind === WECHAT_CONVERSATION_GROUP
        && ![WECHAT_GROUP_ALL_MEMBERS, WECHAT_GROUP_MENTION_SELF].includes(this.wechatGroupMode)) {
        this.localError = '微信群还需要选择专属群或混合群';
        return;
      }
      this.form.nxDepartmentEarliestDeliveryTime = timeToSeconds(this.earliestTime);
      this.form.nxDepartmentLatestDeliveryTime = timeToSeconds(this.latestTime);
      this.form.nxDepartmentAllowEarlyDelivery = this.allowEarlyDelivery ? 1 : 0;
      this.$emit('save', {
        customer: clone(this.form),
        labelIds: this.selectedLabelIds.slice(),
        wechatConversationKind: wechatName ? this.wechatConversationKind : null,
        wechatGroupMode: this.wechatGroupMode,
        participatesInAutoRead: this.autoReadParticipation,
      });
    },
  },
};
</script>

<style scoped>
.drawer-layer{position:fixed;inset:0;z-index:1080;background:rgba(var(--product-text-rgb), 0.22);display:flex;justify-content:flex-end;animation:fade-in .18s ease}
.customer-drawer{width:min(640px,92vw);height:100%;background: var(--product-surface);box-shadow:-18px 0 48px rgba(var(--product-text-rgb), 0.18);display:flex;flex-direction:column;animation:slide-in .24s ease}
.drawer-header{padding:25px 28px 18px;display:flex;justify-content:space-between;border-bottom:1px solid var(--product-border)}.drawer-header h3{margin:3px 0;font-size:25px}.drawer-header p{margin:0;color:var(--product-text-secondary)}.drawer-eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;color:var(--product-primary-strong)}.icon-button{border:0;background:var(--product-primary-soft);border-radius:12px;width:40px;height:40px;font-size:28px;color:var(--product-text-secondary)}.drawer-tabs{padding:12px 20px;display:flex;gap:7px;border-bottom:1px solid var(--product-border)}.drawer-tabs button{border:0;background:transparent;padding:9px 13px;border-radius:10px;color:var(--product-text-secondary);font-weight:700}.drawer-tabs button.active{background:var(--product-primary-soft);color:var(--product-primary-strong)}.drawer-body{flex:1;overflow:auto;padding:24px 28px}.form-section h4{font-size:16px;margin:0 0 15px}.form-section h4:not(:first-child){margin-top:28px}.form-section>label{display:flex;flex-direction:column;gap:7px;margin-bottom:15px;color:var(--product-text-secondary);font-size:14px;font-weight:700}.form-section input:not([type=radio]):not([type=checkbox]),.form-section select,.form-section textarea{width:100%;border:1px solid var(--product-border);border-radius:10px;padding:11px 12px;background: var(--product-surface);color:var(--product-text);outline:none}.form-section input:focus,.form-section select:focus,.form-section textarea:focus{border-color:var(--product-primary-hover);box-shadow:0 0 0 3px var(--product-primary-ring)}.two-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px}.two-columns label{display:flex;flex-direction:column;gap:7px;font-size:14px;font-weight:700;color:var(--product-text-secondary)}.choice-row{display:grid;grid-template-columns:120px 1fr 1fr;align-items:center;padding:13px 0;border-bottom:1px solid var(--product-border)}.choice-row>span{font-weight:700}.choice-row label,.switch-line{font-weight:500!important;margin:0!important;display:block!important}.section-tip{font-size:13px;color:var(--product-text-muted);margin-top:-7px}.label-grid{display:flex;flex-wrap:wrap;gap:10px}.label-option{border:1px solid var(--product-border);border-radius:999px;padding:8px 13px;cursor:pointer}.label-option input{display:none}.label-option.selected{background:var(--product-primary-soft);border-color:var(--product-primary);color:var(--product-primary-strong)}.department-list{display:grid;gap:9px}.department-list div{display:flex;justify-content:space-between;padding:13px;border:1px solid var(--product-border);border-radius:10px}.department-list small{color:var(--product-text-muted)}.empty-note{padding:24px;text-align:center;background:var(--product-tint);color:var(--product-text-muted);border-radius:12px}.danger-zone{margin-top:35px;padding:20px;border:1px solid var(--product-danger-soft);border-radius:14px;background:var(--product-danger-soft)}.danger-zone p{font-size:13px;color:var(--product-danger)}.danger-button{border:1px solid var(--product-danger);background: var(--product-surface);color:var(--product-danger);border-radius:10px;padding:9px 14px}.drawer-footer{padding:16px 24px;border-top:1px solid var(--product-tint);display:flex;align-items:center;gap:10px}.save-error{color:var(--product-danger);font-size:13px;margin-right:auto}.primary-button,.secondary-button{border-radius:10px;padding:10px 17px;font-weight:800}.primary-button{border:0;background:var(--product-primary-strong);color:#fff}.primary-button:disabled{opacity:.55}.secondary-button{border:1px solid var(--product-border);background: var(--product-surface);color:var(--product-text-secondary)}@keyframes slide-in{from{transform:translateX(40px);opacity:.4}to{transform:none;opacity:1}}@keyframes fade-in{from{opacity:0}to{opacity:1}}@media(max-width:700px){.two-columns{grid-template-columns:1fr}.choice-row{grid-template-columns:1fr;gap:8px}}
.field-tip{font-size:12px;font-weight:500;color:var(--product-text-muted);line-height:1.5}
.wechat-mode-field{margin-bottom:18px;color:var(--product-text-secondary);font-size:14px;font-weight:700}.wechat-mode-field>span{display:block;margin-bottom:8px}.wechat-mode-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.wechat-mode-options label{position:relative;display:grid;gap:3px;padding:13px 14px;border:1px solid var(--product-primary-soft);border-radius:11px;background: var(--product-surface);cursor:pointer}.wechat-mode-options label.selected{border-color:var(--product-primary);background:var(--product-primary-soft);box-shadow:0 0 0 2px var(--product-primary-ring)}.wechat-mode-options input{position:absolute;opacity:0;pointer-events:none}.wechat-mode-options strong,.wechat-mode-readonly strong{color:var(--product-text)}.wechat-mode-options small,.wechat-mode-readonly small{font-size:11px;font-weight:500;line-height:1.45;color:var(--product-text-muted)}.wechat-mode-readonly{display:flex;flex-direction:column;gap:3px;padding:12px 14px;border:1px solid var(--product-border);border-radius:10px;background:var(--product-tint)}.wechat-mode-readonly.muted strong{color:var(--product-text-secondary)}
.auto-read-field{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:0 0 18px;padding:13px 14px;border:1px solid var(--product-border);border-radius:10px;background:var(--product-tint)}.auto-read-field>div{display:grid;gap:4px}.auto-read-field strong{color:var(--product-text);font-size:14px}.auto-read-field small{color:var(--product-text-muted);font-size:11px;font-weight:500;line-height:1.45}.auto-read-switch{display:flex;flex:none;align-items:center;gap:7px;color:var(--product-text-secondary);font-size:12px;font-weight:800;cursor:pointer}.auto-read-switch input{width:17px;height:17px;accent-color:var(--product-primary)}
.danger-zone{border-color:var(--product-border);background:var(--product-tint)}.danger-zone p{color:var(--product-text-muted)}.rare-actions{display:grid;gap:8px;margin:14px 0 18px}.rare-actions>button{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;width:100%;padding:11px;border:1px solid var(--product-border);border-radius:10px;background: var(--product-surface);text-align:left;color:var(--product-text)}.rare-actions>button>span{width:34px;height:34px;border-radius:9px;background:var(--product-primary-soft);display:grid;place-items:center;color:var(--product-text-secondary);font-weight:900}.rare-actions>button div{min-width:0}.rare-actions strong,.rare-actions small{display:block}.rare-actions small{margin-top:3px;color:var(--product-text-muted);font-size:10px}.rare-actions b{font-size:19px;color:var(--product-text-muted)}.delete-tip{padding-top:15px;border-top:1px solid var(--product-border);color:var(--product-danger)!important}
@media(max-width:700px){.wechat-mode-options{grid-template-columns:1fr}}
</style>
