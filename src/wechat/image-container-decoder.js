const crypto = require('crypto');

const V1_MAGIC = Buffer.from([0x07, 0x08, 0x56, 0x31, 0x08, 0x07]);
const V2_MAGIC = Buffer.from([0x07, 0x08, 0x56, 0x32, 0x08, 0x07]);
const V1_AES_KEY = Buffer.from('cfcd208495d565ef', 'ascii');
// The existing OCR endpoint limits the base64 string itself to 10 MiB. Keep
// the decoded payload below 7 MiB so the 4/3 base64 expansion remains safe.
const MAX_DECODED_BYTES = 7 * 1024 * 1024;

const IMAGE_SIGNATURES = [
  { mimeType: 'image/jpeg', bytes: Buffer.from([0xff, 0xd8, 0xff]) },
  { mimeType: 'image/png', bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { mimeType: 'image/gif', bytes: Buffer.from('GIF8', 'ascii') },
  { mimeType: 'image/bmp', bytes: Buffer.from('BM', 'ascii') },
  { mimeType: 'image/tiff', bytes: Buffer.from([0x49, 0x49, 0x2a, 0x00]) },
  { mimeType: 'image/tiff', bytes: Buffer.from([0x4d, 0x4d, 0x00, 0x2a]) },
];

function detectImageMime(buffer) {
  for (const signature of IMAGE_SIGNATURES) {
    if (buffer.subarray(0, signature.bytes.length).equals(signature.bytes)) return signature.mimeType;
  }
  if (buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

function decryptAesEcb(ciphertext, key) {
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function decodeVersioned(buffer, key, xorKey) {
  if (buffer.length < 15) throw new Error('微信图片容器不完整');
  const aesSize = buffer.readUInt32LE(6);
  const xorSize = buffer.readUInt32LE(10);
  const encryptedSize = Math.ceil(aesSize / 16) * 16;
  const encryptedStart = 15;
  const encryptedEnd = encryptedStart + encryptedSize;
  if (encryptedEnd > buffer.length || xorSize > buffer.length - encryptedEnd) {
    throw new Error('微信图片容器长度异常');
  }
  const aesPlain = decryptAesEcb(buffer.subarray(encryptedStart, encryptedEnd), key)
    .subarray(0, aesSize);
  const xorStart = buffer.length - xorSize;
  const raw = buffer.subarray(encryptedEnd, xorStart);
  const tail = Buffer.from(buffer.subarray(xorStart));
  for (let index = 0; index < tail.length; index += 1) tail[index] ^= xorKey;
  return Buffer.concat([aesPlain, raw, tail]);
}

function decodeLegacyXor(buffer) {
  for (const signature of IMAGE_SIGNATURES) {
    const key = buffer[0] ^ signature.bytes[0];
    let matches = true;
    for (let index = 1; index < signature.bytes.length && index < buffer.length; index += 1) {
      if ((buffer[index] ^ key) !== signature.bytes[index]) {
        matches = false;
        break;
      }
    }
    if (!matches) continue;
    const decoded = Buffer.allocUnsafe(buffer.length);
    for (let index = 0; index < buffer.length; index += 1) decoded[index] = buffer[index] ^ key;
    return decoded;
  }
  throw new Error('不支持的微信图片格式');
}

function decodeWechatImageEnvelope(envelope) {
  const encrypted = Buffer.from(String(envelope?.encryptedBase64 || ''), 'base64');
  if (!encrypted.length) throw new Error('微信图片数据为空');
  let decoded;
  if (encrypted.subarray(0, V1_MAGIC.length).equals(V1_MAGIC)) {
    decoded = decodeVersioned(encrypted, V1_AES_KEY, 0);
  } else if (encrypted.subarray(0, V2_MAGIC.length).equals(V2_MAGIC)) {
    const candidates = Array.isArray(envelope?.v2Candidates) ? envelope.v2Candidates : [];
    for (const candidate of candidates) {
      try {
        const key = Buffer.from(String(candidate?.aesKey || ''), 'ascii');
        if (key.length !== 16) continue;
        const value = decodeVersioned(encrypted, key, Number(candidate?.xorKey) & 0xff);
        if (detectImageMime(value)) {
          decoded = value;
          break;
        }
      } catch {
        // Try the next account-local candidate. No key material is logged.
      }
    }
    if (!decoded) throw new Error('微信图片解码失败，请先在微信中打开原图后重试');
  } else {
    decoded = decodeLegacyXor(encrypted);
  }
  if (decoded.length > MAX_DECODED_BYTES) throw new Error('微信图片过大，暂时无法识别');
  const mimeType = detectImageMime(decoded);
  if (!mimeType) throw new Error('微信图片格式暂不支持识别');
  return { mimeType, base64: decoded.toString('base64'), size: decoded.length };
}

module.exports = { decodeWechatImageEnvelope, detectImageMime };
