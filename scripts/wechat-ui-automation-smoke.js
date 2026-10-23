const assert = require('assert');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { PassThrough } = require('stream');
const {
  createWechatUiAutomationService,
  normalizeAllowedTitles,
  normalizeConversationTitle,
  parseAutomationOutput,
  parseUnreadSummaryOutput,
  parseCurrentConversationOutput,
  parseMacFastFocusOutput,
  classifyMacPythonFailure,
  resolveMacAutomationRoot,
  resolveMacPythonCommand,
  resolveWindowsAutomationScript,
  resolveWindowsCurrentConversationScript,
  resolveWindowsFocusConversationScript,
} = require('../src/wechat/ui-automation-service');

assert.strictEqual(normalizeConversationTitle({ title: ' 金调料 ' }), '金调料');
assert.strictEqual(
  normalizeConversationTitle({ title: ' 金调料 ', forceReselect: true }),
  '金调料'
);
assert.throws(
  () => normalizeConversationTitle({ title: '测试', forceReselect: 'yes' }),
  /强制重选参数无效/
);

const nativeFocus = parseMacFastFocusOutput('OPENED\t测试7群 (3)\n', ['测试7群']);
assert.strictEqual(nativeFocus.code, 'SUCCESS');
assert.deepStrictEqual(nativeFocus.openedTitles, ['测试7群']);
assert.deepStrictEqual(nativeFocus.details, ['NATIVE_SEARCH_VERIFIED']);
const nativeFocusSettled = parseMacFastFocusOutput('OPENED_SETTLED\t测试7群 (3)\n', ['测试7群']);
assert.strictEqual(nativeFocusSettled.code, 'SUCCESS');
assert.deepStrictEqual(nativeFocusSettled.details, ['NATIVE_SEARCH_SETTLED_VERIFIED']);
const nativeFocusMismatch = parseMacFastFocusOutput('MISMATCH_RETRY\t测试2群\n', ['测试7群']);
assert.strictEqual(nativeFocusMismatch.code, 'TARGET_NOT_FOUND');
assert.deepStrictEqual(nativeFocusMismatch.openedTitles, []);
assert.throws(() => normalizeConversationTitle({ title: '测试', command: 'bad' }), /未允许/);

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
  details: ['ACCESSIBILITY_SEARCH_VERIFIED'],
}), ['金调料']);
assert.deepStrictEqual(parsed.openedTitles, ['金调料']);
assert.strictEqual(parsed.openedTitlesExact, true);
assert.strictEqual(parsed.metrics.UNREAD_OPENED, '2');
assert.deepStrictEqual(parsed.details, ['ACCESSIBILITY_SEARCH_VERIFIED']);

const unreadSummary = parseUnreadSummaryOutput(JSON.stringify({
  code: 'SUCCESS',
  message: '2 unread',
  selectedTitle: '当前未绑定群',
  conversations: [
    { title: '金调料', status: 'UNREAD' },
    { title: '蔬菜群', status: 'UNREAD' },
    { title: '未绑定群', status: 'UNREAD' },
    { title: '金调料', status: 'UNREAD' },
  ],
}), ['金调料', '蔬菜群']);
assert.strictEqual(unreadSummary.unreadCount, 2);
assert.deepStrictEqual(unreadSummary.unreadTitles, ['金调料', '蔬菜群']);
assert.strictEqual(unreadSummary.selectedTitle, '当前未绑定群');

const currentConversation = parseCurrentConversationOutput(JSON.stringify({
  code: 'SUCCESS',
  message: 'matched',
  conversationTitle: '金调料',
}), ['金调料', '测试']);
assert.strictEqual(currentConversation.title, '金调料');
const currentGroupConversation = parseCurrentConversationOutput(JSON.stringify({
  code: 'SUCCESS',
  message: 'matched group',
  conversationTitle: '调料群（ 3 ）',
}));
assert.strictEqual(currentGroupConversation.title, '调料群');
assert.throws(
  () => parseCurrentConversationOutput(JSON.stringify({
    code: 'SUCCESS',
    conversationTitle: '未绑定',
  }), ['金调料']),
  /不在客户绑定范围/
);

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

const expectedWindowsCurrentConversationScript = path.join(
  windowsModuleDir,
  'ui-automation',
  'windows',
  'current-conversation.ps1'
);
assert.strictEqual(
  resolveWindowsCurrentConversationScript({
    moduleDir: windowsModuleDir,
    existsSync: (candidate) => candidate === expectedWindowsCurrentConversationScript,
  }),
  expectedWindowsCurrentConversationScript
);

