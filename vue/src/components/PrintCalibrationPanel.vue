<template>
    <div v-if="visible" style="background: #f5f5f5; border: 1px solid #ddd; margin: 10px; padding: 15px; border-radius: 5px; max-height: 80vh; overflow-y: auto;">
        <h3 style="margin: 0 0 15px 0; color: #333;">🔧 打印校准设置</h3>
        
        <div style="display: flex; gap: 20px; flex-wrap: wrap; align-items: center;">
            <!-- 左侧安全边距 -->
            <div style="display: flex; align-items: center; gap: 5px;">
                <label style="font-weight: bold; min-width: 80px;">左侧边距:</label>
                <button @click="adjustLeftMargin(-1)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-1mm</button>
                <button @click="adjustLeftMargin(-0.5)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-0.5mm</button>
                <span style="min-width: 40px; text-align: center; font-weight: bold;">{{ displayCurrentLeftMargin }}mm</span>
                <button @click="adjustLeftMargin(0.5)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+0.5mm</button>
                <button @click="adjustLeftMargin(1)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+1mm</button>
            </div>

            <!-- 右侧安全边距 -->
            <div style="display: flex; align-items: center; gap: 5px;">
                <label style="font-weight: bold; min-width: 80px;">右侧边距:</label>
                <button @click="adjustRightMargin(-1)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-1mm</button>
                <button @click="adjustRightMargin(-0.5)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-0.5mm</button>
                <span style="min-width: 40px; text-align: center; font-weight: bold;">{{ displayCurrentRightMargin }}mm</span>
                <button @click="adjustRightMargin(0.5)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+0.5mm</button>
                <button @click="adjustRightMargin(1)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+1mm</button>
            </div>

            <!-- 配送商名称字体大小 -->
            <div style="display: flex; align-items: center; gap: 5px;">
                <label style="font-weight: bold; min-width: 100px;">配送商名称:</label>
                <button @click="adjustDistributorNameFontSize(-1)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-1px</button>
                <button @click="adjustDistributorNameFontSize(-0.5)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-0.5px</button>
                <span style="min-width: 50px; text-align: center; font-weight: bold;">{{ displayDistributorNameFontSize }}px</span>
                <button @click="adjustDistributorNameFontSize(0.5)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+0.5px</button>
                <button @click="adjustDistributorNameFontSize(1)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+1px</button>
            </div>
            <!-- 表头字体大小 -->
            <div style="display: flex; align-items: center; gap: 5px;">
                <label style="font-weight: bold; min-width: 100px;">表头:</label>
                <button @click="adjustHeaderFontSize(-1)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-1px</button>
                <button @click="adjustHeaderFontSize(-0.5)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-0.5px</button>
                <span style="min-width: 50px; text-align: center; font-weight: bold;">{{ displayHeaderFontSize }}px</span>
                <button @click="adjustHeaderFontSize(0.5)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+0.5px</button>
                <button @click="adjustHeaderFontSize(1)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+1px</button>
            </div>

            <!-- 订单内容字体大小 -->
            <div style="display: flex; align-items: center; gap: 5px;">
                <label style="font-weight: bold; min-width: 100px;">订单内容:</label>
                <button @click="adjustOrderContentFontSize(-1)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-1px</button>
                <button @click="adjustOrderContentFontSize(-0.5)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-0.5px</button>
                <span style="min-width: 50px; text-align: center; font-weight: bold;">{{ displayOrderContentFontSize }}px</span>
                <button @click="adjustOrderContentFontSize(0.5)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+0.5px</button>
                <button @click="adjustOrderContentFontSize(1)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+1px</button>
            </div>

            <!-- 行间距 -->
            <div style="display: flex; align-items: center; gap: 5px;">
                <label style="font-weight: bold; min-width: 100px;">行间距:</label>
                <button @click="adjustLineHeight(-1)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-1px</button>
                <button @click="adjustLineHeight(-0.5)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-0.5px</button>
                <span style="min-width: 50px; text-align: center; font-weight: bold;">{{ displayLineHeight }}px</span>
                <button @click="adjustLineHeight(0.5)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+0.5px</button>
                <button @click="adjustLineHeight(1)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+1px</button>
            </div>

            <!-- 最大可打印宽度（内容区域上限，避免右侧裁切） -->
            <div style="display: flex; align-items: center; gap: 5px;">
                <label style="font-weight: bold; min-width: 120px;" title="内容区域宽度上限，超过会被缩小。右侧被裁切时调小此值。">最大可打印宽度:</label>
                <button @click="adjustMaxPrintableWidth(-5)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-5mm</button>
                <button @click="adjustMaxPrintableWidth(-1)" style="background: #ff9800; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">-1mm</button>
                <span style="min-width: 45px; text-align: center; font-weight: bold;">{{ maxPrintableWidth }}mm</span>
                <button @click="adjustMaxPrintableWidth(1)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+1mm</button>
                <button @click="adjustMaxPrintableWidth(5)" style="background: #4CAF50; color: white; border: none; padding: 3px 8px; border-radius: 3px; cursor: pointer;">+5mm</button>
                <span style="font-size: 11px; color: #666;">(180-205)</span>
            </div>
        </div>

        <!-- 缩放系数校准区域 -->
        <div style="margin-top: 20px; padding: 15px; background: #f0f7ff; border: 1px solid #b3d9ff; border-radius: 5px;">
            <h4 style="margin: 0 0 10px 0; color: #1976d2;">📏 打印尺寸校准（解决整体缩小问题）</h4>
            
            <div style="margin-bottom: 15px;">
                <button @click="handlePrintCalibrationPage" style="background: #2196F3; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer; margin-right: 10px;">
                    ⚙️ 打开打印设置（分辨率等）
                </button>
                <button @click="handleSyncSystemConfig" style="background: #4CAF50; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer; margin-right: 10px;">
                    🔄 一键同步系统配置
                </button>
                <span v-if="isMac" style="margin-right: 10px; font-size: 12px;">设为系统默认:</span>
                <template v-if="isMac">
                    <button v-for="res in resolutionOptions" :key="res.label" @click="handleSetResolution(res.h, res.v)" 
                        style="background: #9C27B0; color: white; border: none; padding: 6px 12px; border-radius: 3px; cursor: pointer; margin-right: 6px; font-size: 12px;">
                        {{ res.label }}
                    </button>
                </template>
            </div>
            <div style="margin-bottom: 10px; font-size: 12px; color: #666;">
                Mac 提示：「存储预置」存在单独文件，不会更新系统默认。选好分辨率后点上方「设为系统默认」的按钮，再点「一键同步」即可看到。
            </div>
            
            <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                <!-- 横线实际长度输入已屏蔽 -->
                <!-- <div style="display: flex; align-items: center; gap: 5px;">
                    <label style="font-weight: bold; min-width: 120px;">横线实际长度(mm):</label>
                    <input 
                        v-model.number="measuredWidth" 
                        type="number" 
                        step="0.1" 
                        min="50" 
                        max="150"
                        style="width: 80px; padding: 5px; border: 1px solid #ddd; border-radius: 3px;"
                        placeholder="100"
                    />
                </div> -->
                <div style="display: flex; align-items: center; gap: 5px;">
                    <label style="font-weight: bold; min-width: 100px;">缩放系数:</label>
                    <button 
                        @click="decreaseZoomFactor" 
                        style="background: #f44336; color: white; border: none; padding: 5px 12px; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 16px; min-width: 40px;"
                        title="减少 0.005"
                    >
                        −
                    </button>
                    <input 
                        v-model.number="zoomFactor" 
                        type="number" 
                        step="0.005" 
                        min="0.5" 
                        max="1.5"
                        placeholder="1.0"
                        style="width: 100px; padding: 5px; border: 1px solid #ddd; border-radius: 3px; text-align: center; font-weight: bold;"
                        @blur="validateZoomFactor"
                    />
                    <span style="margin-left: 5px; color: #999; font-size: 12px;">
                        (默认: 1.0)
                    </span>
                    <span 
                        :style="{
                            marginLeft: '15px',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            backgroundColor: isWidthExceeded ? '#ffebee' : '#e8f5e9',
                            color: isWidthExceeded ? '#c62828' : '#2e7d32',
                            border: isWidthExceeded ? '1px solid #ef5350' : '1px solid #4caf50'
                        }"
                        :title="`容器内容区域宽度: ${containerContentWidth.toFixed(2)} mm (容器 ${containerTotalWidth.toFixed(2)} - 左padding ${(internalCurrentLeftMargin * zoomFactor).toFixed(2)} - 右padding ${(internalCurrentRightMargin * zoomFactor).toFixed(2)})`"
                    >
                        📏 宽度: {{ containerContentWidth.toFixed(2) }} mm
                        <span v-if="isWidthExceeded" style="color: #c62828; font-weight: bold;">
                            ⚠️ 超过{{ maxPrintableWidth }}mm，实际打印会缩小
                        </span>
                    </span>
                    <button 
                        @click="increaseZoomFactor" 
                        style="background: #4CAF50; color: white; border: none; padding: 5px 12px; border-radius: 3px; cursor: pointer; font-weight: bold; font-size: 16px; min-width: 40px;"
                        title="增加 0.005"
                    >
                        +
                    </button>
                    <span style="margin-left: 10px; color: #666; font-size: 12px;">
                        (每次调整 ±0.005)
                    </span>
                </div>
                
                <!-- 缩放系数建议提示 -->
                <div v-if="zoomFactorWarning" style="margin-top: 10px; padding: 8px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 3px;">
                    <div style="font-size: 12px; color: #856404; font-weight: bold;">
                        ⚠️ 缩放系数建议
                    </div>
                    <div style="font-size: 11px; color: #856404; margin-top: 4px;">
                        当前缩放系数 {{ zoomFactor.toFixed(3) }} 会导致内容宽度 {{ containerContentWidth.toFixed(2) }}mm 超过最大可打印宽度 {{ maxPrintableWidth }}mm
                    </div>
                    <div style="font-size: 11px; color: #856404; margin-top: 4px;">
                        建议最大缩放系数：<strong>{{ maxRecommendedZoomFactor.toFixed(3) }}</strong>
                        <span style="margin-left: 10px; color: #666;">
                            （当前边距：左{{ internalCurrentLeftMargin }}mm + 右{{ internalCurrentRightMargin }}mm）
                        </span>
                    </div>
                </div>
                
                <!-- 计算并应用按钮已屏蔽 -->
                <!-- <button @click="handleCalculateZoom" style="background: #FF9800; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
                    第二步：计算并应用
                </button> -->
            </div>
            
            <div v-if="displayZoomFactor !== 1.0 && !zoomFactorWarning" style="margin-top: 10px; padding: 8px; background: #e8f5e9; border-left: 4px solid #4CAF50; border-radius: 3px;">
                <span style="font-size: 12px; color: #2e7d32;">
                    ✅ 校准系数已生效：当前缩放补偿为 {{ (displayZoomFactor * 100).toFixed(2) }}%
                </span>
            </div>
        </div>

        <div style="margin-top: 15px; display: flex; gap: 10px; align-items: center;">
            <button @click="handleReset" style="background: #FF9800; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
                🔄 恢复默认
            </button>
            <button 
                @click="handleSave" 
                style="background: #9C27B0; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;"
                :title="`保存配置：左边距 ${internalCurrentLeftMargin}mm，右边距 ${internalCurrentRightMargin}mm，配送商字体 ${internalDistributorNameFontSize}px，订单字体 ${internalOrderContentFontSize}px，行间距 ${internalLineHeight}px，缩放系数 ${zoomFactor.toFixed(3)}`"
            >
                💾 保存配置
            </button>
            <button @click="handleClose" style="background: #f44336; color: white; border: none; padding: 8px 15px; border-radius: 3px; cursor: pointer;">
                ❌ 关闭
            </button>
        </div>

