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

assert.match(viewSource, /百分比均为占总销售额/);
assert.match(viewSource, /<i>大类<\/i>/);
assert.match(viewSource, /大类占总销售额/);
assert.match(viewSource, /<i>小类<\/i>/);
assert.match(viewSource, /小类占总销售额/);
assert.match(viewSource, /占总销售额 <em>\{\{ percentageLabel\(category\.share\) \}\}<\/em>/);
assert.match(viewSource, /占总销售额 <em>\{\{ percentageLabel\(overallShare\(subcategory\.salesAmount\)\) \}\}<\/em>/);
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
