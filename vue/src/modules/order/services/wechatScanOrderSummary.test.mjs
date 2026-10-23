import assert from 'node:assert/strict';
import { buildWechatScanTaskSummary } from './wechatScanOrderSummary.js';

const valid = buildWechatScanTaskSummary({
  text: '苹果555斤\n西瓜3个\n芒果5个',
}, 'text');
assert.equal(valid.saveReady, true);
assert.equal(valid.parsedItemCount, 3);
assert.equal(valid.textPreview, '苹果555斤；西瓜3个；芒果5个');

const invalid = buildWechatScanTaskSummary({ text: '真的1' }, 'text');
assert.equal(invalid.saveReady, false);
assert.match(invalid.parseMessage, /内容不完整|未解析出|有效/);

const image = buildWechatScanTaskSummary({
  text: '',
  images: [{ dataUrl: 'data:image/png;base64,AA==' }],
}, 'image');
assert.equal(image.saveReady, false);

console.log('WeChat scan text-order summary passed');
