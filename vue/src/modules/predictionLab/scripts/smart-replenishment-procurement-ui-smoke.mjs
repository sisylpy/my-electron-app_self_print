import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(directory, '..');
const view = fs.readFileSync(path.join(moduleRoot, 'views/PredictionLab.vue'), 'utf8');
const api = fs.readFileSync(path.join(moduleRoot, 'api/predictionLabApi.js'), 'utf8');

assert.match(view, /<span>库存数量<\/span>/);
assert.match(view, /<span>采购订货<\/span>/);
assert.doesNotMatch(view, /<span>操作<\/span>/);
assert.doesNotMatch(view, /<span>依据<\/span>/);
assert.match(view, /createProcurementItem/);
assert.match(view, /已有采购任务，未重复添加/);
assert.match(view, /入库时再选择实际货架/);
assert.match(view, /状态未知/);
assert.match(api, /purchase-prediction-lab\/procurement-contexts/);
assert.match(api, /purchase-prediction-lab\/procurement-items/);

console.log('PASS smart replenishment desktop procurement UI contract');
