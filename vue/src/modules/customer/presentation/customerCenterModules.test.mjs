import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const customerRoot = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(customerRoot, relativePath), 'utf8');

const customerCenter = read('views/CustomerCenter.vue');
const customerApi = read('api/customerApi.js');
const routes = read('routes.js');
const readme = read('README.md');
const removedComponent = path.join(customerRoot, 'components/CustomerAiRecommendationPanel.vue');

for (const tab of ['profile', 'goods', 'afterSales', 'history']) {
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

console.log('Customer center module regression tests passed.');
