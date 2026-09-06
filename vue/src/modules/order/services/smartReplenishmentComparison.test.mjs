import test from 'node:test';
import assert from 'node:assert/strict';
import {
  activeForecastDepartmentIds,
  blockingCustomerDirectoryError,
  buildOrderForecastReconciliation,
  buildOrderReminderPresentation,
  buildSmartReplenishmentForecast,
  selectDepartmentForecast,
} from './smartReplenishmentComparison.js';

test('customer reminder directory only brings in reminder-eligible A-level departments', () => {
  const ids = activeForecastDepartmentIds({
    items: [
      {
        departmentForecasts: [
          { departmentId: 100, policy: { level: 'LEVEL_A' } },
          { departmentId: 200, policy: { level: 'LEVEL_C' } },
        ],
      },
      {
        departmentForecasts: [
          { departmentId: 300, policy: { level: 'LEVEL_B' } },
          { departmentId: null, policy: { level: 'LEVEL_A' } },
        ],
      },
      {
        departmentForecasts: [
          { departmentId: 400, policy: { level: 'LEVEL_A' }, replenishmentLifecycleStatus: 'NOT_DUE' },
          { departmentId: 500, policy: { level: 'LEVEL_A' }, replenishmentLifecycleStatus: 'ANOMALOUS' },
          { departmentId: 600, policy: { level: 'LEVEL_A' }, replenishmentLifecycleStatus: 'NORMAL_DUE' },
        ],
      },
    ],
  });

  assert.deepEqual(ids, new Set(['100', '600']));
});

test('actual-order customers remain visible when forecast directory loading fails', () => {
  assert.equal(blockingCustomerDirectoryError(
    [{ nxDepartmentId: 100 }],
    '预测目录暂时不可用',
    ''
  ), '');
  assert.equal(blockingCustomerDirectoryError(
    [],
    '预测目录暂时不可用',
    '订单目录暂时不可用'
  ), '预测目录暂时不可用');
});

test('smart replenishment uses the complete backend A/B forecast and ignores actual order fields', () => {
  const result = buildSmartReplenishmentForecast({
    actualOrders: [
      { goodsId: 99, goodsName: '不应进入结果的实际商品', quantity: 20, unit: '斤' },
    ],
    items: [
      {
        goodsId: 1,
        goodsName: '大葱',
        predictedQuantity: 30,
        predictedUnit: '斤',
        channelEvidence: { REPLENISHMENT_LIFECYCLE: { status: 'ANOMALOUS' } },
        policy: { level: 'LEVEL_A', trustScorePercent: 97.8, supportingReasons: ['订货节奏稳定'] },
      },
      {
        goodsId: 2,
        goodsName: '姜',
        predictedQuantity: 10,
        predictedUnit: '斤',
        channelEvidence: { REPLENISHMENT_LIFECYCLE: { status: 'NOT_DUE' } },
        policy: { level: 'LEVEL_B', trustScorePercent: 82.4 },
      },
      {
        goodsId: 3,
        goodsName: '已由服务端排除的商品',
        predictedQuantity: 5,
        predictedUnit: '斤',
        policy: { level: 'LEVEL_C', trustScorePercent: 50 },
      },
    ],
  });

  assert.deepEqual(result.summary, {
    totalProducts: 2,
    prepareProducts: 1,
    confirmProducts: 1,
  });
  assert.deepEqual(result.rows.map(row => row.goodsName), ['大葱', '姜']);
  assert.equal(result.rows[0].action, 'PREPARE');
  assert.equal(result.rows[1].action, 'CONFIRM');
  assert.equal(Object.hasOwn(result.rows[0], 'actualQuantity'), false);
});

test('lifecycle only suppresses un-ordered A reminders and never hides matched predictions', () => {
  const reconciliation = buildOrderForecastReconciliation({
    items: [
      {
        goodsId: 1,
        goodsName: '昨天刚订',
        predictedQuantity: 3,
        predictedUnit: '斤',
        channelEvidence: { REPLENISHMENT_LIFECYCLE: { status: 'NOT_DUE' } },
        policy: { level: 'LEVEL_A', trustScorePercent: 90 },
      },
      {
        goodsId: 2,
        goodsName: '大葱',
        predictedQuantity: 30,
        predictedUnit: '斤',
        channelEvidence: { REPLENISHMENT_LIFECYCLE: { status: 'ANOMALOUS' } },
        policy: { level: 'LEVEL_A', trustScorePercent: 98 },
      },
      {
        goodsId: 3,
        goodsName: '正常到期',
        predictedQuantity: 5,
        predictedUnit: '斤',
        channelEvidence: { REPLENISHMENT_LIFECYCLE: { status: 'NORMAL_DUE' } },
        policy: { level: 'LEVEL_A', trustScorePercent: 95 },
      },
      {
        goodsId: 4,
        goodsName: '证据不足但保留旧行为',
        predictedQuantity: 1,
        predictedUnit: '包',
        channelEvidence: { REPLENISHMENT_LIFECYCLE: { status: 'INSUFFICIENT_DATA' } },
        policy: { level: 'LEVEL_A', trustScorePercent: 88 },
      },
    ],
  }, {
    orders: [
      { nxDoDisGoodsId: 2, nxDoGoodsName: '大葱', nxDoQuantity: '25', nxDoStandard: '斤' },
    ],
    departments: [],
  });

  const presentation = buildOrderReminderPresentation(reconciliation);

  assert.deepEqual(
    presentation.sections[0].rows.map(row => row.goodsName),
    ['正常到期', '证据不足但保留旧行为']
  );
  assert.deepEqual(presentation.sections[1].rows.map(row => row.goodsName), ['大葱']);
  assert.equal(reconciliation.rows.find(row => row.goodsName === '昨天刚订').hasPrediction, true);
  assert.equal(presentation.sections.flatMap(section => section.rows)
    .some(row => row.goodsName === '昨天刚订'), false);
});

