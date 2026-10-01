import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const componentSource = fs.readFileSync(
  path.resolve(currentDir, '../components/OrderEditor.vue'),
  'utf8',
);
const controllerSource = fs.readFileSync(
  path.resolve(currentDir, './orderEditorController.js'),
  'utf8',
);

test('closing product results consumes the close click and clears selection', () => {
  const guardedCloseButtons = componentSource.match(
    /@click\.stop\.prevent="handleCloseSearchResults"/g,
  ) || [];

  assert.equal(guardedCloseButtons.length, 2);
  assert.equal((componentSource.match(/@pointerdown\.stop\.prevent/g) || []).length, 2);
  assert.doesNotMatch(componentSource, /@click="\$emit\('close-str'\)"/);
  assert.match(controllerSource, /handleCloseSearchResults\(event\)/);
  assert.match(controllerSource, /this\.selectedSearchResultIndex = -1/);
  assert.match(controllerSource, /this\.selectedNxGoodsIndex = -1/);
});

test('leaving product results cannot receive a follow-up pointer click', () => {
  assert.match(
    componentSource,
    /\.search-results-leave-active\s*\{[^}]*pointer-events:\s*none;/s,
  );
});
