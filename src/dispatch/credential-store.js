const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  const devicePath = path.join(app.getPath('userData'), 'desktop-dispatch-device.json');

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

  function getDeviceId() {
    try {
      if (fs.existsSync(devicePath)) {
        const record = JSON.parse(fs.readFileSync(devicePath, 'utf8'));
        if (record && typeof record.deviceId === 'string'
            && /^[A-Za-z0-9._:-]{16,128}$/.test(record.deviceId)) {
          return record.deviceId;
        }
      }
    } catch {
      // 损坏的设备标识将被安全地重新生成。
    }
    const deviceId = `electron-${crypto.randomBytes(24).toString('hex')}`;
    writePrivateJson(devicePath, { version: 1, deviceId });
    return deviceId;
  }

  return {
    encryptionAvailable,
    loadSession,
    saveSession,
    clearSession,
    getDeviceId,
  };
}

module.exports = { createCredentialStore };
