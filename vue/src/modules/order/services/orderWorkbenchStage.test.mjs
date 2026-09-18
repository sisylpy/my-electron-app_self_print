import test from 'node:test';
import assert from 'node:assert/strict';
import { ordersVisibleInStage } from './orderWorkbenchStage.js';

test('ready, progress, and price show matching rows without changing all orders', () => {
  const ready = {
    nxDepartmentOrdersId: 1,
    nxDoStatus: 2,
    nxDoPurchaseStatus: 4,
    nxDoWeight: 1,
    nxDoPrice: 1,
    nxDoSubtotal: 1,
  };
  const missingPrice = { ...ready, nxDepartmentOrdersId: 2, nxDoPrice: 0 };
  const notShipped = { ...ready, nxDepartmentOrdersId: 3, nxDoStatus: 0 };
  const missingPriceAndWeight = { ...ready, nxDepartmentOrdersId: 4, nxDoPrice: null, nxDoWeight: 0 };
  const rows = [ready, missingPrice, notShipped, missingPriceAndWeight];

  assert.deepEqual(ordersVisibleInStage(rows, 'ready'), [ready]);
  assert.deepEqual(ordersVisibleInStage(rows, 'progress'), [missingPrice, notShipped, missingPriceAndWeight]);
  assert.deepEqual(ordersVisibleInStage(rows, 'price'), [missingPrice, missingPriceAndWeight]);
  assert.equal(ordersVisibleInStage(rows, 'all'), rows);
  assert.deepEqual(ordersVisibleInStage(null, 'ready'), []);
  assert.equal(rows.length, 4);
});
