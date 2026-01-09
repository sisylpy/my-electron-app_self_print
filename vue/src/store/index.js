// src/store/index.js
import { createStore } from 'vuex'; // 使用 Vuex 4.x 的创建方法
import pageHeader from './modules/pageHeader';
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
};

export default createStore({  // 使用 createStore 替代 Vuex.Store
  modules: {
    pageHeader,
  },
  state,
  getters: {},
  mutations: {
    SET_LOADING(state, payload) {
      state.loading = payload;
    },
    SET_DISUSER(state, value) { // 修改为与 action 提交一致的名称
      state.disUser = value;
      localStorage.setItem('disUser', JSON.stringify(value));
    },
    SET_USER(state, value) { // 修改为与 action 提交一致的名称
      state.user = value;
      localStorage.setItem('user', JSON.stringify(value));
    },
    SET_PASTE_ORDER(state, value) { // 修改为与 action 提交一致的名称
      state.pasteArr = value;
      localStorage.setItem('pasteArr', JSON.stringify(value));
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
    // 其他 actions...
  },
});