const expectedWindowsFocusConversationScript = path.join(
  windowsModuleDir,
  'ui-automation',
  'windows',
  'focus-conversation.ps1'
);
assert.strictEqual(
  resolveWindowsFocusConversationScript({
    moduleDir: windowsModuleDir,
    existsSync: (candidate) => candidate === expectedWindowsFocusConversationScript,
  }),
  expectedWindowsFocusConversationScript
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
assert.strictEqual(
  windowsScript.charCodeAt(0),
  0xFEFF,
  'Windows PowerShell 5 requires a UTF-8 BOM before the unread scanner source'
);
assert.match(windowsScript, /'Weixin'/);
assert.match(windowsScript, /'WeChatAppEx'/);
assert.match(windowsScript, /'WeChat'/);
assert.doesNotMatch(windowsScript, /Chrome_WidgetWin_0/);
assert.match(windowsScript, /Invoke-WeixinToggleShortcut/);
assert.doesNotMatch(windowsScript, /Hide-WeixinMainWindow/);
assert.match(windowsScript, /WEIXIN_LOGIN_REQUIRED/);
assert.match(windowsScript, /WEIXIN_MAIN_WINDOW_NOT_READY/);
assert.match(windowsScript, /ShowWindow/);
assert.match(windowsScript, /'NO_UNREAD'/);
assert.match(windowsScript, /if \(-not \$badgeRows\.Count\)/);
assert.match(windowsScript, /\$width -lt 480/);
assert.match(windowsScript, /\$xStart = \[math\]::Max\(0, 106\)/);
assert.doesNotMatch(windowsScript, /ShowWindow\(\$remainingWindow\.Handle, 6\)/);

const windowsCurrentConversationScript = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'wechat',
    'ui-automation',
    'windows',
    'current-conversation.ps1'
  ),
  'utf8'
);
assert.strictEqual(
  windowsCurrentConversationScript.charCodeAt(0),
  0xFEFF,
  'Windows PowerShell 5 requires a UTF-8 BOM before Chinese source text'
);
assert.match(windowsCurrentConversationScript, /AutomationElement/);
assert.match(windowsCurrentConversationScript, /OcrEngine/);
assert.match(windowsCurrentConversationScript, /Console\]::OutputEncoding/);
assert.match(windowsCurrentConversationScript, /\$rect\.X -lt \$minimumCandidateX/);
assert.match(windowsCurrentConversationScript, /Read-TitleFromWindowsOcrScreenshot/);
assert.match(windowsCurrentConversationScript, /\$primary\.Title -ne '群'/);
assert.match(windowsCurrentConversationScript, /Save-HeaderScreenshot \$window \$compactScreenshotPath 3 2/);
assert.match(windowsCurrentConversationScript, /\$compact\.Title\.EndsWith\('群'\)/);
assert.ok(
  windowsCurrentConversationScript.indexOf('Get-TitleFromWindowsOcr $window')
    < windowsCurrentConversationScript.indexOf('Get-TitleFromAutomation $window'),
  'visible Windows header OCR must win over stale UI Automation nodes'
);
assert.match(windowsCurrentConversationScript, /method 'uia-fallback'/);
assert.match(windowsCurrentConversationScript, /\$code -eq 'AUTOMATION_FAILED'/);
assert.match(windowsCurrentConversationScript, /conversationTitle/);
assert.match(windowsCurrentConversationScript, /'SUCCESS'/);
assert.match(windowsCurrentConversationScript, /'TARGET_NOT_FOUND'/);
assert.match(windowsCurrentConversationScript, /\[switch\]\$RequireForeground/);
assert.match(windowsCurrentConversationScript, /GetForegroundWindow/);
assert.match(windowsCurrentConversationScript, /'NOT_FOREGROUND'/);
assert.match(windowsCurrentConversationScript, /NormalizationForm\]::FormKC/);
assert.match(windowsCurrentConversationScript, /SetProcessDPIAware/);
assert.match(windowsCurrentConversationScript, /\\s\*全部\\s\*\\d\+\$/);

const windowsFocusConversationScript = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'wechat',
    'ui-automation',
    'windows',
    'focus-conversation.ps1'
  ),
  'utf8'
);
assert.strictEqual(
  windowsFocusConversationScript.charCodeAt(0),
  0xFEFF,
  'Windows PowerShell 5 requires a UTF-8 BOM before Chinese source text'
);
assert.match(windowsFocusConversationScript, /Find-ExactSearchResult/);
assert.match(windowsFocusConversationScript, /Clipboard\]::SetText\(\$targetTitle\)/);
assert.match(windowsFocusConversationScript, /EXACT_SEARCH_RESULT_CLICKED/);
assert.match(windowsFocusConversationScript, /VISIBLE_HEADER_VERIFIED/);
assert.match(windowsFocusConversationScript, /current-conversation\.ps1/);
assert.match(windowsFocusConversationScript, /NormalizationForm\]::FormKC/);
assert.match(windowsFocusConversationScript, /SetProcessDPIAware/);
assert.match(windowsFocusConversationScript, /TITLE_METHOD_ATTEMPT_/);
assert.match(windowsFocusConversationScript, /\$attempt -le 2/);

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

