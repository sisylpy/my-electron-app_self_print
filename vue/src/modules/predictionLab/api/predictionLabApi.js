import axiosInstance from '@/api/axios';

const quiet = { showLoading: false };

function unwrap(response, fallback) {
  const envelope = response?.data;
  if (!envelope || Number(envelope.code) !== 0) {
    throw new Error(envelope?.msg || fallback);
  }
  return envelope.data;
}

function normalizeApiError(error, fallback) {
  const status = Number(error?.response?.status);
  const serverMessage = error?.response?.data?.msg;
  if (status === 404) {
    return new Error('智能备货服务尚未启用，请联系管理员更新服务后重试');
  }
  if (status >= 500) {
    return new Error(serverMessage || '智能备货服务暂时不可用，请稍后重试');
  }
  return new Error(serverMessage || error?.message || fallback);
}

export async function getPredictionLabCatalog(distributerId, signal) {
  try {
    const response = await axiosInstance.get('purchase-prediction-lab/catalog', {
      ...quiet,
      params: { distributerId },
      signal,
      timeout: 30000,
    });
    return unwrap(response, '门店信息加载失败');
  } catch (error) {
    if (error?.name === 'CanceledError' || error?.name === 'AbortError') throw error;
    throw normalizeApiError(error, '门店信息加载失败');
  }
}

export async function getPredictionGoodsDetail(goodsId, signal) {
  try {
    const response = await axiosInstance.get(`nxdistributergoods/disGetGoods/${goodsId}`, {
      ...quiet,
      signal,
      timeout: 30000,
    });
    return unwrap(response, '商品规格读取失败');
  } catch (error) {
    if (error?.name === 'CanceledError' || error?.name === 'AbortError') throw error;
    throw normalizeApiError(error, '商品规格读取失败');
  }
}

export async function runPurchasePrediction(payload, signal) {
  try {
    const response = await axiosInstance.post('purchase-prediction-lab/runs', payload, {
      ...quiet,
      signal,
      timeout: 60000,
    });
    return unwrap(response, '智能备货数据生成失败');
  } catch (error) {
    throw normalizeApiError(error, '智能备货数据生成失败');
  }
}

export async function forecastPurchasePrediction(payload, signal) {
  try {
    const response = await axiosInstance.post('purchase-prediction-lab/forecasts', payload, {
      ...quiet,
      signal,
      timeout: 60000,
    });
    return unwrap(response, '未来智能备货数据生成失败');
  } catch (error) {
    throw normalizeApiError(error, '未来智能备货数据生成失败');
  }
}

export async function forecastReconciliationBaseline(payload, signal) {
  try {
    const response = await axiosInstance.post('purchase-prediction-lab/reconciliation-forecasts', payload, {
      ...quiet,
      signal,
      timeout: 60000,
    });
    return unwrap(response, '订单预估核对基线生成失败');
  } catch (error) {
    if (error?.name === 'CanceledError' || error?.name === 'AbortError') throw error;
    throw normalizeApiError(error, '订单预估核对基线生成失败');
  }
}

export async function comparePurchasePredictions(payload, signal) {
  try {
    const response = await axiosInstance.post('purchase-prediction-lab/comparisons', payload, {
      ...quiet,
      signal,
      timeout: 90000,
    });
    return unwrap(response, '算法比较运行失败');
  } catch (error) {
    throw normalizeApiError(error, '算法比较运行失败');
  }
}

export default {
  getCatalog: getPredictionLabCatalog,
  getGoodsDetail: getPredictionGoodsDetail,
  run: runPurchasePrediction,
  forecast: forecastPurchasePrediction,
  reconciliationForecast: forecastReconciliationBaseline,
  compare: comparePurchasePredictions,
};
