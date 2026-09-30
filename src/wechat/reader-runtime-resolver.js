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

function resolveReaderRuntime() {
  const executable = String(process.env.WLR_READER_EXE || '').trim();
  if (executable) {
    return { kind: 'executable', command: executable, args: [], cwd: process.cwd() };
  }

  const configuredHome = String(process.env.WLR_READER_HOME || '').trim();
  if (configuredHome) {
    const configured = tryPythonModule(configuredHome);
    if (configured) return configured;
    throw new ReaderRuntimeConfigError('WLR_READER_HOME 不是有效的 Reader 目录');
  }

  // src/**/* 会被 electron-builder 原样放进 resources/app；开发和安装后均从本模块旁读取。
  const bundled = tryPythonModule(path.join(__dirname, 'reader-runtime'));
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
  if (kind === 'python-module') {
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
};
