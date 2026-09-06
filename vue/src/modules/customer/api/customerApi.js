import axiosInstance from '@/api/axios';
import coreApi from '@/api/all';

function formData(values) {
  const body = new URLSearchParams();
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) body.append(key, value);
  });
  return body;
}

const quiet = { showLoading: false };

export default {
  listCustomers(distributerId, responsibleUserId) {
    return axiosInstance.get(`nxdepartment/disGetAllCustomer/${distributerId}`, {
      ...quiet,
      params: responsibleUserId ? { responsibleUserId } : undefined,
    });
  },
  getCustomer(customerId) {
    return axiosInstance.get(`nxdepartment/getDepInfo/${customerId}`, quiet);
  },
  updateCustomer(customer) {
    return axiosInstance.post('nxdepartment/updateGroupName', customer);
  },
  deleteCustomer(customer) {
    return axiosInstance.post('nxdepartment/deleteGroupDep', customer);
  },
  getCustomerUsers(customerId) {
    return axiosInstance.get(`nxdepartmentuser/getDepUsersByFatherId/${customerId}`, quiet);
  },
  updateCustomerUser(user) {
    return axiosInstance.post('nxdepartmentuser/updateDepUserAdmin', user);
  },
  deleteCustomerUser(userId) {
    return axiosInstance.get(`nxdepartmentuser/deleteDepUser/${userId}`);
  },
  transferDepartment(oldDepartmentId, newDepartmentId) {
    return axiosInstance.post(
      'nxdepartment/changeDeps',
      formData({ oldDepId: oldDepartmentId, newDepId: newDepartmentId }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
  },
  getLabels(distributerId, customerId) {
    return axiosInstance.get('nxdepartmentlabel/disGetLabelData', {
      ...quiet,
      params: { disId: distributerId, depFatherId: customerId },
    });
  },
  syncLabels(distributerId, customerId, labelIds) {
    return axiosInstance.post('nxdepartmentlabel/disSyncDepartmentLabels', {
      disId: distributerId,
      depFatherId: customerId,
      labelIds,
    });
  },
  getCustomerGoods(customerId) {
    return axiosInstance.get(`nxdepartmentdisgoods/disGetDepGoods/${customerId}`, quiet);
  },
  getCustomerGoodsProfile(customerId, signal) {
    return axiosInstance.get(`nxdepartmentdisgoods/disGetDepGoodsProfile/${customerId}`, {
      ...quiet,
      signal,
    });
  },
  getCustomerGoodsHistoryPrice(customerId, goodsId) {
    return axiosInstance.post(
      'nxdepartmentorderhistory/disGetDepGoodsHistoryPrice',
      formData({ depFatherId: customerId, goodsId }),
      { ...quiet, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
  },
  updateCustomerGoodsOrderPrice(relationId, sellingPrice) {
    return axiosInstance.post(
      'nxdepartmentdisgoods/updateDepGoodsSellingPrice',
      formData({ depGoodsId: relationId, sellingPrice }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
  },
  deleteCustomerGoods(relationId) {
    return axiosInstance.get(`nxdepartmentdisgoods/deleteDepGoods/${relationId}`);
  },
  getStandardDimensions() {
    return axiosInstance.get('nxdepartmentdisgoodsstandard/dimensions', quiet);
  },
  getCurrentStandard(relationId, distributerId, operatorUserId) {
    return axiosInstance.get(`nxdepartmentdisgoodsstandard/current/${relationId}`, {
      ...quiet,
      params: { distributerId, operatorUserId },
    });
  },
  saveStandard(relationId, data) {
    return axiosInstance.post(`nxdepartmentdisgoodsstandard/save/${relationId}`, data);
  },
  getStandardHistory(relationId, distributerId, operatorUserId) {
    return axiosInstance.get(`nxdepartmentdisgoodsstandard/history/${relationId}`, {
      ...quiet,
      params: { distributerId, operatorUserId },
    });
  },
  uploadStandardImage(relationId, distributerId, operatorUserId, file) {
    const data = new FormData();
    data.append('distributerId', distributerId);
    data.append('operatorUserId', operatorUserId);
    data.append('files', file);
    return axiosInstance.post(`nxdepartmentdisgoodsstandard/uploadImages/${relationId}`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },
  searchDistributerGoods(distributerId, searchStr) {
    return axiosInstance.post(
      'nxdistributergoods/queryDisGoodsAndNxGoodsByQuickSearch',
      formData({ disId: distributerId, searchStr }),
      { ...quiet, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
  },
  updateGoodsRelation(relationId, data) {
    return axiosInstance.post(`nxdepartmentdisgoodsstandard/relation/${relationId}`, data);
  },
  getAfterSalesDictionaries() {
    return axiosInstance.get('nxdepartmentaftersales/dictionaries', quiet);
  },
  getAfterSalesList(params) {
    return axiosInstance.get('nxdepartmentaftersales/list', { ...quiet, params });
  },
  getAfterSalesDetail(afterSalesId, params) {
    return axiosInstance.get(`nxdepartmentaftersales/detail/${afterSalesId}`, { ...quiet, params });
  },
  getAiRecommendations(departmentId, page = 1, limit = 50) {
    return axiosInstance.post(
      'nxdepartmentdisgoods/disGetSubDepAiOrder',
      formData({ depId: departmentId, page, limit }),
      { ...quiet, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
  },
  saveOrder(order) {
    return coreApi.saveManulOrder(order);
  },
  getBillDetail(billId, customerId) {
    return coreApi.getBillApplys({ billId, depFatherId: customerId });
  },
  imageServerUrl() {
    return coreApi.getImageServerURL();
  },
};
