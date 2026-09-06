import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dialogPath = fileURLToPath(new URL('../components/CustomerGoodsOrderPriceDialog.vue', import.meta.url));
const apiPath = fileURLToPath(new URL('../api/customerApi.js', import.meta.url));
const dialog = readFileSync(dialogPath, 'utf8');
const api = readFileSync(apiPath, 'utf8');

assert.match(dialog, /设置订货单价/);
assert.match(dialog, /goods\.orderPrice \|\| ''/);
assert.match(dialog, /updateCustomerGoodsOrderPrice\(this\.goods\.relationId, value\)/);
assert.match(dialog, /历史单价/);
assert.match(dialog, /Number\(value\) <= 0/);
assert.match(api, /updateCustomerGoodsOrderPrice\(relationId, sellingPrice\)/);
assert.match(api, /nxdepartmentdisgoods\/updateDepGoodsSellingPrice/);
assert.match(api, /formData\(\{ depGoodsId: relationId, sellingPrice \}\)/);

console.log('customer goods order price tests passed');
