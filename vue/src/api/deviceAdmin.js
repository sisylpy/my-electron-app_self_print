// src/api/deviceAdmin.js
import axiosInstance from './axios';

const api = '/api';
if (!api) {
  console.error('VITE_API_URL is not defined in the environment variables.');
}

const deviceAdminApi = {
  /**
   * 设备管理员登录
   * @param {string} phone - 手机号
   * @returns {Promise} 登录结果
   */
  login(phone) {
    return axiosInstance.post('/machine/printSoftware/login', 
      `phone=${encodeURIComponent(phone)}`, 
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
  },

  /**
   * 获取市场的设备列表
   * @param {number} marketId - 市场ID
   * @returns {Promise} 设备列表
   */
  getDevices(marketId) {
    return axiosInstance.get(`/machine/printSoftware/devices?marketId=${marketId}`);
  },

  /**
   * 验证手机号格式（可选，用于实时验证）
   * @param {string} phone - 手机号
   * @returns {Promise} 验证结果
   */
  checkPhone(phone) {
    return axiosInstance.get(`/machine/printSoftware/checkPhone?phone=${phone}`);
  },

  /**
   * 记录打印（设备管理员配置完成后，配送商打印时调用）
   * @param {Object} params - 打印记录参数
   * @returns {Promise} 记录结果
   */
  recordPrint(params) {
    const formData = new URLSearchParams();
    Object.keys(params).forEach(key => {
      formData.append(key, params[key]);
    });

    return axiosInstance.post('/machine/print/record', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }
};

export default deviceAdminApi;
