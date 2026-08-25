import fixture from '../data/policyReplayFixture.json';

export const POLICY_LEVELS = Object.freeze({
  LEVEL_A: Object.freeze({
    key: 'LEVEL_A',
    badge: 'A级推荐',
    title: '高可信备货',
    description: 'AI 认为该商品高度可能需要采购',
    interaction: '强推荐 · 快速人工确认',
  }),
  LEVEL_B: Object.freeze({
    key: 'LEVEL_B',
    badge: 'B级',
    title: '需要人工确认',
    description: '存在采购可能，但历史规律或当前状态仍有不确定性',
    interaction: '辅助判断 · 人工确认',
  }),
  LEVEL_C: Object.freeze({
    key: 'LEVEL_C',
    badge: 'C级观察',
    title: '低可信商品',
    description: '默认不进入智能备货清单，仅在需要时由人工查看',
    interaction: '默认隐藏 · 人工判断',
  }),
});

function numeric(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function cleanReason(reason) {
  return String(reason || '')
    .replace(/^相对拟合样本，/, '')
    .replace(/，形成正向模型证据$/, '')
    .replace(/，形成负向条件贡献$/, '');
}

function policyMeta(item) {
  return {
    level: item.level,
    ...POLICY_LEVELS[item.level],
    trustScorePercent: numeric(item.trustScorePercent),
    supportingReasons: (item.supportingReasons || []).map(cleanReason),
    riskReasons: (item.riskReasons || []).map(cleanReason),
    evidence: item.evidence || {},
    humanConfirmationRequired: true,
    futureAutomationEligibleNow: false,
    quantityDecision: 'MANUAL_CONFIRMATION_REQUIRED',
  };
}

function fixtureItemToReplayItem(item) {
  const predicted = numeric(item.predictedQuantity);
  const actual = numeric(item.actualQuantity);
  const comparable = item.quantityComparable === true && actual !== null;
  return {
    goodsId: item.goodsId,
    goodsName: item.goodsName,
    unit: item.unit,
    predictedUnit: item.unit,
    actualUnit: actual === null ? null : item.unit,
    predictedQuantity: predicted,
    actualQuantity: actual,
    error: comparable ? predicted - actual : null,
    absoluteError: numeric(item.quantityAbsoluteError),
    unitComparable: comparable,
    outcome: item.outcome,
    policy: policyMeta(item),
  };
}

function summarize(items) {
  return Object.values(POLICY_LEVELS).map((level) => {
    const members = items.filter((item) => item.policy.level === level.key);
    const hits = members.filter((item) => item.outcome === 'HIT').length;
    const extras = members.filter((item) => item.outcome === 'EXTRA').length;
    return {
      ...level,
      count: members.length,
      hits,
      extras,
      replayPrecisionPercent: members.length ? (100 * hits) / members.length : 0,
    };
  });
}

export function buildFrozenPolicyReplayRun() {
  const items = fixture.items.map(fixtureItemToReplayItem);
  return {
    runId: 'POLICY-UX-WANGYONG-20250823',
    algorithmVersion: fixture.algorithmVersion,
    algorithmName: 'Prediction Policy Engine · V8 冻结可信分层',
    departmentId: fixture.departmentId,
    departmentName: fixture.customerLabel,
    predictionDate: fixture.predictionDate,
    historyWindowDays: 30,
    warnings: [
      '本页读取冻结策略回放，只验证桌面展示体验，不重新计算等级或可信度',
      '样本用于同时观察 A/B/C 交互，不代表整体模型指标',
      '预测数量始终需要人工确认',
    ],
    items,
    policyReplay: {
      fixtureMode: true,
      frozen: fixture.frozen,
      readOnly: fixture.readOnly,
      sourceContract: fixture.sourceContract,
      sourceReplaySha256: fixture.sourceReplaySha256,
      purpose: fixture.purpose,
      selectionReason: fixture.selectionReason,
      customerLabel: fixture.customerLabel,
      matchedItems: items.length,
      levelSummary: summarize(items),
    },
  };
}

export function attachFrozenPolicyReplay(run, context = {}) {
  if (!run || run.algorithmVersion !== fixture.algorithmVersion) return run;
  const matchesFixture = (
    Number(context.distributerId) === Number(fixture.distributerId)
    && Number(context.departmentId) === Number(fixture.departmentId)
    && context.predictionDate === fixture.predictionDate
  );
  if (!matchesFixture) return run;

  const policyByGoods = new Map(fixture.items.map((item) => [
    Number(item.goodsId),
    policyMeta(item),
  ]));
  const items = (run.items || []).map((item) => ({
    ...item,
    policy: policyByGoods.get(Number(item.goodsId)) || null,
  }));
  const matched = items.filter((item) => item.policy).length;
  const policyItems = items.filter((item) => item.policy);
  return {
    ...run,
    items,
    warnings: [
      ...(run.warnings || []),
      `已匹配冻结策略事件 ${matched}/${fixture.items.length} 条；未匹配和漏预测商品不由前端猜测等级`,
    ],
    policyReplay: {
      fixtureMode: false,
      frozen: true,
      readOnly: true,
      sourceContract: fixture.sourceContract,
      sourceReplaySha256: fixture.sourceReplaySha256,
      purpose: fixture.purpose,
      selectionReason: fixture.selectionReason,
      customerLabel: fixture.customerLabel,
      matchedItems: matched,
      levelSummary: summarize(policyItems),
    },
  };
}

export function levelConfig(level) {
  return POLICY_LEVELS[level] || POLICY_LEVELS.LEVEL_C;
}

export default {
  buildFrozenPolicyReplayRun,
  attachFrozenPolicyReplay,
  levelConfig,
};
