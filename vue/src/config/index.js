/**
 * 可公开进入渲染进程和安装包的运行时配置。
 *
 * 禁止在此文件中加入 API Key、SecretId、SecretKey、Token 或其他长期凭据。
 * 第三方 AI、OCR、ASR、TTS 调用必须由 nongxinle-server 代理。
 */
const PRODUCTION_API_BASE_URL = 'https://grainservice.club:8443/nongxinle/api/';
const configuredApiUrl = import.meta.env.VITE_API_URL || PRODUCTION_API_BASE_URL;
const parsedApiUrl = new URL(configuredApiUrl);
const isProductionBackend =
  parsedApiUrl.protocol === 'https:' &&
  parsedApiUrl.origin === 'https://grainservice.club:8443' &&
  parsedApiUrl.pathname === '/nongxinle/api/';
const isLocalBackend =
  parsedApiUrl.protocol === 'http:' &&
  ['localhost', '127.0.0.1', '::1'].includes(parsedApiUrl.hostname);

if (!isProductionBackend && !isLocalBackend) {
  throw new Error('桌面端 API 只允许正式服务器或本机开发地址');
}

const baseURL = parsedApiUrl.toString().replace(/\/+$/, '') + '/';

export default {
  baseURL,
  baseURLIMG: new URL('../captcha.jpg', baseURL).toString(),
  authBaseURL: '',
};
