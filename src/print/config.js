'use strict';

/**
 * 主进程打印运行参数。
 *
 * 这些值来自当前现场稳定链路，只做集中管理，不改变 Epson 驱动、边距或缩放算法。
 * 纸型、分页和走纸参数仍由现有 Vue 打印模板负责。
 */
const PRINT_RUNTIME_CONFIG = Object.freeze({
  hiddenWindowZoomFactor: 1.0,
  silentMarginsType: 0,
  calibrationMarginsType: 1,
  printBackground: true,
  renderDelayMs: 500,
  requestTimeoutMs: 10000,
  maxHtmlBytes: 50 * 1024 * 1024,
});

const DEFAULT_PRINTER_PROFILE = Object.freeze({
  safeLeftMm: 12,
  safeRightMm: 12,
  distributorNameFontSize: 18,
  orderContentFontSize: 14,
  lineHeight: 24,
  headerFontSize: 14,
  zoomFactor: 1.0,
  maxPrintableWidth: 200,
});

function getDriverManagedDpiOptions() {
  // Epson LQ 系列在不同平台上报告的 DPI 不一致，继续交由已调试过的驱动配置决定。
  return {};
}

function createSilentPrintOptions(deviceName, options = {}) {
  const printOptions = {
    marginsType: PRINT_RUNTIME_CONFIG.silentMarginsType,
    silent: true,
    printBackground: PRINT_RUNTIME_CONFIG.printBackground,
    deviceName: deviceName || '',
    ...getDriverManagedDpiOptions(),
  };

  // 历史打印入口一直显式声明 marginType:none，保留该行为。
  if (options.includeLegacyMargins) {
    printOptions.margins = { marginType: 'none' };
  }
  return printOptions;
}

function createCalibrationPrintOptions(deviceName) {
  return {
    silent: false,
    printBackground: PRINT_RUNTIME_CONFIG.printBackground,
    deviceName: deviceName || '',
    marginsType: PRINT_RUNTIME_CONFIG.calibrationMarginsType,
  };
}

module.exports = {
  DEFAULT_PRINTER_PROFILE,
  PRINT_RUNTIME_CONFIG,
  createCalibrationPrintOptions,
  createSilentPrintOptions,
  getDriverManagedDpiOptions,
};
