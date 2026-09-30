const crypto = require('crypto');
const { createCredentialStore } = require('./credential-store');
const {
  PRODUCTION_API_BASE_URL,
  normalizeNongxinleApiBaseUrl,
} = require('../api-runtime');

const API_PREFIX = 'desktop-dispatch/v1/';
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
        timeout: options.timeout || undefined,
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

  function validateWechatMessageRefs(messages) {
    if (!Array.isArray(messages) || messages.length < 1 || messages.length > 200) {
      throw new Error('微信消息数量无效，单次最多 200 条');
    }
    return messages.map((message) => {
      const data = strictPayload(message || {}, ['messageFingerprint', 'messageTimeMs']);
      if (typeof data.messageFingerprint !== 'string'
          || !/^[A-Za-z0-9:._-]{8,160}$/.test(data.messageFingerprint)) {
        throw new Error('微信消息指纹无效');
      }
      const messageTimeMs = Number(data.messageTimeMs);
      if (!Number.isSafeInteger(messageTimeMs) || messageTimeMs < 0) {
        throw new Error('微信消息时间无效');
      }
      return { messageFingerprint: data.messageFingerprint, messageTimeMs };
    });
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

  async function prepareCustomerWechatMessages(input) {
    try {
      const data = strictPayload(input || {}, ['customerId', 'messages']);
      const customerId = requirePositiveId(data.customerId, 'customerId');
      return request('POST', `customer-wechat-orders/${customerId}/messages/prepare`, {
        data: { messages: validateWechatMessageRefs(data.messages) },
      });
    } catch (error) {
      return { ok: false, status: 400, errorCode: 'INVALID_REQUEST', message: error.message };
    }
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
    prepareCustomerWechatMessages,
    loadSalesAnalysisOverview,
    loadSalesAnalysisCategory,
    loadSalesAnalysisProductCustomers,
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
