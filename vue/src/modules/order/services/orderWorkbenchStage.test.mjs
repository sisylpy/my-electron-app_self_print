import test from 'node:test';
import assert from 'node:assert/strict';
import { ordersVisibleInStage, orderStatusSummary } from './orderWorkbenchStage.js';

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
  const awaitingConfirmation = { ...ready, nxDepartmentOrdersId: 5, nxDoStatus: -2, nxDoPrice: null };
  const cancelled = { ...ready, nxDepartmentOrdersId: 6, nxDoStatus: -1, nxDoPrice: null };
  const unknownStatus = { ...ready, nxDepartmentOrdersId: 7, nxDoStatus: null, nxDoPrice: null };
  const rows = [ready, missingPrice, notShipped, missingPriceAndWeight, awaitingConfirmation, cancelled, unknownStatus];

  assert.deepEqual(ordersVisibleInStage(rows, 'ready'), [ready]);
  assert.deepEqual(ordersVisibleInStage(rows, 'progress'), [missingPrice, notShipped, missingPriceAndWeight]);
  assert.deepEqual(ordersVisibleInStage(rows, 'price'), [missingPrice, missingPriceAndWeight]);
  assert.equal(ordersVisibleInStage(rows, 'all'), rows);
  assert.deepEqual(ordersVisibleInStage(null, 'ready'), []);
  assert.equal(rows.length, 7);
});

test('order status summary is safe to render in the stable workbench header', () => {
  const printable = {
    nxDepartmentOrdersId: 1,
    nxDoStatus: 2,
    nxDoPurchaseStatus: 4,
    nxDoWeight: 1,
    nxDoPrice: 1,
    nxDoSubtotal: 1,
  };
  assert.deepEqual(orderStatusSummary([
    { nxDoStatus: -2 },
    { nxDoStatus: 0 },
    printable,
    { ...printable, nxDepartmentOrdersId: 2, nxDoWeight: 0 },
  ]), {
    awaitingConfirmation: 1,
    inProgress: 1,
    completed: 2,
    printable: 1,
  });
  assert.deepEqual(orderStatusSummary(null), {
    awaitingConfirmation: 0,
    inProgress: 0,
    completed: 0,
    printable: 0,
  });
});
