import { computed, ref } from 'vue';
import {
  customerDepartments,
  customerId,
  customerName,
  loadCustomerDirectory,
  orderWorkbenchError,
} from '../services/orderWorkbenchService';

export function useOrderCustomerContext(disUser) {
  const customers = ref([]);
  const selectedCustomer = ref(null);
  const selectedDepartmentId = ref(null);
  const loading = ref(false);
  const error = ref('');
  let requestId = 0;

  const selectedCustomerId = computed(() => customerId(selectedCustomer.value));
  const selectedCustomerName = computed(() => customerName(selectedCustomer.value));
  const departments = computed(() => customerDepartments(selectedCustomer.value));

  async function reload() {
    const currentRequest = ++requestId;
    loading.value = true;
    error.value = '';
    try {
      const result = await loadCustomerDirectory(disUser.value);
      if (currentRequest !== requestId) return;
      customers.value = result.customers;
      if (selectedCustomer.value) {
        const refreshed = customers.value.find(
          (customer) => String(customerId(customer)) === String(selectedCustomerId.value)
        );
        if (refreshed) selectCustomer(refreshed, { preserveDepartment: true });
      }
    } catch (loadError) {
      if (currentRequest !== requestId) return;
      customers.value = [];
      error.value = orderWorkbenchError(loadError, '客户读取失败');
    } finally {
      if (currentRequest === requestId) loading.value = false;
    }
  }

  function selectCustomer(customer, options = {}) {
    const previousDepartmentId = selectedDepartmentId.value;
    selectedCustomer.value = customer || null;
    const items = customerDepartments(customer);
    if (!customer || items.length === 0) {
      selectedDepartmentId.value = null;
      return;
    }
    const preserved = options.preserveDepartment
      ? items.find((department) => String(customerId(department)) === String(previousDepartmentId))
      : null;
    selectedDepartmentId.value = customerId(preserved || items[0]);
  }

  function selectDepartment(departmentId) {
    selectedDepartmentId.value = departmentId || null;
  }

  return {
    customers,
    departments,
    selectedCustomer,
    selectedCustomerId,
    selectedCustomerName,
    selectedDepartmentId,
    loading,
    error,
    reload,
    selectCustomer,
    selectDepartment,
  };
}
