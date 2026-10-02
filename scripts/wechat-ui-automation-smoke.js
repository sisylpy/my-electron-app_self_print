const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const {
  createWechatUiAutomationService,
  normalizeAllowedTitles,
  parseAutomationOutput,
  classifyMacPythonFailure,
  resolveMacAutomationRoot,
  resolveMacPythonCommand,
  resolveWindowsAutomationScript,
} = require('../src/wechat/ui-automation-service');

assert.deepStrictEqual(
  normalizeAllowedTitles({ allowedTitles: [' 金调料 ', '测试', '金调料'] }),
  ['金调料', '测试']
);
assert.throws(
  () => normalizeAllowedTitles({ allowedTitles: ['测试\n群'] }),
  /名称无效/
);
assert.throws(
  () => normalizeAllowedTitles({ allowedTitles: ['测试'], command: 'anything' }),
  /未允许/
);

const parsed = parseAutomationOutput(JSON.stringify({
  code: 'SUCCESS',
  message: 'done',
  metrics: { UNREAD_OPENED: '2' },
  conversations: [
    { title: '金调料', status: 'OPENED' },
    { title: '公众号', status: 'FILTERED' },
    { title: '未绑定', status: 'OPENED' },
    { title: '金调料', status: 'OPENED' },
  ],
}), ['金调料']);
assert.deepStrictEqual(parsed.openedTitles, ['金调料']);
assert.strictEqual(parsed.metrics.UNREAD_OPENED, '2');

const macModuleDir = path.join('/tmp', 'app', 'src', 'wechat');
const expectedRoot = path.join(macModuleDir, 'ui-automation', 'mac');
const resolved = resolveMacAutomationRoot({
  moduleDir: macModuleDir,
  existsSync: (candidate) => candidate === path.join(
    expectedRoot,
    'scripts',
    'read_unread.py'
  ),
});
assert.strictEqual(resolved, expectedRoot);

assert.strictEqual(
  resolveMacPythonCommand({
    arch: 'x64',
    env: {},
    existsSync: (candidate) => candidate === '/usr/local/bin/python3',
  }),
  '/usr/local/bin/python3'
);
assert.strictEqual(
  resolveMacPythonCommand({
    arch: 'arm64',
    env: {},
    existsSync: (candidate) => candidate === '/opt/homebrew/bin/python3',
  }),
  '/opt/homebrew/bin/python3'
);
assert.strictEqual(
  resolveMacPythonCommand({
    env: { JCYX_WECHAT_UI_PYTHON: '/custom/python3' },
    existsSync: () => false,
  }),
  '/custom/python3'
);

assert.deepStrictEqual(
  classifyMacPythonFailure(
    "ModuleNotFoundError: No module named 'PIL'",
    1
  ),
  {
    code: 'PYTHON_DEPENDENCY_MISSING',
    message: 'Mac 微信自动化缺少运行组件：Pillow (PIL)',
  }
);

const windowsModuleDir = path.join('/tmp', 'app', 'src', 'wechat');
const expectedWindowsScript = path.join(
  windowsModuleDir,
  'ui-automation',
  'windows',
  'read-unread.ps1'
);
assert.strictEqual(
  resolveWindowsAutomationScript({
    moduleDir: windowsModuleDir,
    existsSync: (candidate) => candidate === expectedWindowsScript,
  }),
  expectedWindowsScript
);

const windowsScript = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'wechat',
    'ui-automation',
    'windows',
    'read-unread.ps1'
  ),
  'utf8'
);
assert.match(windowsScript, /'Weixin'/);
assert.match(windowsScript, /'WeChatAppEx'/);
assert.match(windowsScript, /'WeChat'/);
assert.doesNotMatch(windowsScript, /Chrome_WidgetWin_0/);
assert.match(windowsScript, /Invoke-WeixinToggleShortcut/);
assert.match(windowsScript, /Hide-WeixinMainWindow/);
assert.match(windowsScript, /WEIXIN_LOGIN_REQUIRED/);
assert.match(windowsScript, /WEIXIN_MAIN_WINDOW_NOT_READY/);
assert.match(windowsScript, /ShowWindow/);
assert.match(windowsScript, /'NO_UNREAD'/);
assert.match(windowsScript, /if \(-not \$badgeRows\.Count\)/);

