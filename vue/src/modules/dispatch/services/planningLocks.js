function stopDepartmentId(stop) {
  if (!stop || typeof stop !== 'object') return null;
  return stop.depFatherId
    ?? stop.departmentId
    ?? stop.depId
    ?? stop.nxDepartmentId
    ?? null;
}

function lockLabel(lock) {
  const driverName = lock?.driverName == null ? '' : String(lock.driverName).trim();
  return driverName ? `已锁定给 ${driverName}` : '已锁定司机';
}

export function buildPlanningStopLockIndex(pageViewModel) {
  const locks = Array.isArray(pageViewModel?.planning?.stopLocks)
    ? pageViewModel.planning.stopLocks
    : [];
  return locks.reduce((index, lock) => {
    if (lock?.depFatherId != null) index[String(lock.depFatherId)] = lock;
    return index;
  }, Object.create(null));
}

export function decorateStopsWithPlanningLocks(stops, pageViewModel) {
  const lockByDepartmentId = buildPlanningStopLockIndex(pageViewModel);
  return (Array.isArray(stops) ? stops : []).map((stop) => {
    const departmentId = stopDepartmentId(stop);
    const lock = departmentId == null ? null : lockByDepartmentId[String(departmentId)];
    if (!lock) return stop;
    return {
      ...stop,
      driverLocked: true,
      lockedDriverUserId: lock.driverUserId ?? null,
      lockedDriverName: lock.driverName || '',
      driverLockLabel: lockLabel(lock),
      driverLockWarning: lock.warning || '',
    };
  });
}

export function decorateRoutesWithPlanningLocks(routes, pageViewModel) {
  return (Array.isArray(routes) ? routes : []).map((route) => ({
    ...route,
    _stops: decorateStopsWithPlanningLocks(route?._stops, pageViewModel),
  }));
}
