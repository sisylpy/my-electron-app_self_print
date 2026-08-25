const ACTIVE_POLICY_LEVELS = new Set(['LEVEL_A', 'LEVEL_B']);
const REMINDER_POLICY_LEVEL = 'LEVEL_A';

/** 订单提醒目录只主动带出具有 A 级预测的客户；已有订单客户由订单链路补齐。 */
export function activeForecastDepartmentIds(run) {
  const ids = new Set();
  (Array.isArray(run?.items) ? run.items : []).forEach((item) => {
    (Array.isArray(item?.departmentForecasts) ? item.departmentForecasts : []).forEach((forecast) => {
      const level = String(forecast?.policy?.level || '').trim();
      const departmentId = forecast?.departmentId;
      if (departmentId !== null && departmentId !== undefined && level === REMINDER_POLICY_LEVEL) {
        ids.add(String(departmentId));
      }
    });
  });
  return ids;
}

/** 已有任一来源的客户可展示时，另一来源失败不能遮住整个客户目录。 */
export function blockingCustomerDirectoryError(customers, forecastError, actualOrderError) {
  if (Array.isArray(customers) && customers.length) return '';
  return forecastError || actualOrderError || '';
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function numberValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveGoodsId(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function positiveNumberValue(value) {
  const parsed = numberValue(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function normalizedGoodsName(value) {
  return cleanText(value).toLocaleLowerCase('zh-CN');
}

function profileDateValue(profile) {
  const value = cleanText(profile?.lastOrderDate).replace(/[./]/g, '-').slice(0, 10);
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(value) ? value : '';
}

function preferredCustomerGoodsProfile(left, right) {
  if (!left) return right;
  const dateCompare = profileDateValue(right).localeCompare(profileDateValue(left));
  if (dateCompare !== 0) return dateCompare > 0 ? right : left;
  const leftDays = numberValue(left?.orderDayCount) || 0;
  const rightDays = numberValue(right?.orderDayCount) || 0;
  if (rightDays !== leftDays) return rightDays > leftDays ? right : left;
  return positiveNumberValue(right?.averageOrderIntervalDays) !== null
    && positiveNumberValue(left?.averageOrderIntervalDays) === null ? right : left;
}

function customerGoodsProfiles(source) {
  const byGoodsId = new Map();
  const byGoodsName = new Map();
  (Array.isArray(source) ? source : []).forEach((profile) => {
    const goodsId = positiveGoodsId(profile?.goodsId);
    const names = [profile?.goodsName, profile?.originalGoodsName]
      .map(normalizedGoodsName).filter(Boolean);
    if (goodsId) {
      byGoodsId.set(goodsId, preferredCustomerGoodsProfile(byGoodsId.get(goodsId), profile));
    }
    names.forEach((name) => {
      const matches = byGoodsName.get(name) || [];
      matches.push(profile);
      byGoodsName.set(name, matches);
    });
  });
  return { byGoodsId, byGoodsName };
}

function customerGoodsProfile(index, goodsId, goodsName) {
  if (goodsId && index.byGoodsId.has(goodsId)) return index.byGoodsId.get(goodsId);
  const matches = index.byGoodsName.get(normalizedGoodsName(goodsName)) || [];
  return matches.length === 1 ? matches[0] : null;
}

function identity(goodsId, goodsName, unit) {
  const goodsPart = goodsId ? `ID:${goodsId}` : `NAME:${cleanText(goodsName).toLocaleLowerCase('zh-CN')}`;
  return `${goodsPart}::UNIT:${cleanText(unit)}`;
}


/**
 * 全部门预测已经在智能备货客户目录中读取过。这里把其中指定客户的预测投影出来，
 * 让右侧核对页和左侧客户筛选使用同一份服务端结果。
 */
export function selectDepartmentForecast(run, departmentId) {
  if (!run || departmentId === null || departmentId === undefined) return null;
  const expectedId = String(departmentId);
  if (run.departmentId !== null && run.departmentId !== undefined
    && String(run.departmentId) === expectedId) return run;

  const items = [];
  let departmentName = '';
  (Array.isArray(run.items) ? run.items : []).forEach((item) => {
    const department = (Array.isArray(item?.departmentForecasts) ? item.departmentForecasts : [])
      .find(forecast => String(forecast?.departmentId) === expectedId);
    if (!department) return;
    departmentName = departmentName || cleanText(department.departmentName);
    items.push({
      ...item,
      departmentId: department.departmentId,
      departmentName: department.departmentName,
      predictedQuantity: department.predictedQuantity,
      predictedUnit: department.unit || item.predictedUnit || item.unit,
      unit: department.unit || item.unit || item.predictedUnit,
      policy: department.policy || item.policy,
      dateForecasts: Array.isArray(department.dateForecasts)
        ? department.dateForecasts : item.dateForecasts,
      departmentForecasts: [department],
    });
  });

  return {
    ...run,
    departmentId: Number(departmentId),
    departmentName: departmentName || run.departmentName,
    items,
  };
}

function predictionLevel(item) {
  return cleanText(item?.policy?.level || item?.policyLevel);
}

function predictionTrust(item) {
  return numberValue(item?.policy?.trustScorePercent ?? item?.policyTrustPercent ?? item?.confidencePercent);
}

function groupPredicted(run) {
  const grouped = new Map();
  (run?.items || []).forEach((item) => {
    const level = predictionLevel(item);
    if (!ACTIVE_POLICY_LEVELS.has(level)) return;
    const goodsId = positiveGoodsId(item?.goodsId);
    const goodsName = cleanText(item?.goodsName) || '未命名商品';
    const unit = cleanText(item?.predictedUnit || item?.unit);
    const quantity = numberValue(item?.predictedQuantity);
    const key = identity(goodsId, goodsName, unit);
    const current = grouped.get(key) || {
      key,
      goodsId,
      goodsName,
      unit,
      quantity: 0,
      validQuantityCount: 0,
      level,
      trustPercent: predictionTrust(item),
      reasons: [],
      explanation: cleanText(item?.explanation),
    };
    if (quantity !== null) {
      current.quantity += quantity;
      current.validQuantityCount += 1;
    }
    if (level === 'LEVEL_A') current.level = level;
    const trust = predictionTrust(item);
    if (trust !== null) current.trustPercent = Math.max(current.trustPercent ?? 0, trust);
    current.reasons.push(...(item?.policy?.supportingReasons || []));
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).map((item) => ({
    ...item,
    quantity: item.validQuantityCount ? item.quantity : null,
    reasons: Array.from(new Set(item.reasons.map(cleanText).filter(Boolean))).slice(0, 3),
  }));
}

function snapshotOrderLines(snapshot) {
  const departments = Array.isArray(snapshot?.departments) ? snapshot.departments : [];
  if (departments.length) {
    return departments.flatMap((department) => (
      (Array.isArray(department?.depOrders) ? department.depOrders : []).map(order => ({
        order,
        departmentName: cleanText(department?.depName),
      }))
    ));
  }
  return (Array.isArray(snapshot?.orders) ? snapshot.orders : []).map(order => ({
    order,
    departmentName: '',
  }));
}

function actualGoodsId(order) {
  return positiveGoodsId(
    order?.nxDoDisGoodsId
      ?? order?.nxDistributerGoodsEntity?.nxDistributerGoodsId
  );
}

function actualGoodsName(order) {
  return cleanText(
    order?.nxDistributerGoodsEntity?.nxDgGoodsName
      || order?.nxDoGoodsName
      || order?.nxDoGoodsOriginalName
  ) || '未命名商品';
}

function actualUnit(order) {
  return cleanText(order?.nxDoStandard || order?.nxDoPrintStandard);
}

function groupActualOrders(snapshot) {
  const grouped = new Map();
  snapshotOrderLines(snapshot).forEach(({ order, departmentName }) => {
    const goodsId = actualGoodsId(order);
    const goodsName = actualGoodsName(order);
    const unit = actualUnit(order);
    const quantity = numberValue(order?.nxDoQuantity);
    const key = identity(goodsId, goodsName, unit);
    const current = grouped.get(key) || {
      key,
      goodsId,
      goodsName,
      unit,
      quantity: 0,
      lineCount: 0,
      invalidQuantityCount: 0,
      remarks: [],
      departmentNames: [],
    };
    current.lineCount += 1;
    if (quantity === null) current.invalidQuantityCount += 1;
    else current.quantity += quantity;
    const remark = cleanText(order?.nxDoRemark);
    if (remark) current.remarks.push(remark);
    if (departmentName) current.departmentNames.push(departmentName);
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).map(item => ({
    ...item,
    quantity: item.invalidQuantityCount ? null : item.quantity,
    remarks: Array.from(new Set(item.remarks)).slice(0, 3),
    departmentNames: Array.from(new Set(item.departmentNames)),
  }));
}

/**
 * 订单工作台的预估核对只在展示层合并两个独立来源：
 * 不读取当天实际订单的预测基线，以及普通订单接口返回的客户实际订单。
 */
export function buildOrderForecastReconciliation(forecastRun, snapshot, profileSource = []) {
  const predictedByKey = new Map(groupPredicted(forecastRun).map(item => [item.key, item]));
  const actualByKey = new Map(groupActualOrders(snapshot).map(item => [item.key, item]));
  const profileIndex = customerGoodsProfiles(profileSource);
  const keys = new Set([...predictedByKey.keys(), ...actualByKey.keys()]);
  const rows = Array.from(keys).map((key) => {
    const predicted = predictedByKey.get(key) || null;
    const actual = actualByKey.get(key) || null;
    const hasPrediction = Boolean(predicted);
    const hasActual = Boolean(actual);
    const goodsId = predicted?.goodsId ?? actual?.goodsId ?? null;
    const goodsName = predicted?.goodsName || actual?.goodsName || '未命名商品';
    const profile = customerGoodsProfile(profileIndex, goodsId, goodsName);
    let difference = null;
    const predictedComparable = !hasPrediction || predicted.quantity !== null;
    const actualComparable = !hasActual || actual.quantity !== null;
    if (predictedComparable && actualComparable) {
      difference = (actual?.quantity || 0) - (predicted?.quantity || 0);
    }
    const outcome = hasPrediction && hasActual
      ? 'MATCHED'
      : (hasActual ? 'MISSED' : 'NOT_ORDERED');
    return {
      key,
      goodsId,
      goodsName,
      hasPrediction,
      hasActual,
      predictedQuantity: predicted?.quantity ?? null,
      predictedUnit: predicted?.unit || actual?.unit || '',
      actualQuantity: actual?.quantity ?? null,
      actualUnit: actual?.unit || predicted?.unit || '',
      difference,
      differenceUnit: actual?.unit || predicted?.unit || '',
      policyLevel: predicted?.level || null,
      trustPercent: predicted?.trustPercent ?? null,
      outcome,
      actualLineCount: actual?.lineCount || 0,
      actualRemarks: actual?.remarks || [],
      departmentNames: actual?.departmentNames || [],
      reasons: predicted?.reasons || [],
      explanation: predicted?.explanation || '',
      averageOrderIntervalDays: positiveNumberValue(profile?.averageOrderIntervalDays),
      lastOrderDate: cleanText(profile?.lastOrderDate) || null,
    };
  });
  const outcomeOrder = { MISSED: 0, MATCHED: 1, NOT_ORDERED: 2 };
  rows.sort((left, right) => (
    (outcomeOrder[left.outcome] ?? 9) - (outcomeOrder[right.outcome] ?? 9)
      || (right.trustPercent || 0) - (left.trustPercent || 0)
      || left.goodsName.localeCompare(right.goodsName, 'zh-CN')
  ));
  return {
    rows,
    summary: {
      totalProducts: rows.length,
      predictedProducts: predictedByKey.size,
      actualProducts: actualByKey.size,
      actualLines: Array.from(actualByKey.values())
        .reduce((total, item) => total + item.lineCount, 0),
      matchedProducts: rows.filter(row => row.outcome === 'MATCHED').length,
      missedProducts: rows.filter(row => row.outcome === 'MISSED').length,
      notOrderedProducts: rows.filter(row => row.outcome === 'NOT_ORDERED').length,
    },
  };
}

/**
 * 把完整核对数据整理成用户要采取行动的三层提醒；不改变预测或实际订单原始并集。
 * B 级未下单只是不进入主动提醒，仍保留在完整 reconciliation.rows 中。
 */
export function buildOrderReminderPresentation(reconciliation) {
  const rows = Array.isArray(reconciliation?.rows) ? reconciliation.rows : [];
  const needsReminder = rows.filter(row => (
    row.outcome === 'NOT_ORDERED' && row.policyLevel === REMINDER_POLICY_LEVEL
  ));
  const predictedAndOrdered = rows.filter(row => row.outcome === 'MATCHED');
  const customerOrdered = rows.filter(row => row.outcome === 'MISSED');
  return {
    sections: [
      { key: 'REMINDER', title: '今天可能漏订', rows: needsReminder },
      { key: 'MATCHED', title: '预估已下单', rows: predictedAndOrdered },
      { key: 'CUSTOMER_ORDERED', title: '客户自订', rows: customerOrdered },
    ],
    summary: {
      reminderProducts: needsReminder.length,
      matchedProducts: predictedAndOrdered.length,
      customerOrderedProducts: customerOrdered.length,
    },
  };
}

/**
 * 正式智能备货展示服务端返回的完整 A/B 采购预估。
 * 普通订单快照和 actualOrders 不参与此处计算或抵扣。
 */
export function buildSmartReplenishmentForecast(forecastRun) {
  const rows = groupPredicted(forecastRun).map((item) => ({
    key: item.key,
    goodsId: item.goodsId,
    goodsName: item.goodsName,
    predictedQuantity: item.quantity,
    predictedUnit: item.unit,
    policyLevel: item.level,
    trustPercent: item.trustPercent,
    action: item.level === 'LEVEL_A' ? 'PREPARE' : 'CONFIRM',
    reasons: item.reasons,
    explanation: item.explanation,
  }));
  rows.sort((left, right) => (
    (left.action === right.action ? 0 : left.action === 'PREPARE' ? -1 : 1)
    || (right.trustPercent || 0) - (left.trustPercent || 0)
    || left.goodsName.localeCompare(right.goodsName, 'zh-CN')
  ));
  return {
    rows,
    summary: {
      totalProducts: rows.length,
      prepareProducts: rows.filter(row => row.action === 'PREPARE').length,
      confirmProducts: rows.filter(row => row.action === 'CONFIRM').length,
    },
  };
}

export { ACTIVE_POLICY_LEVELS };