test('department projection keeps only that customer forecast', () => {
  const run = {
    businessDate: '2026-08-25',
    items: [
      {
        goodsId: 10,
        goodsName: '圆白菜',
        predictedUnit: '斤',
        policy: { level: 'LEVEL_C' },
        departmentForecasts: [
          {
            departmentId: 100,
            departmentName: '餐厅',
            predictedQuantity: 60,
            unit: '斤',
            policy: { level: 'LEVEL_A', trustScorePercent: 96 },
          },
          {
            departmentId: 200,
            departmentName: '西餐',
            predictedQuantity: 12,
            unit: '斤',
            policy: { level: 'LEVEL_B', trustScorePercent: 80 },
          },
        ],
      },
    ],
  };

  const projected = selectDepartmentForecast(run, 200);
  const result = buildSmartReplenishmentForecast(projected);

  assert.equal(projected.departmentId, 200);
  assert.equal(projected.departmentName, '西餐');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].predictedQuantity, 12);
  assert.equal(result.rows[0].policyLevel, 'LEVEL_B');
  assert.equal(result.rows[0].action, 'CONFIRM');
});

test('order reconciliation includes every actual product including missed predictions', () => {
  const result = buildOrderForecastReconciliation({
    items: [
      {
        goodsId: 1,
        goodsName: '大葱',
        predictedQuantity: 30,
        predictedUnit: '斤',
        policy: { level: 'LEVEL_A', trustScorePercent: 97.8 },
      },
      {
        goodsId: 2,
        goodsName: '姜',
        predictedQuantity: 10,
        predictedUnit: '斤',
        policy: { level: 'LEVEL_B', trustScorePercent: 82.4 },
      },
    ],
  }, {
    orders: [
      { nxDepartmentOrdersId: 11, nxDoDisGoodsId: 1, nxDoGoodsName: '大葱', nxDoQuantity: '25', nxDoStandard: '斤' },
      { nxDepartmentOrdersId: 12, nxDoDisGoodsId: 3, nxDoGoodsName: '泡腾片', nxDoQuantity: '6', nxDoStandard: '瓶' },
      { nxDepartmentOrdersId: 13, nxDoDisGoodsId: 3, nxDoGoodsName: '泡腾片', nxDoQuantity: '4', nxDoStandard: '瓶' },
    ],
    departments: [],
  });

  assert.deepEqual(result.summary, {
    totalProducts: 3,
    predictedProducts: 2,
    actualProducts: 2,
    actualLines: 3,
    matchedProducts: 1,
    missedProducts: 1,
    notOrderedProducts: 1,
  });
  const missed = result.rows.find(row => row.goodsName === '泡腾片');
  assert.equal(missed.outcome, 'MISSED');
  assert.equal(missed.predictedQuantity, null);
  assert.equal(missed.actualQuantity, 10);
  assert.equal(missed.difference, 10);
  assert.equal(missed.actualLineCount, 2);

  const matched = result.rows.find(row => row.goodsName === '大葱');
  assert.equal(matched.outcome, 'MATCHED');
  assert.equal(matched.predictedQuantity, 30);
  assert.equal(matched.actualQuantity, 25);
  assert.equal(matched.difference, -5);

  const notOrdered = result.rows.find(row => row.goodsName === '姜');
  assert.equal(notOrdered.outcome, 'NOT_ORDERED');
  assert.equal(notOrdered.actualQuantity, null);
  assert.equal(notOrdered.difference, -10);
});

