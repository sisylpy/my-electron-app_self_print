const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createDispatchGateway } = require('../src/dispatch/dispatch-gateway');

async function main() {
  const requests = [];
  const axios = {
    create() {
      return {
        async request(options) {
          requests.push(options);
          if (options.url === 'desktop-dispatch/v1/auth/me') {
            return {
              status: 200,
              data: { code: 0, data: { userId: 3, disId: 8, permissions: [] } },
            };
          }
          return {
            status: 200,
            data: {
              code: 0,
              data: { layout: 'single_column', items: [], warnings: [], needsReview: false },
            },
          };
        },
      };
    },
  };
  const gateway = createDispatchGateway({
    app: { getPath: () => path.join(__dirname, '.test-user-data'), getVersion: () => 'test' },
    safeStorage: { isEncryptionAvailable: () => false },
    axios,
  });

  const login = await gateway.adoptLoginSession({
    accessToken: 'test-token', userId: 3, disId: 8, permissions: [], expiresAt: null,
  }, { persistSession: false });
  assert.strictEqual(login.ok, true);

  const result = await gateway.analyzeCustomerWechatOrderImage({
    customerId: 7,
    messageFingerprint: 'msg:image-001',
    imageBase64: 'data:image/jpeg;base64,/9j/2Q==',
  });
  assert.strictEqual(result.ok, true);
  const imageRequest = requests.at(-1);
  assert.strictEqual(imageRequest.url, 'desktop-dispatch/v1/customer-wechat-orders/7/images/analyze');
  assert.strictEqual(imageRequest.timeout, 90_000);
  assert.strictEqual(imageRequest.data.messageFingerprint, 'msg:image-001');
  assert.strictEqual(imageRequest.data.imageBase64, 'data:image/jpeg;base64,/9j/2Q==');
  assert.strictEqual(imageRequest.headers.Authorization, 'Bearer test-token');

  const invalid = await gateway.analyzeCustomerWechatOrderImage({
    customerId: 7,
    imageBase64: 'https://untrusted.example/image.jpg',
  });
  assert.strictEqual(invalid.ok, false);
  assert.strictEqual(invalid.status, 400);

  const root = path.resolve(__dirname, '..');
  const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
  assert(read('src/main.js').includes("ipcMain.handle('customer-wechat-image-analyze'"));
  assert(read('src/preload.js').includes('analyzeImage: (payload)'));

  console.log('Customer WeChat image gateway smoke passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
