const LEVEL_META = Object.freeze({
  LEVEL_A: Object.freeze({
    key: 'LEVEL_A',
    badge: '备货',
    shortLabel: '直接备货',
    title: '高可信采购需求',
    description: '商品需求可信度较高，可优先准备；预计数量仍需人工确认。',
  }),
  LEVEL_B: Object.freeze({
    key: 'LEVEL_B',
    badge: '先确认',
    shortLabel: '联系确认',
    title: '待确认采购需求',
    description: '商品存在采购可能，先联系门店确认，再安排备货。',
  }),
});

function numeric(value) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function policyLevel(item) {
  return item?.policy?.level || item?.policyLevel || null;
}

function policyTrust(item) {
  return numeric(item?.policy?.trustScorePercent ?? item?.policyTrustPercent);
}

function levelPriority(level) {
  if (level === 'LEVEL_A') return 3;
  if (level === 'LEVEL_B') return 2;
  if (level === 'LEVEL_C') return 1;
  return 0;
}

function cleanReason(reason) {
  return String(reason || '')
    .replace(/^相对拟合样本，/, '')
    .replace(/，形成正向模型证据$/, '')
    .replace(/，形成负向条件贡献$/, '');
}

function isForwardForecast(run) {
  return run?.runMode === 'FORWARD_FORECAST';
}

function resolveLevel(item, run) {
  const value = policyLevel(item);
  if (LEVEL_META[value]) return value;
  return null;
}

function resolveTrust(item, run) {
  return policyTrust(item);
}

function resolveCategory(item) {
  const explicitLabel = item?.goodsCategoryName || item?.categoryName || item?.fatherGoodsName;
  const explicitKey = item?.goodsCategoryId || item?.categoryId || item?.fatherGoodsId;
  if (explicitLabel) {
    return {
      key: explicitKey ? `CAT_${explicitKey}` : `CAT_${explicitLabel}`,
      label: String(explicitLabel),
      icon: String(explicitLabel).trim().charAt(0) || '类',
      source: 'CATALOG',
    };
  }
  return { key: 'UNCLASSIFIED', label: '未分类', icon: '未', source: 'MISSING_CATALOG_CATEGORY' };
}

function resolveReasons(item, run) {
  const reasons = item?.policy?.supportingReasons || item?.supportingReasons || [];
  const result = reasons.map(cleanReason).filter(Boolean).slice(0, 4);
  if (!result.length && isForwardForecast(run) && item?.explanation) {
    result.push(String(item.explanation));
  }
  return result;
}

function resolveRiskReasons(item) {
  const reasons = item?.policy?.riskReasons || item?.riskReasons || [];
  return reasons.map(cleanReason).filter(Boolean).slice(0, 3);
}

export function toProcurementProduct(item, run) {
  const level = resolveLevel(item, run);
  if (!level) return null;
  const category = resolveCategory(item);
  const candidateChannels = Array.isArray(item?.candidateChannels) ? item.candidateChannels : [];
  const isRangeHint = item?.candidateTier === 'RANGE_REVIEW'
    && candidateChannels.includes('RANGE_WINDOW');
  return {
    goodsId: item.goodsId,
    goodsName: item.goodsName,
    category,
    level,
    levelMeta: LEVEL_META[level],
    statusLabel: isRangeHint ? '历史提示' : LEVEL_META[level].badge,
    isRangeHint,
    candidateTier: item?.candidateTier || '',
    candidateChannels,
    trustPercent: resolveTrust(item, run),
    predictedQuantity: numeric(item.predictedQuantity),
    predictedUnit: item.predictedUnit || item.unit || '—',
    departmentName: item.departmentName || run?.departmentName || '当前门店',
    departmentForecasts: Array.isArray(item.departmentForecasts) ? item.departmentForecasts : [],
    reasons: resolveReasons(item, run),
    riskReasons: resolveRiskReasons(item),
    quantityMethod: item.quantityMethod || '',
    forecastDateCount: Number(item.forecastDateCount || run?.forecastDateCount) || 1,
    dateForecasts: Array.isArray(item.dateForecasts) && item.dateForecasts.length
      ? item.dateForecasts
      : (run?.predictionDate && numeric(item.predictedQuantity) !== null ? [{
        date: run.predictionDate,
        quantity: numeric(item.predictedQuantity),
        unit: item.predictedUnit || item.unit || '—',
      }] : []),
    quantityConfirmationRequired: true,
    goodsDetail: item.goodsDetail || item.nxDgGoodsDetail || '',
    goodsBrand: item.goodsBrand || item.nxDgGoodsBrand || '',
    goodsStandardName: item.goodsStandardName || item.nxDgGoodsStandardname || '',
    goodsStandardWeight: item.goodsStandardWeight || item.nxDgGoodsStandardWeight || '',
    itemsPerCarton: item.itemsPerCarton || item.nxDgItemsPerCarton || '',
    cartonUnit: item.cartonUnit || item.nxDgCartonUnit || '',
  };
}

/**
 * 把同一查询范围内的多日结果汇总为商品视图。
 *
 * 这里只做展示层汇总：商品 ID 和真实订货单位必须同时相同，
 * 不重算 Policy，不把数量从一种单位换算到另一种单位。
 */
