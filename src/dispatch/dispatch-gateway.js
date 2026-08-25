const crypto = require('crypto');
const os = require('os');
const QRCode = require('qrcode');
const { createCredentialStore } = require('./credential-store');
const {
  PRODUCTION_API_BASE_URL,
  normalizeNongxinleApiBaseUrl,
} = require('../api-runtime');

const API_PREFIX = 'desktop-dispatch/v1/';
const DEFAULT_API_BASE_URL = PRODUCTION_API_BASE_URL;
const FORBIDDEN_IDENTITY_FIELDS = new Set([
  'disId',
  'operatorUserId',
  'actorUserId',
  'tenantId',
  'roleCode',
  'permissions',
]);

function createId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

function publicSession(session, secureStorageAvailable) {
  if (!session) {
    return {
      authenticated: false,
      secureStorageAvailable,
    };
  }
  return {
    authenticated: true,
    expiresAt: session.expiresAt || null,
    userId: session.userId ?? null,
    disId: session.disId ?? null,
    roleCode: session.roleCode ?? null,
    permissions: Array.isArray(session.permissions) ? session.permissions : [],
    persisted: Boolean(session.persisted),
    secureStorageAvailable,
  };
}

function normalizeBaseUrl(value) {
  return normalizeNongxinleApiBaseUrl(value, '调度 API');
}

