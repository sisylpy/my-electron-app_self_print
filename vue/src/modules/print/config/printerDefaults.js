/**
 * 现场打印校准默认值。
 * 用户针对具体打印机保存的配置仍然优先于这些默认值。
 */
export const DEFAULT_PRINTER_PROFILE = Object.freeze({
    safeLeftMm: 12,
    safeRightMm: 12,
    distributorNameFontSize: 18,
    orderContentFontSize: 14,
    lineHeight: 24,
    headerFontSize: 14,
    zoomFactor: 1.0,
    maxPrintableWidth: 200
});

