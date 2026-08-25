import axiosInstance from '@/api/axios';

export const ORDER_READ_ENDPOINTS = Object.freeze({
  customers: 'nxdepartment/disGetAllCustomer',
});

export async function getDistributerCustomers(disId, signal) {
  if (disId === null || disId === undefined || String(disId).trim() === '') {
    throw new Error('缺少配送商身份，无法读取客户地址');
  }
  const response = await axiosInstance.get(`${ORDER_READ_ENDPOINTS.customers}/${encodeURIComponent(disId)}`, {
    signal,
    showLoading: false,
  });
  const envelope = response?.data;
  if (!envelope || typeof envelope !== 'object' || Number(envelope.code) !== 0) {
    throw new Error(envelope?.msg || '客户地址读取失败');
  }
  return envelope.data || {};
}

