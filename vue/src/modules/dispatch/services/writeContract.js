export const DISPATCH_PERMISSIONS = Object.freeze({
  assignDriver: 'dispatch:assignment:write',
  routeEdit: 'dispatch:route:edit',
  confirmDispatch: 'dispatch:confirm',
  dutyManage: 'dispatch:duty:manage',
  loadingConfirm: 'dispatch:loading:confirm',
  deliveryConfirm: 'dispatch:delivery:confirm',
  deliverySelf: 'dispatch:delivery:self',
});

export function buildPlanningStopLockPayload({ planning, stop, driver, routeDate, batchCode }) {
  if (!stop) throw new Error('请选择需要锁定的客户');
  const depFatherId = optionalInteger(
    stop.depFatherId ?? stop.departmentId ?? stop.nxDepartmentId ?? stop.depId,
    'depFatherId',
    1
  );
  if (!depFatherId) throw new Error('所选客户缺少部门标识，请刷新后重试');
  const currentLock = (Array.isArray(planning?.stopLocks) ? planning.stopLocks : [])
    .find((item) => String(item.depFatherId) === String(depFatherId));
  const payload = {
    routeDate: requireText(routeDate, 'routeDate'),
    batchCode: requireText(batchCode || 'MORNING', 'batchCode'),
    depFatherId,
    expectedVersion: requireInteger(currentLock?.version ?? 0, 'lock.version'),
  };
  if (driver) payload.driverUserId = requireInteger(driver.driverUserId, 'driverUserId', 1);
  return payload;
}

export function buildDriverEmploymentPayload(employmentType) {
  const normalized = String(employmentType || '').toUpperCase();
  if (!['FULL_TIME', 'PART_TIME'].includes(normalized)) {
    throw new Error('司机类型无效');
  }
  return { employmentType: normalized };
}

export function buildDriverDutyPayload(routeDate) {
  const payload = {};
  if (routeDate) payload.dutyDate = requireText(routeDate, 'dutyDate');
  return payload;
}

function requireInteger(value, field, minimum = 0) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum) {
    throw new Error(`${field} 缺失，请先刷新调度数据`);
  }
  return number;
}

function optionalInteger(value, field, minimum = 0) {
  if (value === null || value === undefined || value === '') return null;
  return requireInteger(value, field, minimum);
}

