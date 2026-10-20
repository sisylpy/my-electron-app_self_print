const {
  PRODUCTION_API_BASE_URL,
  normalizeNongxinleApiBaseUrl,
} = require('../api-runtime');

const SESSION_COOKIE = 'JSESSIONID';
const LOGIN_SESSION_PATTERN = /^session-[a-z0-9]{9}$/;
const MAX_QWEN_REQUEST_BYTES = 30 * 1024 * 1024;

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

function cloneAndValidateQwenPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('图片订单识别参数无效');
  }
  const imageBase64 = typeof input.ImageBase64 === 'string' ? input.ImageBase64 : '';
  if (!/^data:image\/(?:jpeg|jpg|png|webp|gif|bmp);base64,[A-Za-z0-9+/=\r\n]+$/i.test(imageBase64)) {
    throw new Error('图片订单原图内容无效');
  }
  const depId = positiveId(input.depId);
  const depFatherId = positiveId(input.depFatherId);
  const disId = positiveId(input.disId);
  const userId = positiveId(input.userId);
  if (!depId || !depFatherId || !disId || !userId) {
    throw new Error('图片订单客户或登录身份无效');
  }

  const payload = { ImageBase64: imageBase64, depId, depFatherId, disId, userId };
  if (input.wechatOrderSource != null) {
    // 来源元数据已经由微信读取链路生成；这里仍通过 JSON 往返去掉 Vue Proxy、函数等
    // structured-clone 不支持的值，主进程只向固定接口转发普通数据。
    payload.wechatOrderSource = input.wechatOrderSource;
  }

  let serialized;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    throw new Error('图片订单识别参数无法序列化');
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_QWEN_REQUEST_BYTES) {
    throw new Error('图片订单原图过大，请压缩后重试');
  }
  return JSON.parse(serialized);
}

const NOOP_REMEMBER_TOKEN_STORE = {
  read: async () => null,
  write: async () => {},
  clear: async () => {},
};

