<template>
  <div class="screen" @click="handleScreenClick">
    <!-- 主内容区：打印机弹窗只盖这里，不盖底部栏（否则 fixed 全屏遮罩会点不到「记住用户」「打印配送单」） -->
    <div class="screen-main">
      <div class="carousel-container">
        <img :src="currentAd" alt="广告" class="carousel-image" />
      </div>

      <!-- 打印机设置弹窗（仅覆盖 screen-main） -->
      <div v-if="showPrinterModal" class="modal-overlay modal-overlay--main" @click="closePrinterModal">
        <div class="modal-content" @click.stop>
          <div class="printer-settings">
            <h3>🖨️ 设置系统打印机</h3>
            
            <div v-if="loadingPrinters" class="loading-message">
              正在加载打印机列表...
            </div>
            
            <div v-if="!loadingPrinters && printerList.length > 0" class="printer-list">
              <div 
                v-for="printer in printerList" 
                :key="printer.name"
                :class="['printer-item', { 'selected': selectedPrinterName === printer.name }]"
                @click="selectPrinter(printer)"
              >
                <div class="printer-name">
                  {{ printer.displayName }}
                  <span v-if="printer.isDefault" class="default-badge">默认</span>
                </div>
                <div class="printer-info">
                  <span>{{ printer.description || '无描述' }}</span>
                  <span :class="['printer-status', getPrinterStatusClass(printer.status)]">
                    {{ getPrinterStatusText(printer.status) }}
                  </span>
                </div>
              </div>
            </div>
            
            <div v-if="!loadingPrinters && printerList.length === 0" class="no-printers">
              未找到可用打印机
            </div>
            
            <div v-if="currentPrinter" class="current-printer-info">
              <p><strong>当前选择的打印机：</strong>{{ currentPrinter.displayName }}</p>
              <p v-if="currentPrinter.isDefault" class="default-info">（系统默认打印机）</p>
            </div>
            
            <div v-if="!currentPrinter && printerList.length > 0" class="hint-info">
              <p>💡 请从上方列表中选择一台打印机</p>
            </div>
            
            <div class="button-group">
              <button 
                @click="savePrinter" 
                :disabled="!selectedPrinterName || savingPrinter"
                class="confirm-btn"
              >
                {{ savingPrinter ? '保存中...' : '确认保存' }}
              </button>
              <button @click="closePrinterModal" class="cancel-btn">取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>

      <!-- 底部部分：显式 stopPropagation，避免点「记住用户/打印」时触发全屏连点计数（勿用裸 @click.stop，部分环境下可能影响子元素） -->
      <div class="footer" @click="onFooterClickStopBubble">
        <!-- 左侧标题 -->
        <div class="left-title" @click="openPrinterSettings" style="cursor: pointer;" title="点击设置系统打印机">
          <h1>京采接单工具</h1>
          <div v-if="marketName" class="market-name-below">{{ marketName }}</div>
        </div>
  
        <!-- 右侧按钮 -->
        <div class="right-btn d-flex gap-3 align-items-center flex-wrap">
