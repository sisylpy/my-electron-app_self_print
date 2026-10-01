import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const todayOrdersSource = fs.readFileSync(
  path.resolve(currentDir, '../../../components/TodayOrders.vue'),
  'utf8',
);
const apiSource = fs.readFileSync(
  path.resolve(currentDir, '../../../api/all.js'),
  'utf8',
);

test('completed orders expose only the restock action in both table layouts', () => {
  assert.match(todayOrdersSource, /return Number\(order\?\.nxDoStatus\) === 2/);
  assert.equal((todayOrdersSource.match(/v-if="isCompletedOrder\(order\)"/g) || []).length, 2);
  assert.equal((todayOrdersSource.match(/'重新出库'/g) || []).length, 2);
  assert.equal(
    (todayOrdersSource.match(/v-if="order\.nxDoStatus > -2 && !isCompletedOrder\(order\)"/g) || []).length,
    8,
  );
});

test('all completed-order mutation entry points use the defensive status guard', () => {
  const guardCalls = todayOrdersSource.match(/rejectCompletedOrderMutation\(/g) || [];
  assert.ok(guardCalls.length >= 11);
  assert.match(todayOrdersSource, /不能修改数量、单价、规格或删除/);
});

test('restock reuses the legacy server endpoint and refreshes the order list', () => {
  assert.match(apiSource, /cancelOutOrder\(order\)/);
  assert.match(apiSource, /nxdepartmentorders\/cancelOutOrder/);
  assert.match(todayOrdersSource, /await api\.cancelOutOrder\(order\)/);
  assert.match(todayOrdersSource, /this\.\$emit\('order-updated'\)/);
});
