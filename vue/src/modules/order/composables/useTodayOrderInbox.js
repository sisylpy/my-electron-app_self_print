import { computed, ref } from 'vue';
import {
  customerId,
  loadCustomerTodayOrders,
  loadPendingOrderCustomers,
  orderWorkbenchError,
} from '../services/orderWorkbenchService';

function emptySnapshot() {
  return {
    orders: [],
    departments: [],
    hasSubDepartments: false,
    total: 0,
    totalCount: 0,
    tradeNo: '',
    finishCount: 0,
    hasPriceCount: 0,
    hasWeightCount: 0,
  };
}

export function useTodayOrderInbox(disUser) {
  const customers = ref([]);
  const selectedCustomer = ref(null);
  const snapshot = ref(emptySnapshot());
  const listLoading = ref(false);
  const detailLoading = ref(false);
  const listError = ref('');
  const detailError = ref('');
  let listRequestId = 0;
  let detailRequestId = 0;

  const pendingCustomerCount = computed(() => customers.value.length);

  async function refreshCustomers(options = {}) {
    const currentRequest = ++listRequestId;
    listLoading.value = true;
    listError.value = '';
    try {
      const result = await loadPendingOrderCustomers(disUser.value);
      if (currentRequest !== listRequestId) return;
      customers.value = result.customers;
      const selectedId = customerId(selectedCustomer.value);
      const nextSelection = options.keepSelection !== false && selectedId
        ? customers.value.find((customer) => String(customerId(customer)) === String(selectedId))
        : null;
      if (nextSelection) {
        selectedCustomer.value = nextSelection;
      } else if (options.selectFirst && customers.value.length > 0) {
        await selectCustomer(customers.value[0]);
      } else if (!customers.value.length) {
        selectedCustomer.value = null;
        snapshot.value = emptySnapshot();
      }
    } catch (loadError) {
      if (currentRequest !== listRequestId) return;
      customers.value = [];
      listError.value = orderWorkbenchError(loadError, '今日订单读取失败');
    } finally {
      if (currentRequest === listRequestId) listLoading.value = false;
    }
  }

  async function selectCustomer(customer) {
    selectedCustomer.value = customer || null;
    snapshot.value = emptySnapshot();
    detailError.value = '';
    if (!customer) return;
    const currentRequest = ++detailRequestId;
    detailLoading.value = true;
    try {
      const result = await loadCustomerTodayOrders(disUser.value, customer);
      if (currentRequest === detailRequestId) snapshot.value = result;
    } catch (loadError) {
      if (currentRequest === detailRequestId) {
        detailError.value = orderWorkbenchError(loadError, '订单明细读取失败');
      }
    } finally {
      if (currentRequest === detailRequestId) detailLoading.value = false;
    }
  }

  async function refreshSelected() {
    if (!selectedCustomer.value) return;
    await selectCustomer(selectedCustomer.value);
  }

  return {
    customers,
    selectedCustomer,
    snapshot,
    listLoading,
    detailLoading,
    listError,
    detailError,
    pendingCustomerCount,
    refreshCustomers,
    selectCustomer,
    refreshSelected,
  };
}
