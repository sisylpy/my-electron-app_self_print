
<template>
  <!-- 显示匹配的组件 -->
  <div id="app-container">
    <LoadingOverlay />
    <router-view v-if="$route" />
    <div v-else style="padding: 20px; color: red;">
      ⚠️ 路由未加载，当前路由: {{ $route }}
    </div>
  </div>
</template>
 
<script>
import LoadingOverlay from './components/LoadingOverlay.vue';

export default {
  name: 'App',
  components: {
    LoadingOverlay,
  },
  data() {
    return {
      inactivityTimer: null, // 无操作计时器
      inactivityTimeout: 0.5 * 60 * 1000, // 30秒超时（毫秒）
      lastActivityTime: Date.now(), // 最后活动时间
      /** MCP 同一 taskId 短时间内 IPC+inject 双通道去重 */
      _mcpLastTaskId: null,
      _mcpLastTaskAt: 0,
    }
  },
  created() {
    // 尽量早挂载，避免主进程 inject 早于 mounted 导致 no-handler
    window.__grainHandleMcpPrintTask = (task) => {
      this.handleMcpPrintTaskFromMain(task, 'inject');
    };
  },
  mounted() {
    // 自动清理设备配置缓存
    localStorage.removeItem('deviceAdminConfig');
    console.log('🗑️ 应用启动时自动清理设备配置缓存');
    
    // 检查是否有设备配置（自助打印状态）
    const deviceConfig = localStorage.getItem('deviceAdminConfig');
    let hasDeviceConfig = false;
    
    if (deviceConfig) {
      try {
        const config = JSON.parse(deviceConfig);
        hasDeviceConfig = config && config.deviceAdminInfo && config.deviceAdminInfo.marketId;
      } catch (error) {
        console.error('❌ 解析设备配置失败:', error);
        hasDeviceConfig = false;
      }
    }
    
    if (hasDeviceConfig) {
      // 自助打印状态：启用全局超时检测
      console.log('🖨️ 自助打印模式，启用全局超时检测');
      this.startInactivityTimer();
      this.addActivityListeners();
    } else {
      // 办公室打印状态：不启用全局超时检测
      console.log('🏢 办公室打印模式，不启用全局超时检测');
    }
    
    // 监听主进程的设备配置请求
    if (window.electronAPI && window.electronAPI.onGetDeviceConfig) {
      window.electronAPI.onGetDeviceConfig((printParams) => {
        console.log('📱 收到设备配置请求:', printParams);
        
        // 从localStorage获取设备配置
        const deviceConfig = localStorage.getItem('deviceAdminConfig');
        if (deviceConfig) {
          try {
            const config = JSON.parse(deviceConfig);
            
            // 添加配送商名称到printParams
            const disUser = this.$store.state.disUser;
            const enhancedPrintParams = { ...printParams };
            
            if (disUser && disUser.nxDistributerEntity) {
              enhancedPrintParams.distributerName = disUser.nxDistributerEntity.nxDistributerName;
            }
            
            console.log('📦 发送设备配置:', config);
            console.log('👤 配送商名称:', enhancedPrintParams.distributerName);
            console.log('👤 完整printParams:', enhancedPrintParams);
            window.electronAPI.sendDeviceConfig(config, enhancedPrintParams);
          } catch (error) {
            console.error('❌ 解析设备配置失败:', error);
            // 即使出错也要传递配送商名称
            const disUser = this.$store.state.disUser;
            const enhancedPrintParams = { ...printParams };
            if (disUser && disUser.nxDistributerEntity) {
              enhancedPrintParams.distributerName = disUser.nxDistributerEntity.nxDistributerName;
            }
            window.electronAPI.sendDeviceConfig(null, enhancedPrintParams);
          }
        } else {
          console.warn('⚠️ 未找到设备配置');
          // 即使没有设备配置也要传递配送商名称
          const disUser = this.$store.state.disUser;
          const enhancedPrintParams = { ...printParams };
          if (disUser && disUser.nxDistributerEntity) {
            enhancedPrintParams.distributerName = disUser.nxDistributerEntity.nxDistributerName;
          }
          window.electronAPI.sendDeviceConfig(null, enhancedPrintParams);
        }
      });
    }
    
    // 监听设备配置检查请求 - 决定使用哪个保存接口
    if (window.electronAPI && window.electronAPI.onCheckDeviceConfigForPrint) {
      window.electronAPI.onCheckDeviceConfigForPrint((printParams) => {
        console.log('🔍 收到设备配置检查请求:', printParams);
        
        // 检查localStorage中是否有设备配置
        const deviceConfig = localStorage.getItem('deviceAdminConfig');
        let hasDeviceConfig = false;
        
        if (deviceConfig) {
          try {
            const config = JSON.parse(deviceConfig);
            // 检查配置是否有效（有设备管理员信息和选中的设备）
            hasDeviceConfig = config && 
                             config.deviceAdminInfo && 
                             config.deviceAdminInfo.marketId && 
                             config.selectedDevice && 
                             config.selectedDevice.nxPdId;
            
            console.log('📋 设备配置检查结果:', hasDeviceConfig);
            console.log('📋 配置详情:', config);
          } catch (error) {
            console.error('❌ 解析设备配置失败:', error);
            hasDeviceConfig = false;
          }
        }
        
        console.log('📤 发送设备配置检查结果:', hasDeviceConfig);
        window.electronAPI.sendDeviceConfigCheckResult(hasDeviceConfig, printParams);
      });
    }
    
    // 监听合并接口的设备配置请求
    if (window.electronAPI && window.electronAPI.onGetDeviceConfigForMerge) {
      window.electronAPI.onGetDeviceConfigForMerge((printParams) => {
        console.log('📱 收到合并接口设备配置请求:', printParams);
        
        // 从localStorage获取设备配置
        const deviceConfig = localStorage.getItem('deviceAdminConfig');
        if (deviceConfig) {
          try {
            const config = JSON.parse(deviceConfig);
            
            // 添加配送商名称到printParams
            const disUser = this.$store.state.disUser;
            const enhancedPrintParams = { ...printParams };
            
            if (disUser && disUser.nxDistributerEntity) {
              enhancedPrintParams.distributerName = disUser.nxDistributerEntity.nxDistributerName;
            }
            
            console.log('📦 发送合并接口设备配置:', config);
            console.log('👤 配送商名称:', enhancedPrintParams.distributerName);
            window.electronAPI.sendDeviceConfigForMerge(config, enhancedPrintParams);
          } catch (error) {
            console.error('❌ 解析设备配置失败:', error);
            // 即使出错也要传递配送商名称
            const disUser = this.$store.state.disUser;
            const enhancedPrintParams = { ...printParams };
            if (disUser && disUser.nxDistributerEntity) {
              enhancedPrintParams.distributerName = disUser.nxDistributerEntity.nxDistributerName;
            }
            window.electronAPI.sendDeviceConfigForMerge(null, enhancedPrintParams);
          }
        } else {
          console.warn('⚠️ 未找到设备配置');
          // 即使没有设备配置也要传递配送商名称
          const disUser = this.$store.state.disUser;
          const enhancedPrintParams = { ...printParams };
          if (disUser && disUser.nxDistributerEntity) {
            enhancedPrintParams.distributerName = disUser.nxDistributerEntity.nxDistributerName;
          }
          window.electronAPI.sendDeviceConfigForMerge(null, enhancedPrintParams);
        }
      });
    }
    
    // 监听 MCP 打印任务（由主进程通过 IPC 发送）
    if (window.electronAPI && window.electronAPI.onMcpPrintTrigger) {
      window.electronAPI.onMcpPrintTrigger((task) => {
        this.handleMcpPrintTaskFromMain(task, 'ipc');
      });
    } else {
      console.warn('⚠️ [MCP] electronAPI.onMcpPrintTrigger 不可用（仍可依赖 inject 后援）');
    }
  },
  
  methods: {
    /**
     * @param {'ipc'|'inject'} source — ipc：preload 频道；inject：主进程 executeJavaScript 后援
     */
    handleMcpPrintTaskFromMain(task, source) {
      console.log(`🖨️ [MCP] 收到打印任务 (${source}):`, task);
      const id = task && task.taskId;
      const now = Date.now();
      if (id != null && id === this._mcpLastTaskId && now - this._mcpLastTaskAt < 2500) {
        try {
          if (window.electronAPI && typeof window.electronAPI.rendererConsoleLog === 'function') {
            window.electronAPI.rendererConsoleLog(`[MCP] App 去重跳过 taskId=${id} (${source})`);
          }
        } catch (e) {}
        return;
      }
      this._mcpLastTaskId = id;
      this._mcpLastTaskAt = now;
      try {
        if (window.electronAPI && typeof window.electronAPI.rendererConsoleLog === 'function') {
          window.electronAPI.rendererConsoleLog(
            `[MCP] App 收到(${source}) type=${task && task.type} taskId=${id} dep=${task && task.departmentId}`
          );
        }
      } catch (e) {}
      if (task && task.type === 'nx_delivery') {
        this.triggerPrintDeliveryOrder(task);
      } else {
        console.warn('⚠️ [MCP] 未知的任务类型:', task && task.type);
      }
    },

    // 启动无操作超时检测
    startInactivityTimer() {
      this.inactivityTimer = setInterval(() => {
        const now = Date.now();
        const timeSinceLastActivity = now - this.lastActivityTime;
        
        if (timeSinceLastActivity >= this.inactivityTimeout) {
          console.log('⏰ 检测到无操作超时，返回初始页面');
          this.handleInactivityTimeout();
        }
      }, 10000); // 每10秒检查一次
    },
    
    // 添加用户操作监听器
    addActivityListeners() {
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      
      events.forEach(event => {
        document.addEventListener(event, this.resetInactivityTimer, true);
      });
    },
    
    // 重置无操作计时器
    resetInactivityTimer() {
      this.lastActivityTime = Date.now();
      console.log('🔄 检测到用户操作，重置超时计时器');
    },
    
    // 处理无操作超时
    handleInactivityTimeout() {
      // 清除计时器
      if (this.inactivityTimer) {
        clearInterval(this.inactivityTimer);
        this.inactivityTimer = null;
      }
      
      // 清除用户信息
      this.$store.commit('SET_DISUSER', null);
      localStorage.removeItem('disUser');
      
      console.log('⏰ 无操作超时，已清除用户信息');
      
      // 返回初始页面（Screen页面）
      // 使用 nextTick 确保路由跳转在下一个事件循环中执行
      this.$nextTick(() => {
        if (this.$route.name !== 'Screen') {
          console.log('🏠 返回初始页面');
          this.$router.push({ name: 'Screen' }).catch(err => {
            // 忽略路由重复导航的错误
            if (err.name !== 'NavigationDuplicated') {
              console.error('路由跳转失败:', err);
            }
          });
        }
      });
      
      // 重新启动超时检测
      this.startInactivityTimer();
    },
    
    // 移除事件监听器
    removeActivityListeners() {
      const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
      
      events.forEach(event => {
        document.removeEventListener(event, this.resetInactivityTimer, true);
      });
    },
    
    // 触发配送单打印（由 MCP 任务触发）
    triggerPrintDeliveryOrder(task) {
      const summary = `[MCP] App triggerPrintDeliveryOrder taskId=${task.taskId} dep=${task.departmentId} mode=${task.printMode || 'all'}`;
      console.log('🖨️ [MCP] ▼', summary, task);
      try {
        if (window.electronAPI && typeof window.electronAPI.rendererConsoleLog === 'function') {
          window.electronAPI.rendererConsoleLog(`${summary} payload=${JSON.stringify(task)}`);
        }
      } catch (e) {}
      this.$store.commit('ENQUEUE_MCP_PRINT_TASK', task);
      if (this.$route.name !== 'Bills') {
        this.$router.push({ name: 'Bills' }).catch((err) => {
          if (err && err.name !== 'NavigationDuplicated') {
            console.error('🖨️ [MCP] 进入 Bills 失败:', err);
            try {
              if (window.electronAPI && typeof window.electronAPI.rendererConsoleLog === 'function') {
                window.electronAPI.rendererConsoleLog(`[MCP] 路由失败: ${err.message || err}`);
              }
            } catch (e) {}
          }
        });
      } else {
        try {
          if (window.electronAPI && typeof window.electronAPI.rendererConsoleLog === 'function') {
            window.electronAPI.rendererConsoleLog('[MCP] 已在 Bills 页，仅更新 Vuex，交由 Bills 监听消费');
          }
        } catch (e) {}
      }
    }
  },
  
  beforeUnmount() {
    delete window.__grainHandleMcpPrintTask;
    // 清理计时器和事件监听器
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
    }
    this.removeActivityListeners();
  }
};
</script>
 