const bundledMacFocusScript = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'wechat',
    'ui-automation',
    'mac',
    'scripts',
    'focus_conversation.py'
  ),
  'utf8'
);
assert.match(bundledMacFocusScript, /from automation\.api import focus_conversation/);

const bundledMacCurrentConversationScript = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'wechat',
    'ui-automation',
    'mac',
    'scripts',
    'current_conversation.py'
  ),
  'utf8'
);
assert.match(
  bundledMacCurrentConversationScript,
  /from automation\.flows\.current_conversation import CurrentConversationFlow/
);
assert.match(bundledMacCurrentConversationScript, /CurrentConversationFlow\(/);

const bundledMacCurrentConversationFlow = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'wechat',
    'ui-automation',
    'mac',
    'automation',
    'flows',
    'current_conversation.py'
  ),
  'utf8'
);
assert.match(bundledMacCurrentConversationFlow, /conversation_header/);
assert.match(bundledMacCurrentConversationFlow, /此微信好友没有关联客户/);

const bundledMacFocusFlow = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'wechat',
    'ui-automation',
    'mac',
    'automation',
    'flows',
    'focus_conversation.py'
  ),
  'utf8'
);
assert.match(bundledMacFocusFlow, /from \.\.state_detector import conversation_header/);
assert.match(bundledMacFocusFlow, /return conversation_header\(/);
assert.match(bundledMacFocusFlow, /SEARCH_QUERY_ENTERED/);
assert.match(bundledMacFocusFlow, /SEARCH_RESULT_CLICKED/);
assert.match(bundledMacFocusFlow, /SEARCH_RESULT_FIRST_EXACT_SELECTED/);
assert.match(bundledMacFocusFlow, /SEARCH_BOX_POSITION_FALLBACK/);
assert.match(bundledMacFocusFlow, /search_box_candidates/);
assert.match(bundledMacFocusFlow, /"搜索" in _compact_text/);
assert.match(bundledMacFocusFlow, /set_clipboard\(self\.target\)/);
assert.match(bundledMacFocusFlow, /paste_clipboard\(0\.9\)/);
assert.match(bundledMacFocusFlow, /press_escape\(0\.3\)/);
assert.doesNotMatch(bundledMacFocusFlow, /exact_chat_header/);

const bundledMacStateDetector = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'wechat',
    'ui-automation',
    'mac',
    'automation',
    'state_detector.py'
  ),
  'utf8'
);
assert.match(bundledMacStateDetector, /header_min_x = min\(image_width \* 0\.45, 320\.0\)/);

const bundledMacWindow = fs.readFileSync(
  path.join(
    __dirname,
    '..',
    'src',
    'wechat',
    'ui-automation',
    'mac',
    'automation',
    'window.py'
  ),
  'utf8'
);
assert.match(bundledMacWindow, /tell application "WeChat" to reopen/);
assert.match(bundledMacWindow, /WECHAT_MAIN_WINDOW_NOT_FOUND/);
assert.match(bundledMacWindow, /repeat 30 times/);

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
assert.match(bundledMacFlow, /CHAT_TAB_LOGICAL_X = 30/);
assert.match(bundledMacFlow, /CHAT_TAB_LOGICAL_Y = 122/);
assert.match(bundledMacFlow, /self\._window\.bounds\.x \+ CHAT_TAB_LOGICAL_X/);
assert.match(bundledMacFlow, /self\._window\.bounds\.y \+ CHAT_TAB_LOGICAL_Y/);
assert.doesNotMatch(bundledMacFlow, /image_height \* 0\.205/);
assert.match(bundledMacFlow, /self\._opened_titles\.add\(saved\.title\)/);
assert.doesNotMatch(bundledMacFlow, /page-\{page:02d\}-item-\{index:02d\}-before/);
assert.match(bundledMacFlow, /round_limit = max\(1, len\(self\.allowed_titles\)\)/);
assert.doesNotMatch(bundledMacFlow, /min\(round_limit, max\(1, len\(self\.allowed_titles\)\)\)/);
assert.match(bundledMacFlow, /selectedTitle/);
assert.match(bundledMacFlow, /ResultCode\.NO_UNREAD/);
assert.match(bundledMacFlow, /SCREEN_RECORDING_PERMISSION_REQUIRED/);
assert.match(bundledMacFlow, /except WindowError as exc/);
assert.match(bundledMacFlow, /微信聊天主窗口未能打开/);

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
  assert.strictEqual(result.result.openedTitlesExact, false);
  assert.deepStrictEqual(result.result.candidateTitles, ['金调料', '测试']);
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

