import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const componentPath = fileURLToPath(new URL('../components/CustomerGoodsPanel.vue', import.meta.url));
const source = readFileSync(componentPath, 'utf8');

assert.match(source, /\.goods-tools\{[^}]*flex:0 0 auto/);
assert.match(source, /\.view-toggle\{[^}]*flex:0 0 auto[^}]*min-width:158px/);
assert.match(source, /\.view-toggle button\{[^}]*min-width:79px[^}]*flex:0 0 79px/);
assert.match(source, /@click="viewMode = 'amount'"/);
assert.match(source, /class="order-price-button"[\s\S]*订货单价/);
assert.match(source, /class="price-button"[\s\S]*历史单价/);
assert.match(source, /<CustomerGoodsOrderPriceDialog[\s\S]*:goods="orderPriceGoods"/);
assert.match(source, /orderPrice: this\.text\(row\.orderPrice\)/);
assert.match(source, /class="average-order-quantity"/);
assert.match(source, /averageOrderQuantityText\(item\)/);
assert.match(source, /averageOrderQuantity90Days/);
assert.match(source, /<div class="order-metrics">[\s\S]*class="average-order-quantity"/);
assert.match(source, /v-if="viewMode === 'amount'"[\s\S]*class="order-cadence"/);
assert.match(source, /订货频率：约 \$\{this\.formatNumber\(item\.intervalDays\)\} 天一次/);
assert.match(source, /订货频率：暂未形成周期/);
assert.match(source, /\.goods-row\{[^}]*grid-template-columns:52px minmax\(160px,1fr\) 140px 190px 135px 245px/);
assert.match(source, /\.order-metrics\{[^}]*display:flex[^}]*flex-direction:column/);
assert.match(source, /@media\(max-width:820px\)[\s\S]*\.goods-overview \.summary-strip\{flex:0 0 auto;/);

const identityIndex = source.indexOf('<div class="goods-identity">');
const amountIndex = source.indexOf('<div v-if="viewMode === \'amount\'" class="amount-value">');
const metricsIndex = source.indexOf('<div class="order-metrics">');
assert.ok(identityIndex >= 0 && amountIndex > identityIndex && metricsIndex > amountIndex);

const requirementButtonIndex = source.indexOf('class="requirement-button"');
const orderPriceButtonIndex = source.indexOf('class="order-price-button"');
const historyPriceButtonIndex = source.indexOf('class="price-button"');
assert.ok(requirementButtonIndex >= 0
  && orderPriceButtonIndex > requirementButtonIndex
  && historyPriceButtonIndex > orderPriceButtonIndex);

console.log('customer goods panel layout tests passed');
