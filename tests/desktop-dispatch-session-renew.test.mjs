import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createDispatchGateway } = require('../src/dispatch/dispatch-gateway.js');

test('微信绑定核查的过期调度会话经 remember token 续期后重试一次', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-renew-'));
  try {
    fs.writeFileSync(path.join(userData, 'desktop-dispatch-session.json'), JSON.stringify({
      version: 1,
      encryptedToken: Buffer.from('expired-token').toString('base64'),
    }));
    const calls = [];
    let renewals = 0;
    const gateway = createDispatchGateway({
      app: { getPath: () => userData, getVersion: () => '1.0.26' },
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: value => Buffer.from(value),
        decryptString: value => value.toString(),
      },
      axios: { create: () => ({
        request: async options => {
          calls.push(options);
          return options.headers.Authorization === 'Bearer renewed-token'
            ? { status: 200, data: { code: 0, data: { enabled: 1 } } }
            : { status: 401, data: { code: 401, msg: '会话过期' } };
        },
      }) },
      renewDispatchSession: async () => {
        renewals += 1;
        return { accessToken: 'renewed-token', userId: 88, disId: 160 };
      },
    });
    const result = await gateway.loadCustomerWechatBinding({ customerId: 7 });
    assert.equal(result.ok, true);
    assert.equal(renewals, 1);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(call => call.headers.Authorization),
      ['Bearer expired-token', 'Bearer renewed-token']);
    assert.equal(calls[0].url, calls[1].url);
  } finally {
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