export function aggregateProcurementRuns(runs, context = {}) {
  const source = (runs || []).filter(Boolean);
  if (!source.length) return null;
  if (source.length === 1) {
    return {
      ...source[0],
      predictionEndDate: context.endDate || source[0].predictionDate,
      forecastDateCount: Number(source[0].forecastDateCount) || 1,
      departmentName: context.departmentName || source[0].departmentName,
    };
  }

  const grouped = new Map();
  source.forEach((run) => {
    (run.items || []).forEach((item) => {
      const unit = item.predictedUnit || item.unit || '—';
      const key = `${item.goodsId ?? item.goodsName}::${unit}`;
      const existing = grouped.get(key) || {
        ...item,
        predictedUnit: unit,
        unit,
        predictedQuantity: 0,
        forecastDateCount: 0,
        _trustValues: [],
        _forecastConfidenceValues: [],
        _dateForecasts: [],
        _supportingReasons: [],
        _riskReasons: [],
        _hasUnratedPolicy: false,
      };
      const quantity = numeric(item.predictedQuantity);
      if (quantity !== null) {
        existing.predictedQuantity += quantity;
        if (run.predictionDate) {
          existing._dateForecasts.push({
            date: run.predictionDate,
            quantity,
            unit,
          });
        }
      }
      existing.forecastDateCount += 1;

      const incomingLevel = policyLevel(item);
      const existingLevel = policyLevel(existing);
      if (!LEVEL_META[incomingLevel]) existing._hasUnratedPolicy = true;
      if (levelPriority(incomingLevel) > 0
        && (levelPriority(existingLevel) === 0
          || levelPriority(incomingLevel) < levelPriority(existingLevel))) {
        existing.policyLevel = incomingLevel;
        existing.policy = item.policy ? { ...item.policy } : existing.policy;
      }
      const trust = policyTrust(item);
      if (trust !== null) existing._trustValues.push(trust);
      const forecastConfidence = numeric(item.confidencePercent);
      if (forecastConfidence !== null) existing._forecastConfidenceValues.push(forecastConfidence);
      existing._supportingReasons.push(...resolveReasons(item));
      existing._riskReasons.push(...resolveRiskReasons(item));
      grouped.set(key, existing);
    });
  });

  const items = Array.from(grouped.values()).map((item) => {
    const trust = item._trustValues.length ? Math.min(...item._trustValues) : null;
    const forecastConfidence = item._forecastConfidenceValues.length
      ? Math.min(...item._forecastConfidenceValues) : numeric(item.confidencePercent);
    const supportingReasons = Array.from(new Set(item._supportingReasons)).slice(0, 4);
    const riskReasons = Array.from(new Set(item._riskReasons)).slice(0, 3);
    const effectiveLevel = item._hasUnratedPolicy ? null : policyLevel(item);
    const policy = effectiveLevel ? {
      ...(item.policy || {}),
      level: effectiveLevel,
      trustScorePercent: trust,
      supportingReasons,
      riskReasons,
    } : undefined;
    const result = {
      ...item,
      policy,
      policyLevel: effectiveLevel,
      policyTrustPercent: trust,
      confidencePercent: forecastConfidence,
      supportingReasons,
      riskReasons,
      dateForecasts: item._dateForecasts
        .slice()
        .sort((left, right) => String(left.date).localeCompare(String(right.date))),
      departmentName: context.departmentName || item.departmentName,
      quantityMethod: item.quantityMethod || `已严格按 ${item.forecastDateCount} 个日期的同商品、同单位需求汇总`,
    };
    delete result._trustValues;
    delete result._forecastConfidenceValues;
    delete result._dateForecasts;
    delete result._supportingReasons;
    delete result._riskReasons;
    delete result._hasUnratedPolicy;
    return result;
  });

  const first = source[0];
  return {
    ...first,
    runId: `PROCUREMENT-RANGE-${context.startDate || first.predictionDate}-${context.endDate || source[source.length - 1].predictionDate}`,
    predictionDate: context.startDate || first.predictionDate,
    predictionEndDate: context.endDate || source[source.length - 1].predictionDate,
    forecastDateCount: source.length,
    departmentId: context.departmentId ?? first.departmentId,
    departmentName: context.departmentName || first.departmentName,
    metrics: null,
    orderEvaluation: null,
    items,
    warnings: Array.from(new Set(source.flatMap((run) => run.warnings || []))),
  };
}

export function buildProcurementPresentation(run, departmentCount = 1) {
  const predictedProducts = (run?.items || [])
    .map((item) => toProcurementProduct(item, run))
    .filter(Boolean);
  const products = predictedProducts
    .sort((left, right) => {
      const levelOrder = left.level === right.level ? 0 : (left.level === 'LEVEL_A' ? -1 : 1);
      if (levelOrder) return levelOrder;
      return (right.trustPercent || 0) - (left.trustPercent || 0)
        || String(left.goodsName).localeCompare(String(right.goodsName), 'zh-CN');
    });

  const byLevel = Object.fromEntries(Object.keys(LEVEL_META).map((level) => [
    level,
    products.filter((item) => item.level === level),
  ]));

  return {
    products,
    byLevel,
    summary: {
      departmentCount: Math.max(0, Number(departmentCount) || 0),
      surfacedGoodsCount: products.length,
      levelACount: byLevel.LEVEL_A.length,
      levelBCount: byLevel.LEVEL_B.length,
      quantityConfirmationCount: products.length,
      hiddenOrUnclassifiedCount: Math.max(0, (run?.items?.length || 0) - products.length),
    },
  };
}

export function buildCategoryGroups(products) {
  const groups = new Map();
  products.forEach((product) => {
    const existing = groups.get(product.category.key) || {
      ...product.category,
      count: 0,
      products: [],
    };
    existing.count += 1;
    existing.products.push(product);
    groups.set(product.category.key, existing);
  });
  return Array.from(groups.values()).sort((left, right) => (
    right.count - left.count || left.label.localeCompare(right.label, 'zh-CN')
  ));
}

export function levelMeta(level) {
  return LEVEL_META[level] || LEVEL_META.LEVEL_B;
}

export { LEVEL_META };

export default {
  aggregateProcurementRuns,
  buildProcurementPresentation,
  buildCategoryGroups,
  levelMeta,
  toProcurementProduct,
};
