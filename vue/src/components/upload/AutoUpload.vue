<template>
    <div class="upload-section" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
        <div class="row g-3" style="flex: 1; min-height: 0; overflow: hidden; margin: 0; align-items: stretch;">
            <!-- 左侧：文件列表和操作 / 图片预览 -->
            <div class="col-md-6"
                 style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;">
              
                 <div class="card h-100"
                     style="display: flex; flex-direction: column; border: 2px solid #007bff;">
                     
                     <div class="card-body p-1"
                         style="display: flex; flex-direction: column; min-height: 0;">
                        <!-- 文件列表和操作 -->
                        <div class=""
                             style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">
                            <!-- 操作按钮 -->
                            <div v-if="!hasCache" class="mb-3 d-flex gap-2">
                                <button
                                    class="btn btn-primary"
                                    @click="$emit('scan-folder-files')"
                                    :disabled="!customerFolderPath || scanningFiles || processingFiles">
                                    <span v-if="scanningFiles"
                                          class="spinner-border spinner-border-sm me-1"></span>
                                    {{ scanningFiles ? '扫描中...' : '刷新文件夹' }}
                                </button>
                                <button
                                    class="btn btn-success"
                                    @click="$emit('start-auto-process')"
                                    :disabled="!customerFolderPath || autoProcessFiles.length === 0 || processingFiles">
                                    <span v-if="processingFiles"
                                          class="spinner-border spinner-border-sm me-1"></span>
                                    {{ processingFiles ? '处理中...' : '开始处理' }}
                                </button>
                            </div>

                            <!-- 处理进度 -->
                            <div v-if="processingFiles" class="mb-3">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <span class="fw-bold">总体进度：</span>
                                    <span>{{ autoProcessProgress.current }}/{{ autoProcessProgress.total }}</span>
                                </div>
                                <div class="progress" style="height: 20px;">
                                    <div
                                        class="progress-bar progress-bar-striped progress-bar-animated"
                                        :style="{ width: autoProcessProgress.percent + '%' }">
                                        {{ autoProcessProgress.percent }}%
                                    </div>
                                </div>
                            </div>

                            <!-- 文件列表 -->
                            <div v-if="autoProcessFiles.length > 0"
                                 style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                                <h6 class="mb-1 red" v-if="pendingFiles.length > 0"
                                    style="background-color: #fff3cd; font-size: 12px; color: #dc3545; padding: 4px 8px; border-radius: 4px; flex-shrink: 0;">
                                    待转换新文件{{ pendingFiles.length }}个</h6>
                                <div style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto;">
                                    <!-- 已处理的文件：标签页显示 -->
                                    <div v-if="processedFiles.length > 0"
                                         style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                                        <!-- 标签页导航（固定，不滚动） -->
                                        <div style="flex-shrink: 0; overflow-x: auto; overflow-y: hidden; border-bottom: 1px solid #dee2e6;">
                                            <ul class="nav nav-tabs" role="tablist"
                                                style="flex-wrap: nowrap; white-space: nowrap; margin-bottom: 0;">
                                                <li
                                                    v-for="(file, index) in processedFiles"
                                                    :key="'tab-' + index"
                                                    class="nav-item"
                                                    role="presentation"
                                                    style="flex-shrink: 0;">
                                                    <button
                                                        class="nav-link"
                                                        :class="{ 'active': activeProcessedFileTab === file.filePath }"
                                                        @click="$emit('active-processed-file-tab-change', file.filePath)"
                                                        type="button"
                                                        style="font-size: 12px; padding: 6px 12px; white-space: nowrap;"
                                                        :title="file.fileName">
                                                        {{ file.fileType === 'excel' ? '📄' : '🖼️' }} {{ file.fileName }}
                                                    </button>
                                                </li>
                                            </ul>
                                        </div>

                                        <!-- 标签页内容（可滚动） -->
                                        <div class="tab-content border border-top-0 p-1"
                                             style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;">
                                            <div
                                                v-for="(file, index) in processedFiles"
                                                :key="'content-' + index"
                                                class="tab-pane"
                                                :class="{ 'active': activeProcessedFileTab === file.filePath }"
                                                v-show="activeProcessedFileTab === file.filePath"
                                                style="height: 100%; display: flex; flex-direction: column;">
                                                <!-- 图片文件内容 -->
                                                <div v-if="file.fileType === 'image'" class="flex-grow-1"
                                                     style="display: flex; flex-direction: column; min-height: 0;">
                                                    <div class="row flex-grow-1" style="min-height: 0;">
                                                        <div v-if="currentPreviewImage" class="flex-grow-1"
                                                             style="display: flex; flex-direction: column; min-height: 0;">
                                                            <!-- 图片预览 -->
                                                            <div v-if="currentPreviewImageSrc"
                                                                 class="border rounded p-0 position-relative flex-grow-1"
                                                                 style="min-height: 0; overflow-y: auto; overflow-x: auto; cursor: move; background-color: #f5f5f5; display: flex; align-items: start; justify-content: start;"
                                                                 @mousedown="$emit('start-drag', $event)"
                                                                 @wheel.prevent="$emit('wheel', $event)">
                                                                <div class="position-absolute top-0 end-0 m-2 d-flex gap-1"
                                                                     style="z-index: 1000; background-color: rgba(255, 255, 255, 0.9); padding: 4px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                                                    <button class="btn btn-sm btn-outline-secondary"
                                                                            @click.stop="$emit('reset-transform')"
                                                                            @mousedown.stop
                                                                            title="重置"
                                                                            style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                                                                        🔄
                                                                    </button>
                                                                    <button class="btn btn-sm btn-outline-secondary"
                                                                            @click.stop="$emit('zoom-in')"
                                                                            @mousedown.stop
                                                                            title="放大"
                                                                            style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                                                                        ➕
                                                                    </button>
                                                                    <button class="btn btn-sm btn-outline-secondary"
                                                                            @click.stop="$emit('zoom-out')"
                                                                            @mousedown.stop
                                                                            title="缩小"
                                                                            style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                                                                        ➖
                                                                    </button>
                                                                </div>
                                                                <div class="d-flex align-items-start justify-content-start"
                                                                     style="width: 100%; height: 100%; transform-origin: top left;">
                                                                    <img :src="currentPreviewImageSrc" alt="预览"
                                                                         class="img-fluid"
                                                                         :style="{
                                                                            transform: `translate(${imageTranslateX}px, ${imageTranslateY}px) scale(${imageScale})`,
                                                                            transition: isDragging ? 'none' : 'transform 0.1s',
                                                                            cursor: isDragging ? 'grabbing' : 'grab',
                                                                            maxWidth: '100%',
                                                                            width: 'auto',
                                                                            height: 'auto',
                                                                            objectFit: 'contain',
                                                                            display: 'block'
                                                                        }"
                                                                         @load="$emit('image-load', $event)"
                                                                         @dragstart.prevent>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <!-- Excel文件内容 -->
                                                <div v-if="file.fileType === 'excel'"
                                                     style="padding: 0.25rem; overflow-y: auto;">
                                                    <div>
                                                        <div v-if="autoProcessExcelPreviews && autoProcessExcelPreviews[file.filePath]">
                                                            <div v-if="autoProcessExcelPreviews[file.filePath].sheets && autoProcessExcelPreviews[file.filePath].sheets.length > 0">
                                                                <!-- 工作表选择 -->
                                                                <div v-if="autoProcessExcelPreviews[file.filePath].sheets.length > 1"
                                                                     class="mb-2">
                                                                    <select
                                                                        class="form-select form-select-sm"
                                                                        :value="autoProcessExcelPreviews[file.filePath].currentSheet || 0"
                                                                        @change="$emit('change-excel-sheet', file.filePath, $event.target.value)">
                                                                        <option
                                                                            v-for="(sheet, sheetIndex) in autoProcessExcelPreviews[file.filePath].sheets"
                                                                            :key="sheetIndex"
                                                                            :value="sheetIndex">
                                                                            {{ sheet.name }}
                                                                        </option>
                                                                    </select>
                                                                </div>
                                                                <!-- 表格显示 -->
                                                                <div class="table-responsive">
                                                                    <table class="table table-sm table-bordered"
                                                                           style="font-size: 11px;">
                                                                        <tbody>
                                                                        <tr v-for="(row, rowIndex) in getCurrentExcelSheetData(file.filePath)"
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
                                                            <div v-else class="text-muted small">
                                                                Excel文件为空或无法读取
                                                            </div>
                                                        </div>
                                                        <div v-else class="text-muted small">
                                                            <div class="spinner-border spinner-border-sm me-2"
                                                                 role="status"></div>
                                                            加载中...
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- 待处理的文件：列表显示 -->
                                    <div v-if="pendingFiles.length > 0 && processedFiles.length == 0"
                                         class="mb-1">
                                        <h6 class="mb-2 small text-muted">待处理文件 ({{ pendingFiles.length }})</h6>
                                        <div class="list-group"
                                             style="max-height: 300px; overflow-y: auto;">
                                            <div
                                                v-for="(file, index) in pendingFiles"
                                                :key="'pending-' + index"
                                                class="list-group-item d-flex justify-content-between align-items-center"
                                                :class="{
                                                    'list-group-item-warning': file.status === 'processing',
                                                    'list-group-item-danger': file.status === 'error',
                                                    'list-group-item-secondary': file.status === 'pending'
                                                }">
                                                <div class="d-flex align-items-center flex-grow-1"
                                                     style="min-width: 0;">
                                                    <span class="me-2" style="font-size: 18px;">
                                                        {{ file.fileType === 'excel' ? '📄' : '🖼️' }}
                                                    </span>
                                                    <div class="flex-grow-1" style="min-width: 0;">
                                                        <div class="fw-bold"
                                                             style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                                                             :title="file.fileName">
                                                            {{ file.fileName }}
                                                        </div>
                                                        <div class="small text-muted">
                                                            <span v-if="file.status === 'pending'">待处理</span>
                                                            <span v-else-if="file.status === 'processing'">处理中... ({{ file.progress }}%)</span>
                                                            <span v-else-if="file.status === 'success'">处理成功 ({{ file.orderCount || 0 }}条订单)</span>
                                                            <span v-else-if="file.status === 'error'">处理失败: {{ file.error }}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="d-flex gap-2 align-items-center"
                                                     style="flex-shrink: 0;">
                                                    <!-- 处理进度条 -->
                                                    <div v-if="file.status === 'processing'"
                                                         class="progress"
                                                         style="width: 100px; height: 20px;">
                                                        <div
                                                            class="progress-bar progress-bar-striped progress-bar-animated"
                                                            :style="{ width: file.progress + '%' }">
                                                            {{ file.progress }}%
                                                        </div>
                                                    </div>
                                                    <!-- 打开文件按钮 -->
                                                    <button
                                                        v-if="file.status !== 'processing'"
                                                        class="btn btn-sm btn-outline-primary"
                                                        @click="$emit('open-file', file.filePath)"
                                                        title="打开文件">
                                                        📂
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 右侧：订单列表 -->
            <div class="col-md-6 order-items-section"
                 style="display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;">
                <div class="card h-100 p-2"
                     style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; border: 2px solid #28a745;">
                    <div class="d-flex justify-content-between align-items-center mb-3"
                         style="flex-shrink: 0;">
                        <h6 class="mb-0">转换订单 ({{ filteredOrderItems.length }} 项)</h6>
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
                        </div>
                    </div>

                    <!-- 订单列表内容 -->
                    <slot name="order-list"></slot>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'AutoUpload',
    props: {
        hasCache: {
            type: Boolean,
            default: false
        },
        customerFolderPath: {
            type: String,
            default: ''
        },
        scanningFiles: {
            type: Boolean,
            default: false
        },
        processingFiles: {
            type: Boolean,
            default: false
        },
        autoProcessFiles: {
            type: Array,
            default: () => []
        },
        pendingFiles: {
            type: Array,
            default: () => []
        },
        processedFiles: {
            type: Array,
            default: () => []
        },
        activeProcessedFileTab: {
            type: String,
            default: ''
        },
        autoProcessProgress: {
            type: Object,
            default: () => ({ current: 0, total: 0, percent: 0 })
        },
        currentPreviewImage: {
            type: Object,
            default: null
        },
        currentPreviewImageSrc: {
            type: String,
            default: ''
        },
        imageTranslateX: {
            type: Number,
            default: 0
        },
        imageTranslateY: {
            type: Number,
            default: 0
        },
        imageScale: {
            type: Number,
            default: 1
        },
        isDragging: {
            type: Boolean,
            default: false
        },
        autoProcessExcelPreviews: {
            type: Object,
            default: () => ({})
        },
        filteredOrderItems: {
            type: Array,
            default: () => []
        },
        allOrdersAreDraft: {
            type: Boolean,
            default: false
        }
    },
    emits: [
        'scan-folder-files',
        'start-auto-process',
        'active-processed-file-tab-change',
        'start-drag',
        'wheel',
        'reset-transform',
        'zoom-in',
        'zoom-out',
        'image-load',
        'change-excel-sheet',
        'open-file',
        're-upload',
        'show-fix-items'
    ],
    methods: {
        getCurrentExcelSheetData(filePath) {
            if (!this.autoProcessExcelPreviews || !this.autoProcessExcelPreviews[filePath]) {
                return [];
            }
            const preview = this.autoProcessExcelPreviews[filePath];
            const currentSheetIndex = preview.currentSheet || 0;
            if (preview.sheets && preview.sheets[currentSheetIndex]) {
                return preview.sheets[currentSheetIndex].data || [];
            }
            return [];
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
</style>

