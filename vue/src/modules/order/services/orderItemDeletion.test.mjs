import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const controllerSource = fs.readFileSync(
  path.resolve(currentDir, './placeOrderController.js'),
  'utf8',
);
const editorSource = fs.readFileSync(
  path.resolve(currentDir, '../components/OrderEditor.vue'),
  'utf8',
);

function methodBody(name, nextName) {
  const pattern = new RegExp(
    `async ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n\\s*\\},\\n\\n\\s*// ${nextName}`,
  );
  return controllerSource.match(pattern)?.[1] || '';
}

test('deleting an image result row does not signal that the whole task is complete', () => {
  const body = methodBody('handleDeleteOrderFromExcel', '选择匹配的商品');

  assert.notEqual(body, '');
  assert.match(body, /api\.deleteOrder\(item\.nxDepartmentOrdersId\)/);
  assert.match(body, /orderItems\.splice\(orderIndex, 1\)/);
  assert.doesNotMatch(body, /\$emit\(['"]task-added['"]\)/);
});

test('the row trash button consumes its click before emitting delete-order', () => {
  assert.match(
    editorSource,
    /@click\.stop="handleOrderAction\(\(\) => \$emit\('delete-order', \{ item, orderIndex \}\), orderIndex\)"/,
  );
});