<!--          <button @click="printWidthTest" class="settings-btn" style="background-color: #17a2b8;">宽度测试</button>-->
<!--          <button @click="openDeviceSettings" class="settings-btn">设备管理</button>-->
          <label class="remember-user-label">
            <input
              v-model="rememberUser"
              type="checkbox"
              class="remember-user-checkbox"
              @change="persistRememberUser"
            />
            <span>记住用户</span>
          </label>
          <button @click="goHome" class="print-btn">打印配送单</button>
        </div>
      </div>
    </div>

    <!-- 设备管理员登录弹窗 -->
    <div v-if="showDeviceAdminModal" class="modal-overlay modal-overlay--fullscreen" @click="closeDeviceAdminModal">
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
import { REMEMBER_PRINTER_USER_KEY } from '../utils/rememberPrinterUser';
  // 使用 import 来引入图片
  import ad1 from '../assets/ad/ad1.png'
  import ad2 from '@/assets/ad/ad2.png';
  import ad3 from '@/assets/ad/ad3.png';
  import ad4 from '@/assets/ad/ad4.png';
  import ad5 from '@/assets/ad/ad5.png';

  export default {
    name: 'Screen',
    setup() {
      console.log('🎬 Screen 组件 setup 开始执行');
      
      // 获取路由对象
      const router = useRouter();

      const readRememberInitial = () => localStorage.getItem(REMEMBER_PRINTER_USER_KEY) === '1';

      const rememberUser = ref(readRememberInitial());

      /** 仅写 localStorage（同步）+ 异步同步 userData，不用 sendSync，避免界面卡顿、勾选延迟 */
      const persistRememberUser = () => {
        const on = !!rememberUser.value;
        if (on) {
          localStorage.setItem(REMEMBER_PRINTER_USER_KEY, '1');
        } else {
          localStorage.removeItem(REMEMBER_PRINTER_USER_KEY);
        }
        try {
          window.electronAPI?.rememberPrinterUserSetAsync?.(on);
        } catch (e) {
          console.warn('[记住用户] 异步写入 userData 失败:', e);
        }
      };

      /** 主菜单「文件 → 取消自动登录」通过 preload 白名单事件同步取消勾选。 */
      const onMenuClearAutoLogin = () => {
        rememberUser.value = false;
        localStorage.removeItem(REMEMBER_PRINTER_USER_KEY);
      };
      let clearRememberUserCleanup = null;

      // 广告图片数组
      const ads = [ad1, ad2, ad3, ad4, ad5];
      console.log('🖼️ 广告图片数组:', ads);
  
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
  
      const onFooterClickStopBubble = (e) => {
        e.stopPropagation();
      };

       // 点击按钮跳转到 Home 页面
    const goHome = () => {
      persistRememberUser();
      router.push({ name: 'Home' });
    };
    
    // 处理屏幕点击事件
    const handleScreenClick = (event) => {
      // 底部栏（记住用户、打印等）不触发连点计数；与 footer 上 @click.stop 双保险
      if (event.target?.closest?.('.footer')) {
        return;
      }

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
          await this.$refs.alertDialog.alert(response.data?.msg || '登录失败，请重试', 'error');
        }
        
      } catch (error) {
        console.error('❌ 登录异常:', error);
        await this.$refs.alertDialog.alert('网络错误，请检查网络连接后重试', 'error');
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
      onMounted(async () => {
        clearRememberUserCleanup =
          window.electronAPI?.onClearRememberPrinterUser?.(onMenuClearAutoLogin) || null;

        if (rememberUser.value) {
          persistRememberUser();
        }

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
        
        // 检查打印机配置，如果没有配置则自动弹出设置弹窗
        try {
          console.log('🔍 [Screen.vue] 检查打印机配置...');
          if (window.electronAPI && window.electronAPI.getDefaultPrinter) {
            const result = await window.electronAPI.getDefaultPrinter();
            console.log('🔍 [Screen.vue] 打印机配置检查结果:', result);
            
            if (!result.success || !result.printerName) {
              console.warn('⚠️ [Screen.vue] 未配置打印机，自动打开打印机设置弹窗');
              // 延迟一小段时间，确保界面已渲染完成
              setTimeout(() => {
                openPrinterSettings();
              }, 500);
            } else {
              console.log('✅ [Screen.vue] 已配置打印机:', result.printerName);
            }
          } else {
            console.warn('⚠️ [Screen.vue] electronAPI.getDefaultPrinter 不可用');
          }
        } catch (error) {
          console.error('❌ [Screen.vue] 检查打印机配置失败:', error);
          // 如果检查失败，也打开设置弹窗，让用户手动设置
          setTimeout(() => {
            openPrinterSettings();
          }, 500);
        }
      });
  
      onBeforeUnmount(() => {
        if (typeof clearRememberUserCleanup === 'function') {
          clearRememberUserCleanup();
          clearRememberUserCleanup = null;
        }
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
      
      // 打印机设置相关
      const showPrinterModal = ref(false);
      const printerList = ref([]);
      const selectedPrinterName = ref(null);
      const currentPrinter = ref(null);
      const loadingPrinters = ref(false);
      const savingPrinter = ref(false);
      
      // 打印宽度测试 - 直接修改这里的参数来学习打印效果
      // ========== 参数设置区域 ==========
      const TEST_WIDTH = 200;        // 矩形宽度 (mm) - 修改这个来测试不同宽度
      const TEST_HEIGHT = 50;         // 矩形高度 (mm)
      const TEST_LEFT_MARGIN = 0;     // 左边距 (mm) - 注意：打印机驱动可能有默认边距，实际可打印区域会小于页面宽度
      const TEST_RIGHT_MARGIN = 0;    // 右边距 (mm)
      const TEST_TOP_MARGIN = 0;      // 上边距 (mm) - 注意：打印机驱动可能有默认上边距
      const TEST_PAGE_WIDTH = 241;   // 页面宽度 (mm) - 物理纸张宽度
      // 说明：如果打印出来宽度是185mm而不是200mm，说明左右各被裁剪了约7.5mm（打印机驱动的默认边距）
      // 如果上边框和右边框被裁剪，说明打印机有默认的上边距和右边距
      // ========== 参数设置区域结束 ==========
      
      // 打开打印机设置弹窗
      const openPrinterSettings = async () => {
        console.log('🖨️ 打开打印机设置');
        showPrinterModal.value = true;
        loadingPrinters.value = true;
        selectedPrinterName.value = null;
        
        try {
          // 获取当前保存的默认打印机
          if (window.electronAPI && window.electronAPI.getDefaultPrinter) {
            const defaultResult = await window.electronAPI.getDefaultPrinter();
            if (defaultResult.success && defaultResult.printerName) {
              selectedPrinterName.value = defaultResult.printerName;
              console.log('📋 当前默认打印机:', defaultResult.printerName);
            }
          }
          
          // 获取系统打印机列表
          if (window.electronAPI && window.electronAPI.getSystemPrinters) {
            const result = await window.electronAPI.getSystemPrinters();
            if (result.success) {
              printerList.value = result.printers || [];
              console.log('✅ 获取到打印机列表:', printerList.value.length, '台');
              
              // 如果已选择打印机，设置当前打印机信息
              if (selectedPrinterName.value) {
                const printer = printerList.value.find(p => p.name === selectedPrinterName.value);
                if (printer) {
                  currentPrinter.value = printer;
                }
              } else {
                // 如果没有保存的默认打印机，但有打印机列表
                if (printerList.value.length > 0) {
                  // 优先选择系统默认打印机
                  const defaultPrinter = printerList.value.find(p => p.isDefault);
                  if (defaultPrinter) {
                    selectedPrinterName.value = defaultPrinter.name;
                    currentPrinter.value = defaultPrinter;
                    console.log('📌 自动选择系统默认打印机:', defaultPrinter.name);
                  } else if (printerList.value.length === 1) {
                    // 如果只有一台打印机，自动选中
                    selectedPrinterName.value = printerList.value[0].name;
                    currentPrinter.value = printerList.value[0];
                    console.log('📌 自动选择唯一打印机:', printerList.value[0].name);
                  }
                }
              }
            } else {
              console.error('❌ 获取打印机列表失败:', result.error);
              await this.$refs.alertDialog.alert('获取打印机列表失败: ' + result.error, 'error');
            }
          } else {
            console.error('❌ electronAPI.getSystemPrinters 不存在');
            await this.$refs.alertDialog.alert('打印机API不可用', 'error');
          }
        } catch (error) {
          console.error('❌ 打开打印机设置失败:', error);
          await this.$refs.alertDialog.alert('打开打印机设置失败: ' + error.message, 'error');
        } finally {
          loadingPrinters.value = false;
        }
      };
      
      // 选择打印机
      const selectPrinter = (printer) => {
        console.log('🖨️ 选择打印机:', printer);
        selectedPrinterName.value = printer.name;
        currentPrinter.value = printer;
      };
      
      // 保存打印机设置（保存到统一配置文件）
      const savePrinter = async () => {
        if (!selectedPrinterName.value) {
          await this.$refs.alertDialog.alert('请先选择打印机', 'warning');
          return;
        }
        
        savingPrinter.value = true;
        
        try {
          if (window.electronAPI && window.electronAPI.saveDefaultPrinter) {
            const printer = printerList.value.find(p => p.name === selectedPrinterName.value);
            const printerDisplayName = printer ? printer.displayName : selectedPrinterName.value;
            
            // 保存打印机名称和显示名称到统一配置文件
            const result = await window.electronAPI.saveDefaultPrinter(selectedPrinterName.value, printerDisplayName);
            if (result.success) {
              console.log('✅ 保存默认打印机成功:', selectedPrinterName.value, printerDisplayName);
              
              // 保存成功后，自动同步系统配置
              try {
                if (window.electronAPI && window.electronAPI.getPrinterSystemConfig) {
                  console.log('🔄 开始同步系统配置...');
                  const configResult = await window.electronAPI.getPrinterSystemConfig();
                  if (configResult.success && configResult.config) {
                    console.log('✅ 系统配置同步成功:', configResult.config);
                    await this.$refs.alertDialog.alert(`打印机设置已保存并同步系统配置！\n\n默认打印机：${printerDisplayName}\n\n系统配置信息：\n• DPI: ${configResult.config.hDpi} x ${configResult.config.vDpi}\n• 纸张尺寸: ${configResult.config.widthMm}mm x ${configResult.config.heightMm}mm`, 'success');
                  } else {
                    console.warn('⚠️ 系统配置同步失败，但打印机已保存:', configResult.error);
                    await this.$refs.alertDialog.alert(`打印机设置已保存！\n默认打印机：${printerDisplayName}\n\n⚠️ 系统配置同步失败: ${configResult.error || '未知错误'}\n提示：某些打印机可能无法获取完整配置信息，这是正常的。`, 'warning');
                  }
                } else {
                  console.warn('⚠️ 系统配置API不可用，仅保存打印机设置');
                  await this.$refs.alertDialog.alert(`打印机设置已保存！\n默认打印机：${printerDisplayName}`, 'success');
                }
              } catch (configError) {
                console.error('❌ 同步系统配置时出错:', configError);
                // 即使同步失败，也提示保存成功
                await this.$refs.alertDialog.alert(`打印机设置已保存！\n默认打印机：${printerDisplayName}\n\n⚠️ 系统配置同步失败: ${configError.message}`, 'warning');
              }
              
              closePrinterModal();
            } else {
              console.error('❌ 保存默认打印机失败:', result.error);
              await this.$refs.alertDialog.alert('保存失败: ' + result.error, 'error');
            }
          } else {
            console.error('❌ electronAPI.saveDefaultPrinter 不存在');
            await this.$refs.alertDialog.alert('打印机API不可用', 'error');
          }
        } catch (error) {
          console.error('❌ 保存打印机设置失败:', error);
          await this.$refs.alertDialog.alert('保存失败: ' + error.message, 'error');
        } finally {
          savingPrinter.value = false;
        }
      };
      
      // 关闭打印机设置弹窗
      const closePrinterModal = () => {
        console.log('❌ 关闭打印机设置弹窗');
        showPrinterModal.value = false;
        selectedPrinterName.value = null;
        currentPrinter.value = null;
        printerList.value = [];
      };
      
      // 获取打印机状态文本
      const getPrinterStatusText = (status) => {
        const statusMap = {
          0: '空闲',
          1: '打印中',
          2: '暂停',
          3: '错误'
        };
        return statusMap[status] || '未知';
      };
      
      // 获取打印机状态样式类
      const getPrinterStatusClass = (status) => {
        const classMap = {
          0: 'status-idle',
          1: 'status-printing',
          2: 'status-paused',
          3: 'status-error'
        };
        return classMap[status] || 'status-unknown';
      };
      
      // 打印宽度测试 - 最简单的矩形测试
      const printWidthTest = async () => {
        console.log('🖨️ 开始打印宽度测试');
        console.log('📏 测试参数:', {
          width: TEST_WIDTH,
          height: TEST_HEIGHT,
          leftMargin: TEST_LEFT_MARGIN,
          rightMargin: TEST_RIGHT_MARGIN,
          topMargin: TEST_TOP_MARGIN,
          pageWidth: TEST_PAGE_WIDTH
        });
        console.log('📌 说明:');
        console.log('  - 页面宽度:', TEST_PAGE_WIDTH, 'mm (物理纸张宽度)');
        console.log('  - 矩形宽度:', TEST_WIDTH, 'mm (期望打印宽度)');
        console.log('  - 如果实际打印宽度小于', TEST_WIDTH, 'mm，说明打印机驱动有默认边距');
        console.log('  - 如果上边框/右边框被裁剪，说明打印机有默认的上边距/右边距');
        console.log('  - 红色虚线标记页面边界，帮助识别实际可打印区域');
        
        // 构建最简单的测试HTML - 就是一个矩形，带视觉标记
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: ${TEST_PAGE_WIDTH}mm 93mm;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      width: ${TEST_PAGE_WIDTH}mm;
      height: 93mm;
      margin: 0;
      padding: ${TEST_TOP_MARGIN}mm ${TEST_RIGHT_MARGIN}mm 0 ${TEST_LEFT_MARGIN}mm;
      position: relative;
      background: #fff;
    }
    /* 页面边界标记 - 帮助识别实际可打印区域 */
    .page-marker {
      position: absolute;
      border: 1px dashed #ccc;
    }
    .page-left {
      left: 0;
      top: 0;
      bottom: 0;
      width: 0;
      border-left: 2px solid #ff0000;
    }
    .page-right {
      right: 0;
      top: 0;
      bottom: 0;
      width: 0;
      border-right: 2px solid #ff0000;
    }
    .page-top {
      top: 0;
      left: 0;
      right: 0;
      height: 0;
      border-top: 2px solid #ff0000;
    }
    /* 测试矩形 */
    .test-rect {
      width: ${TEST_WIDTH}mm;
      height: ${TEST_HEIGHT}mm;
      border: 2px solid #000;
      background: #f0f0f0;
      margin: 10mm auto 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
      position: relative;
    }
    /* 宽度标记 */
    .width-markers {
      position: absolute;
      top: -5mm;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #666;
    }
    .width-markers::before {
      content: '0';
      position: absolute;
      left: 0;
    }
    .width-markers::after {
      content: '${TEST_WIDTH}mm';
      position: absolute;
      right: 0;
    }
    /* 说明文字 */
    .info {
      position: absolute;
      top: ${TEST_TOP_MARGIN + TEST_HEIGHT + 15}mm;
      left: ${TEST_LEFT_MARGIN}mm;
      font-size: 10px;
      color: #666;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <!-- 页面边界标记 -->
  <div class="page-marker page-left"></div>
  <div class="page-marker page-right"></div>
  <div class="page-marker page-top"></div>
  
  <!-- 测试矩形 -->
  <div class="test-rect">
    <div class="width-markers"></div>
    ${TEST_WIDTH}mm
  </div>
  
  <!-- 说明信息 -->
  <div class="info">
    页面宽度: ${TEST_PAGE_WIDTH}mm<br>
    矩形宽度: ${TEST_WIDTH}mm<br>
    左边距: ${TEST_LEFT_MARGIN}mm<br>
    右边距: ${TEST_RIGHT_MARGIN}mm<br>
    上边距: ${TEST_TOP_MARGIN}mm<br>
    <br>
    <strong>注意：</strong><br>
    如果打印出来宽度小于${TEST_WIDTH}mm，说明打印机驱动有默认边距<br>
    如果上边框/右边框被裁剪，说明打印机有默认的上边距/右边距<br>
    红色虚线标记页面边界，帮助识别实际可打印区域
  </div>
</body>
</html>
        `;
        
        try {
          if (window.electronAPI && window.electronAPI.sendPrintRequestWithCallback) {
            const result = await window.electronAPI.sendPrintRequestWithCallback(htmlContent);
            if (result.success) {
              console.log('✅ 打印测试已发送');
            } else {
              console.error('❌ 打印失败:', result.error);
              await this.$refs.alertDialog.alert('打印失败: ' + result.error, 'error');
            }
          } else {
            await this.$refs.alertDialog.alert('electronAPI 不可用', 'error');
          }
        } catch (error) {
          console.error('❌ 打印测试失败:', error);
          await this.$refs.alertDialog.alert('打印测试失败: ' + error.message, 'error');
        }
      };
      
      return {
        currentAd,
        goHome,
        rememberUser,
        persistRememberUser,
        onFooterClickStopBubble,
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
        isPhoneValid,
        // 打印机设置相关
        showPrinterModal,
        printerList,
        selectedPrinterName,
        currentPrinter,
        loadingPrinters,
        savingPrinter,
        openPrinterSettings,
        selectPrinter,
        savePrinter,
        closePrinterModal,
        getPrinterStatusText,
        getPrinterStatusClass,
        // 宽度测试
        printWidthTest
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

  /* 轮播 + 打印机遮罩仅在此区域内；底部 footer 在 screen 下与 screen-main 并列，不被打印机弹窗挡住 */
  .screen-main {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }
  
  .carousel-container {
    flex-grow: 1; /* 使轮播图占据 screen-main 的剩余空间 */
    min-height: 0;
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
    flex-shrink: 0;
    position: relative;
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

  .remember-user-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .remember-user-checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
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
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
  }

  /* 设备管理员等需盖住全窗口 */
  .modal-overlay--fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
  }

  /* 打印机设置：只盖住 screen-main（轮播区），底部操作条始终可点 */
  .modal-overlay--main {
    position: absolute;
    inset: 0;
    z-index: 50;
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

  /* 打印机设置样式 */
  .printer-settings {
    padding: 30px;
  }

  .printer-settings h3 {
    text-align: center;
    margin-bottom: 25px;
    color: #333;
    font-size: 20px;
  }

  .loading-message {
    text-align: center;
    padding: 40px 20px;
    color: #666;
  }

  .printer-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .printer-item {
    padding: 15px;
    border-bottom: 1px solid #e9ecef;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .printer-item:last-child {
    border-bottom: none;
  }

  .printer-item:hover {
    background-color: #f8f9fa;
  }

  .printer-item.selected {
    background-color: #e3f2fd;
    border-left: 4px solid #007bff;
  }

  .printer-name {
    font-weight: 600;
    font-size: 16px;
    color: #333;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .default-badge {
    background-color: #28a745;
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: normal;
  }

  .printer-info {
    font-size: 14px;
    color: #666;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .printer-status {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .status-idle {
    background-color: #d4edda;
    color: #155724;
  }

  .status-printing {
    background-color: #cce5ff;
    color: #004085;
  }

  .status-paused {
    background-color: #fff3cd;
    color: #856404;
  }

  .status-error {
    background-color: #f8d7da;
    color: #721c24;
  }

  .no-printers {
    text-align: center;
    padding: 40px 20px;
    color: #666;
    font-style: italic;
  }

  .current-printer-info {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
    border-left: 4px solid #28a745;
  }

  .current-printer-info p {
    margin: 4px 0;
    color: #555;
  }

  .default-info {
    font-size: 12px;
    color: #28a745 !important;
    font-style: italic;
  }

  .hint-info {
    background: #e7f3ff;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
    border-left: 4px solid #007bff;
  }

  .hint-info p {
    margin: 0;
    color: #004085;
    font-size: 14px;
  }

  /* 响应式设计 */
  @media (max-width: 480px) {
    .modal-content {
      width: 95%;
      margin: 10px;
    }
    
    .device-admin-login,
    .device-selection,
    .device-completed,
    .printer-settings {
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
  












