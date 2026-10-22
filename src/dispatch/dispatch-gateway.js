const crypto = require('crypto');
const { createCredentialStore } = require('./credential-store');
const {
  PRODUCTION_API_BASE_URL,
  normalizeNongxinleApiBaseUrl,
} = require('../api-runtime');

const API_PREFIX = 'desktop-dispatch/v1/';
const WECHAT_SCAN_V2_API_PREFIX = 'desktop-dispatch/v2/';
const LEGACY_DISPATCH_API_PREFIX = 'nxdisroutedispatch/';
const CONNECTOR_CREDENTIAL_API_PREFIX = 'connector/credential/';
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

function createDispatchGateway({ app, safeStorage, axios, renewDispatchSession = null }) {
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
  let renewalInFlight = null;
  /** 最近一次续期失败的结果；null 表示没有失败或失败原因未知。 */
  let lastRenewalFailure = null;

  async function renewOnce() {
    if (typeof renewDispatchSession !== 'function') {
      lastRenewalFailure = null;
      return false;
    }
    if (renewalInFlight) return renewalInFlight;
    const task = (async () => {
      try {
        const auth = await renewDispatchSession();
        const failed = auth && auth.ok === false ? auth : null;
        if (!auth || typeof auth.accessToken !== 'string' || !auth.accessToken) {
          lastRenewalFailure = failed;
          return false;
        }
        lastRenewalFailure = null;
        return acceptAuthSession(auth, true).ok;
      } catch {
        lastRenewalFailure = { ok: false, status: 0, message: '无法连接自动登录服务' };
        return false;
      }
    })();
    renewalInFlight = task;
    try {
      return await task;
    } finally {
      if (renewalInFlight === task) renewalInFlight = null;
    }
  }

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
      // 本地没有令牌或令牌已过期时先用长期登录令牌续期，避免拿过期令牌白跑一趟 401。
      if (!session?.accessToken || isExpired(session.expiresAt)) await renewOnce();
      if (!session?.accessToken) {
        if (lastRenewalFailure && Number(lastRenewalFailure.status) === 0) {
          // 续期请求本身连不上，不是登录失效：不能提示重新登录，也不能清掉本机凭证。
          return {
            ok: false,
            status: 0,
            errorCode: 'NETWORK_ERROR',
            message: lastRenewalFailure.message || '无法连接调度服务，请检查网络后重试',
            requestId: null,
            reauthRequired: false,
            refreshRequired: false,
          };
        }
        return normalizeError({ status: 401, data: {
          errorCode: lastRenewalFailure?.data?.errorCode || 'UNAUTHENTICATED',
          msg: '桌面登录已失效，请重新登录',
        } });
      }
    }
    if (options.command) {
      headers['Idempotency-Key'] = options.idempotencyKey;
      headers['X-Client-Version'] = app.getVersion();
    }
    const send = () => http.request({
        method,
        url: `${options.apiPrefix || API_PREFIX}${relativePath}`,
        data: options.data,
        params: options.params,
        headers: options.auth === false ? headers : {
          ...headers, Authorization: `Bearer ${session.accessToken}`,
        },
        timeout: options.timeout || undefined,
      });
    try {
      const sentToken = session?.accessToken;
      let response = await send();
      // 服务端 401（HTTP 401 或业务码 401）都先按现有 remember token 续期再重试一次。
      const unauthorized = response.status === 401
          || (response.status >= 200 && response.status < 300
              && Number(response.data?.code) === 401);
      if (options.auth !== false && unauthorized
          && (session?.accessToken !== sentToken || await renewOnce())) {
        response = await send();
      }
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

  /**
   * 读取当前配送商的商业套餐快照，供桌面端按套餐开放功能入口。
   * 未迁移或读取不到套餐时返回 null，调用方按现有兼容机制处理，不按基础版降级。
   */
  async function loadCommercialEntitlement() {
    const result = await request('GET', 'commercial-entitlements');
    if (!result.ok) return result;
    const snapshot = result.data && typeof result.data === 'object' ? result.data : {};
    const plan = typeof snapshot.currentPlan === 'string' ? snapshot.currentPlan : '';
    return { ok: true, status: result.status, data: { currentPlan: plan || null } };
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
      const result = normalizeError(error?.response, '无法连接测试登录服务');
      if (result.status === 403) {
        result.errorCode = 'TEST_LOGIN_NETWORK_NOT_ALLOWED';
        result.message = '测试服务器拒绝了当前网络，请更新测试登录白名单';
      }
      return result;
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

  function validateSalesPagination(pageValue, pageSizeValue) {
    const page = pageValue === undefined ? 1 : Number(pageValue);
    const pageSize = pageSizeValue === undefined ? 20 : Number(pageSizeValue);
    if (!Number.isSafeInteger(page) || page < 1 || page > 2147483647) {
      throw new Error('page 无效');
    }
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new Error('pageSize 无效');
    }
    return { page, pageSize };
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

  async function listCustomerOcrTasks(input) {
    try {
      const customerId = requirePositiveId(input?.customerId, 'customerId');
      return request('GET', 'customer-ocr-training/tasks', { params: { customerId } });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function loadCustomerOcrTask(input) {
    try {
      const data = strictPayload(input || {}, ['scene', 'taskId']);
      const scene = String(data.scene || '').toUpperCase();
      if (!['FORMAL', 'PRETRAINING'].includes(scene)) throw new Error('任务类型无效');
      const taskId = requirePositiveId(data.taskId, 'taskId');
      return request('GET', `customer-ocr-training/tasks/${scene}/${taskId}`, {
        timeout: 60_000,
      });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function createCustomerOcrTraining(input) {
    try {
      const data = strictPayload(input || {}, [
        'customerId', 'departmentId', 'sampleDate', 'sourceType', 'sourceName',
        'sourceText', 'imageBase64', 'recognitionMode', 'items',
      ]);
      data.customerId = requirePositiveId(data.customerId, 'customerId');
      data.departmentId = requirePositiveId(data.departmentId, 'departmentId');
      if (typeof data.sampleDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.sampleDate)) {
        throw new Error('样本日期格式无效');
      }
      data.sourceType = String(data.sourceType || '').toUpperCase();
      if (!['PASTE', 'IMAGE', 'EXCEL_PASTE'].includes(data.sourceType)) throw new Error('数据来源无效');
      if (data.sourceName !== undefined && (typeof data.sourceName !== 'string' || data.sourceName.length > 255)) {
        throw new Error('来源名称过长');
      }
      if (data.sourceText !== undefined && (typeof data.sourceText !== 'string' || data.sourceText.length > 20_000)) {
        throw new Error('粘贴内容过长');
      }
      if (data.imageBase64 !== undefined && (typeof data.imageBase64 !== 'string' || data.imageBase64.length > 14_000_000)) {
        throw new Error('图片过大');
      }
      if (data.sourceType === 'IMAGE') {
        data.recognitionMode = String(data.recognitionMode || 'COMPLEX').toUpperCase();
        if (!['FAST', 'COMPLEX'].includes(data.recognitionMode)) throw new Error('图片识别模式无效');
      } else {
        delete data.recognitionMode;
      }
      if (data.items !== undefined) {
        if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 500) {
          throw new Error('Excel明细数量无效');
        }
        data.items = data.items.map((item) => strictPayload(item, [
          'rawText', 'goodsName', 'quantity', 'standard', 'remark',
        ]));
      }
      return request('POST', 'customer-ocr-training/tasks', { data, timeout: 180_000 });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function updateCustomerOcrTrainingItem(input) {
    try {
      const envelope = strictPayload(input || {}, ['taskId', 'itemId', 'payload']);
      const taskId = requirePositiveId(envelope.taskId, 'taskId');
      const itemId = requirePositiveId(envelope.itemId, 'itemId');
      const data = strictPayload(envelope.payload || {}, [
        'rawText', 'goodsName', 'quantity', 'standard', 'remark',
        'matchedDisGoodsId', 'conflictResolution',
      ]);
      data.matchedDisGoodsId = requirePositiveId(data.matchedDisGoodsId, 'matchedDisGoodsId');
      if (typeof data.goodsName !== 'string' || !data.goodsName.trim() || data.goodsName.length > 255) {
        throw new Error('商品名称无效');
      }
      if (data.conflictResolution !== undefined
          && !['', 'KEEP_EXISTING', 'REPLACE'].includes(String(data.conflictResolution))) {
        throw new Error('冲突处理方式无效');
      }
      return request('PUT', `customer-ocr-training/tasks/${taskId}/items/${itemId}`, { data });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function deleteCustomerOcrTrainingItem(input) {
    try {
      const data = strictPayload(input || {}, ['taskId', 'itemId']);
      const taskId = requirePositiveId(data.taskId, 'taskId');
      const itemId = requirePositiveId(data.itemId, 'itemId');
      return request('DELETE', `customer-ocr-training/tasks/${taskId}/items/${itemId}`);
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function deleteCustomerOcrTraining(input) {
    try {
      const taskId = requirePositiveId(input?.taskId, 'taskId');
      return request('DELETE', `customer-ocr-training/tasks/${taskId}`);
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function completeCustomerOcrTraining(input) {
    try {
      const taskId = requirePositiveId(input?.taskId, 'taskId');
      return request('POST', `customer-ocr-training/tasks/${taskId}/complete`, { data: {} });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function loadCustomerWechatBinding(input) {
    try {
      const customerId = requirePositiveId(input?.customerId, 'customerId');
      return request('GET', `customer-wechat-orders/${customerId}/binding`);
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function saveCustomerWechatBinding(input) {
    try {
      const envelope = strictPayload(input || {}, [
        'customerId', 'displayName', 'accountFingerprint', 'conversationFingerprint',
        'conversationKind', 'groupMode',
      ]);
      const customerId = requirePositiveId(envelope.customerId, 'customerId');
      if (typeof envelope.displayName !== 'string' || !envelope.displayName.trim()
          || envelope.displayName.trim().length > 255) {
        throw new Error('微信好友或群名称无效');
      }
      ['accountFingerprint', 'conversationFingerprint'].forEach((field) => {
        if (typeof envelope[field] !== 'string' || !/^fp:[A-Za-z0-9_-]{8,60}$/.test(envelope[field])) {
          throw new Error(`${field} 无效`);
        }
      });
      if (!['direct', 'group'].includes(envelope.conversationKind)) {
        throw new Error('微信会话类型无效');
      }
      const groupModes = ['ALL_MEMBER_MESSAGES', 'MENTION_SELF_ONLY'];
      if (envelope.conversationKind === 'group' && !groupModes.includes(envelope.groupMode)) {
        throw new Error('请选择群订单接收规则');
      }
      if (envelope.conversationKind === 'direct' && envelope.groupMode != null) {
        throw new Error('个人好友不能设置群订单规则');
      }
      return request('PUT', `customer-wechat-orders/${customerId}/binding`, {
        data: {
          displayName: envelope.displayName.trim(),
          accountFingerprint: envelope.accountFingerprint,
          conversationFingerprint: envelope.conversationFingerprint,
          conversationKind: envelope.conversationKind,
          groupMode: envelope.groupMode,
        },
      });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function clearCustomerWechatBinding(input) {
    try {
      const customerId = requirePositiveId(input?.customerId, 'customerId');
      return request('DELETE', `customer-wechat-orders/${customerId}/binding`);
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  function digestField(target, value) {
    const normalized = value == null ? '' : String(value);
    target.push(`${Buffer.byteLength(normalized, 'utf8')}:${normalized}\n`);
  }

  function wechatBatchDigest(messages) {
    const canonical = [];
    messages.forEach((message) => {
      digestField(canonical, message.messageFingerprint);
      digestField(canonical, message.messageTimeMs);
      digestField(canonical, message.messageKind);
      digestField(canonical, message.processingState);
      digestField(canonical, message.readerLocator);
      digestField(canonical, message.readerAttachmentId);
    });
    return crypto.createHash('sha256').update(canonical.join(''), 'utf8').digest('hex');
  }

  function wechatScanDigest(batches) {
    const canonical = [];
    batches.forEach((batch, index) => {
      digestField(canonical, index);
      digestField(canonical, batch.messages.length);
      digestField(canonical, batch.digest);
    });
    return crypto.createHash('sha256').update(canonical.join(''), 'utf8').digest('hex');
  }

  function validateWechatScanMessages(messages) {
    if (!Array.isArray(messages) || messages.length > 20000) throw new Error('微信扫描消息数量无效');
    const seen = new Set();
    return messages.map((input) => {
      const message = strictPayload(input || {}, [
        'messageFingerprint', 'messageTimeMs', 'messageKind', 'processingState',
        'readerLocator', 'readerAttachmentId',
      ]);
      if (typeof message.messageFingerprint !== 'string'
          || !/^[A-Za-z0-9:._-]{8,160}$/.test(message.messageFingerprint)
          || seen.has(message.messageFingerprint)) throw new Error('微信扫描消息指纹无效或重复');
      seen.add(message.messageFingerprint);
      const time = Number(message.messageTimeMs);
      if (!Number.isSafeInteger(time) || time < 0) throw new Error('微信扫描消息时间无效');
      return {
        messageFingerprint: message.messageFingerprint,
        messageTimeMs: time,
        messageKind: String(message.messageKind || '').toUpperCase(),
        processingState: String(message.processingState || '').toUpperCase(),
        readerLocator: message.readerLocator == null ? null : String(message.readerLocator),
        readerAttachmentId: message.readerAttachmentId == null
          ? null : String(message.readerAttachmentId),
      };
    });
  }

  async function commitReliableWechatScan(input) {
    try {
      const data = strictPayload(input || {}, [
        'customerId', 'scanId', 'bindingRevision', 'protocolVersion',
        'windowStartTimeMs', 'windowEndTimeMs', 'messages',
      ]);
      const customerId = requirePositiveId(data.customerId, 'customerId');
      const messages = validateWechatScanMessages(data.messages);
      const batches = [];
      for (let offset = 0; offset < messages.length; offset += 200) {
        const rows = messages.slice(offset, offset + 200);
        batches.push({ messages: rows, digest: wechatBatchDigest(rows) });
      }
      const manifest = {
        scanId: String(data.scanId || ''),
        bindingRevision: Number(data.bindingRevision),
        protocolVersion: Number(data.protocolVersion) || 2,
        windowStartTimeMs: Number(data.windowStartTimeMs),
        windowEndTimeMs: Number(data.windowEndTimeMs),
        expectedBatchCount: batches.length,
        expectedMessageCount: messages.length,
        scanDigest: wechatScanDigest(batches),
      };
      if (messages.length <= 200) {
        return request('POST', `customer-wechat-orders/${customerId}/scans/commit`, {
          apiPrefix: WECHAT_SCAN_V2_API_PREFIX,
          data: {
            ...manifest,
            messages,
            batchDigest: batches[0]?.digest || null,
          },
        });
      }
      let response = await request('POST', `customer-wechat-orders/${customerId}/scans/begin`, {
        apiPrefix: WECHAT_SCAN_V2_API_PREFIX,
        data: manifest,
      });
      if (!response?.ok) return response;
      for (let batchNo = 0; batchNo < batches.length; batchNo += 1) {
        response = await request('PUT',
          `customer-wechat-orders/${customerId}/scans/${encodeURIComponent(manifest.scanId)}/batches/${batchNo}`,
          {
            apiPrefix: WECHAT_SCAN_V2_API_PREFIX,
            data: { batchDigest: batches[batchNo].digest, messages: batches[batchNo].messages },
          });
        if (!response?.ok) return response;
      }
      return request('POST',
        `customer-wechat-orders/${customerId}/scans/${encodeURIComponent(manifest.scanId)}/finalize`,
        {
          apiPrefix: WECHAT_SCAN_V2_API_PREFIX,
          data: { bindingRevision: manifest.bindingRevision },
        });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function claimWechatTask(input) {
    try {
      const data = strictPayload(input || {}, [
        'customerId', 'bindingRevision', 'departmentId', 'sourceKey',
        'wechatTaskId', 'taskKind', 'draftText', 'messageFingerprints',
      ]);
      const customerId = requirePositiveId(data.customerId, 'customerId');
      return request('POST', `customer-wechat-orders/${customerId}/tasks/claim`, {
        apiPrefix: WECHAT_SCAN_V2_API_PREFIX,
        data: {
          bindingRevision: Number(data.bindingRevision),
          departmentId: requirePositiveId(data.departmentId, 'departmentId'),
          sourceKey: String(data.sourceKey || ''),
          wechatTaskId: data.wechatTaskId == null
            ? null : requirePositiveId(data.wechatTaskId, 'wechatTaskId'),
          taskKind: String(data.taskKind || ''),
          draftText: String(data.draftText || ''),
          messageFingerprints: Array.isArray(data.messageFingerprints)
            ? data.messageFingerprints.map(String) : [],
        },
      });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  function loadPendingWechatTasks(input = {}) {
    return request('GET', 'customer-wechat-orders/tasks/pending', {
      apiPrefix: WECHAT_SCAN_V2_API_PREFIX,
      params: { afterId: input.afterId ?? undefined, limit: input.limit ?? 100 },
    });
  }

  function loadPendingWechatMessages(input) {
    const customerId = requirePositiveId(input?.customerId, 'customerId');
    return request('GET', `customer-wechat-orders/${customerId}/messages/pending`, {
      apiPrefix: WECHAT_SCAN_V2_API_PREFIX,
      params: {
        accountFingerprint: input.accountFingerprint,
        conversationFingerprint: input.conversationFingerprint,
        afterId: input.afterId ?? undefined,
        limit: input.limit ?? 100,
      },
    });
  }

  function updateWechatTaskDraft(input) {
    const taskId = requirePositiveId(input?.taskId, 'taskId');
    return request('PATCH', `customer-wechat-orders/tasks/${taskId}/draft`, {
      apiPrefix: WECHAT_SCAN_V2_API_PREFIX,
      data: { draftRevision: Number(input.draftRevision), draftText: String(input.draftText || '') },
    });
  }

  function reportWechatAttachment(input) {
    const customerId = requirePositiveId(input?.customerId, 'customerId');
    return request('POST', `customer-wechat-orders/${customerId}/messages/${encodeURIComponent(input.messageFingerprint)}/attachment`, {
      apiPrefix: WECHAT_SCAN_V2_API_PREFIX,
      data: { recovered: input.recovered === true, errorCode: input.errorCode || null },
    });
  }

  function acknowledgeWechatMixedImage(input) {
    const customerId = requirePositiveId(input?.customerId, 'customerId');
    return request('POST', `customer-wechat-orders/${customerId}/messages/${encodeURIComponent(input.messageFingerprint)}/mixed-image-notice`, {
      apiPrefix: WECHAT_SCAN_V2_API_PREFIX,
      data: {},
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

  async function loadSalesAnalysisCategoryCustomers(input) {
    try {
      const data = strictPayload(input || {}, ['categoryId', 'range', 'page', 'pageSize']);
      const categoryId = requireReportId(data.categoryId, 'categoryId', true);
      const params = {
        ...validateSalesRange(data.range),
        ...validateSalesPagination(data.page, data.pageSize),
      };
      return request('GET', `sales-analysis/categories/${categoryId}/customers`, { params });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
  }

  async function loadSalesAnalysisCategoryCustomerProducts(input) {
    try {
      const data = strictPayload(input || {}, [
        'categoryId', 'customerId', 'range', 'page', 'pageSize',
      ]);
      const categoryId = requireReportId(data.categoryId, 'categoryId', true);
      const customerId = requireReportId(data.customerId, 'customerId');
      const params = {
        ...validateSalesRange(data.range),
        ...validateSalesPagination(data.page, data.pageSize),
      };
      return request(
        'GET',
        `sales-analysis/categories/${categoryId}/customers/${customerId}/products`,
        { params },
      );
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

  async function issueConnectorCredential(input = {}) {
    const params = {};
    if (input && input.ttlHours !== undefined) {
      const ttl = Number(input.ttlHours);
      if (!Number.isSafeInteger(ttl) || ttl <= 0 || ttl > 8760) {
        return { ok: false, status: 400, errorCode: 'INVALID_TTL', message: '有效期小时数无效' };
      }
      params.ttlHours = ttl;
    }
    if (input && typeof input.scope === 'string' && input.scope.trim()) {
      params.scope = input.scope.trim();
    }
    return request('POST', 'issue', {
      apiPrefix: CONNECTOR_CREDENTIAL_API_PREFIX,
      params,
    });
  }

  async function listConnectorCredentials() {
    return request('GET', 'list', {
      apiPrefix: CONNECTOR_CREDENTIAL_API_PREFIX,
    });
  }

  async function revokeConnectorCredential() {
    // 不传 token：后端按 revokeAllForUser 处理，撤销当前用户全部凭证。
    return request('POST', 'revoke', {
      apiPrefix: CONNECTOR_CREDENTIAL_API_PREFIX,
    });
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
    loadCommercialEntitlement,
    listCustomerOcrTasks,
    loadCustomerOcrTask,
    createCustomerOcrTraining,
    updateCustomerOcrTrainingItem,
    deleteCustomerOcrTrainingItem,
    deleteCustomerOcrTraining,
    completeCustomerOcrTraining,
    loadCustomerWechatBinding,
    saveCustomerWechatBinding,
    clearCustomerWechatBinding,
    commitReliableWechatScan,
    claimWechatTask,
    loadPendingWechatTasks,
    loadPendingWechatMessages,
    updateWechatTaskDraft,
    reportWechatAttachment,
    acknowledgeWechatMixedImage,
    loadSalesAnalysisOverview,
    loadSalesAnalysisCategory,
    loadSalesAnalysisProductCustomers,
    loadSalesAnalysisCategoryCustomers,
    loadSalesAnalysisCategoryCustomerProducts,
    loadMapConfig,
    loadMapTile,
    issueConnectorCredential,
    listConnectorCredentials,
    revokeConnectorCredential,
    createId,
    dispose() {},
  };
}

module.exports = { createDispatchGateway };
