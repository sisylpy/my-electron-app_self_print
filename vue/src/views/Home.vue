<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-logo">
        <b>请用微信扫描</b>
      </div>
      <div class="login-box-body">
        <p class="login-box-msg">京采接单小程序登录</p>

        <!-- 显示二维码或错误信息 -->
        <div class="qr-code-container">
          <img v-if="qrCodeUrl && !showMarketError" :src="qrCodeUrl" alt="扫码登录" class="qr-code" />
          
        <!-- 市场不匹配错误 -->
        <div v-if="showMarketError" class="market-error">
          <div class="error-icon">⚠️</div>
          <h3>设备配置不匹配</h3>
          <p>当前设备配置与您的市场不匹配</p>
          <p>请联系管理员重新配置设备</p>
          
          
          <div class="countdown">
            <p>{{ countdown }}秒后自动返回上一页</p>
          </div>
          <button class="retry-btn" @click="restartLogin">重新登录</button>
        </div>
        </div>

        <!-- 登录提示 -->
        <p class="login-instructions" @click="goScreen">退出登录</p>
      </div>
    </div>
  </div>
</template>

<script>

import api from '../api/all.js'
import QRCode from 'qrcode'


export default {
  name: "Home",
  data() {
    return {
      qrCodeUrl: '',  // 保存二维码生成的 URL
      sessionId: '',  // 会话ID
      pollInterval: null,  // 保存定时器ID
      pollStartTime: null, // 轮询开始时间
      showMarketError: false, // 显示市场不匹配错误
      countdown: 10, // 倒计时秒数
      countdownTimer: null, // 倒计时定时器
    }
  },

  beforeUnmount() {
  // 清除定时器，防止内存泄漏
  if (this.pollInterval) {
    console.log("清除轮询定时器，防止内存泄漏")
    clearInterval(this.pollInterval);
  }
  if (this.countdownTimer) {
    console.log("清除倒计时定时器，防止内存泄漏")
    clearInterval(this.countdownTimer);
  }
},

mounted() {
  // 重置所有状态
  this.showMarketError = false;
  this.countdown = 10;
  
  this.generateQRCode();  // 页面加载后生成二维码
  this.startPolling();    // 启动轮询
},

  methods: {
    goScreen() {
      this.$router.back(); // 返回上一页
      // 如果您想返回特定页面，可以使用：
      // this.$router.push({ name: 'SomePage' });
    },
  
    generateQRCode() {
      this.sessionId = this.generateUniqueSessionId();  // 生成唯一会话 ID
      const qrCodeUrl = `https://grainservice.club:8443/nongxinle/api/nxdistributer/printerLogin?scene=${this.sessionId}`;
      
      QRCode.toDataURL(qrCodeUrl, (err, qrCodeUrl) => {
        if (err) {
          console.error('二维码生成失败', err)
        } else {
          this.qrCodeUrl = qrCodeUrl;  // 设置二维码 URL
        }
      })
    },

    // 生成唯一的 sessionId
    generateUniqueSessionId() {
      return `session-${Math.random().toString(36).substr(2, 9)}`;  // 简单的唯一 ID 生成方式
    },

    // 启动轮询检查登录状态
    startPolling() {
      this.pollStartTime = Date.now();  // 记录轮询开始的时间
      const sessionId = this.sessionId;
      this.pollForUserInfo(sessionId);
    },


    pollForUserInfo(sessionId) {
  this.pollInterval = setInterval(() => {
    // 检查是否超过 1 分钟
    const currentTime = Date.now();
    if (currentTime - this.pollStartTime >= 60000) {
      // 超过 1 分钟，停止轮询并返回上一页
      clearInterval(this.pollInterval);
      // alert('登录超时，返回上一页');
      this.$router.back();
      return;
    }

    // 继续检查登录状态
    api.checkLoginStatus(sessionId,{ showLoading: false }).then((response) => {
      const data = response.data;
      if (data.loggedIn) {
        console.log('用户登录成功，用户ID:', data.user);
        
        // 🔍 检查设备配置缓存和市场ID验证
        const deviceConfig = localStorage.getItem('deviceAdminConfig');
        
        // 详细检查用户数据结构
        console.log('🔍 用户数据结构:', data.user);
        console.log('🔍 nxDistributerEntity:', data.user.nxDistributerEntity);
        console.log('🔍 nxDistributerSysMarketId:', data.user.nxDistributerEntity?.nxDistributerSysMarketId);
        
        // 尝试多种可能的字段路径
        const userMarketId = data.user.nxDistributerEntity?.nxDistributerSysMarketId || 
                            data.user.nxDistributerSysMarketId || 
                            data.user.marketId ||
                            data.user.nxMarketId;
        
        console.log('🔍 验证开始:');
        console.log('  - 设备配置存在:', !!deviceConfig);
        console.log('  - 用户市场ID:', userMarketId);
        
        if (deviceConfig) {
          try {
            const config = JSON.parse(deviceConfig);
            const configMarketId = config.deviceAdminInfo?.marketId;
            
            console.log('📋 用户市场ID:', userMarketId, '类型:', typeof userMarketId);
            console.log('📋 设备配置市场ID:', configMarketId, '类型:', typeof configMarketId);
            
            // 转换为字符串进行比较
            const userMarketIdStr = String(userMarketId);
            const configMarketIdStr = String(configMarketId);
            console.log('📋 转换后用户市场ID:', userMarketIdStr);
            console.log('📋 转换后设备配置市场ID:', configMarketIdStr);
            
            
            // 更严格的验证：必须有设备配置且用户市场ID存在
            if (!configMarketId) {
              console.log('❌ 设备未配置市场ID，阻止登录');
              this.showMarketMismatchError();
              this.startCountdown();
              return;
            }
            
            if (!userMarketId) {
              console.log('❌ 用户市场ID为空，阻止登录');
              this.showMarketMismatchError();
              this.startCountdown();
              return;
            }
            
            if (configMarketIdStr !== userMarketIdStr) {
              console.log('❌ 市场ID不匹配，显示10秒倒计时');
              console.log('❌ 比较结果:', configMarketIdStr, '!==', userMarketIdStr);
              // 停止轮询
              clearInterval(this.pollInterval);
              // 显示错误信息并开始倒计时
              this.showMarketMismatchError();
              this.startCountdown();
              return; // 阻止登录
            } else if (configMarketIdStr === userMarketIdStr) {
              console.log('✅ 市场ID匹配，允许登录');
              console.log('✅ 比较结果:', configMarketIdStr, '===', userMarketIdStr);
            }
          } catch (error) {
            console.error('❌ 解析设备配置失败:', error);
            localStorage.removeItem('deviceAdminConfig');
            // 配置解析失败也阻止登录
            this.showMarketMismatchError();
            this.startCountdown();
            return;
          }
        } else {
          console.log('✅ 无设备配置缓存，直接允许登录');
          // 没有设备配置，直接允许登录
        }
        
        // 只有验证通过才能继续登录流程
        console.log('✅ 市场ID验证通过，继续登录流程');
        
        // 用户登录成功，停止轮询
        clearInterval(this.pollInterval);
        this.$store.commit('SET_DISUSER', data.user);
        this.$router.push({
          name: 'Bills',
          query: {
            disId: data.user.nxDiuDistributerId,
            disName: data.user.nxDistributerEntity.nxDistributerName
          }
        });
      } else {
        console.log('用户未登录，继续轮询...');
      }
    }).catch(error => {
      console.error('检查登录状态失败:', error);
    });
  }, 5000);  // 每 5 秒轮询一次
},

    // 定义轮询函数
    pollForUserInfo0(sessionId) {
      this.pollInterval = setInterval(() => {
        api.checkLoginStatus(sessionId).then((response) => {
          const data = response.data;
          if (data.loggedIn) {
            console.log('用户登录成功，用户ID:', data.user);
            // 用户登录成功，停止轮询
            clearInterval(this.pollInterval);
            this.$store.commit('SET_DISUSER', data.user);
            this.$router.push({ name: 'Bills', query: { disId: data.user.nxDiuDistributerId, disName: data.user.nxDistributerEntity.nxDistributerName} });
          } else {
            console.log('用户未登录，继续轮询...');
          }
        }).catch(error => {
          console.error('检查登录状态失败:', error);
        });
      }, 5000);  // 每 5 秒轮询一次
    },

    // 显示市场不匹配错误
    showMarketMismatchError() {
      this.showMarketError = true;
      // 不清空二维码，让用户能看到二维码
    },

    // 开始10秒倒计时
    startCountdown() {
      this.countdown = 10;
      this.countdownTimer = setInterval(() => {
        this.countdown--;
        if (this.countdown <= 0) {
          clearInterval(this.countdownTimer);
          console.log('⏰ 倒计时结束，返回上一页');
          this.$router.back(); // 返回到 Screen.vue
        }
      }, 1000);
    },

    // 重新开始登录
    restartLogin() {
      this.showMarketError = false;
      this.countdown = 10;
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
      }
      this.generateQRCode();
      this.startPolling();
    },

  },

  beforeUnmount() {
    // 清除定时器，防止内存泄漏
    if (this.pollInterval) {
      console.log("清除定时器，防止内存泄漏")
      clearInterval(this.pollInterval);
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  },
}
</script>

