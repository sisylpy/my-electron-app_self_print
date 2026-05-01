/**
 * 打印机配置管理工具
 * 统一从文件系统读取配置，不使用缓存
 * 配置文件统一存储在 printer-config.json 中
 */

/**
 * 默认配置
 */
const DEFAULT_PROFILE = {
    safeLeftMm: 12,
    safeRightMm: 12,
    distributorNameFontSize: 18,
    orderContentFontSize: 14,
    lineHeight: 24,  // 行间距（px），默认 24px
    headerFontSize: 14,  // 表头字体大小（px），默认 14px
    zoomFactor: 1.0,  // 缩放系数，默认 1.0（不缩放）
    maxPrintableWidth: 200  // 最大可打印宽度（mm），内容区域上限，不同打印机可调整 180-205
};

/**
 * 获取当前打印机名称（从文件系统读取）
 * @returns {Promise<string>} 返回打印机名称，如果未配置则返回空字符串
 */
export async function getCurrentPrinterName() {
    try {
        if (window.electronAPI && window.electronAPI.getDefaultPrinter) {
            const result = await window.electronAPI.getDefaultPrinter();
            if (result.success && result.printerName) {
                console.log('✅ [getCurrentPrinterName] 获取到打印机名称:', result.printerName);
                return result.printerName;
            } else {
                console.warn('⚠️ [getCurrentPrinterName] 未找到配置的打印机');
            }
        } else {
            console.warn('⚠️ [getCurrentPrinterName] electronAPI.getDefaultPrinter 不可用');
        }
        return '';
    } catch (error) {
        console.warn('❌ [getCurrentPrinterName] 获取打印机名称失败:', error);
        return '';
    }
}

/**
 * 保存打印机配置文件（统一保存到文件系统，不使用缓存）
 * @param {string} deviceName - 打印机名称（可选，如果不提供则自动获取当前配置的打印机名称）
 * @param {Object} profile - 配置对象
 */
export async function savePrinterProfile(deviceName, profile) {
    // 如果没有提供 deviceName，自动获取当前配置的打印机名称
    let actualDeviceName = deviceName;
    if (!actualDeviceName) {
        actualDeviceName = await getCurrentPrinterName();
        if (!actualDeviceName) {
            console.error('❌ [savePrinterProfile] 无法获取打印机名称，请先在 Screen.vue 中设置打印机');
            throw new Error('未配置打印机，请先在系统设置中选择打印机');
        }
    }
    
    // 只保存需要的字段，确保不包含 scale 等旧字段
    const cleanProfile = {
        safeLeftMm: profile.safeLeftMm ?? DEFAULT_PROFILE.safeLeftMm,
        safeRightMm: profile.safeRightMm ?? DEFAULT_PROFILE.safeRightMm,
        distributorNameFontSize: profile.distributorNameFontSize ?? DEFAULT_PROFILE.distributorNameFontSize,
        orderContentFontSize: profile.orderContentFontSize ?? DEFAULT_PROFILE.orderContentFontSize,
        lineHeight: profile.lineHeight ?? DEFAULT_PROFILE.lineHeight,  // 行间距
        headerFontSize: profile.headerFontSize ?? DEFAULT_PROFILE.headerFontSize,  // 表头字体大小
        zoomFactor: profile.zoomFactor ?? DEFAULT_PROFILE.zoomFactor,  // 缩放系数
        maxPrintableWidth: profile.maxPrintableWidth ?? DEFAULT_PROFILE.maxPrintableWidth  // 最大可打印宽度
    };
    
    console.log('💾 [savePrinterProfile] 保存配置到文件系统:', {
        printerName: actualDeviceName,
        profile: cleanProfile
    });
    
    // 统一保存到文件系统（printer-profiles.json），使用实际打印机名称作为键
    if (window.electronAPI && window.electronAPI.savePrinterProfile) {
        try {
            const result = await window.electronAPI.savePrinterProfile(actualDeviceName, cleanProfile);
            if (result.success) {
                console.log('✅ [savePrinterProfile] 配置已保存到文件系统，打印机:', actualDeviceName);
            } else {
                console.error('❌ [savePrinterProfile] 保存失败:', result.error);
                throw new Error(result.error || '保存失败');
            }
        } catch (error) {
            console.error('❌ [savePrinterProfile] 保存出错:', error);
            throw error;
        }
    } else {
        throw new Error('electronAPI.savePrinterProfile 不可用');
    }
}

