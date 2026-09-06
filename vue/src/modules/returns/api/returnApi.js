import axiosInstance from '@/api/axios';

const quiet = { showLoading: false };

export default {
  listPrintJobs(params) {
    return axiosInstance.get('nxdepartmentsalesreturn/print-jobs', { ...quiet, params });
  },
  getPrintPayload(printJobId, params) {
    return axiosInstance.get(`nxdepartmentsalesreturn/print-jobs/${printJobId}`, {
      ...quiet,
      params,
    });
  },
  startPrint(printJobId, data) {
    return axiosInstance.post(`nxdepartmentsalesreturn/print-jobs/${printJobId}/start`, data, quiet);
  },
  finishPrint(printJobId, data) {
    return axiosInstance.post(`nxdepartmentsalesreturn/print-jobs/${printJobId}/finish`, data, quiet);
  },
  retryPrint(printJobId, params) {
    return axiosInstance.post(`nxdepartmentsalesreturn/print-jobs/${printJobId}/retry`, null, {
      ...quiet,
      params,
    });
  },
};
