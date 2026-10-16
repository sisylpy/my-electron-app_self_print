const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const productionBase = 'https://grainservice.club:8443/nongxinle/api/';
const testBase = 'https://test-api.grainservice.club/nongxinle/api/';
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
  'vue/.env.production',
  'vue/src/config/index.js',
  'src/dispatch/dispatch-gateway.js',
  'src/order/order-write-gateway.js',
  'src/main.js',
  'src/mcp-bridge-client.js',
];

for (const file of runtimeFiles) {
  const source = read(file);
  check(!localBackendPattern.test(source), `${file} 不再引用本地 Java 服务`);
}

check(
  read('vue/vite.config.js').includes(`const PRODUCTION_API_BASE_URL = '${productionBase}'`) &&
    read('vue/vite.config.js').includes('target: apiTarget'),
  'Vue 代理保留正式服务器默认值'
);
check(
  read('vue/vite.config.js').includes("runtimeMode: 'development', apiUrl: TEST_API_BASE_URL")
    && read('vue/vite.config.js').includes("runtimeMode: 'test', apiUrl: TEST_API_BASE_URL")
    && read('vue/vite.config.js').includes("runtimeMode: 'production', apiUrl: PRODUCTION_API_BASE_URL")
    && read('vue/vite.config.js').includes("'import.meta.env.VITE_RUNTIME_MODE'")
    && read('vue/.env.production').includes(`VITE_API_URL=${productionBase}`),
  '开发、测试安装包、正式安装包使用各自固定服务器配置'
);
const packageJson = JSON.parse(read('package.json'));
const devElectronLauncher = read('scripts/start-electron-dev.cjs');
check(
  packageJson.scripts['dev:electron'] === 'node scripts/start-electron-dev.cjs'
    && devElectronLauncher.includes(`const testApiBaseUrl = '${testBase}'`)
    && devElectronLauncher.includes("GRAIN_RUNTIME_MODE: 'development'")
    && devElectronLauncher.includes('NXL_DISPATCH_API_BASE_URL: testApiBaseUrl')
    && devElectronLauncher.includes('NXL_ORDER_API_BASE_URL: testApiBaseUrl')
    && devElectronLauncher.includes('GRAIN_API_URL: testApiBaseUrl'),
  'npm run start 的 Electron 主进程与 Vue 共用测试服务器'
);
check(
  packageJson.grainRuntimeMode === 'production'
    && packageJson.scripts['dist:mac:test'].includes('club.grainservice.www.dev')
    && packageJson.scripts['dist:mac:test'].includes('grainRuntimeMode=test')
    && read('src/mcp-bridge-client.js').includes('return 3011;'),
  'Mac 测试包身份独立，连接器仍统一使用 3011'
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
  read('src/main.js').includes("userDataDirectory: '粒子-dev'")
    && read('src/main.js').includes("userDataDirectory: '粒子-test'")
    && read('src/main.js').includes("userDataDirectory: '粒子'")
    && read('src/main.js').includes('const apiUrl = `${runtimeApiBaseUrl}'),
  '主进程按显式运行模式隔离数据目录和 API'
);

if (failures > 0) {
  console.error(`Production API smoke failed: ${failures}`);
  process.exit(1);
}

console.log('Production API smoke passed.');