function createDispatchGateway({ app, safeStorage, axios }) {
  const credentialStore = createCredentialStore({ app, safeStorage });
  const configuredBase = process.env.NXL_DISPATCH_API_BASE_URL;
  const apiBaseUrl = normalizeBaseUrl(configuredBase || DEFAULT_API_BASE_URL);
  const http = axios.create({
    baseURL: apiBaseUrl,
    timeout: 15_000,
    validateStatus: () => true,
    withCredentials: false,
  });
  let session = credentialStore.loadSession();
  let loginChallenge = null;

  function clearSession() {
    session = null;
    credentialStore.clearSession();
  }

  function normalizeError(response, fallbackMessage) {
    const status = Number(response?.status) || 0;
    const body = response?.data && typeof response.data === 'object' ? response.data : {};
    if (status === 401) clearSession();
    return {
      ok: false,
      status,
      errorCode: body.errorCode || (status === 0 ? 'NETWORK_ERROR' : 'REQUEST_FAILED'),
      message: body.msg || fallbackMessage || '调度服务暂不可用',
      requestId: body.requestId || null,
      reauthRequired: status === 401,
      refreshRequired: status === 409,
    };
  }

  async function request(method, relativePath, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Request-Id': createId(),
    };
    if (options.auth !== false) {
      if (!session?.accessToken) {
        return normalizeError({ status: 401, data: {
          errorCode: 'UNAUTHENTICATED',
          msg: '请先扫码登录后再操作',
        } });
      }
      headers.Authorization = `Bearer ${session.accessToken}`;
    }
    if (options.command) {
      headers['Idempotency-Key'] = options.idempotencyKey;
      headers['X-Client-Version'] = app.getVersion();
    }
    try {
      const response = await http.request({
        method,
        url: `${API_PREFIX}${relativePath}`,
        data: options.data,
        headers,
      });
      const body = response.data && typeof response.data === 'object' ? response.data : {};
      if (response.status >= 200 && response.status < 300 && Number(body.code) === 0) {
        return {
          ok: true,
          status: response.status,
          data: body.data ?? null,
          requestId: body.requestId || null,
        };
      }
      return normalizeError(response);
    } catch (error) {
      return normalizeError(error?.response, '无法连接调度服务，请检查网络后重试');
    }
  }

  function isExpired(expiresAt) {
    if (!expiresAt) return false;
    const timestamp = typeof expiresAt === 'number' ? expiresAt : Date.parse(expiresAt);
    return Number.isFinite(timestamp) && timestamp <= Date.now();
  }

  function acceptAuthSession(auth, persistSession) {
    if (!auth || typeof auth.accessToken !== 'string' || !auth.accessToken) {
      return {
        ok: false,
        status: 502,
        errorCode: 'INVALID_SERVER_RESPONSE',
        message: '服务端未返回有效登录凭证',
      };
    }
    session = {
      accessToken: auth.accessToken,
      expiresAt: auth.expiresAt || null,
      userId: auth.userId ?? null,
      disId: auth.disId ?? null,
      roleCode: auth.roleCode ?? null,
      permissions: Array.isArray(auth.permissions) ? auth.permissions : [],
      persisted: false,
    };
    if (persistSession) {
      const saved = credentialStore.saveSession(session);
      session.persisted = saved.saved;
    } else {
      credentialStore.clearSession();
    }
    return {
      ok: true,
      session: publicSession(session, credentialStore.encryptionAvailable()),
    };
  }

  async function adoptLoginSession(auth, options = {}) {
    const accepted = acceptAuthSession(auth, Boolean(options.persistSession));
    if (!accepted.ok) return accepted;

    // 不信任渲染层传入的角色和权限摘要。保存后立即使用服务端令牌
    // 重新读取真实会话；伪造或过期令牌会在这里被清除。
    const verified = await getSession();
    if (!verified.ok) {
      clearSession();
      return verified;
    }
    loginChallenge = null;
    return verified;
  }

  async function getSession() {
    if (session && isExpired(session.expiresAt)) clearSession();
    if (!session) {
      return {
        ok: true,
        data: publicSession(null, credentialStore.encryptionAvailable()),
      };
    }
    const result = await request('GET', 'auth/me');
    if (!result.ok) {
      return result;
    }
    session = {
      ...session,
      ...result.data,
      accessToken: session.accessToken,
    };
    return {
      ok: true,
      data: publicSession(session, credentialStore.encryptionAvailable()),
    };
  }

  async function beginLogin(options = {}) {
    const verifier = crypto.randomBytes(48).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(verifier).digest('hex');
    const deviceId = credentialStore.getDeviceId();
    const deviceName = String(os.hostname() || 'Electron 桌面端').slice(0, 80);
    const result = await request('POST', 'auth/challenges', {
      auth: false,
      data: { deviceId, codeChallenge },
    });
    if (!result.ok) return result;
    const challengeId = result.data?.challengeId;
    if (typeof challengeId !== 'string' || !/^[0-9a-fA-F]{32}$/.test(challengeId)) {
      return {
        ok: false,
        status: 502,
        errorCode: 'INVALID_SERVER_RESPONSE',
        message: '服务端未返回有效登录挑战',
      };
    }
    // 继续复用服务器的一次性挑战和 PKCE 校验，但二维码本身使用
    // 已上线小程序长期支持的 printerLogin 普通链接。微信扫码后会直接
    // 打开原登录页，避免依赖尚未发布的“电脑登录”页面或自定义 JSON 扫码器。
    const loginUrl = new URL('nxdistributer/printerLogin', apiBaseUrl);
    loginUrl.searchParams.set('scene', challengeId);
    const qrDataUrl = await QRCode.toDataURL(loginUrl.toString(), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    });
    loginChallenge = {
      challengeId,
      verifier,
      deviceName,
      expiresAt: result.data?.expiresAt || null,
      persistSession: Boolean(options.persistSession),
    };
    return {
      ok: true,
      data: {
        status: 'pending',
        challengeId,
        deviceName,
        expiresAt: loginChallenge.expiresAt,
        loginMethod: 'printer-login-link',
        qrDataUrl,
        secureStorageAvailable: credentialStore.encryptionAvailable(),
      },
    };
  }

  async function pollLogin() {
    if (!loginChallenge) {
      return {
        ok: false,
        status: 400,
        errorCode: 'LOGIN_CHALLENGE_MISSING',
        message: '请重新生成登录二维码',
      };
    }
    const result = await request(
      'POST',
      `auth/challenges/${loginChallenge.challengeId}/exchange`,
      {
        auth: false,
        data: { codeVerifier: loginChallenge.verifier },
      }
    );
    if (!result.ok && result.status === 409
        && result.errorCode === 'LOGIN_CHALLENGE_PENDING') {
      return {
        ok: true,
        data: {
          status: 'pending',
          expiresAt: loginChallenge.expiresAt,
        },
      };
    }
    if (!result.ok) {
      if (result.status === 401 || result.errorCode === 'LOGIN_CHALLENGE_CONSUMED') {
        loginChallenge = null;
      }
      return result;
    }
    const accepted = acceptAuthSession(
      result.data || {},
      loginChallenge.persistSession
    );
    if (!accepted.ok) {
      loginChallenge = null;
      return accepted;
    }
    loginChallenge = null;
    return {
      ok: true,
      data: {
        status: 'authenticated',
        session: accepted.session,
      },
    };
  }

  async function testLogin(userId) {
    const normalizedUserId = Number(userId);
    if (!Number.isSafeInteger(normalizedUserId) || normalizedUserId <= 0
        || normalizedUserId > 2147483647) {
      return {
        ok: false,
        status: 400,
        errorCode: 'INVALID_DISTRIBUTER_USER_ID',
        message: '请输入有效的配送商用户ID',
      };
    }

    let response;
    try {
      response = await http.request({
        method: 'POST',
        url: 'desktop-test-login/v1/session',
        data: { userId: normalizedUserId },
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Id': createId(),
          'X-Client-Version': app.getVersion(),
        },
      });
    } catch (error) {
      return normalizeError(error?.response, '无法连接测试登录服务');
    }

    const body = response.data && typeof response.data === 'object' ? response.data : {};
    if (response.status < 200 || response.status >= 300 || Number(body.code) !== 0) {
      return normalizeError(response, '测试登录失败');
    }
    const payload = body.data && typeof body.data === 'object' ? body.data : {};
    if (!payload.user || typeof payload.user !== 'object') {
      return {
        ok: false,
        status: 502,
        errorCode: 'INVALID_SERVER_RESPONSE',
        message: '服务端未返回用户信息',
      };
    }
    const accepted = acceptAuthSession(payload.dispatchAuth, false);
    if (!accepted.ok) return accepted;
    loginChallenge = null;
    return {
      ok: true,
      data: {
        user: payload.user,
        session: accepted.session,
      },
    };
  }

  function cancelLogin() {
    loginChallenge = null;
    return { ok: true, data: { status: 'cancelled' } };
  }

  async function logout() {
    if (session?.accessToken) {
      await request('POST', 'auth/logout');
    }
    clearSession();
    loginChallenge = null;
    return {
      ok: true,
      data: publicSession(null, credentialStore.encryptionAvailable()),
    };
  }

  function strictPayload(input, allowedFields) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('调度请求参数无效');
    }
    const scanForbiddenIdentityFields = (value) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(scanForbiddenIdentityFields);
        return;
      }
      Object.keys(value).forEach((key) => {
        if (FORBIDDEN_IDENTITY_FIELDS.has(key)) {
          throw new Error(`调度请求禁止提交 ${key}`);
        }
        scanForbiddenIdentityFields(value[key]);
      });
    };
    scanForbiddenIdentityFields(input);
    for (const key of Object.keys(input)) {
      if (FORBIDDEN_IDENTITY_FIELDS.has(key)) {
        throw new Error(`调度请求禁止提交 ${key}`);
      }
      if (!allowedFields.includes(key)) {
        throw new Error(`调度请求包含未允许字段 ${key}`);
      }
    }
    const output = {};
    allowedFields.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(input, key)) output[key] = input[key];
    });
    return output;
  }

  function validateIdempotencyKey(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{16,128}$/.test(value)) {
      throw new Error('幂等键无效');
    }
    return value;
  }

  async function capabilities() {
    return request('GET', 'capabilities');
  }

  async function confirmStop(input) {
    try {
      const data = strictPayload(input?.payload, [
        'routeDate',
        'batchCode',
        'taskId',
        'depFatherId',
        'sandboxStopKey',
        'driverUserId',
        'manualStopSeq',
        'assignReason',
        'liveOrderIds',
        'expectedTaskVersion',
        'expectedRouteVersion',
      ]);
      return request('POST', 'stops/confirm', {
        command: true,
        idempotencyKey: validateIdempotencyKey(input?.idempotencyKey),
        data,
      });
    } catch (error) {
      return {
        ok: false,
        status: 400,
        errorCode: 'INVALID_REQUEST',
        message: error.message,
      };
    }
  }

  async function previewRoute(input) {
    try {
      const data = strictPayload(input?.payload, [
        'routeDate',
        'batchCode',
        'driverUserId',
        'stopKeys',
        'sourcePage',
        'manualDispatch',
        'departmentId',
        'depFatherId',
        'previewToken',
        'routeExpansionProposalId',
      ]);
      return request('POST', 'route-edits/preview', { data });
    } catch (error) {
      return {
        ok: false,
        status: 400,
        errorCode: 'INVALID_REQUEST',
        message: error.message,
      };
    }
  }

  async function loadRouteEditPage(input) {
    try {
      const data = strictPayload(input?.payload, [
        'routeDate',
        'batchCode',
        'driverUserId',
        'stopKeys',
        'sourcePage',
        'manualDispatch',
        'departmentId',
        'depFatherId',
      ]);
      return request('POST', 'route-edits/page', { data });
    } catch (error) {
      return {
        ok: false,
        status: 400,
        errorCode: 'INVALID_REQUEST',
        message: error.message,
      };
    }
  }

  async function previewRouteExpansion(input) {
    try {
      const data = strictPayload(input?.payload, [
        'routeDate',
        'batchCode',
        'driverUserId',
        'previewToken',
        'maxAddedStops',
        'maxActiveRouteDurationS',
        'maxRoadDistanceM',
      ]);
      return request('POST', 'route-edits/expansion/preview', { data });
    } catch (error) {
      return {
        ok: false,
        status: 400,
        errorCode: 'INVALID_REQUEST',
        message: error.message,
      };
    }
  }

  async function confirmRoute(input) {
    try {
      const data = strictPayload(input?.payload, [
        'routeDate',
        'batchCode',
        'driverUserId',
        'driverRouteId',
        'stopKeys',
        'liveOrderIds',
        'previewToken',
        'confirmReason',
        'expectedRouteVersion',
        'expectedTaskVersions',
      ]);
      return request('POST', 'route-edits/confirm', {
        command: true,
        idempotencyKey: validateIdempotencyKey(input?.idempotencyKey),
        data,
      });
    } catch (error) {
      return {
        ok: false,
        status: 400,
        errorCode: 'INVALID_REQUEST',
        message: error.message,
      };
    }
  }

  async function setPlanningStopLock(input, locked) {
    try {
      const fields = [
        'routeDate',
        'batchCode',
        'depFatherId',
        'departmentId',
        'expectedVersion',
      ];
      if (locked) fields.push('driverUserId');
      const data = strictPayload(input?.payload, fields);
      return request('POST', `planning/stops/${locked ? 'lock' : 'unlock'}`, { data });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function updateDriverEmployment(input) {
    try {
      const driverUserId = Number(input?.driverUserId);
      if (!Number.isSafeInteger(driverUserId) || driverUserId <= 0) {
        throw new Error('driverUserId 无效');
      }
      const data = strictPayload(input?.payload, ['employmentType']);
      return request('POST', `drivers/${driverUserId}/employment-type`, { data });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function loadMapConfig() {
    return request('GET', 'map/config');
  }

  async function loadMapTile(input) {
    const zoom = Number(input?.z);
    const x = Number(input?.x);
    const y = Number(input?.y);
    if (!Number.isSafeInteger(zoom) || zoom < 0 || zoom > 20
        || !Number.isSafeInteger(x) || x < 0
        || !Number.isSafeInteger(y) || y < 0) {
      return { ok: false, status: 400, errorCode: 'INVALID_TILE', message: '地图瓦片参数无效' };
    }
    if (!session?.accessToken) {
      return normalizeError({ status: 401, data: {
        errorCode: 'UNAUTHENTICATED',
        msg: '请先扫码登录后再查看调度地图',
      } });
    }
    try {
      const response = await http.request({
        method: 'GET',
        url: `${API_PREFIX}map/tiles/${zoom}/${x}/${y}.png`,
        responseType: 'arraybuffer',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'X-Request-Id': createId(),
          Accept: 'image/png',
        },
      });
      const contentType = String(response.headers?.['content-type'] || '');
      if (response.status >= 200 && response.status < 300
          && contentType.toLowerCase().includes('image/png')) {
        return {
          ok: true,
          status: response.status,
          data: Buffer.from(response.data).toString('base64'),
          contentType: 'image/png',
        };
      }
      let body = {};
      try {
        body = JSON.parse(Buffer.from(response.data || []).toString('utf8'));
      } catch (ignored) {
        body = {};
      }
      return normalizeError({ status: response.status, data: body }, '华为地图服务暂不可用');
    } catch (error) {
      return normalizeError(error?.response, '无法连接华为地图服务');
    }
  }

  return {
    getSession,
    adoptLoginSession,
    beginLogin,
    pollLogin,
    testLogin,
    cancelLogin,
    logout,
    capabilities,
    confirmStop,
    loadRouteEditPage,
    previewRoute,
    previewRouteExpansion,
    confirmRoute,
    lockPlanningStop: (input) => setPlanningStopLock(input, true),
    unlockPlanningStop: (input) => setPlanningStopLock(input, false),
    updateDriverEmployment,
    loadMapConfig,
    loadMapTile,
    createId,
    dispose() {
      loginChallenge = null;
    },
  };
}

module.exports = { createDispatchGateway };
