// src/store/index.js
import { createStore } from 'vuex'; // 使用 Vuex 4.x 的创建方法
import pageHeader from './modules/pageHeader';
import dispatch from '@/modules/dispatch/store';
import axiosInstance from '@/api/axios'; // 使用配置好的 Axios 实例

// 从 localStorage 恢复 disUser
const restoreDisUser = () => {
  try {
    const disUserStr = localStorage.getItem('disUser');
    if (disUserStr) {
      return JSON.parse(disUserStr);
    }
  } catch (error) {
    console.error('恢复 disUser 失败:', error);
  }
  return null;
};

const state = {
  disUser: restoreDisUser(), // 从 localStorage 恢复
  user: '',
  pasteArr: '',
  loading: false, // 全局加载状态
  /** MCP 配送单打印任务 FIFO 队列（多店/多任务排队，避免覆盖丢失） */
  mcpPrintQueue: [],
};

function syncMcpSessionUser(value) {
  try {
    window.electronAPI?.setMcpSessionUser?.(value || null);
  } catch (error) {
    console.warn('[MCP] 同步内存会话摘要失败:', error);
  }
}

function clearBrowserCookies() {
  try {
    document.cookie.split(';').forEach((cookie) => {
      const separator = cookie.indexOf('=');
      const name = (separator >= 0 ? cookie.slice(0, separator) : cookie).trim();
      if (name) {
        document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
      }
    });
  } catch {
    // Electron 主进程会清理 HttpOnly Cookie；浏览器预览只清理页面可见 Cookie。
  }
}

function removeUserCache() {
  const exactKeys = new Set([
    'disUser',
    'user',
    'pasteArr',
    'rememberPrinterUser',
    'simpleTaskList',
  ]);
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key && (exactKeys.has(key) || key.startsWith('ocrOrderDepList'))) {
      localStorage.removeItem(key);
    }
  }
  try {
    sessionStorage.clear();
  } catch {
    // 无可用 sessionStorage 时忽略。
  }
  clearBrowserCookies();
}

const store = createStore({  // 使用 createStore 替代 Vuex.Store
  modules: {
    pageHeader,
    dispatch,
  },
  state,
  getters: {},
  mutations: {
    SET_LOADING(state, payload) {
      state.loading = payload;
    },
    SET_DISUSER(state, value) { // 修改为与 action 提交一致的名称
      state.disUser = value;
      if (value) {
        localStorage.setItem('disUser', JSON.stringify(value));
      } else {
        localStorage.removeItem('disUser');
      }
      syncMcpSessionUser(value);
    },
    SET_USER(state, value) { // 修改为与 action 提交一致的名称
      state.user = value;
      localStorage.setItem('user', JSON.stringify(value));
    },
    SET_PASTE_ORDER(state, value) { // 修改为与 action 提交一致的名称
      state.pasteArr = value;
      localStorage.setItem('pasteArr', JSON.stringify(value));
    },
    /** @param {Record<string, unknown>} task */
    ENQUEUE_MCP_PRINT_TASK(state, task) {
      if (!task || typeof task !== 'object') return;
      const copy = { ...task };
      const id = copy.taskId;
      if (id != null && state.mcpPrintQueue.some((t) => t.taskId === id)) return;
      state.mcpPrintQueue.push(copy);
    },
    SHIFT_MCP_PRINT_QUEUE(state) {
      state.mcpPrintQueue.shift();
    },
    CLEAR_MCP_PRINT_QUEUE(state) {
      state.mcpPrintQueue = [];
    },
    CLEAR_USER_SESSION_CACHE(state) {
      state.disUser = null;
      state.user = '';
      state.pasteArr = '';
      state.mcpPrintQueue = [];
      removeUserCache();
      syncMcpSessionUser(null);
    },
  },
  actions: {
    setLoading({ commit }, payload) {
      commit('SET_LOADING', payload);
    },
    async fetchDisUser({ commit }, payload) {
      commit('SET_LOADING', true); // 显示加载遮盖层
      try {
        const response = await axiosInstance.get('/user-endpoint', { params: payload });
        commit('SET_DISUSER', response.data);
      } catch (error) {
        console.error("获取用户数据失败:", error);
      } finally {
        commit('SET_LOADING', false); // 隐藏加载遮盖层
      }
    },
    async logoutUserSession({ commit, dispatch }) {
      let desktopResult = { ok: true };
      try {
        await dispatch('dispatch/cancelRead');
        desktopResult = await window.electronAPI?.userSession?.logout?.() || { ok: true };
      } catch (error) {
        desktopResult = {
          ok: false,
          message: error?.message || '桌面安全会话清理失败',
        };
      } finally {
        commit('dispatch/RESET_RUNTIME_STATE');
        commit('CLEAR_USER_SESSION_CACHE');
      }
      return desktopResult;
    },
    // 其他 actions...
  },
});

export default store;
