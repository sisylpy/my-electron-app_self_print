import assert from 'node:assert/strict';
import {
  filterWechatImageOcrText,
  formatWechatImageRecognition,
  isMeaningfulWechatImageOrderName,
  normalizeWechatImageUncertainFields,
  shouldKeepWechatImageRecognitionItem,
} from './wechatImageRecognition.js';

assert.equal(isMeaningfulWechatImageOrderName('-', { quantity: '17' }), false);
assert.equal(isMeaningfulWechatImageOrderName('17'), false);
assert.equal(isMeaningfulWechatImageOrderName('川'), false);
assert.equal(isMeaningfulWechatImageOrderName('葱', { quantity: '5', unit: '斤' }), true);
assert.equal(isMeaningfulWechatImageOrderName('中葱'), true);

assert.equal(
  filterWechatImageOcrText('-\n17\n川\n中葱五斤\n葱5斤\n|||'),
  '中葱五斤\n葱5斤',
);

assert.equal(
  formatWechatImageRecognition({
    items: [
      { name: '-', quantity: '17' },
      { name: '17' },
      { name: '川' },
      { name: '葱', quantity: '5', unit: '斤' },
      { name: '中葱', quantity: '2', unit: '斤' },
    ],
  }),
  '葱 5斤\n中葱 2斤',
);

assert.equal(
  formatWechatImageRecognition({
    items: [{ name: '-' }, { name: '17' }],
    ocrText: '---\n西瓜888斤\n川\n17',
  }),
  '西瓜888斤',
);

assert.deepEqual(
  normalizeWechatImageUncertainFields(['name', 'unit', 'name', 'unsupported', '', null]),
  ['name', 'unit'],
);
assert.equal(
  shouldKeepWechatImageRecognitionItem({
    name: '',
    rawName: '',
    quantity: '',
    unit: '',
    note: '',
    uncertainFields: ['name'],
  }),
  true,
);
assert.equal(
  shouldKeepWechatImageRecognitionItem({
    name: '',
    rawName: '',
    quantity: '',
    unit: '',
    note: '',
    uncertainFields: [],
  }),
  false,
);

console.log('WeChat image recognition filter passed');
