import orderApi from './orderApi';
import predictionLabApi from '../../predictionLab/api/predictionLabApi';
import { activeForecastDepartmentIds } from './smartReplenishmentComparison';

const STABLE_PREDICTION_BASELINE = 'V8_REPLENISHMENT_STATE';

function requireSuccess(response, fallbackMessage) {
  const envelope = response?.data;
  if (!envelope || typeof envelope !== 'object' || Number(envelope.code) !== 0) {
    throw new Error(envelope?.msg || envelope?.message || fallbackMessage);
  }
  return envelope;
}

export function customerId(customer) {
  return customer?.nxDepartmentId ?? customer?.departmentId ?? null;
}

export function customerName(customer) {
  return customer?.nxDepartmentAttrName
    || customer?.nxDepartmentName
    || customer?.departmentName
    || '未命名客户';
}

export function customerDepartments(customer) {
  return Array.isArray(customer?.nxDepartmentEntities)
    ? customer.nxDepartmentEntities
    : [];
}

function decorateCustomers(customers, settlementType, settlementLabel) {
  return (Array.isArray(customers) ? customers : [])
    .filter((customer) => customerId(customer) !== null)
    .map((customer) => ({
      ...customer,
      _workbenchSettlementType: settlementType,
      _workbenchSettlementLabel: settlementLabel,
    }));
}

export function normalizeCustomerDirectory(payload) {
  const cash = decorateCustomers(payload?.settleTypeOne, 'cash', '现金');
  const credit = decorateCustomers(payload?.settleTypeTwo, 'credit', '记账');
  return [...cash, ...credit];
}

export async function loadCustomerDirectory(disUser) {
  const disId = disUser?.nxDiuDistributerId;
  if (!disId) throw new Error('缺少配送商信息，无法读取客户');
  const response = await orderApi.disGetAllCustomer(disId, disUser?.nxDistributerUserId);
  const envelope = requireSuccess(response, '客户读取失败');
  return {
    customers: normalizeCustomerDirectory(envelope.data || {}),
    taskCount: Number(envelope.taskCount) || 0,
  };
}

/**
 * 订单提醒左侧补充展示当前营业日存在 A 级提醒基线的客户。
 * 普通订单客户和实际订单快照由订单工作台原有链路负责，不参与预估客户筛选。
 */
export async function loadSmartReplenishmentCustomerDirectory(disUser) {
  const disId = disUser?.nxDiuDistributerId;
  if (!disId) throw new Error('缺少配送商信息，无法读取订单提醒客户');
  const [response, predictionCatalog] = await Promise.all([
    orderApi.disGetAllCustomer(disId),
    predictionLabApi.getCatalog(Number(disId)),
  ]);
  const date = predictionCatalog.businessDate;
  const forecastRun = await predictionLabApi.reconciliationForecast({
    distributerId: Number(disId),
    departmentId: null,
    predictionDate: date,
    predictionEndDate: date,
    historyWindowDays: 30,
    algorithmVersion: STABLE_PREDICTION_BASELINE,
  });
  const envelope = requireSuccess(response, '订单提醒客户读取失败');
  const forecastDepartmentIds = activeForecastDepartmentIds(forecastRun);
  return {
    customers: normalizeCustomerDirectory(envelope.data || {})
      .filter(customer => forecastDepartmentIds.has(String(customerId(customer))))
      .map(customer => ({
        ...customer,
        _smartReplenishmentState: 'FORECAST_AVAILABLE',
      })),
    businessDate: date,
  };
}

export async function loadPendingOrderCustomers(disUser) {
  const disId = disUser?.nxDiuDistributerId;
  if (!disId) throw new Error('缺少配送商信息，无法读取今日订单');
  const response = await orderApi.webNxDisGetTodayOrderCustomer(disId);
  const envelope = requireSuccess(response, '今日订单客户读取失败');
  const data = envelope.data || {};
  return {
    customers: Array.isArray(data.nxArr) ? data.nxArr : [],
    cooperativeBatches: Array.isArray(data.gbBatchArr) ? data.gbBatchArr : [],
    taskCount: Number(envelope.taskCount) || 0,
  };
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeActiveCustomer(entry) {
  const customer = entry?.dep;
  if (!customer || customerId(customer) === null) return null;
  const stats = {
    needsReview: numberValue(entry?.unDo),
    total: numberValue(entry?.totalCount),
    weighted: numberValue(entry?.hasWeight),
    priced: numberValue(entry?.hasPrice),
    readyToPrint: numberValue(entry?.finishCount),
    readySubtotal: numberValue(entry?.twoSubtotal),
  };
  stats.inProgress = Math.max(0, stats.total - stats.readyToPrint);
  return {
    ...customer,
    _workbenchStats: stats,
  };
}

export async function loadOrderWorkbenchOverview(disUser) {
  const disId = disUser?.nxDiuDistributerId;
  if (!disId) throw new Error('缺少配送商信息，无法读取订单工作台');
  const response = await orderApi.disGetTodayOrderCustomer(disId);
  const envelope = requireSuccess(response, '订单工作台读取失败');
  const payload = envelope.data || {};
  const ownCustomers = Array.isArray(payload?.deps?.nxDep) ? payload.deps.nxDep : [];
  const customers = ownCustomers.map(normalizeActiveCustomer).filter(Boolean);
  const tasks = Array.isArray(payload?.taskArr) ? payload.taskArr : [];
  const totals = customers.reduce((summary, customer) => {
    const stats = customer._workbenchStats;
    summary.needsReview += stats.needsReview;
    summary.inProgress += stats.inProgress;
    summary.readyToPrint += stats.readyToPrint;
    return summary;
  }, { needsReview: 0, inProgress: 0, readyToPrint: 0 });
  return { customers, tasks, totals };
}

function hasDepartmentGroups(items) {
  const first = Array.isArray(items) ? items[0] : null;
  return Boolean(first && (
    Object.prototype.hasOwnProperty.call(first, 'depOrders')
    || Object.prototype.hasOwnProperty.call(first, 'depName')
  ));
}

export function normalizeTodayOrderSnapshot(payload) {
  const items = Array.isArray(payload?.arr) ? payload.arr : [];
  const grouped = hasDepartmentGroups(items);
  return {
    orders: grouped ? [] : items,
    departments: grouped
      ? items.map((department) => ({
        ...department,
        depOrders: Array.isArray(department?.depOrders) ? department.depOrders : [],
      }))
      : [],
    hasSubDepartments: grouped,
    total: Number.parseFloat(payload?.total) || 0,
    totalCount: Number.parseInt(payload?.totalCount, 10) || 0,
    tradeNo: payload?.tradeNo || '',
    finishCount: Number(payload?.finishCount) || 0,
    hasPriceCount: Number(payload?.hasPriceCount) || 0,
    hasWeightCount: Number(payload?.hasWeightCount) || 0,
  };
}

export async function loadCustomerTodayOrders(disUser, customer) {
  const disId = disUser?.nxDiuDistributerId;
  const depFatherId = customerId(customer);
  if (!disId || !depFatherId) throw new Error('缺少客户信息，无法读取订单明细');
  const response = await orderApi.phoneGetToFillDepOrders({
    depFatherId,
    gbDepFatherId: customer?.gbDepFatherId || -1,
    resFatherId: customer?.resFatherId || -1,
    disId,
  });
  const envelope = requireSuccess(response, '订单明细读取失败');
  return normalizeTodayOrderSnapshot(envelope.data || {});
}

export function orderWorkbenchError(error, fallback = '读取失败，请稍后重试') {
  return error?.response?.data?.msg
    || error?.response?.data?.message
    || error?.message
    || fallback;
}
