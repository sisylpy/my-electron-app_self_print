// src/api/index.js
import axiosInstance from './axios'; // 使用配置了拦截器的 Axios 实例

const api = '/api';
if (!api) {
  console.error('VITE_API_URL is not defined in the environment variables.');
}

const apiMethods = {
  // 根据 prompt_key 获取 prompt
  getPromptByKey(promptKey) {
    return axiosInstance.get(`prompt/getByKey?promptKey=${encodeURIComponent(promptKey)}`, {
      showLoading: false // 获取 prompt 时不显示加载状态
    });
  },

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
  


  // Excel订单解析接口（新接口，参考文档）
  recognizeOrderFromExcel(formData, config = {}) {
    return axiosInstance.post('ocr/recognizeOrderFromExcel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 180000, // 设置超时时间为 3 分钟
      ...config // 合并传入的配置（如 showLoading: false）
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

 // OCR识别订单（后台异步处理，接口很快返回；不显示全局蒙板，由调用方自行展示“识别中”等状态）
 recognizeOrderOCRWithAi(data, config = {}) {
  return axiosInstance.post('ocr/recognizeOrderAsync', data, {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 300000, // 5 分钟，仅防网络超时；实际业务在后台异步完成
    showLoading: false, // 避免与页面内“识别中”蒙板重复，接口快速返回
    ...config
  });
},

  // OCR识别订单（参考微信小程序实现）
  recognizeOrderOCR(data, config = {}) {
    return axiosInstance.post('ocr/recognizeOrderFast', data, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 300000, // 设置超时时间为 3 分钟（180000 毫秒）
      ...config // 合并传入的配置（如 showLoading: false）
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
    return axiosInstance.post('nxdepartmentorders/saveOrderBeforeTask', data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  },

  // 根据商品名称快速搜索商品（配送商和系统商品）
  queryDisGoodsByQuickSearchWithDepId(data) {
    return axiosInstance.post('nxdistributergoods/queryDisGoodsByQuickSearchWithDepIdCollDis', data, {
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
      timeout: 300000 // 设置超时时间为 3 分钟（180000 毫秒）
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
    return axiosInstance.get(`nxdepartmentorders/deleteTaskOrder/${orderId}`);
  },

  // 重新识别：将已保存订单恢复到待识别状态，用原始解析数据覆盖，需重新选择商品
  revertTaskOrder(orderId) {
    return axiosInstance.get(`nxdepartmentorders/revertTaskOrder/${orderId}`);
  },

  // 更新订单打印规格
  updateOrderPrint(data) {
    const formData = new URLSearchParams();
    formData.append('orderId', data.orderId);
    formData.append('printName', data.printName);
    
    return axiosInstance.post('nxdepartmentorders/updateOrderPrint', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
      }
    });
  },

  // 更新订单单价
  giveOrderPrice(data) {
    const formData = new URLSearchParams();
    formData.append('orderId', data.orderId);
    formData.append('price', data.price);
    
    return axiosInstance.post('nxdepartmentorders/giveOrderPrice', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
      }
    });
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

  // 按任务 ID 删除该任务下所有订单（无需遍历订单 ID）
  deleteTaskData(taskId) {
    return axiosInstance.get(`nxdepartmentorders/deleteTaskData/${taskId}`);
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

  // 保存订单（批量，使用 pasteSearchGoods，传 orderList + pasteText）
  pasteSearchGoods(data) {
    const body = typeof data === 'object' && data !== null && !Array.isArray(data)
      ? data
      : { orderList: Array.isArray(data) ? data : [], pasteText: '' };
    return axiosInstance.post('ocr/pasteSearchGoods', body, {
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

  // 订单修正接口
  // 接收已解析的 orderItems 和用户修正指令，调用 DeepSeek 进行修正，然后重新查询商品并更新订单
  correctionOrder(data) {
    return axiosInstance.post('ocr/correction', data, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 180000 // 设置超时时间为 3 分钟（180000 毫秒）
    });
  },

  // 获取父级部门的 OCR 任务列表（不区分 type，图片/粘贴等均在右侧按任务类型展示）
  // options.showLoading 控制是否显示全局 loading，默认 false
  depFatherGetTaskList(depFatherId, options = {}) {
    const id = typeof depFatherId === 'object' && depFatherId != null ? depFatherId.depFatherId : depFatherId;
    const { showLoading = false, ...axiosConfig } = options;
    return axiosInstance.get(`ocr/depFatherGetTaskList/${id}`, { showLoading, ...axiosConfig });
  },

  // depId: 部门ID, type: 任务类型（1图片 2Excel 3粘贴）
  depGetTaskList(depId, type, options = {}) {

    const { showLoading = false, ...axiosConfig } = options;
    return axiosInstance.post('ocr/depGetTaskList', null, {
      params: { depId, type },
      ...axiosConfig
    });
  },

  // 获取配送商下未完成订单的任务列表（今日任务客户）
  getDisTaskFatherDepartmentList(disId) {
    return axiosInstance.get(`ocr/disGetTaskDepFatherList/${disId}`, { showLoading: false });
  },

  // 完成任务
  finishTask(taskId) {
    return axiosInstance.get(`ocr/finishTask/${taskId}`, { showLoading: true });
  },


  // 获取任务的订单列表（分页，数据量可能较大，超时 60 秒）
  // options 中 showLoading: false 可关闭本次请求的全局 loading 蒙板（用于静默加载后续页）
  getTaskOrders(taskId, options = {}) {
    const { page = 1, limit = 10, processStatus = true, showLoading, ...axiosConfig } = options;
    const params = new URLSearchParams();
    if (page != null) params.append('page', page);
    if (limit != null) params.append('limit', limit);
    if (processStatus != null) params.append('processStatus', processStatus);
    const query = params.toString() ? '?' + params.toString() : '';
    return axiosInstance.get(`ocr/getTaskOrders/${taskId}${query}`, {
      timeout: 60000,
      showLoading,
      ...axiosConfig
    });
  },

  getBaseURL() {
    return (axiosInstance.defaults && axiosInstance.defaults.baseURL) || '';
  },

  /** 图片等静态资源服务器地址（不带 api/） */
  getImageServerURL() {
    return 'https://grainservice.club:8443/nongxinle/';
  },
  
  // 注意：小程序直接使用腾讯云插件，不通过后端API
  // Vue/Electron环境无法使用插件，如需语音识别需要其他方案
  // 此接口已移除，因为小程序没有这个接口
  
  // 保存部门订单到历史记录
  saveDepartmentOrdersToHistory(params) {
    const formData = new URLSearchParams();
    formData.append('depFatherId', params.depFatherId);
    formData.append('date', params.date);
    
    return axiosInstance.post('/nxdepartmentorders/saveDepartmentOrdersToHistory', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  },
  
  // 其他 API 方法
};

export default apiMethods;
