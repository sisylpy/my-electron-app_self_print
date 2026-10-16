<template>
  <div class="login-container">
    <LoginStoryPanel />

    <main class="login-panel">
      <section class="login-box" aria-labelledby="login-title">
        <header class="login-heading">
          <span class="login-heading__icon" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <path d="M7 11.8A7.8 7.8 0 0 1 14.8 4h2.4A7.8 7.8 0 0 1 25 11.8v2.6a7.8 7.8 0 0 1-7.8 7.8H16l-4.5 3.5v-4A7.8 7.8 0 0 1 7 14.4z" />
              <circle cx="13" cy="13" r="1.3" />
              <circle cx="19" cy="13" r="1.3" />
            </svg>
          </span>
          <span>
            <strong>微信安全登录</strong>
            <small>配送商桌面端</small>
          </span>
        </header>
        <div class="login-box-body">
          <h2 id="login-title">微信扫码登录</h2>
          <p class="login-box-msg">请使用微信扫一扫，确认后自动进入“录单”工作台</p>

        <div class="qr-code-container" :class="{ 'has-error': showMarketError }">
          <template v-if="!showMarketError">
            <span class="qr-corner corner-one"></span>
            <span class="qr-corner corner-two"></span>
            <span class="qr-corner corner-three"></span>
            <span class="qr-corner corner-four"></span>
            <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="微信扫码登录二维码" class="qr-code" />
            <div v-else class="qr-loading" role="status" aria-label="正在生成二维码">
              <i></i><span>正在生成二维码</span>
            </div>
            <span v-if="qrCodeUrl" class="scan-line" aria-hidden="true"></span>
          </template>

          <div v-else class="market-error" role="alert">
            <span class="error-icon" aria-hidden="true">!</span>
            <h3>这台电脑与账号不匹配</h3>
            <p>当前账号不属于这台电脑配置的配送市场，请联系管理员检查设备配置。</p>
            <div class="countdown">{{ countdown }} 秒后自动返回</div>
            <button class="retry-btn" type="button" @click="restartLogin">换一个账号登录</button>
          </div>
        </div>

        <div v-if="!showMarketError" class="login-status">
          <span><i></i>二维码仅用于本次登录</span>
          <button type="button" @click="restartLogin">刷新二维码</button>
        </div>

        <p v-if="loginNotice" class="login-notice" role="status">{{ loginNotice }}</p>
        <p v-if="loginError" class="test-login__error login-error" role="alert">{{ loginError }}</p>
        <div v-if="showTestLogin" class="test-login-divider"><span>测试服务器临时入口</span></div>
        <form v-if="showTestLogin" class="test-login" @submit.prevent="loginWithTestUserId">
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

        <footer class="login-help">
          <span>打开微信 → 扫一扫 → 确认登录</span>
          <button type="button" @click="goScreen">返回</button>
        </footer>
        </div>
      </section>
      <p class="login-panel__footer">安全登录 · 订单数据只在授权后读取</p>
    </main>
  </div>
</template>

<script>

import api from '../api/all.js'
import axiosInstance from '../api/axios.js'
import QRCode from 'qrcode'
import { defaultRouteNameForUser } from '@/utils/disUserRole'
import config from '@/config'
import { desktopOrderSessionRequest, isPackagedDesktop } from '@/api/desktopOrderSession'
import LoginStoryPanel from '@/components/login/LoginStoryPanel.vue'


export default {
  name: "Home",
  components: { LoginStoryPanel },
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
      loginError: '',
      loginNotice: '',
      showTestLogin: ['development', 'test'].includes(import.meta.env.VITE_RUNTIME_MODE),
    }
  },