/**
 * 加载打印机配置文件（从文件系统读取，不使用缓存）
 * 
 * 重要说明：
 * - 配置存储在 printer-profiles.json 文件中，使用打印机名称作为键
 * - 每次调用都从文件系统读取，不使用缓存
 * - 如果未提供 deviceName，自动获取当前配置的打印机名称
 * 
 * @param {string} deviceName - 打印机名称（可选，如果不提供则自动获取当前配置的打印机名称）
 * @param {Object} defaultProfile - 默认配置（可选，如果不提供则使用全局默认值）
 * @returns {Promise<Object>} 配置对象
 */
export async function loadPrinterProfile(deviceName, defaultProfile = null) {
    const defaultConfig = defaultProfile || DEFAULT_PROFILE;
    
    // 如果没有提供 deviceName，自动获取当前配置的打印机名称
    let actualDeviceName = deviceName;
    if (!actualDeviceName) {
        actualDeviceName = await getCurrentPrinterName();
        if (!actualDeviceName) {
            console.warn('⚠️ [loadPrinterProfile] 未配置打印机，使用默认配置');
            return defaultConfig;
        }
    }
    
    console.log('📂 [loadPrinterProfile] 开始加载配置，打印机名称:', actualDeviceName);
    
    // 从文件系统加载配置（每次都读取，不使用缓存）
    if (window.electronAPI && window.electronAPI.loadPrinterProfile) {
        try {
            const result = await window.electronAPI.loadPrinterProfile(actualDeviceName);
            
            if (result.success && result.profile) {
                // 清理并返回配置
                const profile = {
                    safeLeftMm: result.profile.safeLeftMm ?? defaultConfig.safeLeftMm,
                    safeRightMm: result.profile.safeRightMm ?? defaultConfig.safeRightMm,
                    distributorNameFontSize: result.profile.distributorNameFontSize ?? defaultConfig.distributorNameFontSize,
                    orderContentFontSize: result.profile.orderContentFontSize ?? defaultConfig.orderContentFontSize,
                    lineHeight: result.profile.lineHeight ?? defaultConfig.lineHeight,
                    headerFontSize: result.profile.headerFontSize ?? defaultConfig.headerFontSize,
                    zoomFactor: result.profile.zoomFactor ?? defaultConfig.zoomFactor,
                    maxPrintableWidth: result.profile.maxPrintableWidth ?? defaultConfig.maxPrintableWidth
                };
                
                console.log('📂 [loadPrinterProfile] 从文件系统加载配置:', {
                    printerName: actualDeviceName,
                    '原始profile': result.profile,
                    '清理后的profile': profile,
                    '缩放系数': profile.zoomFactor,
                    '行间距': profile.lineHeight,
                    '原始profile中的lineHeight': result.profile?.lineHeight,
                    '清理后profile中的lineHeight': profile.lineHeight
                });
                
                return profile;
            } else {
                console.log('ℹ️ [loadPrinterProfile] 文件系统中未找到该打印机的配置，使用默认配置，打印机:', actualDeviceName);
            }
        } catch (error) {
            console.warn('⚠️ [loadPrinterProfile] 从文件系统加载失败，使用默认配置:', error, '打印机:', actualDeviceName);
        }
    }
    
    // 如果文件系统没有配置，返回默认配置
    console.log('ℹ️ [loadPrinterProfile] 使用默认配置，打印机:', actualDeviceName);
    return defaultConfig;
}

/**
 * 应用打印机配置到CSS变量
 * @param {Object} profile - 配置对象
 * @param {Object} componentInstance - Vue组件实例（可选，用于更新组件数据）
 */
