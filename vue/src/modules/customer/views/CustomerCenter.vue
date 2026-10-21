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
        <input v-model.trim="keyword" placeholder="搜索客户或微信名称" />
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
            <span class="customer-copy">
              <strong>{{ displayName(row) }}</strong>
              <small>{{ customerWechatName(row) }}</small>
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
            :show-delivery-settings="canUseDispatchModule"
            :wechat-binding="wechatBinding"
            :wechat-binding-loading="wechatBindingLoading"
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
          <CustomerOcrTrainingPanel
            v-else-if="activeTab === 'ocr'"
            :key="`ocr-${customer.nxDepartmentId}`"
            :customer="customer"
            :distributer-id="distributerId"
            @notice="showNotice"
          />
          <div v-else class="history-module">
            <div class="history-heading">
              <div><h3>客户历史订单</h3><p>查看历史订单、下载 Excel，或按打印中心的配送单格式补打。</p></div>
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
      :show-delivery-settings="canUseDispatchModule"
      :wechat-binding="wechatBinding"
      :participates-in-auto-read="participatesInAutoRead"
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
        <header class="history-reprint-header">
          <div>
            <span>ORDER REPRINT</span>
            <h3>历史订单补打</h3>
            <p>{{ orderDetailTitle }}</p>
          </div>
          <button type="button" @click="closeOrderDetail">×</button>
        </header>
        <div v-if="orderDetailLoading" class="detail-state">正在加载订单详情…</div>
        <div v-else-if="orderDetailError" class="detail-state error">{{ orderDetailError }}</div>
        <div v-else class="history-print-preview">
          <component
            v-if="loadedHistoryPrintComponent && historyPrintData"
            :key="`customer-history-print-${selectedBill.nxDepartmentBillId}`"
            :is="loadedHistoryPrintComponent"
            :nx-dep-father-id="customer.nxDepartmentId"
            :nx-dep-id="customer.nxDepartmentId"
            :dep-name="displayName(customer)"
            :dep-print-name="historyPrintComponentName"
            :update-time="selectedBill.nxDepartmentBillId"
            :dis-id="distributerId"
            :dis-name="disUser.nxDistributerEntity?.nxDistributerName || ''"
            :gb-dep-father-id="-1"
            :gb-dep-id="-1"
            :gb-dis-id="-1"
            :gb-batch-id="-1"
            :order-data="historyPrintData"
            :is-history-order="true"
            class="history-print-component"
          />
          <div v-else class="detail-state error">打印模板加载失败，请关闭后重试</div>
        </div>
      </aside>
    </div>

    <transition name="notice">
      <div v-if="notice.visible" :class="['customer-notice', notice.type]">{{ notice.text }}</div>
    </transition>
  </div>
</template>

<script>
import { markRaw } from 'vue';
import HistoryOrders from '@/components/HistoryOrders.vue';
import customerApi from '../api/customerApi';
import {
  normalizeCustomerHistoryPrintData,
  resolveCustomerHistoryPrintComponent,
} from '../presentation/customerHistoryPrint';
import CustomerProfilePanel from '../components/CustomerProfilePanel.vue';
import CustomerEditDrawer from '../components/CustomerEditDrawer.vue';
import CustomerGoodsPanel from '../components/CustomerGoodsPanel.vue';
import CustomerGoodsStandardDrawer from '../components/CustomerGoodsStandardDrawer.vue';
import CustomerGoodsPriceDrawer from '../components/CustomerGoodsPriceDrawer.vue';
import CustomerAfterSalesPanel from '../components/CustomerAfterSalesPanel.vue';
import CustomerUsersDrawer from '../components/CustomerUsersDrawer.vue';
import CustomerDepartmentTransferDrawer from '../components/CustomerDepartmentTransferDrawer.vue';
import CustomerOcrTrainingPanel from '../components/CustomerOcrTrainingPanel.vue';
import {
  buildCustomerWechatBindingPayload,
  normalizeCustomerWechatBinding,
} from '../presentation/customerWechatBinding';
import { canAccessModule } from '@/utils/disUserRole';
import {
  applyCustomerWechatProfile,
  saveCustomerWechatProfile,
} from '@/utils/customerWechatProfile';

