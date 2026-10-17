import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appVue = fs.readFileSync(path.join(root, 'vue/src/App.vue'), 'utf8');
const homeVue = fs.readFileSync(path.join(root, 'vue/src/views/Home.vue'), 'utf8');

const IDLE_MARKERS = [
  'inactivityTimer',
  'inactivityTimeout',
  'lastActivityTime',
  'startInactivityTimer',
  'addActivityListeners',
  'resetInactivityTimer',
  'handleInactivityTimeout',
  'removeActivityListeners',
];

test('App.vue 已彻底移除闲置超时退出机制', () => {
  for (const marker of IDLE_MARKERS) {
    assert.ok(!appVue.includes(marker), `App.vue 仍残留闲置退出代码：${marker}`);
  }
  assert.ok(!/setInterval|setTimeout/.test(appVue), 'App.vue 不应再持有计时器');
  assert.ok(!appVue.includes("mouseover") && !appVue.includes("'mousemove'"),
    'App.vue 不应再监听用户活动事件');
});

test('闲置超时不再清除登录用户', () => {
  assert.ok(!appVue.includes("SET_DISUSER', null"), '不应再有闲置清除登录用户');
  assert.ok(!appVue.includes("removeItem('disUser')"), '不应再有闲置清除本地登录缓存');
  assert.ok(!appVue.includes("name: 'Screen'"), '不应再有闲置跳转初始页');
});

test('删除后 App.vue 仍保留有效的挂载与清理逻辑', () => {
  assert.ok(appVue.includes('mounted()'), 'mounted 生命周期仍在');
  assert.ok(appVue.includes('beforeUnmount()'), 'beforeUnmount 生命周期仍在');
  assert.ok(appVue.includes('onGetDeviceConfig'), '设备配置监听不应被误删');
  assert.ok(appVue.includes('_mcpPrintCleanup'), 'MCP 清理不应被误删');
  assert.ok(appVue.includes('bridgeStatusCleanup'), '桥状态清理不应被误删');
  // 大括号必须配对，防止删代码块时留下残缺结构
  const opens = (appVue.match(/{/g) || []).length;
  const closes = (appVue.match(/}/g) || []).length;
  assert.equal(opens, closes, 'App.vue 大括号必须配对');
});

test('扫码登录页自身的二维码轮询超时保留，未被误删', () => {
  assert.ok(homeVue.includes('pollInterval'), '扫码轮询定时器保留');
  assert.ok(homeVue.includes('pollStartTime'), '扫码轮询超时判断保留');
});

test('会话续期相关文件未被本次改动破坏', () => {
  const gateway = fs.readFileSync(path.join(root, 'src/order/order-session-gateway.js'), 'utf8');
  assert.ok(gateway.includes('withSessionRetry'), '401 静默续期逻辑必须存在');
  assert.ok(gateway.includes('desktop-order-session/v1/refresh'), '续期接口调用必须存在');
  const router = fs.readFileSync(path.join(root, 'vue/src/router/index.js'), 'utf8');
  assert.ok(router.includes('ensureRememberedSession'), '路由启动恢复逻辑必须存在');
});
