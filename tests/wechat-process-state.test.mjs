import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { detectWechatProcessOpen } = require('../src/wechat/process-state.js');

test('Windows detects the Weixin 4.x executable without calling pgrep', () => {
  const calls = [];
  const open = detectWechatProcessOpen({
    platform: 'win32',
    execFile(command, args) {
      calls.push([command, args]);
      return '"Weixin.exe","1234","Console","1","100,000 K"\r\n';
    },
  });

  assert.equal(open, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'tasklist.exe');
  assert.ok(calls[0][1].includes('IMAGENAME eq Weixin.exe'));
});

test('Windows falls back to the legacy WeChat executable', () => {
  const queried = [];
  const open = detectWechatProcessOpen({
    platform: 'win32',
    execFile(_command, args) {
      const filter = args[1];
      queried.push(filter);
      return filter.endsWith('WeChat.exe')
        ? '"WeChat.exe","4567","Console","1","80,000 K"\r\n'
        : 'INFO: No tasks are running which match the specified criteria.\r\n';
    },
  });

  assert.equal(open, true);
  assert.deepEqual(queried, ['IMAGENAME eq Weixin.exe', 'IMAGENAME eq WeChat.exe']);
});

test('Windows reports closed when neither executable exists', () => {
  const open = detectWechatProcessOpen({
    platform: 'win32',
    execFile: () => 'INFO: No tasks are running which match the specified criteria.\r\n',
  });
  assert.equal(open, false);
});

test('macOS keeps the existing exact WeChat pgrep check', () => {
  const calls = [];
  const open = detectWechatProcessOpen({
    platform: 'darwin',
    execFile(command, args) {
      calls.push([command, args]);
      return '1234\n';
    },
  });

  assert.equal(open, true);
  assert.deepEqual(calls, [['pgrep', ['-x', 'WeChat']]]);
});

test('process lookup errors are treated as not running', () => {
  const open = detectWechatProcessOpen({
    platform: 'win32',
    execFile() {
      throw new Error('ENOENT');
    },
  });
  assert.equal(open, false);
});
