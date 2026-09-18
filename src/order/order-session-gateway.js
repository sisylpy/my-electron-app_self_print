const {
  PRODUCTION_API_BASE_URL,
  normalizeNongxinleApiBaseUrl,
} = require('../api-runtime');

const SESSION_COOKIE = 'JSESSIONID';
const LOGIN_SESSION_PATTERN = /^session-[a-z0-9]{9}$/;

function failure(status, data, fallback) {
  return {
    ok: false,
    status,
    data: data && typeof data === 'object' ? data : null,
    message: data?.msg || data?.message || fallback,
  };
}

function positiveId(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function sessionCookieFromHeaders(headers) {
  const values = headers?.['set-cookie'];
  const cookies = Array.isArray(values) ? values : values ? [values] : [];
  for (const cookie of cookies) {
    const match = /^JSESSIONID=([^;\s]+)/i.exec(String(cookie));
    if (match && /^[A-Za-z0-9._-]+$/.test(match[1])) return match[1];
  }
  return null;
}

function createOrderSessionGateway({ axios, cookieStore, apiBaseUrl }) {
  const baseURL = normalizeNongxinleApiBaseUrl(
    apiBaseUrl || PRODUCTION_API_BASE_URL,
    '桌面订单 API'
  );
  const http = axios.create({
    baseURL,
    timeout: 15_000,
    maxRedirects: 0,
    validateStatus: () => true,
    withCredentials: false,
  });
  let pendingSessionId = null;
  let authenticatedDisId = null;

  async function cookieHeader() {
    const cookies = await cookieStore.get({ url: baseURL });
    const cookie = cookies.find((item) => item.name === SESSION_COOKIE);
    return cookie ? `${SESSION_COOKIE}=${cookie.value}` : null;
  }

  async function clear() {
    await cookieStore.remove(baseURL, SESSION_COOKIE);
  }

  async function pollLogin(sessionId) {
    if (typeof sessionId !== 'string' || !LOGIN_SESSION_PATTERN.test(sessionId)) {
      return failure(400, null, '扫码会话标识无效');
    }
    try {
      if (pendingSessionId !== sessionId) {
        await clear();
        pendingSessionId = sessionId;
        authenticatedDisId = null;
      }
      const response = await http.get(
        `nxdistributeruser/checkLoginStatus/${sessionId}`
      );
      if (response.status < 200 || response.status >= 300
          || Number(response.data?.code) !== 0) {
        return failure(response.status, response.data, '扫码登录状态读取失败');
      }
      const body = response.data;
      if (body?.loggedIn) {
        const value = sessionCookieFromHeaders(response.headers);
        if (!value || !positiveId(body.user?.nxDistributerUserId)
            || !positiveId(body.user?.nxDiuDistributerId)) {
          return failure(502, null, '服务器未建立有效订单会话，请重新扫码');
        }
        // 主进程保存 HttpOnly 会话；file:// 页面不能直接依赖跨站 Cookie。
        // Strict 阻止渲染进程跨站请求自动携带它，只在下方白名单接口显式使用。
        await cookieStore.set({
          url: baseURL,
          name: SESSION_COOKIE,
          value,
          path: '/nongxinle',
          secure: baseURL.startsWith('https:'),
          httpOnly: true,
          sameSite: 'strict',
        });
        authenticatedDisId = Number(body.user.nxDiuDistributerId);
      }
      return { ok: true, status: response.status, data: body };
    } catch {
      return failure(0, null, '无法连接扫码登录服务');
    }
  }

  async function requestOrder(method, path, form) {
    const cookie = await cookieHeader();
    if (!cookie) return failure(401, null, '订单登录会话已失效，请重新扫码登录');
    try {
      const config = { headers: { Cookie: cookie } };
      const response = method === 'GET'
        ? await http.get(path, config)
        : await http.post(path, form.toString(), {
          ...config,
          headers: { ...config.headers, 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      if (response.status === 401) {
        await clear();
        authenticatedDisId = null;
      }
      if (response.status < 200 || response.status >= 300
          || Number(response.data?.code) !== 0) {
        return failure(response.status, response.data, '订单读取失败');
      }
      return { ok: true, status: response.status, data: response.data };
    } catch {
      return failure(0, null, '无法连接订单服务');
    }
  }

  function todayCustomers(disId) {
    const id = positiveId(disId);
    if (!id) return Promise.resolve(failure(400, null, '配送商 ID 无效'));
    if (authenticatedDisId && id !== authenticatedDisId) {
      return Promise.resolve(failure(403, null, '登录身份与配送商不一致'));
    }
    return requestOrder('GET', `nxdepartmentorders/webNxDisGetTodayOrderCustomer/${id}`);
  }

  function phoneOrders(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return Promise.resolve(failure(400, null, '订单查询参数无效'));
    }
    const disId = positiveId(input.disId);
    const depFatherId = Number(input.depFatherId);
    const gbDepFatherId = input.gbDepFatherId == null ? -1 : Number(input.gbDepFatherId);
    if (!disId || !Number.isSafeInteger(depFatherId) || depFatherId < -1
        || !Number.isSafeInteger(gbDepFatherId) || gbDepFatherId < -1
        || (depFatherId <= 0 && gbDepFatherId <= 0)) {
      return Promise.resolve(failure(400, null, '配送商或客户 ID 无效'));
    }
    if (authenticatedDisId && disId !== authenticatedDisId) {
      return Promise.resolve(failure(403, null, '登录身份与配送商不一致'));
    }
    const form = new URLSearchParams({
      disId: String(disId),
      depFatherId: String(depFatherId),
      gbDepFatherId: String(gbDepFatherId),
    });
    for (const key of ['depId', 'resFatherId']) {
      if (input[key] == null) continue;
      const value = Number(input[key]);
      if (!Number.isSafeInteger(value) || value < -1) {
        return Promise.resolve(failure(400, null, `${key} 无效`));
      }
      form.set(key, String(value));
    }
    return requestOrder('POST', 'nxdepartmentorders/phoneGetToFillDepOrders', form);
  }

  async function logout() {
    let remoteFailed = false;
    try {
      const cookie = await cookieHeader();
      if (cookie) {
        const response = await http.post('nxdistributeruser/logoutDesktopOrderSession', null, {
          headers: { Cookie: cookie },
        });
        remoteFailed = response.status < 200 || response.status >= 300
          || Number(response.data?.code) !== 0;
      }
    } catch {
      remoteFailed = true;
    } finally {
      // 即使服务端暂不可达，本机也必须移除旧会话。
      await clear();
      pendingSessionId = null;
      authenticatedDisId = null;
    }
    return remoteFailed
      ? failure(0, null, '本机已退出，服务端会话清理未确认')
      : { ok: true };
  }

  return { pollLogin, todayCustomers, phoneOrders, logout };
}

module.exports = { createOrderSessionGateway };
