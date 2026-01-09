import load from '../../../../lib/load';
import {
  pasteSearchGoods,
  choiceGoodsForApply,
  updateOrder,
  deleteOrder,
  addRecord,
} from '../../../../lib/apiDepOrder';

import {
  disSaveStandard,
  queryDisGoodsByQuickSearchWithDepId,
  disDeleteStandard,
  getBrandForPrompts,
} from '../../../../lib/apiDistributer';

import {
  downDisGoods,
  disGetGoods,
} from '../../../../lib/apiibook';

import apiUrl from '../../../../config.js';
var dateUtils = require('../../../../utils/dateUtil');
// 从 config.js 中获取腾讯云配置
const config = require('../../../../config.js');

const globalData = getApp().globalData;

Page({
  data: {
    windowWidth: 0,
    windowHeight: 0,
    statusBarHeight: 0,
    navBarHeight: 0,
    safeAreaBottom: 0, // 安全区域底部高度（rpx）
    scrollViewHeight: 0, // 滚动区域高度（rpx）
    url: '',
    
    // 图片相关
    imageList: [], // 已选择的图片列表
    maxImageCount: 1, // 最多选择1张图片
    
    // OCR 识别相关
    recognizing: false, // 是否正在识别
    recognizeProgress: 0, // 识别进度
    ocrResults: [], // OCR 识别结果 [{imageIndex, text, detections}]
    
    // 订单相关
    orderArr: [], // 解析后的订单列表
    currentStep: 'upload', // upload: 上传, recognizing: 识别中, confirm: 确认, success: 成功
    saveCount: null, // 已保存订单数量，null 表示未保存状态
    inputContent: '', // 输入的文本内容（用于 formatContent）
    
    // 商品搜索相关
    strArr: [], // 配送商商品搜索结果
    nxArr: [], // 系统商品搜索结果
    orderArrIndex: -1, // 当前正在编辑的订单索引
    searchStr: '', // 搜索关键词
    
    // 操作菜单相关
    showOperationPaste: false, // 是否显示操作菜单
    orderPasteIndex: -1, // 当前操作的订单索引
    orderItem: null, // 当前操作的订单项
    findGoods: false, // 从添加临时商品页面返回后，是否需要更新订单
    
    // 用户信息
    userInfo: null,
    depInfo: null,
    depId: null,
    depFatherId: null,
    depName: null,
    disId: null,
    userId: null,
    
    // 缓存相关
    ocrOrderDepList: null, // OCR订单缓存列表（按部门）
    ocrOrderDepIndex: -1, // 当前部门的缓存索引
    hasCache: false, // 是否有当前部门的缓存数据（用于控制清除缓存按钮显示）
    
    // 编辑订单弹窗相关
    show: false, // 是否显示编辑订单弹窗
    editApply: false, // 是否为编辑模式
    applyItem: null, // 当前编辑的订单项
    applyNumber: '', // 编辑的数量
    applyStandardName: '', // 编辑的规格
    applyRemark: '', // 编辑的备注
    itemDis: null, // 配送商商品信息
    item: null, // 部门商品信息
    printStandard: '', // 打印规格
    priceLevel: '', // 价格等级
    applyGoodsName: '', // 商品名称
    applyGoodsId: '', // 商品ID
    newStandardName: '', // 新规格名称
    
    // 警告弹窗相关
    showPopupWarn: false, // 是否显示警告弹窗
    popupType: '', // 弹窗类型
    warnContent: '', // 警告内容
    disStandardId: '', // 规格ID
  },

  onLoad: function(options) {
    const windowWidth = globalData.windowWidth * globalData.rpxR;
    const windowHeight = globalData.windowHeight * globalData.rpxR;
    const statusBarHeight = globalData.statusBarHeight * globalData.rpxR;
    const navBarHeight = globalData.navBarHeight * globalData.rpxR;
    
    // 获取系统信息，用于计算安全区域
    const systemInfo = wx.getSystemInfoSync();
    const safeAreaBottom = systemInfo.safeArea ? (systemInfo.windowHeight - systemInfo.safeArea.bottom) : 0;
    const safeAreaBottomRpx = safeAreaBottom * globalData.rpxR;
    
    console.log('========== ocrOrder onLoad 初始化 ==========');
    console.log('windowWidth (rpx):', windowWidth);
    console.log('windowHeight (rpx):', windowHeight);
    console.log('statusBarHeight (rpx):', statusBarHeight);
    console.log('navBarHeight (rpx):', navBarHeight);
    console.log('safeAreaBottom (px):', safeAreaBottom);
    console.log('safeAreaBottomRpx (rpx):', safeAreaBottomRpx);
    console.log('systemInfo.windowHeight:', systemInfo.windowHeight);
    console.log('systemInfo.safeArea:', systemInfo.safeArea);
    console.log('=============================================');
    
    this.setData({
      windowWidth: windowWidth,
      windowHeight: windowHeight,
      statusBarHeight: statusBarHeight,
      navBarHeight: navBarHeight,
      safeAreaBottom: safeAreaBottomRpx, // 安全区域底部高度（rpx）
      url: apiUrl.server,
    });

    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo');
    const depInfo = wx.getStorageSync('depInfo') || wx.getStorageSync('depItem');
    
    if (userInfo) {
      this.setData({ 
        userInfo,
        disId: userInfo.nxDiuDistributerId,
        userId: userInfo.nxDepartmentUserId || userInfo.nxDepartmentUserId,
      });
    }
    if (depInfo) {
      this.setData({ 
        depInfo,
        depId: depInfo.nxDepartmentId || depInfo.depId,
        depFatherId: depInfo.nxDepartmentFatherId || depInfo.depFatherId,
        depName: depInfo.nxDepartmentName || depInfo.depName || 'OCR识别下单',
      });
    }
    
    // 从 options 获取部门信息（如果从其他页面跳转过来）
    if (options.depId) {
      this.setData({
        depId: options.depId,
        depFatherId: options.depFatherId,
        depName: options.depName || 'OCR识别下单',
      });
    }
    
    // 加载缓存数据
    this._loadCache();
    
    // 计算滚动区域高度
    this._calculateScrollHeight();
    
    // 延迟打印一次滚动高度，确保数据已设置
    setTimeout(() => {
      this._logScrollHeight();
    }, 500);
  },
  
  // 计算滚动高度（不打印日志）
  _calculateScrollHeight: function() {
    const windowHeight = this.data.windowHeight;
    const navBarHeight = this.data.navBarHeight;
    
    // 新的 flex 布局计算：
    // 外层容器（flex: 1）占满 100vh（navbar 是 fixed，不在流中）
    // 外层容器 padding: (navBarHeight + 20)rpx 20rpx 20rpx 20rpx
    // 订单列表容器（flex: 1）占满外层容器的剩余空间
    // 表头高度约 60rpx（flex-shrink: 0）
    // scroll-view 高度 = windowHeight - 外层padding-top - 外层padding-bottom - 表头高度
    const containerPaddingTop = navBarHeight + 20; // 外层padding-top
    const containerPaddingBottom = 20; // 外层padding-bottom
    const headerHeight = 60; // 表头高度（rpx）
    const scrollHeight = windowHeight - containerPaddingTop - containerPaddingBottom - headerHeight;
    
    this.setData({
      scrollViewHeight: Math.max(0, scrollHeight)
    });
  },
  
  // 计算并打印滚动高度的辅助函数
  _logScrollHeight: function() {
    const windowHeight = this.data.windowHeight;
    const navBarHeight = this.data.navBarHeight;
    const saveCount = this.data.saveCount;
    const safeAreaBottom = this.data.safeAreaBottom || 0;
    const bottomOffset = saveCount == null ? 120 : 40;
    const scrollHeight = windowHeight - navBarHeight - bottomOffset - safeAreaBottom;
    
    console.log('========== 滚动高度计算 ==========');
    console.log('windowHeight (rpx):', windowHeight);
    console.log('navBarHeight (rpx):', navBarHeight);
    console.log('saveCount:', saveCount);
    console.log('bottomOffset (rpx):', bottomOffset, saveCount == null ? '(草稿状态)' : '(已保存状态)');
    console.log('safeAreaBottom (rpx):', safeAreaBottom);
    console.log('计算的滚动高度 (rpx):', scrollHeight);
    console.log('计算公式: windowHeight - navBarHeight - bottomOffset - safeAreaBottom');
    console.log('         =', windowHeight, '-', navBarHeight, '-', bottomOffset, '-', safeAreaBottom);
    console.log('         =', scrollHeight);
    console.log('===================================');
  },
  
  onShow: function() {
    // 如果从添加临时商品页面返回，需要更新订单
    if (this.data.findGoods) {
      console.log("========== onShow 检测到 findGoods: true ==========");
      console.log("goodsId:", this.data.goodsId);
      console.log("name:", this.data.name);
      console.log("orderArrIndex:", this.data.orderArrIndex);
      
      // 将 name 转换为 selectedGoodsName，以便 _choiceGoods 使用
      if (this.data.name && !this.data.selectedGoodsName) {
        this.setData({
          selectedGoodsName: this.data.name
        });
      }
      
      // 确保 orderArrIndex 有效
      if (this.data.orderArrIndex < 0) {
        console.error("❌ onShow: orderArrIndex 无效，无法更新订单");
        this.setData({
          findGoods: false
        });
        return;
      }
      
      this._choiceGoods();
    }
  },

  // 选择图片（只允许选择1张）
  chooseImages: function() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'], // 使用压缩图
      sourceType: ['album', 'camera'],
      success: (res) => {
        // 只取第一张图片，替换原有图片
        const newImage = {
          path: res.tempFilePaths[0],
          id: Date.now(),
          status: 'pending' // pending: 待识别, recognizing: 识别中, success: 识别成功, error: 识别失败
        };
        
        this.setData({
          imageList: [newImage]
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 删除图片
  deleteImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const imageList = this.data.imageList;
    imageList.splice(index, 1);
    
    // 同时删除对应的 OCR 结果
    const ocrResults = this.data.ocrResults.filter(item => item.imageIndex !== index);
    
    this.setData({
      imageList,
      ocrResults
    });
  },

  // 预览图片
  previewImage: function(e) {
    const index = e.currentTarget.dataset.index;
    const urls = this.data.imageList.map(item => item.path);
    wx.previewImage({
      current: urls[index],
      urls: urls
    });
  },

  // 开始批量 OCR 识别
  startOCRRecognition: async function() {
    if (this.data.imageList.length === 0) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      });
      return;
    }

    this.setData({
      recognizing: true,
      currentStep: 'recognizing',
      recognizeProgress: 0,
      ocrResults: []
    });

    load.showLoading('正在识别中...');

    try {
      // 批量识别所有图片
      const totalImages = this.data.imageList.length;
      const ocrResults = [];

      for (let i = 0; i < totalImages; i++) {
        const image = this.data.imageList[i];
        
        // 更新图片状态
        const imageList = this.data.imageList;
        imageList[i].status = 'recognizing';
        this.setData({ imageList });

        try {
          // 将图片转换为 Base64
          const base64 = await this.imageToBase64(image.path);
          
          // 调用 OCR API
          const ocrResult = await this.callTencentOCR(base64);
          
          ocrResults.push({
            imageIndex: i,
            text: ocrResult.text,
            detections: ocrResult.detections,
            angle: ocrResult.angle,
            items: ocrResult.items, // DeepSeek 解析后的商品列表
            parsedResult: ocrResult.parsedResult, // 完整解析结果
            savedOrders: ocrResult.savedOrders, // 已保存的订单列表
            isSaved: ocrResult.isSaved // 是否已保存
          });
          
          // 计算并打印滚动高度
          this._logScrollHeight();

          // 更新图片状态为成功
          imageList[i].status = 'success';
          
          // 如果后台已经保存了订单，直接使用已保存的订单数据
          if (ocrResult.isSaved && ocrResult.savedOrders && ocrResult.savedOrders.length > 0) {
            console.log('后台已保存订单，直接使用已保存的数据，订单数量:', ocrResult.savedOrders.length);
            
            // 更新图片状态为成功
            imageList[i].status = 'success';
            
            load.hideLoading();
            console.log('设置订单数据，订单数量:', ocrResult.savedOrders.length);
            console.log('订单数据示例:', ocrResult.savedOrders[0]);
            this.setData({
              recognizing: false,
              currentStep: 'confirm',
              orderArr: ocrResult.savedOrders,
              saveCount: ocrResult.savedOrders.length, // 已保存的订单数量
            }, () => {
              console.log('========== setData 完成检查 ==========');
              console.log('当前 orderArr 长度:', this.data.orderArr.length);
              console.log('当前 saveCount:', this.data.saveCount);
              console.log('当前 currentStep:', this.data.currentStep);
              console.log('windowWidth:', this.data.windowWidth);
              console.log('windowHeight:', this.data.windowHeight);
              console.log('navBarHeight:', this.data.navBarHeight);
              console.log('orderArr 前3项:', this.data.orderArr.slice(0, 3));
              console.log('=====================================');
              this._logScrollHeight();
              // 保存到缓存
              this._saveToStorage(ocrResult.savedOrders);
            });
            
            wx.showToast({
              title: '识别并保存完成',
              icon: 'success'
            });
            
            return; // 立即返回，不再处理后续图片
          }
          
          // 如果返回了解析后的商品列表（JSON 格式），直接解析为订单
          if (ocrResult.items && ocrResult.items.length > 0) {
            // 将后端返回的 items 转换为订单格式
            const formattedOrders = ocrResult.items.map(item => ({
              nxDoGoodsName: item.name || '',
              nxDoGoodsNameOriginal: item.name || '', // 保存原始商品名称
              nxDoQuantity: item.qty || '',
              nxDoStandard: item.unit || '斤', // 默认单位
              nxDoRemark: item.remark || '',
              nxDoAddRemark: !!(item.remark && item.remark.trim()),
              nxDoStatus: -2,
              nxDoDepartmentId: this.data.depId,
              nxDoDepartmentFatherId: this.data.depFatherId,
              nxDoDisGoodsId: null,
              nxDoStandardWarn: 0,
              goodsNameWarn: 0,
              nxDoDistributerId: this.data.disId,
              nxDoPurchaseUserId: -1,
              nxDoOrderUserId: this.data.userId,
              nxDoIsAgent: -1,
            }));
            
            // 过滤掉无效订单（商品名为空）
            const validOrders = formattedOrders.filter(order => 
              order.nxDoGoodsName && order.nxDoGoodsName.trim()
            );
            
            // 更新图片状态为成功
            imageList[i].status = 'success';
            
            load.hideLoading();
            this.setData({
              recognizing: false,
              currentStep: 'confirm',
              orderArr: validOrders,
              saveCount: null, // 新解析的订单都是未保存的草稿
            }, () => {
              this._logScrollHeight();
            });
            // 保存到缓存
            this._saveToStorage(validOrders);
            
            wx.showToast({
              title: '识别完成',
              icon: 'success'
            });
            
            return; // 立即返回，不再处理后续图片
          }
        } catch (error) {
          console.error(`图片 ${i} 识别失败:`, error);
          imageList[i].status = 'error';
          
          // 显示更友好的错误提示
          const errorMsg = error.message || '识别失败';
          
          // 处理服务未开通的错误
          if (errorMsg.includes('OCR_SERVICE_NOT_OPENED') || errorMsg.includes('服务未开通') || errorMsg.includes('UnOpenError')) {
            if (i === 0) {
              wx.showModal({
                title: 'OCR 服务未开通',
                content: '腾讯云 OCR 服务未开通，无法使用识别功能。\n\n解决方案：\n1. 前往腾讯云控制台开通"通用文字识别(高精度版)"服务\n2. 开通地址：https://console.cloud.tencent.com/ocr\n3. 或联系管理员开通服务\n4. 或使用其他下单方式（语音输入、手动输入）',
                showCancel: false,
                confirmText: '知道了'
              });
            }
          } 
          // 处理资源包耗尽的错误
          else if (errorMsg.includes('OCR_RESOURCE_EXHAUSTED') || errorMsg.includes('资源包耗尽')) {
            if (i === 0) {
              wx.showModal({
                title: 'OCR 服务不可用',
                content: '腾讯云 OCR 资源包已耗尽，无法继续识别。\n\n解决方案：\n1. 联系管理员购买腾讯云 OCR 资源包\n2. 或使用其他 OCR 服务\n3. 或手动输入订单信息',
                showCancel: false,
                confirmText: '知道了'
              });
            }
          } else if (errorMsg.includes('接口未实现') || errorMsg.includes('404')) {
            // 如果是接口未实现的错误，只显示一次提示
            if (i === 0) {
              wx.showModal({
                title: '提示',
                content: errorMsg + '\n\n请后端开发人员参考 docs/OCR_API_接口文档.md 实现接口。',
                showCancel: false,
                confirmText: '知道了'
              });
            }
          }
          
          ocrResults.push({
            imageIndex: i,
            text: '',
            detections: [],
            error: errorMsg.replace('OCR_RESOURCE_EXHAUSTED:', '').replace('OCR_SERVICE_NOT_OPENED:', '')
          });
        }

        // 更新进度
        const progress = Math.round(((i + 1) / totalImages) * 100);
        this.setData({
          imageList,
          recognizeProgress: progress,
          ocrResults: [...ocrResults]
        });
      }

      // 如果循环正常结束（没有提前返回），说明没有解析后的商品列表
      // 使用传统的文本解析方式
      this.mergeOCRResults(ocrResults);

      load.hideLoading();
      this.setData({
        recognizing: false,
        currentStep: 'confirm'
      });

      wx.showToast({
        title: '识别完成',
        icon: 'success'
      });

    } catch (error) {
      console.error('OCR 识别过程出错:', error);
      load.hideLoading();
      this.setData({
        recognizing: false
      });
      wx.showToast({
        title: '识别失败，请重试',
        icon: 'none'
      });
    }
  },

  // 将图片转换为 Base64
  imageToBase64: function(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath: filePath,
        encoding: 'base64',
        success: (res) => {
          resolve(res.data);
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  // 调用腾讯云 OCR API
  // 优先尝试调用后端 API，如果后端没有提供，则尝试直接调用腾讯云（需要实现签名）
  callTencentOCR: async function(imageBase64) {
    // 方案1: 优先调用后端 API（推荐）
    return new Promise((resolve, reject) => {
      wx.request({
        url: apiUrl.apiUrl + 'ocr/recognizeOrder', // 后端 OCR 接口
        method: 'POST',
        header: {
          'Content-Type': 'application/json'
        },
        data: {
          ImageBase64: imageBase64,
          // 传递腾讯云配置给后端（如果后端需要）
          SecretId: config.tencentCloud?.secretId || '',
          SecretKey: config.tencentCloud?.secretKey || '',
          Action: 'GeneralAccurateOCR', // OCR 接口名称
          Version: '2018-11-19', // OCR 接口版本
          // 传递部门、配送商、用户信息，用于识别后直接调用 pasteSearchGoods
          depId: this.data.depId,
          disId: this.data.disId,
          depFatherId: this.data.depFatherId,
          userId: this.data.userId
        },
        success: (res) => {
          console.log('OCR API 响应:', res);
          
          // 处理 404 错误（接口不存在）
          if (res.statusCode === 404) {
            reject(new Error('后端 OCR 接口未实现，请联系后端开发人员实现接口。\n接口路径: POST /api/ocr/recognize\n详细文档请查看: docs/OCR_API_接口文档.md'));
            return;
          }
          
          if (res.data && res.data.code === 0) {
            // 检查后端是否已经保存了订单（pasteSearchGoods 已调用）
            // 如果 res.data.data 是数组，说明后台已经保存了订单
            if (Array.isArray(res.data.data) && res.data.data.length > 0) {
              // 后台已经保存了订单，直接返回已保存的订单数据
              resolve({
                text: '',
                detections: [],
                angle: 0,
                savedOrders: res.data.data, // 已保存的订单列表
                isSaved: true // 标记为已保存
              });
              return;
            }
            
            // 检查后端是否返回了 DeepSeek 解析后的商品列表
            // 注意：items 可能在 res.data.items 或 res.data.data.items
            const items = res.data.items || (res.data.data && res.data.data.items);
            const ocrText = res.data.ocrText || (res.data.data && res.data.data.ocrText) || '';
            const parsedResult = res.data.parsedResult || (res.data.data && res.data.data.parsedResult);
            
            if (items && items.length > 0) {
              // 后端已经解析好了，直接返回解析结果
              resolve({
                text: ocrText,
                detections: [],
                angle: 0,
                items: items, // DeepSeek 解析后的商品列表
                parsedResult: parsedResult // 完整解析结果
              });
            } else if (res.data.data && res.data.data.Response) {
              // 使用传统的 OCR 文本识别结果（腾讯云直接返回）
              const response = res.data.data.Response;
              const textDetections = response.TextDetections || [];
              
              // 合并所有文本
              const text = textDetections.map(item => item.DetectedText).join('\n');
              
              resolve({
                text: text,
                detections: textDetections,
                angle: response.Angle || 0
              });
            } else {
              // 其他情况，返回 OCR 文本
              resolve({
                text: ocrText || '',
                detections: [],
                angle: 0
              });
            }
          } else {
            // 如果后端接口返回错误
            const errorMsg = res.data?.msg || res.data?.message || '识别失败';
            
            // 检查不同类型的错误
            if (errorMsg.includes('资源包耗尽') || errorMsg.includes('ResourcePackageRunOut')) {
              reject(new Error('OCR_RESOURCE_EXHAUSTED:' + errorMsg));
            } else if (errorMsg.includes('服务未开通') || errorMsg.includes('UnOpenError') || errorMsg.includes('FailedOperation.UnOpenError')) {
              reject(new Error('OCR_SERVICE_NOT_OPENED:' + errorMsg));
            } else {
              reject(new Error(errorMsg));
            }
          }
        },
        fail: (err) => {
          console.error('OCR API 请求失败:', err);
          
          // 处理网络错误
          if (err.errMsg && err.errMsg.includes('404')) {
            reject(new Error('后端 OCR 接口未实现（404）。\n请后端开发人员实现接口: POST /api/ocr/recognize\n参考文档: docs/OCR_API_接口文档.md'));
          } else {
            reject(new Error('OCR 服务暂时不可用，请稍后重试: ' + (err.errMsg || '网络错误')));
          }
        }
      });
    });
  },

  // 合并 OCR 识别结果并解析为订单
  mergeOCRResults: function(ocrResults) {
    // 合并所有文本
    const allText = ocrResults
      .filter(item => item.text)
      .map(item => item.text)
      .join('\n');

    console.log('合并后的文本:', allText);

    // 使用 paste 页面的 formatContent 方法解析文本
    this.setData({
      inputContent: allText
    });
    
    // 调用 formatContent 解析
    this.formatContent();
  },

  // 格式化内容（复用 paste 页面的逻辑）
  formatContent: function () {
    var content = this.data.inputContent;
    console.log('[formatContent] 开始处理内容:', content);
    
    if (!content || content.trim() === '') {
      console.log('[formatContent] 内容为空，跳过处理');
      return;
    }

    // 清空订单数组
    this.orderArray = [];
    
    // 优先尝试解析 JSON（后端 DeepSeek 返回的格式）
    try {
      // 尝试提取 JSON（可能包含 markdown 代码块标记）
      let jsonStr = content.trim();
      
      // 移除可能的 markdown 代码块标记
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      jsonStr = jsonStr.trim();
      
      // 尝试解析 JSON
      const ordersJson = JSON.parse(jsonStr);
      
      if (Array.isArray(ordersJson) && ordersJson.length > 0) {
        console.log('[formatContent] JSON 解析成功，订单数量:', ordersJson.length);
        
        // 转换为系统需要的格式
        const formattedOrders = ordersJson.map(item => {
          const originalName = item.name || '';
          return {
            nxDoGoodsName: originalName,
            nxDoGoodsNameOriginal: originalName, // 保存原始商品名称
            nxDoQuantity: item.qty || '',
            nxDoStandard: item.unit || '斤', // 默认单位
            nxDoRemark: item.remark || '',
            nxDoAddRemark: !!(item.remark && item.remark.trim()),
            nxDoStatus: -2,
            nxDoDepartmentId: this.data.depId,
            nxDoDepartmentFatherId: this.data.depFatherId,
            nxDoDisGoodsId: null,
            nxDoStandardWarn: 0,
            goodsNameWarn: 0,
            nxDoDistributerId: this.data.disId,
            nxDoPurchaseUserId: -1,
            nxDoOrderUserId: this.data.userId,
            nxDoIsAgent: -1,
          };
        });
        
        // 过滤掉无效订单（商品名为空）
        const validOrders = formattedOrders.filter(order => 
          order.nxDoGoodsName && order.nxDoGoodsName.trim()
        );
        
        console.log('[formatContent] 有效订单数量:', validOrders.length);
        
        // 更新订单数组
        this.setData({ 
          orderArr: validOrders,
          saveCount: null // 新解析的订单都是未保存的草稿
        });
        // 保存到缓存
        this._saveToStorage(validOrders);
        
        return { orders: validOrders, formatted: '' };
      } else {
        console.log('[formatContent] JSON 解析结果不是有效数组，使用正则解析作为兜底');
        throw new Error('JSON 不是有效数组');
      }
    } catch (jsonError) {
      console.log('[formatContent] JSON 解析失败，使用正则解析作为兜底:', jsonError.message);
      
      // JSON 解析失败，使用原来的正则解析作为兜底
      content = content
        .replace(/(\d)\s+/g, '$1') // 处理数字后的空格
        .replace(/[^\S\r\n]+/g, ' '); // 只替换水平空白，保留换行符

      const formatted = this._formatOrderContent(content);

      this.setData({
        formattedContent: formatted
      });

      return formatted;
    }
  },

  // 格式化订单内容（从 paste 页面复制，简化版）
  _formatOrderContent: function (content) {
    console.log('[formatOrderContent] 入参 content:', content);
    let orders = [];
    // 1. 按行拆分
    let lines = content.split(/\r?\n/);
  
    // 过滤无效行
    lines = lines.filter(line => {
      line = line.trim();
      if (!line) return false; // 跳过空行
      if (/^备注[:：]/.test(line)) return true;
  
      let orderRegex = /^\d+[、，\.．]\s*(.+?)[:：]\s*(.+)$/;
      if (orderRegex.test(line)) return true;
  
      let commaRegex = /^(.*?)\s*[\,，]\s*(.+)$/;
      if (commaRegex.test(line)) return true;
  
      let hasNumber = /[\d零一二两三四五六七八九十百千万半]/.test(line);
      return hasNumber;
    });
  
    // 中文数字转阿拉伯数字
    function chineseNumberToArabic(chineseNum) {
      const map = {
        '零': 0, '一': 1, '二': 2, '两': 2, '三': 3,
        '四': 4, '五': 5, '六': 6, '七': 7, '八': 8,
        '九': 9, '十': 10, '百': 100, '千': 1000,
        '万': 10000, '半': 0.5
      };
      let result = 0, temp = 0;
      for (let i = 0; i < chineseNum.length; i++) {
        const char = chineseNum[i];
        if (char === '半') {
          result += 0.5;
        } else if (map[char] >= 10) {
          if (temp === 0) temp = 1;
          result += temp * map[char];
          temp = 0;
        } else if (map[char] !== undefined) {
          temp = temp * 10 + map[char];
        }
      }
      result += temp;
      return result;
    }
  
    // 从尾部解析「名称 + 括号备注 + 数量+单位」
    function parseSegmentEndOfLine(segment) {
      segment = segment.trim().replace(/[,，、。.]+$/g, '');
      
      const bracketRegex = /(?:（|\(|【)(.+?)(?:）|\)|】)/;
      let remarkText = '';
      const bracketMatch = segment.match(bracketRegex);
      if (bracketMatch) {
        remarkText = bracketMatch[1];
        segment = segment.replace(bracketRegex, '').trim();
      }
  
      const hasArabic = /[0-9]/.test(segment);
      let name = segment, qtyVal = '', qtyUnit = '', regex;
  
      if (hasArabic) {
        regex = /^(.*?)([\d\.]+)(\S*)$/;
      } else {
        regex = /^(.*?)([一二两三四五六七八九十百千万半]+)(\S*)$/;
      }
      const m = segment.match(regex);
      if (m) {
        let potentialName = m[1].trim().replace(/\s+/g, '');
        let potentialQty  = m[2].trim();
        let potentialUnit = m[3].trim();
        name = potentialName;
  
        // 数量值
        if (/^[\d\.]+$/.test(potentialQty)) {
          qtyVal = potentialQty;
        } else {
          qtyVal = chineseNumberToArabic(potentialQty).toString();
        }
  
        // 单位列表
        const validUnits = ['斤','个','包','根','棵','条','盒','捆','袋','跟','块','瓶','罐','桶','箱','件'];
        let foundUnit = '';
        for (let u of validUnits) {
          if (potentialUnit.startsWith(u)) {
            foundUnit = u; break;
          }
        }
        if (foundUnit) {
          qtyUnit = foundUnit;
        } else {
          qtyUnit = potentialUnit;
        }
      }
  
      return {
        nxDoGoodsName: name,
        nxDoGoodsNameOriginal: name,
        nxDoQuantity:  qtyVal,
        nxDoStandard:  qtyUnit,
        nxDoRemark:    remarkText,
      };
    }
  
    // 逐行处理
    lines.forEach(line => {
      line = line.trim();
      if (!line) return;
      
      if (/^备注[:：]/.test(line)) {
        if (orders.length) {
          let last = orders[orders.length - 1];
          last.nxDoRemark = (last.nxDoRemark || '') + ' ' + line.replace(/^备注[:：]/, '').trim();
        }
        return;
      }
  
      // 尝试解析
      let parsed = parseSegmentEndOfLine(line);
      if (parsed && parsed.nxDoQuantity) {
        orders.push({
          ...parsed,
          nxDoAddRemark: !!parsed.nxDoRemark,
          nxDoStatus: -2,
          nxDoDepartmentId: this.data.depId,
          nxDoDepartmentFatherId: this.data.depFatherId,
          nxDoDisGoodsId: null,
          nxDoStandardWarn: 0,
          goodsNameWarn: 0,
          nxDoDistributerId: this.data.disId,
          nxDoPurchaseUserId: -1,
          nxDoOrderUserId: this.data.userId,
          nxDoIsAgent: -1,
        });
        return;
      }
    });
  
    // 更新订单数组
    this.setData({ 
      orderArr: orders,
      saveCount: null
    }, () => {
      this._logScrollHeight();
    });
    // 保存到缓存
    this._saveToStorage(orders);
  
    return { orders, formatted: '' };
  },

  // 编辑订单项
  editOrder: function(e) {
    var type = e.currentTarget.dataset.type;
    var index = e.currentTarget.dataset.index;

    if (e.detail.value.length > 0) {
      var data = "orderArr[" + index + "]." + (type === 'name' ? 'nxDoGoodsName' : type === 'quantity' ? 'nxDoQuantity' : type === 'standard' ? 'nxDoStandard' : 'nxDoRemark');
      this.setData({
        [data]: e.detail.value
      })
      
      if (type === 'remark') {
        var remarkData = "orderArr[" + index + "].nxDoAddRemark";
        this.setData({
          [remarkData]: e.detail.value.length > 0
        })
      }
    }
  },
  
  // 编辑商品名称（触发搜索）
  editOrderName: function(e) {
    var index = e.currentTarget.dataset.index;
    console.log("========== editOrderName 开始 ==========");
    console.log("订单索引 index:", index);
    console.log("输入值 e.detail.value:", e.detail.value);
  
    this.setData({
      orderArrIndex: index,
      goodsName: e.detail.value,
    })
    
    if (e.detail.value.length > 0) {
      var newName = e.detail.value;
      var dataName = "orderArr[" + index + "].nxDoGoodsName";
      var dataNameOriginal = "orderArr[" + index + "].nxDoGoodsNameOriginal";
      this.setData({
        [dataName]: newName,
        [dataNameOriginal]: newName, // 同时更新原始商品名称
      })
      console.log("调用 getSearchString 搜索商品...");
      this.getSearchString(e);
    } else {
      console.log("输入为空，不搜索");
      this.setData({
        strArr: [],
        nxArr: [],
        orderArrIndex: -1,
      })
    }
    console.log("========== editOrderName 结束 ==========\n");
  },
  
  // 根据商品名称搜索商品
  getSearchString: function(e) {
    console.log("========== getSearchString 开始 ==========");
    console.log("搜索输入值:", e.detail.value);
    
    if (e.detail.value.length > 0) {
      var data = {
        disId: this.data.disId,
        searchStr: e.detail.value,
        depId: this.data.depId,
      }
      this.setData({
        searchStr: e.detail.value,
      })
      console.log("搜索参数:", data);
      load.showLoading("搜索商品中")
      queryDisGoodsByQuickSearchWithDepId(data).then(res => {
        console.log("搜索结果返回:", res.result.data);
        load.hideLoading();
        if(res.result.code == 0){
            console.log("→ 设置 strArr，长度:", res.result.data.disArr.length);
            this.setData({
              strArr: res.result.data.disArr,
              nxArr: res.result.data.nxArr,
            })
            // 搜索后立即保存到缓存
            this._saveToStorage();
          }else{
            wx.showToast({
              title: res.result.msg,
              icon: 'none'
            })
            this.setData({
              nxArr: [],
              strArr:  []
            })
          }
        })
     
    } 
  },
  
  // 关闭搜索结果
  closeStr: function() {
    this.setData({
      strArr: [],
      nxArr: [],
      orderArrIndex: -1,
    })
  },
  
  // 选择商品
  saveOrder: function(e) {
    this.setData({
      orderArrIndex: e.currentTarget.dataset.index,
      goodsId: e.currentTarget.dataset.id,
      selectedGoodsName: e.currentTarget.dataset.name || '', // 保存选择的商品名称
    })
    this._choiceGoods();
  },
  
  // 保存订单（选择商品后）
  _choiceGoods: function() {
    console.log("========== _choiceGoods 开始 ==========");
    console.log("当前 goodsId:", this.data.goodsId);
    console.log("当前 name:", this.data.name);
    console.log("当前 selectedGoodsName:", this.data.selectedGoodsName);
    console.log("当前 orderArrIndex:", this.data.orderArrIndex);
    
    var index = this.data.orderArrIndex;
    
    if (index === undefined || index === null || index < 0) {
      console.error("❌ orderArrIndex 无效:", index);
      // 清除 findGoods 标记
      this.setData({
        findGoods: false
      });
      return;
    }
    
    if (!this.data.orderArr || index >= this.data.orderArr.length) {
      console.error("❌ orderArr 不存在或索引越界");
      // 清除 findGoods 标记
      this.setData({
        findGoods: false
      });
      return;
    }
    
    // 从 orderArr 中获取订单对象（确保获取最新的完整对象）
    var order = this.data.orderArr[index];
    
    if (!order) {
      console.error("❌ 订单项不存在");
      // 清除 findGoods 标记
      this.setData({
        findGoods: false
      });
      return;
    }
    
    // 检查 goodsId 是否存在
    if (!this.data.goodsId) {
      console.error("❌ goodsId 不存在，无法更新订单");
      // 清除 findGoods 标记
      this.setData({
        findGoods: false
      });
      wx.showToast({
        title: '商品ID不存在',
        icon: 'none'
      });
      return;
    }
    
    // 使用选择的商品名称（支持从添加临时商品页面返回时的 name 字段）
    const selectedGoodsName = this.data.selectedGoodsName || this.data.name || order.nxDoGoodsName || '';
    
    console.log("========== 订单对象详情 ==========");
    console.log("从 orderArr 获取的 order 对象:", JSON.stringify(order, null, 2));
    console.log("order 对象字段列表:", Object.keys(order));
    console.log("order 对象字段数量:", Object.keys(order).length);
    
    // 检查 order 对象是否包含必要字段
    const requiredFields = ['nxDoQuantity', 'nxDoStandard', 'nxDoStatus'];
    const missingFields = requiredFields.filter(field => order[field] === undefined && order[field] === null);
    if (missingFields.length > 0) {
      console.warn("⚠️ 警告：order 对象缺少必要字段:", missingFields);
      console.warn("⚠️ 这可能导致后端接收不到完整的订单信息");
      console.warn("⚠️ 建议检查是否有地方不完整地更新了 order 对象");
    }
    
    console.log("订单关键字段:", {
      nxDoGoodsName: order.nxDoGoodsName,
      nxDoGoodsNameOriginal: order.nxDoGoodsNameOriginal,
      nxDoQuantity: order.nxDoQuantity,
      nxDoStandard: order.nxDoStandard,
      nxDoRemark: order.nxDoRemark,
      nxDoStatus: order.nxDoStatus,
      nxDepartmentOrdersId: order.nxDepartmentOrdersId,
      nxDoDisGoodsId: order.nxDoDisGoodsId,
      nxDoDepartmentId: order.nxDoDepartmentId,
    });
    
    // 确保传递完整的 order 对象，而不仅仅是修改几个字段
    // 注意：使用展开运算符确保保留所有原有字段
    const orderToSend = {
      ...order, // 保留原有的所有字段（包括 nxDoQuantity, nxDoStandard, nxDoRemark 等）
      nxDoGoodsName: selectedGoodsName, // 更新商品名称
      nxDoDisGoodsId: this.data.goodsId, // 更新商品ID
      // 注意：不修改 nxDoGoodsNameOriginal，保持原有值
    };
    
    console.log("========== 准备发送的订单对象 ==========");
    console.log("orderToSend 完整对象:", JSON.stringify(orderToSend, null, 2));
    console.log("orderToSend 字段列表:", Object.keys(orderToSend));
    console.log("orderToSend 关键字段:", {
      nxDoGoodsName: orderToSend.nxDoGoodsName,
      nxDoGoodsNameOriginal: orderToSend.nxDoGoodsNameOriginal,
      nxDoQuantity: orderToSend.nxDoQuantity,
      nxDoStandard: orderToSend.nxDoStandard,
      nxDoRemark: orderToSend.nxDoRemark,
      nxDoStatus: orderToSend.nxDoStatus,
      nxDepartmentOrdersId: orderToSend.nxDepartmentOrdersId,
      nxDoDisGoodsId: orderToSend.nxDoDisGoodsId,
      nxDoDepartmentId: orderToSend.nxDoDepartmentId,
    });
    console.log("=====================================");
    
    console.log("更新订单信息:", {
      index: index,
      goodsId: this.data.goodsId,
      selectedGoodsName: selectedGoodsName,
      orderName: orderToSend.nxDoGoodsName
    });
    
    console.log("准备调用 choiceGoodsForApply 接口");
    console.log("选择的商品名称:", selectedGoodsName);
    load.showLoading("保存订单中")
    choiceGoodsForApply(orderToSend).then(res => {
      if (res.result.code == 0) {
        load.hideLoading();
        console.log("========== choiceGoodsForApply 接口返回 ==========");
        console.log("接口返回 res.result.data:", JSON.stringify(res.result.data, null, 2));
        
        // 获取更新前的原始订单对象，保留所有原有字段
        const currentOrderBeforeUpdate = this.data.orderArr[index];
        console.log("更新前的 order 对象:", JSON.stringify(currentOrderBeforeUpdate, null, 2));
        
        // 合并原有订单对象的所有字段 + 后端返回的字段 + 需要更新的字段
        // 这样可以确保不丢失任何原有字段（如 nxDoQuantity, nxDoStandard, nxDoRemark 等）
        const updatedOrder = {
          ...currentOrderBeforeUpdate, // 先保留原有的所有字段
          ...res.result.data, // 然后用后端返回的字段覆盖/更新
          nxDoGoodsName: selectedGoodsName, // 使用选择的商品名称
          // 注意：nxDoGoodsNameOriginal 保留原有值，不从后端覆盖
          nxDoGoodsNameOriginal: currentOrderBeforeUpdate?.nxDoGoodsNameOriginal || selectedGoodsName
        };
        
        console.log("合并后的 updatedOrder 对象:", JSON.stringify(updatedOrder, null, 2));
        console.log("updatedOrder 字段列表:", Object.keys(updatedOrder));
        console.log("==================================================");
        
        var data = "orderArr[" + index + "]";
        this.setData({
          [data]: updatedOrder,
          strArr: [],
          nxArr: [],
          // 注意：先不重置 orderArrIndex，因为 _updateStorage 需要使用它
        })
        console.log("订单保存成功，已更新 orderArr[" + index + "]");
        // 先更新缓存（需要使用 orderArrIndex）
        this._updateStorage(updatedOrder);
        // 更新缓存后再重置相关状态
        this.setData({
          orderArrIndex: -1,
          findGoods: false, // 清除 findGoods 标记
          name: '', // 清除 name
          selectedGoodsName: '', // 清除 selectedGoodsName
        })
        console.log("已重置 orderArrIndex 为 -1，findGoods 为 false");
      } else {
        load.hideLoading();
        // 清除 findGoods 标记，避免重复尝试
        this.setData({
          findGoods: false,
          name: '',
          selectedGoodsName: '',
        });
        wx.showToast({
          title: res.result ? res.result.msg : '保存失败',
          icon: 'none'
        })
      }
    }).catch(err => {
      console.error("❌ choiceGoodsForApply 接口调用异常:", err);
      load.hideLoading();
      // 清除 findGoods 标记，避免重复尝试
      this.setData({
        findGoods: false,
        name: '',
        selectedGoodsName: '',
      });
      wx.showToast({
        title: '保存订单失败',
        icon: 'none'
      })
    })
    console.log("========== _choiceGoods 结束 ==========\n");
  },
  
  // 下载商品
  downLoadGoodsNx: function(e) {
    var that = this;
    var orderIndex = e.currentTarget.dataset.index;
    var goods = e.currentTarget.dataset.item;
    this.setData({
      selectedGoodsName: goods.nxGoodsName,
    })
    
    var dg = {
      nxDgDistributerId: this.data.disId,
      nxDgNxGoodsId: goods.nxGoodsId,
      nxDgGoodsName: goods.nxGoodsName,
      nxDgGoodsDetail: goods.nxGoodsDetail,
      nxDgGoodsPlace: goods.nxGoodsPlace,
      nxDgGoodsBrand: goods.nxGoodsBrand,
      nxDgGoodsStandardname: goods.nxGoodsStandardname,
      nxDgGoodsStandardWeight: goods.nxGoodsStandardWeight,
      nxDgGoodsPinyin: goods.nxGoodsPinyin,
      nxDgGoodsPy: goods.nxGoodsPy,
      nxDgPullOff: 0,
      nxDgGoodsStatus: 0,
      nxDgPurchaseAuto: 1,
    };

    load.showLoading("保存商品")
    downDisGoods(dg).then(res => {
      if (res.result.code == 0) {
        load.hideLoading();
        that.setData({
          goodsId: res.result.data.nxDistributerGoodsId,
          orderArrIndex: orderIndex
        })
        that._choiceGoods();
      } else {
        load.hideLoading();
        wx.showToast({
          title: res.result.msg,
          icon: 'none'
        })
      }
    }).catch(err => {
      load.hideLoading();
      console.error("下载商品失败:", err);
      wx.showToast({
        title: '下载商品失败',
        icon: 'none'
      })
    })
  },

  // 删除订单项（从操作菜单调用）
  // 删除订单 - 参考 orderPage 的 delApplyPaste
  delOrder: function(e) {
    // 使用 orderPasteIndex（从操作菜单调用）
    var index = this.data.orderPasteIndex;
    
    if (index < 0 || index >= this.data.orderArr.length) {
      console.error("要删除的订单索引无效，index:", index);
      return;
    }
    
    var arr = this.data.orderArr;
    var orderItem = arr[index];
    
    if (!orderItem) {
      console.error("要删除的订单不存在，index:", index);
      return;
    }
    
    console.log("========== delOrder 开始 ==========");
    console.log("订单索引:", index);
    console.log("订单信息:", orderItem);
    
    // 关闭操作菜单
    this.setData({
      showOperationPaste: false
    });
    
    // 如果订单有 nxDepartmentOrdersId，说明已经保存到服务器，需要调用接口删除
    if (orderItem.nxDepartmentOrdersId) {
      console.log("订单已保存到服务器，调用 deleteOrder 接口删除");
      console.log("nxDepartmentOrdersId:", orderItem.nxDepartmentOrdersId);
      
      var id = orderItem.nxDepartmentOrdersId;
      var that = this;
      
      load.showLoading("删除订单中");
      deleteOrder(id).then(res => {
        load.hideLoading();
        if (res.result.code == 0) {
          console.log("接口删除成功");
          var filteredArr = that.data.orderArr.filter((_, idx) => idx !== index);
          console.log("删除后的订单数量:", filteredArr.length);
          
          that.setData({
            orderArr: filteredArr,
            orderArrIndex: -1, // 关闭搜索结果
            strArr: [],
            nxArr: [],
            orderItem: null,
          });
          // 更新缓存
          that._saveToStorage(filteredArr);
          
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        } else {
          console.error("接口删除失败:", res.result.msg);
          wx.showToast({
            title: res.result.msg || '删除失败',
            icon: 'none'
          });
        }
      }).catch(error => {
        load.hideLoading();
        console.error("删除订单接口调用失败:", error);
        wx.showToast({
          title: '删除失败，请检查网络',
          icon: 'none'
        });
      });
      return;
    }
    
    // 如果订单没有 nxDepartmentOrdersId，说明只是草稿，直接从数组中删除
    console.log("订单是草稿，直接从数组中删除");
    arr.splice(index, 1);
    console.log("删除后的订单数量:", arr.length);
    console.log("========== delOrder 结束 ==========");
    this.setData({
      orderArr: arr,
      orderArrIndex: -1, // 关闭搜索结果
      strArr: [],
      nxArr: [],
      orderItem: null,
    });
    // 更新缓存
    this._saveToStorage(arr);
    
    wx.showToast({
      title: '删除成功',
      icon: 'success'
    });
  },
  
  // 删除订单项（支持从其他地方调用，保留兼容）- 调用 delOrder
  deleteOrder: function(e) {
    // 如果是从操作菜单调用，使用 orderPasteIndex
    // 如果是从其他地方调用，使用 dataset.index
    var index = this.data.orderPasteIndex >= 0 ? this.data.orderPasteIndex : (e && e.currentTarget ? e.currentTarget.dataset.index : -1);
    
    // 临时设置 orderPasteIndex，然后调用 delOrder
    this.setData({
      orderPasteIndex: index
    });
    
    // 调用统一的删除函数
    this.delOrder(e);
  },

  // 修改订单（已保存的订单）- 参考 paste.js 的 editApply，先获取配送商品信息
  editOrderItem: function(e) {
    var index = this.data.orderPasteIndex;
    
    if (index < 0 || index >= this.data.orderArr.length) {
      console.error("要修改的订单索引无效，index:", index);
      return;
    }
    
    var arr = this.data.orderArr;
    var orderItem = arr[index];
    
    if (!orderItem) {
      console.error("要修改的订单不存在，index:", index);
      return;
    }
    
    // 检查订单是否已保存
    if (!orderItem.nxDepartmentOrdersId) {
      wx.showToast({
        title: '订单未保存，无法修改',
        icon: 'none'
      });
      this.setData({
        showOperationPaste: false
      });
      return;
    }
    
    console.log("========== editOrderItem 开始 ==========");
    console.log("订单索引:", index);
    console.log("订单信息:", orderItem);
    console.log("订单信息 - nxDoDisGoodsId:", orderItem.nxDoDisGoodsId);
    console.log("订单信息 - nxDoDisGoodsId 类型:", typeof orderItem.nxDoDisGoodsId);
    
    // 关闭操作菜单
    this.setData({
      showOperationPaste: false
    });
    
    // 参考 paste.js 的 editApply，先获取配送商品信息
    var applyItem = orderItem;
    
    // 检查所有可能的商品ID字段（参考 paste.js 的判断方式）
    var goodsId = applyItem.nxDoDisGoodsId;
    console.log('商品ID检查 - nxDoDisGoodsId:', applyItem.nxDoDisGoodsId);
    console.log('商品ID检查 - 最终使用的 goodsId:', goodsId);
    console.log('goodsId 是否为真值:', !!goodsId);
    
    // 根据 nxDoDisGoodsId 先请求接口获取 nxDistributerGoodsEntity（参考 paste.js 的判断方式）
    if (goodsId) {
      console.log('进入获取商品信息分支，goodsId:', goodsId);
      load.showLoading('加载商品信息');
      var that = this;
      console.log('准备调用 disGetGoods，参数:', goodsId);
      disGetGoods(goodsId).then(res => {
        console.log('disGetGoods 返回:', res);
        load.hideLoading();
        if (res.result.code == 0 && res.result.data) {
          // 获取到商品信息后，设置到 itemDis
          console.log("获取到商品信息:", res.result.data);
          that.setData({
            show: true,
            editApply: true,
            applyItem: applyItem,
            applyStandardName: applyItem.nxDoStandard || '',
            printStandard: applyItem.nxDoPrintStandard || applyItem.nxDoStandard || '',
            itemDis: res.result.data, // 使用接口返回的商品信息
            item: applyItem.nxDepartmentDisGoodsEntity || null,
            applyNumber: applyItem.nxDoQuantity || '',
            applyRemark: applyItem.nxDoRemark || '',
            priceLevel: applyItem.nxDoCostPriceLevel || '',
            applyGoodsName: applyItem.nxDoGoodsName || '',
            applyGoodsId: goodsId || '',
          });
        } else {
          // 接口返回失败，使用原有的 nxDistributerGoodsEntity（如果有）
          wx.showToast({
            title: res.result.msg || '获取商品信息失败',
            icon: 'none'
          });
          that.setData({
            show: true,
            editApply: true,
            applyItem: applyItem,
            applyStandardName: applyItem.nxDoStandard || '',
            printStandard: applyItem.nxDoPrintStandard || applyItem.nxDoStandard || '',
            itemDis: applyItem.nxDistributerGoodsEntity || null,
            item: applyItem.nxDepartmentDisGoodsEntity || null,
            applyNumber: applyItem.nxDoQuantity || '',
            applyRemark: applyItem.nxDoRemark || '',
            priceLevel: applyItem.nxDoCostPriceLevel || '',
            applyGoodsName: applyItem.nxDoGoodsName || '',
            applyGoodsId: goodsId || '',
          });
        }
      }).catch(err => {
        load.hideLoading();
        console.error('获取商品信息失败:', err);
        wx.showToast({
          title: '获取商品信息失败',
          icon: 'none'
        });
        // 失败时使用原有的 nxDistributerGoodsEntity（如果有）
        that.setData({
          show: true,
          editApply: true,
          applyItem: applyItem,
          applyStandardName: applyItem.nxDoStandard || '',
          printStandard: applyItem.nxDoPrintStandard || applyItem.nxDoStandard || '',
          itemDis: applyItem.nxDistributerGoodsEntity || null,
          item: applyItem.nxDepartmentDisGoodsEntity || null,
          applyNumber: applyItem.nxDoQuantity || '',
          applyRemark: applyItem.nxDoRemark || '',
          priceLevel: applyItem.nxDoCostPriceLevel || '',
          applyGoodsName: applyItem.nxDoGoodsName || '',
          applyGoodsId: goodsId || '',
        });
      });
    } else {
      // 没有商品ID，直接使用原有的 nxDistributerGoodsEntity
      console.log('没有商品ID，直接使用原有商品信息，goodsId:', goodsId);
      this.setData({
        show: true,
        editApply: true,
        applyItem: applyItem,
        applyStandardName: applyItem.nxDoStandard || '',
        printStandard: applyItem.nxDoPrintStandard || applyItem.nxDoStandard || '',
        itemDis: applyItem.nxDistributerGoodsEntity || null,
        item: applyItem.nxDepartmentDisGoodsEntity || null,
        applyNumber: applyItem.nxDoQuantity || '',
        applyRemark: applyItem.nxDoRemark || '',
        priceLevel: applyItem.nxDoCostPriceLevel || '',
        applyGoodsName: applyItem.nxDoGoodsName || '',
        applyGoodsId: applyItem.nxDoDisGoodsId || '',
      });
    }
    
    console.log("========== editOrderItem 结束 ==========");
  },
  
  // 确认修改订单 - 参考 orderPage 的 confirm 和 _updateDisOrder
  confirm: function(e) {
    if (this.data.editApply) {
      this._updateDisOrder(e);
    }
    
    this.setData({
      show: false,
      editApply: false,
      applyItem: "",
      item: "",
      applyNumber: "",
      applyStandardName: "",
      printStandard: "",
    });
  },
  
  // 取消编辑
  cancle: function() {
    this.setData({
      show: false,
      editApply: false,
      applyItem: "",
      item: "",
      applyNumber: "",
      applyStandardName: "",
      printStandard: "",
    });
  },
  
  // 删除申请（在编辑弹窗中）- 参考 orderPage 的 delApply
  delApply: function() {
    var index = this.data.orderPasteIndex;
    var orderItem = this.data.orderArr[index];
    
    this.setData({
      warnContent: (orderItem.nxDoGoodsName || '') + "  " + (orderItem.nxDoQuantity || '') + (orderItem.nxDoStandard || ''),
      show: false,
      popupType: 'deleteOrder',
      showPopupWarn: true,
    });
  },
  
  // 删除规格 - 参考 orderPage 的 delStandard
  delStandard: function(e) {
    this.setData({
      warnContent: e.detail.standardName,
      show: false,
      popupType: 'deleteSpec',
      showPopupWarn: true,
      disStandardId: e.detail.id,
    });
  },
  
  // 确认规格 - 参考 paste.js 的 confirmStandard
  confirmStandard: function(e) {
    console.log('confirmStandard 事件:', e);
    
    if (!this.data.itemDis || !this.data.itemDis.nxDistributerGoodsId) {
      wx.showToast({
        title: '商品信息错误',
        icon: 'none'
      });
      return;
    }
    
    var data = {
      nxDsDisGoodsId: this.data.itemDis.nxDistributerGoodsId,
      nxDsStandardName: e.detail.newStandardName,
    };
    
    console.log('准备调用 disSaveStandard，参数:', data);
    load.showLoading('保存规格中');
    var that = this;
    
    disSaveStandard(data).then(res => {
      load.hideLoading();
      console.log('disSaveStandard 返回:', res);
      
      if (res.result.code == 0) {
        var standardArr = this.data.itemDis.nxDistributerStandardEntities || [];
        standardArr.push(res.result.data);
        var standards = "itemDis.nxDistributerStandardEntities";
        
        this.setData({
          [standards]: standardArr,
          applyStandardName: res.result.data.nxDsStandardName,
        });
        
        wx.showToast({
          title: '添加规格成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result.msg || '添加规格失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      load.hideLoading();
      console.error('添加规格失败:', err);
      wx.showToast({
        title: '添加规格失败',
        icon: 'none'
      });
    });
  },
  
  // 改变规格 - 参考 orderPage 的 changeStandard
  changeStandard: function(e) {
    this.setData({
      applyStandardName: e.detail.applyStandardName,
      priceLevel: e.detail.level,
    });
    
    if (this.data.itemDis) {
      var levelTwoStandard = this.data.itemDis.nxDgWillPriceTwoStandard;
      if (this.data.applyStandardName == levelTwoStandard) {
        this.setData({
          printStandard: levelTwoStandard
        });
      } else {
        this.setData({
          printStandard: this.data.itemDis.nxDgGoodsStandardname || ''
        });
      }
    }
  },
  
  // 确认警告 - 参考 orderPage 的 confirmWarn
  confirmWarn: function() {
    if (this.data.popupType == 'deleteSpec') {
      this.deleteStandardApi();
    } else if (this.data.popupType == 'deleteOrder') {
      this.delOrder(); // 调用删除订单函数
      this.setData({
        showPopupWarn: false,
        popupType: '',
      });
    }
  },
  
  // 关闭警告弹窗
  closeWarn: function() {
    this.setData({
      showPopupWarn: false,
      popupType: '',
      warnContent: '',
    });
  },
  
  // 删除规格 API - 参考 orderPage 的 deleteStandardApi
  deleteStandardApi: function() {
    if (!this.data.disStandardId) {
      wx.showToast({
        title: '规格ID错误',
        icon: 'none'
      });
      this.setData({
        popupType: "",
        showPopupWarn: false,
        disStandardId: "",
      });
      return;
    }
    
    console.log('准备删除规格，disStandardId:', this.data.disStandardId);
    load.showLoading('删除规格中');
    var that = this;
    
    disDeleteStandard(this.data.disStandardId).then(res => {
      load.hideLoading();
      console.log('disDeleteStandard 返回:', res);
      
      if (res.result.code == 0) {
        // 更新 itemDis 为接口返回的最新数据
        this.setData({
          popupType: "",
          showPopupWarn: false,
          disStandardId: "",
          itemDis: res.result.data,
          item: res.result.data,
        });
        
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result.msg || '删除失败',
          icon: 'none'
        });
        this.setData({
          popupType: "",
          showPopupWarn: false,
          disStandardId: "",
        });
      }
    }).catch(err => {
      load.hideLoading();
      console.error('删除规格失败:', err);
      wx.showToast({
        title: '删除失败，请检查网络',
        icon: 'none'
      });
      this.setData({
        popupType: "",
        showPopupWarn: false,
        disStandardId: "",
      });
    });
  },
  
  // 修改配送申请 - 参考 orderPage 的 _updateDisOrder
  _updateDisOrder: function(e) {
    var index = this.data.orderPasteIndex;
    var orderItem = this.data.orderArr[index];
    
    if (!orderItem || !orderItem.nxDepartmentOrdersId) {
      wx.showToast({
        title: '订单信息错误',
        icon: 'none'
      });
      return;
    }
    
    var dg = {
      id: orderItem.nxDepartmentOrdersId,
      weight: e.detail.applyNumber,
      standard: e.detail.applyStandardName,
      remark: e.detail.applyRemark,
      printStandard: this.data.printStandard,
      priceLevel: this.data.priceLevel
    };
    
    load.showLoading("修改订单中");
    var that = this;
    
    updateOrder(dg).then(res => {
      load.hideLoading();
      if (res.result.code == 0) {
        console.log("修改订单成功");
        console.log("返回的订单数据:", res.result.data);
        
        // 更新本地订单数组
        var updatedOrder = {
          ...orderItem,
          ...res.result.data,
          // 保留原有的商品名称相关字段
          nxDoGoodsName: orderItem.nxDoGoodsName,
          nxDoGoodsNameOriginal: orderItem.nxDoGoodsNameOriginal || orderItem.nxDoGoodsName,
        };
        
        // 更新订单数组
        var updatedArr = [...this.data.orderArr];
        updatedArr[index] = updatedOrder;
        
        that.setData({
          orderArr: updatedArr,
        });
        
        // 更新缓存
        that._saveToStorage(updatedArr);
        
        wx.showToast({
          title: '修改成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result.msg || '修改失败',
          icon: 'none'
        });
      }
    }).catch(error => {
      load.hideLoading();
      console.error("修改订单接口调用失败:", error);
      wx.showToast({
        title: '修改失败，请检查网络',
        icon: 'none'
      });
    });
  },

  // 保存订单（使用 pasteSearchGoods）
  pasteSearchGoods: function() {
    var canSave = this._checkOrderContent();
    if (canSave) {
      load.showLoading("识别商品中");
      pasteSearchGoods(this.data.orderArr).then(res => {
        if (res.result.code == 0) {
          console.log(res.result.data);
          var tempArr = res.result.data;
          
          const originalOrderArr = this.data.orderArr || [];
          
          this.setData({
            saveCount: null,
          })
          var listArr = [];
          if (tempArr.length > 0) {
            var haveId = 0;
            for (var i = 0; i < tempArr.length; i++) {
              var id = tempArr[i].nxDoStatus;
              if (id !== -2) {
                haveId = Number(haveId) + Number(1);
              }
              var item = tempArr[i];
              item.nxDoStandardWarn = 0;
              
              // 保留原有的 nxDoGoodsNameOriginal
              const originalOrder = originalOrderArr[i];
              if (originalOrder && originalOrder.nxDoGoodsNameOriginal) {
                item.nxDoGoodsNameOriginal = originalOrder.nxDoGoodsNameOriginal;
              } else {
                item.nxDoGoodsNameOriginal = originalOrder?.nxDoGoodsName || item.nxDoGoodsName || '';
              }
              
              listArr.push(item);
            }
            this.setData({
              saveCount: haveId,
              orderArr: listArr,
              orderArrIndex: -1, // 关闭所有下拉框
              strArr: [],
              nxArr: [],
            })
            // 保存到缓存
            this._saveToStorage(listArr);
          }
          
          load.hideLoading();
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          
          // 设置刷新标记
          wx.setStorageSync('needRefreshOrderData', true);
          
          // 返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          load.hideLoading();
          wx.showToast({
            title: res.result.msg || '保存失败',
            icon: 'none'
          });
        }
      }).catch(err => {
        load.hideLoading();
        console.error('保存订单失败:', err);
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'none'
        });
      });
    }
  },
  
  // 检查订单内容
  _checkOrderContent: function() {
    var orderArr = this.data.orderArr;
    if (!orderArr || orderArr.length === 0) {
      wx.showToast({
        title: '没有可保存的订单',
        icon: 'none'
      });
      return false;
    }
    
    for (var i = 0; i < orderArr.length; i++) {
      var order = orderArr[i];
      if (!order.nxDoGoodsName || order.nxDoGoodsName.trim() === '') {
        wx.showToast({
          title: `第${i + 1}条订单商品名称为空`,
          icon: 'none'
        });
        return false;
      }
      if (!order.nxDoQuantity || Number(order.nxDoQuantity) <= 0) {
        wx.showToast({
          title: `第${i + 1}条订单数量无效`,
          icon: 'none'
        });
        return false;
      }
      if (!order.nxDoStandard || order.nxDoStandard.trim() === '') {
        wx.showToast({
          title: `第${i + 1}条订单规格为空`,
          icon: 'none'
        });
        return false;
      }
    }
    
    return true;
  },

  // 导入订单（保留兼容，实际调用 pasteSearchGoods）
  importOrders: async function() {
    if (this.data.orderArr.length === 0) {
      wx.showToast({
        title: '没有可导入的订单',
        icon: 'none'
      });
      return;
    }

    load.showLoading('正在导入订单...');

    try {
      const userInfo = this.data.userInfo;
      const depInfo = this.data.depInfo;
      
      if (!userInfo || !depInfo) {
        throw new Error('用户信息不完整');
      }

      // 获取到达日期等信息
      const arriveDate = dateUtils.getArriveDate(0);
      const weekYear = dateUtils.getArriveWeeksYear(0);
      const arriveOnlyDate = dateUtils.getArriveOnlyDate(0);
      const week = dateUtils.getArriveWhatDay(0);

      // 批量保存订单
      const savePromises = this.data.orderArr.map(orderItem => {
        const orderData = {
          nxDoOrderUserId: userInfo.nxDepartmentUserId,
          nxDoDepartmentId: depInfo.nxDepartmentId,
          nxDoDepartmentFatherId: depInfo.nxDepartmentFatherId,
          nxDoQuantity: orderItem.nxDoQuantity,
          nxDoStandard: orderItem.nxDoStandard,
          nxDoRemark: orderItem.nxDoRemark || '',
          nxDoGoodsName: orderItem.nxDoGoodsName,
          nxDoIsAgent: 0,
          nxDoArriveDate: arriveDate,
          nxDoArriveWeeksYear: weekYear,
          nxDoArriveOnlyDate: arriveOnlyDate,
          nxDoArriveWhatDay: week,
          // 其他必要字段根据实际 API 要求添加
        };

        return saveOrder(orderData);
      });

      const results = await Promise.all(savePromises);
      
      // 检查结果
      const successCount = results.filter(res => res.result && res.result.code === 0).length;
      const failCount = results.length - successCount;

      load.hideLoading();

      if (failCount === 0) {
        wx.showToast({
          title: `成功导入${successCount}条订单`,
          icon: 'success'
        });
        
        // 设置刷新标记
        wx.setStorageSync('needRefreshOrderData', true);
        
        // 返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showModal({
          title: '导入结果',
          content: `成功: ${successCount}条，失败: ${failCount}条`,
          showCancel: false
        });
      }

    } catch (error) {
      console.error('导入订单失败:', error);
      load.hideLoading();
      wx.showToast({
        title: '导入失败，请重试',
        icon: 'none'
      });
    }
  },

  // 返回
  toBack: function() {
    this.onUnload();
    wx.navigateBack();
  },

  // 重新开始
  restart: function() {
    this.setData({
      imageList: [],
      ocrResults: [],
      orderArr: [],
      currentStep: 'upload',
      recognizing: false,
      recognizeProgress: 0,
      showOperationPaste: false,
      orderPasteIndex: -1,
      orderItem: null,
      strArr: [],
      nxArr: [],
      orderArrIndex: -1,
      searchStr: '',
      saveCount: null,
    });
    // 如果有缓存，清除当前部门的缓存
    if (this.data.hasCache) {
      var ocrOrderDepList = wx.getStorageSync('ocrOrderDepList');
      if (ocrOrderDepList && Array.isArray(ocrOrderDepList)) {
        var updatedList = ocrOrderDepList.filter(item => item.depId !== this.data.depId);
        if (updatedList.length === 0) {
          wx.removeStorageSync('ocrOrderDepList');
          this.setData({
            ocrOrderDepList: null,
            ocrOrderDepIndex: -1,
            hasCache: false,
          });
        } else {
          wx.setStorageSync('ocrOrderDepList', updatedList);
          this.setData({
            ocrOrderDepList: updatedList,
            ocrOrderDepIndex: -1,
            hasCache: false,
          });
        }
      }
    }
  },
  
  // 显示操作菜单
  showPasteOperation: function(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      orderPasteIndex: index,
      showOperationPaste: true,
      orderItem: this.data.orderArr[index],
    })
  },
  
  // 添加临时商品
  addDisAlias: function(e) {
    console.log("========== addDisAlias 开始 ==========");
    var index = this.data.orderPasteIndex;
    if (index < 0 || index >= this.data.orderArr.length) {
      console.error("订单索引无效，index:", index);
      return;
    }
    
    var order = this.data.orderArr[index];
    if (!order) {
      console.error("订单不存在，index:", index);
      return;
    }
    
    var standard = order.nxDoStandard || '';
    var name = order.nxDoGoodsName || '';
    
    console.log("订单信息:", {
      index: index,
      name: name,
      standard: standard,
      status: order.nxDoStatus
    });
    
    // 先关闭操作菜单
    this.setData({
      showOperationPaste: false,
    });
    
    // 保存当前订单索引
    this.setData({
      orderArrIndex: index,
    });
    
    // 跳转到添加临时商品页面（延迟一下确保菜单关闭动画完成）
    setTimeout(() => {
      wx.navigateTo({
        url: '../../../../subPackage/pages/goods/disAddGoodsLinshi/disAddGoodsLinshi?goodsName=' + name + '&from=paste' + '&standard=' + standard,
      });
    }, 100);
    
    console.log("========== addDisAlias 结束 ==========");
  },
  
  // 隐藏遮罩
  hideMask: function() {
    this.setData({
      showOperationPaste: false
    })
  },
  
  // 添加备注
  addRemark: function() {
    var index = this.data.orderPasteIndex;
    if (index < 0 || index >= this.data.orderArr.length) {
      console.error("添加备注失败，订单索引无效:", index);
      return;
    }
    
    var data = "orderArr[" + index + "].nxDoAddRemark";
    this.setData({
      [data]: true,
      showOperationPaste: false
    })
  },
  
  // 在之前加新订单 - 跳转到 resGoodsList 页面
  addNewPasteOrderBefore: function() {
    // 关闭操作菜单
    this.setData({
      showOperationPaste: false
    });
    
    // 获取当前订单索引，用于在返回时插入新订单
    var index = this.data.orderPasteIndex;
    
    // 保存当前订单索引到 storage，供返回时使用
    wx.setStorageSync('ocrOrderInsertIndex', index);
    // 设置标记，表示从 ocrOrder 跳转过来
    wx.setStorageSync('fromOcrOrder', '1');
    
    // 获取 depSettleType
    var depSettleType = '1'; // 默认值
    if (this.data.depInfo && this.data.depInfo.nxDepartmentSettleType !== undefined) {
      depSettleType = this.data.depInfo.nxDepartmentSettleType;
    }
    
    // 跳转到 resGoodsList 页面，传递 fromOcrOrder 参数
    wx.navigateTo({
      url: '../resGoodsList/resGoodsList?depFatherId=' + (this.data.depFatherId || '') +
        '&depId=' + (this.data.depId || '') + '&depName=' + (this.data.depName || '') +
        '&gbDepFatherId=-1&resFatherId=-1&depSettleType=' + depSettleType +
        '&beforeId=-1&fromOcrOrder=1',
    });
  },
  
  /**
   * 加载缓存数据
   */
  _loadCache: function() {
    console.log("========== _loadCache 加载缓存数据 ==========");
    console.log("当前 depId:", this.data.depId);
    
    var ocrOrderDepList = wx.getStorageSync("ocrOrderDepList");
    console.log("从缓存读取的 ocrOrderDepList:", ocrOrderDepList);
    
    if (ocrOrderDepList && Array.isArray(ocrOrderDepList)) {
      console.log("ocrOrderDepList 长度:", ocrOrderDepList.length);
      this.setData({
        ocrOrderDepList: ocrOrderDepList,
      });
      
      for (var i = 0; i < ocrOrderDepList.length; i++) {
        var pDepId = ocrOrderDepList[i].depId;
        console.log(`ocrOrderDepList[${i}] depId:`, pDepId, "订单数量:", ocrOrderDepList[i].arr ? ocrOrderDepList[i].arr.length : 0);
        if (pDepId == this.data.depId) {
          console.log("找到匹配的 depId，加载订单数据，订单数量:", ocrOrderDepList[i].arr ? ocrOrderDepList[i].arr.length : 0);
          
          // 从缓存恢复订单数据
          let orders = ocrOrderDepList[i].arr || [];
          // 确保每个订单都有原始商品名称字段（兼容旧数据）
          orders = orders.map((order) => {
            if (order && !order.nxDoGoodsNameOriginal) {
              return {
                ...order,
                nxDoGoodsNameOriginal: order.nxDoGoodsName || ''
              };
            }
            return order;
          });
          
          // 如果有缓存数据，直接使用缓存中的 saveCount（如果有的话）
          const saveCount = ocrOrderDepList[i].saveCount !== undefined ? ocrOrderDepList[i].saveCount : null;
          
          // 恢复搜索相关数据
          const searchData = ocrOrderDepList[i];
          // 检查是否有缓存数据（订单数组不为空）
          const hasCacheData = orders && orders.length > 0;
          const newCurrentStep = orders.length > 0 ? 'confirm' : 'upload';
          this.setData({
            ocrOrderDepIndex: i,
            orderArr: orders,
            saveCount: saveCount,
            currentStep: newCurrentStep, // 有订单时进入确认页面
            // 恢复搜索相关数据
            strArr: searchData.strArr || [],
            nxArr: searchData.nxArr || [],
            orderArrIndex: searchData.orderArrIndex !== undefined ? searchData.orderArrIndex : -1,
            searchStr: searchData.searchStr || "",
            hasCache: hasCacheData // 设置是否有缓存
          }, () => {
            // setData 完成后的回调
            console.log("已设置 orderArr，长度:", orders.length);
            console.log("设置的 currentStep:", newCurrentStep);
            console.log("实际 currentStep:", this.data.currentStep);
            console.log("orderArr 实际值:", this.data.orderArr);
          });
          return; // 找到匹配的缓存，退出循环
        }
      }
      
      // 如果没有找到匹配的 depId，设置 hasCache 为 false
      if (!this.data.hasCache) {
        this.setData({
          hasCache: false
        });
      }
    } else {
      console.log("缓存中没有 ocrOrderDepList");
      this.setData({
        saveCount: null,
        ocrOrderDepList: null,
        ocrOrderDepIndex: -1,
        hasCache: false, // 没有缓存数据
      });
    }
    console.log("========== _loadCache 加载缓存数据结束 ==========");
  },
  
  /**
   * 统一的缓存同步函数 - 立即将订单数组同步到 Storage
   * 防止小程序异常退出时数据丢失
   * @param {Array} orders - 订单数组，如果不传则使用 this.data.orderArr
   */
  _saveToStorage: function(orders) {
    const orderArr = orders || this.data.orderArr;
    
    // 如果没有订单数据，跳过
    if (!orderArr || orderArr.length === 0) {
      console.log('[saveToStorage] 订单数组为空，跳过缓存同步');
      return;
    }
    
    // 如果没有 ocrOrderDepList，初始化
    if (!this.data.ocrOrderDepList || !Array.isArray(this.data.ocrOrderDepList)) {
      console.log('[saveToStorage] ocrOrderDepList 不存在，初始化缓存');
      this.setData({
        ocrOrderDepList: []
      });
    }
    
    // 如果没有 ocrOrderDepIndex 或小于 0，说明还没有保存过，需要初始化
    if (this.data.ocrOrderDepIndex === undefined || this.data.ocrOrderDepIndex === null || this.data.ocrOrderDepIndex < 0) {
      console.log('[saveToStorage] 首次保存，初始化缓存数据');
      
      // 查找是否已经存在当前部门的缓存
      let existingIndex = -1;
      for (let i = 0; i < this.data.ocrOrderDepList.length; i++) {
        if (this.data.ocrOrderDepList[i].depId === this.data.depId) {
          existingIndex = i;
          break;
        }
      }
      
      if (existingIndex >= 0) {
        // 已存在，使用现有索引
        this.setData({
          ocrOrderDepIndex: existingIndex
        });
      } else {
        // 不存在，创建新的缓存项
        const newDepData = {
          depId: this.data.depId,
          depFatherId: this.data.depFatherId,
          depName: this.data.depName,
          arr: [],
          saveCount: null,
          strArr: [],
          nxArr: [],
          orderArrIndex: -1,
          searchStr: ""
        };
        this.data.ocrOrderDepList.push(newDepData);
        this.setData({
          ocrOrderDepIndex: this.data.ocrOrderDepList.length - 1,
          ocrOrderDepList: this.data.ocrOrderDepList
        });
      }
    }
    
    try {
      // 更新内存中的数据
      this.data.ocrOrderDepList[this.data.ocrOrderDepIndex].depId = this.data.depId; // 确保 depId 正确
      this.data.ocrOrderDepList[this.data.ocrOrderDepIndex].depFatherId = this.data.depFatherId;
      this.data.ocrOrderDepList[this.data.ocrOrderDepIndex].depName = this.data.depName;
      this.data.ocrOrderDepList[this.data.ocrOrderDepIndex].arr = orderArr;
      // 同时保存搜索相关数据
      this.data.ocrOrderDepList[this.data.ocrOrderDepIndex].strArr = this.data.strArr || [];
      this.data.ocrOrderDepList[this.data.ocrOrderDepIndex].nxArr = this.data.nxArr || [];
      this.data.ocrOrderDepList[this.data.ocrOrderDepIndex].orderArrIndex = this.data.orderArrIndex !== undefined ? this.data.orderArrIndex : -1;
      this.data.ocrOrderDepList[this.data.ocrOrderDepIndex].searchStr = this.data.searchStr || "";
      this.data.ocrOrderDepList[this.data.ocrOrderDepIndex].saveCount = this.data.saveCount !== undefined ? this.data.saveCount : null;
      
      // 立即同步到 Storage
      wx.setStorageSync('ocrOrderDepList', this.data.ocrOrderDepList);
      console.log('[saveToStorage] 已同步到缓存，订单数量:', orderArr.length);
      
      // 更新 hasCache 状态（有订单数据就有缓存）
      if (orderArr.length > 0) {
        this.setData({
          hasCache: true
        });
      }
    } catch (error) {
      console.error('[saveToStorage] 缓存同步失败:', error);
      if (error.message && error.message.includes('exceed storage item max length')) {
        console.warn('[saveToStorage] 数据过大，缓存保存失败，但内存数据已更新');
      }
    }
  },
  
  /**
   * 更新单个订单到缓存
   * @param {Object} order - 更新的订单对象
   */
  _updateStorage: function(order) {
    console.log("========== _updateStorage 开始 ==========");
    console.log("orderArrIndex:", this.data.orderArrIndex);
    console.log("ocrOrderDepIndex:", this.data.ocrOrderDepIndex);
    console.log("order:", order);
    
    // 检查 orderArrIndex 是否有效
    if (this.data.orderArrIndex === undefined || this.data.orderArrIndex === null || this.data.orderArrIndex < 0) {
      console.error("❌ orderArrIndex 无效，无法更新存储:", this.data.orderArrIndex);
      return;
    }
    
    // 更新内存中的 orderArr（无论 ocrOrderDepIndex 是否有效，都要更新当前订单数组）
    // 使用合并方式，确保不丢失原有字段
    const currentOrder = this.data.orderArr[this.data.orderArrIndex];
    const mergedOrder = {
      ...currentOrder, // 先保留原有的所有字段
      ...order, // 然后用新字段覆盖
    };
    
    this.data.orderArr[this.data.orderArrIndex] = mergedOrder;
    var data = "orderArr[" + this.data.orderArrIndex + "]";
    this.setData({
      [data]: mergedOrder,
    });
    console.log(`[_updateStorage] 已更新内存中的 orderArr[${this.data.orderArrIndex}]`);
    console.log(`[_updateStorage] 合并后的订单对象字段数: ${Object.keys(mergedOrder).length}`);
    
    // 检查 ocrOrderDepIndex 是否有效
    if (this.data.ocrOrderDepIndex === undefined || this.data.ocrOrderDepIndex === null || this.data.ocrOrderDepIndex < 0) {
      console.warn("⚠️ ocrOrderDepIndex 无效，跳过缓存更新（订单尚未保存到部门列表）:", this.data.ocrOrderDepIndex);
      // 即使 ocrOrderDepIndex 无效，也更新未保存订单状态
      this._updateHasUnsavedOrders();
      console.log("========== _updateStorage 结束（仅更新内存，未更新缓存）==========\n");
      return;
    }
    
    // ocrOrderDepIndex 有效时，更新 ocrOrderDepList 和缓存
    var depData = "ocrOrderDepList[" + this.data.ocrOrderDepIndex + "].arr[" + this.data.orderArrIndex + "]";
    
    console.log("更新路径 data:", data);
    console.log("更新路径 depData:", depData);
    
    // 检查 ocrOrderDepList 是否存在且有效
    if (this.data.ocrOrderDepList && Array.isArray(this.data.ocrOrderDepList) && this.data.ocrOrderDepList[this.data.ocrOrderDepIndex]) {
      // 更新 ocrOrderDepList 中的数据（使用合并后的订单对象）
      this.data.ocrOrderDepList[this.data.ocrOrderDepIndex].arr[this.data.orderArrIndex] = mergedOrder;
      console.log(`[_updateStorage] 已更新缓存中的订单 ${this.data.orderArrIndex}`);
    
      // 使用 setData 更新视图中的 ocrOrderDepList
      this.setData({
        [depData]: mergedOrder,
      });
    
      // 保存到缓存
      try {
        wx.setStorageSync('ocrOrderDepList', this.data.ocrOrderDepList);
        console.log("已保存到缓存");
      } catch (error) {
        console.error('[更新订单] 缓存同步失败:', error);
        if (error.message && error.message.includes('exceed storage item max length')) {
          console.warn('[更新订单] 数据过大，缓存保存失败，但内存数据已更新');
        }
      }
    } else {
      console.warn("⚠️ ocrOrderDepList 不存在或无效，跳过缓存更新");
    }
    
    // 更新未保存订单状态（单个订单更新后，需要重新检查整个数组）
    this._updateHasUnsavedOrders();
    
    console.log("存储更新成功");
    console.log("========== _updateStorage 结束 ==========\n");
  },
  
  /**
   * 更新 hasUnsavedOrders 状态
   * 检查订单数组中是否有未保存的订单（status == -2）
   * @param {Array} orders - 订单数组，如果不传则使用 this.data.orderArr
   */
  _updateHasUnsavedOrders: function(orders) {
    const orderArr = orders || this.data.orderArr || [];
    const hasUnsavedOrders = orderArr.some(order => order && order.nxDoStatus === -2);
    // 注意：ocrOrder 不需要 hasUnsavedOrders 字段（因为 UI 中没有显示），这里只做检查
    return hasUnsavedOrders;
  },
  
  /**
   * 清除缓存（除缓存）
   */
  clearSave: function() {
    console.log("========== clearSave 开始 ==========");
    console.log("当前 depId:", this.data.depId);
    console.log("当前 orderArr 长度:", this.data.orderArr.length);
    
    // 1. 从缓存中找到这个部门的所有订单
    var ocrOrderDepList = wx.getStorageSync('ocrOrderDepList');
    console.log("从缓存读取的 ocrOrderDepList:", ocrOrderDepList);
    
    if (!ocrOrderDepList || !Array.isArray(ocrOrderDepList)) {
      console.log("缓存中没有 ocrOrderDepList 或格式错误");
      console.log("========== clearSave 结束 ==========");
      return;
    }
    
    // 2. 找到当前部门的所有缓存订单
    var currentDepData = null;
    for (var i = 0; i < ocrOrderDepList.length; i++) {
      if (ocrOrderDepList[i].depId === this.data.depId) {
        currentDepData = ocrOrderDepList[i];
        console.log("找到当前部门的缓存数据，索引:", i);
        break;
      }
    }
    
    if (!currentDepData || !currentDepData.arr || !Array.isArray(currentDepData.arr)) {
      console.log("当前部门没有缓存订单数据");
      console.log("========== clearSave 结束 ==========");
      return;
    }
    
    // 3. 从当前 orderArr 中删除所有状态为 -2 的订单
    var originalOrderArr = this.data.orderArr || [];
    console.log("删除前的 orderArr 长度:", originalOrderArr.length);
    console.log("删除前的 orderArr:", originalOrderArr);
    
    var filteredOrderArr = [];
    var deletedOrders = [];
    var ordersToDeleteFromServer = []; // 需要调用接口删除的订单
    
    for (var k = 0; k < originalOrderArr.length; k++) {
      var currentOrder = originalOrderArr[k];
      
      // 直接判断状态是否为 -2，不需要判断 orderId
      if (currentOrder.nxDoStatus === -2) {
        deletedOrders.push({
          index: k,
          nxDepartmentOrdersId: currentOrder.nxDepartmentOrdersId,
          goodsName: currentOrder.nxDoGoodsName
        });
        // 如果订单有 nxDepartmentOrdersId，需要调用接口删除
        if (currentOrder.nxDepartmentOrdersId) {
          ordersToDeleteFromServer.push({
            index: k,
            nxDepartmentOrdersId: currentOrder.nxDepartmentOrdersId,
            goodsName: currentOrder.nxDoGoodsName
          });
        }
        console.log(`删除订单 ${k} (状态为 -2):`, {
          nxDepartmentOrdersId: currentOrder.nxDepartmentOrdersId,
          goodsName: currentOrder.nxDoGoodsName,
          status: currentOrder.nxDoStatus
        });
      } else {
        filteredOrderArr.push(currentOrder);
      }
    }
    
    console.log("状态为 -2 的订单数量:", deletedOrders.length);
    console.log("需要调用接口删除的订单数量:", ordersToDeleteFromServer.length);
    
    // 5. 调用接口删除服务器上的订单
    if (ordersToDeleteFromServer.length > 0) {
      console.log("需要调用接口删除的订单数量:", ordersToDeleteFromServer.length);
      console.log("需要删除的订单列表:", ordersToDeleteFromServer);
      
      load.showLoading("删除订单中");
      var that = this;
      var deletePromises = ordersToDeleteFromServer.map(order => {
        console.log("调用 deleteOrder 接口，删除订单:", order.nxDepartmentOrdersId);
        return deleteOrder(order.nxDepartmentOrdersId);
      });
      
      Promise.all(deletePromises).then(results => {
        load.hideLoading();
        var allSuccess = true;
        var failedOrders = [];
        
        results.forEach((res, idx) => {
          if (res.result.code == 0) {
            console.log(`订单 ${ordersToDeleteFromServer[idx].nxDepartmentOrdersId} 删除成功`);
          } else {
            allSuccess = false;
            failedOrders.push(ordersToDeleteFromServer[idx]);
            console.error(`订单 ${ordersToDeleteFromServer[idx].nxDepartmentOrdersId} 删除失败:`, res.result.msg);
          }
        });
        
        if (allSuccess) {
          console.log("所有订单删除成功");
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        } else {
          console.error("部分订单删除失败:", failedOrders);
          wx.showToast({
            title: `删除失败 ${failedOrders.length} 个订单`,
            icon: 'none'
          });
        }
        
        // 无论接口是否成功，都从 orderArr 中删除（因为缓存中已经标记为 -2）
        that._finishClearSave(filteredOrderArr, deletedOrders);
      }).catch(error => {
        load.hideLoading();
        console.error("删除订单接口调用失败:", error);
        wx.showToast({
          title: '删除失败，请检查网络',
          icon: 'none'
        });
        // 即使接口失败，也从 orderArr 中删除
        that._finishClearSave(filteredOrderArr, deletedOrders);
      });
    } else {
      // 如果没有需要调用接口删除的订单，直接更新 orderArr
      this._finishClearSave(filteredOrderArr, deletedOrders);
    }
  },
  
  /**
   * 完成 clearSave 的后续操作
   * @param {Array} filteredOrderArr - 过滤后的订单数组
   * @param {Array} deletedOrders - 已删除的订单列表
   */
  _finishClearSave: function(filteredOrderArr, deletedOrders) {
    console.log("删除的订单数量:", deletedOrders.length);
    console.log("删除的订单详情:", deletedOrders);
    console.log("删除后的 orderArr 长度:", filteredOrderArr.length);
    console.log("删除后的 orderArr:", filteredOrderArr);
    
    // 更新状态
    const newSaveCount = filteredOrderArr.length > 0 ? this.data.saveCount : null;
    
    const updateData = {
      orderArr: filteredOrderArr,
      saveCount: newSaveCount,
    };
    
    console.log("准备更新 saveCount:", newSaveCount);
    
    // 如果删除后没有订单了，回到上传页面
    if (filteredOrderArr.length === 0) {
      updateData.currentStep = 'upload';
    }
    
    this.setData(updateData);
    
    // 如果删除后没有订单了，清理这个部门的缓存数据
    if (filteredOrderArr.length === 0) {
      console.log("删除后没有订单了，清理当前部门的缓存数据");
      
      // 从缓存中读取最新的 ocrOrderDepList
      var ocrOrderDepList = wx.getStorageSync('ocrOrderDepList');
      // 从 ocrOrderDepList 中删除当前部门的数据
      var updatedOcrOrderDepList = ocrOrderDepList ? ocrOrderDepList.filter(item => item.depId !== this.data.depId) : [];
      
      if (updatedOcrOrderDepList.length === 0) {
        // 如果整个 ocrOrderDepList 都空了，删除整个缓存
        console.log("ocrOrderDepList 为空，删除整个缓存");
        wx.removeStorageSync('ocrOrderDepList');
      } else {
        // 保存更新后的 ocrOrderDepList
        console.log("保存更新后的 ocrOrderDepList，剩余部门数量:", updatedOcrOrderDepList.length);
        try {
          wx.setStorageSync('ocrOrderDepList', updatedOcrOrderDepList);
        } catch (error) {
          console.error('[删除订单] 缓存同步失败:', error);
          if (error.message && error.message.includes('exceed storage item max length')) {
            console.warn('[删除订单] 数据过大，缓存保存失败，但内存数据已更新');
          }
        }
      }
      
      // 重置相关状态
      this.setData({
        orderArr: [], // 确保 orderArr 被清空
        ocrOrderDepList: updatedOcrOrderDepList.length > 0 ? updatedOcrOrderDepList : null,
        ocrOrderDepIndex: -1,
        saveCount: null, // 重置保存计数
        strArr: [], // 清空搜索结果
        nxArr: [], // 清空下载商品
        orderArrIndex: -1, // 重置订单索引
        searchStr: "", // 清空搜索关键词
        hasCache: false, // 清除缓存后，hasCache 设置为 false
      });
    } else {
      // 如果还有订单，更新缓存
      this._saveToStorage(filteredOrderArr);
    }
    
    console.log("已更新 orderArr，新长度:", filteredOrderArr.length);
    console.log("已更新 saveCount:", newSaveCount);
    console.log("========== clearSave 结束 ==========");
  },
  
  /**
   * 页面卸载时的处理
   */
  onUnload: function() {
    console.log("========== onUnload 开始 ==========");
    
    // 从缓存中读取最新的数据
    var ocrOrderDepList = wx.getStorageSync("ocrOrderDepList");
    console.log("从缓存读取的 ocrOrderDepList:", ocrOrderDepList);
    
    if (!ocrOrderDepList || ocrOrderDepList.length === 0) {
      console.log("缓存中没有 ocrOrderDepList，无需处理");
      console.log("========== onUnload 结束 ==========");
      return;
    }
    
    // 找到当前 depId 对应的数据
    var currentDepData = null;
    for (var i = 0; i < ocrOrderDepList.length; i++) {
      if (ocrOrderDepList[i].depId == this.data.depId) {
        currentDepData = ocrOrderDepList[i];
        break;
      }
    }
    
    if (!currentDepData || !currentDepData.arr || currentDepData.arr.length === 0) {
      console.log("缓存中没有找到当前 depId 的数据或订单列表为空");
      console.log("========== onUnload 结束 ==========");
      return;
    }
    
    console.log("找到当前 depId 的数据，订单数量:", currentDepData.arr.length);
    
    // 检查是否有 status == -2 的订单（草稿订单）
    var hasDraftOrders = false;
    for (var i = 0; i < currentDepData.arr.length; i++) {
      if (currentDepData.arr[i].nxDoStatus == -2) {
        hasDraftOrders = true;
        break;
      }
    }
    
    // 如果所有订单都是 status == 0（已保存），则删除该部门的缓存
    if (!hasDraftOrders) {
      console.log("所有订单都是 status == 0，删除该部门的缓存");
      
      var arr = ocrOrderDepList.filter(item => item.depId != this.data.depId);
      
      if (arr.length == 0) {
        wx.removeStorageSync('ocrOrderDepList');
        console.log("已删除整个 ocrOrderDepList 缓存");
      } else {
        try {
          
          wx.setStorageSync('ocrOrderDepList', arr);
          console.log("已删除该部门的缓存，剩余部门数:", arr.length);
        } catch (error) {
          console.error('[删除已保存订单] 缓存同步失败:', error);
        }
      }
    } else {
      console.log("存在 status == -2 的订单，保留缓存");
    }
    
    console.log("========== onUnload 结束 ==========");
  }
});