test('order reminder presentation uses the three action groups and hides B-only reminders', () => {
  const reconciliation = buildOrderForecastReconciliation({
    items: [
      {
        goodsId: 1,
        goodsName: '大葱',
        predictedQuantity: 30,
        predictedUnit: '斤',
        policy: { level: 'LEVEL_A', trustScorePercent: 97.8 },
      },
      {
        goodsId: 2,
        goodsName: '姜',
        predictedQuantity: 10,
        predictedUnit: '斤',
        policy: { level: 'LEVEL_B', trustScorePercent: 82.4 },
      },
      {
        goodsId: 3,
        goodsName: '胡萝卜',
        predictedQuantity: 5,
        predictedUnit: '斤',
        policy: { level: 'LEVEL_B', trustScorePercent: 80 },
      },
    ],
  }, {
    orders: [
      { nxDoDisGoodsId: 2, nxDoGoodsName: '姜', nxDoQuantity: '8', nxDoStandard: '斤' },
      { nxDoDisGoodsId: 4, nxDoGoodsName: '黄瓜', nxDoQuantity: '6', nxDoStandard: '斤' },
    ],
    departments: [],
  });

  const presentation = buildOrderReminderPresentation(reconciliation);

  assert.deepEqual(presentation.summary, {
    reminderProducts: 1,
    matchedProducts: 1,
    customerOrderedProducts: 1,
  });
  assert.deepEqual(presentation.sections.map(section => section.title), [
    '今天可能漏订',
    '预估已下单',
    '客户自订',
  ]);
  assert.deepEqual(presentation.sections.map(section => section.rows.map(row => row.goodsName)), [
    ['大葱'],
    ['姜'],
    ['黄瓜'],
  ]);
  assert.equal(presentation.sections.flatMap(section => section.rows)
    .some(row => row.goodsName === '胡萝卜'), false);
  assert.equal(reconciliation.rows.some(row => row.goodsName === '胡萝卜'), true);
});

test('order reconciliation flattens all sub-department order groups', () => {
  const result = buildOrderForecastReconciliation({ items: [] }, {
    orders: [],
    departments: [
      {
        depName: '后厨',
        depOrders: [
          { nxDoDisGoodsId: 8, nxDoGoodsName: '土豆', nxDoQuantity: '12', nxDoStandard: '斤' },
        ],
      },
      {
        depName: '凉菜间',
        depOrders: [
          { nxDoDisGoodsId: 9, nxDoGoodsName: '黄瓜', nxDoQuantity: '5', nxDoStandard: '斤' },
        ],
      },
    ],
  });

  assert.equal(result.summary.actualProducts, 2);
  assert.equal(result.summary.actualLines, 2);
  assert.deepEqual(new Set(result.rows.map(row => row.goodsName)), new Set(['黄瓜', '土豆']));
  assert.deepEqual(
    result.rows.find(row => row.goodsName === '黄瓜').departmentNames,
    ['凉菜间']
  );
});

test('order reminder rows use customer goods profile cadence and last order date', () => {
  const result = buildOrderForecastReconciliation({
    items: [
      {
        goodsId: 18,
        goodsName: '盐',
        predictedQuantity: 1,
        predictedUnit: '件',
        policy: { level: 'LEVEL_A', trustScorePercent: 93.26 },
      },
    ],
  }, { orders: [], departments: [] }, [
    {
      goodsId: 18,
      goodsName: '盐',
      averageOrderIntervalDays: '6.9',
      lastOrderDate: '2026-08-20',
    },
  ]);

  assert.equal(result.rows[0].averageOrderIntervalDays, 6.9);
  assert.equal(result.rows[0].lastOrderDate, '2026-08-20');
});

test('today current order does not replace the last completed historical order date', () => {
  const result = buildOrderForecastReconciliation({
    items: [
      {
        goodsId: 19,
        goodsName: '花椒',
        predictedQuantity: 2,
        predictedUnit: '斤',
        policy: { level: 'LEVEL_A', trustScorePercent: 91 },
      },
    ],
  }, {
    orders: [
      {
        nxDoDisGoodsId: 19,
        nxDoGoodsName: '花椒',
        nxDoQuantity: '1',
        nxDoStandard: '斤',
        nxDoApplyDate: '2026-08-30',
      },
    ],
    departments: [],
  }, [
    {
      goodsId: 19,
      goodsName: '花椒',
      averageOrderIntervalDays: '2.5',
      lastOrderDate: '2026-08-27',
    },
  ]);

  assert.equal(result.rows[0].outcome, 'MATCHED');
  assert.equal(result.rows[0].lastOrderDate, '2026-08-27');
});

test('duplicate customer goods relations do not let a stale first relation hide recent orders', () => {
  const result = buildOrderForecastReconciliation({
    items: [
      {
        goodsId: 28,
        goodsName: '胡萝卜',
        predictedQuantity: 10,
        predictedUnit: '斤',
        policy: { level: 'LEVEL_A', trustScorePercent: 93 },
      },
    ],
  }, { orders: [], departments: [] }, [
    {
      relationId: 101,
      goodsId: 28,
      goodsName: '胡萝卜',
      orderDayCount: 1,
      averageOrderIntervalDays: null,
      lastOrderDate: '2026-06-19',
    },
    {
      relationId: 202,
      goodsId: 28,
      goodsName: '胡萝卜',
      orderDayCount: 27,
      averageOrderIntervalDays: '1.1',
      lastOrderDate: '2026-08-24',
    },
  ]);

  assert.equal(result.rows[0].averageOrderIntervalDays, 1.1);
  assert.equal(result.rows[0].lastOrderDate, '2026-08-24');
});
