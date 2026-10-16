const path = require('path');
const { execFileSync } = require('child_process');

function readSigningIdentities() {
  return execFileSync('/usr/bin/security', [
    'find-identity',
    '-v',
    '-p',
    'codesigning',
  ], { encoding: 'utf8' });
}

function resolveSigningIdentity() {
  const identity = String(process.env.GRAIN_MAC_SIGNING_IDENTITY || '').trim();
  if (identity) {
    const identities = readSigningIdentities();
    if (!identities.includes(identity)) {
      throw new Error(`未找到 GRAIN_MAC_SIGNING_IDENTITY 指定的代码签名身份：${identity}`);
    }
    return identity;
  }
  if (process.env.GRAIN_MAC_ALLOW_ADHOC === '1') {
    console.warn('[mac-sign] 警告：本次显式允许 Ad-hoc 签名，macOS TCC 权限可能无法跨升级保留。');
    return '-';
  }
  throw new Error(
    '缺少稳定的 macOS 代码签名身份。请设置 GRAIN_MAC_SIGNING_IDENTITY；'
    + '仅临时诊断时才可显式设置 GRAIN_MAC_ALLOW_ADHOC=1。'
  );
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );
  const identity = resolveSigningIdentity();

  // 统一在 bundle 内容完成后签名。默认拒绝隐式 Ad-hoc，避免每次构建的 cdhash
  // 改变后被 macOS 当作新应用；本机测试可复用同一份自签名代码签名证书。
  execFileSync('/usr/bin/codesign', [
    '--force',
    '--deep',
    '--sign',
    identity,
    '--timestamp=none',
    appPath,
  ], { stdio: 'inherit' });

  execFileSync('/usr/bin/codesign', [
    '--verify',
    '--deep',
    '--strict',
    '--verbose=2',
    appPath,
  ], { stdio: 'inherit' });
  execFileSync('/usr/bin/codesign', [
    '-d',
    '-r-',
    appPath,
  ], { stdio: 'inherit' });
};

module.exports.resolveSigningIdentity = resolveSigningIdentity;