function requireText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${field} 缺失，请先刷新调度数据`);
  return text;
}

function uniqueIntegerList(values) {
  const result = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number <= 0 || seen.has(number)) return;
    seen.add(number);
    result.push(number);
  });
  return result;
}

function stopOrderIds(stops) {
  return uniqueIntegerList(
    (Array.isArray(stops) ? stops : []).flatMap((stop) => stop?.liveOrderIds || [])
  );
}

const ROUTE_RESOURCE_FIELDS = Object.freeze([
  'driverRouteId',
  'routeVersion',
  'sandboxEditCredential',
  'canonicalSandboxVersion',
  'sandboxStateFingerprint',
  'sandboxCredentialExpiresAt',
]);

function routeResourcePayload(route) {
  const actionPayload = normalizeActionPayload(
    route?._routeEditPayload || route?.routeEditAction
  );
  const pagePayload = route?._routeEditPage && typeof route._routeEditPage === 'object'
    ? route._routeEditPage
    : {};
  const source = { ...actionPayload, ...pagePayload };
  const resourceType = optionalText(source.routeResourceType || route?.routeResourceType);
  if (!resourceType) {
    throw new Error('缺少可信路线编辑资源，请刷新列表后重试');
  }
  const payload = { routeResourceType: resourceType };
  ROUTE_RESOURCE_FIELDS.forEach((field) => {
    const value = source[field] ?? route?.[field];
    if (value !== null && value !== undefined && value !== '') payload[field] = value;
  });
  if (resourceType === 'DISPATCH_SANDBOX') {
    payload.sandboxEditCredential = requireText(
      payload.sandboxEditCredential,
      'sandboxEditCredential'
    );
    payload.canonicalSandboxVersion = requireText(
      payload.canonicalSandboxVersion,
      'canonicalSandboxVersion'
    );
    payload.sandboxStateFingerprint = requireText(
      payload.sandboxStateFingerprint,
      'sandboxStateFingerprint'
    );
    delete payload.driverRouteId;
    delete payload.routeVersion;
  } else if (resourceType === 'FORMAL_DRIVER_ROUTE') {
    payload.driverRouteId = requireInteger(
      payload.driverRouteId ?? route?.driverRouteId,
      'driverRouteId',
      1
    );
    payload.routeVersion = requireInteger(
      payload.routeVersion ?? route?.routeVersion,
      'routeVersion'
    );
    delete payload.sandboxEditCredential;
    delete payload.canonicalSandboxVersion;
    delete payload.sandboxStateFingerprint;
    delete payload.sandboxCredentialExpiresAt;
  } else {
    throw new Error('路线编辑资源类型无效，请刷新列表后重试');
  }
  return payload;
}

function routeConfirmResourcePayload(route) {
  const payload = routeResourcePayload(route);
  // Desktop confirm 使用 expectedRouteVersion 作为并发版本；routeVersion
  // 与 credential expiry 不属于确认 DTO，不能被 strict contract 发送。
  delete payload.routeVersion;
  delete payload.sandboxCredentialExpiresAt;
  return payload;
}

export function hasDispatchPermission(session, permission) {
  return Boolean(
    session?.authenticated
    && Array.isArray(session.permissions)
    && session.permissions.includes(permission)
  );
}

export function buildAssignDriverPayload({
  stop,
  driver,
  targetRoute,
  routeDate,
  batchCode,
}) {
  if (!stop || !driver) throw new Error('请选择待派订单和目标司机');
  const taskId = optionalInteger(stop.taskId, 'taskId', 1);
  const depFatherId = optionalInteger(
    stop.depFatherId ?? stop.departmentId ?? stop.depId,
    'depFatherId',
    1
  );
  const sandboxStopKey = String(stop.sandboxStopKey ?? '').trim() || null;
  if (!taskId && !depFatherId && !sandboxStopKey) {
    throw new Error('所选客户缺少服务端站点标识，请刷新后重试');
  }
  return {
    routeDate: requireText(routeDate, 'routeDate'),
    batchCode: requireText(batchCode || 'MORNING', 'batchCode'),
    taskId,
    depFatherId,
    sandboxStopKey,
    driverUserId: requireInteger(driver.driverUserId, 'driverUserId', 1),
    manualStopSeq: Math.max(1, Number(targetRoute?._stops?.length || 0) + 1),
    assignReason: 'Electron 桌面调度分配司机',
    liveOrderIds: uniqueIntegerList(stop.liveOrderIds),
    expectedTaskVersion: requireInteger(stop.taskVersion, 'taskVersion'),
    expectedRouteVersion: targetRoute
      ? requireInteger(targetRoute.routeVersion, 'routeVersion')
      : 0,
  };
}

export function buildConfirmDispatchPayload({ route, routeDate, batchCode }) {
  if (!route || !Array.isArray(route._stops) || !route._stops.length) {
    throw new Error('请选择包含客户站点的待派路线');
  }
  const stopKeys = route._stops.map((stop) => (
    requireText(stop.sandboxStopKey, 'sandboxStopKey')
  ));
  const expectedTaskVersions = route._stops
    .filter((stop) => stop.taskId !== null && stop.taskId !== undefined)
    .map((stop) => ({
      taskId: requireInteger(stop.taskId, 'taskId', 1),
      taskVersion: requireInteger(stop.taskVersion, 'taskVersion'),
    }));
  const seenTasks = new Set();
  expectedTaskVersions.forEach(({ taskId }) => {
    if (seenTasks.has(taskId)) throw new Error('路线包含重复 taskId，请刷新后重试');
    seenTasks.add(taskId);
  });
  return {
    routeDate: requireText(routeDate, 'routeDate'),
    batchCode: requireText(batchCode || 'MORNING', 'batchCode'),
    driverUserId: requireInteger(route.driverUserId, 'driverUserId', 1),
    driverRouteId: optionalInteger(route.driverRouteId, 'driverRouteId', 1),
    stopKeys,
    liveOrderIds: stopOrderIds(route._stops),
    confirmReason: 'Electron 桌面调度确认派单',
    expectedRouteVersion: requireInteger(route.routeVersion, 'routeVersion'),
    expectedTaskVersions,
  };
}

export function buildRoutePreviewPayload({
  route,
  stopKeys,
  routeDate,
  batchCode,
  previewToken,
  routeExpansionProposalId,
  removedStopKeys,
  removalCommandId,
  initialAddStopKeys,
}) {
  if (!route) throw new Error('请选择需要调整的司机路线');
  const normalizedStopKeys = (Array.isArray(stopKeys) ? stopKeys : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const routeEditPayload = normalizeActionPayload(route._routeEditPayload || route.routeEditAction);
  const payload = {
    ...routeResourcePayload(route),
    routeDate: requireText(routeDate, 'routeDate'),
    batchCode: requireText(batchCode || 'MORNING', 'batchCode'),
    driverUserId: requireInteger(route.driverUserId, 'driverUserId', 1),
    stopKeys: normalizedStopKeys,
    sourcePage: routeEditPayload.sourcePage
      || (route._phase === 'loading' ? 'LOADING' : 'DISPATCH_SANDBOX'),
  };
  if (routeEditPayload.manualDispatch === true) payload.manualDispatch = true;
  const departmentId = optionalInteger(
    routeEditPayload.departmentId ?? routeEditPayload.depFatherId,
    'departmentId',
    1
  );
  if (departmentId) {
    payload.departmentId = departmentId;
    payload.depFatherId = departmentId;
  }
  const normalizedInitialAdds = Array.isArray(initialAddStopKeys)
    ? initialAddStopKeys
    : [];
  if (Array.isArray(normalizedInitialAdds) && normalizedInitialAdds.length) {
    payload.initialAddStopKeys = [...new Set(normalizedInitialAdds.map(
      (key) => requireText(key, 'initialAddStopKey')
    ))];
  }
  const explicitRemovals = (Array.isArray(removedStopKeys) ? removedStopKeys : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (explicitRemovals.length) {
    payload.removedStopKeys = [...new Set(explicitRemovals)];
    payload.removalCommandId = requireText(removalCommandId, 'removalCommandId');
  } else if (removalCommandId) {
    throw new Error('removalCommandId不能脱离明确删除客户使用');
  }
  if (previewToken) payload.previewToken = requireText(previewToken, 'previewToken');
  if (routeExpansionProposalId) {
    payload.routeExpansionProposalId = requireText(
      routeExpansionProposalId,
      'routeExpansionProposalId'
    );
  }
  return payload;
}

export function buildRouteExpansionPayload({
  route,
  routeDate,
  batchCode,
  previewToken,
  maxAddedStops,
  maxActiveRouteDurationS,
  latestRouteFinishAt,
  maxRoadDistanceM,
}) {
  if (!route) throw new Error('请选择需要增补的司机路线');
  const payload = {
    ...routeResourcePayload(route),
    routeDate: requireText(routeDate, 'routeDate'),
    batchCode: requireText(batchCode || 'MORNING', 'batchCode'),
    driverUserId: requireInteger(route.driverUserId, 'driverUserId', 1),
    previewToken: requireText(previewToken, 'previewToken'),
  };
  // 凭据的签发与过期时间已经包含在服务端签名内容中；扩线试算 DTO
  // 只接收凭据本身、canonical 版本和状态指纹，不能携带页面辅助字段。
  delete payload.sandboxCredentialExpiresAt;
  const addedLimit = optionalInteger(maxAddedStops, 'maxAddedStops', 1);
  const activeLimit = optionalInteger(maxActiveRouteDurationS, 'maxActiveRouteDurationS', 1);
  const distanceLimit = optionalInteger(maxRoadDistanceM, 'maxRoadDistanceM', 1);
  const finishLimit = optionalText(latestRouteFinishAt);
  if (!activeLimit && !finishLimit && !distanceLimit) {
    throw new Error('可工作时长、最晚完成时间、全程距离上限至少填写一项');
  }
  if (addedLimit) payload.maxAddedStops = addedLimit;
  if (activeLimit) payload.maxActiveRouteDurationS = activeLimit;
  if (finishLimit) {
    if (!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:00\+08:00$/.test(finishLimit)) {
      throw new Error('最晚完成时间格式无效');
    }
    payload.latestRouteFinishAt = finishLimit;
  }
  if (distanceLimit) payload.maxRoadDistanceM = distanceLimit;
  return payload;
}

export function buildRoutePreviewReleasePayload({
  route,
  routeDate,
  batchCode,
  previewToken,
}) {
  if (!route) throw new Error('请选择需要结束编辑的司机路线');
  const payload = {
    ...routeResourcePayload(route),
    routeDate: requireText(routeDate, 'routeDate'),
    batchCode: requireText(batchCode || 'MORNING', 'batchCode'),
    driverUserId: requireInteger(route.driverUserId, 'driverUserId', 1),
    previewToken: requireText(previewToken, 'previewToken'),
  };
  // 过期时间是页面展示辅助字段，不属于服务端释放合同。
  delete payload.sandboxCredentialExpiresAt;
  return payload;
}

export function buildRouteEditConfirmPayload({
  route,
  stops,
  stopKeys,
  routeDate,
  batchCode,
  previewToken,
}) {
  if (!route || !Array.isArray(route._stops)) {
    throw new Error('请选择需要调整的司机路线');
  }
  const normalizedStopKeys = (Array.isArray(stopKeys) ? stopKeys : [])
    .map((value) => requireText(value, 'stopKey'));
  const uniqueKeys = new Set(normalizedStopKeys);
  if (uniqueKeys.size !== normalizedStopKeys.length) throw new Error('路线中存在重复客户');
  const sourceStops = Array.isArray(stops) && stops.length ? stops : route._stops;
  const knownKeys = new Set(sourceStops.map((stop) => (
    String(stop.sandboxStopKey ?? stop.stopKey ?? '').trim()
  )));
  if (normalizedStopKeys.some((key) => !knownKeys.has(key))) {
    throw new Error('路线客户数据已经变化，请刷新后重试');
  }
  const versionStops = [...(Array.isArray(route._stops) ? route._stops : []), ...sourceStops]
    .filter((stop, index, values) => {
      const key = String(stop?.sandboxStopKey ?? stop?.stopKey ?? '').trim();
      return values.findIndex((item) => (
        String(item?.sandboxStopKey ?? item?.stopKey ?? '').trim() === key
      )) === index;
    });
  return {
    ...routeConfirmResourcePayload(route),
    routeDate: requireText(routeDate, 'routeDate'),
    batchCode: requireText(batchCode || 'MORNING', 'batchCode'),
    driverUserId: requireInteger(route.driverUserId, 'driverUserId', 1),
    driverRouteId: optionalInteger(
      route._routeEditPayload?.driverRouteId ?? route.driverRouteId,
      'driverRouteId',
      1
    ),
    stopKeys: normalizedStopKeys,
    liveOrderIds: stopOrderIds(sourceStops),
    previewToken: requireText(previewToken, 'previewToken'),
    confirmReason: 'Electron 桌面调度调整路线顺序',
    expectedRouteVersion: requireInteger(route.routeVersion, 'routeVersion'),
    expectedTaskVersions: versionStops
      .filter((stop) => stop.taskId !== null && stop.taskId !== undefined)
      .map((stop) => ({
        taskId: requireInteger(stop.taskId, 'taskId', 1),
        taskVersion: requireInteger(stop.taskVersion, 'taskVersion'),
      }))
      .filter(({ taskId }, index, values) => (
        values.findIndex((item) => item.taskId === taskId) === index
      )),
  };
}

function optionalText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeActionPayload(actionOrPayload) {
  const payload = actionOrPayload?.payload && typeof actionOrPayload.payload === 'object'
    ? actionOrPayload.payload
    : actionOrPayload;
  return payload && typeof payload === 'object' ? payload : {};
}

export function timeValueToSeconds(value) {
  const text = optionalText(value);
  if (!text) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) throw new Error('时间格式无效');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('时间格式无效');
  return hour * 3600 + minute * 60;
}

export function secondsToTimeValue(value) {
  if (value === null || value === undefined || value === '') return '';
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return '';
  const hour = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const minute = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  return `${hour}:${minute}`;
}

export function buildStopTimeWindowPayload({ action, form, routeDate, batchCode, phase }) {
  const source = normalizeActionPayload(action);
  const latestDeliveryTimeS = timeValueToSeconds(form?.latestTime);
  if (latestDeliveryTimeS === null) throw new Error('请选择最晚送达时间');
  const payload = {
    routeDate: requireText(source.routeDate || routeDate, 'routeDate'),
    batchCode: requireText(source.batchCode || batchCode || 'MORNING', 'batchCode'),
    earliestDeliveryTimeS: timeValueToSeconds(form?.earliestTime),
    latestDeliveryTimeS,
    reason: optionalText(form?.reason) || '',
  };
  const departmentId = optionalInteger(
    source.departmentId ?? source.depFatherId,
    'departmentId',
    1
  );
  const deliveryStopId = optionalInteger(source.deliveryStopId, 'deliveryStopId', 1);
  const serviceMinutes = optionalInteger(source.serviceMinutes, 'serviceMinutes', 0);
  const sandboxStopKey = optionalText(source.sandboxStopKey);
  if (!departmentId && !deliveryStopId && !sandboxStopKey) {
    throw new Error('客户站点标识缺失，请刷新后重试');
  }
  if (departmentId) {
    payload.departmentId = departmentId;
    payload.depFatherId = departmentId;
  }
  if (deliveryStopId) payload.deliveryStopId = deliveryStopId;
  if (sandboxStopKey) payload.sandboxStopKey = sandboxStopKey;
  if (serviceMinutes !== null) payload.serviceMinutes = serviceMinutes;
  if (phase === 'loading') payload.responsePage = 'LOADING';
  return payload;
}

export function buildReturnStopToSandboxCommand({ stop, action, routeDate, batchCode }) {
  const source = normalizeActionPayload(action);
  const deliveryStopId = requireInteger(
    source.deliveryStopId ?? stop?.deliveryStopId ?? stop?.taskId,
    'deliveryStopId',
    1
  );
  return {
    deliveryStopId,
    payload: {
      routeDate: requireText(source.routeDate || routeDate, 'routeDate'),
      batchCode: requireText(source.batchCode || batchCode || 'MORNING', 'batchCode'),
      reason: optionalText(source.reason) || '装车路线编辑移除',
      suppressTodayResponse: true,
    },
  };
}

export function buildManualDispatchPayload(action, routeDate, batchCode) {
  const source = normalizeActionPayload(action);
  const departmentId = requireInteger(
    source.departmentId ?? source.depFatherId,
    'departmentId',
    1
  );
  return {
    routeDate: requireText(source.routeDate || routeDate, 'routeDate'),
    batchCode: requireText(source.batchCode || batchCode || 'MORNING', 'batchCode'),
    departmentId,
    depFatherId: departmentId,
    sandboxStopKey: requireText(source.sandboxStopKey, 'sandboxStopKey'),
    liveOrderIds: uniqueIntegerList(source.liveOrderIds),
  };
}

export function buildDepartDriverCommand({ route, action, routeDate, batchCode, remark }) {
  const source = normalizeActionPayload(action);
  const driverUserId = requireInteger(
    source.driverUserId ?? route?.driverUserId,
    'driverUserId',
    1
  );
  const payload = {
    routeDate: requireText(source.routeDate || routeDate, 'routeDate'),
    batchCode: requireText(source.batchCode || batchCode || 'MORNING', 'batchCode'),
  };
  const planId = optionalInteger(source.planId ?? route?.planId, 'planId', 1);
  const driverRouteId = optionalInteger(
    source.driverRouteId ?? route?.driverRouteId,
    'driverRouteId',
    1
  );
  if (planId) payload.planId = planId;
  if (driverRouteId) payload.driverRouteId = driverRouteId;
  if (optionalText(source.departAt)) payload.departAt = optionalText(source.departAt);
  if (optionalText(remark || source.remark)) payload.remark = optionalText(remark || source.remark);
  return { driverUserId, payload };
}

export function buildDeliveryStopCommand({ stop, action, routeDate, batchCode, reason }) {
  const source = normalizeActionPayload(action);
  return {
    deliveryStopId: requireInteger(
      source.deliveryStopId ?? stop?.deliveryStopId ?? stop?.taskId,
      'deliveryStopId',
      1
    ),
    payload: {
      routeDate: requireText(source.routeDate || routeDate, 'routeDate'),
      batchCode: requireText(source.batchCode || batchCode || 'MORNING', 'batchCode'),
      reason: optionalText(reason || source.reason) || '',
    },
  };
}

export function buildRouteReassignmentPreviewPayload({ route, candidate, routeDate, batchCode, previewToken }) {
  if (!route || route._phase !== 'loading') throw new Error('只有装车中路线可以更换司机');
  const targetDriverUserId = requireInteger(candidate?.driverUserId, 'targetDriverUserId', 1);
  const driverUserId = requireInteger(route.driverUserId, 'driverUserId', 1);
  if (targetDriverUserId === driverUserId) throw new Error('目标司机不能与当前司机相同');
  const payload = {
    routeDate: requireText(routeDate, 'routeDate'),
    batchCode: requireText(batchCode || 'MORNING', 'batchCode'),
    driverUserId,
    driverRouteId: requireInteger(route.driverRouteId, 'driverRouteId', 1),
    routeVersion: requireInteger(route.routeVersion, 'routeVersion'),
    targetDriverUserId,
    stopKeys: route._stops.map((stop) => requireText(
      stop.sandboxStopKey ?? stop.stopKey,
      'stopKey'
    )),
    sourcePage: 'LOADING',
  };
  if (previewToken) payload.previewToken = requireText(previewToken, 'previewToken');
  return payload;
}

export function buildRouteReassignmentConfirmPayload({ previewPayload, previewPage }) {
  if (!previewPayload) throw new Error('更换司机预览缺失');
  const previewDriver = previewPage?.driver || {};
  return {
    ...previewPayload,
    driverRouteId: requireInteger(
      previewDriver.driverRouteId ?? previewPayload.driverRouteId,
      'driverRouteId',
      1
    ),
    routeVersion: requireInteger(
      previewDriver.routeVersion ?? previewPayload.routeVersion,
      'routeVersion'
    ),
    previewToken: requireText(previewPage?.previewToken, 'previewToken'),
    stopKeys: [...previewPayload.stopKeys],
  };
}

export function dispatchErrorPresentation(result) {
  const status = Number(result?.status) || 0;
  const errorCode = String(result?.errorCode || '').toUpperCase();
  const provider = String(result?.provider || '').toUpperCase();
  const roadUnavailable = provider === 'HUAWEI'
    || /HUAWEI|ROAD_SERVICE|MATRIX|ROUTING/.test(errorCode);
  if (status === 401) {
    return { tone: 'error', message: '桌面登录已失效，请重新登录后操作', loginRequired: true, errorCode };
  }
  if (status === 403) {
    return { tone: 'error', message: '当前账号没有执行此操作的权限', errorCode };
  }
  if (status === 409) {
    return {
      tone: 'warning',
      message: result?.message || '调度数据已变化，请刷新最新结果',
      refresh: true,
      errorCode,
      roadUnavailable,
    };
  }
  if (status === 422) {
    return {
      tone: 'warning',
      message: result?.message || '服务端判定当前状态不允许该操作',
      errorCode,
      roadUnavailable,
      retainInput: true,
    };
  }
  return {
    tone: 'error',
    message: result?.message || '操作失败，请稍后重试',
    errorCode,
    roadUnavailable,
  };
}