<style scoped>
/* 设置背景渐变和屏幕居中 */
.login-container {
  background: linear-gradient(to right, #6a11cb, #2575fc);
  /* 渐变色 */
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}

/* 登录框样式 */
.login-box {
  background-color: rgba(255, 255, 255, 0.9);
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  width: 350px;
  text-align: center;
}

/* 登录框标题 */
.login-logo b {
  font-size: 24px;
  color: #333;
  font-weight: bold;
  margin-bottom: 10px;
  display: block;
}

/* 登录框内容 */
.login-box-body {
  margin-top: 20px;
}

/* 二维码容器 */
.qr-code-container {
  margin: 20px 0;
}

/* 二维码样式 */
.qr-code {
  width: 150px;
  height: 150px;
  object-fit: contain;
  margin-bottom: 10px;
}

/* 市场错误样式 */
.market-error {
  text-align: center;
  padding: 20px;
  background-color: #fff5f5;
  border: 2px solid #f56565;
  border-radius: 8px;
  margin: 10px 0;
}

.debug-info {
  margin: 20px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 5px;
  text-align: left;
  font-size: 12px;
  border: 1px solid #dee2e6;
}

.debug-info h4 {
  margin: 0 0 10px 0;
  color: #495057;
  font-size: 14px;
}

.debug-info p {
  margin: 5px 0;
  color: #6c757d;
}

.debug-info strong {
  color: #495057;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.market-error h3 {
  color: #e53e3e;
  margin: 10px 0;
  font-size: 18px;
}

.market-error p {
  color: #666;
  margin: 5px 0;
  font-size: 14px;
}

.retry-btn {
  background-color: #3182ce;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 15px;
}

.retry-btn:hover {
  background-color: #2c5aa0;
}

.countdown {
  margin: 15px 0;
  padding: 10px;
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 5px;
}

.countdown p {
  color: #856404;
  font-weight: bold;
  margin: 0;
}

/* 登录提示文字 */
.login-instructions {
  font-size: 14px;
  color: #666;
  margin-top: 10px;
}

/* 响应式设计：适配不同屏幕尺寸 */
@media (max-width: 400px) {
  .login-box {
    width: 90%;
    padding: 20px;
  }

  .qr-code {
    width: 120px;
    height: 120px;
  }
}
</style>