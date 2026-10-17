import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { createOrderSessionGateway } = require('../src/order/order-session-gateway.js');

// 网关只接受正式/测试/本机地址，这里用本机开发地址做纯离线模拟。
const BASE = 'http://127.0.0.1:8080/nongxinle/api/';
const NEW_SESSION = 'JSESSIONID=new-session-value';

function okResponse(data = { code: 0, data: { customers: [] } }) {
  return { status: 200, data, headers: {} };
}

/** 默认行为：旧会话（服务器 Session 已过期）返回 401，续期出的新会话正常返回。 */
function expiredThenOk({ url, cookie }) {
  if (url.includes('refresh')) return refreshSuccess();
  if (cookie && cookie.includes('new-session-value')) return okResponse();
  return { status: 401, data: { code: 401, msg: '会话已失效' }, headers: {} };
}

/** 构造带可控 http 行为的网关；handler 决定每次请求返回什么。 */
function buildGateway({
  handler = expiredThenOk,
  token = 'remember-token-value',
  remember = true,
}) {
  const calls = [];
  const cookies = new Map();
  let tokenValue = token;
  let cleared = 0;

  const cookieStore = {
    async get({ url }) {
      assert.equal(url, BASE);
      return cookies.has('JSESSIONID')
        ? [{ name: 'JSESSIONID', value: cookies.get('JSESSIONID') }]
        : [];
    },
    async set(options) {
      assert.equal(options.name, 'JSESSIONID');
      if (options.expirationDate) {
        assert.ok(options.expirationDate * 1000 > Date.now(), '记住用户时 Cookie 应有未来过期时间');
      }
      cookies.set('JSESSIONID', options.value);
    },
    async remove(url, name) {
      assert.equal(url, BASE);
      assert.equal(name, 'JSESSIONID');
      cookies.delete('JSESSIONID');
      cleared += 1;
    },
  };

  const rememberTokenStore = {
    async read() {
      return tokenValue;
    },
    async write(value) {
      tokenValue = value;
    },
    async clear() {
      tokenValue = null;
    },
  };

  const http = {
    async get(url, config) {
      const cookie = config?.headers?.Cookie || null;
      calls.push({ method: 'GET', url, cookie });
      return handler({ method: 'GET', url, cookie, calls });
    },
    async post(url, body, config) {
      const cookie = config?.headers?.Cookie || null;
      calls.push({ method: 'POST', url, cookie });
      return handler({ method: 'POST', url, body, cookie, calls });
    },
  };

  const gateway = createOrderSessionGateway({
    axios: { create: () => http },
    cookieStore,
    apiBaseUrl: BASE,
    rememberEnabled: () => remember,
    rememberTokenStore,
  });

  return {
    gateway,
    calls,
    cookies,
    clearedCount: () => cleared,
    tokenValue: () => tokenValue,
    seedSession: (value) => cookies.set('JSESSIONID', value),
    hasSession: () => cookies.has('JSESSIONID'),
  };
}

function refreshSuccess() {
  return {
    status: 200,
    data: {
      code: 0,
      data: { user: { nxDistributerUserId: 88, nxDiuDistributerId: 160 } },
    },
    headers: { 'set-cookie': [`${NEW_SESSION}; Path=/nongxinle; HttpOnly`] },
  };
}

test('会话过期后自动续期并重试原请求，业务无感知', async () => {
  const ctx = buildGateway({});
  ctx.seedSession('old-session-value');

  const result = await ctx.gateway.todayCustomers(160);

  assert.equal(result.ok, true, `应自动续期成功：${result.message}`);
  assert.equal(ctx.cookies.get('JSESSIONID'), 'new-session-value');
  assert.equal(ctx.tokenValue(), 'remember-token-value', '有效令牌不应被清除');
  // 首次 401 请求 + refresh + 重试
  assert.equal(ctx.calls.filter((call) => call.method === 'GET').length, 2);
  assert.equal(ctx.calls.filter((call) => call.url.includes('refresh')).length, 1);
  assert.equal(ctx.clearedCount(), 0, '续期成功不应清除会话');
});

test('令牌被服务端判失效时才回到扫码登录并清除本机凭据', async () => {
  const ctx = buildGateway({
    handler: ({ url }) => (url.includes('refresh')
      ? {
        status: 401,
        data: { code: 401, msg: '自动登录已失效，请重新扫码登录' },
        headers: {},
      }
      : { status: 401, data: { code: 401, msg: '会话已失效' }, headers: {} }),
  });
  ctx.seedSession('old-session-value');

  const result = await ctx.gateway.todayCustomers(160);

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(ctx.hasSession(), false, '真正失效时本机会话应被清除');
  assert.equal(ctx.tokenValue(), null, '失效令牌应被清除');
});

test('开机自启：本机无会话 Cookie 但持有令牌时直接静默换回会话', async () => {
  const ctx = buildGateway({ handler: ({ url }) => (String(url).includes("refresh")
    ? refreshSuccess()
    : okResponse()) });

  assert.equal(ctx.hasSession(), false);
  const result = await ctx.gateway.todayCustomers(160);

  assert.equal(result.ok, true);
  assert.equal(ctx.cookies.get('JSESSIONID'), 'new-session-value');
  assert.equal(ctx.clearedCount(), 0);
});

test('网络不可达不清除任何长期凭据', async () => {
  const ctx = buildGateway({
    handler: () => {
      throw new Error('ECONNREFUSED');
    },
  });
  ctx.seedSession('valid-session-value');

  const result = await ctx.gateway.todayCustomers(160);

  assert.equal(result.ok, false);
  assert.equal(result.status, 0);
  assert.equal(ctx.hasSession(), true, '断网不应删除会话 Cookie');
  assert.equal(ctx.tokenValue(), 'remember-token-value', '断网不应删除自动登录令牌');
  assert.equal(ctx.clearedCount(), 0);
});

test('并发 401 只续期一次，避免旧 JSESSIONID 被作废导致竞态', async () => {
  const ctx = buildGateway({});
  ctx.seedSession('old-session-value');

  const results = await Promise.all([
    ctx.gateway.todayCustomers(160),
    ctx.gateway.todayCustomers(160),
    ctx.gateway.todayCustomers(160),
  ]);

  assert.ok(results.every((item) => item.ok), '所有并发请求都应成功');
  assert.equal(ctx.calls.filter((call) => call.url.includes('refresh')).length, 1);
  assert.equal(ctx.cookies.get('JSESSIONID'), 'new-session-value');
});

test('没有令牌且没有会话时直接要求登录，不重复请求', async () => {
  const ctx = buildGateway({ token: null });

  const result = await ctx.gateway.todayCustomers(160);

  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(ctx.calls.length, 0, '没有凭据时不应发起任何请求');
});

test('图片订单识别走同一套续期逻辑', async () => {
  const ctx = buildGateway({});
  ctx.seedSession('old-session-value');
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const first = await ctx.gateway.recognizeOrderQwen({
    ImageBase64: image,
    depId: 1, depFatherId: 1, disId: 160, userId: 88,
  });
  assert.equal(first.ok, true);

  // 续期后 authenticatedDisId = 160，跨配送商仍必须被拒绝
  const cross = await ctx.gateway.recognizeOrderQwen({
    ImageBase64: image,
    depId: 1, depFatherId: 1, disId: 999, userId: 88,
  });
  assert.equal(cross.ok, false);
  assert.equal(cross.status, 403, '权限校验不能被续期逻辑削弱');
});
