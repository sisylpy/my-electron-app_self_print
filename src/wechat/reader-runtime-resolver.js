const fs = require('fs');
const path = require('path');

class ReaderRuntimeConfigError extends Error {}

function defaultPythonCommand() {
  const configured = String(process.env.WLR_PYTHON || '').trim();
  if (configured) return configured;
  return process.platform === 'win32' ? 'python' : 'python3';
}

function tryPythonModule(home) {
  const normalized = path.resolve(home);
  const entry = path.join(normalized, 'product', 'bridge', 'ndjson_main.py');
  if (!fs.existsSync(entry)) return null;
  return {
    kind: 'python-module',
    command: defaultPythonCommand(),
    args: ['-u', '-m', 'product.bridge.ndjson_main'],
    cwd: normalized,
  };
}

function tryBundledWindowsPython(home, options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== 'win32') return null;
  const resourcesPath = options.resourcesPath || process.resourcesPath || '';
  const homes = [
    path.resolve(home),
    resourcesPath ? path.join(path.resolve(resourcesPath), 'wechat-reader-runtime') : '',
  ].filter(Boolean);
  for (const runtimeHome of homes) {
    const python = path.join(runtimeHome, 'python-win', 'python.exe');
    const entry = path.join(runtimeHome, 'product', 'bridge', 'ndjson_main.py');
    if (!fs.existsSync(python) || !fs.existsSync(entry)) continue;
    return {
      kind: 'portable-python',
      command: python,
      args: ['-u', '-m', 'product.bridge.ndjson_main'],
      cwd: runtimeHome,
    };
  }
  return null;
}

function resolveReaderRuntime() {
  const executable = String(process.env.WLR_READER_EXE || '').trim();
  if (executable) {
    return { kind: 'executable', command: executable, args: [], cwd: process.cwd() };
  }

  const bundledHome = path.join(__dirname, 'reader-runtime');
  const configuredHome = String(process.env.WLR_READER_HOME || '').trim();
  if (configuredHome) {
    const configured = tryPythonModule(configuredHome);
    if (configured) return configured;
    // Old installer/debug builds persisted WLR_READER_HOME at user scope. Once
    // that directory disappears, it must not mask the self-contained runtime
    // shipped by a newer Windows installer.
    const bundledWindowsPython = tryBundledWindowsPython(bundledHome);
    if (bundledWindowsPython) return bundledWindowsPython;
    throw new ReaderRuntimeConfigError('WLR_READER_HOME 不是有效的 Reader 目录');
  }

  // Windows 安装包直接运行同一份 Reader 源码，并携带独立 Python。
  // 这样图片读取修复不会因忘记重编译旧 exe 而丢失。
  const bundledWindowsPython = tryBundledWindowsPython(bundledHome);
  if (bundledWindowsPython) return bundledWindowsPython;

  // Mac 开发和安装后仍可从本模块旁读取 Python 运行时。
  const bundled = tryPythonModule(bundledHome);
  if (bundled) return bundled;

  throw new ReaderRuntimeConfigError('安装包内未找到微信 Reader 运行时');
}

function resolveReaderMaterialEnv() {
  if (process.platform === 'win32') {
    const override = String(process.env.WLR_WIN_MATERIAL_ROOT || '').trim();
    const appData = String(process.env.APPDATA || '').trim();
    const fallbackBase = appData || path.win32.join(
      String(process.env.USERPROFILE || process.env.HOME || '.'),
      'AppData',
      'Roaming'
    );
    const materialRoot = override || path.win32.resolve(
      fallbackBase,
      'nongxinle-pos',
      'reader-materials',
      'windows',
      'materials'
    );
    return {
      env: { ...process.env, WLR_WIN_MATERIAL_ROOT: materialRoot },
      materialRoot,
      source: override ? 'env' : 'pos-canonical',
    };
  }

  if (process.platform === 'darwin') {
    const override = String(process.env.WLR_MAC_MATERIAL_ROOT || '').trim();
    const materialRoot = override || path.resolve(
      String(process.env.HOME || '.'),
      'Library',
      'Application Support',
      'nongxinle-pos',
      'reader-materials',
      'mac',
      'materials'
    );
    return {
      env: { ...process.env, WLR_MAC_MATERIAL_ROOT: materialRoot },
      materialRoot,
      source: override ? 'env' : 'pos-canonical',
    };
  }

  return { env: { ...process.env }, materialRoot: '', source: 'none' };
}

function resolveReaderChildEnv(kind, baseEnv) {
  const env = { ...baseEnv };
  if (kind === 'python-module' || kind === 'portable-python') {
    env.PYTHONUTF8 = '1';
    env.PYTHONIOENCODING = 'utf-8';
  }
  return env;
}

module.exports = {
  ReaderRuntimeConfigError,
  resolveReaderRuntime,
  resolveReaderMaterialEnv,
  resolveReaderChildEnv,
  tryBundledWindowsPython,
};
