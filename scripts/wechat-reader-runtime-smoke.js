const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const runtimeRoot = path.join(root, 'src', 'wechat', 'reader-runtime');
const {
  resolveReaderRuntime,
  tryBundledWindowsPython,
  resolveReaderChildEnv,
} = require('../src/wechat/reader-runtime-resolver');

const spec = tryBundledWindowsPython(runtimeRoot, { platform: 'win32' });
assert(spec, 'Windows portable Reader runtime must be discoverable');
assert.strictEqual(spec.kind, 'portable-python');
assert.strictEqual(spec.command, path.join(runtimeRoot, 'python-win', 'python.exe'));
assert.deepStrictEqual(spec.args, ['-u', '-m', 'product.bridge.ndjson_main']);
assert.strictEqual(spec.cwd, runtimeRoot);
assert(fs.existsSync(path.join(runtimeRoot, 'python-win', 'python312.dll')));
assert(fs.existsSync(path.join(runtimeRoot, 'python-win', 'Lib', 'site-packages', 'zstandard', 'backend_c.cp312-win_amd64.pyd')));
assert(fs.existsSync(path.join(runtimeRoot, 'tools', 'scquery.exe')));
assert(!fs.existsSync(path.join(runtimeRoot, 'tools', 'wechat-reader.exe')),
  'stale compiled Reader must not shadow the source runtime');

const env = resolveReaderChildEnv(spec.kind, {});
assert.strictEqual(env.PYTHONUTF8, '1');
assert.strictEqual(env.PYTHONIOENCODING, 'utf-8');

const bridge = fs.readFileSync(
  path.join(runtimeRoot, 'product', 'bridge', 'ndjson_main.py'),
  'utf8'
);
assert.match(bridge, /BRIDGE_VERSION\s*=\s*"2"/);

// A user-level override left by an older installer must not hide the portable
// runtime bundled with a newer Windows package.
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
const originalResourcesPath = process.resourcesPath;
const originalReaderHome = process.env.WLR_READER_HOME;
try {
  Object.defineProperty(process, 'platform', { value: 'win32' });
  process.resourcesPath = path.join(root, 'release', 'win-unpacked', 'resources');
  process.env.WLR_READER_HOME = path.join(root, 'missing-old-reader-home');
  const staleOverrideFallback = resolveReaderRuntime();
  assert.strictEqual(staleOverrideFallback.kind, 'portable-python');
  assert.strictEqual(
    staleOverrideFallback.command,
    path.join(runtimeRoot, 'python-win', 'python.exe')
  );
} finally {
  Object.defineProperty(process, 'platform', originalPlatform);
  if (originalResourcesPath === undefined) delete process.resourcesPath;
  else process.resourcesPath = originalResourcesPath;
  if (originalReaderHome === undefined) delete process.env.WLR_READER_HOME;
  else process.env.WLR_READER_HOME = originalReaderHome;
}

console.log('WeChat portable Windows Reader runtime passed');
