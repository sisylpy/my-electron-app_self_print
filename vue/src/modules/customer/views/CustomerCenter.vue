<template>
  <div class="customer-center">
    <aside class="customer-list-pane">
      <div class="list-heading">
        <div>
          <span>CUSTOMERS</span>
          <h2>客户列表</h2>
        </div>
        <b>{{ customerCount }}</b>
      </div>

      <label class="customer-search">
        <span>⌕</span>
        <input v-model.trim="keyword" placeholder="搜索客户名称、代号" />
      </label>

      <div v-if="listLoading" class="list-state">正在加载客户…</div>
      <div v-else-if="listError" class="list-state error">
        {{ listError }}
        <button type="button" @click="loadCustomers()">重新加载</button>
      </div>
      <div v-else class="customer-groups">
        <section v-for="group in filteredGroups" :key="group.key">
          <header>
            <span>{{ group.label }}</span>
            <small>{{ group.customers.length }}</small>
          </header>
          <button
            v-for="row in group.customers"
            :key="row.nxDepartmentId"
            type="button"
            :class="['customer-row', { active: String(selectedCustomerId) === String(row.nxDepartmentId) }]"
            @click="selectCustomer(row)"
          >
            <span class="customer-avatar">{{ customerInitial(row) }}</span>
            <span class="customer-copy">
              <strong>{{ displayName(row) }}</strong>
              <small>{{ customerSecondary(row) }}</small>
            </span>
            <i>›</i>
          </button>
        </section>

        <div v-if="!filteredGroups.length" class="list-state">没有找到相关客户</div>
      </div>
    </aside>

    <main class="customer-workspace">
      <div v-if="detailLoading && !customer" class="workspace-state">
        <span class="state-icon">客</span>
        <h3>正在加载客户资料…</h3>
      </div>
      <div v-else-if="detailError && !customer" class="workspace-state error">
        <span class="state-icon">!</span>
        <h3>{{ detailError }}</h3>
        <button type="button" @click="reloadSelectedCustomer">重新加载</button>
      </div>
      <div v-else-if="!customer" class="workspace-state">
        <span class="state-icon">客</span>
        <h3>请选择一位客户</h3>
        <p>查看客户资料、客户商品、售后问题和历史订单。</p>
      </div>

      <template v-else>
        <header class="customer-commandbar">
          <nav class="module-tabs" aria-label="客户中心功能">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              type="button"
              :class="{ active: activeTab === tab.key }"
              @click="activeTab = tab.key"
            >
              <strong>{{ tab.label }}</strong>
            </button>
          </nav>
        </header>

        <section class="module-content">
          <CustomerProfilePanel
            v-if="activeTab === 'profile'"
            :customer="customer"
            :selected-labels="selectedLabels"
            @edit="editDrawerOpen = true"
          />
          <CustomerGoodsPanel
            v-else-if="activeTab === 'goods'"
            :customer-id="customer.nxDepartmentId"
            :customer-name="displayName(customer)"
            @open-standard="openGoodsStandard"
            @open-price="openGoodsPrice"
            @notice="showNotice"
          />
          <CustomerAfterSalesPanel
            v-else-if="activeTab === 'afterSales'"
            :customer-id="customer.nxDepartmentId"
            :distributer-id="distributerId"
            :operator-user-id="operatorUserId"
          />
          <CustomerAiRecommendationPanel
            v-else-if="activeTab === 'ai'"
            :customer="customer"
            :distributer-id="distributerId"
            :operator-user-id="operatorUserId"
            @notice="showNotice"
            @order-saved="handleOrderSaved"
          />
          <div v-else class="history-module">
            <div class="history-heading">
              <div><h3>客户历史订单</h3><p>保留最近月份的订单、订单详情和 Excel 下载能力。</p></div>
            </div>
            <HistoryOrders
              :key="customer.nxDepartmentId"
              :selected-all-customer="customer.nxDepartmentId"
              :settle-type="customer.nxDepartmentSettleType"
              @open-order-detail="openOrderDetail"
            />
          </div>
        </section>
      </template>
    </main>

    <CustomerEditDrawer
      v-if="editDrawerOpen && customer"
      :customer="customer"
      :labels="labels"
      :initial-label-ids="selectedLabelIds"
      :saving="savingCustomer"
      :error-text="saveError"
      @close="closeEditDrawer"
      @save="saveCustomer"
      @delete="deleteCustomer"
      @manage-users="openCustomerUsers"
      @transfer="openDepartmentTransfer"
    />

    <CustomerUsersDrawer
      v-if="usersDrawerOpen && customer"
      :customer-id="customer.nxDepartmentId"
      :customer-name="displayName(customer)"
      @close="usersDrawerOpen = false"
      @notice="showNotice"
    />

    <CustomerDepartmentTransferDrawer
      v-if="transferDrawerOpen && customer"
      :customer="customer"
      :customers="allCustomers"
      @close="transferDrawerOpen = false"
      @transferred="reloadSelectedCustomer"
      @notice="showNotice"
    />

    <CustomerGoodsStandardDrawer
      v-if="standardRelation"
      :relation="standardRelation"
      :distributer-id="distributerId"
      :operator-user-id="operatorUserId"
      @close="standardRelation = null"
      @updated="handleStandardUpdated"
      @notice="showNotice"
    />

    <CustomerGoodsPriceDrawer
      v-if="priceGoods && customer"
      :goods="priceGoods"
      :customer-id="customer.nxDepartmentId"
      :customer-name="displayName(customer)"
      @close="priceGoods = null"
    />

    <div v-if="orderDetailOpen" class="order-detail-layer" @click.self="closeOrderDetail">
      <aside class="order-detail-drawer">
        <header>
          <div>
            <span>ORDER DETAIL</span>
            <h3>历史订单详情</h3>
            <p>{{ orderDetailTitle }}</p>
          </div>
          <button type="button" @click="closeOrderDetail">×</button>
        </header>
        <div v-if="orderDetailLoading" class="detail-state">正在加载订单详情…</div>
        <div v-else-if="orderDetailError" class="detail-state error">{{ orderDetailError }}</div>
        <div v-else class="order-detail-body">
          <section class="bill-overview">
            <div><span>订单号</span><strong>{{ billDetail.nxDbTradeNo || selectedBill.nxDbTradeNo || '-' }}</strong></div>
            <div><span>订单日期</span><strong>{{ billDetail.nxDbDate || selectedBill.nxDbDate || '-' }}</strong></div>
            <div><span>客户</span><strong>{{ displayName(customer) }}</strong></div>
            <div><span>合计金额</span><strong class="bill-total">¥ {{ billDetail.nxDbTotal ?? selectedBill.nxDbTotal ?? '0' }}</strong></div>
          </section>
          <section class="bill-lines">
            <h4>商品明细 <span>{{ orderLines.length }} 项</span></h4>
            <div v-if="!orderLines.length" class="detail-state">该订单没有商品明细</div>
            <article v-for="(row, index) in orderLines" :key="row.nxDepartmentOrdersId || row.nxDepartmentOrderId || index">
              <b>{{ index + 1 }}</b>
              <div><strong>{{ orderGoodsName(row) }}</strong><small v-if="row.nxDoRemark">{{ row.nxDoRemark }}</small></div>
              <span>{{ row.nxDoQuantity || row.nxDoWeight || '-' }} {{ row.nxDoStandard || '' }}</span>
              <em>¥ {{ row.nxDoSubtotal ?? '-' }}</em>
            </article>
          </section>
        </div>
      </aside>
    </div>

    <transition name="notice">
      <div v-if="notice.visible" :class="['customer-notice', notice.type]">{{ notice.text }}</div>
    </transition>
  </div>
