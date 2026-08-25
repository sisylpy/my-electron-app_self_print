import fixture from '../data/d64ShadowAcceptance20260822.json';

function firstActual(detail) {
  return Array.isArray(detail.actualQuantities) && detail.actualQuantities.length
    ? detail.actualQuantities[0]
    : null;
}

function toReplayItem(detail) {
  const actual = firstActual(detail);
  const unit = detail.predictedStandard || actual?.standard || '份';
  return {
    goodsId: detail.goodsId,
    goodsName: detail.goodsName,
    unit,
    predictedUnit: detail.predictedStandard,
    actualUnit: detail.standardComparable ? detail.predictedStandard : actual?.standard,
    predictedQuantity: detail.predictedQuantity,
    actualQuantity: detail.standardComparable ? actual?.quantity : (detail.actualQuantities?.length === 1 ? actual?.quantity : null),
    actualQuantities: detail.actualQuantities || [],
    error: detail.quantityError,
    absoluteError: detail.quantityAbsoluteError,
    unitComparable: detail.standardComparable,
    outcome: detail.outcome,
    confidencePercent: detail.v8ConfidencePercent,
    candidateTier: detail.replenishmentState,
    candidateRank: detail.candidateRank,
    policyLevel: detail.policyLevel,
    policyTrustPercent: detail.policyTrustPercent,
    supportingReasons: detail.supportingReasons || [],
    riskReasons: detail.riskReasons || [],
    quantityMethod: detail.quantityMethod,
    explanation: detail.v8Explanation,
  };
}

export function buildD64ShadowAcceptanceRun() {
  const runtime = fixture.frozenRuntime;
  const metrics = fixture.metrics;
  return {
    runId: fixture.acceptanceId,
    algorithmVersion: runtime.algorithmVersion,
    algorithmName: 'Prediction V8 + Policy · 现场 Shadow 验收',
    distributerId: fixture.scope.distributerId,
    distributerName: fixture.scope.distributerName,
    departmentId: fixture.scope.departmentId,
    departmentName: fixture.scope.departmentName,
    predictionDate: fixture.dateSemantics.businessDeliveryDate,
    modelOrderDate: fixture.dateSemantics.modelOrderDate,
    historyWindowDays: runtime.historyWindowDays,
    trainingStartDate: runtime.trainingStartDate,
    trainingEndDate: runtime.trainingEndDate,
    trainingLineCount: runtime.trainingLineCount,
    trainingGoodsCount: runtime.trainingGoodsCount,
    actualLineCount: fixture.truthSnapshot.orderLineCount,
    items: fixture.details.map(toReplayItem),
    metrics: {
      ...metrics,
      mae: metrics.sameStandardQuantityMae,
      rmse: metrics.sameStandardQuantityRmse,
      scorable: true,
      score: null,
    },
    orderEvaluation: {
      ...runtime.orderPrediction,
      actualOrder: fixture.truthSnapshot.actualGoodsCount > 0,
      outcome: runtime.orderPrediction.predictedOrder && fixture.truthSnapshot.actualGoodsCount > 0 ? 'TP' : 'FN',
      daysSinceLastOrder: 1,
      typicalCycleDays: 1,
    },
    warnings: [
      '业务目标是 8 月 22 日配送；真实答案来自 8 月 21 日创建的订单，21 日订单未进入训练',
      '预测先冻结并校验后才读取真实订单；未根据答案调整 V8、Policy、阈值或数量模型',
      '当天尚未完成履约，本次只评价商品、quantity 与 standard，weight 不作为主要真值',
    ],
    liveShadowAcceptance: {
      frozen: true,
      readOnly: true,
      acceptanceId: fixture.acceptanceId,
      tradeNo: fixture.truthSnapshot.tradeNo,
      scoredAt: fixture.scoredAt,
      dateSemantics: fixture.dateSemantics,
      freezeVerification: fixture.freezeVerification,
      policyReplay: fixture.policyReplay,
      weightDisplayed: false,
    },
  };
}

export default { buildD64ShadowAcceptanceRun };
