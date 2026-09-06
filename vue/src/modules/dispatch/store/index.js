const PHASES = Object.freeze(['dispatch', 'loading', 'delivery']);

function createRemoteSnapshot() {
  return {
    status: 'idle',
    pageViewModel: null,
    data: null,
    error: null,
    receivedAt: null,
  };
}

function initialState() {
  return {
    context: {
      activePhase: 'dispatch',
      routeDate: null,
      batchCode: 'MORNING',
    },
    snapshots: {
      dispatch: createRemoteSnapshot(),
      loading: createRemoteSnapshot(),
      delivery: createRemoteSnapshot(),
      drivers: createRemoteSnapshot(),
      customers: createRemoteSnapshot(),
    },
    selection: {
      driverUserId: null,
      stopKey: null,
      deliveryStopId: null,
      routeKey: null,
    },
    refresh: {
      status: 'idle',
      requestId: 0,
      error: null,
      finishedAt: null,
    },
    auth: {
      status: 'unknown',
      session: null,
      error: null,
    },
    command: {
      status: 'idle',
      action: null,
      error: null,
      result: null,
    },
  };
}

let activeAbortController = null;
let nextRequestId = 0;

function errorMessage(error) {
  return error?.response?.data?.msg
    || error?.message
    || '读取失败';
}

async function executeDispatchCommand(commit, {
  method,
  action,
  args = {},
  errorMessage: fallbackMessage,
  idempotent = true,
}) {
  const commands = window.electronAPI?.dispatchCommands;
  const command = commands?.[method];
  if (!command) {
    return { ok: false, status: 0, message: fallbackMessage || '当前环境不支持该调度操作' };
  }
  commit('BEGIN_COMMAND', action);
  try {
    const commandArgs = { ...args };
    if (idempotent) {
      if (!commands.createIdempotencyKey) {
        throw new Error('当前环境无法生成调度幂等键');
      }
      commandArgs.idempotencyKey = await commands.createIdempotencyKey();
    }
    const result = await command(commandArgs);
    if (result?.ok) commit('COMPLETE_COMMAND', { action, result: result.data });
    else commit('FAIL_COMMAND', { action, error: result });
    if (result?.status === 401) commit('SET_AUTH', { status: 'anonymous' });
    return result;
  } catch (error) {
    const result = {
      ok: false,
      status: 0,
      message: error?.message || fallbackMessage || '调度操作失败',
    };
    commit('FAIL_COMMAND', { action, error: result });
    return result;
  }
}

/**
 * 调度状态边界：读取快照与写命令分离。远程 pageViewModel 不落盘，
 * 所有写操作只经 preload 的逐项白名单进入主进程，业务状态仍由服务端推进。
 * 服务端失败时保留最后一次成功快照，并标记为 stale/error。
 */
