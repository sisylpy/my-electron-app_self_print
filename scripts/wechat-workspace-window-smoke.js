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
assert.ok(layout.app.width >= 900);
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
      execCalls.push({ command, args });
      return { stdout: execCalls.length === 1 ? '100,120,900,760' : '' };
    },
  });

  const opened = await service.open();
  assert.strictEqual(opened.ok, true);
  assert.strictEqual(opened.result.mode, 'docked');
  assert.strictEqual(execCalls[0].command, 'osascript');
  assert.ok(calls.includes('unmaximize'));
  assert.deepStrictEqual(bounds, opened.result.app);

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
