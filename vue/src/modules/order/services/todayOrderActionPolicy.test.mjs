import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTodayOrderActionPolicy,
  validateFinishOutbound,
} from './todayOrderActionPolicy.js';

test('待出库订单允许修改、换商品和完成出库', () => {
  const policy = getTodayOrderActionPolicy({
    nxDepartmentOrdersId: 10,
    nxDoStatus: 0,
    nxDoPurchaseStatus: 0,
    nxDoDisGoodsId: 20,
  });

  assert.equal(policy.canModify, true);
  assert.equal(policy.canReplaceGoods, true);
  assert.equal(policy.canFinishOutbound, true);
  assert.equal(policy.canRestock, false);
  assert.equal(policy.canInsertBefore, true);
  assert.equal(policy.canViewGoods, true);
});

test('nxDoStatus=2 的订单锁定修改和删除，只允许重新出库', () => {
  const policy = getTodayOrderActionPolicy({
    nxDepartmentOrdersId: 11,
    nxDoStatus: 2,
    nxDoPurchaseStatus: 4,
  });

  assert.equal(policy.canModify, false);
  assert.equal(policy.canDelete, false);
  assert.equal(policy.canReplaceGoods, false);
  assert.equal(policy.canFinishOutbound, false);
  assert.equal(policy.canRestock, true);
  assert.equal(policy.canFinishDelivery, true);
});

test('已送货订单只能撤回送货状态，不允许修改订单', () => {
  const policy = getTodayOrderActionPolicy({
    nxDepartmentOrdersId: 12,
    nxDoStatus: 2,
    nxDoPurchaseStatus: 5,
  });

  assert.equal(policy.canModify, false);
  assert.equal(policy.canCancelDelivery, true);
  assert.equal(policy.canFinishDelivery, false);
});

test('协作锁定订单不允许改变订单内容', () => {
  const policy = getTodayOrderActionPolicy({
    nxDepartmentOrdersId: 13,
    nxDoStatus: 0,
    nxDoPurchaseStatus: 0,
    _collaborationDemandLocked: true,
  });

  assert.equal(policy.canModify, false);
  assert.equal(policy.canReplaceGoods, false);
  assert.equal(policy.canFinishOutbound, false);
  assert.equal(policy.canInsertBefore, false);
});

test('完成出库前必须有有效出货数量和单价', () => {
  assert.equal(validateFinishOutbound({ nxDoWeight: '', nxDoPrice: 8 }), '请先填写大于 0 的出货数量');
  assert.equal(validateFinishOutbound({ nxDoWeight: 2, nxDoPrice: 0.1 }), '请先填写有效单价');
  assert.equal(validateFinishOutbound({ nxDoWeight: 2, nxDoPrice: 8 }), '');
});
