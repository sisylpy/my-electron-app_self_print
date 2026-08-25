<template>
  <section class="today-inbox" aria-label="今日订单">
    <aside class="today-inbox__customers">
      <header>
        <div>
          <span>今日待处理</span>
          <strong>{{ customers.length }} 个客户</strong>
        </div>
        <button type="button" :disabled="listLoading" title="刷新今日订单" @click="$emit('refresh-list')">
          <span :class="{ 'is-spinning': listLoading }">↻</span>
        </button>
      </header>

      <label class="today-inbox__search">
        <span aria-hidden="true">⌕</span>
        <input v-model="query" type="search" placeholder="搜索今日订单客户">
      </label>

      <div v-if="listError" class="today-inbox__notice is-error">
        <span>{{ listError }}</span>
        <button type="button" @click="$emit('refresh-list')">重新读取</button>
      </div>
      <div v-else-if="listLoading && !customers.length" class="today-inbox__notice">
        正在读取今日订单…
      </div>
      <div v-else-if="!filteredCustomers.length" class="today-inbox__notice">
        {{ query.trim() ? '没有匹配的客户' : '今天暂无待处理订单' }}
      </div>

      <div v-else class="today-inbox__list">
        <button
          v-for="(customer, index) in filteredCustomers"
          :key="customerId(customer)"
          type="button"
          :class="{ 'is-active': isSelected(customer) }"
          @click="$emit('select-customer', customer)"
        >
          <span class="today-inbox__index">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="today-inbox__customer-copy">
            <strong>{{ customerName(customer) }}</strong>
            <small>{{ customerMeta(customer) }}</small>
          </span>
          <span class="today-inbox__arrow">›</span>
        </button>
      </div>
    </aside>

    <div class="today-inbox__detail">
      <template v-if="selectedCustomer">
        <header class="today-inbox__detail-header">
          <div>
            <span>订单明细</span>
            <h2>{{ customerName(selectedCustomer) }}</h2>
          </div>
          <dl>
            <div>
              <dt>商品</dt>
              <dd>{{ snapshot.totalCount }} 项</dd>
            </div>
            <div>
              <dt>金额</dt>
              <dd>¥{{ snapshot.total.toFixed(2) }}</dd>
            </div>
            <div v-if="snapshot.tradeNo">
              <dt>单号</dt>
              <dd>{{ snapshot.tradeNo }}</dd>
            </div>
          </dl>
          <button type="button" :disabled="detailLoading" @click="$emit('refresh-detail')">
            {{ detailLoading ? '读取中…' : '刷新明细' }}
          </button>
        </header>

        <div v-if="detailError" class="today-inbox__detail-state is-error">
          <strong>订单明细暂未读取成功</strong>
          <span>{{ detailError }}</span>
          <button type="button" @click="$emit('refresh-detail')">重新读取</button>
        </div>
        <div v-else-if="detailLoading" class="today-inbox__detail-state">
          <i></i>
          <strong>正在读取订单明细</strong>
          <span>商品、数量和价格将以服务端最新数据为准</span>
        </div>
        <div v-else class="today-inbox__orders">
          <TodayOrders
            :today-order-list="snapshot.orders"
            :today-order-dep-arr="snapshot.departments"
            :today-order-trade-no="snapshot.tradeNo"
            :has-sub-departments="snapshot.hasSubDepartments"
            :selected-sub-department="null"
            :today-order-total="snapshot.total"
            :selected-all-customer="customerId(selectedCustomer)"
            :selected-customer-name="customerName(selectedCustomer)"
            :selected-customer-entity="selectedCustomer"
            :selected-customer-dep-print-name="selectedCustomer.nxDepartmentPrintName || 'ApplyPanel'"
            @order-updated="$emit('refresh-detail')"
            @order-deleted="$emit('refresh-detail')"
          />
        </div>
      </template>

      <div v-else class="today-inbox__detail-state">
        <div class="today-inbox__empty-mark">单</div>
        <strong>选择一位客户查看订单</strong>
        <span>这里集中显示今天尚未完成配送的客户订单</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import TodayOrders from '@/components/TodayOrders.vue';
import {
  customerDepartments,
  customerId,
  customerName,
} from '../../services/orderWorkbenchService';

const props = defineProps({
  customers: { type: Array, default: () => [] },
  selectedCustomer: { type: Object, default: null },
  snapshot: {
    type: Object,
    required: true,
  },
  listLoading: { type: Boolean, default: false },
  detailLoading: { type: Boolean, default: false },
  listError: { type: String, default: '' },
  detailError: { type: String, default: '' },
});

defineEmits(['select-customer', 'refresh-list', 'refresh-detail']);
const query = ref('');

const filteredCustomers = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  if (!keyword) return props.customers;
  return props.customers.filter((customer) => customerName(customer).toLocaleLowerCase().includes(keyword));
});

function isSelected(customer) {
  return String(customerId(customer)) === String(customerId(props.selectedCustomer));
}

function customerMeta(customer) {
  const departmentCount = customerDepartments(customer).length;
  if (departmentCount) return `${departmentCount} 个部门 · 待处理订单`;
  return '整店订单 · 待处理';
}
</script>

<style scoped>
.today-inbox {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: 286px minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--product-border);
  border-radius: var(--product-radius-lg);
  background: var(--product-surface);
  box-shadow: var(--product-shadow);
}