const historyPrintComponentLoaders = {
  ApplyPanel: () => import('@/components/Applys/ApplyPanel.vue'),
  ApplyFiftyPanel: () => import('@/components/Applys/ApplyFiftyPanel.vue'),
  ApplyHalfPanel: () => import('@/components/Applys/ApplyHalfPanel.vue'),
  ApplyHalfWholePanel: () => import('@/components/Applys/ApplyHalfWholePanel.vue'),
  ApplyThirtyPanel: () => import('@/components/Applys/ApplyThirtyPanel.vue'),
  ApplyThirtyWholePanel: () => import('@/components/Applys/ApplyThirtyWholePanel.vue'),
};

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
    CustomerUsersDrawer,
    CustomerDepartmentTransferDrawer,
    CustomerOcrTrainingPanel,
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
      wechatBinding: normalizeCustomerWechatBinding(null),
      wechatBindingLoading: false,
      participatesInAutoRead: true,
      activeTab: 'profile',
      tabs: [
        { key: 'profile', icon: '客', label: '客户资料', description: '基础与配送信息' },
        { key: 'goods', icon: '货', label: '客户商品', description: '商品与专属要求' },
        { key: 'afterSales', icon: '售', label: '售后问题', description: '按整家门店汇总' },
        { key: 'ocr', icon: '训', label: 'OCR任务', description: '正式任务与预训练' },
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
      historyPrintData: null,
      historyPrintComponentName: 'ApplyPanel',
      loadedHistoryPrintComponent: null,
      notice: { visible: false, text: '', type: 'success' },
      noticeTimer: null,
      detailRequestId: 0,
      orderDetailRequestId: 0,
    };
  },
  computed: {
    disUser() { return this.$store.state.disUser || {}; },
    // 与左侧“配送调度”入口复用同一条件，避免非平台配送商看到无效的地址与坐标设置。
    canUseDispatchModule() {
      return canAccessModule('dispatch', this.disUser, this.$store.getters.commercialPlanState);
    },
    distributerId() { return this.disUser.nxDiuDistributerId || this.disUser.nxDistributerId || ''; },
    operatorUserId() { return this.disUser.nxDistributerUserId || this.disUser.nxDepartmentUserId || this.disUser.nxDiuUserId || ''; },
    customerCount() { return this.groups.reduce((total, group) => total + group.customers.length, 0); },
    allCustomers() { return this.groups.flatMap((group) => group.customers); },
    filteredGroups() {
      const key = this.keyword.toLowerCase();
      return this.groups.map((group) => ({
        ...group,
        customers: key ? group.customers.filter((row) => [
          row.nxDepartmentName,
          row.nxDepartmentAttrName,
          row.nxDepartmentOrderCode,
          row.nxDepartmentWechatDisplayName,
        ]
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
    customerWechatName(row) {
      const name = String(row?.nxDepartmentWechatDisplayName || '').trim();
      return name ? `微信：${name}` : '微信：未绑定';
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
      this.wechatBinding = normalizeCustomerWechatBinding(null);
      this.wechatBindingLoading = true;
      this.participatesInAutoRead = true;
      this.standardRelation = null;
      this.priceGoods = null;
      this.activeTab = 'profile';
      this.detailLoading = true;
      this.detailError = '';
      const requestId = ++this.detailRequestId;
      try {
        const autoReadAction = window.electronAPI?.wechatAutoRead?.getCustomerParticipation;
        const [detailResponse, labelResponse, bindingResponse, autoReadResponse] = await Promise.all([
          customerApi.getCustomer(id),
          customerApi.getLabels(this.distributerId, id),
          customerApi.loadWechatBinding(id).catch((error) => ({
            ok: false,
            message: error?.message || '微信资料加载失败',
          })),
          typeof autoReadAction === 'function'
            ? autoReadAction(this.distributerId, id).catch(() => ({ ok: false }))
            : Promise.resolve({ ok: true, participates: true }),
        ]);
        const detail = ensureSuccess(detailResponse, '客户资料加载失败') || row;
        if (labelResponse?.data?.code !== 0) throw new Error(labelResponse?.data?.msg || '客户标签加载失败');
        if (requestId !== this.detailRequestId) return;
        const labelPayload = labelResponse.data.data || labelResponse.data || {};
        this.customer = detail;
        this.labels = labelPayload.labelList || [];
        this.selectedLabelIds = labelPayload.selectedLabelIds || [];
        this.wechatBinding = normalizeCustomerWechatBinding(
          applyCustomerWechatProfile(id, bindingResponse?.ok ? bindingResponse.data : null),
        );
        this.participatesInAutoRead = autoReadResponse?.ok
          ? autoReadResponse.participates !== false
          : true;
      } catch (error) {
        if (requestId !== this.detailRequestId) return;
        this.detailError = error?.message || '客户资料加载失败';
      } finally {
        if (requestId === this.detailRequestId) {
          this.detailLoading = false;
          this.wechatBindingLoading = false;
        }
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
        const bindingPayload = buildCustomerWechatBindingPayload(
          payload.customer.nxDepartmentId,
          this.wechatBinding,
          payload.customer.nxDepartmentWechatDisplayName,
          payload.wechatConversationKind,
          payload.wechatGroupMode,
        );
        if (bindingPayload) {
          const bindingResponse = await customerApi.saveWechatBinding(bindingPayload);
          if (!bindingResponse?.ok) {
            throw new Error(bindingResponse?.message || '微信资料保存失败');
          }
          this.wechatBinding = normalizeCustomerWechatBinding(bindingResponse.data);
        }
        // 会话类型属于客户资料：首次技术关联前服务端尚无会话指纹，先保存在
        // 当前桌面环境；读单只消费这里的设置，不再临时询问好友/群规则。
        const wechatName = String(payload.customer.nxDepartmentWechatDisplayName || '').trim();
        saveCustomerWechatProfile(payload.customer.nxDepartmentId, wechatName ? {
          conversationKind: payload.wechatConversationKind,
          groupMode: payload.wechatGroupMode,
        } : null);
        this.wechatBinding = normalizeCustomerWechatBinding(
          applyCustomerWechatProfile(payload.customer.nxDepartmentId, this.wechatBinding),
        );
        const autoReadAction = window.electronAPI?.wechatAutoRead?.setCustomerParticipation;
        if (typeof autoReadAction === 'function') {
          const autoReadResponse = await autoReadAction(
            this.distributerId,
            payload.customer.nxDepartmentId,
            payload.participatesInAutoRead,
          );
          if (!autoReadResponse?.ok) throw new Error('自动读取设置保存失败');
          this.participatesInAutoRead = autoReadResponse.participates !== false;
        }
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
    async openOrderDetail(bill) {
      const billId = bill?.nxDepartmentBillId;
      if (!billId) return;
      this.selectedBill = bill;
      this.historyPrintData = null;
      this.loadedHistoryPrintComponent = null;
      this.historyPrintComponentName = resolveCustomerHistoryPrintComponent(this.customer?.nxDepartmentPrintName);
      this.orderDetailError = '';
      this.orderDetailOpen = true;
      this.orderDetailLoading = true;
      const requestId = ++this.orderDetailRequestId;
      try {
        const [response, printComponent] = await Promise.all([
          customerApi.getBillDetail(billId, this.customer.nxDepartmentId),
          this.loadHistoryPrintComponent(this.historyPrintComponentName),
        ]);
        if (requestId !== this.orderDetailRequestId) return;
        const data = ensureSuccess(response, '订单详情加载失败') || {};
        this.historyPrintData = normalizeCustomerHistoryPrintData(data, bill);
        this.loadedHistoryPrintComponent = printComponent;
      } catch (error) {
        if (requestId === this.orderDetailRequestId) {
          this.orderDetailError = error?.message || '订单详情加载失败';
        }
      } finally {
        if (requestId === this.orderDetailRequestId) this.orderDetailLoading = false;
      }
    },
    async loadHistoryPrintComponent(componentName) {
      const resolvedName = resolveCustomerHistoryPrintComponent(componentName);
      try {
        const module = await historyPrintComponentLoaders[resolvedName]();
        return markRaw(module?.default || module);
      } catch (error) {
        if (resolvedName === 'ApplyPanel') throw new Error('打印模板加载失败');
        console.warn(`历史订单打印模板 ${resolvedName} 加载失败，回退到 ApplyPanel`, error);
        const fallback = await historyPrintComponentLoaders.ApplyPanel();
        this.historyPrintComponentName = 'ApplyPanel';
        return markRaw(fallback?.default || fallback);
      }
    },
    closeOrderDetail() {
      this.orderDetailRequestId += 1;
      this.orderDetailOpen = false;
      this.selectedBill = {};
      this.historyPrintData = null;
      this.loadedHistoryPrintComponent = null;
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
.order-detail-drawer{
  width:min(1240px,calc(100vw - 118px));
}
.order-detail-drawer>.history-reprint-header{
  flex:none;
  align-items:center;
  min-height:86px;
  padding:12px 22px;
}
.history-reprint-header>div{
  display:grid;
  grid-template-columns:auto auto;
  align-items:baseline;
  column-gap:12px;
}
.order-detail-drawer .history-reprint-header>div>span{
  grid-column:1/-1;
  font-size:9px;
}
.order-detail-drawer .history-reprint-header h3{
  margin:2px 0 0;
  font-size:21px;
  line-height:1.2;
}
.order-detail-drawer .history-reprint-header p{
  margin:0;
  font-size:12px;
  white-space:nowrap;
}
.order-detail-drawer .history-reprint-header button{
  width:34px;
  height:34px;
  border-radius:9px;
  font-size:23px;
  line-height:1;
}
.history-print-preview{
  flex:1;
  min-height:0;
  overflow:auto;
  padding:10px 14px 14px;
  background:#f5f8f6;
}
.history-print-component{
  min-height:100%;
  background:#fff;
}
.history-print-preview :deep(.applyBodyPage){
  min-height:100%!important;
  height:auto!important;
}
.history-print-preview :deep(.order-preview-actions){
  position:sticky;
  top:0;
  z-index:5;
  min-height:58px;
  align-items:center;
  padding:9px 14px!important;
  background:#fff;
  border-bottom:1px solid #e2e9e5;
}
.history-print-preview :deep(.order-preview-actions .pagination){
  margin:0;
}
.history-print-preview :deep(.order-preview-actions .btn-lg){
  padding:8px 15px;
  border-radius:7px;
  font-size:13px;
  line-height:1.2;
}

/* 高密度桌面布局：列表要承载上百位客户，外层面板直接相接，不使用卡片留白。 */
.customer-center{
  grid-template-columns:270px minmax(0,1fr);
  gap:0;
  padding:0;
  background:#fff;
}
.customer-list-pane,.customer-workspace{
  border-radius:0;
  box-shadow:none;
}
.customer-list-pane{
  border-width:0 1px 0 0;
}
.customer-workspace{
  border:0;
}
.list-heading{padding:12px 13px 8px}
.list-heading h2{font-size:18px}
.list-heading>b{height:24px;min-width:28px;border-radius:0}
.customer-search{
  height:34px;
  margin:0 10px 6px;
  padding:0 9px;
  border-radius:0;
}
.customer-groups{padding:0 0 8px}
.customer-groups section+section{margin-top:5px}
.customer-groups section>header{padding:5px 11px}
.customer-row{
  min-height:52px;
  grid-template-columns:minmax(0,1fr) 12px;
  gap:6px;
  padding:7px 10px 7px 14px;
  border-width:0 0 1px;
  border-color:#edf1ef;
  border-radius:0;
}
.customer-row.active{border-color:var(--product-border-strong);box-shadow:inset 3px 0 0 var(--product-primary)}
.customer-copy strong{font-size:15px;font-weight:750;color:var(--product-text)}
.customer-copy small{margin-top:3px;font-size:13px;font-weight:600;color:var(--product-text-secondary)}
.customer-commandbar{padding:0 18px}
.customer-workspace .module-content{padding:12px 15px 16px}
.list-heading span,.customer-search,.customer-commandbar .module-tabs button.active{color:var(--product-primary-strong)}
.list-heading>b{color:var(--product-primary-strong);background:var(--product-primary-soft)}
.customer-row.active{background:var(--product-primary-soft);box-shadow:inset 3px 0 0 var(--product-primary)}
.customer-commandbar .module-tabs button.active::after{background:var(--product-primary)}
.edit-button,.module-tabs button.active>span,.summary-avatar{background:var(--product-primary)!important}
.module-tabs button.active{border-color:var(--product-border-strong);color:var(--product-primary-strong);background:var(--product-primary-soft)}
.history-module :deep(.nav-link.active),.history-module :deep(.btn-outline-primary){color:var(--product-primary-strong)!important}
.history-module :deep(.nav-link.active){border-bottom-color:var(--product-primary)!important}
.history-module :deep(.btn-outline-primary){border-color:var(--product-border-strong)}
.history-module :deep(.btn-outline-primary:hover){border-color:var(--product-primary);background:var(--product-primary)}
@media(max-width:1050px){
  .customer-center{grid-template-columns:240px minmax(0,1fr)}
  .order-detail-drawer{width:96vw}
  .history-print-preview{padding:8px}
  .history-reprint-header>div{display:block}
  .order-detail-drawer .history-reprint-header p{margin-top:2px}
}
</style>