</template>

<script>
import HistoryOrders from '@/components/HistoryOrders.vue';
import customerApi from '../api/customerApi';
import CustomerProfilePanel from '../components/CustomerProfilePanel.vue';
import CustomerEditDrawer from '../components/CustomerEditDrawer.vue';
import CustomerGoodsPanel from '../components/CustomerGoodsPanel.vue';
import CustomerGoodsStandardDrawer from '../components/CustomerGoodsStandardDrawer.vue';
import CustomerGoodsPriceDrawer from '../components/CustomerGoodsPriceDrawer.vue';
import CustomerAfterSalesPanel from '../components/CustomerAfterSalesPanel.vue';
import CustomerAiRecommendationPanel from '../components/CustomerAiRecommendationPanel.vue';
import CustomerUsersDrawer from '../components/CustomerUsersDrawer.vue';
import CustomerDepartmentTransferDrawer from '../components/CustomerDepartmentTransferDrawer.vue';

function ensureSuccess(response, fallback) {
  if (!response?.data || response.data.code !== 0) {
    throw new Error(response?.data?.msg || fallback);
  }
  return response.data.data;
}

export default {
  name: 'CustomerCenter',
  components: {
    HistoryOrders,
    CustomerProfilePanel,
    CustomerEditDrawer,
    CustomerGoodsPanel,
    CustomerGoodsStandardDrawer,
    CustomerGoodsPriceDrawer,
    CustomerAfterSalesPanel,
    CustomerAiRecommendationPanel,
    CustomerUsersDrawer,
    CustomerDepartmentTransferDrawer,
  },
  data() {
    return {
      groups: [],
      keyword: '',
      listLoading: false,
      listError: '',
      selectedCustomerId: null,
      customer: null,
      detailLoading: false,
      detailError: '',
      labels: [],
      selectedLabelIds: [],
      activeTab: 'profile',
      tabs: [
        { key: 'profile', icon: '客', label: '客户资料', description: '基础与配送信息' },
        { key: 'goods', icon: '货', label: '客户商品', description: '商品与专属要求' },
        { key: 'afterSales', icon: '售', label: '售后问题', description: '按整家门店汇总' },
        { key: 'ai', icon: 'AI', label: '预计订单', description: '按内部部门推荐' },
        { key: 'history', icon: '单', label: '历史订单', description: '订单与下载记录' },
      ],
      editDrawerOpen: false,
      usersDrawerOpen: false,
      transferDrawerOpen: false,
      savingCustomer: false,
      saveError: '',
      standardRelation: null,
      priceGoods: null,
      orderDetailOpen: false,
      orderDetailLoading: false,
      orderDetailError: '',
      selectedBill: {},
      billDetail: {},
      orderLines: [],
      notice: { visible: false, text: '', type: 'success' },
      noticeTimer: null,
      detailRequestId: 0,
    };
  },
  computed: {
    disUser() { return this.$store.state.disUser || {}; },
    distributerId() { return this.disUser.nxDiuDistributerId || this.disUser.nxDistributerId || ''; },
    operatorUserId() { return this.disUser.nxDistributerUserId || this.disUser.nxDepartmentUserId || this.disUser.nxDiuUserId || ''; },
    customerCount() { return this.groups.reduce((total, group) => total + group.customers.length, 0); },
    allCustomers() { return this.groups.flatMap((group) => group.customers); },
    filteredGroups() {
      const key = this.keyword.toLowerCase();
      return this.groups.map((group) => ({
        ...group,
        customers: key ? group.customers.filter((row) => [row.nxDepartmentName, row.nxDepartmentAttrName, row.nxDepartmentOrderCode]
          .some((value) => String(value || '').toLowerCase().includes(key))) : group.customers,
      })).filter((group) => group.customers.length);
    },
    selectedLabels() {
      return this.labels.filter((label) => this.selectedLabelIds.some((id) => String(id) === String(label.nxDistributerLabelId)));
    },
    departmentCountText() {
      const count = this.customer?.nxDepartmentEntities?.length || 0;
      return count ? `${count} 个内部订货部门` : '整店订货';
    },
    orderDetailTitle() {
      const tradeNo = this.selectedBill?.nxDbTradeNo || '';
      const date = this.selectedBill?.nxDbDate || '';
      return [date, tradeNo].filter(Boolean).join(' · ') || this.displayName(this.customer);
    },
  },
  mounted() {
    this.loadCustomers();
  },
  beforeUnmount() {
    if (this.noticeTimer) window.clearTimeout(this.noticeTimer);
  },
  methods: {
    displayName(row) { return row?.nxDepartmentAttrName || row?.nxDepartmentName || '未命名客户'; },
    customerInitial(row) { return this.displayName(row).trim().charAt(0) || '客'; },
    customerSecondary(row) {
      if (row?.nxDepartmentOrderCode) return `代号 ${row.nxDepartmentOrderCode}`;
      if (row?.nxDepartmentName && row.nxDepartmentName !== row.nxDepartmentAttrName) return row.nxDepartmentName;
      const count = row?.nxDepartmentEntities?.length || row?.nxDepartmentSubAmount || 0;
      return count ? `${count} 个内部部门` : '整店客户';
    },
    async loadCustomers(preferredCustomerId = this.selectedCustomerId) {
      if (!this.distributerId) {
        this.listError = '当前账号缺少配送商信息';
        return;
      }
      this.listLoading = true;
      this.listError = '';
      try {
        const payload = ensureSuccess(
          await customerApi.listCustomers(this.distributerId, this.disUser.nxDistributerUserId),
          '客户列表加载失败',
        ) || {};
        this.groups = [
          { key: 'cash', label: '现金客户', customers: payload.settleTypeOne || [] },
          { key: 'credit', label: '记账客户', customers: payload.settleTypeTwo || [] },
        ].filter((group) => group.customers.length);
        const all = this.groups.flatMap((group) => group.customers);
        const next = all.find((row) => String(row.nxDepartmentId) === String(preferredCustomerId)) || all[0];
        if (next) await this.selectCustomer(next, true);
        else {
          this.selectedCustomerId = null;
          this.customer = null;
        }
      } catch (error) {
        this.listError = error?.message || '客户列表加载失败';
      } finally {
        this.listLoading = false;
      }
    },
    async selectCustomer(row, force = false) {
      const id = row?.nxDepartmentId;
      if (!id || (!force && String(this.selectedCustomerId) === String(id) && this.customer)) return;
      this.selectedCustomerId = id;
      this.customer = null;
      this.labels = [];
      this.selectedLabelIds = [];
      this.standardRelation = null;
      this.priceGoods = null;
      this.activeTab = 'profile';
      this.detailLoading = true;
      this.detailError = '';
      const requestId = ++this.detailRequestId;
      try {
        const [detailResponse, labelResponse] = await Promise.all([
          customerApi.getCustomer(id),
          customerApi.getLabels(this.distributerId, id),
        ]);
        const detail = ensureSuccess(detailResponse, '客户资料加载失败') || row;
        if (labelResponse?.data?.code !== 0) throw new Error(labelResponse?.data?.msg || '客户标签加载失败');
        if (requestId !== this.detailRequestId) return;
        const labelPayload = labelResponse.data.data || labelResponse.data || {};
        this.customer = detail;
        this.labels = labelPayload.labelList || [];
        this.selectedLabelIds = labelPayload.selectedLabelIds || [];
      } catch (error) {
        if (requestId !== this.detailRequestId) return;
        this.detailError = error?.message || '客户资料加载失败';
      } finally {
        if (requestId === this.detailRequestId) this.detailLoading = false;
      }
    },
    reloadSelectedCustomer() {
      const summary = this.groups.flatMap((group) => group.customers)
        .find((row) => String(row.nxDepartmentId) === String(this.selectedCustomerId));
      if (summary) this.selectCustomer(summary, true);
    },
    closeEditDrawer() {
      if (this.savingCustomer) return;
      this.editDrawerOpen = false;
      this.saveError = '';
    },
    openCustomerUsers() {
      this.editDrawerOpen = false;
      this.usersDrawerOpen = true;
    },
    openDepartmentTransfer() {
      this.editDrawerOpen = false;
      this.transferDrawerOpen = true;
    },
    async saveCustomer(payload) {
      this.savingCustomer = true;
      this.saveError = '';
      try {
        ensureSuccess(await customerApi.updateCustomer(payload.customer), '客户资料保存失败');
        ensureSuccess(
          await customerApi.syncLabels(this.distributerId, payload.customer.nxDepartmentId, payload.labelIds),
          '客户标签保存失败',
        );
        this.editDrawerOpen = false;
        this.showNotice('客户资料已保存');
        await this.loadCustomers(payload.customer.nxDepartmentId);
      } catch (error) {
        this.saveError = error?.message || '保存失败，请重试';
      } finally {
        this.savingCustomer = false;
      }
    },
    async deleteCustomer() {
      if (!window.confirm(`确定删除客户“${this.displayName(this.customer)}”？该操作可能无法恢复。`)) return;
      this.savingCustomer = true;
      this.saveError = '';
      try {
        ensureSuccess(await customerApi.deleteCustomer(this.customer), '删除客户失败');
        this.editDrawerOpen = false;
        this.selectedCustomerId = null;
        this.customer = null;
        this.showNotice('客户已删除');
        await this.loadCustomers(null);
      } catch (error) {
        this.saveError = error?.message || '删除客户失败';
      } finally {
        this.savingCustomer = false;
      }
    },
    openGoodsStandard(relation) { this.standardRelation = relation; },
    openGoodsPrice(goods) { this.priceGoods = goods; },
    handleStandardUpdated() { this.showNotice('客户商品要求已更新'); },
    handleOrderSaved() { this.showNotice('订单已创建，可到订单工作台继续处理'); },
    async openOrderDetail(bill) {
      const billId = bill?.nxDepartmentBillId;
      if (!billId) return;
      this.selectedBill = bill;
      this.billDetail = {};
      this.orderLines = [];
      this.orderDetailError = '';
      this.orderDetailOpen = true;
      this.orderDetailLoading = true;
      try {
        const data = ensureSuccess(
          await customerApi.getBillDetail(billId, this.customer.nxDepartmentId),
          '订单详情加载失败',
        ) || {};
        this.billDetail = data.bill || {};
        this.orderLines = data.bill?.nxDepartmentOrdersEntities || data.arr || [];
      } catch (error) {
        this.orderDetailError = error?.message || '订单详情加载失败';
      } finally {
        this.orderDetailLoading = false;
      }
    },
    closeOrderDetail() {
      this.orderDetailOpen = false;
      this.selectedBill = {};
      this.billDetail = {};
      this.orderLines = [];
    },
    orderGoodsName(row) {
      return row?.nxDoGoodsName || row?.nxDistributerGoodsEntity?.nxDgGoodsName || row?.nxDgGoodsName || '未命名商品';
    },
    showNotice(text, type = 'success') {
      if (this.noticeTimer) window.clearTimeout(this.noticeTimer);
      this.notice = { visible: true, text, type };
      this.noticeTimer = window.setTimeout(() => { this.notice.visible = false; }, 2800);
    },
  },
};
</script>

