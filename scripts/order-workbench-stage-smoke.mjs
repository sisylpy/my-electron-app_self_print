import assert from 'node:assert/strict';
import {
  customerOrderStats,
  customerStageCount,
  customerVisibleInStage,
  isPrintableOrder,
} from '../vue/src/modules/order/services/orderWorkbenchStage.js';

const complete = { _workbenchStats: customerOrderStats({
  totalCount: 29, hasPrice: 29, hasWeight: 29, finishCount: 29,
  unDo: 0, twoSubtotal: '622.0',
}) };
const unfinished = { _workbenchStats: customerOrderStats({
  totalCount: 17, hasPrice: 1, hasWeight: 0, finishCount: 0,
  unDo: 13, twoSubtotal: '0.0',
}) };

assert.equal(complete._workbenchStats.allDone, true);
assert.equal(complete._workbenchStats.subtotalText, '622.0');
assert.equal(unfinished._workbenchStats.allDone, false);
assert.equal(unfinished._workbenchStats.needsPrice, 16);
assert.equal(customerStageCount(unfinished, 'review'), 13);
assert.equal(customerStageCount(unfinished, 'price'), 16);
assert.equal(customerStageCount(unfinished, 'ready'), 0);
assert.equal(customerVisibleInStage(unfinished, 'ready'), false);
assert.equal(customerVisibleInStage(complete, 'ready'), true);
assert.equal(customerVisibleInStage(unfinished, 'price'), true);

const printable = {
  nxDepartmentOrdersId: 1,
  nxDoStatus: 2,
  nxDoPurchaseStatus: 4,
  nxDoWeight: '3',
  nxDoPrice: '2.5',
  nxDoSubtotal: '7.5',
};
assert.equal(isPrintableOrder(printable), true);
for (const invalid of [
  { nxDoStatus: 0 },
  { nxDoPurchaseStatus: 3 },
  { nxDoWeight: '' },
  { nxDoPrice: '0.1' },
  { nxDoPrice: null },
  { nxDoSubtotal: '0' },
  { nxDepartmentOrdersId: null },
]) {
  assert.equal(isPrintableOrder({ ...printable, ...invalid }), false);
}

console.log('Order workbench stage smoke passed.');