async function verifyMacConversationFocus() {
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
        child.stdout.end(JSON.stringify({ code: 'SUCCESS', message: 'focused' }));
        child.stderr.end();
        child.emit('close', 0);
      });
      return child;
    },
  });
  const result = await service.focusConversation({ title: '金调料', forceReselect: true });
  assert.strictEqual(result.ok, true);
  assert.ok(spawnedArgs.some(arg => String(arg).endsWith('focus_conversation.py')));
  assert.ok(spawnedArgs.includes('金调料'));
  assert.ok(spawnedArgs.includes('--force-search'));
}

async function verifyWindowsConversationFocus() {
  let spawnedArgs = [];
  const service = createWechatUiAutomationService({
    platform: 'win32',
    moduleDir: path.join(__dirname, '..', 'src', 'wechat'),
    spawnProcess: (_command, args) => {
      spawnedArgs = args;
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {};
      process.nextTick(() => {
        child.stdout.end(JSON.stringify({
          code: 'SUCCESS',
          message: 'focused',
          selectedTitle: '金调料',
          conversations: [{ title: '金调料', status: 'OPENED' }],
        }));
        child.stderr.end();
        child.emit('close', 0);
      });
      return child;
    },
  });
  const result = await service.focusConversation({ title: '金调料' });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.result.openedTitles, ['金调料']);
  assert.strictEqual(result.result.openedTitlesExact, true);
  assert.ok(spawnedArgs.some(arg => String(arg).endsWith('focus-conversation.ps1')));
  assert.ok(spawnedArgs.some(arg => String(arg).endsWith('current-conversation.ps1')));
  assert.ok(spawnedArgs.includes('金调料'));
}

async function verifyWindowsCurrentConversationDeduplicates() {
  let spawnCalls = 0;
  const service = createWechatUiAutomationService({
    platform: 'win32',
    moduleDir: path.join(__dirname, '..', 'src', 'wechat'),
    spawnProcess: () => {
      spawnCalls += 1;
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {};
      setTimeout(() => {
        child.stdout.end(JSON.stringify({
          code: 'SUCCESS',
          message: 'matched',
          conversationTitle: '李沛谊',
        }));
        child.stderr.end();
        child.emit('close', 0);
      }, 20);
      return child;
    },
  });
  const [backgroundResult, buttonResult] = await Promise.all([
    service.currentConversation(),
    service.currentConversation(),
  ]);
  assert.strictEqual(spawnCalls, 1);
  assert.deepStrictEqual(buttonResult, backgroundResult);
  assert.strictEqual(buttonResult.ok, true);
  assert.strictEqual(buttonResult.result.title, '李沛谊');
}

async function verifyWindowsFocusWaitsForBackgroundConversationRead() {
  const spawnedScripts = [];
  const service = createWechatUiAutomationService({
    platform: 'win32',
    moduleDir: path.join(__dirname, '..', 'src', 'wechat'),
    spawnProcess: (_command, args) => {
      const fileIndex = args.indexOf('-File');
      const script = fileIndex >= 0 ? String(args[fileIndex + 1]) : '';
      spawnedScripts.push(path.basename(script));
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {};
      const isCurrentConversation = script.endsWith('current-conversation.ps1');
      setTimeout(() => {
        child.stdout.end(JSON.stringify(isCurrentConversation ? {
          code: 'SUCCESS',
          message: 'matched',
          conversationTitle: '金调料',
        } : {
          code: 'SUCCESS',
          message: 'focused',
          selectedTitle: '金调料',
          conversations: [{ title: '金调料', status: 'OPENED' }],
        }));
        child.stderr.end();
        child.emit('close', 0);
      }, isCurrentConversation ? 20 : 0);
      return child;
    },
  });
  const backgroundRead = service.currentConversation({ requireForeground: true });
  const focusResult = await service.focusConversation({ title: '金调料' });
  const backgroundResult = await backgroundRead;
  assert.strictEqual(backgroundResult.ok, true);
  assert.strictEqual(focusResult.ok, true);
  assert.deepStrictEqual(spawnedScripts, [
    'current-conversation.ps1',
    'focus-conversation.ps1',
  ]);
}

