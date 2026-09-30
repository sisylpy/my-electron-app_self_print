import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell = fs.readFileSync('vue/src/app/layout/ProductShell.vue', 'utf8');

assert.match(shell, /product-sidebar__navigation[\s\S]*?overflow-y:\s*auto/);
assert.match(shell, /product-sidebar__navigation a[\s\S]*?flex:\s*1 0 54px/);
assert.match(shell, /product-sidebar__navigation a[\s\S]*?min-height:\s*54px/);

console.log('Product sidebar compact-height layout passed');