const dispatchStore = {
  namespaced: true,
  state: initialState,
  mutations: {
    SET_ACTIVE_PHASE(state, phase) {
      if (PHASES.includes(phase)) {
        state.context.activePhase = phase;
      }
    },
    SET_SELECTION(state, selection = {}) {
      state.selection = {
        ...state.selection,
        ...selection,
      };
    },
    BEGIN_READ(state, requestId) {
      state.refresh = {
        status: state.refresh.finishedAt ? 'refreshing' : 'loading',
        requestId,
        error: null,
        finishedAt: state.refresh.finishedAt,
      };
      Object.values(state.snapshots).forEach((snapshot) => {
        snapshot.status = snapshot.receivedAt ? 'refreshing' : 'loading';
        snapshot.error = null;
      });
    },
    SET_PAGE_SNAPSHOT(state, { key, pageViewModel, receivedAt }) {
      const snapshot = state.snapshots[key];
      if (!snapshot) return;
      snapshot.status = 'ready';
      snapshot.pageViewModel = pageViewModel;
      snapshot.data = null;
      snapshot.error = null;
      snapshot.receivedAt = receivedAt;
    },
    SET_DATA_SNAPSHOT(state, { key, data, receivedAt }) {
      const snapshot = state.snapshots[key];
      if (!snapshot) return;
      snapshot.status = 'ready';
      snapshot.data = data;
      snapshot.pageViewModel = null;
      snapshot.error = null;
      snapshot.receivedAt = receivedAt;
    },
    SET_SNAPSHOT_ERROR(state, { key, error }) {
      const snapshot = state.snapshots[key];
      if (!snapshot) return;
      snapshot.status = snapshot.receivedAt ? 'stale' : 'error';
      snapshot.error = error;
    },
    COMPLETE_READ(state, { requestId, status, error, finishedAt }) {
      if (state.refresh.requestId !== requestId) return;
      state.refresh = {
        status: status || (error ? 'partial' : 'ready'),
        requestId,
        error,
        finishedAt,
      };
    },
    SET_AUTH(state, { status, session = null, error = null }) {
      state.auth = { status, session, error };
    },
    BEGIN_COMMAND(state, action) {
      state.command = {
        status: 'submitting',
        action,
        error: null,
        result: null,
      };
    },
    COMPLETE_COMMAND(state, { action, result }) {
      state.command = {
        status: 'success',
        action,
        error: null,
        result,
      };
    },
    FAIL_COMMAND(state, { action, error }) {
      state.command = {
        status: 'error',
        action,
        error,
        result: null,
      };
    },
    CLEAR_COMMAND(state) {
      state.command = initialState().command;
    },
    CLEAR_SELECTION(state) {
      state.selection = initialState().selection;
    },
    RESET_RUNTIME_STATE(state) {
      const fresh = initialState();
      state.context = fresh.context;
      state.snapshots = fresh.snapshots;
      state.selection = fresh.selection;
      state.refresh = fresh.refresh;
      state.auth = fresh.auth;
      state.command = fresh.command;
    },
  },
  actions: {
    async loadWorkbench({ state, rootState, commit }) {
      const disUser = rootState.disUser;
      const disId = disUser?.nxDiuDistributerId;
      if (disId === null || disId === undefined || String(disId).trim() === '') {
        const requestId = ++nextRequestId;
        commit('BEGIN_READ', requestId);
        const message = '未找到配送商登录信息，请先登录';
        Object.keys(state.snapshots).forEach((key) => {
          commit('SET_SNAPSHOT_ERROR', { key, error: message });
        });
        commit('COMPLETE_READ', {
          requestId,
          status: 'error',
          error: message,
          finishedAt: new Date().toISOString(),
        });
        return { ok: false, error: message };
      }

      if (activeAbortController) {
        activeAbortController.abort();
      }
      activeAbortController = new AbortController();
      const controller = activeAbortController;
      const requestId = ++nextRequestId;
      const context = {
        disId,
        operatorUserId: disUser?.nxDistributerUserId,
        routeDate: state.context.routeDate,
        batchCode: state.context.batchCode,
      };
      commit('BEGIN_READ', requestId);

      const [
        { getDispatchToday, getLoadingToday, getDeliveryToday, getAvailableDrivers },
        { getDistributerCustomers },
      ] = await Promise.all([
        import('../api/dispatchReadApi'),
        import('@/modules/order/api/orderReadApi'),
      ]);

      const tasks = [
        ['dispatch', 'page', getDispatchToday(context, controller.signal)],
        ['loading', 'page', getLoadingToday(context, controller.signal)],
        ['delivery', 'page', getDeliveryToday(context, controller.signal)],
        ['drivers', 'data', getAvailableDrivers(context, controller.signal)],
        ['customers', 'data', getDistributerCustomers(disId, controller.signal)],
      ];
      const results = await Promise.allSettled(tasks.map(([, , promise]) => promise));
      if (controller.signal.aborted || activeAbortController !== controller) {
        return { ok: false, aborted: true };
      }

      const receivedAt = new Date().toISOString();
      const failures = [];
      results.forEach((result, index) => {
        const [key, kind] = tasks[index];
        if (result.status === 'fulfilled') {
          commit(kind === 'page' ? 'SET_PAGE_SNAPSHOT' : 'SET_DATA_SNAPSHOT', {
            key,
            [kind === 'page' ? 'pageViewModel' : 'data']: result.value,
            receivedAt,
          });
          return;
        }
        const message = errorMessage(result.reason);
        failures.push(`${key}: ${message}`);
        commit('SET_SNAPSHOT_ERROR', { key, error: message });
      });

      const aggregateError = failures.length ? failures.join('；') : null;
      const refreshStatus = failures.length === 0
        ? 'ready'
        : failures.length === tasks.length
          ? 'error'
          : 'partial';
      commit('COMPLETE_READ', {
        requestId,
        status: refreshStatus,
        error: aggregateError,
        finishedAt: receivedAt,
      });
      if (activeAbortController === controller) {
        activeAbortController = null;
      }
      return {
        ok: failures.length === 0,
        partial: failures.length > 0 && failures.length < tasks.length,
        error: aggregateError,
      };
    },
    cancelRead() {
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }
    },
    async restoreAuth({ commit }) {
      const api = window.electronAPI?.dispatchAuth;
      if (!api?.getSession) {
        const error = '当前环境无法读取桌面登录状态';
        commit('SET_AUTH', { status: 'error', error });
        return { ok: false, status: 0, message: error };
      }
      commit('SET_AUTH', { status: 'checking' });
      const result = await api.getSession();
      if (!result?.ok) {
        commit('SET_AUTH', {
          status: result?.status === 401 ? 'anonymous' : 'error',
          error: result?.message || '无法校验桌面登录状态',
        });
        return result;
      }
      const session = result.data || {};
      commit('SET_AUTH', {
        status: session.authenticated ? 'authenticated' : 'anonymous',
        session,
      });
      return result;
    },
    async assignDriver({ commit }, payload) {
      const commands = window.electronAPI?.dispatchCommands;
      if (!commands?.assignDriver || !commands?.createIdempotencyKey) {
        return { ok: false, status: 0, message: '当前环境不支持桌面调度写操作' };
      }
      commit('BEGIN_COMMAND', 'assign-driver');
      try {
        const idempotencyKey = await commands.createIdempotencyKey();
        const result = await commands.assignDriver({ idempotencyKey, payload });
        if (result?.ok) {
          commit('COMPLETE_COMMAND', { action: 'assign-driver', result: result.data });
        } else {
          commit('FAIL_COMMAND', { action: 'assign-driver', error: result });
          if (result?.status === 401) commit('SET_AUTH', { status: 'anonymous' });
        }
        return result;
      } catch (error) {
        const result = { ok: false, status: 0, message: error?.message || '分配司机失败' };
        commit('FAIL_COMMAND', { action: 'assign-driver', error: result });
        return result;
      }
    },
    async previewRoute({ commit }, payload) {
      const commands = window.electronAPI?.dispatchCommands;
      if (!commands?.previewRoute) {
        return { ok: false, status: 0, message: '当前环境不支持路线预览' };
      }
      commit('BEGIN_COMMAND', 'preview-route');
      try {
        const result = await commands.previewRoute({ payload });
        if (result?.ok) {
          commit('COMPLETE_COMMAND', { action: 'preview-route', result: result.data });
        } else {
          commit('FAIL_COMMAND', { action: 'preview-route', error: result });
          if (result?.status === 401) commit('SET_AUTH', { status: 'anonymous' });
        }
        return result;
      } catch (error) {
        const result = { ok: false, status: 0, message: error?.message || '路线预览失败' };
        commit('FAIL_COMMAND', { action: 'preview-route', error: result });
        return result;
      }
    },
    async previewRouteExpansion({ commit }, payload) {
      const commands = window.electronAPI?.dispatchCommands;
      if (!commands?.previewRouteExpansion) {
        return { ok: false, status: 0, message: '当前环境不支持 AI 路线增补' };
      }
      commit('BEGIN_COMMAND', 'preview-route-expansion');
      try {
        const result = await commands.previewRouteExpansion({ payload });
        if (result?.ok) {
          commit('COMPLETE_COMMAND', { action: 'preview-route-expansion', result: result.data });
        } else {
          commit('FAIL_COMMAND', { action: 'preview-route-expansion', error: result });
          if (result?.status === 401) commit('SET_AUTH', { status: 'anonymous' });
        }
        return result;
      } catch (error) {
        const result = { ok: false, status: 0, message: error?.message || 'AI 路线增补失败' };
        commit('FAIL_COMMAND', { action: 'preview-route-expansion', error: result });
        return result;
      }
    },
    async releaseRoutePreview(context, payload) {
      const command = window.electronAPI?.dispatchCommands?.releaseRoutePreview;
      if (!command) {
        return { ok: false, status: 0, message: '当前环境不支持结束路线编辑' };
      }
      try {
        return await command({ payload });
      } catch (error) {
        return { ok: false, status: 0, message: error?.message || '结束路线编辑失败' };
      }
    },
    async loadRouteEditPage({ commit }, payload) {
      const command = window.electronAPI?.dispatchCommands?.loadRouteEditPage;
      if (!command) {
        return { ok: false, status: 0, message: '当前环境不支持读取司机路线编辑数据' };
      }
      commit('BEGIN_COMMAND', 'load-route-edit-page');
      try {
        const result = await command({ payload });
        if (result?.ok) {
          commit('COMPLETE_COMMAND', { action: 'load-route-edit-page', result: result.data });
        } else {
          commit('FAIL_COMMAND', { action: 'load-route-edit-page', error: result });
          if (result?.status === 401) commit('SET_AUTH', { status: 'anonymous' });
        }
        return result;
      } catch (error) {
        const result = { ok: false, status: 0, message: error?.message || '司机路线数据读取失败' };
        commit('FAIL_COMMAND', { action: 'load-route-edit-page', error: result });
        return result;
      }
    },
    async confirmRouteEdit({ commit }, payload) {
      const commands = window.electronAPI?.dispatchCommands;
      if (!commands?.confirmDispatch || !commands?.createIdempotencyKey) {
        return { ok: false, status: 0, message: '当前环境不支持路线调整' };
      }
      commit('BEGIN_COMMAND', 'confirm-route-edit');
      try {
        const idempotencyKey = await commands.createIdempotencyKey();
        const result = await commands.confirmDispatch({ idempotencyKey, payload });
        if (result?.ok) {
          commit('COMPLETE_COMMAND', { action: 'confirm-route-edit', result: result.data });
        } else {
          commit('FAIL_COMMAND', { action: 'confirm-route-edit', error: result });
          if (result?.status === 401) commit('SET_AUTH', { status: 'anonymous' });
        }
        return result;
      } catch (error) {
        const result = { ok: false, status: 0, message: error?.message || '路线保存失败' };
        commit('FAIL_COMMAND', { action: 'confirm-route-edit', error: result });
        return result;
      }
    },
    async confirmDispatch({ commit }, payload) {
      const commands = window.electronAPI?.dispatchCommands;
      if (!commands?.confirmDispatch || !commands?.createIdempotencyKey) {
        return { ok: false, status: 0, message: '当前环境不支持桌面调度写操作' };
      }
      commit('BEGIN_COMMAND', 'confirm-dispatch');
      try {
        const idempotencyKey = await commands.createIdempotencyKey();
        const result = await commands.confirmDispatch({ idempotencyKey, payload });
        if (result?.ok) {
          commit('COMPLETE_COMMAND', { action: 'confirm-dispatch', result: result.data });
        } else {
          commit('FAIL_COMMAND', { action: 'confirm-dispatch', error: result });
          if (result?.status === 401) commit('SET_AUTH', { status: 'anonymous' });
        }
        return result;
      } catch (error) {
        const result = { ok: false, status: 0, message: error?.message || '确认派单失败' };
        commit('FAIL_COMMAND', { action: 'confirm-dispatch', error: result });
        return result;
      }
    },
    async lockPlanningStop({ commit }, payload) {
      const command = window.electronAPI?.dispatchCommands?.lockPlanningStop;
      if (!command) return { ok: false, status: 0, message: '当前环境不支持锁定客户' };
      commit('BEGIN_COMMAND', 'lock-planning-stop');
      try {
        const result = await command({ payload });
        if (result?.ok) commit('COMPLETE_COMMAND', { action: 'lock-planning-stop', result: result.data });
        else commit('FAIL_COMMAND', { action: 'lock-planning-stop', error: result });
        if (result?.status === 401) commit('SET_AUTH', { status: 'anonymous' });
        return result;
      } catch (error) {
        const result = { ok: false, status: 0, message: error?.message || '锁定客户失败' };
        commit('FAIL_COMMAND', { action: 'lock-planning-stop', error: result });
        return result;
      }
    },
    async unlockPlanningStop({ commit }, payload) {
      const command = window.electronAPI?.dispatchCommands?.unlockPlanningStop;
      if (!command) return { ok: false, status: 0, message: '当前环境不支持解除锁定' };
      commit('BEGIN_COMMAND', 'unlock-planning-stop');
      try {
        const result = await command({ payload });
        if (result?.ok) commit('COMPLETE_COMMAND', { action: 'unlock-planning-stop', result: result.data });
        else commit('FAIL_COMMAND', { action: 'unlock-planning-stop', error: result });
        if (result?.status === 401) commit('SET_AUTH', { status: 'anonymous' });
        return result;
      } catch (error) {
        const result = { ok: false, status: 0, message: error?.message || '解除锁定失败' };
        commit('FAIL_COMMAND', { action: 'unlock-planning-stop', error: result });
        return result;
      }
    },
    async updateDriverEmployment({ commit }, { driverUserId, payload }) {
      const command = window.electronAPI?.dispatchCommands?.updateDriverEmployment;
      if (!command) return { ok: false, status: 0, message: '当前环境不支持司机类型设置' };
      commit('BEGIN_COMMAND', 'driver-employment');
      try {
        const result = await command({ driverUserId, payload });
        if (result?.ok) commit('COMPLETE_COMMAND', { action: 'driver-employment', result: result.data });
        else commit('FAIL_COMMAND', { action: 'driver-employment', error: result });
        if (result?.status === 401) commit('SET_AUTH', { status: 'anonymous' });
        return result;
      } catch (error) {
        const result = { ok: false, status: 0, message: error?.message || '司机类型设置失败' };
        commit('FAIL_COMMAND', { action: 'driver-employment', error: result });
        return result;
      }
    },
    checkInDriver({ commit }, { driverUserId, payload }) {
      return executeDispatchCommand(commit, {
        method: 'checkInDriver',
        action: 'driver-duty-on',
        args: { driverUserId, payload },
        errorMessage: '开启司机可派状态失败',
      });
    },
    checkOutDriver({ commit }, { driverUserId, payload }) {
      return executeDispatchCommand(commit, {
        method: 'checkOutDriver',
        action: 'driver-duty-off',
        args: { driverUserId, payload },
        errorMessage: '关闭司机可派状态失败',
      });
    },
    updateStopTimeWindow({ commit }, payload) {
      return executeDispatchCommand(commit, {
        method: 'updateStopTimeWindow',
        action: 'update-stop-time-window',
        args: { payload },
        errorMessage: '更新送达时间失败',
      });
    },
    returnStopToSandbox({ commit }, { deliveryStopId, payload }) {
      return executeDispatchCommand(commit, {
        method: 'returnStopToSandbox',
        action: 'return-stop-to-sandbox',
        args: { deliveryStopId, payload },
        errorMessage: '客户退回待分配失败',
      });
    },
    loadManualDispatchPanorama({ commit }, payload) {
      return executeDispatchCommand(commit, {
        method: 'loadManualDispatchPanorama',
        action: 'load-manual-driver-panorama',
        args: { payload },
        errorMessage: '读取人工调度司机列表失败',
        idempotent: false,
      });
    },
    departDriver({ commit }, { driverUserId, payload }) {
      return executeDispatchCommand(commit, {
        method: 'departDriver',
        action: 'depart-driver',
        args: { driverUserId, payload },
        errorMessage: '确认发车失败',
      });
    },
    completeDeliveryStop({ commit }, { deliveryStopId, payload }) {
      return executeDispatchCommand(commit, {
        method: 'completeDeliveryStop',
        action: 'complete-delivery-stop',
        args: { deliveryStopId, payload },
        errorMessage: '确认送达失败',
      });
    },
    returnDeliveryStopToSandbox({ commit }, { deliveryStopId, payload }) {
      return executeDispatchCommand(commit, {
        method: 'returnDeliveryStopToSandbox',
        action: 'return-delivery-stop-to-sandbox',
        args: { deliveryStopId, payload },
        errorMessage: '配送客户退回待分配失败',
      });
    },
    previewRouteReassignment({ commit }, payload) {
      return executeDispatchCommand(commit, {
        method: 'previewRouteReassignment',
        action: 'preview-route-reassignment',
        args: { payload },
        errorMessage: '校验目标司机失败',
        idempotent: false,
      });
    },
    confirmRouteReassignment({ commit }, payload) {
      return executeDispatchCommand(commit, {
        method: 'confirmRouteReassignment',
        action: 'confirm-route-reassignment',
        args: { payload },
        errorMessage: '更换路线司机失败',
      });
    },
  },
};

export { PHASES, initialState };
export default dispatchStore;
