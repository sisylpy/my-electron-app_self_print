import {
  decorateRoutesWithPlanningLocks,
  decorateStopsWithPlanningLocks,
} from './planningLocks.js';

export const PHASE_PRESENTATION = Object.freeze({
  dispatch: { label: '分派中', orderLabel: '待派' },
  loading: { label: '装车中', orderLabel: '装车中' },
  delivery: { label: '配送中', orderLabel: '配送中' },
});

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function comparableId(value) {
  return value === null || value === undefined ? '' : String(value);
}

function stableStopKey(stop, phase, routeKey, index) {
  const serverKey = stop.deliveryStopId ?? stop.taskId ?? stop.stopId
    ?? stop.depFatherId ?? stop.departmentId ?? stop.nxDepartmentId;
  return `${phase}:${routeKey}:${serverKey ?? asText(stop.customerName, index)}:${index}`;
}

export function pageSections(pageViewModel) {
  return asArray(pageViewModel?.sections);
}

export function routeCards(pageViewModel) {
  return pageSections(pageViewModel)
    .flatMap((section) => asArray(section?.cards))
    .filter((card) => card?.cardType === 'DRIVER_ROUTE');
}

export function unassignedCards(pageViewModel) {
  return pageSections(pageViewModel)
    .flatMap((section) => asArray(section?.cards))
    .filter((card) => card?.cardType === 'UNASSIGNED_CUSTOMER');
}

function routeKey(card, phase, index) {
  return `${phase}:driver:${card.driverUserId ?? index}`;
}

function lookupCustomer(customerIndex, stop) {
  const ids = [
    stop.depFatherId,
    stop.departmentId,
    stop.nxDepartmentId,
    stop.depId,
  ].map(comparableId).filter(Boolean);
  for (const id of ids) {
    if (customerIndex[id]) return customerIndex[id];
  }
  return null;
}

function decorateStop(stop, context) {
  const customer = lookupCustomer(context.customerIndex, stop);
  const phasePresentation = PHASE_PRESENTATION[context.phase] || PHASE_PRESENTATION.dispatch;
  return {
    ...stop,
    _stopKey: stableStopKey(stop, context.phase, context.routeKey, context.index),
    _routeKey: context.routeKey,
    _phase: context.phase,
    _phaseLabel: phasePresentation.label,
    _driverUserId: context.driverUserId ?? null,
    _driverName: asText(context.driverName, '未分配'),
    _customerAddress: asText(
      stop.customerAddress ?? stop.address ?? customer?.nxDepartmentAddress,
      '服务端暂未维护地址'
    ),
    _customerLat: stop.lat ?? customer?.nxDepartmentLat ?? null,
    _customerLng: stop.lng ?? customer?.nxDepartmentLng ?? null,
    _displayStatus: asText(
      stop.statusLabel
        ?? stop.pointStatusLabel
        ?? stop.arrivalStatusLabel
        ?? stop.badgeLabel,
      phasePresentation.orderLabel
    ),
  };
}

export function buildCustomerIndex(customerPayload) {
  const index = Object.create(null);
  const visited = new Set();

  function visit(value) {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const id = value.nxDepartmentId;
    if (id !== null && id !== undefined) {
      index[String(id)] = value;
    }
    Object.values(value).forEach(visit);
  }

  visit(customerPayload);
  return index;
}

export function buildRoutes(pageViewModel, phase, customerIndex = {}) {
  return routeCards(pageViewModel).map((card, index) => {
    const key = routeKey(card, phase, index);
    const timeline = asArray(card.timeline);
    const stops = timeline
      .filter((node) => node?.type === 'stop')
      .map((stop, stopIndex) => decorateStop(stop, {
        customerIndex,
        phase,
        routeKey: key,
        index: stopIndex,
        driverUserId: card.driverUserId,
        driverName: card.driverName,
      }));
    const editAction = card.routeEditAction && typeof card.routeEditAction === 'object'
      ? card.routeEditAction
      : null;
    const editPayload = editAction?.payload && typeof editAction.payload === 'object'
      ? editAction.payload
      : null;
    const endNode = timeline.find((node) => node?.type === 'end') || null;
    return {
      ...card,
      _routeKey: key,
      _phase: phase,
      _phaseLabel: PHASE_PRESENTATION[phase]?.label || phase,
      _timeline: timeline,
      _endNode: endNode,
      _stops: stops,
      _routeEditPayload: editPayload,
      canEditRoute: editAction?.canEditRoute ?? card.canEditRoute,
      editDisabledReasonCode: editAction?.editDisabledReasonCode ?? card.editDisabledReasonCode,
      editDisabledMessage: editAction?.editDisabledMessage ?? card.editDisabledMessage,
      routeResourceType: editAction?.routeResourceType
        ?? editPayload?.routeResourceType
        ?? card.routeResourceType,
      canExpandRoute: editAction?.canExpandRoute ?? card.canExpandRoute,
      expandDisabledReasonCode: editAction?.expandDisabledReasonCode
        ?? card.expandDisabledReasonCode,
      expandDisabledMessage: editAction?.expandDisabledMessage ?? card.expandDisabledMessage,
      candidatePolicy: editAction?.candidatePolicy ?? card.candidatePolicy,
      expansionConstraintDefaults: editAction?.expansionConstraintDefaults
        ?? card.expansionConstraintDefaults,
    };
  });
}

