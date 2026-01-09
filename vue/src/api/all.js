// src/api/index.js
import axiosInstance from './axios'; // 使用配置了拦截器的 Axios 实例

const api = '/api';
if (!api) {
  console.error('VITE_API_URL is not defined in the environment variables.');
}

const apiMethods = {
  // 获取今天的订单客户
  webNxDisGetTodayOrderCustomer(disId) {
    return axiosInstance.get(`nxdepartmentorders/webNxDisGetTodayOrderCustomer/${disId}`);
  },

  webNxDisGetTodayReturnCustomer(data) {
    return axiosInstance.get(`nxdepartmentorders/webNxDisGetTodayReturnCustomer/${data}`);
  },

  nxDisGetGbBatchOrders(data) {
    return axiosInstance.get(`nxdepartmentorders/nxDisGetGbBatchOrders/${data}`);
  },

  // 获取待打印的部门订单
  disGetToFillDepOrders(data) {
    // 如果 data 是 URLSearchParams，转换为字符串以确保正确传递
    let requestData = data;
    if (data instanceof URLSearchParams) {
      requestData = data.toString();
      console.log('📤 [disGetToFillDepOrders] URLSearchParams 转换为字符串:', requestData);
    }
    
    return axiosInstance.post('/nxdepartmentorders/printerGetPrintOrders', requestData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  },

  // 获取录入单价和数量订单（手机端接口）
  phoneGetToFillDepOrders(data) {
    return axiosInstance.post('nxdepartmentorders/phoneGetToFillDepOrders', data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  },

  disGetToFillDepOrdersReturn(data) {
    return axiosInstance.post('nxdepartmentorders/getToFillDepOrdersReturn', data);
  },

  webGetOrderPageSubDep(data) {
    return axiosInstance.post('nxdepartmentorders/webGetSubDepOrderPageSubDep', data);
  },

  webGetOrderPageSubDepRetrun(data) {
    return axiosInstance.post('nxdepartmentorders/webGetSubDepOrderPageSubDepReturn', data);
  },

  webGetOrderPage(data) {
    return axiosInstance.post('nxdepartmentorders/webGetSubDepOrderPage', data);
  },

  webGetOrderPageReturn(data) {
    return axiosInstance.post('nxdepartmentorders/webGetSubDepOrderPageReturn', data);
  },

  saveToFillPriceOrder(data) {
    return axiosInstance.post('nxdepartmentorders/giveOrderPrice', data);
  },

  giveOrderWeight(data) {
    return axiosInstance.post('nxdepartmentorders/giveOrderWeight', data);
  },

  nxDisPrintGbPurBatch(data) {
    return axiosInstance.get(`gbdistributerpurchasebatch/nxDisPrintGbPurBatch/${data}`);
  },
  // 保存账户账单
  saveAccountBill(data) {
    return axiosInstance.get(`nxdepartmentbill/saveAccountBillPrinter/${data}`);
  },

  // 获取全部客户列表
  disGetAllCustomer(disId) {
    return axiosInstance.get(`nxdepartment/disGetAllCustomer/${disId}`);
  },

  // 获取客户历史订单
  sellerAndBuyerGetAccountBills(data) {
    // 使用POST请求，尝试不同的参数格式
    return axiosInstance.post('nxdepartmentbill/sellerAndBuyerGetAccountBills', data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  },

  // 获取订单详情
  getBillApplys(data) {
    // 后端接口接收方法参数，使用查询字符串格式
    const queryString = `billId=${data.billId}&depFatherId=${data.depFatherId}`;
    return axiosInstance.get(`nxdepartmentbill/getBillApplys?${queryString}`);
  },

  saveAccountReturnBill(data) {
    return axiosInstance.post('nxdepartmentbill/saveAccountReturnBill', data);
  },

  /**
   * 检查登录状态，不显示遮盖层
   * @param {String} sessionId - 会话ID
   * @param {Object} config - Axios 配置选项（可选）
   * @returns {Promise} Axios 请求的 Promise
   */
  checkLoginStatus(sessionId, config = {}) {
    return axiosInstance.get(`nxdistributeruser/checkLoginStatus/${sessionId}`, config);
  },
  
  // 上传Excel订单数据（旧接口，保留兼容）
  uploadDepOrderData(formData) {
    return axiosInstance.post('nxdepartmentorders/uploadDepOrderData', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // Excel订单解析接口（新接口，参考文档）
  recognizeOrderFromExcel(formData) {
    return axiosInstance.post('ocr/recognizeOrderFromExcel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 180000 // 设置超时时间为 3 分钟
    });
  },

  // 上传图片订单数据（OCR识别）- 使用FormData方式
  uploadDepOrderImage(formData) {
    return axiosInstance.post('nxdepartmentorders/uploadDepOrderImage', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // OCR识别订单（参考微信小程序实现）
  recognizeOrderOCR(data) {
    return axiosInstance.post('ocr/recognizeOrder', data, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 设置超时时间为 3 分钟（180000 毫秒）
    });
  },

  // 保存订单项（备用接口）
  saveOrderItems(data) {
    return axiosInstance.post('nxdepartmentorders/saveOrderItems', data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  },

  // 在指定订单之前添加新订单（后端使用 @RequestBody，需要 JSON 格式）
  saveOrderBefore(data) {
    // 后端接口使用 @RequestBody，需要发送 JSON 格式
    return axiosInstance.post('nxdepartmentorders/saveBefore', data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  // 根据商品名称快速搜索商品（配送商和系统商品）
  queryDisGoodsByQuickSearchWithDepId(data) {
    return axiosInstance.post('nxdistributergoods/queryDisGoodsByQuickSearchWithDepId', data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 60000 // 设置超时时间为 3 分钟（180000 毫秒）
    });
  },

  // 选择商品后保存订单（单个订单）
  choiceGoodsForApply(orderData) {
    return axiosInstance.post('nxdepartmentorders/choiceGoodsForApply', orderData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 设置超时时间为 3 分钟（180000 毫秒）
    });
  },

  // 更新订单（修改已保存的订单）
  updateOrder(data) {
    return axiosInstance.post('nxdepartmentorders/updateOrder', data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  },

  // 删除订单
  deleteOrder(orderId) {
    return axiosInstance.get(`nxdepartmentorders/delete/${orderId}`);
  },

  // 批量删除订单
  deleteBatchOrders(orderIds) {
    return axiosInstance.post('nxdepartmentorders/deleteBatch', {
      orderIds: orderIds
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000 // 设置超时时间为 5 分钟（300000 毫秒），批量删除可能需要较长时间
    });
  },

  // 下载商品（从系统商品库下载到配送商商品库）
  downDisGoods(goodsData) {
    return axiosInstance.post('nxdistributergoods/postDgnGoods', goodsData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  // 获取配送商商品信息
  disGetGoods(goodsId) {
    return axiosInstance.get(`nxdistributergoods/disGetGoods/${goodsId}`);
  },

  // 保存订单（批量，使用pasteSearchGoods）
  pasteSearchGoods(orderArr) {
    return axiosInstance.post('ocr/pasteSearchGoods', orderArr, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 设置超时时间为2分钟（120秒）
    });
  },

  // 保存规格
  disSaveStandard(data) {
    console.log('🔵 disSaveStandard 原始数据:', data);
    
    // 尝试直接传递对象（JSON格式），因为小程序 wx.request 也是直接传递对象
    // 如果服务器不接受 JSON，再尝试 form-urlencoded
    console.log('🔵 disSaveStandard 尝试使用 JSON 格式');
    console.log('🔵 disSaveStandard 请求配置:', {
      url: 'nxdistributerstandard/disSaveStandard',
      method: 'POST',
      data: data,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return axiosInstance.post('nxdistributerstandard/disSaveStandard', data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  // 删除规格
  disDeleteStandard(standardId) {
    return axiosInstance.post(`nxdistributerstandard/disDeleteStandard/${standardId}`, null, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  },

  // 保存新商品（临时商品）
  saveNxDisLinshiGoods(goodsData) {
    return axiosInstance.post('nxdistributergoods/saveNxDisLinshiGoods', goodsData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },
  
  // 注意：小程序直接使用腾讯云插件，不通过后端API
  // Vue/Electron环境无法使用插件，如需语音识别需要其他方案
  // 此接口已移除，因为小程序没有这个接口
  
  // 其他 API 方法
};

export default apiMethods;
