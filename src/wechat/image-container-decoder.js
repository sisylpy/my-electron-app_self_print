const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const V1_MAGIC = Buffer.from([0x07, 0x08, 0x56, 0x31, 0x08, 0x07]);
const V2_MAGIC = Buffer.from([0x07, 0x08, 0x56, 0x32, 0x08, 0x07]);
const V1_AES_KEY = Buffer.from('cfcd208495d565ef', 'ascii');
const WXGF_MAGIC = Buffer.from('wxgf', 'ascii');
// The existing OCR endpoint limits the base64 string itself to 10 MiB. Keep
// the decoded payload below 7 MiB so the 4/3 base64 expansion remains safe.
const MAX_DECODED_BYTES = 7 * 1024 * 1024;
const WXGF_CONVERT_TIMEOUT_MS = 30_000;
const WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED = 'WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED';

function originalImageNotDownloaded(message) {
  const error = new Error(message);
  error.code = WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED;
  return error;
}

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
  // WeChat pads this AES segment with PKCS#7. Even when aesSize is already a
  // multiple of 16 (the common V2 value is 1024), PKCS#7 adds one complete
  // block. Using a normal ceil here drops that final block and makes every
  // aligned V2 image look as though its key were wrong.
  const encryptedSize = (Math.floor(aesSize / 16) + 1) * 16;
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

function decodeEncryptedVariant(encrypted, v2Candidates) {
  if (!encrypted.length) throw new Error('微信图片数据为空');
  let decoded;
  if (encrypted.subarray(0, V1_MAGIC.length).equals(V1_MAGIC)) {
    decoded = decodeVersioned(encrypted, V1_AES_KEY, 0);
  } else if (encrypted.subarray(0, V2_MAGIC.length).equals(V2_MAGIC)) {
    for (const candidate of v2Candidates) {
      try {
        const key = Buffer.from(String(candidate?.aesKey || ''), 'ascii');
        if (key.length !== 16) continue;
        const value = decodeVersioned(encrypted, key, Number(candidate?.xorKey) & 0xff);
        if (detectImageMime(value) || value.subarray(0, WXGF_MAGIC.length).equals(WXGF_MAGIC)) {
          decoded = value;
          break;
        }
      } catch {
        // Try the next account-local candidate. No key material is logged.
      }
    }
    if (!decoded) throw new Error('DECODE_FAILED');
  } else {
    decoded = decodeLegacyXor(encrypted);
  }
  const mimeType = detectImageMime(decoded);
  if (!mimeType) {
    if (decoded.subarray(0, WXGF_MAGIC.length).equals(WXGF_MAGIC)) {
      return { containerType: 'wxgf', buffer: decoded, size: decoded.length };
    }
    throw new Error('UNSUPPORTED_FORMAT');
  }
  if (decoded.length > MAX_DECODED_BYTES) throw new Error('微信图片过大，暂时无法识别');
  return { mimeType, base64: decoded.toString('base64'), size: decoded.length };
}

function findWxgfHevcPartition(buffer) {
  if (buffer.length < 15 || !buffer.subarray(0, WXGF_MAGIC.length).equals(WXGF_MAGIC)) {
    throw new Error('微信 WXGF 图片容器无效');
  }
  const headerLength = buffer[4];
  if (headerLength >= buffer.length) throw new Error('微信 WXGF 图片头长度异常');

  const patterns = [Buffer.from([0x00, 0x00, 0x00, 0x01]), Buffer.from([0x00, 0x00, 0x01])];
  for (const pattern of patterns) {
    const partitions = [];
    let offset = 0;
    while (headerLength + offset <= buffer.length) {
      const index = buffer.indexOf(pattern, headerLength + offset);
      if (index < 0) break;
      if (index < 4) {
        offset = index - headerLength + 1;
        continue;
      }
      const length = buffer.readUInt32BE(index - 4);
      if (length > 0 && index + length <= buffer.length) {
        partitions.push({ offset: index, length });
        offset = index - headerLength + length;
      } else {
        offset = index - headerLength + 1;
      }
    }
    if (partitions.length) {
      const largest = partitions.reduce((best, value) => value.length > best.length ? value : best);
      return buffer.subarray(largest.offset, largest.offset + largest.length);
    }
  }
  throw new Error('微信 WXGF 图片中没有找到可解码的高清画面');
}

function bundledWindowsFfmpegPath(resourcesPath) {
  return path.join(resourcesPath, 'wechat-image-tools', 'ffmpeg.exe');
}

function resolveFfmpegPath(options = {}) {
  const platform = options.platform || process.platform;
  const resourcesPath = options.resourcesPath || process.resourcesPath || '';
  if (platform === 'win32' && resourcesPath) {
    const packagedWindowsFfmpeg = bundledWindowsFfmpegPath(resourcesPath);
    if (fs.existsSync(packagedWindowsFfmpeg)) return packagedWindowsFfmpeg;
  }
  let ffmpegPath;
  try {
    ffmpegPath = require('ffmpeg-static');
  } catch {
    throw new Error('微信高清图片解码组件未安装');
  }
  if (!ffmpegPath) throw new Error('微信高清图片解码组件不可用');
  if (ffmpegPath.includes('app.asar')) {
    const unpackedPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
    if (fs.existsSync(unpackedPath)) ffmpegPath = unpackedPath;
  }
  return ffmpegPath;
}