export function applyPrinterProfile(profile, componentInstance = null) {
    const root = document.documentElement.style;
    
    // 使用 ?? 而不是 ||，避免 0 值被替换
    const safeLeftMm = profile.safeLeftMm ?? DEFAULT_PROFILE.safeLeftMm;
    const safeRightMm = profile.safeRightMm ?? DEFAULT_PROFILE.safeRightMm;
    const distributorNameFontSize = profile.distributorNameFontSize ?? DEFAULT_PROFILE.distributorNameFontSize;
    const orderContentFontSize = profile.orderContentFontSize ?? DEFAULT_PROFILE.orderContentFontSize;
    const lineHeight = profile.lineHeight ?? DEFAULT_PROFILE.lineHeight;
    const headerFontSize = profile.headerFontSize ?? DEFAULT_PROFILE.headerFontSize;
    const zoomFactor = profile.zoomFactor ?? DEFAULT_PROFILE.zoomFactor;
    
    // 如果提供了组件实例，更新组件数据
    if (componentInstance) {
        const oldZoomFactor = componentInstance.zoomFactor;
        componentInstance.currentLeftMargin = safeLeftMm;
        componentInstance.currentRightMargin = safeRightMm;
        componentInstance.distributorNameFontSize = distributorNameFontSize;
        componentInstance.orderContentFontSize = orderContentFontSize;
        componentInstance.lineHeight = lineHeight; // 更新组件的行间距
        componentInstance.headerFontSize = headerFontSize; // 更新组件的表头字体大小
        componentInstance.zoomFactor = zoomFactor; // 关键：更新组件的 zoomFactor
        
        console.log('🔍 [applyPrinterProfile] 更新组件配置:', {
            oldZoomFactor,
            newZoomFactor: zoomFactor,
            changed: oldZoomFactor !== zoomFactor,
            lineHeight: {
                profile中的值: profile.lineHeight,
                使用的值: lineHeight,
                组件旧值: componentInstance.lineHeight,
                组件新值: lineHeight,
                是否变化: componentInstance.lineHeight !== lineHeight
            },
            componentInstance: componentInstance.$options?.name || 'unknown'
        });
    }
    
    // 设置CSS变量
    root.setProperty('--safe-left-mm', String(safeLeftMm));
    root.setProperty('--safe-right-mm', String(safeRightMm));
    root.setProperty('--distributor-name-font-size', String(distributorNameFontSize) + 'px');
    root.setProperty('--order-content-font-size', String(orderContentFontSize) + 'px');
    root.setProperty('--line-height', String(lineHeight) + 'px');
    root.setProperty('--header-font-size', String(headerFontSize) + 'px');
    
}

/**
 * 初始化打印机配置
 * @param {Object} componentInstance - Vue组件实例
 * @param {Object} defaultProfile - 默认配置（可选）
 */
export async function initPrinterProfile(componentInstance, defaultProfile = null) {
    try {
        // 获取当前配置的打印机名称（从 Screen.vue 设置中获取）
        const printerName = await getCurrentPrinterName();
        
        if (!printerName) {
            console.warn('⚠️ [initPrinterProfile] 未配置打印机，使用默认配置');
            console.warn('⚠️ [initPrinterProfile] 提示：请在 Screen.vue 中先设置并保存打印机');
            const defaultConfig = defaultProfile || DEFAULT_PROFILE;
            applyPrinterProfile(defaultConfig, componentInstance);
            return;
        }
        
        console.log('🔄 [initPrinterProfile] 使用打印机名称:', printerName);
        
        // loadPrinterProfile 现在是异步的，会自动使用打印机名称
        const profile = await loadPrinterProfile(printerName, defaultProfile);
        
        console.log('🔄 [initPrinterProfile] 加载的配置:', {
            printerName,
            profile,
            zoomFactor: profile.zoomFactor
        });
        
        applyPrinterProfile(profile, componentInstance);
    } catch (error) {
        console.warn('⚠️ [initPrinterProfile] 初始化打印机配置失败:', error);
        const defaultConfig = defaultProfile || DEFAULT_PROFILE;
        applyPrinterProfile(defaultConfig, componentInstance);
    }
}

/**
 * 导出默认配置（供各模板自定义使用）
 */
export { DEFAULT_PROFILE };

