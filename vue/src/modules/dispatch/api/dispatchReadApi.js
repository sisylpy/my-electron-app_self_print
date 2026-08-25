import axiosInstance from '@/api/axios';

export const DISPATCH_READ_ENDPOINTS = Object.freeze({
  dispatch: 'nxdisroutedispatch/dispatch/sandbox/today',
  loading: 'nxdisroutedispatch/dispatch/loading/today',
  delivery: 'nxdisroutedispatch/delivery/today',
  drivers: 'nxdisroutedispatch/drivers/available',
});

function cleanParams(params) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
}

function assertDistributerId(disId) {
  if (disId === null || disId === undefined || String(disId).trim() === '') {
    throw new Error('缺少配送商身份，无法读取调度数据');
  }
}

function unwrapEnvelope(response, sourceLabel) {
  const envelope = response?.data;
  if (!envelope || typeof envelope !== 'object') {
    throw new Error(`${sourceLabel}返回格式无效`);
  }
  if (Number(envelope.code) !== 0) {
    throw new Error(envelope.msg || `${sourceLabel}读取失败`);
  }
  return envelope.data;
}

function assertPageViewModel(data, sourceLabel) {
  if (!data || typeof data !== 'object' || !data.pageViewModel || typeof data.pageViewModel !== 'object') {
    throw new Error(`${sourceLabel}缺少 pageViewModel`);
  }
  return data.pageViewModel;
}

async function getDispatchPage(endpoint, sourceLabel, context, signal) {
  assertDistributerId(context.disId);
  const response = await axiosInstance.get(endpoint, {
    params: cleanParams({
      disId: context.disId,
      routeDate: context.routeDate,
      batchCode: context.batchCode || 'MORNING',
      operatorUserId: context.operatorUserId,
    }),
    signal,
    showLoading: false,
  });
  return assertPageViewModel(unwrapEnvelope(response, sourceLabel), sourceLabel);
}

export function getDispatchToday(context, signal) {
  return getDispatchPage(DISPATCH_READ_ENDPOINTS.dispatch, '今日待派订单', context, signal);
}

export function getLoadingToday(context, signal) {
  return getDispatchPage(DISPATCH_READ_ENDPOINTS.loading, '今日装车路线', context, signal);
}

export function getDeliveryToday(context, signal) {
  return getDispatchPage(DISPATCH_READ_ENDPOINTS.delivery, '今日配送路线', {
    ...context,
    operatorUserId: undefined,
  }, signal);
}

export async function getAvailableDrivers(context, signal) {
  assertDistributerId(context.disId);
  const response = await axiosInstance.get(DISPATCH_READ_ENDPOINTS.drivers, {
    params: cleanParams({
      disId: context.disId,
      routeDate: context.routeDate,
      batchCode: context.batchCode || 'MORNING',
    }),
    signal,
    showLoading: false,
  });
  const data = unwrapEnvelope(response, '司机列表');
  if (!data || typeof data !== 'object' || !Array.isArray(data.driverCards)) {
    throw new Error('司机列表返回格式无效');
  }
  return data;
}

