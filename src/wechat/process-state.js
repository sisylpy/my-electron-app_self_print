const { execFileSync } = require('child_process');

function windowsImageIsRunning(execFile, imageName) {
  const output = String(execFile('tasklist.exe', [
    '/FI',
    `IMAGENAME eq ${imageName}`,
    '/FO',
    'CSV',
    '/NH',
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  }) || '');
  return output.toLowerCase().includes(`"${imageName.toLowerCase()}"`);
}

function detectWechatProcessOpen({
  platform = process.platform,
  execFile = execFileSync,
} = {}) {
  try {
    if (platform === 'win32') {
      // Weixin 4.x renamed the main executable. Keep the legacy executable for
      // distributors that have not upgraded yet; never use macOS pgrep here.
      return windowsImageIsRunning(execFile, 'Weixin.exe')
        || windowsImageIsRunning(execFile, 'WeChat.exe');
    }
    if (platform === 'darwin') {
      return Boolean(String(execFile('pgrep', ['-x', 'WeChat'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }) || '').trim());
    }
  } catch {
    return false;
  }
  return false;
}

module.exports = {
  detectWechatProcessOpen,
  windowsImageIsRunning,
};
