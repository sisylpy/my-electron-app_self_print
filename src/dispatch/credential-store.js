const fs = require('fs');
const path = require('path');

function writePrivateJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value), { encoding: 'utf8', mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // Windows 不支持 POSIX mode；凭证内容仍由 safeStorage 加密。
  }
}

function createCredentialStore({ app, safeStorage }) {
  const sessionPath = path.join(app.getPath('userData'), 'desktop-dispatch-session.json');

  function encryptionAvailable() {
    return Boolean(
      safeStorage
      && typeof safeStorage.isEncryptionAvailable === 'function'
      && safeStorage.isEncryptionAvailable()
    );
  }

  function loadSession() {
    if (!encryptionAvailable() || !fs.existsSync(sessionPath)) return null;
    try {
      const record = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      if (!record || record.version !== 1 || typeof record.encryptedToken !== 'string') {
        return null;
      }
      const token = safeStorage.decryptString(Buffer.from(record.encryptedToken, 'base64'));
      if (!token) return null;
      return {
        accessToken: token,
        expiresAt: record.expiresAt || null,
        userId: record.userId ?? null,
        disId: record.disId ?? null,
        roleCode: record.roleCode ?? null,
        permissions: Array.isArray(record.permissions) ? record.permissions : [],
        persisted: true,
      };
    } catch {
      return null;
    }
  }

  function saveSession(session) {
    if (!encryptionAvailable()) {
      return { saved: false, reason: 'SECURE_STORAGE_UNAVAILABLE' };
    }
    const encryptedToken = safeStorage
      .encryptString(session.accessToken)
      .toString('base64');
    writePrivateJson(sessionPath, {
      version: 1,
      encryptedToken,
      expiresAt: session.expiresAt || null,
      userId: session.userId ?? null,
      disId: session.disId ?? null,
      roleCode: session.roleCode ?? null,
      permissions: Array.isArray(session.permissions) ? session.permissions : [],
    });
    return { saved: true };
  }

  function clearSession() {
    try {
      if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
    } catch {
      // 内存 token 仍会立即清除；磁盘清理失败不阻塞登出请求。
    }
  }

  return {
    encryptionAvailable,
    loadSession,
    saveSession,
    clearSession,
  };
}

module.exports = { createCredentialStore };
