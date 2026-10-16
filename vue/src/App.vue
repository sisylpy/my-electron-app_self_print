
<template>
  <div id="app-container">
    <div v-if="bridgeBanner.show" class="bridge-status-banner" :class="'bridge-' + bridgeBanner.type">
      <span class="bridge-status-icon">{{ bridgeBanner.icon }}</span>
      <span class="bridge-status-text">{{ bridgeBanner.message }}</span>
    </div>
    <LoadingOverlay />
    <ProductShell v-if="$route && $route.meta.shell !== false">
      <router-view />
    </ProductShell>
    <router-view v-else-if="$route" />
    <div v-else style="padding: 20px; color: red;">
      ⚠️ 路由未加载，当前路由: {{ $route }}
    </div>
  </div>
</template>
 
<script>
import ProductShell from './app/layout/ProductShell.vue';
import LoadingOverlay from './components/LoadingOverlay.vue';

export default {
  name: 'App',
  components: {
    LoadingOverlay,
    ProductShell,
  },
  data() {
    return {
      inactivityTimer: null, // 无操作计时器
      inactivityTimeout: 0.5 * 60 * 1000, // 30秒超时（毫秒）
      lastActivityTime: Date.now(), // 最后活动时间
      /** MCP 重试投递可能重复到达，按 taskId 短时间去重。 */
      _mcpLastTaskId: null,
      _mcpLastTaskAt: 0,
      _mcpPrintCleanup: null,
      _wechatAutoReadCleanup: null,
      // 主进程推送的桥连接状态（GrainPrint 登录 / 微信打开/登录），用于顶部红条提示
      bridgeStatus: { grainPrintConnected: true, loginDisId: null, wechat: { open: null, loggedIn: null } },
      bridgeStatusCleanup: null,
    }
  },
  // 把桥连接状态（含微信运行状态）下发给子组件（如微信获取订单弹窗），避免重复监听 preload 单例通道。
  provide() {
    return { bridgeStatus: this.bridgeStatus };
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
      this._mcpPrintCleanup = window.electronAPI.onMcpPrintTrigger((task) => {
        this.handleMcpPrintTaskFromMain(task, 'ipc');
      });
    } else {
      console.warn('⚠️ [MCP] electronAPI.onMcpPrintTrigger 不可用');
    }

    // 监听主进程桥连接状态（GrainPrint 登录 / 微信打开·登录）。
    // 只更新属性、不替换 bridgeStatus 对象引用，以便 provide/inject 下发给子组件保持响应式。
    // 微信状态仅用于「微信获取订单」弹窗内的提示，不在顶部全局显示。
    if (window.electronAPI && window.electronAPI.onMcpBridgeStatus) {
      this.bridgeStatusCleanup = window.electronAPI.onMcpBridgeStatus((status) => {
        const s = status || {};
        this.bridgeStatus.grainPrintConnected = !!s.grainPrintConnected;
        this.bridgeStatus.loginDisId = s.loginDisId || null;
        this.bridgeStatus.wechat = s.wechat || { open: null, loggedIn: null };
      });
    }

    // 主进程按用户设置的时间直接触发，不经过 WorkBuddy/MCP。
    if (window.electronAPI?.wechatAutoRead?.onTrigger) {
      this._wechatAutoReadCleanup = window.electronAPI.wechatAutoRead.onTrigger((trigger) => {
        this.triggerScheduledWechatAutoRead(trigger);
      });
    }
  },
  
  computed: {
    // 顶部红条：仅保留对所有功能（含打印）都必需的基础状态（GrainPrint 登录）。
    // 微信相关提示刻意不放在全局——只有打开「微信获取订单」弹窗时才显示（见 WechatOrderImportModal），
    // 避免不通过微信下单的配送商/用户被无关的微信警告打扰。
    bridgeBanner() {
      const s = this.bridgeStatus || {};
      if (!s.grainPrintConnected) {
        return { show: true, type: 'error', icon: '⛔', message: 'GrainPrint 未登录：请登录配送商账号后，连接器功能方可使用' };
      }
      return { show: false, type: 'ok', icon: '✅', message: '连接器就绪' };
    },
  },

  methods: {
    triggerScheduledWechatAutoRead(trigger) {
      if (!trigger?.runId) return;
      window.__grainPendingWechatAutoRead = trigger;
      this.$router.push({ name: 'OrderWorkbenchV2' }).then(() => {
        if (this.$route.name !== 'OrderWorkbenchV2' && window.__grainPendingWechatAutoRead?.runId === trigger.runId) {
          window.electronAPI?.wechatAutoRead?.finish?.(trigger.runId);
          window.__grainPendingWechatAutoRead = null;
        }
      }).catch((error) => {
        if (error && error.name !== 'NavigationDuplicated') {
          console.error('[微信自动读取] 进入订单工作台失败:', error);
          window.electronAPI?.wechatAutoRead?.finish?.(trigger.runId);
          window.__grainPendingWechatAutoRead = null;
        }
      });
      window.dispatchEvent(new CustomEvent('grain-wechat-auto-read'));
    },

    /** @param {'ipc'} source */
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
      } else if (task && task.type === 'wechat_order') {
        this.triggerOpenWechatOrders(task);
      } else if (task && task.type === 'wechat_save_orders') {
        this.triggerSaveWechatOrders(task);
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
      // 调度工作台属于持续操作场景，MCP 任务只进入可靠队列，不得抢占当前页面。
      // 用户进入打印中心后，Bills 会按原有 FIFO 流程继续消费，不改变打印实现。
      if (this.$route.name === 'DispatchWorkbench') {
        try {
          if (window.electronAPI && typeof window.electronAPI.rendererConsoleLog === 'function') {
            window.electronAPI.rendererConsoleLog(
              `[MCP] 派单页面保护：taskId=${task.taskId} 已入队，等待进入打印中心后执行`
            );
          }
        } catch (e) {}
        return;
      }
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
    },

    // 触发「打开微信订单工作台 + 全面检查」（由 MCP 任务触发）。
    // 工作台视图(OrderWorkbenchV2)是主窗口内的懒加载视图：先置位待执行标记，
    // 再导航过去；视图挂载后消费该标记运行全面检查。若已在该视图，则直接派发事件。
    triggerOpenWechatOrders(task) {
      const summary = `[MCP] App triggerOpenWechatOrders taskId=${task && task.taskId}`;
      console.log('📲 [MCP] ▼', summary, task);
      try {
        if (window.electronAPI && typeof window.electronAPI.rendererConsoleLog === 'function') {
          window.electronAPI.rendererConsoleLog(summary);
        }
      } catch (e) {}
      // 标记待执行的全面检查，供 OrderWorkbenchV2 挂载后消费（覆盖冷启动导航场景）
      window.__grainPendingWechatScan = true;
      // 用户明确说了「并保存」时，MCP 任务会带 save=true —— 工作台巡查结束后自动逐条保存解析完整的订单；
      // 只说「打开/查看」时不带 save，这里置 false，绝不擅自保存。
      window.__grainAutoSaveWechatOrders = !!(task && task.save);
      // 记录本次 MCP 任务号：工作台巡查结束后据此把结果回报给桥（3011），
      // 让 MCP 侧任务从「已受理」闭环为「已完成/失败」。手动点击全面检查时该值为空，不回报。
      window.__grainMcpWechatScanTaskId = (task && task.taskId) || null;
      this.$router.push({ name: 'OrderWorkbenchV2' }).catch((err) => {
        if (err && err.name !== 'NavigationDuplicated') {
          console.error('📲 [MCP] 进入 OrderWorkbenchV2 失败:', err);
        }
      });
      // 若已在该视图（监听器已就绪），立即派发事件触发全面检查（覆盖已挂载场景）
      window.dispatchEvent(new CustomEvent('grain-mcp-wechat-scan'));
    },

    // MCP「保存微信订单」：进入订单工作台并把本次任务号交给它，
    // 由工作台逐个保存「解析完整」的订单，并把结果回报给桥（3011）。
    triggerSaveWechatOrders(task) {
      const summary = `[MCP] App triggerSaveWechatOrders taskId=${task && task.taskId}`;
      console.log('📲 [MCP] ▼', summary, task);
      try {
        if (window.electronAPI && typeof window.electronAPI.rendererConsoleLog === 'function') {
          window.electronAPI.rendererConsoleLog(summary);
        }
      } catch (e) {}
      window.__grainMcpWechatSaveTaskId = (task && task.taskId) || null;
      this.$router.push({ name: 'OrderWorkbenchV2' }).catch((err) => {
        if (err && err.name !== 'NavigationDuplicated') {
          console.error('📲 [MCP] 进入 OrderWorkbenchV2 失败:', err);
        }
      });
      // 已在视图内时监听器已就绪，立即派发；冷启动场景由工作台挂载后消费待执行标记。
      window.dispatchEvent(new CustomEvent('grain-mcp-wechat-save-orders'));
    }
  },
  
  beforeUnmount() {
    if (typeof this._mcpPrintCleanup === 'function') {
      this._mcpPrintCleanup();
      this._mcpPrintCleanup = null;
    }
    if (typeof this._wechatAutoReadCleanup === 'function') {
      this._wechatAutoReadCleanup();
      this._wechatAutoReadCleanup = null;
    }
    if (typeof this.bridgeStatusCleanup === 'function') {
      this.bridgeStatusCleanup();
      this.bridgeStatusCleanup = null;
    }
    // 清理计时器和事件监听器
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
    }
    this.removeActivityListeners();
  }
};
</script>

<style scoped>
.bridge-status-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
}
.bridge-status-banner .bridge-status-icon {
  font-size: 16px;
  flex-shrink: 0;
}
.bridge-error {
  background: #fdecea;
  color: #b71c1c;
  border-bottom: 2px solid #ef9a9a;
}
.bridge-ok {
  background: #e8f5e9;
  color: #1b5e20;
  border-bottom: 2px solid #a5d6a7;
}
</style>