async function verifyWindowsCurrentConversationForegroundGuard() {
  let spawnedArgs = [];
  const service = createWechatUiAutomationService({
    platform: 'win32',
    moduleDir: path.join(__dirname, '..', 'src', 'wechat'),
    spawnProcess: (_command, args) => {
      spawnedArgs = args;
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {};
      process.nextTick(() => {
        child.stdout.end(JSON.stringify({
          code: 'SUCCESS',
          message: 'matched',
          conversationTitle: '李沛谊',
        }));
        child.stderr.end();
        child.emit('close', 0);
      });
      return child;
    },
  });
  const result = await service.currentConversation({ requireForeground: true });
  assert.strictEqual(result.ok, true);
  assert.ok(spawnedArgs.includes('-RequireForeground'));
  const invalid = await service.currentConversation({ requireForeground: 'yes' });
  assert.strictEqual(invalid.ok, false);
  assert.strictEqual(invalid.error.code, 'INVALID_ARGUMENT');
  assert.match(invalid.error.message, /前台识别参数无效/);
}

async function verifyMacUnreadSummaryDoesNotUseReadFlow() {
  let spawnedArgs = [];
  const service = createWechatUiAutomationService({
    platform: 'darwin',
    moduleDir: path.join(__dirname, '..', 'src', 'wechat'),
    ensureMacAccessibility: () => true,
    getMacScreenAccessStatus: () => 'granted',
    existsSync: () => true,
    spawnProcess: (_command, args) => {
      spawnedArgs = args;
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {};
      process.nextTick(() => {
        child.stdout.end(JSON.stringify({
          code: 'SUCCESS',
          message: 'one unread',
          selectedTitle: '测试',
          conversations: [{ title: '金调料', status: 'UNREAD' }],
        }));
        child.stderr.end();
        child.emit('close', 0);
      });
      return child;
    },
  });
  const result = await service.inspectUnread({ allowedTitles: ['金调料', '测试'] });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.result.unreadCount, 1);
  assert.strictEqual(result.result.selectedTitle, '测试');
  assert.ok(spawnedArgs.some(arg => String(arg).endsWith('inspect_unread.py')));
  assert.ok(!spawnedArgs.some(arg => String(arg).endsWith('read_unread.py')));
}

async function verifyMacCurrentConversation() {
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
          message: 'matched',
          conversationTitle: '金调料',
        }));
        child.stderr.end();
        child.emit('close', 0);
      });
      return child;
    },
  });
  const result = await service.currentConversation({ allowedTitles: ['金调料', '测试'] });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.result.title, '金调料');
  assert.ok(spawnedArgs.some(arg => String(arg).endsWith('current_conversation.py')));
  assert.ok(spawnedArgs.includes('金调料'));
  assert.ok(spawnedArgs.includes('测试'));
}

async function verifyMacReturnsOnlyExactCandidates() {
  const service = createWechatUiAutomationService({
    platform: 'darwin',
    moduleDir: path.join(__dirname, '..', 'src', 'wechat'),
    ensureMacAccessibility: () => true,
    getMacScreenAccessStatus: () => 'granted',
    spawnProcess: () => {
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = () => {};
      process.nextTick(() => {
        child.stdout.end(JSON.stringify({
          code: 'SUCCESS',
          message: 'ok',
          selectedTitle: '测试',
          conversations: [
            { title: '金调料', status: 'OPENED', hydration: 'NOT_CHECKED' },
          ],
          metrics: { openedCount: 1 },
        }));
        child.stderr.end();
        child.emit('close', 0);
      });
      return child;
    },
  });
  const result = await service.readUnread({ allowedTitles: ['金调料', '测试', '其他客户'] });
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(result.result.openedTitles, ['金调料']);
  assert.deepStrictEqual(result.result.candidateTitles, ['金调料', '测试']);
}

verifyMacAccessibilityStopsBeforeAutomation()
  .then(() => verifyMacScreenPermissionStopsBeforeAutomation())
  .then(() => verifyMacUnreadSummaryDoesNotUseReadFlow())
  .then(() => verifyMacConversationFocus())
  .then(() => verifyWindowsConversationFocus())
  .then(() => verifyWindowsCurrentConversationDeduplicates())
  .then(() => verifyWindowsFocusWaitsForBackgroundConversationRead())
  .then(() => verifyWindowsCurrentConversationForegroundGuard())
  .then(() => verifyMacCurrentConversation())
  .then(() => verifyMacReturnsOnlyExactCandidates())
  .then(() => verifyWindowsNoUnreadStopsImmediately())
  .then(() => console.log('WeChat UI automation smoke passed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
