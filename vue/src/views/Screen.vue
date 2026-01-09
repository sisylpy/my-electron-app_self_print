<template>
  <div class="screen" @click="handleScreenClick">
    <!-- 轮播图 -->
    <div class="carousel-container">
      <img :src="currentAd" alt="广告" class="carousel-image" />
    </div>

      <!-- 点击计数器显示 -->
      <!-- <div class="click-counter" style="position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 5px; font-size: 12px; z-index: 100;">
        <div>🖱️ 点击测试</div>
        <div>当前点击: {{ clickCount }}/4</div>
        <div>事件类型: {{ lastEventType || '无' }}</div>
      </div> -->

      <!-- 底部部分 -->
      <div class="footer">
        <!-- 左侧标题 -->
        <div class="left-title">
          <h1>京采接单订单工具</h1>
          <div v-if="marketName" class="market-name-below">{{ marketName }}</div>
        </div>
  
        <!-- 右侧按钮 -->
        <div class="right-btn d-flex gap-3">
          <!-- <button @click="openDeviceSettings" class="settings-btn">设置</button> -->
          <button @click="goHome" class="print-btn">打印配送单</button>
        </div>
      </div>
    </div>

    <!-- 设备管理员登录弹窗 -->
    <div v-if="showDeviceAdminModal" class="modal-overlay" @click="closeDeviceAdminModal">
      <div class="modal-content" @click.stop>
        <!-- 登录界面 -->
        <div v-if="deviceAdminStep === 'login'" class="device-admin-login">
          <h3>🔧 设备管理员登录</h3>
          <div class="form-group">
            <label>手机号：</label>
            <input 
              v-model="deviceAdminPhone" 
              type="tel" 
              placeholder="请输入11位手机号"
              maxlength="11"
              @input="validatePhone"
              class="phone-input"
            />
            <div v-if="phoneError" class="error-message">{{ phoneError }}</div>
          </div>
          <div class="button-group">
            <button @click="deviceAdminLogin" :disabled="!isPhoneValid || loginLoading" class="login-btn">
              {{ loginLoading ? '登录中...' : '登录' }}
            </button>
            <button @click="closeDeviceAdminModal" class="cancel-btn">取消</button>
          </div>
        </div>

        <!-- 设备选择界面 -->
        <div v-if="deviceAdminStep === 'selectDevice'" class="device-selection">
          <h3>📱 选择打印机设备</h3>
          <div class="market-info">
            <p><strong>市场：</strong>{{ deviceAdminInfo.marketName }}</p>
            <p><strong>管理员：</strong>{{ deviceAdminInfo.managerName }}</p>
          </div>
          
          <div class="device-list" v-if="deviceList.length > 0">
            <div 
              v-for="device in deviceList" 
              :key="device.nxPdId"
              :class="['device-item', { 'selected': selectedDeviceId === device.nxPdId }]"
              @click="selectDevice(device)"
            >
              <div class="device-name">{{ device.nxPdDeviceName }}</div>
              <div class="device-info">
                <span>编号：{{ device.nxPdDeviceNo }}</span>
                <span>位置：{{ device.nxPdLocation }}</span>
              </div>
              <div class="device-status">
                <span :class="['status-badge', getStatusClass(device.nxPdStatus)]">
                  {{ getStatusText(device.nxPdStatus) }}
                </span>
                <span class="paper-count">{{ device.nxPdPaperCount }}/{{ device.nxPdPaperMax }}张</span>
              </div>
            </div>
          </div>
          
          <div v-if="deviceList.length === 0" class="no-devices">
            该市场暂无可用设备
          </div>
          
          <div class="button-group">
            <button 
              @click="confirmDeviceSelection" 
              :disabled="!selectedDeviceId"
              class="confirm-btn"
            >
              确认选择
            </button>
            <button @click="closeDeviceAdminModal" class="cancel-btn">取消</button>
          </div>
        </div>

        <!-- 配置完成界面 -->
        <div v-if="deviceAdminStep === 'completed'" class="device-completed">
          <h3>✅ 配置完成</h3>
          <div class="config-info">
            <p><strong>市场：</strong>{{ deviceAdminInfo.marketName }}</p>
            <p><strong>管理员：</strong>{{ deviceAdminInfo.managerName }}</p>
            <p><strong>设备：</strong>{{ selectedDeviceInfo.nxPdDeviceName }}</p>
            <p><strong>位置：</strong>{{ selectedDeviceInfo.nxPdLocation }}</p>
          </div>
          <div class="button-group">
            <button @click="closeDeviceAdminModal" class="confirm-btn">完成</button>
          </div>
        </div>
      </div>
    </div>
  </template>
  
  <script>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router'; // 导入 useRouter