<!--        <div style="margin-top: 10px; padding: 10px; background: #e3f2fd; border-radius: 3px; font-size: 12px; color: #1976d2;">-->
<!--            <strong>使用说明：</strong><br>-->
<!--            1. 先打印校准页，检查右侧边框是否完整显示<br>-->
<!--            2. 如果右侧边框被裁掉，增加右侧边距<br>-->
<!--            3. 如果左侧内容被裁掉，增加左侧边距<br>-->
<!--            4. 可以调整配送商名称和订单内容的字体大小<br>-->
<!--            5. 调整满意后点击"保存配置"，系统会记住当前打印机的设置-->
<!--        </div>-->
    </div>

    <!-- AlertDialog 自定义弹窗组件 -->
    <AlertDialog ref="alertDialog" />

</template>

<script>
import {
    savePrinterProfile,
    getCurrentPrinterName,
    applyPrinterProfile,
    loadPrinterProfile,
    DEFAULT_PROFILE
} from '@/utils/printerProfile';
import AlertDialog from './AlertDialog.vue';

export default {
    name: 'PrintCalibrationPanel',
    components: {
        AlertDialog
    },
    props: {
        visible: {
            type: Boolean,
            default: false
        },
        // 当前配置值（从父组件传入）
        currentLeftMargin: {
            type: Number,
            default: 12
        },
        currentRightMargin: {
            type: Number,
            default: 12
        },
        distributorNameFontSize: {
            type: Number,
            default: 18
        },
        orderContentFontSize: {
            type: Number,
            default: 14
        },
        lineHeight: {
            type: Number,
            default: 24
        },
        headerFontSize: {
            type: Number,
            default: 14
        }
    },
    data() {
        // 使用内部数据来跟踪值的变化，确保显示更新
        return {
            internalDistributorNameFontSize: this.distributorNameFontSize,
            internalOrderContentFontSize: this.orderContentFontSize,
            internalLineHeight: this.lineHeight,
            internalHeaderFontSize: this.headerFontSize,
            internalCurrentLeftMargin: this.currentLeftMargin,
            internalCurrentRightMargin: this.currentRightMargin,
            zoomFactor: 1.0,  // 缩放系数
            maxPrintableWidth: 200,  // 最大可打印宽度（mm），内容区域上限
            measuredWidth: 100,  // 用户测量的横向长度（mm）
            systemConfig: null,  // 系统配置信息
            isMac: false,  // 是否 macOS（用于显示「设为系统默认」）
            resolutionOptions: [
                { label: '120×60', h: 120, v: 60 },
                { label: '180×180', h: 180, v: 180 },
                { label: '360×180', h: 360, v: 180 }
            ]
        };
    },
    watch: {
        // 监听 props 变化，同步到内部数据
        distributorNameFontSize(newVal) {
            this.internalDistributorNameFontSize = newVal;
        },
        orderContentFontSize(newVal) {
            this.internalOrderContentFontSize = newVal;
        },
        currentLeftMargin(newVal) {
            this.internalCurrentLeftMargin = newVal;
        },
        currentRightMargin(newVal) {
            this.internalCurrentRightMargin = newVal;
        },
        lineHeight(newVal) {
            this.internalLineHeight = newVal;
        },
        headerFontSize(newVal) {
            this.internalHeaderFontSize = newVal;
        }
    },
    computed: {
        // 使用计算属性确保响应式更新
        displayDistributorNameFontSize() {
            return this.internalDistributorNameFontSize;
        },
        displayOrderContentFontSize() {
            return this.internalOrderContentFontSize;
        },
        displayCurrentLeftMargin() {
            return this.internalCurrentLeftMargin;
        },
        displayCurrentRightMargin() {
            return this.internalCurrentRightMargin;
        },
        displayLineHeight() {
            return this.internalLineHeight;
        },
        displayHeaderFontSize() {
            return this.internalHeaderFontSize;
        },
        displayZoomFactor() {
            return this.zoomFactor;
        },
        // 计算容器总宽度（用于显示）
        containerTotalWidth() {
            // 物理纸张宽度
            const physicalPageWidth = 241; // mm
            // 安全基准宽度
            const safeBaseWidth = 210; // mm
            
            // 缩放后的边距
            const adjustedLeftMargin = this.internalCurrentLeftMargin * this.zoomFactor;
            const adjustedRightMargin = this.internalCurrentRightMargin * this.zoomFactor;
            
            // 原始可用宽度
            const originalAvailableWidth = safeBaseWidth - this.internalCurrentLeftMargin - this.internalCurrentRightMargin;
            
            // 缩放后的可用宽度
            let realAvailableWidth = originalAvailableWidth * this.zoomFactor;
            
            // 容器宽度 = 左边距 + 可用宽度 + 右边距
            let cssContainerWidth = adjustedLeftMargin + realAvailableWidth + adjustedRightMargin;
            
            // 如果容器宽度超过物理纸张宽度，按比例缩小
            if (cssContainerWidth > physicalPageWidth) {
                return physicalPageWidth;
            }
            
            return cssContainerWidth;
        },
        // 计算容器内容区域宽度（与 ApplyThirtyWholePanel.vue 中的计算逻辑一致）
        containerContentWidth() {
            // 物理纸张宽度
            const physicalPageWidth = 241; // mm
            // 安全基准宽度
            const safeBaseWidth = 210; // mm
            
            // 缩放后的边距
            const adjustedLeftMargin = this.internalCurrentLeftMargin * this.zoomFactor;
            const adjustedRightMargin = this.internalCurrentRightMargin * this.zoomFactor;
            
            // 原始可用宽度
            const originalAvailableWidth = safeBaseWidth - this.internalCurrentLeftMargin - this.internalCurrentRightMargin;
            
            // 缩放后的可用宽度
            let realAvailableWidth = originalAvailableWidth * this.zoomFactor;
            
            // 容器宽度 = 左边距 + 可用宽度 + 右边距
            let cssContainerWidth = adjustedLeftMargin + realAvailableWidth + adjustedRightMargin;
            
            // 如果容器宽度超过物理纸张宽度，按比例缩小
            if (cssContainerWidth > physicalPageWidth) {
                const scaleDown = physicalPageWidth / cssContainerWidth;
                cssContainerWidth = physicalPageWidth;
                // 按比例缩小边距和可用宽度
                const scaledLeftMargin = adjustedLeftMargin * scaleDown;
                const scaledRightMargin = adjustedRightMargin * scaleDown;
                
                // 计算容器内容区域宽度
                return cssContainerWidth - scaledLeftMargin - scaledRightMargin;
            }
            
            // 计算容器内容区域宽度（容器宽度 - 左右padding）
            return cssContainerWidth - adjustedLeftMargin - adjustedRightMargin;
        },
        // 是否超过最大可打印宽度警告
        isWidthExceeded() {
            return this.containerContentWidth > this.maxPrintableWidth;
        },
        // 缩放系数警告（是否超过最大可打印宽度）
        zoomFactorWarning() {
            return this.containerContentWidth > this.maxPrintableWidth;
        },
        // 建议的最大缩放系数
        maxRecommendedZoomFactor() {
            return this.calculateMaxRecommendedZoomFactor();
        }
    },
    async mounted() {
        // 加载当前打印机的配置
        await this.loadCurrentProfile();
        // 检测是否 macOS
        if (window.electronAPI?.getOSInfo) {
            try {
                const info = await window.electronAPI.getOSInfo();
                this.isMac = info?.platform === 'darwin';
            } catch (e) {}
        }
    },
    methods: {
        // 计算自动右边距（基于左边距和最大可打印宽度）
        calculateAutoRightMargin(leftMargin) {
            const safeBaseWidth = 210; // 基准宽度
            const minMargin = 5; // 最小边距
            const maxMargin = 20; // 最大边距
            
            // 计算在缩放系数下，内容宽度不超过最大可打印宽度时，需要的总边距
            // 公式：内容宽度 = (210 - leftMargin - rightMargin) * zoomFactor <= maxPrintableWidth
            // 所以：rightMargin >= 210 - leftMargin - (maxPrintableWidth / zoomFactor)
            const requiredTotalMargin = safeBaseWidth - (this.maxPrintableWidth / this.zoomFactor);
            const calculatedRightMargin = requiredTotalMargin - leftMargin;
            
            // 限制在合理范围内
            const autoRightMargin = Math.max(minMargin, Math.min(maxMargin, calculatedRightMargin));
            
            return autoRightMargin;
        },
        
        // 微调左侧安全边距（自动计算右边距，保证不超过最大打印宽度）
        adjustLeftMargin(delta) {
            const newLeftMargin = Math.max(5, Math.min(20, this.internalCurrentLeftMargin + delta));
            this.internalCurrentLeftMargin = newLeftMargin;
            
            // 自动计算右边距，保证内容宽度不超过最大可打印宽度
            const autoRightMargin = this.calculateAutoRightMargin(newLeftMargin);
            this.internalCurrentRightMargin = autoRightMargin;
            
            this.$emit('update:current-left-margin', newLeftMargin);
            this.$emit('update:current-right-margin', autoRightMargin);
            document.documentElement.style.setProperty('--safe-left-mm', String(newLeftMargin));
            document.documentElement.style.setProperty('--safe-right-mm', String(autoRightMargin));
            
            console.log('调整左侧安全边距（自动计算右边距）:', {
                左边距: newLeftMargin,
                自动计算的右边距: autoRightMargin,
                最大可打印宽度: this.maxPrintableWidth,
                缩放系数: this.zoomFactor,
                预计内容宽度: ((210 - newLeftMargin - autoRightMargin) * this.zoomFactor).toFixed(2)
            });
        },

        // 微调右侧安全边距（自动计算左边距，保证不超过最大打印宽度）
        adjustRightMargin(delta) {
            const newRightMargin = Math.max(5, Math.min(20, this.internalCurrentRightMargin + delta));
            this.internalCurrentRightMargin = newRightMargin;
            
            // 自动计算左边距，保证内容宽度不超过最大可打印宽度
            const safeBaseWidth = 210;
            const minMargin = 5;
            const maxMargin = 20;
            const requiredTotalMargin = safeBaseWidth - (this.maxPrintableWidth / this.zoomFactor);
            const calculatedLeftMargin = requiredTotalMargin - newRightMargin;
            const autoLeftMargin = Math.max(minMargin, Math.min(maxMargin, calculatedLeftMargin));
            
            this.internalCurrentLeftMargin = autoLeftMargin;
            
            this.$emit('update:current-left-margin', autoLeftMargin);
            this.$emit('update:current-right-margin', newRightMargin);
            document.documentElement.style.setProperty('--safe-left-mm', String(autoLeftMargin));
            document.documentElement.style.setProperty('--safe-right-mm', String(newRightMargin));
            
            console.log('调整右侧安全边距（自动计算左边距）:', {
                右边距: newRightMargin,
                自动计算的左边距: autoLeftMargin,
                最大可打印宽度: this.maxPrintableWidth,
                缩放系数: this.zoomFactor,
                预计内容宽度: ((210 - autoLeftMargin - newRightMargin) * this.zoomFactor).toFixed(2)
            });
        },

        // 调整最大可打印宽度（内容区域上限，180-205mm）
        // 调整后自动重新计算右边距，保证不超过新的最大打印宽度
        adjustMaxPrintableWidth(delta) {
            const newValue = Math.max(180, Math.min(205, this.maxPrintableWidth + delta));
            this.maxPrintableWidth = newValue;
            
            // 重新计算右边距，保证不超过新的最大打印宽度
            const autoRightMargin = this.calculateAutoRightMargin(this.internalCurrentLeftMargin);
            this.internalCurrentRightMargin = autoRightMargin;
            this.$emit('update:current-right-margin', autoRightMargin);
            document.documentElement.style.setProperty('--safe-right-mm', String(autoRightMargin));
            
            console.log('调整最大可打印宽度（自动调整右边距）:', {
                最大可打印宽度: newValue,
                当前左边距: this.internalCurrentLeftMargin,
                自动调整的右边距: autoRightMargin,
                预计内容宽度: ((210 - this.internalCurrentLeftMargin - autoRightMargin) * this.zoomFactor).toFixed(2)
            });
        },

        // 微调配送商名称字体大小
        adjustDistributorNameFontSize(delta) {
            // 使用内部值来计算新值，确保可以累计
            const currentValue = this.internalDistributorNameFontSize;
            const newValue = Math.max(12, Math.min(24, currentValue + delta));
            
            // 立即更新内部数据，确保显示值立即更新
            this.internalDistributorNameFontSize = newValue;
            
            // 设置CSS变量（在:root上）
            const cssValue = String(newValue) + 'px';
            const root = document.documentElement;
            root.style.setProperty('--distributor-name-font-size', cssValue);
            
            // 通知父组件更新（使用 kebab-case 事件名以匹配 .sync）
            this.$emit('update:distributor-name-font-size', newValue);
            
            // 立即更新所有使用该变量的元素（不等待 nextTick）
            // 使用 setTimeout 确保在下一个事件循环中执行，避免被 Vue 的响应式系统覆盖
            setTimeout(() => {
                const titleElements = document.querySelectorAll('.title, .print-title');
                titleElements.forEach(el => {
                    el.style.setProperty('font-size', cssValue, 'important');
                });
                
                // 强制父组件更新
                this.$parent && this.$parent.$forceUpdate && this.$parent.$forceUpdate();
                
                // 验证
                const actualValue = getComputedStyle(root).getPropertyValue('--distributor-name-font-size');
                const firstElement = titleElements[0];
                const elementFontSize = firstElement ? getComputedStyle(firstElement).fontSize : 'N/A';
                
                console.log('调整配送商名称字体大小:', {
                    currentValue: currentValue + 'px',
                    delta: delta,
                    newValue: newValue + 'px',
                    cssValue: cssValue,
                    actualCssVar: actualValue,
                    updatedElements: titleElements.length,
                    firstElementFontSize: elementFontSize,
                    elementCount: titleElements.length,
                    propValue: this.distributorNameFontSize,
                    internalValue: this.internalDistributorNameFontSize,
                    computedValue: this.displayDistributorNameFontSize
                });
            }, 0);
        },

        // 微调订单内容字体大小
        adjustOrderContentFontSize(delta) {
            // 使用内部值来计算新值，确保可以累计
            const currentValue = this.internalOrderContentFontSize;
            const newValue = Math.max(10, Math.min(18, currentValue + delta));
            
            // 立即更新内部数据，确保显示值立即更新
            this.internalOrderContentFontSize = newValue;
            
            // 设置CSS变量（在:root上）
            const cssValue = String(newValue) + 'px';
            const root = document.documentElement;
            root.style.setProperty('--order-content-font-size', cssValue);
            
            // 通知父组件更新（使用 kebab-case 事件名以匹配 .sync）
            this.$emit('update:order-content-font-size', newValue);
            
            // 立即更新所有使用该变量的元素（不等待 nextTick）
            // 使用 setTimeout 确保在下一个事件循环中执行，避免被 Vue 的响应式系统覆盖
            setTimeout(() => {
                const contentElements = document.querySelectorAll('.table-row, .table-header, .print-table-row, .print-table-header, .print-item, .print-address');
                contentElements.forEach(el => {
                    el.style.setProperty('font-size', cssValue, 'important');
                });
                
                // 强制父组件更新
                this.$parent && this.$parent.$forceUpdate && this.$parent.$forceUpdate();
                
                // 验证
                const actualValue = getComputedStyle(root).getPropertyValue('--order-content-font-size');
                const firstElement = contentElements[0];
                const elementFontSize = firstElement ? getComputedStyle(firstElement).fontSize : 'N/A';
                
                console.log('调整订单内容字体大小:', {
                    currentValue: currentValue + 'px',
                    delta: delta,
                    newValue: newValue + 'px',
                    cssValue: cssValue,
                    actualCssVar: actualValue,
                    updatedElements: contentElements.length,
                    firstElementFontSize: elementFontSize,
                    elementCount: contentElements.length,
                    propValue: this.orderContentFontSize,
                    internalValue: this.internalOrderContentFontSize,
                    computedValue: this.displayOrderContentFontSize
                });
            }, 0);
        },

        // 微调表头字体大小
        adjustHeaderFontSize(delta) {
            const currentValue = this.internalHeaderFontSize;
            const newValue = Math.max(10, Math.min(18, currentValue + delta));
            
            this.internalHeaderFontSize = newValue;
            
            const cssValue = String(newValue) + 'px';
            const root = document.documentElement;
            root.style.setProperty('--header-font-size', cssValue);
            
            this.$emit('update:header-font-size', newValue);
            
            setTimeout(() => {
                const headerItems = document.querySelectorAll('.leftPage .item, .rightPage .item');
                headerItems.forEach(el => {
                    el.style.setProperty('font-size', cssValue, 'important');
                });
                this.$parent && this.$parent.$forceUpdate && this.$parent.$forceUpdate();
            }, 0);
        },
        
        adjustLineHeight(delta) {
            // 使用内部值来计算新值，确保可以累计
            const currentValue = this.internalLineHeight;
            const newValue = Math.max(18, Math.min(30, currentValue + delta));
            
            // 立即更新内部数据，确保显示值立即更新
            this.internalLineHeight = newValue;
            
            // 设置CSS变量（在:root上）
            const cssValue = String(newValue) + 'px';
            const root = document.documentElement;
            root.style.setProperty('--line-height', cssValue);
            
            // 通知父组件更新（使用 kebab-case 事件名以匹配 .sync）
            this.$emit('update:line-height', newValue);
            
            // 立即更新所有使用该变量的元素
            setTimeout(() => {
                const contentElements = document.querySelectorAll('.table-row, .table-header, .print-table-row, .print-table-header, .print-item');
                contentElements.forEach(el => {
                    el.style.setProperty('line-height', cssValue, 'important');
                });
                
                // 强制父组件更新
                this.$parent && this.$parent.$forceUpdate && this.$parent.$forceUpdate();
                
                console.log('调整行间距:', {
                    currentValue: currentValue + 'px',
                    delta: delta,
                    newValue: newValue + 'px',
                    cssValue: cssValue,
                    updatedElements: contentElements.length
                });
            }, 0);
        },

        // 加载当前打印机的配置
        async loadCurrentProfile() {
            try {
                // 获取当前配置的打印机名称（从 Screen.vue 设置中获取）
                const printerName = await getCurrentPrinterName();
                
                if (!printerName) {
                    console.warn('⚠️ [loadCurrentProfile] 未配置打印机，使用默认值');
                    console.warn('⚠️ [loadCurrentProfile] 提示：请在 Screen.vue 中先设置并保存打印机');
                    return;
                }
                
                console.log('🔍 [loadCurrentProfile] 使用打印机名称:', printerName);
                const profile = await loadPrinterProfile(printerName);
                
                console.log('🔍 [loadCurrentProfile] 从文件系统加载配置:', {
                    printerName,
                    profile,
                    zoomFactor: profile?.zoomFactor
                });
                
                if (profile) {
                    // 更新所有配置项
                    if (profile.zoomFactor !== undefined) {
                        this.zoomFactor = profile.zoomFactor;
                        console.log('✅ [loadCurrentProfile] 缩放系数已更新:', {
                            oldValue: this.zoomFactor,
                            newValue: profile.zoomFactor,
                            changed: this.zoomFactor !== profile.zoomFactor
                        });
                    }
                    
                    // 同步更新内部边距和字体大小（如果配置中有）
                    if (profile.safeLeftMm !== undefined) {
                        this.internalCurrentLeftMargin = profile.safeLeftMm;
                        this.$emit('update:current-left-margin', profile.safeLeftMm);
                        // 加载左边距后，自动计算右边距，保证不超过最大可打印宽度
                        const autoRightMargin = this.calculateAutoRightMargin(profile.safeLeftMm);
                        this.internalCurrentRightMargin = autoRightMargin;
                        this.$emit('update:current-right-margin', autoRightMargin);
                    }
                    if (profile.safeRightMm !== undefined) {
                        // 如果配置中有右边距，使用配置值；否则使用自动计算的值
                        // 但需要检查是否超过最大可打印宽度
                        const safeBaseWidth = 210;
                        const currentContentWidth = (safeBaseWidth - this.internalCurrentLeftMargin - profile.safeRightMm) * this.zoomFactor;
                        if (currentContentWidth <= this.maxPrintableWidth) {
                            this.internalCurrentRightMargin = profile.safeRightMm;
                            this.$emit('update:current-right-margin', profile.safeRightMm);
                        } else {
                            // 如果超过，使用自动计算的值
                            const autoRightMargin = this.calculateAutoRightMargin(this.internalCurrentLeftMargin);
                            this.internalCurrentRightMargin = autoRightMargin;
                            this.$emit('update:current-right-margin', autoRightMargin);
                            console.warn('⚠️ [loadCurrentProfile] 配置的右边距会导致超过最大可打印宽度，已自动调整:', {
                                配置的右边距: profile.safeRightMm,
                                自动计算的右边距: autoRightMargin,
                                最大可打印宽度: this.maxPrintableWidth
                            });
                        }
                    }
                    if (profile.distributorNameFontSize !== undefined) {
                        this.internalDistributorNameFontSize = profile.distributorNameFontSize;
                        this.$emit('update:distributor-name-font-size', profile.distributorNameFontSize);
                    }
                    if (profile.orderContentFontSize !== undefined) {
                        this.internalOrderContentFontSize = profile.orderContentFontSize;
                        this.$emit('update:order-content-font-size', profile.orderContentFontSize);
                    }
                    if (profile.lineHeight !== undefined) {
                        this.internalLineHeight = profile.lineHeight;
                        this.$emit('update:line-height', profile.lineHeight);
                        console.log('✅ [loadCurrentProfile] 行间距已更新:', {
                            oldValue: this.internalLineHeight,
                            newValue: profile.lineHeight,
                            changed: this.internalLineHeight !== profile.lineHeight
                        });
                    }
                    if (profile.headerFontSize !== undefined) {
                        this.internalHeaderFontSize = profile.headerFontSize;
                        this.$emit('update:header-font-size', profile.headerFontSize);
                    }
                    if (profile.maxPrintableWidth !== undefined) {
                        this.maxPrintableWidth = Math.max(180, Math.min(205, profile.maxPrintableWidth));
                    }
                } else {
                    console.warn('⚠️ [loadCurrentProfile] 配置文件为空，使用默认值');
                }
            } catch (error) {
                console.error('❌ [loadCurrentProfile] 加载打印机配置失败:', error);
            }
        },
        
        // 生成校准页面的 HTML 内容
        generateCalibrationHTML() {
            return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>打印校准页</title>
  <style>
    @media print {
      @page {
        size: 240mm 279mm; /* 与实际打印模板保持一致（240mm而非241mm） */
        margin: 0; /* 必须设为0，由页面padding控制 */
      }
      body { 
        margin: 0; 
        padding: 0;
      }
      .instructions { 
        display: none; /* 打印时不显示文字说明 */
      }
    }
    
    * { 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
    }
    
    body {
      font-family: "SimSun", "宋体", serif;
      padding: 20mm;
      width: 210mm;
      min-height: 250mm;
      position: relative;
    }
    
    .calibration-container {
      width: 100%;
      height: 100%;
      position: relative;
    }
    
    .line-wrapper {
      margin-bottom: 40mm;
      position: relative;
    }
    
    .red-line {
      background-color: #ff0000;
      /* 强制打印背景颜色，防止驱动优化掉颜色 */
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    /* 横向基准线：100mm */
    .h-line {
      width: 100mm;
      height: 2px;
      margin-bottom: 10px;
    }
    
    /* 纵向基准线：100mm */
    .v-line {
      width: 2px;
      height: 100mm;
      display: inline-block;
    }
    
    .label {
      font-size: 12px;
      color: #333;
      margin-top: 10px;
      display: block;
    }
    
    .vertical .label {
      writing-mode: vertical-lr;
      position: absolute;
      left: 10px;
      top: 0;
    }
    
    .instructions {
      margin-top: 50mm;
      padding: 20px;
      border: 1px dashed #ccc;
      background: #f9f9f9;
    }
    
    .instructions h3 {
      margin-bottom: 10px;
      color: #333;
    }
    
    .instructions p {
      margin: 5px 0;
      color: #666;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="calibration-container">
    <!-- 横向基准线 -->
    <div class="line-wrapper horizontal">
      <div class="line red-line h-line"></div>
      <span class="label">横向基准线：理论长度 100mm</span>
    </div>

    <!-- 纵向基准线 -->
    <div class="line-wrapper vertical">
      <div class="line red-line v-line"></div>
      <span class="label">纵向基准线：理论长度 100mm</span>
    </div>

    <!-- 使用说明（打印时不显示） -->
    <div class="instructions">
      <h3>打印校准操作指引：</h3>
      <p>1. 请使用直尺测量打印出的红色线条实际长度。</p>
      <p>2. 将测量结果输入到系统设置面板中。</p>
      <p>3. 系统将自动计算补偿系数，修正针式打印机的缩放误差。</p>
      <p><strong>注意：</strong>如果您的打印机只有黑色色带，红色线条会打印成黑色实线。</p>
    </div>
  </div>
</body>
</html>
            `;
        },
        
        // 打印校准页
        async handlePrintCalibrationPage() {
            try {
                const htmlContent = this.generateCalibrationHTML();
                
                // 通过 IPC 发送打印请求
                if (window.electronAPI && window.electronAPI.sendPrintCalibrationPage) {
                    await window.electronAPI.sendPrintCalibrationPage(htmlContent);
                } else {
                    // 后备方案：使用 window.open
                    const printWindow = window.open('', '_blank');
                    printWindow.document.write(htmlContent);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => {
                        printWindow.print();
                    }, 500);
                }
            } catch (error) {
                console.error('打印校准页面失败:', error);
                await this.$refs.alertDialog.alert('打印校准页面失败: ' + error.message, 'error');
            }
        },

        // 设为系统默认分辨率（仅 macOS，用 lpoptions 写入）
        async handleSetResolution(hDpi, vDpi) {
            if (!window.electronAPI?.setPrinterResolution) {
                await this.$refs.alertDialog.alert('当前环境不支持', 'warning');
                return;
            }
            try {
                const result = await window.electronAPI.setPrinterResolution(hDpi, vDpi);
                if (result.success) {
                    await this.$refs.alertDialog.alert(`已设置分辨率为 ${hDpi}×${vDpi}，可点击「一键同步」验证`, 'success');
                } else {
                    await this.$refs.alertDialog.alert('设置失败: ' + (result.error || '未知错误'), 'error');
                }
            } catch (e) {
                await this.$refs.alertDialog.alert('设置失败: ' + e.message, 'error');
            }
        },
        // 一键同步系统配置
        async handleSyncSystemConfig() {
            try {
                if (!window.electronAPI || !window.electronAPI.getPrinterSystemConfig) {
                    await this.$refs.alertDialog.alert('系统配置获取功能不可用', 'warning');
                    return;
                }

                const result = await window.electronAPI.getPrinterSystemConfig();
                if (result.success && result.config) {
                    this.systemConfig = result.config;
                    await this.$refs.alertDialog.alert(`系统配置同步成功！\n打印机: ${result.config.name}\nDPI: ${result.config.hDpi} x ${result.config.vDpi}\n纸张尺寸: ${result.config.widthMm}mm x ${result.config.heightMm}mm`, 'success');
                } else {
                    await this.$refs.alertDialog.alert('获取系统配置失败: ' + (result.error || '未知错误') + '\n\n提示：某些打印机可能无法获取完整配置信息，这是正常的。', 'warning');
                }
            } catch (error) {
                console.error('同步系统配置失败:', error);
                await this.$refs.alertDialog.alert('同步系统配置失败: ' + error.message, 'error');
            }
        },
        
        // 计算建议的最大缩放系数（保证内容宽度不超过最大可打印宽度）
        calculateMaxRecommendedZoomFactor() {
            const safeBaseWidth = 210;
            const minTotalMargin = 10; // 最小总边距（左右各5mm）
            const maxContentWidth = this.maxPrintableWidth;
            
            // 公式：内容宽度 = (210 - leftMargin - rightMargin) * zoomFactor <= maxPrintableWidth
            // 所以：zoomFactor <= maxPrintableWidth / (210 - leftMargin - rightMargin)
            const currentTotalMargin = this.internalCurrentLeftMargin + this.internalCurrentRightMargin;
            const availableWidth = safeBaseWidth - currentTotalMargin;
            
            if (availableWidth <= 0) {
                return 0.5; // 如果边距太大，返回最小值
            }
            
            const maxZoom = maxContentWidth / availableWidth;
            return Math.min(1.5, Math.max(0.5, Number(maxZoom.toFixed(3))));
        },
        
        // 增加缩放系数（每次 +0.005，自动调整右边距）
        async increaseZoomFactor() {
            const oldValue = this.zoomFactor;
            const newValue = Number((this.zoomFactor + 0.005).toFixed(3));
            if (newValue > 1.5) {
                await this.$refs.alertDialog.alert('缩放系数不能超过 1.5', 'warning');
                return;
            }
            this.zoomFactor = newValue;
            
            // 自动重新计算右边距，保证不超过最大可打印宽度
            const autoRightMargin = this.calculateAutoRightMargin(this.internalCurrentLeftMargin);
            this.internalCurrentRightMargin = autoRightMargin;
            this.$emit('update:current-right-margin', autoRightMargin);
            document.documentElement.style.setProperty('--safe-right-mm', String(autoRightMargin));
            
            // 检查是否超过最大可打印宽度
            const currentContentWidth = this.containerContentWidth;
            if (currentContentWidth > this.maxPrintableWidth) {
                const maxRecommendedZoom = this.calculateMaxRecommendedZoomFactor();
                console.warn('⚠️ [increaseZoomFactor] 缩放系数过大，建议值:', {
                    当前缩放系数: newValue,
                    当前内容宽度: currentContentWidth.toFixed(2) + 'mm',
                    最大可打印宽度: this.maxPrintableWidth + 'mm',
                    建议最大缩放系数: maxRecommendedZoom,
                    提示: `建议将缩放系数调整为 ${maxRecommendedZoom} 或更小，以避免右侧内容被裁剪`
                });
            }
            
            console.log('🔍 [increaseZoomFactor] 缩放系数增加（自动调整右边距）:', {
                oldValue: oldValue,
                newValue: this.zoomFactor,
                change: '+0.005',
                自动调整的右边距: autoRightMargin,
                预计内容宽度: currentContentWidth.toFixed(2) + 'mm'
            });
        },
        
        // 减少缩放系数（每次 -0.005，自动调整右边距）
        async decreaseZoomFactor() {
            const oldValue = this.zoomFactor;
            const newValue = Number((this.zoomFactor - 0.005).toFixed(3));
            if (newValue < 0.5) {
                await this.$refs.alertDialog.alert('缩放系数不能小于 0.5', 'warning');
                return;
            }
            this.zoomFactor = newValue;
            
            // 自动重新计算右边距，保证不超过最大可打印宽度
            const autoRightMargin = this.calculateAutoRightMargin(this.internalCurrentLeftMargin);
            this.internalCurrentRightMargin = autoRightMargin;
            this.$emit('update:current-right-margin', autoRightMargin);
            document.documentElement.style.setProperty('--safe-right-mm', String(autoRightMargin));
            
            console.log('🔍 [decreaseZoomFactor] 缩放系数减少（自动调整右边距）:', {
                oldValue: oldValue,
                newValue: this.zoomFactor,
                change: '-0.005',
                自动调整的右边距: autoRightMargin,
                预计内容宽度: this.containerContentWidth.toFixed(2) + 'mm'
            });
        },
        
        // 验证缩放系数范围（自动调整右边距）
        async validateZoomFactor() {
            if (this.zoomFactor < 0.5) {
                await this.$refs.alertDialog.alert('缩放系数不能小于 0.5，已自动调整为 0.5', 'warning');
                this.zoomFactor = 0.5;
            } else if (this.zoomFactor > 1.5) {
                await this.$refs.alertDialog.alert('缩放系数不能超过 1.5，已自动调整为 1.5', 'warning');
                this.zoomFactor = 1.5;
            }
            // 保留3位小数（与步长0.005一致）
            this.zoomFactor = Number(this.zoomFactor.toFixed(3));
            
            // 自动重新计算右边距
            const autoRightMargin = this.calculateAutoRightMargin(this.internalCurrentLeftMargin);
            this.internalCurrentRightMargin = autoRightMargin;
            this.$emit('update:current-right-margin', autoRightMargin);
            document.documentElement.style.setProperty('--safe-right-mm', String(autoRightMargin));
            
            // 检查并提示
            const currentContentWidth = this.containerContentWidth;
            if (currentContentWidth > this.maxPrintableWidth) {
                const maxRecommendedZoom = this.calculateMaxRecommendedZoomFactor();
                console.warn('⚠️ [validateZoomFactor] 缩放系数过大:', {
                    当前缩放系数: this.zoomFactor,
                    当前内容宽度: currentContentWidth.toFixed(2) + 'mm',
                    最大可打印宽度: this.maxPrintableWidth + 'mm',
                    建议最大缩放系数: maxRecommendedZoom
                });
            }
        },
        
        // 计算并应用缩放系数（已屏蔽，保留作为备用）
        async handleCalculateZoom() {
            const theoretical = 100.0; // 理论长度是 100mm

            if (!this.measuredWidth || this.measuredWidth <= 0) {
                await this.$refs.alertDialog.alert('请输入有效的测量值', 'warning');
                return;
            }

            // 计算缩放比例：理论 / 实际
            const newZoom = theoretical / this.measuredWidth;

            // 限制合理范围（0.5 ~ 1.5）
            if (newZoom < 0.5 || newZoom > 1.5) {
                await this.$refs.alertDialog.alert('测量数值可能不准确，缩放系数超出合理范围（0.5 ~ 1.5），请重新测量', 'warning');
                return;
            }
            
            this.zoomFactor = Number(newZoom.toFixed(3)); // 保留3位小数

            await this.$refs.alertDialog.alert(`校准成功！\n当前缩放补偿系数：${this.zoomFactor.toFixed(4)}\n缩放比例：${(this.zoomFactor * 100).toFixed(2)}%\n\n请点击"保存配置"以保存此设置。`, 'success');
        },

        // 恢复默认配置
        async handleReset() {
            const defaultProfile = DEFAULT_PROFILE;
            
            // 恢复缩放系数和最大可打印宽度
            this.zoomFactor = defaultProfile.zoomFactor ?? 1.0;
            this.maxPrintableWidth = defaultProfile.maxPrintableWidth ?? 200;
            
            // 自动计算右边距，保证不超过最大可打印宽度
            const autoRightMargin = this.calculateAutoRightMargin(defaultProfile.safeLeftMm);
            
            // 创建一个包含自动计算的右边距的配置对象
            const resetProfile = {
                ...defaultProfile,
                safeRightMm: autoRightMargin // 使用自动计算的右边距
            };
            
            // 应用配置（只更新 CSS 变量，不传递 componentInstance，因为 props 不能直接修改）
            applyPrinterProfile(resetProfile);
            
            // 更新内部数据
            this.internalCurrentLeftMargin = defaultProfile.safeLeftMm;
            this.internalCurrentRightMargin = autoRightMargin;
            this.internalDistributorNameFontSize = defaultProfile.distributorNameFontSize;
            this.internalOrderContentFontSize = defaultProfile.orderContentFontSize;
            this.internalHeaderFontSize = defaultProfile.headerFontSize ?? 14;
            this.internalLineHeight = defaultProfile.lineHeight ?? 24;
            
            // 通知父组件更新（使用 kebab-case 事件名以匹配 .sync）
            // 这些事件会触发父组件更新 props，然后通过 watch 同步到内部数据
            this.$emit('update:current-left-margin', defaultProfile.safeLeftMm);
            this.$emit('update:current-right-margin', autoRightMargin);
            this.$emit('update:distributor-name-font-size', defaultProfile.distributorNameFontSize);
            this.$emit('update:order-content-font-size', defaultProfile.orderContentFontSize);
            this.$emit('update:header-font-size', defaultProfile.headerFontSize ?? 14);
            this.$emit('update:line-height', defaultProfile.lineHeight ?? 24);
            
            console.log('已恢复默认打印配置（自动计算右边距）:', {
                边距: `${defaultProfile.safeLeftMm}mm / ${autoRightMargin}mm (自动计算)`,
                字体: `${defaultProfile.distributorNameFontSize}px / ${defaultProfile.orderContentFontSize}px`,
                缩放系数: defaultProfile.zoomFactor ?? 1.0,
                最大可打印宽度: this.maxPrintableWidth + 'mm',
                预计内容宽度: ((210 - defaultProfile.safeLeftMm - autoRightMargin) * this.zoomFactor).toFixed(2) + 'mm'
            });
        },

        // 保存配置
        async handleSave() {
            try {
                // 获取当前配置的打印机名称（从 Screen.vue 设置中获取）
                const printerName = await getCurrentPrinterName();
                
                if (!printerName) {
                    await this.$refs.alertDialog.alert('❌ 错误：未配置打印机！\n\n请先在 Screen.vue 中设置并保存打印机，然后再保存打印配置。', 'error');
                    console.error('❌ [handleSave] 未配置打印机，无法保存配置');
                    return;
                }
                
                const currentProfile = {
                    safeLeftMm: this.internalCurrentLeftMargin,
                    safeRightMm: this.internalCurrentRightMargin,
                    distributorNameFontSize: this.internalDistributorNameFontSize,
                    orderContentFontSize: this.internalOrderContentFontSize,
                    lineHeight: this.internalLineHeight,  // 保存行间距
                    headerFontSize: this.internalHeaderFontSize,  // 保存表头字体大小
                    zoomFactor: this.zoomFactor,  // 保存缩放系数
                    maxPrintableWidth: this.maxPrintableWidth  // 保存最大可打印宽度
                };
                
                console.log('💾 [handleSave] 准备保存配置:', {
                    printerName,
                    currentProfile,
                    internalLineHeight: this.internalLineHeight,
                    propLineHeight: this.lineHeight,
                    internalDistributorNameFontSize: this.internalDistributorNameFontSize,
                    internalOrderContentFontSize: this.internalOrderContentFontSize,
                    propDistributorNameFontSize: this.distributorNameFontSize,
                    propOrderContentFontSize: this.orderContentFontSize,
                    '行间距详情': {
                        '内部值': this.internalLineHeight,
                        'prop值': this.lineHeight,
                        '将保存的值': currentProfile.lineHeight,
                        '是否一致': this.internalLineHeight === currentProfile.lineHeight
                    }
                });
                
                // 保存到文件系统（通过 Electron API），使用实际打印机名称
                await savePrinterProfile(printerName, currentProfile);
                
                console.log('✅ [handleSave] 配置已保存到文件系统，准备验证...');
                
                // 等待一小段时间，确保文件写入完成
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // 从文件系统重新加载配置，验证保存是否成功
                const savedProfile = await loadPrinterProfile(printerName);
                
                console.log('🔍 [handleSave] 保存后重新加载验证:', {
                    savedProfile,
                    currentProfile,
                    zoomFactorMatch: savedProfile?.zoomFactor === currentProfile.zoomFactor,
                    lineHeightMatch: savedProfile?.lineHeight === currentProfile.lineHeight,
                    leftMarginMatch: savedProfile?.safeLeftMm === currentProfile.safeLeftMm,
                    rightMarginMatch: savedProfile?.safeRightMm === currentProfile.safeRightMm
                });
                
                // 验证 zoomFactor 是否保存成功
                const savedZoomFactor = savedProfile?.zoomFactor ?? 1.0;
                const zoomFactorMatch = Math.abs(savedZoomFactor - currentProfile.zoomFactor) < 0.0001; // 浮点数比较
                
                // 验证 lineHeight 是否保存成功
                const savedLineHeight = savedProfile?.lineHeight ?? 24;
                const lineHeightMatch = savedLineHeight === currentProfile.lineHeight;
                
                // 立即重新加载配置，确保组件使用最新值
                await this.loadCurrentProfile();
                
                console.log('✅ [handleSave] 重新加载后，组件配置值:', {
                    zoomFactor: this.zoomFactor,
                    lineHeight: this.internalLineHeight
                });
                
                const warnings = [];
                if (!zoomFactorMatch) {
                    warnings.push(`缩放系数可能未正确保存（保存值：${savedZoomFactor}，期望值：${currentProfile.zoomFactor}）`);
                }
                if (!lineHeightMatch) {
                    warnings.push(`行间距可能未正确保存（保存值：${savedLineHeight}，期望值：${currentProfile.lineHeight}）`);
                }
                
                const warningText = warnings.length > 0 ? `\n\n⚠️ 警告：\n${warnings.join('\n')}` : '';

                await this.$refs.alertDialog.alert(`已保存 ${printerName} 的打印配置！\n\n保存的内容：\n• 左边距：${currentProfile.safeLeftMm}mm\n• 右边距：${currentProfile.safeRightMm}mm\n• 最大可打印宽度：${currentProfile.maxPrintableWidth}mm\n• 配送商字体：${currentProfile.distributorNameFontSize}px\n• 表头字体：${currentProfile.headerFontSize}px\n• 订单字体：${currentProfile.orderContentFontSize}px\n• 行间距：${currentProfile.lineHeight}px\n• 缩放系数：${savedZoomFactor.toFixed(3)}${warningText}`, 'success');

                this.$emit('saved', currentProfile);
            } catch (error) {
                console.error('❌ [handleSave] 保存配置失败:', error);
                await this.$refs.alertDialog.alert('保存配置失败，请重试', 'error');
            }
        },

        // 关闭面板
        handleClose() {
            this.$emit('close');
        }
    }
};
</script>



