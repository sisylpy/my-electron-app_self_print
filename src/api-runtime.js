const PRODUCTION_API_BASE_URL = 'https://grainservice.club:8443/nongxinle/api/';
const PRODUCTION_BACKEND_ORIGIN = 'https://grainservice.club:8443';
const PRODUCTION_BACKEND_PATH = '/nongxinle/api/';

function normalizeNongxinleApiBaseUrl(value, label = '农心乐 API') {
  const parsed = new URL(String(value || PRODUCTION_API_BASE_URL));
  const isLocalHttp =
    parsed.protocol === 'http:' &&
    ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  const isProductionBackend =
    parsed.protocol === 'https:' &&
    parsed.origin === PRODUCTION_BACKEND_ORIGIN &&
    parsed.pathname === PRODUCTION_BACKEND_PATH;

  if (!isProductionBackend && !isLocalHttp) {
    throw new Error(`${label}只允许正式服务器或本机开发地址`);
  }
  return parsed.toString().replace(/\/+$/, '') + '/';
}

module.exports = {
  PRODUCTION_API_BASE_URL,
  PRODUCTION_BACKEND_ORIGIN,
  PRODUCTION_BACKEND_PATH,
  normalizeNongxinleApiBaseUrl,
};