import deviceAdminApi from '../api/deviceAdmin.js';

  // 使用 import 来引入图片
  import ad1 from '../assets/ad/ad1.png'
  import ad2 from '@/assets/ad/ad2.png';
  import ad3 from '@/assets/ad/ad3.png';
  import ad4 from '@/assets/ad/ad4.png';
  import ad5 from '@/assets/ad/ad5.png';
  
  export default {
    name: 'Screen',
    setup() {
        // 获取路由对象
    const router = useRouter();

      // 广告图片数组
      const ads = [ad1, ad2, ad3, ad4, ad5];
  
      const currentAd = ref(ads[0]); // 当前展示的广告
      let adIndex = 0;  // 当前广告索引
      let adInterval = null;  // 定时器
      
      // 设备管理员设置相关
      const showDeviceAdminModal = ref(false);
      const deviceAdminStep = ref('login');
      const deviceAdminPhone = ref('');
      const phoneError = ref('');
      const loginLoading = ref(false);
      const deviceAdminInfo = ref({});
      const deviceList = ref([]);
      const selectedDeviceId = ref(null);
      const selectedDeviceInfo = ref({});
      
      // 点击检测相关
      const clickCount = ref(0);
      const clickTimer = ref(null);
      const isProcessingClick = ref(false);
      const lastEventType = ref('');
  
      // 启动广告轮播
      const startAdRotation = () => {
        adInterval = setInterval(() => {
          adIndex = (adIndex + 1) % ads.length;  // 切换广告
          currentAd.value = ads[adIndex];
        }, 3000); // 每3秒切换一次广告
      };
  
      // 停止广告轮播
      const stopAdRotation = () => {
        clearInterval(adInterval);
      };
  
       // 点击按钮跳转到 Home 页面
    const goHome = () => {
      router.push({ name: 'Home' }); // 使用 router.push() 跳转
    };
    
    // 处理屏幕点击事件
    const handleScreenClick = (event) => {
      // 防止事件重复触发
      if (isProcessingClick.value) {
        return;
      }
      
      isProcessingClick.value = true;
      setTimeout(() => {
        isProcessingClick.value = false;
      }, 100);
      
      // 记录事件类型
      lastEventType.value = event.type;
      
      // 添加更详细的日志
      console.log('🖱️ 屏幕点击事件触发！');
      console.log('📱 事件类型:', event.type);
      console.log('📍 点击位置:', { x: event.clientX, y: event.clientY });
      console.log('⏰ 点击时间:', new Date().toLocaleTimeString());
      console.log('🔢 当前点击次数:', clickCount.value + 1);
      console.log('🎯 目标元素:', event.target.tagName, event.target.className);
      
      // 如果是触摸事件，获取触摸点坐标
      if (event.touches && event.touches.length > 0) {
        const touch = event.touches[0];
        console.log('👆 触摸坐标:', { x: touch.clientX, y: touch.clientY });
      }
      
      clickCount.value++;
      
      // 清除之前的计时器
      if (clickTimer.value) {
        console.log('🧹 清除之前的计时器');
        clearTimeout(clickTimer.value);
      }
      
      // 如果达到4次点击，显示设备管理员登录弹窗
      if (clickCount.value >= 4) {
        console.log('🎉 达到4次点击！触发设备管理员登录弹窗');
        console.log('📋 弹窗状态变更: false -> true');
        showDeviceAdminModal.value = true;
        clickCount.value = 0;
        return;
      }
      
      // 设置计时器，3秒后重置点击次数
      clickTimer.value = setTimeout(() => {
        console.log('⏰ 3秒计时器到期，重置点击次数: ' + clickCount.value + ' -> 0');
        clickCount.value = 0;
      }, 3000);
      
      console.log('⏳ 设置3秒计时器，将在', new Date(Date.now() + 3000).toLocaleTimeString(), '重置点击次数');
    };

    // 打开设备设置
    const openDeviceSettings = () => {
      console.log('🔧 打开设备管理员设置');
      showDeviceAdminModal.value = true;
    };
    
    // 验证手机号格式
    const validatePhone = () => {
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (deviceAdminPhone.value.length === 0) {
        phoneError.value = '';
      } else if (!phoneRegex.test(deviceAdminPhone.value)) {
        phoneError.value = '请输入正确的11位手机号';
      } else {
        phoneError.value = '';
      }
      console.log('📱 手机号验证:', deviceAdminPhone.value, '错误信息:', phoneError.value);
    };
    
    // 设备管理员登录
    const deviceAdminLogin = async () => {
      console.log('🔐 开始设备管理员登录，手机号:', deviceAdminPhone.value);
      
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(deviceAdminPhone.value) || phoneError.value !== '') {
        console.error('❌ 手机号格式不正确');
        return;
      }

      loginLoading.value = true;
      
      try {
        const response = await deviceAdminApi.login(deviceAdminPhone.value);
        console.log('📥 登录响应:', response);
        
        if (response.data && response.data.code === 0) {
          console.log('✅ 登录成功:', response.data);
          
          // 保存管理员信息
          deviceAdminInfo.value = {
            managerId: response.data.managerId,
            managerName: response.data.managerName,
            phone: response.data.phone,
            marketId: response.data.marketId,
            marketName: response.data.marketName
          };
          
          // 切换到设备选择界面
          deviceAdminStep.value = 'selectDevice';
          
          // 获取设备列表
          await loadDeviceList();
          
        } else {
          console.error('❌ 登录失败:', response.data?.msg || '未知错误');
          alert(response.data?.msg || '登录失败，请重试');
        }
        
      } catch (error) {
        console.error('❌ 登录异常:', error);
        alert('网络错误，请检查网络连接后重试');
      } finally {
        loginLoading.value = false;
      }
    };
    
    // 加载设备列表
    const loadDeviceList = async () => {
      console.log('📱 开始加载设备列表，市场ID:', deviceAdminInfo.value.marketId);
      
      try {
        const response = await deviceAdminApi.getDevices(deviceAdminInfo.value.marketId);
        console.log('📥 设备列表响应:', response);
        
        if (response.data && response.data.code === 0) {
          deviceList.value = response.data.list || [];
          console.log('✅ 设备列表加载成功，设备数量:', deviceList.value.length);
        } else {
          console.error('❌ 设备列表加载失败:', response.data?.msg);
          deviceList.value = [];
        }
        
      } catch (error) {
        console.error('❌ 加载设备列表异常:', error);
        deviceList.value = [];
      }
    };
    
    // 选择设备
    const selectDevice = (device) => {
      console.log('🖨️ 选择设备:', device);
      selectedDeviceId.value = device.nxPdId;
      selectedDeviceInfo.value = device;
    };
    
    // 确认设备选择
    const confirmDeviceSelection = async () => {
      console.log('✅ 确认设备选择:', selectedDeviceInfo.value);
      
      // 保存配置到本地存储
      const config = {
        deviceAdminInfo: deviceAdminInfo.value,
        selectedDevice: selectedDeviceInfo.value,
        configTime: new Date().toISOString()
      };
      
      localStorage.setItem('deviceAdminConfig', JSON.stringify(config));
      console.log('💾 配置已保存到本地存储:', config);
      
      // 立即更新页面上的市场名称
      if (deviceAdminInfo.value.marketName) {
        marketName.value = deviceAdminInfo.value.marketName;
        console.log('🏪 立即显示市场名称:', marketName.value);
      }
      
      // 切换到完成界面
      deviceAdminStep.value = 'completed';
    };
    
    // 清理设备配置缓存
    const clearDeviceConfig = () => {
      localStorage.removeItem('deviceAdminConfig');
      console.log('🗑️ 设备配置缓存已清理');
      // 重新加载页面
      window.location.reload();
    };

    // 关闭设备管理员弹窗
    const closeDeviceAdminModal = () => {
      console.log('❌ 关闭设备管理员弹窗');
      showDeviceAdminModal.value = false;
      resetDeviceAdminModal();
    };
    
    // 重置设备管理员弹窗状态
    const resetDeviceAdminModal = () => {
      deviceAdminStep.value = 'login';
      deviceAdminPhone.value = '';
      phoneError.value = '';
      loginLoading.value = false;
      deviceAdminInfo.value = {};
      deviceList.value = [];
      selectedDeviceId.value = null;
      selectedDeviceInfo.value = {};
    };
    
    // 获取设备状态文本
    const getStatusText = (status) => {
      const statusMap = {
        0: '离线',
        1: '正常',
        2: '故障',
        3: '缺纸'
      };
      return statusMap[status] || '未知';
    };
    
    // 获取设备状态样式类
    const getStatusClass = (status) => {
      const classMap = {
        0: 'status-offline',
        1: 'status-normal',
        2: 'status-error',
        3: 'status-paper'
      };
      return classMap[status] || 'status-unknown';
    };
  
      // 生命周期钩子
      onMounted(() => {
        startAdRotation();
        
        // 获取市场名称
        const deviceConfig = localStorage.getItem('deviceAdminConfig');
        console.log('🔍 检查设备配置:', deviceConfig);
        
        if (deviceConfig) {
          try {
            const config = JSON.parse(deviceConfig);
            console.log('📋 解析后的配置:', config);
            console.log('📋 deviceAdminInfo:', config.deviceAdminInfo);
            
            if (config.deviceAdminInfo && config.deviceAdminInfo.marketName !== undefined && config.deviceAdminInfo.marketName !== null) {
              marketName.value = config.deviceAdminInfo.marketName;
              console.log('🏪 显示市场名称:', marketName.value);
            } else {
              console.log('⚠️ 没有找到marketName字段或为空');
              console.log('📋 marketName值:', config.deviceAdminInfo?.marketName);
            }
          } catch (error) {
            console.error('❌ 解析设备配置失败:', error);
          }
        } else {
          console.log('⚠️ 没有找到设备配置');
        }
      });
  
      onBeforeUnmount(() => {
        stopAdRotation();
        // 清理点击计时器
        if (clickTimer.value) {
          clearTimeout(clickTimer.value);
        }
      });
  
      // 计算属性
      const isPhoneValid = computed(() => {
        const phoneRegex = /^1[3-9]\d{9}$/;
        return phoneRegex.test(deviceAdminPhone.value) && phoneError.value === '';
      });

      // 市场名称
      const marketName = ref('');
      
      return {
        currentAd,
        goHome,
        marketName, // 市场名称
        // 点击检测相关
        handleScreenClick,
        clickCount,
        lastEventType,
        // 设备设置相关
        openDeviceSettings,
        showDeviceAdminModal,
        deviceAdminStep,
        deviceAdminPhone,
        phoneError,
        loginLoading,
        deviceAdminInfo,
        deviceList,
        selectedDeviceId,
        selectedDeviceInfo,
        validatePhone,
        deviceAdminLogin,
        selectDevice,
        confirmDeviceSelection,
        closeDeviceAdminModal,
        getStatusText,
        getStatusClass,
        isPhoneValid
      };
    }
  };
  </script>
  
  <style scoped>
  .screen {
    height: 100vh; /* 使整个屏幕的高度 */
    display: flex;
    flex-direction: column;
    overflow: hidden; /* 防止出现滚动条 */
  }
  
  .carousel-container {
    flex-grow: 1; /* 使轮播图占据屏幕的剩余空间 */
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .carousel-image {
    /* width: 100%;
    height: 100%;  */
    object-fit: cover; /* 图片按比例缩放并填满区域 */
  }
  
  /* 底部部分样式 */
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #ff8c00; /* 鲜艳的背景色 */
    color: white;
    padding: 20px 40px;
    width: 100%;
    position: relative; /* 让它紧贴底部 */
  }
  
  .left-title h1 {
    font-size: 32px; /* 设置大字体 */
    font-weight: bold;
    margin: 0;
    text-align: left;
  }
  
  .market-name-below {
    font-size: 20px;
    font-weight: normal;
    margin-top: 8px;
    color: #ffffff;
    text-align: left;
  }
  
  .right-btn {
    display: flex;
    align-items: center;
  }
  
  .settings-btn {
    padding: 15px 25px;
    font-size: 16px;
    font-weight: bold;
    background-color: #6c757d;  /* 灰色背景 */
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.3s;
    margin-right: 15px;
  }
  
  .settings-btn:hover {
    background-color: #5a6268;  /* 更深的灰色，增加悬停效果 */
  }
  
  .print-btn {
    padding: 15px 30px;
    font-size: 18px;
    font-weight: bold;
    background-color: #e53935;  /* 红色背景 */
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.3s;
  }
  
  .print-btn:hover {
    background-color: #d32f2f;  /* 更深的红色，增加悬停效果 */
  }

  /* ==================== 设备管理员弹窗样式 ==================== */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .modal-content {
    background-color: white;
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    animation: modalSlideIn 0.3s ease-out;
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(-20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* 设备管理员登录样式 */
  .device-admin-login,
  .device-selection,
  .device-completed {
    padding: 30px;
  }

  .device-admin-login h3,
  .device-selection h3,
  .device-completed h3 {
    text-align: center;
    margin-bottom: 25px;
    color: #333;
    font-size: 20px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #555;
  }

  .phone-input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.3s ease;
    box-sizing: border-box;
  }

  .phone-input:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }

  .error-message {
    color: #dc3545;
    font-size: 14px;
    margin-top: 5px;
  }

  .button-group {
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 25px;
  }

  .login-btn,
  .confirm-btn {
    background: linear-gradient(135deg, #007bff, #0056b3);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    min-width: 100px;
  }

  .login-btn:hover,
  .confirm-btn:hover {
    background: linear-gradient(135deg, #0056b3, #004085);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
  }

  .login-btn:disabled,
  .confirm-btn:disabled {
    background: #6c757d;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .cancel-btn {
    background: #6c757d;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    min-width: 100px;
  }

  .cancel-btn:hover {
    background: #5a6268;
    transform: translateY(-2px);
  }

  /* 设备选择样式 */
  .market-info {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
    border-left: 4px solid #007bff;
  }

  .market-info p {
    margin: 5px 0;
    color: #555;
  }

  .device-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e9ecef;
    border-radius: 8px;
  }

  .device-item {
    padding: 15px;
    border-bottom: 1px solid #e9ecef;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .device-item:last-child {
    border-bottom: none;
  }

  .device-item:hover {
    background-color: #f8f9fa;
  }

  .device-item.selected {
    background-color: #e3f2fd;
    border-left: 4px solid #007bff;
  }

  .device-name {
    font-weight: 600;
    font-size: 16px;
    color: #333;
    margin-bottom: 5px;
  }

  .device-info {
    font-size: 14px;
    color: #666;
    margin-bottom: 8px;
  }

  .device-info span {
    margin-right: 15px;
  }

  .device-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .status-normal {
    background-color: #d4edda;
    color: #155724;
  }

  .status-offline {
    background-color: #f8d7da;
    color: #721c24;
  }

  .status-error {
    background-color: #f5c6cb;
    color: #721c24;
  }

  .status-paper {
    background-color: #fff3cd;
    color: #856404;
  }

  .paper-count {
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }

  .no-devices {
    text-align: center;
    padding: 40px 20px;
    color: #666;
    font-style: italic;
  }

  /* 配置完成样式 */
  .config-info {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 25px;
    border-left: 4px solid #28a745;
  }

  .config-info p {
    margin: 8px 0;
    color: #555;
  }

  /* 响应式设计 */
  @media (max-width: 480px) {
    .modal-content {
      width: 95%;
      margin: 10px;
    }
    
    .device-admin-login,
    .device-selection,
    .device-completed {
      padding: 20px;
    }
    
    .button-group {
      flex-direction: column;
    }
    
    .login-btn,
    .confirm-btn,
    .cancel-btn {
      width: 100%;
    }
  }
  </style>
  