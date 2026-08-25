'use strict';

const { DEFAULT_PRINTER_PROFILE } = require('./config');

function assertPlainObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${fieldName} 必须是普通对象`);
  }
}

function assertOptionalFiniteNumber(value, fieldName) {
  if (value === undefined || value === null || value === '') return;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new TypeError(`${fieldName} 必须是有效数字`);
  }
}

function assertOptionalText(value, fieldName, maxLength = 200) {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new TypeError(`${fieldName} 必须是长度不超过 ${maxLength} 的字符串`);
  }
}

function assertOptionalBoolean(value, fieldName) {
  if (value === undefined || typeof value === 'boolean') return;
  throw new TypeError(`${fieldName} 必须是布尔值`);
}

function assertPaperCount(value) {
  if (value === undefined || value === null || value === '') return;
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue < 0 || numericValue > 10000) {
    throw new RangeError('paperCount 必须是 0 到 10000 的整数');
  }
}

function assertOptionalOrderIds(value) {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value) || value.length === 0 || value.length > 1000) {
    throw new RangeError('orderIds 必须是包含 1 到 1000 个订单编号的数组');
  }
  const seen = new Set();
  for (const orderId of value) {
    const numericValue = Number(orderId);
    if (!Number.isInteger(numericValue) || numericValue <= 0 || seen.has(numericValue)) {
      throw new TypeError('orderIds 包含无效或重复的订单编号');
    }
    seen.add(numericValue);
  }
}

/**
 * 兼容历史接口允许数字字符串和可选 ID，只阻止对象、NaN、超长字符串等异常载荷。
 */
function assertPrintMetadata(metadata = {}) {
  assertPlainObject(metadata, 'printMetadata');
  for (const [fieldName, value] of Object.entries({
    depFatherId: metadata.depFatherId,
    depId: metadata.depId,
    gbDepFatherId: metadata.gbDepFatherId,
    gbDepId: metadata.gbDepId,
    gbBatchId: metadata.gbBatchId,
    userId: metadata.userId,
    nxDisId: metadata.nxDisId,
  })) {
    assertOptionalFiniteNumber(value, fieldName);
  }
  assertOptionalText(metadata.tradeNo, 'tradeNo');
  assertPaperCount(metadata.paperCount);
  assertOptionalBoolean(metadata.shouldSave, 'shouldSave');
  assertOptionalBoolean(metadata.isHistoryOrder, 'isHistoryOrder');
  assertOptionalOrderIds(metadata.orderIds);
}

function numberInRange(value, fieldName, minimum, maximum, fallback) {
  const candidate = value === undefined || value === null ? fallback : Number(value);
  if (!Number.isFinite(candidate) || candidate < minimum || candidate > maximum) {
    throw new RangeError(`${fieldName} 超出允许范围 ${minimum}-${maximum}`);
  }
  return candidate;
}

function sanitizePrinterProfile(profile) {
  assertPlainObject(profile, 'profile');
  return {
    safeLeftMm: numberInRange(profile.safeLeftMm, 'safeLeftMm', 0, 100, DEFAULT_PRINTER_PROFILE.safeLeftMm),
    safeRightMm: numberInRange(profile.safeRightMm, 'safeRightMm', 0, 100, DEFAULT_PRINTER_PROFILE.safeRightMm),
    distributorNameFontSize: numberInRange(
      profile.distributorNameFontSize,
      'distributorNameFontSize',
      6,
      72,
      DEFAULT_PRINTER_PROFILE.distributorNameFontSize
    ),
    orderContentFontSize: numberInRange(
      profile.orderContentFontSize,
      'orderContentFontSize',
      6,
      72,
      DEFAULT_PRINTER_PROFILE.orderContentFontSize
    ),
    lineHeight: numberInRange(profile.lineHeight, 'lineHeight', 8, 100, DEFAULT_PRINTER_PROFILE.lineHeight),
    headerFontSize: numberInRange(
      profile.headerFontSize,
      'headerFontSize',
      6,
      72,
      DEFAULT_PRINTER_PROFILE.headerFontSize
    ),
    zoomFactor: numberInRange(profile.zoomFactor, 'zoomFactor', 0.5, 1.5, DEFAULT_PRINTER_PROFILE.zoomFactor),
    maxPrintableWidth: numberInRange(
      profile.maxPrintableWidth,
      'maxPrintableWidth',
      100,
      300,
      DEFAULT_PRINTER_PROFILE.maxPrintableWidth
    ),
  };
}

function assertDeviceConfigResponse(deviceConfig, printParams) {
  assertPlainObject(printParams, 'printParams');
  if (deviceConfig !== null && deviceConfig !== undefined) {
    assertPlainObject(deviceConfig, 'deviceConfig');
    if (Buffer.byteLength(JSON.stringify(deviceConfig), 'utf8') > 64 * 1024) {
      throw new RangeError('deviceConfig 超过 64KB 限制');
    }
  }
  assertPrintMetadata(printParams);
}

module.exports = {
  assertDeviceConfigResponse,
  assertPrintMetadata,
  sanitizePrinterProfile,
};
