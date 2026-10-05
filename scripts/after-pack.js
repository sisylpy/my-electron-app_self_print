const path = require('path');
const { execFileSync } = require('child_process');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  // Development and internal test builds do not have an Apple Developer ID.
  // Leaving the bundle completely unsigned prevents macOS from retaining it
  // in Privacy & Security > Accessibility. An ad-hoc signature gives the app
  // a stable bundle identity so users can grant the window-control permission
  // required for side-by-side WeChat docking. A production Developer ID can
  // replace this later without changing the application code.
  execFileSync('/usr/bin/codesign', [
    '--force',
    '--deep',
    '--sign',
    '-',
    '--timestamp=none',
    appPath,
  ], { stdio: 'inherit' });
};