function convertHevcToJpeg(hevc, options = {}) {
  const ffmpegPath = options.ffmpegPath || resolveFfmpegPath();
  const spawnProcess = options.spawnProcess || spawn;
  return new Promise((resolve, reject) => {
    const child = spawnProcess(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vframes', '1',
      '-c:v', 'mjpeg',
      '-q:v', '4',
      '-f', 'image2',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    let outputSize = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      fail(new Error('微信高清原图解码超时'));
    }, options.timeoutMs || WXGF_CONVERT_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      outputSize += chunk.length;
      if (outputSize > MAX_DECODED_BYTES) {
        child.kill('SIGKILL');
        fail(new Error('微信高清原图解码结果过大'));
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.reduce((total, value) => total + value.length, 0) < 64 * 1024) stderr.push(chunk);
    });
    child.on('error', () => fail(new Error('微信高清原图解码组件启动失败')));
    child.on('close', (code) => {
      if (settled) return;
      clearTimeout(timer);
      const output = Buffer.concat(stdout);
      if (code !== 0 || detectImageMime(output) !== 'image/jpeg') {
        const detail = Buffer.concat(stderr).toString('utf8').trim().split('\n').pop();
        fail(new Error(detail ? `微信高清原图解码失败：${detail}` : '微信高清原图解码失败'));
        return;
      }
      settled = true;
      resolve(output);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(hevc);
  });
}

async function decodeWechatImageEnvelopeAsync(envelope, options = {}) {
  const variants = Array.isArray(envelope?.encryptedVariants) && envelope.encryptedVariants.length
    ? envelope.encryptedVariants
    : [{ kind: 'original', encryptedBase64: envelope?.encryptedBase64 }];
  const candidates = Array.isArray(envelope?.v2Candidates) ? envelope.v2Candidates : [];
  let wxgf = null;
  let sawPayload = false;
  let sawThumbnail = false;
  for (const variant of variants) {
    if (variant?.kind === 'thumbnail') {
      if (variant?.encryptedBase64) sawThumbnail = true;
      continue;
    }
    const encrypted = Buffer.from(String(variant?.encryptedBase64 || ''), 'base64');
    if (!encrypted.length) continue;
    sawPayload = true;
    try {
      const decoded = decodeEncryptedVariant(encrypted, candidates);
      if (decoded.containerType === 'wxgf') {
        wxgf = decoded.buffer;
        continue;
      }
      return decoded;
    } catch {
      // A lower-priority full-size variant may still be usable.
    }
  }
  if (wxgf) {
    const hevc = findWxgfHevcPartition(wxgf);
    const jpeg = await convertHevcToJpeg(hevc, options);
    return { mimeType: 'image/jpeg', base64: jpeg.toString('base64'), size: jpeg.length };
  }
  if (!sawPayload && sawThumbnail) {
    throw originalImageNotDownloaded('微信尚未下载这张图片的高清原图，目前只有聊天缩略图。请在微信中完整打开原图，待加载完成后重试');
  }
  if (!sawPayload) throw new Error('微信图片数据为空');
  throw new Error('微信图片解码失败，请先在微信中打开原图后重试');
}

function decodeWechatImageEnvelope(envelope) {
  const variants = Array.isArray(envelope?.encryptedVariants) && envelope.encryptedVariants.length
    ? envelope.encryptedVariants
    : [{ kind: 'original', encryptedBase64: envelope?.encryptedBase64 }];
  const candidates = Array.isArray(envelope?.v2Candidates) ? envelope.v2Candidates : [];
  let sawWxgf = false;
  let sawPayload = false;
  let sawThumbnail = false;
  for (const variant of variants) {
    // `_t.dat` is only the tiny image rendered in the chat bubble.  It is
    // commonly 118 x 210 and is not suitable for order recognition.  Older
    // code silently returned it whenever the WXGF original could not be
    // decoded, which made the existing OCR modal label a thumbnail as the
    // original image.  A thumbnail may be useful for locating the message in
    // WeChat, but it must never cross this attachment boundary as order input.
    if (variant?.kind === 'thumbnail') {
      if (variant?.encryptedBase64) sawThumbnail = true;
      continue;
    }
    const encrypted = Buffer.from(String(variant?.encryptedBase64 || ''), 'base64');
    if (!encrypted.length) continue;
    sawPayload = true;
    try {
      const decoded = decodeEncryptedVariant(encrypted, candidates);
      if (decoded.containerType === 'wxgf') {
        sawWxgf = true;
        continue;
      }
      return decoded;
    } catch (error) {
      if (error?.message === 'WXGF_UNSUPPORTED') sawWxgf = true;
    }
  }
  if (!sawPayload && sawThumbnail) {
    throw originalImageNotDownloaded('微信尚未下载这张图片的高清原图，目前只有聊天缩略图。请在微信中完整打开原图，待加载完成后重试');
  }
  if (!sawPayload) throw new Error('微信图片数据为空');
  if (sawWxgf) {
    throw originalImageNotDownloaded('微信尚未下载可读取的高清原图，目前只有 WXGF 容器和聊天缩略图。请在微信中完整打开原图，待加载完成后重试');
  }
  throw new Error('微信图片解码失败，请先在微信中打开原图后重试');
}

module.exports = {
  WECHAT_IMAGE_ORIGINAL_NOT_DOWNLOADED,
  decodeWechatImageEnvelope,
  decodeWechatImageEnvelopeAsync,
  bundledWindowsFfmpegPath,
  detectImageMime,
  findWxgfHevcPartition,
  resolveFfmpegPath,
};