<style scoped>
*{box-sizing:border-box}.customer-center{height:100%;min-width:0;display:grid;grid-template-columns:278px minmax(0,1fr);gap:14px;padding:14px;overflow:hidden;background:#f2f6f4;color:#202b26}.customer-list-pane,.customer-workspace{min-height:0;background:#fff;border:1px solid #dce7e1;border-radius:14px;box-shadow:0 7px 22px rgba(39,78,61,.045)}.customer-list-pane{display:flex;flex-direction:column;overflow:hidden}.list-heading{display:flex;justify-content:space-between;align-items:center;padding:19px 18px 13px}.list-heading span{font-size:9px;letter-spacing:.14em;color:#119b5d;font-weight:900}.list-heading h2{margin:2px 0 0;font-size:20px}.list-heading>b{display:grid;place-items:center;min-width:33px;height:27px;padding:0 8px;border-radius:9px;background:#e8f6ee;color:#087b48;font-size:12px}.customer-search{margin:0 13px 12px;height:40px;display:flex;align-items:center;gap:8px;padding:0 11px;border:1px solid #d5e1db;border-radius:10px;background:#f9fbfa;color:#0a8a51}.customer-search input{width:100%;border:0;outline:0;background:transparent;font-size:13px}.customer-groups{flex:1;min-height:0;overflow-y:auto;padding:0 8px 15px}.customer-groups section+section{margin-top:13px}.customer-groups section>header{display:flex;justify-content:space-between;padding:7px 8px;color:#7d8a84;font-size:11px;font-weight:800}.customer-groups section>header small{font-size:10px}.customer-row{width:100%;display:grid;grid-template-columns:36px minmax(0,1fr) 12px;align-items:center;gap:9px;padding:9px;border:1px solid transparent;border-radius:10px;background:transparent;text-align:left;color:#34423b}.customer-row:hover{background:#f5f9f7}.customer-row.active{border-color:#cae4d6;background:#edf8f2;box-shadow:inset 3px 0 0 #119e5e}.customer-avatar{width:36px;height:36px;border-radius:10px;background:#e4f4eb;color:#087b48;display:grid;place-items:center;font-weight:900}.customer-row.active .customer-avatar{background:#119e5e;color:#fff}.customer-copy{min-width:0}.customer-copy strong,.customer-copy small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.customer-copy strong{font-size:13px}.customer-copy small{margin-top:3px;color:#8a9690;font-size:10px}.customer-row i{font-style:normal;color:#95a09b;font-size:18px}.list-state{margin:20px 10px;padding:24px 12px;text-align:center;color:#84908b;font-size:13px}.list-state.error{color:#bd424c}.list-state button,.workspace-state button{display:block;margin:12px auto 0;border:0;border-radius:8px;padding:7px 11px;background:#e8f6ee;color:#087d49;font-weight:800}.customer-workspace{display:flex;min-width:0;flex-direction:column;overflow:hidden}.workspace-state{height:100%;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#83908a}.workspace-state .state-icon{width:58px;height:58px;border-radius:18px;background:#e5f5ec;display:grid;place-items:center;color:#0a8750;font-size:20px;font-weight:900}.workspace-state h3{margin:14px 0 4px;color:#344039}.workspace-state p{margin:0}.workspace-state.error .state-icon{background:#fce8e9;color:#bf3944}.customer-summary{flex:none;display:flex;align-items:center;gap:13px;padding:16px 19px;border-bottom:1px solid #e3ebe7}.summary-avatar{width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#138d58,#1bb472);display:grid;place-items:center;color:#fff;font-size:19px;font-weight:900;box-shadow:0 7px 14px rgba(17,154,91,.18)}.summary-copy{min-width:0}.summary-name-row{display:flex;align-items:center;gap:9px}.summary-name-row h2{margin:0;font-size:21px}.summary-name-row>span{padding:4px 7px;border-radius:999px;background:#edf5f1;color:#5f6f67;font-size:10px;font-weight:800}.summary-copy p{display:flex;gap:13px;margin:5px 0 0;color:#7b8882;font-size:11px}.summary-copy p span+span:before{content:'·';margin-right:13px}.summary-actions{margin-left:auto;display:flex;gap:8px}.summary-actions button{border-radius:9px;padding:9px 13px;font-size:12px;font-weight:900}.outline-button{border:1px solid #d3dfd9;background:#fff;color:#596760}.edit-button{border:0;background:#109c5c;color:#fff}.module-tabs{flex:none;padding:10px 14px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;border-bottom:1px solid #e5ece8;background:#fbfcfb}.module-tabs button{min-width:0;display:grid;grid-template-columns:30px minmax(0,1fr);grid-template-rows:auto auto;column-gap:8px;text-align:left;border:1px solid transparent;border-radius:10px;background:transparent;padding:8px 9px;color:#506059}.module-tabs button>span{grid-row:1/3;width:30px;height:30px;border-radius:8px;background:#edf3f0;color:#5d7469;display:grid;place-items:center;font-size:10px;font-weight:900}.module-tabs strong,.module-tabs small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.module-tabs strong{font-size:12px}.module-tabs small{font-size:9px;color:#8a9690}.module-tabs button.active{border-color:#c9e5d6;background:#ebf8f1;color:#087a48}.module-tabs button.active>span{background:#12a060;color:#fff}.module-content{flex:1;min-height:0;overflow:auto;padding:17px 18px 22px;background:#f7faf8}.history-module{min-height:100%}.history-heading{display:flex;justify-content:space-between;margin-bottom:15px}.history-heading h3{margin:0 0 4px;font-size:21px}.history-heading p{margin:0;color:#77847f}.history-module :deep(.nav-tabs){border-bottom:1px solid #dce5e0}.history-module :deep(.nav-link){border:0!important;color:#627069}.history-module :deep(.nav-link.active){color:#087c49!important;font-weight:800;border-bottom:2px solid #109d5d!important;background:transparent!important}.history-module :deep(.order-item){border-color:#e0e8e4!important;border-radius:11px!important;padding:13px!important;margin-bottom:8px!important}.history-module :deep(.btn-outline-primary){color:#087c49;border-color:#9fceb6;margin-left:7px}.history-module :deep(.btn-outline-primary:hover){background:#109d5d;border-color:#109d5d}.order-detail-layer{position:fixed;inset:0;z-index:1110;background:rgba(14,30,23,.24);display:flex;justify-content:flex-end}.order-detail-drawer{width:min(720px,93vw);height:100%;background:#f5f8f6;box-shadow:-18px 0 48px rgba(20,55,42,.19);display:flex;flex-direction:column;animation:slide-in .22s ease}.order-detail-drawer>header{padding:22px 25px;background:#fff;border-bottom:1px solid #dfe8e3;display:flex;justify-content:space-between}.order-detail-drawer header>div>span{font-size:10px;letter-spacing:.13em;color:#119b5d;font-weight:900}.order-detail-drawer h3{margin:3px 0;font-size:23px}.order-detail-drawer header p{margin:0;color:#7e8b85}.order-detail-drawer header button{border:0;background:#edf3f0;border-radius:10px;width:40px;height:40px;font-size:27px;color:#526059}.detail-state{margin:24px;padding:50px;text-align:center;color:#83908a;border:1px dashed #d5dfda;border-radius:13px;background:#fff}.detail-state.error{color:#bd414b}.order-detail-body{overflow:auto;padding:20px;display:grid;gap:15px}.bill-overview{display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#fff;border:1px solid #dfe8e3;border-radius:14px;padding:18px}.bill-overview div{display:flex;flex-direction:column;gap:4px}.bill-overview span{font-size:11px;color:#85918b}.bill-overview strong{font-size:14px}.bill-total{color:#07804a;font-size:20px!important}.bill-lines{background:#fff;border:1px solid #dfe8e3;border-radius:14px;padding:18px}.bill-lines h4{margin:0 0 10px;font-size:16px}.bill-lines h4 span{font-size:11px;color:#89958f}.bill-lines article{display:grid;grid-template-columns:25px minmax(0,1fr) auto 90px;gap:10px;align-items:center;padding:12px 0;border-top:1px solid #edf1ef}.bill-lines article>b{width:24px;height:24px;border-radius:7px;background:#eef4f1;display:grid;place-items:center;font-size:10px;color:#64736c}.bill-lines article div{min-width:0}.bill-lines article div strong,.bill-lines article div small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bill-lines article div strong{font-size:13px}.bill-lines article div small{color:#8a9690;font-size:10px}.bill-lines article>span{color:#596760;font-size:12px}.bill-lines article>em{text-align:right;font-style:normal;color:#087d49;font-weight:800}.customer-notice{position:fixed;z-index:1200;top:22px;right:24px;max-width:380px;padding:12px 17px;border-radius:11px;background:#123b2a;color:#fff;box-shadow:0 12px 28px rgba(17,48,35,.22);font-size:13px;font-weight:800}.customer-notice.error{background:#b83b46}.notice-enter-active,.notice-leave-active{transition:.2s ease}.notice-enter-from,.notice-leave-to{opacity:0;transform:translateY(-8px)}@keyframes slide-in{from{opacity:.35;transform:translateX(36px)}to{opacity:1;transform:none}}@media(max-width:1350px){.customer-center{grid-template-columns:252px minmax(0,1fr)}.module-tabs button small{display:none}.module-tabs button{grid-template-rows:1fr}.module-tabs button>span{grid-row:1}.summary-copy p span:nth-child(2){display:none}}@media(max-width:1050px){.customer-center{grid-template-columns:230px minmax(0,1fr);padding:10px;gap:10px}.module-tabs{grid-template-columns:repeat(5,1fr)}.module-tabs button{display:flex;align-items:center}.module-tabs button>span{flex:none}.summary-copy p{display:none}.bill-lines article{grid-template-columns:25px minmax(0,1fr) auto}.bill-lines article>span{display:none}}
.customer-commandbar{
  flex:none;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  padding:0 26px;
  border-bottom:1px solid #dfe7e3;
  background:#fff;
}
.customer-commandbar .module-tabs{
  width:auto;
  min-width:min(820px,100%);
  display:flex;
  align-items:stretch;
  justify-content:flex-start;
  gap:30px;
  padding:0;
  border:0;
  background:transparent;
}
.customer-commandbar .module-tabs button{
  position:relative;
  display:flex;
  align-items:center;
  justify-content:center;
  flex:0 0 auto;
  min-width:112px;
  text-align:center;
  padding:16px 4px 14px;
  border:0;
  border-radius:0;
  background:transparent;
  color:#66736d;
  transition:color .18s ease;
}
.customer-commandbar .module-tabs button:hover{color:#168858}
.customer-commandbar .module-tabs strong{
  font-size:14px;
  font-weight:750;
  letter-spacing:.02em;
  white-space:nowrap;
}
.customer-commandbar .module-tabs button.active{
  border:0;
  background:transparent;
  color:#087b48;
}
.customer-commandbar .module-tabs button.active::after{
  content:'';
  position:absolute;
  left:22%;
  right:22%;
  bottom:-1px;
  height:2px;
  background:#119d5d;
  border-radius:2px 2px 0 0;
}
.customer-workspace{
  border-radius:7px;
  box-shadow:none;
}
.customer-workspace .module-content{
  padding:18px 22px 22px;
  background:#fff;
}
@media(max-width:1350px){
  .customer-commandbar{padding-inline:20px}
  .customer-commandbar .module-tabs{min-width:min(700px,100%);gap:18px}
  .customer-commandbar .module-tabs button{min-width:102px}
}
@media(max-width:1050px){
  .customer-commandbar{padding-inline:14px}
  .customer-commandbar .module-tabs{gap:8px}
  .customer-commandbar .module-tabs button{min-width:92px;padding-inline:2px}
}
</style>
