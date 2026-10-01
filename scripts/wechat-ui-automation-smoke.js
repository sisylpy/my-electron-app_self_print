const assert = require('assert');
const path = require('path');
const {
  normalizeAllowedTitles,
  parseAutomationOutput,
  resolveAutomationRoot,
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

const expectedRoot = path.join('/tmp', 'wechat-ui-automation');
const resolved = resolveAutomationRoot({
  env: { JCYX_WECHAT_UI_HOME: expectedRoot },
  resourcesPath: '/unused',
  moduleDir: '/unused/module',
  existsSync: (candidate) => candidate === path.join(
    expectedRoot,
    'scripts',
    'read_unread_smoke.py'
  ),
});
assert.strictEqual(resolved, expectedRoot);

console.log('WeChat UI automation smoke passed.');
