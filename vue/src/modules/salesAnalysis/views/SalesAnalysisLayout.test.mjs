import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const viewSource = fs.readFileSync(path.join(currentDirectory, 'SalesAnalysis.vue'), 'utf8');
const drawerSource = fs.readFileSync(
  path.join(currentDirectory, '../components/ProductCustomerDrawer.vue'),
  'utf8',
);
const customerPanelSource = fs.readFileSync(
  path.join(currentDirectory, '../components/CustomerProductPanel.vue'),
  'utf8',
);

assert.match(viewSource, /category-mode-switch/);
assert.doesNotMatch(viewSource, /analysis-mode-switch/);
assert.doesNotMatch(viewSource, /近7天|近30天|近90天|快捷统计范围/);
assert.doesNotMatch(viewSource, /presets|activePreset|applyPreset/);
assert.match(viewSource, /\.analysis-filters input\{[^}]*height:44px[^}]*font-size:15px/);
assert.match(viewSource, /input::\-webkit-calendar-picker-indicator\{[^}]*width:18px[^}]*height:18px/);
assert.match(viewSource, /占总销售额/);
assert.match(viewSource, /category-icon/);
assert.doesNotMatch(viewSource, /subcategory-icon/);
assert.match(viewSource, /catalogImage\(category, 'category'\)/);
assert.match(viewSource, /categoryColorStyle\(category\.color\)/);
assert.match(viewSource, /category-row__progress/);
assert.match(viewSource, /shareBarWidth\(category\.share\)/);
assert.match(viewSource, /percentageLabel\(category\.share\)/);
assert.match(viewSource, /percentageLabel\(overallShare\(subcategory\.salesAmount\)\)/);
assert.doesNotMatch(viewSource, /在总销售中的占比/);
assert.doesNotMatch(viewSource, /selectedSubcategoryOverallShare/);
assert.match(viewSource, /selectedSubcategoryCustomerAverage/);
assert.match(viewSource, /subcategory-row__profit/);
assert.match(viewSource, /selection-heading__metrics/);
assert.match(viewSource, /<i>客均<\/i>/);
assert.match(viewSource, /<i>可核算额<\/i>/);
assert.match(viewSource, /<i>覆盖<\/i>/);
assert.doesNotMatch(viewSource, /class="selection-summary"/);
assert.doesNotMatch(viewSource, /class="profit-summary-strip"/);
assert.match(drawerSource, /商品内客户占比 · 本列表合计 100%/);
assert.match(drawerSource, /商品内占比 \{\{ percentageLabel\(customer\.share\) \}\}/);
assert.match(viewSource, /可核算毛利/);
assert.match(viewSource, /profitCoverageText\(summary\)/);
assert.match(viewSource, /subcategory\.grossProfit/);
assert.match(viewSource, /product\.grossMarginRate/);
assert.match(drawerSource, /summary\.grossProfit/);
assert.match(drawerSource, /customer\.grossMarginRate/);
assert.match(customerPanelSource, /resolvedCustomer\.grossProfit/);
assert.match(customerPanelSource, /product\.grossMarginRate/);

console.log('Sales analysis layout checks passed.');
