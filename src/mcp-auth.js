const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function ensurePrivateDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(directoryPath, 0o700);
  } catch {}
}

function readOrCreateToken(filePath) {
  ensurePrivateDirectory(path.dirname(filePath));
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8').trim();
    if (existing.length >= 32) {
      try {
        fs.chmodSync(filePath, 0o600);
      } catch {}
      return existing;
    }
  }
  const token = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(filePath, `${token}\n`, {
    encoding: 'utf8',
    mode: 0o600
  });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {}
  return token;
}

function getMcpCliBridgeTokenPath() {
  const override = process.env.GRAIN_MCP_BRIDGE_TOKEN_FILE;
  if (override && path.isAbsolute(override)) {
    return override;
  }
  return path.join(os.homedir(), '.grain-print', 'mcp-bridge-token');
}

function readOrCreateMcpCliBridgeToken() {
  return readOrCreateToken(getMcpCliBridgeTokenPath());
}

module.exports = {
  readOrCreateToken,
  getMcpCliBridgeTokenPath,
  readOrCreateMcpCliBridgeToken
};
