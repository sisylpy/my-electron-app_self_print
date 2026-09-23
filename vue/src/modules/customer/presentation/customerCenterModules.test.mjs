import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const customerRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(customerRoot, relativePath), 'utf8');

const customerCenter = read('views/CustomerCenter.vue');
const customerApi = read('api/customerApi.js');
const dispatchGateway = fs.readFileSync(
  path.resolve(customerRoot, '../../../../src/dispatch/dispatch-gateway.js'),
  'utf8',
);
const routes = read('routes.js');
const readme = read('README.md');
const ocrTrainingPanel = read('components/CustomerOcrTrainingPanel.vue');
const removedComponent = path.join(customerRoot, 'components/CustomerAiRecommendationPanel.vue');

for (const tab of ['profile', 'goods', 'afterSales', 'ocr', 'history']) {
  assert.match(customerCenter, new RegExp(`key: '${tab}'`), `客户中心应保留 ${tab} 标签`);
}

assert.doesNotMatch(customerCenter, /CustomerAiRecommendationPanel/);
assert.doesNotMatch(customerCenter, /activeTab === 'ai'/);
assert.doesNotMatch(customerCenter, /key: 'ai'/);
assert.doesNotMatch(customerCenter, /预计订单/);
assert.doesNotMatch(customerApi, /getAiRecommendations/);
assert.doesNotMatch(customerApi, /saveOrder\(order\)/);
assert.doesNotMatch(routes, /AI 推荐|智能推荐/);
assert.doesNotMatch(readme, /AI 预计订单/);
assert.equal(fs.existsSync(removedComponent), false, '预计订单组件文件应彻底删除');

assert.match(customerCenter, /CustomerOcrTrainingPanel/);
assert.match(ocrTrainingPanel, /复制粘贴/);
assert.match(ocrTrainingPanel, /图片识别/);
assert.match(ocrTrainingPanel, /Excel 粘贴/);
assert.match(ocrTrainingPanel, /样本原始日期/);
assert.match(ocrTrainingPanel, /KEEP_EXISTING/);
assert.match(ocrTrainingPanel, /REPLACE/);
assert.match(ocrTrainingPanel, /import ImageUpload from '@\/components\/upload\/ImageUpload\.vue'/);
assert.match(ocrTrainingPanel, /import OrderEditor from '@\/modules\/order\/components\/OrderEditor\.vue'/);
assert.match(ocrTrainingPanel, /import orderApi from '@\/modules\/order\/services\/orderApi'/);
assert.match(ocrTrainingPanel, /import ImageCropperModal from '@\/components\/ImageCropperModal\.vue'/);
assert.match(ocrTrainingPanel, /createImageTask\(dataUrl, 'FAST'\)/);
assert.match(ocrTrainingPanel, /createImageTask\(dataUrl, 'COMPLEX'\)/);
assert.doesNotMatch(ocrTrainingPanel, /class="source-editor image-picker"/);
assert.match(ocrTrainingPanel, /class="formal-detail-workspace"/);
assert.match(ocrTrainingPanel, /class="task-detail-layer"/);
assert.match(ocrTrainingPanel, /OCR 任务操作/);
assert.match(ocrTrainingPanel, /grid-template-columns: repeat\(auto-fill, minmax\(280px, 360px\)\)/);
assert.match(ocrTrainingPanel, /left: var\(--product-sidebar-width, 104px\)/);
assert.match(ocrTrainingPanel, /@delete-order="deleteTrainingItem"/);
assert.match(ocrTrainingPanel, /@read-order-list="readTrainingOrders"/);
assert.match(ocrTrainingPanel, /item\.nxDistributerGoodsEntityList/);
assert.match(ocrTrainingPanel, /item\.nxGoodsEntities/);
assert.match(ocrTrainingPanel, /isTrainingOrderValid\(item\)/);
assert.match(ocrTrainingPanel, /queryDisGoodsByQuickSearchWithDepId/);
assert.match(ocrTrainingPanel, /loadFormalOrderGoodsCandidates\(item, keyword\)/);
assert.match(ocrTrainingPanel, /item\.nxDistributerGoodsEntityList = disArr/);
assert.match(ocrTrainingPanel, /item\.nxGoodsEntities = nxArr/);
assert.match(ocrTrainingPanel, /await this\.loadFormalOrderGoodsCandidates\(trainingItem, keyword\)/);
assert.match(customerApi, /listCustomerOcrTasks/);
assert.match(customerApi, /completeCustomerOcrTraining/);
assert.match(customerApi, /deleteCustomerOcrTrainingItem/);
assert.match(customerApi, /deleteCustomerOcrTraining/);
assert.match(dispatchGateway, /'imageBase64', 'recognitionMode', 'items'/);
assert.match(dispatchGateway, /\['FAST', 'COMPLEX'\]/);
assert.match(dispatchGateway, /deleteCustomerOcrTrainingItem/);
assert.match(dispatchGateway, /deleteCustomerOcrTraining/);

console.log('Customer center module regression tests passed.');
