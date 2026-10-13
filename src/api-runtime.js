const PRODUCTION_API_BASE_URL = 'https://grainservice.club:8443/nongxinle/api/';
const PRODUCTION_BACKEND_ORIGIN = 'https://grainservice.club:8443';
const PRODUCTION_BACKEND_PATH = '/nongxinle/api/';

// 联调专用：测试服务器（62.234.114.61，域名 test-api.grainservice.club）。
// 仅当环境变量显式指定（NXL_DISPATCH_API_BASE_URL / NXL_ORDER_API_BASE_URL /
// GRAIN_API_URL）时才生效，代码默认仍是正式服务器。
const TEST_API_BASE_URL = 'https://test-api.grainservice.club/nongxinle/api/';
const TEST_BACKEND_ORIGIN = 'https://test-api.grainservice.club';
const TEST_BACKEND_PATH = '/nongxinle/api/';

function normalizeNongxinleApiBaseUrl(value, label = '农心乐 API') {
  const parsed = new URL(String(value || PRODUCTION_API_BASE_URL));
  const isLocalHttp =
    parsed.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  const isProductionBackend =
    parsed.protocol === 'https:' &&
    parsed.origin === PRODUCTION_BACKEND_ORIGIN &&
    parsed.pathname === PRODUCTION_BACKEND_PATH;
  const isTestBackend =
    parsed.protocol === 'https:' &&
    parsed.origin === TEST_BACKEND_ORIGIN &&
    parsed.pathname === TEST_BACKEND_PATH;

  if (!isProductionBackend && !isLocalHttp && !isTestBackend) {
    throw new Error(`${label}只允许正式服务器、测试服务器或本机开发地址`);
  }
  return parsed.toString().replace(/\/+$/, '') + '/';
}

module.exports = {
  PRODUCTION_API_BASE_URL,
  PRODUCTION_BACKEND_ORIGIN,
  PRODUCTION_BACKEND_PATH,
  TEST_API_BASE_URL,
  TEST_BACKEND_ORIGIN,
  TEST_BACKEND_PATH,
  normalizeNongxinleApiBaseUrl,
};
