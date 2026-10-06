import assert from 'node:assert/strict';
import {
  formatAveragePrices,
  formatOptionalMoney,
  formatQuantities,
  optionalPercentageLabel,
  rangeForDays,
  relativeBarWidth,
  resolveCategoryImage,
  resolveGoodsImage,
} from './salesAnalysisPresentation.js';

assert.equal(formatQuantities([{ unit: '斤', quantity: 12.5 }, { unit: '箱', quantity: 2 }]), '12.5斤 · 2箱');
assert.equal(formatAveragePrices([{ unit: '斤', price: 6 }, { unit: '箱', price: 20 }]), '¥6/斤 · ¥20/箱');
assert.equal(formatOptionalMoney(null), '—');
assert.equal(formatOptionalMoney(-12.5), '¥-12.5');
assert.equal(optionalPercentageLabel(undefined), '—');
assert.equal(optionalPercentageLabel(-5.25), '-5.25%');
assert.equal(relativeBarWidth([{ salesAmount: 100 }, { salesAmount: 50 }], 50), '50%');
assert.deepEqual(rangeForDays(7, new Date(2026, 8, 2)), {
  startDate: '2026-08-27',
  endDate: '2026-09-02',
});
assert.equal(
  resolveGoodsImage({ nxDgGoodsFileLarge: 'goodsImage/spinach-large.jpg' }, 'https://example.test/root/'),
  'https://example.test/root/goodsImage/spinach-large.jpg',
);
assert.equal(
  resolveGoodsImage({
    nxDgGoodsFile: 'goodsImage/logo.jpg',
    nxDgNxFatherImg: 'goodsImage/leafy.jpg',
  }, 'https://example.test/root/'),
  'https://example.test/root/goodsImage/leafy.jpg',
);
assert.equal(
  resolveGoodsImage({ nxGoodsFileBig: 'https://cdn.example.test/potato.jpg' }, 'https://example.test/root/'),
  'https://cdn.example.test/potato.jpg',
);
assert.equal(
  resolveGoodsImage({}, 'https://example.test/root/', 'goodsImage/logo.jpg'),
  'https://example.test/root/goodsImage/logo.jpg',
);
assert.equal(
  resolveCategoryImage({ image: 'goodsImage/fresh-vegetables.jpg' }, 'https://example.test/root/'),
  'https://example.test/root/goodsImage/fresh-vegetables.jpg',
);
assert.equal(resolveCategoryImage({ image: 'goodsImage/logo.jpg' }, 'https://example.test/root/'), '');

console.log('salesAnalysisPresentation tests passed');
