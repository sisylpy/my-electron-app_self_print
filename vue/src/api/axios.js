// src/api/axios.js
import axios from 'axios';
import store from '../store'; // 引入 Vuex Store
import config from '../config'; // 引入配置文件

// 获取环境变量中的 API 地址
// 开发环境使用本地地址，生产环境使用远程地址
const apiUrl = process.env.NODE_ENV === 'development' 
  ? 'http://192.168.0.102:8080/nongxinle_master_war_exploded/api/'
  : (config.baseURL || 'https://grainservice.club:8443/nongxinle/api/');

// 创建 Axios 实例
const axiosInstance = axios.create({
  baseURL: apiUrl, // 使用环境变量作为 baseURL
  // 其他配置（如超时、请求头等）
  timeout: 10000, // 设置请求超时为10秒
  headers: {
    'Content-Type': 'application/json',
    // 其他头部配置
  },
});


// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    // console.log('📤 发送请求:', config);
    // console.log('📤 请求 URL:', config.url);
    // console.log('📤 请求方法:', config.method);
    // console.log('📤 请求数据:', config.data);
    // console.log('📤 请求数据类型:', typeof config.data, config.data instanceof URLSearchParams ? 'URLSearchParams' : typeof config.data);
    // console.log('📤 请求头:', config.headers);
    // console.log('📤 Content-Type:', config.headers?.['Content-Type'] || config.headers?.['content-type']);
    //
    // 如果数据是 URLSearchParams 类型或字符串类型（form-urlencoded），确保 Content-Type 正确设置
    if (config.data instanceof URLSearchParams) {
      if (!config.headers) {
        config.headers = {};
      }
      // 强制设置为 form-urlencoded，确保不会被默认的 JSON Content-Type 覆盖
      config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      // 确保 URLSearchParams 被正确序列化为字符串
      if (config.data.toString && typeof config.data.toString === 'function') {
        const paramsString = config.data.toString();
        console.log('📤 检测到 URLSearchParams，已设置 Content-Type，参数字符串:', paramsString);
        // 如果参数字符串为空，说明 URLSearchParams 对象是空的
        if (!paramsString || paramsString.trim() === '') {
          console.error('⚠️ 警告：URLSearchParams 对象为空！');
        }
      } else {
        console.log('📤 检测到 URLSearchParams，已设置 Content-Type');
      }
    } else if (typeof config.data === 'string' && config.data.includes('=') && 
               config.headers && config.headers['Content-Type'] === 'application/x-www-form-urlencoded') {
      // 如果数据是字符串格式的 form-urlencoded 数据，确保 Content-Type 正确
      console.log('📤 检测到字符串格式的 form-urlencoded 数据:', config.data);
    }
    
    // 如果数据是对象且 URL 是 disSaveStandard，确保使用 JSON 格式
    if (config.url && config.url.includes('disSaveStandard') && typeof config.data === 'object' && !(config.data instanceof URLSearchParams)) {
      if (!config.headers) {
        config.headers = {};
      }
      // 确保使用 JSON 格式
      if (!config.headers['Content-Type']) {
        config.headers['Content-Type'] = 'application/json';
      }
      console.log('📤 检测到 disSaveStandard 请求，确保使用 JSON 格式');
    }
    
    // 检查请求配置中是否明确设置了 showLoading 为 false
    if (config.showLoading !== false) {
      store.dispatch('setLoading', true); // 显示遮盖层
    }
    
    console.log('📤 最终请求配置:', {
      url: config.url,
      method: config.method,
      data: config.data,
      headers: config.headers
    });
    
    return config;
  },
  (error) => {
    console.error('请求错误:', error);
    // store.dispatch('setLoading', false); // 隐藏遮盖层
    
    if (error.config && error.config.showLoading !== false) {
      store.dispatch('setLoading', false); // 隐藏遮盖层
    }
    return Promise.reject(error);
  }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => {
    console.log('接收响应:', response);
    // store.dispatch('setLoading', false); // 隐藏遮盖层
     // 检查请求配置中是否明确设置了 showLoading 为 false
     if (response.config.showLoading !== false) {
      store.dispatch('setLoading', false); // 隐藏遮盖层
    }
    return response;
  },
  (error) => {
    console.error('响应错误:', error);
    // store.dispatch('setLoading', false); // 隐藏遮盖层
    if (error.config && error.config.showLoading !== false) {
      store.dispatch('setLoading', false); // 隐藏遮盖层
    }
    return Promise.reject(error);
  }
);




export default axiosInstance;
