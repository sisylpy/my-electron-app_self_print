const crypto = require('crypto');
const { createCredentialStore } = require('./credential-store');
const {
  PRODUCTION_API_BASE_URL,
  normalizeNongxinleApiBaseUrl,
} = require('../api-runtime');

const API_PREFIX = 'desktop-dispatch/v1/';
const LEGACY_DISPATCH_API_PREFIX = 'nxdisroutedispatch/';
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

  function clearSession() {
    session = null;
    credentialStore.clearSession();
  }

  function normalizeError(response, fallbackMessage) {
    const body = response?.data && typeof response.data === 'object' ? response.data : {};
    const httpStatus = Number(response?.status) || 0;
    const businessStatus = Number(body.code);
    const status = httpStatus >= 200 && httpStatus < 300
      && Number.isInteger(businessStatus) && businessStatus >= 400
      ? businessStatus
      : httpStatus;
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
          msg: '桌面登录已失效，请重新登录',
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
        url: `${options.apiPrefix || API_PREFIX}${relativePath}`,
        data: options.data,
        params: options.params,
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
    return {
      ok: true,
      data: {
        user: payload.user,
        session: accepted.session,
      },
    };
  }

  async function logout() {
    if (session?.accessToken) {
      await request('POST', 'auth/logout');
    }
    clearSession();
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

  function validateSalesRange(input) {
    const params = strictPayload(input || {}, ['startDate', 'endDate']);
    ['startDate', 'endDate'].forEach((key) => {
      if (params[key] !== undefined
          && (typeof params[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(params[key]))) {
        throw new Error(`${key} 日期格式无效`);
      }
    });
    return params;
  }

  function requireReportId(value, field, allowZero = false) {
    const normalized = Number(value);
    if (!Number.isSafeInteger(normalized)
        || normalized > 2147483647
        || (allowZero ? normalized < 0 : normalized <= 0)) {
      throw new Error(`${field} 无效`);
    }
    return normalized;
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
        'routeResourceType',
        'driverRouteId',
        'routeVersion',
        'sandboxEditCredential',
        'canonicalSandboxVersion',
        'sandboxStateFingerprint',
        'sandboxCredentialExpiresAt',
        'stopKeys',
        'removedStopKeys',
        'removalCommandId',
        'initialAddStopKeys',
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
        'routeResourceType',
        'driverRouteId',
        'routeVersion',
        'sandboxEditCredential',
        'canonicalSandboxVersion',
        'sandboxStateFingerprint',
        'sandboxCredentialExpiresAt',
        'stopKeys',
        'removedStopKeys',
        'removalCommandId',
        'initialAddStopKeys',
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
        'routeResourceType',
        'driverRouteId',
        'routeVersion',
        'sandboxEditCredential',
        'canonicalSandboxVersion',
        'sandboxStateFingerprint',
        'maxAddedStops',
        'maxActiveRouteDurationS',
        'latestRouteFinishAt',
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

  async function releaseRoutePreview(input) {
    try {
      const data = strictPayload(input?.payload, [
        'routeDate',
        'batchCode',
        'driverUserId',
        'previewToken',
        'routeResourceType',
        'driverRouteId',
        'routeVersion',
        'sandboxEditCredential',
        'canonicalSandboxVersion',
        'sandboxStateFingerprint',
      ]);
      return request('POST', 'route-edits/preview/release', { data });
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
        'routeResourceType',
        'sandboxEditCredential',
        'canonicalSandboxVersion',
        'sandboxStateFingerprint',
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

  function requirePositiveId(value, field) {
    const normalized = Number(value);
    if (!Number.isSafeInteger(normalized) || normalized <= 0) {
      throw new Error(`${field} 无效`);
    }
    return normalized;
  }

  function legacyDispatchRequest(method, relativePath, options = {}) {
    return request(method, relativePath, {
      ...options,
      apiPrefix: LEGACY_DISPATCH_API_PREFIX,
    });
  }

  async function setDriverDuty(input, dutyOn) {
    try {
      const driverUserId = requirePositiveId(input?.driverUserId, 'driverUserId');
      const data = strictPayload(input?.payload || {}, ['dutyDate']);
      return legacyDispatchRequest(
        'POST',
        `drivers/${driverUserId}/duty/${dutyOn ? 'on' : 'off'}`,
        {
          command: true,
          idempotencyKey: validateIdempotencyKey(input?.idempotencyKey),
          data,
        }
      );
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function updateStopTimeWindow(input) {
    try {
      const data = strictPayload(input?.payload, [
        'routeDate',
        'batchCode',
        'departmentId',
        'depFatherId',
        'sandboxStopKey',
        'deliveryStopId',
        'earliestDeliveryTimeS',
        'latestDeliveryTimeS',
        'serviceMinutes',
        'reason',
        'responsePage',
      ]);
      return legacyDispatchRequest('POST', 'dispatch/sandbox/stops/time-window', {
        command: true,
        idempotencyKey: validateIdempotencyKey(input?.idempotencyKey),
        data,
      });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function returnStopToSandbox(input) {
    try {
      const deliveryStopId = requirePositiveId(input?.deliveryStopId, 'deliveryStopId');
      const data = strictPayload(input?.payload, [
        'routeDate',
        'batchCode',
        'reason',
        'suppressTodayResponse',
      ]);
      return legacyDispatchRequest(
        'POST',
        `sandbox/stops/${deliveryStopId}/return-to-sandbox`,
        {
          command: true,
          idempotencyKey: validateIdempotencyKey(input?.idempotencyKey),
          data,
        }
      );
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function loadManualDispatchPanorama(input) {
    try {
      const data = strictPayload(input?.payload, [
        'routeDate',
        'batchCode',
        'departmentId',
        'depFatherId',
        'sandboxStopKey',
        'liveOrderIds',
      ]);
      return legacyDispatchRequest('POST', 'sandbox/manual-dispatch/driver-panorama', { data });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function departDriver(input) {
    try {
      const driverUserId = requirePositiveId(input?.driverUserId, 'driverUserId');
      const data = strictPayload(input?.payload, [
        'planId',
        'routeDate',
        'batchCode',
        'driverRouteId',
        'departAt',
        'remark',
      ]);
      return legacyDispatchRequest('POST', `drivers/${driverUserId}/depart-now`, {
        command: true,
        idempotencyKey: validateIdempotencyKey(input?.idempotencyKey),
        data,
      });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function deliveryStopCommand(input, returnToSandbox) {
    try {
      const deliveryStopId = requirePositiveId(input?.deliveryStopId, 'deliveryStopId');
      const data = strictPayload(input?.payload, ['routeDate', 'batchCode', 'reason']);
      const relativePath = returnToSandbox
        ? `sandbox/stops/${deliveryStopId}/return-to-sandbox-now`
        : `delivery/stops/${deliveryStopId}/complete-now`;
      return legacyDispatchRequest('POST', relativePath, {
        command: true,
        idempotencyKey: validateIdempotencyKey(input?.idempotencyKey),
        data,
      });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function previewRouteReassignment(input) {
    try {
      const data = strictPayload(input?.payload, [
        'routeDate',
        'batchCode',
        'driverUserId',
        'driverRouteId',
        'routeVersion',
        'targetDriverUserId',
        'stopKeys',
        'sourcePage',
        'previewToken',
      ]);
      return legacyDispatchRequest('POST', 'sandbox/driver-route-edit/preview', { data });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function confirmRouteReassignment(input) {
    try {
      const data = strictPayload(input?.payload, [
        'routeDate',
        'batchCode',
        'driverUserId',
        'driverRouteId',
        'routeVersion',
        'targetDriverUserId',
        'stopKeys',
        'sourcePage',
        'previewToken',
      ]);
      return legacyDispatchRequest('POST', 'sandbox/driver-route-edit/confirm', {
        command: true,
        idempotencyKey: validateIdempotencyKey(input?.idempotencyKey),
        data,
      });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function loadMapConfig() {
    return request('GET', 'map/config');
  }

  async function loadCustomerHistory(input) {
    const departmentId = Number(input?.departmentId);
    if (!Number.isSafeInteger(departmentId) || departmentId <= 0) {
      return {
        ok: false,
        status: 400,
        errorCode: 'INVALID_CUSTOMER_ID',
        message: '客户编号无效',
      };
    }
    return request('GET', 'customer-history/months', {
      params: { departmentId },
    });
  }

  async function loadSalesAnalysisOverview(input) {
    try {
      return request('GET', 'sales-analysis/overview', {
        params: validateSalesRange(input),
      });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function loadSalesAnalysisCategory(input) {
    try {
      const categoryId = requireReportId(input?.categoryId, 'categoryId', true);
      return request('GET', `sales-analysis/categories/${categoryId}`, {
        params: validateSalesRange(input?.range),
      });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function loadSalesAnalysisProductCustomers(input) {
    try {
      const goodsId = requireReportId(input?.goodsId, 'goodsId');
      const params = validateSalesRange(input?.range);
      const limit = input?.limit === undefined ? 5 : Number(input.limit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) {
        throw new Error('limit 无效');
      }
      params.limit = limit;
      return request('GET', `sales-analysis/products/${goodsId}/customers`, { params });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
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
        msg: '桌面登录已失效，请重新登录',
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
    testLogin,
    logout,
    capabilities,
    confirmStop,
    loadRouteEditPage,
    previewRoute,
    previewRouteExpansion,
    releaseRoutePreview,
    confirmRoute,
    lockPlanningStop: (input) => setPlanningStopLock(input, true),
    unlockPlanningStop: (input) => setPlanningStopLock(input, false),
    updateDriverEmployment,
    checkInDriver: (input) => setDriverDuty(input, true),
    checkOutDriver: (input) => setDriverDuty(input, false),
    updateStopTimeWindow,
    returnStopToSandbox,
    loadManualDispatchPanorama,
    departDriver,
    completeDeliveryStop: (input) => deliveryStopCommand(input, false),
    returnDeliveryStopToSandbox: (input) => deliveryStopCommand(input, true),
    previewRouteReassignment,
    confirmRouteReassignment,
    loadCustomerHistory,
    loadSalesAnalysisOverview,
    loadSalesAnalysisCategory,
    loadSalesAnalysisProductCustomers,
    loadMapConfig,
    loadMapTile,
    createId,
    dispose() {},
  };
}

module.exports = { createDispatchGateway };
