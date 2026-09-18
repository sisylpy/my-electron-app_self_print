const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createOrderSessionGateway } = require('../src/order/order-session-gateway');

async function run() {
  const calls = [];
  const cookies = [];
  const cookieStore = {
    get: async () => cookies.slice(),
    set: async (cookie) => {
      cookies.splice(0, cookies.length, cookie);
    },
    remove: async () => {
      cookies.splice(0);
    },
  };
  let nextResponse = null;
  const http = {
    get: async (url, config) => {
      calls.push({ method: 'GET', url, config });
      return nextResponse;
    },
    post: async (url, body, config) => {
      calls.push({ method: 'POST', url, body, config });
      return nextResponse;
    },
  };
  const gateway = createOrderSessionGateway({
    axios: { create: () => http },
    cookieStore,
  });

  assert.equal((await gateway.pollLogin('160')).status, 400);
  assert.equal(calls.length, 0, '任意用户 ID 不能充当扫码会话');
  assert.equal((await gateway.todayCustomers(160)).status, 401);
  assert.equal(calls.length, 0, '无会话时不请求订单接口');

  nextResponse = { status: 200, data: { code: 0, loggedIn: false }, headers: {} };
  assert.equal((await gateway.pollLogin('session-abcdefghi')).data.loggedIn, false);
  assert.equal(cookies.length, 0);

  nextResponse = {
    status: 200,
    data: {
      code: 0,
      loggedIn: true,
      user: { nxDistributerUserId: 312, nxDiuDistributerId: 160 },
    },
    headers: { 'set-cookie': ['JSESSIONID=opaque-session-value; Path=/nongxinle; HttpOnly'] },
  };
  assert.equal((await gateway.pollLogin('session-abcdefghi')).ok, true);
  assert.equal(cookies[0].httpOnly, true);
  assert.equal(cookies[0].sameSite, 'strict');
  assert.equal((await gateway.todayCustomers(161)).status, 403);

  nextResponse = { status: 200, data: { code: 0, data: { nxArr: [{ id: 1 }] } } };
  const customers = await gateway.todayCustomers(160);
  assert.equal(customers.ok, true);
  assert.equal(customers.data.data.nxArr.length, 1);
  assert.equal(calls.at(-1).url, 'nxdepartmentorders/webNxDisGetTodayOrderCustomer/160');
  assert.equal(calls.at(-1).config.headers.Cookie, 'JSESSIONID=opaque-session-value');

  assert.equal((await gateway.phoneOrders({ disId: 161, depFatherId: 12 })).status, 403);
  nextResponse = { status: 200, data: { code: 0, data: { totalCount: 2 } } };
  const detail = await gateway.phoneOrders({
    disId: 160, depFatherId: 12, gbDepFatherId: -1, resFatherId: -1,
  });
  assert.equal(detail.ok, true);
  assert.equal(calls.at(-1).url, 'nxdepartmentorders/phoneGetToFillDepOrders');
  assert.equal(new URLSearchParams(calls.at(-1).body).get('disId'), '160');
  assert.equal(calls.at(-1).config.headers.Cookie, 'JSESSIONID=opaque-session-value');

  nextResponse = { status: 401, data: { code: 401, msg: '未登录' } };
  assert.equal((await gateway.todayCustomers(160)).status, 401);
  assert.equal(cookies.length, 0, '401 清除失效会话');
  assert.equal((await gateway.todayCustomers(160)).status, 401);

  nextResponse = {
    status: 200,
    data: { code: 0, loggedIn: true,
      user: { nxDistributerUserId: 312, nxDiuDistributerId: 160 } },
    headers: { 'set-cookie': ['JSESSIONID=new-session; Path=/nongxinle; HttpOnly'] },
  };
  await gateway.pollLogin('session-jklmnopqr');
  nextResponse = { status: 500, data: { code: 500, msg: '服务暂不可用' } };
  assert.equal((await gateway.logout()).ok, false);
  assert.equal(cookies.length, 0, '服务端退出失败也清除本机会话');

  const home = fs.readFileSync(path.join(__dirname, '../vue/src/views/Home.vue'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '../vue/src/api/all.js'), 'utf8');
  const bills = fs.readFileSync(path.join(__dirname, '../vue/src/views/Bills.vue'), 'utf8');
  const main = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '../src/preload.js'), 'utf8');
  assert(home.includes('v-if="showTestLogin"') && home.includes('showTestLogin: import.meta.env.DEV'));
  assert(home.includes('v-if="loginError"') && home.includes("this.loginError = error?.message"));
  assert(home.includes("desktopOrderSessionRequest('pollLogin', sessionId)"));
  assert(api.includes("desktopOrderSessionRequest('todayCustomers', disId)"));
  assert(api.includes("desktopOrderSessionRequest('phoneOrders', data)"));
  assert(bills.includes('订单登录会话已失效，请重新扫码登录'));
  assert(main.includes("ipcMain.handle('order-session-today-customers'"));
  assert(main.includes("if (!isDev) return { ok: false, status: 403, message: '测试 ID 登录仅在开发态可用' }"));
  assert(preload.includes('orderSession: Object.freeze'));
  assert(!preload.includes('JSESSIONID'));
  console.log('Packaged order session smoke passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
