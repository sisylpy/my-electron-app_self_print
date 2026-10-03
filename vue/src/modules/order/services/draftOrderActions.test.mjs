import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const draftOrderListSource = readFileSync(
  new URL('../../../components/DraftOrderList.vue', import.meta.url),
  'utf8',
);
const pasteUploadSource = readFileSync(
  new URL('../../../components/upload/PasteUpload.vue', import.meta.url),
  'utf8',
);

test('draft rows expose one compact operation trigger and preserve all three actions in its menu', () => {
  assert.match(draftOrderListSource, /class="draft-actions-trigger"/);
  assert.match(draftOrderListSource, />\s*<span>操作<\/span>/);
  assert.match(draftOrderListSource, /class="draft-actions-menu"/);
  assert.match(draftOrderListSource, /handleDeleteOrder\(item, orderIndex\)/);
  assert.match(draftOrderListSource, /handleAddOrderBefore\(orderIndex\)/);
  assert.match(draftOrderListSource, /handleRemarkClick\(orderIndex\)/);
  assert.doesNotMatch(draftOrderListSource, /class="draft-btn draft-btn-delete"/);
});

test('operation menu closes after an action and when clicking outside', () => {
  assert.match(draftOrderListSource, /document\.addEventListener\('pointerdown', this\.handleDocumentPointerDown\)/);
  assert.match(draftOrderListSource, /document\.removeEventListener\('pointerdown', this\.handleDocumentPointerDown\)/);
  assert.match(draftOrderListSource, /handleDeleteOrder\(item, orderIndex\)\s*{\s*this\.closeActionMenu\(\)/);
  assert.match(draftOrderListSource, /handleAddOrderBefore\(orderIndex\)\s*{\s*this\.closeActionMenu\(\)/);
  assert.match(draftOrderListSource, /handleRemarkClick\(orderIndex\)\s*{\s*this\.closeActionMenu\(\)/);
});

test('WeChat source receives the width released by the compact operation column', () => {
  assert.match(pasteUploadSource, /compactSource \? 'col-md-3' : 'col-md-4'/);
  assert.match(pasteUploadSource, /compactSource \? 'col-md-9' : 'col-md-8'/);
});
