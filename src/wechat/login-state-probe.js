const { execFileSync } = require('child_process');

/**
 * Infer the macOS WeChat login state without starting the Reader or opening any
 * WeChat database. A logged-in WeChat process keeps files below db_storage open.
 * Other platforms return null because there is no equally safe built-in probe.
 *
 * @returns {boolean|null} true/false when known, otherwise null
 */
function detectWechatLoginStateWithoutReader({
  platform = process.platform,
  execFile = execFileSync,
} = {}) {
  if (platform !== 'darwin') return null;

  try {
    const pids = String(execFile('pgrep', ['-x', 'WeChat'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }) || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!pids.length) return false;

    const openFiles = String(execFile('lsof', ['-Fn', '-p', pids.join(',')], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 4 * 1024 * 1024,
    }) || '');

    return /\/xwechat_files\/[^/]+\/db_storage\//i.test(openFiles);
  } catch {
    return null;
  }
}

module.exports = {
  detectWechatLoginStateWithoutReader,
};
