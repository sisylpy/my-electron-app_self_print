const assert = require('assert');
const {
  computeWorkspaceLayout,
  createWechatWorkspaceWindowService,
  parseBounds,
} = require('../src/wechat/workspace-window-service');

assert.deepStrictEqual(parseBounds('10,20,800,700\n'), {
  x: 10,
  y: 20,
  width: 800,
  height: 700,
});
assert.throws(() => parseBounds('invalid'), /无法读取微信窗口位置/);

const layout = computeWorkspaceLayout({ x: 0, y: 25, width: 1920, height: 1055 });
assert.strictEqual(layout.mode, 'docked');
assert.strictEqual(layout.wechat.x, 0);
assert.strictEqual(layout.wechat.y, 25);
assert.strictEqual(layout.wechat.width + 8 + layout.app.width, 1920);
assert.strictEqual(layout.app.x, layout.wechat.width + 8);
assert.strictEqual(layout.app.height, 1055);
assert.strictEqual(layout.wechat.width, 806);
assert.ok(layout.app.width >= 760);
assert.ok(layout.app.width > layout.wechat.width);
assert.strictEqual(
  computeWorkspaceLayout({ x: 0, y: 0, width: 1100, height: 700 }).mode,
  'app-only'
);

async function verifyDockAndRestore() {
  const calls = [];
  let bounds = { x: 40, y: 60, width: 1500, height: 900 };
  let maximized = true;
  const fakeWindow = {
    isDestroyed: () => false,
    getBounds: () => ({ ...bounds }),
    isMaximized: () => maximized,
    isFullScreen: () => false,
    unmaximize: () => { maximized = false; calls.push('unmaximize'); },
    maximize: () => { maximized = true; calls.push('maximize'); },
    setFullScreen: value => calls.push(`fullscreen:${value}`),
    setBounds: value => { bounds = { ...value }; calls.push({ setBounds: value }); },
    showInactive: () => calls.push('showInactive'),
    show: () => calls.push('show'),
    focus: () => calls.push('focus'),
  };
  const execCalls = [];
  const service = createWechatWorkspaceWindowService({
    platform: 'darwin',
    screen: {
      getDisplayMatching: () => ({ workArea: { x: 0, y: 25, width: 1920, height: 1055 } }),
    },
    getMainWindow: () => fakeWindow,
    execFileAsync: async (command, args) => {
      calls.push('dockWechat');
      execCalls.push({ command, args });
      return { stdout: execCalls.length === 1 ? '100,120,900,760' : '' };
    },
  });

  const opened = await service.open();
  assert.strictEqual(opened.ok, true);
  assert.strictEqual(opened.result.mode, 'docked');
  assert.strictEqual(execCalls[0].command, 'osascript');
  const dockScript = execCalls[0].args.join('\n');
  assert.match(dockScript, /tell application "WeChat" to reopen/);
  assert.match(dockScript, /repeat 30 times/);
  assert.ok(
    dockScript.indexOf('set size of targetWindow')
      < dockScript.indexOf('set position of targetWindow'),
    'WeChat must be resized before its left edge is pinned'
  );
  assert.strictEqual(
    dockScript.match(/set position of targetWindow/g)?.length,
    2,
    'WeChat position must be pinned twice after applying its minimum size'
  );
  assert.ok(calls.includes('unmaximize'));
  assert.deepStrictEqual(bounds, opened.result.app);
  assert.ok(
    calls.findIndex(call => typeof call === 'object' && call.setBounds)
      < calls.indexOf('dockWechat'),
    'GrainPrint must be placed before WeChat is docked and raised'
  );
  assert.ok(calls.includes('showInactive'));
  assert.strictEqual(calls.includes('show'), false);
  assert.strictEqual(calls.includes('focus'), false, 'opening the workspace must leave WeChat in front');

  const closed = await service.close();
  assert.strictEqual(closed.ok, true);
  assert.strictEqual(execCalls.length, 2);
  assert.deepStrictEqual(bounds, { x: 40, y: 60, width: 1500, height: 900 });
  assert.strictEqual(maximized, true);
}

verifyDockAndRestore()
  .then(() => console.log('WeChat workspace window smoke passed.'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