function createOrderSessionGateway({
  axios,
  cookieStore,
  apiBaseUrl,
  rememberEnabled = () => false,
  rememberTokenStore = NOOP_REMEMBER_TOKEN_STORE,
}) {
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

  async function storeAuthenticatedCookie(value, disId) {
    const cookieOptions = {
      url: baseURL,
      name: SESSION_COOKIE,
      value,
      path: '/nongxinle',
      secure: baseURL.startsWith('https:'),
      httpOnly: true,
      sameSite: 'strict',
    };
    if (rememberEnabled()) {
      // 仅勾选「记住用户」时跨重启保留；服务端 HttpSession 过期仍需登录。
      cookieOptions.expirationDate = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    }
    await cookieStore.set(cookieOptions);
    authenticatedDisId = disId;
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
        await storeAuthenticatedCookie(value, Number(body.user.nxDiuDistributerId));
        // 只有在「记住用户 / 自动登录」开启时才保存长会话令牌；否则清掉旧令牌，
        // 保证关闭自动登录后本机不留可静默换回会话的凭据。
        if (rememberEnabled() && typeof body.rememberToken === 'string'
            && body.rememberToken) {
          await rememberTokenStore.write(body.rememberToken);
        } else {
          await rememberTokenStore.clear();
        }
      }
      return { ok: true, status: response.status, data: body };
    } catch {
      return failure(0, null, '无法连接扫码登录服务');
    }
  }

  async function testLogin(userId) {
    const normalizedUserId = positiveId(userId);
    if (!normalizedUserId) return failure(400, null, '配送商用户 ID 无效');
    try {
      await clear();
      pendingSessionId = null;
      authenticatedDisId = null;
      const response = await http.post(
        'desktop-test-login/v1/browser-session',
        { userId: normalizedUserId },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const body = response.data && typeof response.data === 'object' ? response.data : {};
      const user = body.data && typeof body.data === 'object' ? body.data : null;
      const value = sessionCookieFromHeaders(response.headers);
      const disId = positiveId(user?.nxDiuDistributerId);
      if (response.status < 200 || response.status >= 300 || Number(body.code) !== 0) {
        if (response.status === 403) {
          return failure(403, null, '测试服务器拒绝了当前网络，请更新测试登录白名单');
        }
        return failure(response.status, body, '测试订单会话建立失败');
      }
      if (!value || !positiveId(user?.nxDistributerUserId) || !disId) {
        return failure(502, null, '测试服务器未建立有效订单会话');
      }
      await storeAuthenticatedCookie(value, disId);
      // 测试 ID 登录与扫码登录使用同一套自动登录令牌：开启「记住用户」时保存，
      // 关闭时清掉，保证重启自动登录行为一致。
      if (rememberEnabled() && typeof body.rememberToken === 'string' && body.rememberToken) {
        await rememberTokenStore.write(body.rememberToken);
      } else {
        await rememberTokenStore.clear();
      }
      return { ok: true, status: response.status, data: user };
    } catch {
      return failure(0, null, '无法连接测试订单会话服务');
    }
  }

  // 并发的 401 请求共用一次续期：服务端 refresh 会 changeSessionId，旧 JSESSIONID
  // 立刻失效，重复刷新反而让其它并发请求拿到已作废的 Cookie。
  let refreshInFlight = null;

  async function tryRefreshOnce() {
    if (refreshInFlight) return refreshInFlight;
    const task = (async () => {
      try {
        return (await refreshSession()).ok;
      } catch {
        return false;
      }
    })();
    refreshInFlight = task;
    try {
      return await task;
    } finally {
      if (refreshInFlight === task) refreshInFlight = null;
    }
  }

  /**
   * 订单业务请求统一入口。
   *
   * HttpSession 过期（401）或本机会话 Cookie 缺失时，先用「记住用户」令牌静默
   * 续期，再用新会话重试一次原请求，业务侧无感知。
   *
   * 只有令牌不存在、被服务端判定失效，或续期后仍为 401 才清除本机会话；
   * 网络不可达（status 0）不动任何凭据，断网或服务端重启后恢复即可继续使用。
   */
  async function withSessionRetry(perform) {
    async function attempt() {
      if (!await cookieHeader()) {
        if (!await tryRefreshOnce()) {
          return failure(401, null, '订单登录会话已失效，请重新扫码登录');
        }
      }
      return perform();
    }

    let result = await attempt();
    if (Number(result?.status) !== 401) return result;

    if (!await tryRefreshOnce()) {
      await clear();
      authenticatedDisId = null;
      return failure(401, result?.data || null,
        result?.message || '自动登录已失效，请重新扫码登录');
    }

    result = await attempt();
    if (Number(result?.status) === 401) {
      await clear();
      authenticatedDisId = null;
    }
    return result;
  }

  async function requestOrder(method, path, form) {
    return withSessionRetry(async () => {
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
        if (response.status < 200 || response.status >= 300
            || Number(response.data?.code) !== 0) {
          return failure(response.status, response.data, '订单读取失败');
        }
        return { ok: true, status: response.status, data: response.data };
      } catch {
        return failure(0, null, '无法连接订单服务');
      }
    });
  }

  async function recognizeOrderQwen(input) {
    let payload;
    try {
      payload = cloneAndValidateQwenPayload(input);
    } catch (error) {
      return failure(400, null, error.message);
    }
    if (authenticatedDisId && payload.disId !== authenticatedDisId) {
      return failure(403, null, '登录身份与配送商不一致');
    }
    return withSessionRetry(async () => {
      const cookie = await cookieHeader();
      if (!cookie) return failure(401, null, '订单登录会话已失效，请重新扫码登录');
      try {
        const response = await http.post('ocr/recognizeOrderQwen', payload, {
          headers: {
            Cookie: cookie,
            'Content-Type': 'application/json',
          },
          timeout: 300_000,
        });
        if (response.status < 200 || response.status >= 300
            || Number(response.data?.code) !== 0) {
          return failure(response.status, response.data, '图片订单识别保存失败');
        }
        return { ok: true, status: response.status, data: response.data };
      } catch {
        return failure(0, null, '无法连接图片订单识别服务');
      }
    });
  }

  // 双列/复杂图片订单：前端 recognizeOrderOCRWithAi 走的就是 ocr/recognizeOrderAsync，
  // 后端固定按 complex=true 使用千问 Max 模型。这里只替换传输通道（补会话 Cookie），
  // 不改变接口、参数与模型选择。
  async function recognizeOrderAsync(input) {
    let payload;
    try {
      payload = cloneAndValidateQwenPayload(input);
    } catch (error) {
      return failure(400, null, error.message);
    }
    if (authenticatedDisId && payload.disId !== authenticatedDisId) {
      return failure(403, null, '登录身份与配送商不一致');
    }
    return withSessionRetry(async () => {
      const cookie = await cookieHeader();
      if (!cookie) return failure(401, null, '订单登录会话已失效，请重新扫码登录');
      try {
        const response = await http.post('ocr/recognizeOrderAsync', payload, {
          headers: {
            Cookie: cookie,
            'Content-Type': 'application/json',
          },
          timeout: 300_000,
        });
        if (response.status < 200 || response.status >= 300
            || Number(response.data?.code) !== 0) {
          return failure(response.status, response.data, '双列图片订单识别失败');
        }
        return { ok: true, status: response.status, data: response.data };
      } catch {
        return failure(0, null, '无法连接双列图片订单识别服务');
      }
    });
  }

  function todayCustomers(disId) {
    const id = positiveId(disId);
    if (!id) return Promise.resolve(failure(400, null, '配送商 ID 无效'));
    if (authenticatedDisId && id !== authenticatedDisId) {
      return Promise.resolve(failure(403, null, '登录身份与配送商不一致'));
    }
    return requestOrder('GET', `nxdepartmentorders/webNxDisGetTodayOrderCustomer/${id}`);
  }

  function orderWorkbenchOverview(disId) {
    const id = positiveId(disId);
    if (!id || (authenticatedDisId && id !== authenticatedDisId)) {
      return Promise.resolve(failure(403, null, '配送商身份不一致'));
    }
    return requestOrder('GET', `nxdepartmentorders/disGetTodayOrderCustomer/${id}`);
  }

  async function ocrTaskStatus(taskId) {
    const id = positiveId(taskId);
    if (!id) return failure(400, null, '订单任务 ID 无效');
    // 持久 Cookie 可在重启后继续使用，但配送商身份只保存在当前主进程内存中。
    // 查询任务归属前通过记住用户令牌恢复身份，不能把身份缺失误判为任务不属于本商户。
    if (!authenticatedDisId) {
      const restored = await refreshSession();
      if (!restored.ok) return restored;
    }
    const response = await requestOrder('GET', `ocr/getTaskOrders/${id}?page=1&limit=1&processStatus=false`);
    if (!response.ok) return response;
    const task = response.data?.task;
    if (!authenticatedDisId || Number(task?.nxOcrTaskDistributerId) !== authenticatedDisId) {
      return failure(403, null, '订单任务不属于当前配送商');
    }
    return { ok: true, status: response.status, data: { code: 0, task: {
      nxOcrTaskStatus: task.nxOcrTaskStatus,
    } } };
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

  /**
   * 自动登录续期：服务端 HttpSession 过期后，凭「记住用户」签发的长会话令牌
   * 重新换取订单会话。令牌不存在或已失效时返回 401，由调用方回到扫码登录。
   */
  async function refreshSession() {
    const token = await rememberTokenStore.read();
    if (!token) return failure(401, null, '本机没有可自动登录的凭据，请扫码登录');
    try {
      const response = await http.post(
        'desktop-order-session/v1/refresh',
        { token },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const body = response.data && typeof response.data === 'object' ? response.data : null;
      const value = sessionCookieFromHeaders(response.headers);
      const disId = positiveId(body?.data?.user?.nxDiuDistributerId);
      const userId = positiveId(body?.data?.user?.nxDistributerUserId);
      if (response.status === 401 || response.status === 400) {
        await rememberTokenStore.clear();
        return failure(401, body, '自动登录已失效，请重新扫码登录');
      }
      if (response.status < 200 || response.status >= 300 || Number(body?.code) !== 0
          || !value || !disId || !userId) {
        return failure(response.status, body, '自动登录续期失败，请重新扫码登录');
      }
      await storeAuthenticatedCookie(value, disId);
      return { ok: true, status: response.status, data: body.data };
    } catch {
      return failure(0, null, '无法连接自动登录服务');
    }
  }

  /**
   * 用当前已登录会话补签自动登录令牌：用户在登录后才打开「记住用户」开关时，
   * 不必重新扫码也能拿到令牌。会话无效时返回 401，由调用方提示重新登录。
   */
  async function issueRememberToken() {
    const cookie = await cookieHeader();
    if (!cookie) return failure(401, null, '当前没有已登录的订单会话，请重新登录后再开启');
    try {
      const response = await http.post(
        'desktop-order-session/v1/issue',
        {},
        { headers: { Cookie: cookie, 'Content-Type': 'application/json' } }
      );
      const body = response.data && typeof response.data === 'object' ? response.data : null;
      const token = typeof body?.data === 'string' ? body.data : null;
      if (response.status === 401 || response.status === 403) {
        await rememberTokenStore.clear();
        return failure(response.status, body, '当前订单会话已失效，请重新登录后再开启');
      }
      if (response.status < 200 || response.status >= 300 || Number(body?.code) !== 0 || !token) {
        return failure(response.status, body, '自动登录令牌补签失败');
      }
      await rememberTokenStore.write(token);
      return { ok: true, status: response.status, data: { token } };
    } catch {
      return failure(0, null, '无法连接自动登录服务');
    }
  }

  /**
   * 退出订单会话。
   *
   * `keepRememberToken: true`（侧栏「退出登录」）只结束当前会话，保留「记住用户」
   * 开关对应的本机令牌——自动登录是用户在设置里明确开启的偏好，退出登录不应该
   * 把它一起关掉；只有设置开关关闭 / 菜单「取消自动登录」才会撤销令牌。
   */
  async function logout(options = {}) {
    const keepRememberToken = options?.keepRememberToken === true;
    let remoteFailed = false;
    const rememberedToken = await rememberTokenStore.read();
    if (rememberedToken && !keepRememberToken) {
      try {
        await http.post(
          'desktop-order-session/v1/revoke',
          { token: rememberedToken },
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch {
        // 服务端不可达时本机仍必须清除令牌。
      }
      await rememberTokenStore.clear();
    }
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

  return {
    pollLogin,
    testLogin,
    todayCustomers,
    orderWorkbenchOverview,
    ocrTaskStatus,
    phoneOrders,
    recognizeOrderQwen,
    recognizeOrderAsync,
    refreshSession,
    issueRememberToken,
    logout,
  };
}

module.exports = { createOrderSessionGateway, cloneAndValidateQwenPayload };
