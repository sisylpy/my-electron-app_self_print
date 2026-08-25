<template>
  <section :class="['customer-context', { 'is-compact': compact }]" aria-label="下单客户">
    <div class="customer-context__intro">
      <span>下单客户</span>
      <strong>{{ selectedCustomer ? '已选择客户' : '先选择本次订单所属客户' }}</strong>
    </div>

    <div ref="pickerRoot" class="customer-context__picker">
      <label for="order-customer-search">客户</label>
      <div class="customer-context__input-wrap" :class="{ 'is-open': open }">
        <span aria-hidden="true">⌕</span>
        <input
          id="order-customer-search"
          ref="searchInput"
          v-model="query"
          type="text"
          autocomplete="off"
          :disabled="loading"
          :placeholder="loading ? '正在读取客户…' : '输入客户名称，回车选择'"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="open"
          aria-controls="order-customer-options"
          @focus="openOptions"
          @input="handleInput"
          @keydown="handleKeydown"
        >
        <button
          v-if="selectedCustomer"
          type="button"
          class="customer-context__change"
          @click="beginChange"
        >
          更换
        </button>
      </div>

      <div
        v-if="open"
        id="order-customer-options"
        class="customer-context__options"
        role="listbox"
      >
        <div v-if="loading" class="customer-context__message">正在读取客户…</div>
        <div v-else-if="error" class="customer-context__message is-error">
          <span>{{ error }}</span>
          <button type="button" @click="$emit('retry')">重试</button>
        </div>
        <template v-else-if="filteredCustomers.length">
          <button
            v-for="(customer, index) in filteredCustomers"
            :key="customerKey(customer)"
            type="button"
            role="option"
            :aria-selected="index === activeIndex"
            :class="{ 'is-active': index === activeIndex }"
            @mousemove="activeIndex = index"
            @mousedown.prevent="choose(customer)"
          >
            <span>
              <strong>{{ displayName(customer) }}</strong>
              <small v-if="departmentCount(customer)">
                {{ departmentCount(customer) }} 个部门
              </small>
            </span>
            <em>{{ customer._workbenchSettlementLabel || '客户' }}</em>
          </button>
        </template>
        <div v-else class="customer-context__message">没有找到“{{ query.trim() }}”</div>
      </div>
    </div>

    <div v-if="departments.length" class="customer-context__department">
      <label for="order-department-select">下单部门</label>
      <select
        id="order-department-select"
        :value="selectedDepartmentId"
        @change="$emit('select-department', $event.target.value)"
      >
        <option
          v-for="department in departments"
          :key="customerKey(department)"
          :value="customerKey(department)"
        >
          {{ displayName(department) }}
        </option>
      </select>
    </div>

    <div v-if="selectedCustomer" class="customer-context__selected" aria-live="polite">
      <i></i>
      <span>
        <strong>{{ displayName(selectedCustomer) }}</strong>
        <small>{{ selectedSummary }}</small>
      </span>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  customerDepartments,
  customerId,
  customerName,
} from '../../services/orderWorkbenchService';

const props = defineProps({
  customers: { type: Array, default: () => [] },
  selectedCustomer: { type: Object, default: null },
  selectedDepartmentId: { type: [Number, String], default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  compact: { type: Boolean, default: false },
});

const emit = defineEmits(['select-customer', 'select-department', 'retry']);
const pickerRoot = ref(null);
const searchInput = ref(null);
const query = ref('');
const open = ref(false);
const activeIndex = ref(0);

const departments = computed(() => customerDepartments(props.selectedCustomer));
const filteredCustomers = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  const source = keyword
    ? props.customers.filter((customer) => customerName(customer).toLocaleLowerCase().includes(keyword))
    : props.customers;
  return source.slice(0, 16);
});

const selectedSummary = computed(() => {
  const settlement = props.selectedCustomer?._workbenchSettlementLabel;
  const department = departments.value.find(
    (item) => String(customerId(item)) === String(props.selectedDepartmentId)
  );
  return [settlement, department ? customerName(department) : '整店订单'].filter(Boolean).join(' · ');
});

watch(
  () => props.selectedCustomer,
  (customer) => {
    if (customer && !open.value) query.value = customerName(customer);
  },
  { immediate: true }
);

watch(filteredCustomers, () => {
  activeIndex.value = 0;
});

function customerKey(customer) {
  return customerId(customer);
}

function displayName(customer) {
  return customerName(customer);
}

function departmentCount(customer) {
  return customerDepartments(customer).length;
}

function openOptions() {
  open.value = true;
  if (props.selectedCustomer && query.value === customerName(props.selectedCustomer)) {
    query.value = '';
  }
}

function handleInput() {
  open.value = true;
}

function choose(customer) {
  emit('select-customer', customer);
  query.value = customerName(customer);
  open.value = false;
  activeIndex.value = 0;
}

function beginChange() {
  query.value = '';
  open.value = true;
  nextTick(() => searchInput.value?.focus());
}

function handleKeydown(event) {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    open.value = true;
    activeIndex.value = Math.min(activeIndex.value + 1, filteredCustomers.value.length - 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, 0);
  } else if (event.key === 'Enter' && open.value && filteredCustomers.value.length) {
    event.preventDefault();
    choose(filteredCustomers.value[activeIndex.value] || filteredCustomers.value[0]);
  } else if (event.key === 'Escape') {
    open.value = false;
    query.value = props.selectedCustomer ? customerName(props.selectedCustomer) : '';
  }
}