mounted() {
  // 重置所有状态
  this.showMarketError = false;
  this.countdown = 10;
  this.loginNotice = this.$route.query.reason === 'session-expired'
    ? '登录状态已失效，请重新用微信扫码登录'
    : (this.$route.query.reason === 'login-required' ? '请先用微信扫码登录' : '');
  
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
    const statusRequest = isPackagedDesktop()
      ? desktopOrderSessionRequest('pollLogin', sessionId)
      : api.checkLoginStatus(sessionId, { showLoading: false });
    statusRequest.then(async (response) => {
      const data = response.data;
      this.loginError = '';
      if (data.loggedIn) {
        if (!await this.completeLogin(data.user, data.dispatchAuth)) {
          this.loginError = this.testLoginError || '登录失败，请重新扫码';
          await this.clearOrderSession();
        }
      } else {
        console.log('用户未登录，继续轮询...');
      }
    }).catch(error => {
      console.error('检查登录状态失败:', error);
      this.loginError = error?.message || '登录服务暂不可用，请稍后重试';
    });
  }, 5000);  // 每 5 秒轮询一次
},

    async loginWithTestUserId() {
      if (!this.showTestLogin) return;
      this.testLoginError = '';
      const userId = Number(this.testUserId);
      if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) {
        this.testLoginError = '请输入正确的配送商用户 ID';
        return;
      }
      const testLogin = window.electronAPI?.userSession?.testLogin;
      this.testLoggingIn = true;
      try {
        let desktopSessionStored = false;
        if (typeof testLogin === 'function') {
          const result = await testLogin(userId);
          if (!result?.ok || !result.data?.user) {
            this.testLoginError = result?.message || '测试登录失败';
            return;
          }
          desktopSessionStored = true;
        }
        // 测试开关只由服务器决定。网页会话由同源响应设置 HttpOnly Cookie；
        // 不把 Electron 主进程保存的调度令牌交给页面。
        const response = await axiosInstance.post('desktop-test-login/v1/browser-session',
          { userId }, { showLoading: false });
        const user = response?.data?.data;
        if (Number(response?.data?.code) !== 0 || !user) {
          throw new Error(response?.data?.msg || '测试订单会话建立失败');
        }
        const accepted = await this.completeLogin(user, null, desktopSessionStored);
        if (!accepted) {
          await this.clearOrderSession();
          await window.electronAPI?.userSession?.logout?.();
        }
      } catch (error) {
        await this.clearOrderSession();
        await window.electronAPI?.userSession?.logout?.();
        this.testLoginError = error?.response?.data?.msg || error?.message
          || '测试登录失败，请检查测试服务器及测试登录开关';
      } finally {
        this.testLoggingIn = false;
      }
    },

    async clearOrderSession() {
      try {
        if (isPackagedDesktop()) {
          await desktopOrderSessionRequest('logout');
        } else {
          await axiosInstance.post('nxdistributeruser/logoutDesktopOrderSession', null,
            { showLoading: false });
        }
      } catch (error) {
        console.warn('[desktop-login] 订单网页会话清理失败:', error?.message);
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

      // 原桌面登录同时建立内部调度会话，不再要求用户进入派单页后二次扫码。
      // 老板的短期令牌只交给 Electron 主进程校验并安全保存。
      const dispatchApi = window.electronAPI?.dispatchAuth;
      const isOwner = Number(user.nxDiuAdmin) === 0;
      if (!dispatchSessionAlreadyStored && isOwner && window.electronAPI) {
        if (!dispatchAuth?.accessToken || typeof dispatchApi?.adoptLoginSession !== 'function') {
          this.testLoginError = '桌面登录信息不完整，请重新登录';
          await window.electronAPI?.userSession?.logout?.();
          return false;
        }
        const authResult = await dispatchApi.adoptLoginSession(dispatchAuth, {
          // 令牌由 Electron safeStorage 加密保存，重启后仍可自动恢复地图与调度能力。
          persistSession: true,
        });
        if (!authResult?.ok) {
          console.warn('[desktop-login] 内部调度会话保存失败:', authResult?.message);
          this.testLoginError = authResult?.message || '桌面登录状态保存失败，请重新登录';
          await window.electronAPI?.userSession?.logout?.();
          return false;
        }
      }
      // 浏览器预览没有 Electron 主进程；扫码轮询已在服务端绑定只读订单会话，
      // 不把调度 Bearer 交给浏览器或存进 localStorage。

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
            if (!await this.completeLogin(data.user, data.dispatchAuth)) {
              await this.clearOrderSession();
            }
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
      this.stopPolling();
      this.showMarketError = false;
      this.loginError = '';
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

.login-notice {
  margin: 10px 0 0;
  padding: 9px 12px;
  border: 1px solid #b8dfcc;
  border-radius: 8px;
  color: #116c46;
  background: #eefaf4;
  font-size: 14px;
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

<style scoped>
.login-container {
  display: grid;
  grid-template-columns: minmax(520px, 1fr) minmax(410px, 520px);
  width: 100%;
  min-width: 0;
  height: 100vh;
  min-height: 560px;
  overflow: hidden;
  color: #1e3429;
  background:
    radial-gradient(circle at 9% 10%, rgba(255, 233, 211, .72), transparent 28%),
    radial-gradient(circle at 78% 8%, rgba(195, 231, 214, .52), transparent 30%),
    linear-gradient(135deg, #fbfaf6 0%, #f2f7f3 52%, #edf5f1 100%);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.login-panel {
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 38px clamp(30px, 4vw, 58px) 24px;
  border-left: 1px solid rgba(46, 85, 65, .08);
  background: rgba(247, 250, 248, .7);
  backdrop-filter: blur(22px);
}

.login-box {
  box-sizing: border-box;
  width: min(100%, 424px);
  padding: 30px 34px 25px;
  border: 1px solid rgba(40, 82, 60, .09);
  border-radius: 28px;
  background: rgba(255, 255, 255, .94);
  box-shadow: 0 28px 70px rgba(34, 71, 52, .13), 0 4px 14px rgba(34, 71, 52, .05);
  text-align: center;
}

.login-heading {
  display: flex;
  align-items: center;
  gap: 11px;
  text-align: left;
}

.login-heading__icon {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 13px;
  color: #fff;
  background: linear-gradient(145deg, #1aae69, #087847);
  box-shadow: 0 9px 22px rgba(12, 127, 75, .2);
  place-items: center;
}

.login-heading__icon svg {
  width: 26px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.login-heading strong,
.login-heading small { display: block; }
.login-heading strong { color: #244236; font-size: 15px; font-weight: 800; }
.login-heading small { margin-top: 2px; color: #91a098; font-size: 10px; letter-spacing: .12em; }

.login-box-body { margin-top: 22px; }
.login-box-body h2 { margin: 0; color: #172e23; font-size: 27px; font-weight: 850; letter-spacing: -.02em; }
.login-box-msg { max-width: 310px; margin: 9px auto 0; color: #78877f; font-size: 13px; line-height: 1.65; }

.qr-code-container {
  position: relative;
  display: grid;
  box-sizing: border-box;
  width: 222px;
  height: 222px;
  margin: 21px auto 13px;
  padding: 18px;
  overflow: hidden;
  border: 1px solid #e5ece8;
  border-radius: 22px;
  background: #fff;
  place-items: center;
}

.qr-code-container.has-error {
  width: 100%;
  height: auto;
  min-height: 260px;
  padding: 22px;
  border-color: #f0d9d3;
  background: #fffaf8;
}

.qr-code { width: 184px; height: 184px; margin: 0; object-fit: contain; }
.qr-corner { position: absolute; z-index: 2; width: 23px; height: 23px; border-color: #139d5f; border-style: solid; }
.corner-one { top: 8px; left: 8px; border-width: 2px 0 0 2px; border-radius: 8px 0 0; }
.corner-two { top: 8px; right: 8px; border-width: 2px 2px 0 0; border-radius: 0 8px 0 0; }
.corner-three { bottom: 8px; left: 8px; border-width: 0 0 2px 2px; border-radius: 0 0 0 8px; }
.corner-four { right: 8px; bottom: 8px; border-width: 0 2px 2px 0; border-radius: 0 0 8px; }
.scan-line { position: absolute; z-index: 3; top: 24px; right: 22px; left: 22px; height: 2px; border-radius: 99px; background: linear-gradient(90deg, transparent, #20bd73 18%, #20bd73 82%, transparent); box-shadow: 0 0 9px rgba(32, 189, 115, .48); animation: qr-scan 3.2s ease-in-out infinite; }

.qr-loading { display: grid; gap: 13px; color: #85958d; font-size: 12px; place-items: center; }
.qr-loading i { width: 30px; height: 30px; border: 3px solid #dbe8e1; border-top-color: #119b5d; border-radius: 50%; animation: qr-spin .8s linear infinite; }

.login-status { display: flex; align-items: center; justify-content: space-between; gap: 10px; color: #84928b; font-size: 11px; }
.login-status span { display: inline-flex; align-items: center; gap: 6px; }
.login-status span i { width: 6px; height: 6px; border-radius: 50%; background: #20af69; box-shadow: 0 0 0 4px rgba(32, 175, 105, .1); }
.login-status button, .login-help button { padding: 0; border: 0; color: #178858; background: transparent; font: inherit; cursor: pointer; }
.login-status button:hover, .login-help button:hover { color: #096c41; }

.login-notice, .login-error {
  margin: 12px 0 0;
  padding: 9px 12px;
  border: 1px solid #c4e4d4;
  border-radius: 9px;
  color: #106a44;
  background: #eff9f4;
  font-size: 12px;
  line-height: 1.5;
}
.login-error { border-color: #f0d3ce; color: #a8473d; background: #fff6f4; }

.market-error { margin: 0; padding: 2px 0; border: 0; background: transparent; }
.error-icon { display: grid; width: 43px; height: 43px; margin: 0 auto 12px; border-radius: 50%; color: #fff; background: #d96b59; font-size: 23px; font-weight: 850; place-items: center; }
.market-error h3 { margin: 0; color: #6e3029; font-size: 18px; }
.market-error p { max-width: 285px; margin: 9px auto 0; color: #866a65; font-size: 12px; line-height: 1.7; }
.countdown { margin: 12px 0 0; padding: 0; border: 0; color: #a4774b; background: transparent; font-size: 11px; }
.retry-btn { height: 37px; margin-top: 15px; padding: 0 17px; border: 0; border-radius: 10px; color: #fff; background: #15965b; font-size: 12px; font-weight: 750; cursor: pointer; }
.retry-btn:hover { background: #0c7c49; }

.test-login-divider { display: flex; align-items: center; gap: 10px; margin: 14px 0 12px; color: #84938b; font-size: 11px; }
.test-login-divider::before, .test-login-divider::after { height: 1px; flex: 1; background: #e1e9e5; content: ''; }
.test-login { padding: 13px; border: 1px solid #d4e5dc; border-radius: 11px; background: #f6faf8; text-align: left; }
.test-login label { display: block; margin-bottom: 7px; color: #3a5d4c; font-size: 12px; font-weight: 700; }
.test-login__controls { display: grid; grid-template-columns: minmax(0, 1fr) 88px; gap: 8px; }
.test-login input, .test-login button { box-sizing: border-box; height: 36px; border-radius: 8px; font-size: 12px; }
.test-login input { min-width: 0; padding: 0 10px; border: 1px solid #cddbd4; outline: none; background: #fff; }
.test-login input:focus { border-color: #15945d; box-shadow: 0 0 0 3px rgba(21, 148, 93, .1); }
.test-login button { border: 1px solid #15945d; color: #fff; background: #15945d; cursor: pointer; font-weight: 700; }
.test-login button:disabled { border-color: #a8c8b8; background: #a8c8b8; cursor: not-allowed; }
.test-login__error { margin: 8px 0 0; color: #b9473d; font-size: 11px; line-height: 1.5; }

.login-help { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px; padding-top: 16px; border-top: 1px solid #edf1ef; color: #89968f; font-size: 11px; }
.login-panel__footer { margin: 20px 0 0; color: #95a099; font-size: 10px; letter-spacing: .03em; }

@keyframes qr-spin { to { transform: rotate(360deg); } }
@keyframes qr-scan { 0%, 100% { opacity: .35; transform: translateY(0); } 50% { opacity: .95; transform: translateY(170px); } }

@media (max-height: 760px) and (min-width: 781px) {
  .login-panel { padding-top: 20px; padding-bottom: 14px; }
  .login-box { padding: 22px 29px 20px; border-radius: 23px; }
  .login-box-body { margin-top: 14px; }
  .login-box-body h2 { font-size: 24px; }
  .qr-code-container { width: 190px; height: 190px; margin-top: 13px; padding: 15px; }
  .qr-code { width: 158px; height: 158px; }
  .scan-line { right: 19px; left: 19px; animation-name: qr-scan-compact; }
  .login-help { margin-top: 12px; padding-top: 12px; }
  .login-panel__footer { margin-top: 11px; }
}

@keyframes qr-scan-compact { 0%, 100% { opacity: .35; transform: translateY(0); } 50% { opacity: .95; transform: translateY(138px); } }

@media (max-width: 980px) {
  .login-container { grid-template-columns: minmax(400px, 1fr) minmax(360px, 430px); }
  .login-panel { padding-right: 28px; padding-left: 28px; }
}

@media (max-width: 780px) {
  .login-container { grid-template-columns: 1fr; grid-template-rows: minmax(255px, 35vh) minmax(0, 1fr); min-height: 700px; overflow: auto; }
  .login-panel { justify-content: flex-start; padding: 22px 28px 28px; border-top: 1px solid rgba(46, 85, 65, .08); border-left: 0; }
  .login-box { width: min(100%, 500px); }
}

@media (max-width: 560px) {
  .login-container { grid-template-rows: 210px minmax(0, 1fr); min-height: 650px; }
  .login-panel { padding: 17px 16px 24px; }
  .login-box { padding: 20px 22px 18px; border-radius: 22px; }
  .login-heading { display: none; }
  .login-box-body { margin-top: 0; }
  .login-box-body h2 { font-size: 23px; }
  .qr-code-container { width: 188px; height: 188px; margin-top: 13px; padding: 15px; }
  .qr-code { width: 156px; height: 156px; }
  .scan-line { right: 19px; left: 19px; animation-name: qr-scan-compact; }
  .login-panel__footer { display: none; }
}

@media (prefers-reduced-motion: reduce) {
  .scan-line, .qr-loading i { animation: none; }
}
</style>