const bundledMacScript = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'wechat',
    'ui-automation',
    'mac',
    'scripts',
    'read_unread.py'
  ),
  'utf8'
);
assert.match(bundledMacScript, /from automation\.api import read_unread_conversations/);

const bundledMacFlow = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'wechat',
    'ui-automation',
    'mac',
    'automation',
    'flows',
    'read_unread.py'
  ),
  'utf8'
);
assert.doesNotMatch(bundledMacFlow, /scroll_vertical/);
assert.doesNotMatch(bundledMacFlow, /CURRENT_BOUND|current_bound_title/);
assert.match(bundledMacFlow, /top-unread-/);
assert.match(bundledMacFlow, /CHAT_TAB_DOUBLE_CLICKED/);
assert.match(bundledMacFlow, /chat_tab_point/);
assert.match(bundledMacFlow, /self\._opened_titles\.add\(candidate\.title\)/);
assert.match(bundledMacFlow, /ResultCode\.NO_UNREAD/);
assert.match(bundledMacFlow, /SCREEN_RECORDING_PERMISSION_REQUIRED/);

const serviceSource = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'wechat', 'ui-automation-service.js'),
  'utf8'
);
assert.doesNotMatch(serviceSource, /JCYX_WECHAT_UI_HOME/);
assert.doesNotMatch(serviceSource, /jcyx-wechat-ui-automation/);
assert.match(serviceSource, /openedCount > 0 \? \[\.\.\.allowedTitles\] : \[\]/);

async function verifyWindowsNoUnreadStopsImmediately() {
  const service = createWechatUiAutomationService({
    platform: 'win32',
    moduleDir: path.join(__dirname, '..', 'src', 'wechat'),
    spawnProcess: () => {
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {};
      process.nextTick(() => {
        child.stdout.end(JSON.stringify({
          code: 'NO_UNREAD',
          message: 'none',
          conversations: [],
          metrics: { openedCount: 0, iterations: 0, platform: 'win32' },
        }));
        child.stderr.end();
        child.emit('close', 0);
      });
      return child;
    },
  });
  const result = await service.readUnread({ allowedTitles: ['金调料', '测试'] });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.result.code, 'NO_UNREAD');
  assert.deepStrictEqual(result.result.openedTitles, []);
}

async function verifyMacAccessibilityStopsBeforeAutomation() {
  let spawnCalls = 0;
  const service = createWechatUiAutomationService({
    platform: 'darwin',
    ensureMacAccessibility: () => false,
    spawnProcess: () => {
      spawnCalls += 1;
      throw new Error('automation must not start without accessibility permission');
    },
  });
  const result = await service.readUnread({ allowedTitles: ['金调料'] });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.code, 'MAC_ACCESSIBILITY_PERMISSION_REQUIRED');
  assert.match(result.error.message, /辅助功能/);
  assert.strictEqual(spawnCalls, 0);
}

async function verifyMacScreenPermissionStopsBeforeAutomation() {
  let spawnCalls = 0;
  const service = createWechatUiAutomationService({
    platform: 'darwin',
    ensureMacAccessibility: () => true,
    getMacScreenAccessStatus: () => 'denied',
    spawnProcess: () => {
      spawnCalls += 1;
      throw new Error('automation must not start without screen recording permission');
    },
  });
  const result = await service.readUnread({ allowedTitles: ['金调料'] });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.error.code, 'MAC_SCREEN_RECORDING_PERMISSION_REQUIRED');
  assert.match(result.error.message, /屏幕录制/);
  assert.strictEqual(spawnCalls, 0);
}

verifyMacAccessibilityStopsBeforeAutomation()
  .then(() => verifyMacScreenPermissionStopsBeforeAutomation())
  .then(() => verifyWindowsNoUnreadStopsImmediately())
  .then(() => console.log('WeChat UI automation smoke passed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