.today-inbox__customers {
  display: grid;
  min-height: 0;
  grid-template-rows: auto auto minmax(0, 1fr);
  padding: 14px 12px 12px;
  border-right: 1px solid var(--product-border);
  background: #fbfcfb;
}

.today-inbox__customers > header,
.today-inbox__detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.today-inbox__customers > header {
  padding: 0 2px 12px;
}

.today-inbox__customers > header span,
.today-inbox__customers > header strong {
  display: block;
}

.today-inbox__customers > header span {
  color: var(--product-text-muted);
  font-size: 9px;
  font-weight: 800;
}

.today-inbox__customers > header strong {
  margin-top: 2px;
  color: var(--product-text);
  font-size: 14px;
}

.today-inbox__customers > header button,
.today-inbox__detail-header > button {
  border: 1px solid var(--product-border);
  border-radius: 4px;
  color: var(--product-text-secondary);
  background: #fff;
}

.today-inbox__customers > header button {
  display: grid;
  width: 31px;
  height: 31px;
  place-items: center;
}

.is-spinning {
  display: inline-block;
  animation: today-spin .75s linear infinite;
}

.today-inbox__search {
  display: flex;
  height: 35px;
  align-items: center;
  gap: 7px;
  margin-bottom: 10px;
  padding: 0 9px;
  border: 1px solid var(--product-border);
  border-radius: 4px;
  color: var(--product-text-muted);
  background: #fff;
}

.today-inbox__search:focus-within {
  border-color: var(--product-primary);
  box-shadow: 0 0 0 2px rgba(17, 155, 93, .08);
}

.today-inbox__search input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: var(--product-text);
  background: transparent;
  font-size: 11px;
}

.today-inbox__list {
  overflow: auto;
  min-height: 0;
  padding-right: 2px;
}

.today-inbox__list > button {
  display: grid;
  width: 100%;
  grid-template-columns: 27px minmax(0, 1fr) 12px;
  gap: 8px;
  align-items: center;
  margin: 0 0 4px;
  padding: 9px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  text-align: left;
  color: var(--product-text-secondary);
  background: transparent;
}

.today-inbox__list > button:hover {
  border-color: #e2e9e5;
  background: #f6f9f7;
}

.today-inbox__list > button.is-active {
  border-color: #cce5d7;
  color: var(--product-primary-strong);
  background: var(--product-primary-soft);
  box-shadow: inset 3px 0 0 var(--product-primary);
}

.today-inbox__index {
  color: var(--product-text-muted);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}

.today-inbox__customer-copy,
.today-inbox__customer-copy strong,
.today-inbox__customer-copy small {
  display: block;
  min-width: 0;
}

.today-inbox__customer-copy strong,
.today-inbox__customer-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.today-inbox__customer-copy strong {
  color: inherit;
  font-size: 11px;
}

.today-inbox__customer-copy small {
  margin-top: 2px;
  color: var(--product-text-muted);
  font-size: 9px;
}

.today-inbox__arrow {
  color: var(--product-text-muted);
  font-size: 16px;
}

.today-inbox__notice {
  display: flex;
  min-height: 110px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 7px;
  padding: 16px;
  text-align: center;
  color: var(--product-text-muted);
  font-size: 10px;
}

.today-inbox__notice.is-error,
.today-inbox__detail-state.is-error {
  color: var(--product-danger);
}

.today-inbox__notice button,
.today-inbox__detail-state button {
  padding: 5px 9px;
  border: 1px solid currentColor;
  border-radius: 4px;
  color: inherit;
  background: #fff;
  font-size: 10px;
  font-weight: 800;
}

.today-inbox__detail {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
}

.today-inbox__detail-header {
  min-height: 66px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--product-border);
  background: #fff;
}

.today-inbox__detail-header span {
  color: var(--product-text-muted);
  font-size: 9px;
  font-weight: 800;
}

.today-inbox__detail-header h2 {
  margin: 2px 0 0;
  color: var(--product-text);
  font-size: 15px;
}

.today-inbox__detail-header dl {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: 24px;
  margin: 0;
}

.today-inbox__detail-header dl div {
  min-width: 70px;
}

.today-inbox__detail-header dt {
  color: var(--product-text-muted);
  font-size: 8px;
  font-weight: 700;
}

.today-inbox__detail-header dd {
  overflow: hidden;
  max-width: 150px;
  margin: 2px 0 0;
  color: var(--product-text-secondary);
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.today-inbox__detail-header > button {
  padding: 7px 10px;
  font-size: 10px;
  font-weight: 750;
}

.today-inbox__orders {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 10px;
}

.today-inbox__detail-state {
  display: flex;
  min-height: 0;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 7px;
  color: var(--product-text-secondary);
}

.today-inbox__detail-state > i {
  width: 28px;
  height: 28px;
  margin-bottom: 6px;
  border: 3px solid #dce7e1;
  border-top-color: var(--product-primary);
  border-radius: 50%;
  animation: today-spin .75s linear infinite;
}

.today-inbox__detail-state strong {
  color: var(--product-text);
  font-size: 13px;
}

.today-inbox__detail-state span {
  color: var(--product-text-muted);
  font-size: 10px;
}

.today-inbox__empty-mark {
  display: grid;
  width: 48px;
  height: 48px;
  margin-bottom: 6px;
  place-items: center;
  border: 1px solid #d1e5da;
  border-radius: 8px;
  color: var(--product-primary-strong);
  background: var(--product-primary-soft);
  font-size: 13px;
  font-weight: 900;
}

@keyframes today-spin {
  to { transform: rotate(360deg); }
}
</style>
