const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  decodeWechatImageEnvelope,
  findWxgfHevcPartition,
} = require('../src/wechat/image-container-decoder');

const V1_MAGIC = Buffer.from([0x07, 0x08, 0x56, 0x31, 0x08, 0x07]);
const V2_MAGIC = Buffer.from([0x07, 0x08, 0x56, 0x32, 0x08, 0x07]);

function encodeVersioned(payload, magic, key, xorKey = 0, aesSize = payload.length, xorSize = 0) {
  const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from(key, 'ascii'), null);
  cipher.setAutoPadding(true);
  const encrypted = Buffer.concat([cipher.update(payload.subarray(0, aesSize)), cipher.final()]);
  const raw = payload.subarray(aesSize, payload.length - xorSize);
  const tail = Buffer.from(payload.subarray(payload.length - xorSize));
  for (let index = 0; index < tail.length; index += 1) tail[index] ^= xorKey;
  const header = Buffer.alloc(15);
  magic.copy(header);
  header.writeUInt32LE(aesSize, 6);
  header.writeUInt32LE(xorSize, 10);
  header[14] = xorKey;
  return Buffer.concat([header, encrypted, raw, tail]);
}

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x01, 0x02, 0x03]);

const legacyKey = 0x5a;
const legacy = Buffer.from(jpeg.map(value => value ^ legacyKey));
assert.deepEqual(
  Buffer.from(decodeWechatImageEnvelope({ encryptedBase64: legacy.toString('base64') }).base64, 'base64'),
  jpeg,
);

const v1 = encodeVersioned(jpeg, V1_MAGIC, 'cfcd208495d565ef');
assert.deepEqual(
  Buffer.from(decodeWechatImageEnvelope({ encryptedBase64: v1.toString('base64') }).base64, 'base64'),
  jpeg,
);

const v2Key = '0123456789abcdef';
const v2 = encodeVersioned(jpeg, V2_MAGIC, v2Key, 31, 4, 3);
assert.deepEqual(
  Buffer.from(decodeWechatImageEnvelope({
    encryptedBase64: v2.toString('base64'),
    v2Candidates: [{ aesKey: 'bad-key' }, { aesKey: v2Key, xorKey: 31 }],
  }).base64, 'base64'),
  jpeg,
);

// Production V2 files normally encrypt exactly 1024 plaintext bytes. PKCS#7
// therefore contributes an additional 16-byte ciphertext block; this case
// previously failed even with the correct account key.
const alignedPayload = Buffer.concat([jpeg, Buffer.alloc(1200, 0xab)]);
const alignedV2 = encodeVersioned(alignedPayload, V2_MAGIC, v2Key, 31, 1024, 27);
assert.deepEqual(
  Buffer.from(decodeWechatImageEnvelope({
    encryptedBase64: alignedV2.toString('base64'),
    v2Candidates: [{ aesKey: v2Key, xorKey: 31 }],
  }).base64, 'base64'),
  alignedPayload,
);

// Current macOS WeChat often stores the full-size image as WXGF while keeping
// a tiny JPEG thumbnail beside it.  The thumbnail must never be returned as
// order input: the user must open the original in WeChat so that the readable
// high-quality variant is downloaded first.
const wxgfPayload = Buffer.concat([Buffer.from('wxgf', 'ascii'), Buffer.alloc(1200, 0xcd)]);
const wxgfV2 = encodeVersioned(wxgfPayload, V2_MAGIC, v2Key, 31, 1024, 27);
const thumbnailJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x11, 0x22, 0x33]);
const thumbnailV2 = encodeVersioned(thumbnailJpeg, V2_MAGIC, v2Key, 31, 4, 3);
assert.throws(
  () => decodeWechatImageEnvelope({
    encryptedVariants: [
      { kind: 'original', encryptedBase64: wxgfV2.toString('base64') },
      { kind: 'thumbnail', encryptedBase64: thumbnailV2.toString('base64') },
    ],
    v2Candidates: [{ aesKey: v2Key, xorKey: 31 }],
  }),
  /完整打开原图/,
);

// WXGF stores one or more Annex-B HEVC partitions. Each start code is
// preceded by a four-byte big-endian partition length; the still image is the
// largest partition. This verifies that container parsing does not accidentally
// send the WXGF header itself to the video decoder.
const smallHevc = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x26, 0x11]);
const largeHevc = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x40, 0x22, 0x33, 0x44]);
const wxgfHeader = Buffer.alloc(15);
Buffer.from('wxgf', 'ascii').copy(wxgfHeader);
wxgfHeader[4] = wxgfHeader.length;
const smallLength = Buffer.alloc(4);
smallLength.writeUInt32BE(smallHevc.length);
const largeLength = Buffer.alloc(4);
largeLength.writeUInt32BE(largeHevc.length);
assert.deepEqual(
  findWxgfHevcPartition(Buffer.concat([wxgfHeader, smallLength, smallHevc, largeLength, largeHevc])),
  largeHevc,
);

const highQualityJpeg = Buffer.concat([jpeg, Buffer.alloc(2048, 0xef)]);
const highQualityV2 = encodeVersioned(highQualityJpeg, V2_MAGIC, v2Key, 31, 1024, 27);
assert.deepEqual(
  Buffer.from(decodeWechatImageEnvelope({
    encryptedVariants: [
      { kind: 'high', encryptedBase64: highQualityV2.toString('base64') },
      { kind: 'thumbnail', encryptedBase64: thumbnailV2.toString('base64') },
    ],
    v2Candidates: [{ aesKey: v2Key, xorKey: 31 }],
  }).base64, 'base64'),
  highQualityJpeg,
);

console.log('WeChat image container decoder tests passed');
