const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const productionBase = 'https://grainservice.club:8443/nongxinle/api/';
const localBackendPattern = /localhost:808[01]|nongxinle_(?:server|master|war).*war_exploded|nongxinle_war_exploded/;
let failures = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function check(condition, message) {
  if (condition) {
    console.log(`PASS ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

const runtimeFiles = [
  'vue/vite.config.js',
  'vue/.env',
  'vue/.env.development',
  'vue/.env.production',
  'vue/src/config/index.js',
  'src/dispatch/dispatch-gateway.js',
  'src/order/order-write-gateway.js',
  'src/main.js',
  'src/mcp-config.json',
  'src/mcp-server.js',
  'src/mcp-server-cli.js',
];

for (const file of runtimeFiles) {
  const source = read(file);
  check(!localBackendPattern.test(source), `${file} 不再引用本地 Java 服务`);
}

check(
  read('vue/vite.config.js').includes(`const PRODUCTION_API_BASE_URL = '${productionBase}'`) &&
    read('vue/vite.config.js').includes('target: apiTarget'),
  'Vue 开发代理指向正式服务器'
);
check(
  read('src/dispatch/dispatch-gateway.js').includes(
    'const DEFAULT_API_BASE_URL = PRODUCTION_API_BASE_URL'
  ),
  'Electron 调度网关默认指向正式服务器'
);
check(
  read('src/order/order-write-gateway.js').includes(
    'const DEFAULT_API_BASE_URL = PRODUCTION_API_BASE_URL'
  ),
  'Electron 订单写网关默认指向正式服务器'
);
check(
  read('src/main.js').includes("const { PRODUCTION_API_BASE_URL } = require('./api-runtime')"),
  '主进程打印回写统一使用正式服务器'
);

if (failures > 0) {
  console.error(`Production API smoke failed: ${failures}`);
  process.exit(1);
}

console.log('Production API smoke passed.');
