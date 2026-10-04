const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');

const {
  createWechatUiAutomationService,
  normalizeCurrentConversationInput,
  parseCurrentConversationOutput,
} = require('../src/wechat/ui-automation-service');

assert.deepStrictEqual(normalizeCurrentConversationInput({}), []);
assert.throws(
  () => normalizeCurrentConversationInput({ unexpected: true }),
  /未允许的参数/
);
assert.equal(parseCurrentConversationOutput(JSON.stringify({
  code: 'SUCCESS',
  conversationTitle: 'Fangfang',
})).title, 'Fangfang');

async function verifyUnrestrictedCurrentConversation() {
  let spawnedArgs = [];
  const service = createWechatUiAutomationService({
    platform: 'darwin',
    moduleDir: path.join(__dirname, '..', 'src', 'wechat'),
    ensureMacAccessibility: () => true,
    getMacScreenAccessStatus: () => 'granted',
    spawnProcess: (_command, args) => {
      spawnedArgs = args;
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {};
      process.nextTick(() => {
        child.stdout.end(JSON.stringify({
          code: 'SUCCESS',
          conversationTitle: 'Fangfang',
        }));
        child.stderr.end();
        child.emit('close', 0);
      });
      return child;
    },
  });

  const result = await service.currentConversation();
  assert.equal(result.ok, true);
  assert.equal(result.result.title, 'Fangfang');
  assert.ok(spawnedArgs.some(arg => String(arg).endsWith('current_conversation.py')));
  assert.equal(spawnedArgs.includes('--include-title'), false);
}

async function verifyWindowsCurrentConversation() {
  let spawnedCommand = '';
  let spawnedArgs = [];
  const service = createWechatUiAutomationService({
    platform: 'win32',
    moduleDir: path.join(__dirname, '..', 'src', 'wechat'),
    spawnProcess: (command, args) => {
      spawnedCommand = command;
      spawnedArgs = args;
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {};
      process.nextTick(() => {
        child.stdout.end(JSON.stringify({
          code: 'SUCCESS',
          conversationTitle: '李沛谊',
          metrics: { platform: 'win32', method: 'uia' },
        }));
        child.stderr.end();
        child.emit('close', 0);
      });
      return child;
    },
  });

  const result = await service.currentConversation();
  assert.equal(result.ok, true);
  assert.equal(result.result.title, '李沛谊');
  assert.equal(spawnedCommand, 'powershell.exe');
  assert.ok(spawnedArgs.some(arg => String(arg).endsWith('current-conversation.ps1')));
}

Promise.all([
  verifyUnrestrictedCurrentConversation(),
  verifyWindowsCurrentConversation(),
])
  .then(() => console.log('WeChat current conversation smoke passed'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
