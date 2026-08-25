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

        <div class="test-login-divider"><span>测试服务器临时入口</span></div>
        <form class="test-login" @submit.prevent="loginWithTestUserId">
          <label for="test-distributer-user-id">配送商用户 ID</label>
          <div class="test-login__controls">
            <input
              id="test-distributer-user-id"
              v-model.trim="testUserId"
              type="text"
              inputmode="numeric"
              autocomplete="off"
              maxlength="10"
              placeholder="例如：312"
              :disabled="testLoggingIn"
            />
            <button type="submit" :disabled="testLoggingIn || !testUserId">
              {{ testLoggingIn ? '登录中…' : '直接登录' }}
            </button>
          </div>
          <p v-if="testLoginError" class="test-login__error">{{ testLoginError }}</p>
        </form>

        <!-- 登录提示 -->
        <p class="login-instructions" @click="goScreen">退出登录</p>
      </div>
    </div>
  </div>
</template>

<script>

import api from '../api/all.js'
import QRCode from 'qrcode'
import { defaultRouteNameForUser } from '@/utils/disUserRole'
import config from '@/config'


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
      testUserId: '',
      testLoggingIn: false,
      testLoginError: '',
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
      const qrCodeUrl = `${config.baseURL}nxdistributer/printerLogin?scene=${this.sessionId}`;
      
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
      // await this.$refs.alertDialog.alert('', 'warning');
      this.$router.back();
      return;
    }

    // 继续检查登录状态
    api.checkLoginStatus(sessionId,{ showLoading: false }).then(async (response) => {
      const data = response.data;
      if (data.loggedIn) {
        await this.completeLogin(data.user, data.dispatchAuth);
      } else {
        console.log('用户未登录，继续轮询...');
      }
    }).catch(error => {
      console.error('检查登录状态失败:', error);
    });
  }, 5000);  // 每 5 秒轮询一次
},

    async loginWithTestUserId() {
      this.testLoginError = '';
      const userId = Number(this.testUserId);
      if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) {
        this.testLoginError = '请输入正确的配送商用户 ID';
        return;
      }
      const testLogin = window.electronAPI?.userSession?.testLogin;
      if (typeof testLogin !== 'function') {
        this.testLoginError = '请在 Electron 桌面端使用测试登录';
        return;
      }

      this.testLoggingIn = true;
      try {
        const result = await testLogin(userId);
        if (!result?.ok || !result.data?.user) {
          this.testLoginError = result?.message || '测试登录失败';
          return;
        }
        const accepted = await this.completeLogin(result.data.user, null, true);
        if (!accepted) {
          await window.electronAPI?.userSession?.logout?.();
        }
      } catch (error) {
        this.testLoginError = error?.message || '测试登录失败，请检查测试服务器';
      } finally {
        this.testLoggingIn = false;
      }
    },

    async completeLogin(user, dispatchAuth = null, dispatchSessionAlreadyStored = false) {
      if (!user?.nxDistributerUserId || !user?.nxDiuDistributerId
          || !user?.nxDistributerEntity) {
        this.testLoginError = '服务器返回的用户信息不完整';
        return false;
      }
      const deviceConfig = localStorage.getItem('deviceAdminConfig');
      const userMarketId = user.nxDistributerEntity?.nxDistributerSysMarketId
        || user.nxDistributerSysMarketId
        || user.marketId
        || user.nxMarketId;

      if (deviceConfig) {
        try {
          const storedConfig = JSON.parse(deviceConfig);
          const configMarketId = storedConfig.deviceAdminInfo?.marketId;
          if (!configMarketId || !userMarketId
              || String(configMarketId) !== String(userMarketId)) {
            this.stopPolling();
            this.showMarketMismatchError();
            this.startCountdown();
            return false;
          }
        } catch (error) {
          console.error('解析设备配置失败:', error);
          localStorage.removeItem('deviceAdminConfig');
          this.stopPolling();
          this.showMarketMismatchError();
          this.startCountdown();
          return false;
        }
      }

      this.stopPolling();

      // 原扫码登录同时完成调度授权。老板的短期令牌交给 Electron
      // 主进程校验和保存；文员登录时主动清除之前可能残留的老板授权。
      const dispatchApi = window.electronAPI?.dispatchAuth;
      if (!dispatchSessionAlreadyStored && dispatchApi) {
        if (Number(user.nxDiuAdmin) === 0 && dispatchAuth?.accessToken) {
          const authResult = await dispatchApi.adoptLoginSession?.(dispatchAuth, {
            persistSession: false,
          });
          if (!authResult?.ok) {
            console.warn('[desktop-login] 调度授权保存失败:', authResult?.message);
            await dispatchApi.logout?.();
          }
        } else {
          await dispatchApi.logout?.();
        }
      }

      this.$store.commit('SET_DISUSER', user);
      const requestedRoute = this.$route.query?.returnTo;
      const targetRoute = requestedRoute === 'DispatchWorkbench'
        && Number(user.nxDiuAdmin) === 0
        ? 'DispatchWorkbench'
        : defaultRouteNameForUser(user);
      await this.$router.push({
        name: targetRoute,
        query: {
          disId: user.nxDiuDistributerId,
          disName: user.nxDistributerEntity.nxDistributerName,
        },
      });
      return true;
    },

    stopPolling() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
        this.pollInterval = null;
      }
    },

    // 定义轮询函数
    pollForUserInfo0(sessionId) {
      this.pollInterval = setInterval(() => {
        api.checkLoginStatus(sessionId).then(async (response) => {
          const data = response.data;
          if (data.loggedIn) {
            await this.completeLogin(data.user, data.dispatchAuth);
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
      this.stopPolling();
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

.test-login-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0 12px;
  color: #718078;
  font-size: 12px;
}

.test-login-divider::before,
.test-login-divider::after {
  height: 1px;
  flex: 1;
  background: #dce5e0;
  content: '';
}

.test-login {
  padding: 14px;
  border: 1px solid #cfe3d9;
  border-radius: 8px;
  background: #f5faf7;
  text-align: left;
}

.test-login label {
  display: block;
  margin-bottom: 8px;
  color: #345447;
  font-size: 13px;
  font-weight: 700;
}

.test-login__controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px;
  gap: 8px;
}

.test-login input,
.test-login button {
  box-sizing: border-box;
  height: 38px;
  border-radius: 6px;
  font-size: 14px;
}

.test-login input {
  min-width: 0;
  padding: 0 11px;
  border: 1px solid #cbd8d1;
  outline: none;
  background: #fff;
}

.test-login input:focus {
  border-color: #15945d;
  box-shadow: 0 0 0 3px rgba(21, 148, 93, .1);
}

.test-login button {
  border: 1px solid #15945d;
  color: #fff;
  background: #15945d;
  cursor: pointer;
  font-weight: 700;
}

.test-login button:disabled {
  border-color: #a8c8b8;
  background: #a8c8b8;
  cursor: not-allowed;
}

.test-login__error {
  margin: 8px 0 0;
  color: #b9473d;
  font-size: 12px;
  line-height: 1.5;
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


