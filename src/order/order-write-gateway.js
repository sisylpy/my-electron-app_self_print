const crypto = require('crypto');
const {
  PRODUCTION_API_BASE_URL,
  normalizeNongxinleApiBaseUrl,
} = require('../api-runtime');

const DEFAULT_API_BASE_URL = PRODUCTION_API_BASE_URL;
const MAX_ORDER_COUNT = 500;
const MAX_REQUEST_BYTES = 5 * 1024 * 1024;

function normalizeBaseUrl(value) {
  return normalizeNongxinleApiBaseUrl(value, '订单 API');
}

function cloneAndValidatePastePayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('保存订单参数无效');
  }
  if (!Array.isArray(input.orderList) || input.orderList.length === 0) {
    throw new Error('订单列表不能为空');
  }
  if (input.orderList.length > MAX_ORDER_COUNT) {
    throw new Error(`单次最多保存 ${MAX_ORDER_COUNT} 条订单`);
  }
  if (input.pasteText != null && typeof input.pasteText !== 'string') {
    throw new Error('订单原文格式无效');
  }
  const type = input.type == null ? 3 : Number(input.type);
  if (type !== 3) {
    throw new Error('桌面端粘贴订单类型无效');
  }

  let serialized;
  try {
    serialized = JSON.stringify({
      orderList: input.orderList,
      pasteText: input.pasteText || '',
      type: 3,
    });
  } catch {
    throw new Error('订单内容无法序列化');
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_REQUEST_BYTES) {
    throw new Error('订单内容过多，请分批保存');
  }
  return JSON.parse(serialized);
}

function serverMessage(data, fallback) {
  if (data && typeof data === 'object') {
    return data.msg || data.message || data.error || fallback;
  }
  if (typeof data === 'string') {
    const messageMatch = data.match(/<b>Message<\/b>\s*([^<]+)/i);
    if (messageMatch && messageMatch[1]) return messageMatch[1].trim();
    const plain = data.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (plain) return plain.slice(0, 240);
  }
  return fallback;
}

function createOrderWriteGateway({ axios, appLogger, apiBaseUrl }) {
  const baseURL = normalizeBaseUrl(
    apiBaseUrl || process.env.NXL_ORDER_API_BASE_URL || DEFAULT_API_BASE_URL
  );
  const http = axios.create({
    baseURL,
    timeout: 120_000,
    validateStatus: () => true,
    withCredentials: false,
  });

  async function savePasteOrders(input) {
    let payload;
    try {
      payload = cloneAndValidatePastePayload(input);
    } catch (error) {
      return {
        ok: false,
        status: 400,
        message: error.message,
        data: null,
      };
    }

    const requestId = crypto.randomUUID();
    try {
      const response = await http.post('ocr/pasteSearchGoods', payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': requestId,
        },
        maxRedirects: 0,
      });
      const body = response.data;
      const businessOk = body && typeof body === 'object' && Number(body.code) === 0;
      const httpOk = response.status >= 200 && response.status < 300;

      if (httpOk && businessOk) {
        appLogger?.append('info', 'order-write', 'paste-orders-saved', {
          requestId,
          orderCount: payload.orderList.length,
          taskId: body.taskId ?? null,
        });
        return {
          ok: true,
          status: response.status,
          data: body,
          requestId,
        };
      }

      const message = serverMessage(
        body,
        response.status === 403 ? '服务器拒绝保存订单' : '保存订单失败'
      );
      appLogger?.append('warn', 'order-write', 'paste-orders-rejected', {
        requestId,
        status: response.status,
        orderCount: payload.orderList.length,
        message,
      });
      return {
        ok: false,
        status: response.status,
        message,
        data: body,
        requestId,
      };
    } catch (error) {
      const status = Number(error?.response?.status) || 0;
      const data = error?.response?.data ?? null;
      const message = serverMessage(data, '无法连接订单服务，请检查网络后重试');
      appLogger?.append('error', 'order-write', 'paste-orders-request-failed', {
        requestId,
        status,
        orderCount: payload.orderList.length,
        message: error?.message || message,
      });
      return {
        ok: false,
        status,
        message,
        data,
        requestId,
      };
    }
  }

  return Object.freeze({ savePasteOrders });
}

module.exports = {
  DEFAULT_API_BASE_URL,
  createOrderWriteGateway,
  cloneAndValidatePastePayload,
};
