<template>
    <div class="upload-section" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
        <div class="row g-3" style="flex: 1; min-height: 0; overflow: hidden; margin: 0; align-items: stretch;">
            <!-- 左侧：Excel文件上传和预览 -->
            <div class="col-md-6" style="display: flex; flex-direction: column; min-height: 0;">
                <div class="card h-100" style="display: flex; flex-direction: column; min-height: 0;">
                    <div class="card-body p-1" style="display: flex; flex-direction: column; min-height: 0; flex: 1; overflow: hidden; position: relative !important;">
                        <div v-if="!hasCache && !hasRunningTask" style="flex-shrink: 0;">
                            <input
                                type="file"
                                ref="excelFileInput"
                                accept=".xlsx,.xls"
                                @change="$emit('excel-upload', $event)"
                                class="form-control mb-2"
                            />
                            <small class="text-muted">支持 .xlsx 和 .xls 格式</small>
                        </div>
                        
                        <!-- 识别中蒙版（不依赖 uploadedExcelFile，只要有任务就显示） -->
                        <div v-if="hasRunningTask && !hasCache" class="recognizing-overlay" style="position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 10; background-color: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center;">
                            <div class="recognizing-content text-center">
                                <div class="spinner-border text-primary mb-3" role="status">
                                    <span class="visually-hidden">识别中...</span>
                                </div>
                                <div class="text-white fw-bold">该客户正在识别中，请稍候...</div>
                            </div>
                        </div>

                        <!-- 显示已上传的文件信息和Excel预览 -->
                        <div v-if="uploadedExcelFile" class="flex-grow-1"
                             style="display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                            <div class="p-2 bg-light rounded mb-2" style="flex-shrink: 0;">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div class="fw-bold">📄 {{ uploadedExcelFile.name }}</div>
                                        <div class="small text-muted">
                                            大小: {{ formatFileSize(uploadedExcelFile.size) }}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Excel内容预览 -->
                            <div v-if="uploadedExcelPreview" class="border rounded flex-grow-1"
                                 style="min-height: 0; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #dee2e6 !important;">
                                <div v-if="uploadedExcelPreview.sheets && uploadedExcelPreview.sheets.length > 0"
                                     style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;">
                                    <!-- 工作表名称显示（即使只有一个sheet也显示） -->
                                    <div class="p-2"
                                         style="flex-shrink: 0; border-bottom: 1px solid #dee2e6;">
                                        <div v-if="uploadedExcelPreview.sheets.length > 1" class="d-flex align-items-center gap-2">
                                            <label class="small text-muted mb-0" style="white-space: nowrap;">工作表:</label>
                                            <select
                                                class="form-select form-select-sm"
                                                :value="uploadedExcelPreview.currentSheet || 0"
                                                @change="handleChangeSheet($event.target.value)"
                                                style="border: 1px solid #dee2e6; flex: 1;">
                                                <option
                                                    v-for="(sheet, sheetIndex) in uploadedExcelPreview.sheets"
                                                    :key="sheetIndex"
                                                    :value="sheetIndex">
                                                    {{ sheet.name }}
                                                </option>
                                            </select>
                                        </div>
                                        <div v-else class="small text-muted">
                                            <strong>工作表:</strong> {{ uploadedExcelPreview.sheets[0]?.name || '工作表 1' }}
                                        </div>
                                    </div>
                                    <!-- 表格显示区域 -->
                                    <div class="excel-table-scroll-container" style="flex: 1; min-height: 0; height: 0; position: relative;">
                                        <div class="p-2">
                                            <table class="table table-sm table-bordered"
                                                   style="font-size: 11px; margin-bottom: 0; width: 100%;">
                                                <tbody>
                                                            <tr v-for="(row, rowIndex) in currentSheetData"
                                                    :key="rowIndex">
                                                    <td
                                                        v-for="(cell, cellIndex) in row"
                                                        :key="cellIndex"
                                                        :class="{ 'bg-light': rowIndex === 0 }"
                                                        style="padding: 4px; white-space: nowrap;">
                                                        {{ cell || '' }}
                                                    </td>
                                                </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                                <div v-else class="text-muted small p-2">Excel文件为空或无法读取</div>
                            </div>
                            <div v-else-if="uploadedExcelFile"
                                 class="border rounded p-2 text-center flex-grow-1">
                                <div class="spinner-border spinner-border-sm me-2"
                                     role="status"></div>
                                <span class="small text-muted">加载Excel预览中...</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 右侧：订单列表（Excel模式） -->
            <div class="col-md-6 order-items-section"
                 style="display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;">
                <div class="card h-100 p-3"
                     style="display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                    <div class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                        <h6 class="mb-0">转换订单 ({{ orderItems.length }} 项)</h6>
                        <div class="d-flex gap-2">

                            <button
                                v-if="hasCache"
                                class="btn btn-danger btn-sm"
                                @click="$emit('re-upload')">
                                重新上传
                            </button>
                            <button
                                v-if="hasCache"
                                class="btn btn-danger btn-sm"
                                @click="$emit('show-fix-items')">
                                调整订单内容
                            </button>
                            <!-- 朗读：与粘贴/图片模式统一 -->
                            <div class="d-flex align-items-center gap-2" style="flex-shrink: 0;">
                                <button
                                    v-if="!ttsPlaying && !ttsLoading && ttsStoppedIndex < 0"
                                    @click="$emit('read-order-list')"
                                    class="btn btn-sm btn-success"
                                    :disabled="orderItems.length === 0"
                                    style="min-width: 80px; font-weight: 500;">
                                    ▶️ 播放
                                </button>
                                <button
                                    v-if="ttsPlaying || ttsLoading"
                                    @click="$emit('pause-reading')"
                                    class="btn btn-sm btn-warning"
                                    style="min-width: 80px; font-weight: 500;">
                                    ⏸️ 暂停
                                </button>
                                <button
                                    v-if="ttsStoppedIndex >= 0 && !ttsPlaying && !ttsLoading"
                                    @click="$emit('restart-reading')"
                                    class="btn btn-sm btn-warning"
                                    style="min-width: 80px; font-weight: 500;">
                                    ⏸️ 重读
                                </button>
                                <button
                                    v-if="ttsStoppedIndex >= 0 && !ttsPlaying && !ttsLoading"
                                    @click="$emit('continue-reading')"
                                    class="btn btn-sm btn-primary"
                                    style="min-width: 80px; font-weight: 500;">
                                    ▶️ 继续
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 订单列表内容（Excel模式）：包一层保证在 card 的 flex 布局里占满剩余高度并可滚动 -->
                    <div class="order-list-slot-wrap flex-grow-1" style="min-height: 0; overflow: hidden; display: flex; flex-direction: column;">
                        <slot name="order-list"></slot>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'ExcelUpload',
    props: {
        hasCache: {
            type: Boolean,
            default: false
        },
        hasRunningTask: {
            type: Boolean,
            default: false
        },
        uploadedExcelFile: {
            type: Object,
            default: null
        },
        uploadedExcelPreview: {
            type: Object,
            default: null
        },
        orderItems: {
            type: Array,
            default: () => []
        },
        allOrdersAreDraft: {
            type: Boolean,
            default: false
        },
        sheetData: {
            type: Array,
            default: () => []
        },
        /** TTS 状态（由父组件从 OrderList 同步） */
        ttsPlaying: { type: Boolean, default: false },
        ttsLoading: { type: Boolean, default: false },
        ttsStoppedIndex: { type: Number, default: -1 }
    },
    emits: ['excel-upload', 'change-sheet',  're-upload', 'show-fix-items', 'excel-preview-loaded', 'read-order-list', 'pause-reading', 'restart-reading', 'stop-reading', 'continue-reading'],
    methods: {
        formatFileSize(bytes) {
            if (!bytes) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
        },
        // 获取当前工作表数据
        getCurrentSheetData() {
            if (!this.uploadedExcelPreview || !this.uploadedExcelPreview.sheets) {
                return [];
            }
            const currentSheetIndex = this.uploadedExcelPreview.currentSheet || 0;
            if (this.uploadedExcelPreview.sheets[currentSheetIndex]) {
                return this.uploadedExcelPreview.sheets[currentSheetIndex].data || [];
            }
            return [];
        },
        // 切换工作表
        handleChangeSheet(sheetIndex) {
            this.$emit('change-sheet', sheetIndex);
        },
        // 加载 Excel 预览（从文件）
        async loadExcelPreview(file) {
            if (!file) {
                return;
            }

            // 动态导入 xlsx 库
            let XLSX;
            try {
                XLSX = await import('xlsx');
            } catch (error) {
                console.error('无法加载 xlsx 库:', error);
                const errorPreview = {
                    sheets: [],
                    currentSheet: 0,
                    error: '无法加载 xlsx 库'
                };
                this.$emit('excel-preview-loaded', errorPreview);
                return;
            }

            try {
                // 使用 Promise 包装 FileReader
                const fileData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = new Uint8Array(e.target.result);
                            resolve(data);
                        } catch (error) {
                            reject(error);
                        }
                    };
                    reader.onerror = (error) => {
                        reject(new Error('读取文件失败'));
                    };
                    reader.readAsArrayBuffer(file);
                });

                // 使用 xlsx 读取 Excel
                const workbook = XLSX.read(fileData, {type: 'array'});

                // 提取所有工作表的数据
                const sheets = workbook.SheetNames.map((sheetName, index) => {
                    const worksheet = workbook.Sheets[sheetName];
                    // 转换为 JSON 数组（保留原始格式）
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, {defval: null});
                    return {
                        name: sheetName,
                        index: index,
                        data: jsonData
                    };
                });

                // 保存预览数据并通过 emit 传递给父组件
                const preview = {
                    sheets: sheets,
                    currentSheet: 0
                };
                this.$emit('excel-preview-loaded', preview);
            } catch (error) {
                console.error('加载Excel预览失败:', error);
                const errorPreview = {
                    sheets: [],
                    currentSheet: 0,
                    error: error.message || '加载失败'
                };
                this.$emit('excel-preview-loaded', errorPreview);
            }
        }
    },
    computed: {
        // 计算当前工作表数据
        currentSheetData() {
            return this.getCurrentSheetData();
        }
    }
}
</script>

<style scoped>
    /* 解析中蒙版样式 */
    .parsing-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.6);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        border-radius: 0.25rem;
    }

    .parsing-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    /* Excel表格滚动容器 */
    .excel-table-scroll-container {
        overflow-y: scroll !important;
        overflow-x: auto !important;
        -webkit-overflow-scrolling: touch;
    }

    .excel-table-scroll-container::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }

    .excel-table-scroll-container::-webkit-scrollbar-track {
        background: #f1f1f1;
    }

    .excel-table-scroll-container::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 4px;
    }

    .excel-table-scroll-container::-webkit-scrollbar-thumb:hover {
        background: #555;
    }
</style>


