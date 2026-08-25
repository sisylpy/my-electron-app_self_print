export const DISPATCH_PERMISSIONS = Object.freeze({
  assignDriver: 'dispatch:assignment:write',
  routeEdit: 'dispatch:route:edit',
  confirmDispatch: 'dispatch:confirm',
  dutyManage: 'dispatch:duty:manage',
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
}) {
  if (!route) throw new Error('请选择需要调整的司机路线');
  const normalizedStopKeys = (Array.isArray(stopKeys) ? stopKeys : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (!normalizedStopKeys.length) throw new Error('路线至少需要保留一个客户');
  const payload = {
    routeDate: requireText(routeDate, 'routeDate'),
    batchCode: requireText(batchCode || 'MORNING', 'batchCode'),
    driverUserId: requireInteger(route.driverUserId, 'driverUserId', 1),
    stopKeys: normalizedStopKeys,
    sourcePage: route._phase === 'loading' ? 'LOADING' : 'DISPATCH_SANDBOX',
  };
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
  maxRoadDistanceM,
}) {
  if (!route) throw new Error('请选择需要增补的司机路线');
  const payload = {
    routeDate: requireText(routeDate, 'routeDate'),
    batchCode: requireText(batchCode || 'MORNING', 'batchCode'),
    driverUserId: requireInteger(route.driverUserId, 'driverUserId', 1),
    previewToken: requireText(previewToken, 'previewToken'),
  };
  const addedLimit = optionalInteger(maxAddedStops, 'maxAddedStops', 1);
  const activeLimit = optionalInteger(maxActiveRouteDurationS, 'maxActiveRouteDurationS', 1);
  const distanceLimit = optionalInteger(maxRoadDistanceM, 'maxRoadDistanceM', 1);
  if (addedLimit) payload.maxAddedStops = addedLimit;
  if (activeLimit) payload.maxActiveRouteDurationS = activeLimit;
  if (distanceLimit) payload.maxRoadDistanceM = distanceLimit;
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
  if (!route || !Array.isArray(route._stops) || !route._stops.length) {
    throw new Error('请选择需要调整的司机路线');
  }
  const normalizedStopKeys = (Array.isArray(stopKeys) ? stopKeys : [])
    .map((value) => requireText(value, 'stopKey'));
  if (!normalizedStopKeys.length) throw new Error('路线至少需要保留一个客户');
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
    routeDate: requireText(routeDate, 'routeDate'),
    batchCode: requireText(batchCode || 'MORNING', 'batchCode'),
    driverUserId: requireInteger(route.driverUserId, 'driverUserId', 1),
    driverRouteId: optionalInteger(route.driverRouteId, 'driverRouteId', 1),
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

export function dispatchErrorPresentation(result) {
  const status = Number(result?.status) || 0;
  if (status === 401) {
    return { tone: 'error', message: '扫码登录已失效，请重新登录后操作', loginRequired: true };
  }
  if (status === 403) {
    return { tone: 'error', message: '当前账号没有执行此操作的权限' };
  }
  if (status === 409) {
    return { tone: 'warning', message: result?.message || '调度数据已变化，正在刷新最新结果', refresh: true };
  }
  if (status === 422) {
    return { tone: 'warning', message: result?.message || '服务端判定当前状态不允许该操作' };
  }
  return {
    tone: 'error',
    message: result?.message || '操作失败，请稍后重试',
  };
}
