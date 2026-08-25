/**
 * 现有打印模板的纸型合同，用于集中记录并通过测试防止现场参数漂移。
 *
 * 模板内的分页和走纸实现暂不改动；修改任何值前必须重新做真实打印机验收。
 */
export const PAPER_PROFILES = Object.freeze({
    THIRD_STANDARD: Object.freeze({
        label: '1/3纸',
        template: 'ApplyThirtyPanel.vue',
        widthMm: 240,
        heightMm: 93,
        pageRowsCount: 12,
        feedDelayMs: 400
    }),
    THIRD_WHOLE: Object.freeze({
        label: '1/3纸（整单）',
        template: 'ApplyThirtyWholePanel.vue',
        widthMm: 240,
        heightMm: 93,
        legacyPhysicalWidthMm: 241,
        pageRowsCount: 5,
        feedDelayMs: 400
    }),
    HALF_STANDARD: Object.freeze({
        label: '1/2纸',
        template: 'ApplyHalfPanel.vue',
        widthMm: 240,
        heightMm: 140,
        pageRowsCount: 26,
        feedDelayMs: 400
    }),
    HALF_WHOLE: Object.freeze({
        label: '1/2纸（整单）',
        template: 'ApplyHalfWholePanel.vue',
        widthMm: 240,
        heightMm: 140,
        pageRowsCount: 12,
        feedDelayMs: 400
    }),
    FULL_STANDARD: Object.freeze({
        label: '全张纸',
        template: 'ApplyPanel.vue',
        widthMm: 240,
        heightMm: 279,
        pageRowsCount: 30,
        feedDelayMs: 1500
    }),
    FULL_FIFTY: Object.freeze({
        label: '全张纸（大容量）',
        template: 'ApplyFiftyPanel.vue',
        widthMm: 240,
        heightMm: 279,
        pageRowsCount: 60,
        feedDelayMs: 4000
    })
});

export const EPSON_COMPATIBILITY_POLICY = Object.freeze({
    dpiMode: 'driver-managed',
    runtimeZoomFactor: 1.0,
    note: '保留驱动 DPI、现场边距与模板走纸参数，不在 Electron 中二次缩放'
});