function handleDocumentPointer(event) {
  if (pickerRoot.value && !pickerRoot.value.contains(event.target)) {
    open.value = false;
    query.value = props.selectedCustomer ? customerName(props.selectedCustomer) : query.value;
  }
}

onMounted(() => document.addEventListener('mousedown', handleDocumentPointer));
onBeforeUnmount(() => document.removeEventListener('mousedown', handleDocumentPointer));
</script>

<style scoped>
.customer-context {
  position: relative;
  z-index: 20;
  display: flex;
  gap: 14px;
  align-items: end;
  padding: 14px 16px;
  border: 1px solid var(--product-border);
  border-radius: var(--product-radius-lg);
  background: var(--product-surface);
  box-shadow: var(--product-shadow);
}

.customer-context__intro {
  width: 210px;
  flex: none;
}

.customer-context__intro span,
.customer-context label {
  display: block;
  margin: 0 0 6px;
  color: var(--product-text-muted);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .04em;
}

.customer-context__intro strong {
  display: block;
  color: var(--product-text);
  font-size: 13px;
}

.customer-context__picker {
  position: relative;
  min-width: 330px;
  flex: 1;
}

.customer-context__input-wrap {
  display: flex;
  height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 9px;
  border: 1px solid var(--product-border-strong);
  border-radius: var(--product-radius-md);
  background: #fff;
}

.customer-context__input-wrap.is-open,
.customer-context__input-wrap:focus-within {
  border-color: var(--product-primary);
  box-shadow: 0 0 0 3px rgba(17, 155, 93, .09);
}

.customer-context__input-wrap > span {
  color: var(--product-primary-strong);
  font-size: 18px;
}

.customer-context__input-wrap input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  color: var(--product-text);
  background: transparent;
  font-size: 13px;
}

.customer-context__change {
  flex: none;
  padding: 3px 5px;
  border: 0;
  color: var(--product-primary-strong);
  background: transparent;
  font-size: 11px;
  font-weight: 800;
}

.customer-context__options {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  left: 0;
  z-index: 100;
  overflow: auto;
  max-height: 320px;
  padding: 5px;
  border: 1px solid var(--product-border);
  border-radius: var(--product-radius-md);
  background: #fff;
  box-shadow: 0 18px 44px rgba(21, 42, 31, .14);
}

.customer-context__options > button {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 10px;
  border: 0;
  border-radius: 4px;
  text-align: left;
  background: transparent;
}

.customer-context__options > button.is-active {
  background: var(--product-primary-soft);
}

.customer-context__options span,
.customer-context__options strong,
.customer-context__options small {
  display: block;
}

.customer-context__options strong {
  color: var(--product-text);
  font-size: 12px;
}

.customer-context__options small {
  margin-top: 2px;
  color: var(--product-text-muted);
  font-size: 10px;
}

.customer-context__options em {
  flex: none;
  color: var(--product-text-secondary);
  font-size: 10px;
  font-style: normal;
}

.customer-context__message {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  color: var(--product-text-muted);
  font-size: 11px;
}

.customer-context__message.is-error {
  color: var(--product-danger);
}

.customer-context__message button {
  border: 0;
  color: var(--product-primary-strong);
  background: transparent;
  font-weight: 800;
}

.customer-context__department select {
  width: 100%;
  height: 38px;
  padding: 0 9px;
  border: 1px solid var(--product-border-strong);
  border-radius: var(--product-radius-md);
  outline: 0;
  color: var(--product-text);
  background: #fff;
  font-size: 12px;
}

.customer-context__department {
  width: 190px;
  flex: none;
}

.customer-context__department select:focus {
  border-color: var(--product-primary);
  box-shadow: 0 0 0 3px rgba(17, 155, 93, .09);
}

.customer-context__selected {
  display: flex;
  min-width: 0;
  height: 38px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid #cce5d7;
  border-radius: var(--product-radius-md);
  background: var(--product-primary-soft);
  width: 210px;
  flex: none;
}

.customer-context__selected i {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: var(--product-primary);
}

.customer-context__selected span,
.customer-context__selected strong,
.customer-context__selected small {
  display: block;
  min-width: 0;
}

.customer-context.is-compact {
  min-width: 260px;
  flex: 1;
  gap: 8px;
  align-items: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.customer-context.is-compact .customer-context__intro,
.customer-context.is-compact .customer-context__selected,
.customer-context.is-compact .customer-context__picker > label,
.customer-context.is-compact .customer-context__department > label {
  display: none;
}

.customer-context.is-compact .customer-context__picker {
  min-width: 0;
}

.customer-context.is-compact .customer-context__input-wrap,
.customer-context.is-compact .customer-context__department select {
  height: 36px;
}

.customer-context.is-compact .customer-context__department {
  width: 110px;
}

.customer-context.is-compact .customer-context__input-wrap input {
  font-size: 15px;
  font-weight: 650;
}

.customer-context.is-compact .customer-context__change {
  font-size: 12px;
}

.customer-context.is-compact .customer-context__department select {
  font-size: 14px;
  font-weight: 650;
}

.customer-context__selected strong,
.customer-context__selected small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.customer-context__selected strong {
  color: var(--product-primary-strong);
  font-size: 11px;
}

.customer-context__selected small {
  margin-top: 1px;
  color: var(--product-text-secondary);
  font-size: 9px;
}

@media (max-width: 1380px) {
  .customer-context__selected {
    display: none;
  }

  .customer-context__intro { width: 185px; }
  .customer-context__department { width: 170px; }
}
</style>