function buildUnassigned(pageViewModel, customerIndex) {
  return unassignedCards(pageViewModel).map((stop, index) => decorateStop(stop, {
    customerIndex,
    phase: 'dispatch',
    routeKey: 'dispatch:unassigned',
    index,
    driverUserId: null,
    driverName: '未分配',
  }));
}

function businessStopKey(stop) {
  return comparableId(
    stop.deliveryStopId ?? stop.taskId ?? stop.stopId
      ?? stop.depFatherId ?? stop.departmentId ?? stop.nxDepartmentId
      ?? stop.customerName
  );
}

export function buildOrderCollections(snapshots, customerPayload) {
  const customerIndex = buildCustomerIndex(customerPayload);
  const dispatchPageViewModel = snapshots?.dispatch?.pageViewModel;
  const dispatchRoutes = decorateRoutesWithPlanningLocks(
    buildRoutes(dispatchPageViewModel, 'dispatch', customerIndex),
    dispatchPageViewModel
  );
  const loadingRoutes = buildRoutes(snapshots?.loading?.pageViewModel, 'loading', customerIndex);
  const deliveryRoutes = buildRoutes(snapshots?.delivery?.pageViewModel, 'delivery', customerIndex);
  const pending = [
    ...dispatchRoutes.flatMap((route) => route._stops),
    ...decorateStopsWithPlanningLocks(
      buildUnassigned(dispatchPageViewModel, customerIndex),
      dispatchPageViewModel
    ),
  ];
  const loading = loadingRoutes.flatMap((route) => route._stops);
  const delivery = deliveryRoutes.flatMap((route) => route._stops);
  const todayMap = new Map();
  [...pending, ...loading, ...delivery].forEach((stop) => {
    todayMap.set(businessStopKey(stop) || stop._stopKey, stop);
  });
  return {
    today: Array.from(todayMap.values()),
    pending,
    loading,
    delivery,
    routes: {
      dispatch: dispatchRoutes,
      loading: loadingRoutes,
      delivery: deliveryRoutes,
    },
  };
}

export function buildDriverRows(driverPayload, snapshots) {
  const baseCards = asArray(driverPayload?.driverCards);
  const routeByDriver = new Map();
  ['dispatch', 'loading', 'delivery'].forEach((phase) => {
    routeCards(snapshots?.[phase]?.pageViewModel).forEach((route) => {
      routeByDriver.set(comparableId(route.driverUserId), {
        route,
        phase,
        phaseLabel: PHASE_PRESENTATION[phase].label,
      });
    });
  });
  return baseCards.map((driver) => {
    const current = routeByDriver.get(comparableId(driver.driverUserId));
    const route = current?.route;
    return {
      ...driver,
      _online: driver.dutyStatus === 'ON_DUTY',
      _onlineLabel: asText(driver.dutyStatusLabel, driver.dutyStatus === 'ON_DUTY' ? '已上岗' : '未上岗'),
      _taskLabel: asText(
        driver.currentTaskLine
          ?? driver.routeSummary
          ?? route?.deliveryProgressLine
          ?? route?.routeSummary
          ?? route?.routeStatsLine,
        '暂无当前任务'
      ),
      _stageLabel: asText(
        driver.dispatchStageLabel ?? route?.driverStatusLabel ?? current?.phaseLabel,
        '空闲'
      ),
      _routeKey: route ? routeKey(route, current.phase, 0) : null,
      _phase: current?.phase || null,
    };
  });
}

export function findStopBySelection(collections, selection) {
  if (!selection) return null;
  const all = [
    ...collections.today,
    ...collections.pending,
    ...collections.loading,
    ...collections.delivery,
  ];
  if (selection.stopKey) {
    const direct = all.find((stop) => stop._stopKey === selection.stopKey);
    if (direct) return direct;
  }
  if (selection.deliveryStopId !== null && selection.deliveryStopId !== undefined) {
    return all.find((stop) => comparableId(stop.deliveryStopId) === comparableId(selection.deliveryStopId)) || null;
  }
  return null;
}

export function findStopForMarker(collections, marker, phase) {
  const source = phase === 'delivery'
    ? collections.delivery
    : phase === 'loading'
      ? collections.loading
      : collections.pending;
  return source.find((stop) => (
    (marker.depFatherId != null && comparableId(stop.depFatherId) === comparableId(marker.depFatherId))
    || (marker.customerName && asText(stop.customerName) === asText(marker.customerName))
  )) || null;
}
