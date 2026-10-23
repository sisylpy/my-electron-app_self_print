import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  detectWechatLoginStateWithoutReader,
} = require('../src/wechat/login-state-probe.js');

test('macOS reports logged in from open db_storage files without reading a database', () => {
  const calls = [];
  const loggedIn = detectWechatLoginStateWithoutReader({
    platform: 'darwin',
    execFile(command, args) {
      calls.push([command, args]);
      if (command === 'pgrep') return '123\n456\n';
      if (command === 'lsof') {
        return 'p123\nn/Users/test/xwechat_files/wxid_abc/db_storage/message/message_0.db\n';
      }
      throw new Error(`unexpected command: ${command}`);
    },
  });

  assert.equal(loggedIn, true);
  assert.deepEqual(calls, [
    ['pgrep', ['-x', 'WeChat']],
    ['lsof', ['-Fn', '-p', '123,456']],
  ]);
});

test('macOS reports not logged in when WeChat has no db_storage file open', () => {
  const loggedIn = detectWechatLoginStateWithoutReader({
    platform: 'darwin',
    execFile(command) {
      return command === 'pgrep' ? '123\n' : 'p123\nn/usr/lib/libSystem.B.dylib\n';
    },
  });
  assert.equal(loggedIn, false);
});

test('unsupported platforms leave login state unknown instead of touching chat data', () => {
  let called = false;
  const loggedIn = detectWechatLoginStateWithoutReader({
    platform: 'win32',
    execFile() {
      called = true;
    },
  });
  assert.equal(loggedIn, null);
  assert.equal(called, false);
});

test('background bridge status detection never starts Reader or lists accounts', () => {
  const mainSource = fs.readFileSync('src/main.js', 'utf8');
  const body = mainSource.match(
    /async function detectWechatState\(\) \{([\s\S]*?)\n  \}\n\n  \/\/ 把桥连接状态/,
  )?.[1] || '';

  assert.match(body, /detectWechatLoginStateWithoutReader\(\)/);
  assert.doesNotMatch(body, /getWechatReaderService/);
  assert.doesNotMatch(body, /listAccounts/);
});
