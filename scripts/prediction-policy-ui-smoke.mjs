import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function check(condition, message) {
  if (condition) console.log(`PASS ${message}`);
  else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

const view = read('vue/src/modules/predictionLab/views/PredictionLab.vue');
const visibleTemplate = view.split('<script setup>')[0];
const navigation = read('vue/src/app/navigation/productNavigation.js');
const routes = read('vue/src/modules/predictionLab/routes.js');
const presentationPath = pathToFileURL(path.join(
  root,
  'vue/src/modules/predictionLab/presentation/procurementProductPresentation.js',
)).href;
const {
  aggregateProcurementRuns,
  buildCategoryGroups,
  buildProcurementPresentation,
} = await import(presentationPath);

const sampleRun = {
  departmentName: '示例门店',
  items: [
    { goodsId: 1, goodsName: '土豆', goodsCategoryName: '蔬菜类', predictedQuantity: 20, predictedUnit: '斤', policyLevel: 'LEVEL_A', policyTrustPercent: 91 },
    { goodsId: 2, goodsName: '东古一品鲜', goodsCategoryName: '粮油调味类', predictedQuantity: 2, predictedUnit: '瓶', policyLevel: 'LEVEL_A', policyTrustPercent: 86 },
    { goodsId: 3, goodsName: '鸡蛋', goodsCategoryName: '蛋品类', predictedQuantity: 5, predictedUnit: '斤', policyLevel: 'LEVEL_B', policyTrustPercent: 68 },
    { goodsId: 4, goodsName: '临时商品', predictedQuantity: 1, predictedUnit: '个', policyLevel: 'LEVEL_C', policyTrustPercent: 30 },
  ],
};
const presentation = buildProcurementPresentation(sampleRun, 1);
const aCategories = buildCategoryGroups(presentation.byLevel.LEVEL_A);
const rangeRun = aggregateProcurementRuns([
  {
    departmentName: '示例门店',
    predictionDate: '2026-08-22',
    items: [
      { goodsId: 1, goodsName: '土豆', predictedQuantity: 10, predictedUnit: '斤', policyLevel: 'LEVEL_B', policyTrustPercent: 68 },
      { goodsId: 1, goodsName: '土豆', predictedQuantity: 2, predictedUnit: '箱', policyLevel: 'LEVEL_B', policyTrustPercent: 66 },
    ],
  },
  {
    departmentName: '示例门店',
    predictionDate: '2026-08-23',
    items: [
      { goodsId: 1, goodsName: '土豆', predictedQuantity: 20, predictedUnit: '斤', policyLevel: 'LEVEL_A', policyTrustPercent: 91 },
    ],
  },
], { startDate: '2026-08-22', endDate: '2026-08-23', departmentName: '示例门店' });
const oneDateInRange = buildProcurementPresentation({
  departmentName: '示例门店',
  forecastDateCount: 7,
  items: [{
    goodsId: 5,
    goodsName: '大葱',
    goodsCategoryId: 10,
    goodsCategoryName: '蔬菜类',
    goodsCategoryLevel: 0,
    predictedQuantity: 40,
    predictedUnit: '斤',
    policyLevel: 'LEVEL_A',
    policyTrustPercent: 94,
    dateForecasts: [{ date: '2026-08-26', quantity: 40, unit: '斤' }],
  }],
}, 1).products[0];

check(presentation.summary.levelACount === 2 && presentation.summary.levelBCount === 1,
  '采购建议只展示 A/B 两个可信等级');
check(presentation.summary.hiddenOrUnclassifiedCount === 1,
  'C级及未分级商品不进入主采购建议');
check(aCategories.some((category) => category.label === '蔬菜类')
  && aCategories.some((category) => category.label === '粮油调味类'),
  '商品按大类生成左侧竖向分组');
check(view.includes('detail-level-filter') && view.includes("level.key === 'LEVEL_A' ? 'A' : 'B'"),
  '页面提供可点击的 A/B 可信等级筛选');
check(view.includes('数量请结合库存与门店确认'),
  '预计数量始终保留人工确认提示');
check(view.includes('class="category-tabs"') && view.includes('class="product-detail"'),
  '商品大类和商品明细位于同一主内容区域');
check(!visibleTemplate.includes('LEVEL_C'),
  'C级商品不进入客户主操作区');
check(view.includes('placeholder="输入门店名称"')
  && view.includes('class="store-list"')
  && view.includes('<strong>全部门店</strong>'),
  '中间栏完整展示可搜索门店目录，全部门店固定在首位');
check(view.includes('class="header-date-range"') && view.includes('class="overview-panel"'),
  '采购时间位于页头，业务内容统一位于右侧工作区');
check(view.includes('<Teleport to="#product-header-context">')
  && view.includes('class="detail-level-filter"')
  && view.includes('class="header-range-presets"'),
  '页头承载日期和刷新操作，A/B 筛选位于商品明细标题旁');
check(view.includes('.procurement-page{height:100%')
  && view.includes('overflow:hidden')
  && view.includes('.product-table{min-width:0;min-height:0;flex:1;overflow-y:auto'),
  '页面高度跟随桌面工作区，商品列表在固定区域内独立滚动');
check(view.includes('今天') && view.includes('明天') && view.includes('未来7天') && view.includes('自定义'),
  '采购时间支持单日、未来7天和自定义范围');
check(rangeRun.items.length === 2
  && rangeRun.items.find((item) => item.predictedUnit === '斤')?.predictedQuantity === 30
  && rangeRun.items.find((item) => item.predictedUnit === '斤')?.policyLevel === 'LEVEL_B'
  && rangeRun.items.find((item) => item.predictedUnit === '斤')?.policyTrustPercent === 68,
  '多日结果仅按同商品同单位汇总，并保守继承周期内最低可信级别');
check(oneDateInRange.forecastDateCount === 7
  && oneDateInRange.dateForecasts.length === 1
  && view.includes('Number(product?.forecastDateCount) > 1 && forecasts.length'),
  '七天范围即使商品只在一天预计订货，也明确显示该订货日期');
check(view.includes('Number(item.goodsCategoryLevel) === 0')
  && !view.includes('nxDgNxGreatGrandName')
  && !view.includes('nxDgNxGrandName')
  && !view.includes('nxDgNxFatherName'),
  '商品大类只采用预测接口明确返回的 level=0 父类，不拿详情字段或名称猜测兜底');
check(!view.includes('attachFrozenPolicyReplay') && !view.includes('policyReplayFixture'),
  '生产页面不注入冻结回放或页面假等级');
check(!/(实验|回放|SHADOW|Shadow|V8|V9|POLICY|Policy|算法版本)/.test(visibleTemplate),
  '客户页面不显示研发和验证术语');
check(!visibleTemplate.includes('可信采购助手'),
  '客户页面不显示重复的产品宣传标题');
check(view.includes("result.orderEvaluation?.predictedOrder === false")
  && view.includes('页面已正常读取数据，并不是系统故障')
  && view.includes('当前无需备货')
  && view.includes('暂时没有发现'),
  '正常空结果显示普通用户能理解的说明，不再冒充接口故障');
check(!view.includes("actionError.value = '当前范围没有通过冻结 Policy")
  && !visibleTemplate.includes('门禁')
  && !visibleTemplate.includes('未评级'),
  '空结果提示不暴露研发术语，也不写入错误状态');
check(navigation.includes("label: '智能备货'")
  && routes.includes("title: '智能备货'"),
  '导航和页面标题统一为智能备货');
check(!view.match(/create|save|submitOrder|purchaseOrder|electronAPI/i),
  '页面不包含订单或采购单写入入口');

if (failures) {
  console.error(`Procurement product UI smoke failed: ${failures}`);
  process.exit(1);
}
console.log('Procurement product UI smoke passed.');
