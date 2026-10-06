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
assert.doesNotMatch(viewSource, /<article><span>使用客户<\/span>/);
assert.doesNotMatch(viewSource, /<article><span>销售数量<\/span>/);
assert.match(viewSource, /\.analysis-toolbar \.summary-grid \{[^}]*flex: 0 1 600px[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
assert.match(viewSource, /\.analysis-filters input\{[^}]*height:44px[^}]*font-size:15px/);
assert.match(viewSource, /input::\-webkit-calendar-picker-indicator\{[^}]*width:18px[^}]*height:18px/);
assert.doesNotMatch(viewSource, />销售分类</);
assert.doesNotMatch(viewSource, />占总销售额</);
assert.doesNotMatch(viewSource, /category-share-guide__copy/);
assert.match(viewSource, /\.category-share-guide\s*\{[^}]*justify-content: center/);
assert.match(viewSource, /\.category-mode-switch\s*\{[^}]*width: calc\(100% - 20px\)[^}]*max-width: 246px/);
assert.match(viewSource, /category-icon/);
assert.doesNotMatch(viewSource, /subcategory-icon/);
assert.match(viewSource, /catalogImage\(category, 'category'\)/);
assert.match(viewSource, /categoryColorStyle\(category\.color\)/);
assert.match(viewSource, /category-row__progress/);
assert.match(viewSource, /expandedCategoryId/);
assert.match(viewSource, /@click\.stop="toggleCategory\(category\)"/);
assert.match(viewSource, /@keydown\.enter\.stop\.prevent="toggleCategory\(category\)"/);
assert.match(viewSource, /:aria-expanded="same\(category\.id, expandedCategoryId\)"/);
assert.match(viewSource, /same\(category\.id, expandedCategoryId\) && displayMode === 'product'/);
assert.match(viewSource, /shareBarWidth\(category\.share\)/);
assert.match(viewSource, /percentageLabel\(category\.share\)/);
assert.match(viewSource, /percentageLabel\(overallShare\(subcategory\.salesAmount\)\)/);
assert.doesNotMatch(viewSource, /在总销售中的占比/);
assert.doesNotMatch(viewSource, /selectedSubcategoryOverallShare/);
assert.match(viewSource, /selectedSubcategoryCustomerAverage/);
assert.doesNotMatch(viewSource, /subcategory-row__profit/);
assert.match(viewSource, /selection-heading__metrics/);
assert.match(viewSource, /<i>成交额<\/i>/);
assert.match(viewSource, /<i>占总额<\/i>/);
assert.match(viewSource, /<i>客均<\/i>/);
assert.match(viewSource, /<i>可核算额<\/i>/);
assert.match(viewSource, /<i>毛利<\/i>/);
assert.match(viewSource, /<i>毛利率<\/i>/);
assert.match(viewSource, /<i>成本覆盖<\/i>/);
assert.match(viewSource, /grid-template-columns: repeat\(10, minmax\(70px, 1fr\)\)/);
assert.match(viewSource, /\.selection-heading__metrics b \{[^}]*font-size: 13px/);
assert.doesNotMatch(viewSource, /class="selection-summary"/);
assert.doesNotMatch(viewSource, /class="profit-summary-strip"/);
assert.doesNotMatch(viewSource, /<ProductCustomerDrawer\s+embedded/);
assert.match(viewSource, /:visible="productDrawerVisible"/);
assert.match(viewSource, /@click="openProductDrawer\(product\)"/);
assert.match(viewSource, /@close="closeProductDrawer"/);
assert.match(viewSource, /grid-template-columns: 290px minmax\(0, 1fr\)/);
assert.match(drawerSource, /@click\.self="embedded \? null : \$emit\('close'\)"/);
assert.match(drawerSource, /event\.key === 'Escape'/);
assert.match(drawerSource, /商品内客户占比 · 本列表合计 100%/);
assert.match(drawerSource, /商品内占比 \{\{ percentageLabel\(customer\.share\) \}\}/);
assert.match(viewSource, /可核算毛利/);
assert.match(viewSource, /profitCoverageText\(summary\)/);
assert.match(viewSource, /selectedSubcategory\?\.grossProfit/);
assert.match(viewSource, /product\.grossMarginRate/);
assert.match(drawerSource, /summary\.grossProfit/);
assert.match(drawerSource, /customer\.grossMarginRate/);
assert.match(customerPanelSource, /resolvedCustomer\.grossProfit/);
assert.match(customerPanelSource, /product\.grossMarginRate/);
assert.match(customerPanelSource, /<th aria-label="查看详情"><\/th>/);
assert.match(customerPanelSource, /class="row-open"/);
assert.match(customerPanelSource, /@click\.stop="\$emit\('select', product\)"/);
assert.match(customerPanelSource, /colspan="8"/);

console.log('Sales analysis layout checks passed.');
