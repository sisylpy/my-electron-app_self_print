<template>
    <div class="upload-section" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
       
        <!-- 任务栏：添加新表格 + 任务列表（仅 placeOrder 且 depId 有值时显示，保存订单后 loadTaskList 会刷新） -->
        <div v-if="depId && source === 'placeOrder' && (taskList.length > 0 || loadingTaskList)" class="card-header py-2 px-2 d-flex align-items-center flex-wrap gap-1 mb-2" style="flex-shrink: 0;">
            <button
                type="button"
                class="btn btn-sm flex-shrink-0"
                :class="(currentTaskId == null && !currentTask) ? 'btn-primary' : 'btn-outline-primary'"
                @click="onAddNewContentClick"
                title="添加新表格 / 恢复上一任务">
                +
            </button>
            <template v-if="taskList.length > 0">
                <div class="task-tabs-wrap d-flex flex-wrap gap-1 align-items-center">
                    <template v-for="(task, idx) in taskList" :key="task.nxOcrTaskId != null ? task.nxOcrTaskId : task.id || idx">
                        <button
                            type="button"
                            class="btn btn-sm task-tab"
                            :class="{ 'btn-primary': isTaskActive(task), 'btn-outline-secondary': !isTaskActive(task) }"
                            :disabled="selectTaskLoading"
                            @click="onSelectTask(task)">
                            {{ getExcelTaskDisplayName(task) }}
                        </button>
                    </template>
                </div>
            </template>
            <div v-else-if="loadingTaskList" class="small text-muted">加载任务列表...</div>
        </div>
        <!-- Excel 粘贴 Prompt 弹窗 -->
        <div v-if="showExcelPastePromptModal" class="modal fade show" style="display: block;" tabindex="-1" @click.self="showExcelPastePromptModal = false">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">AI 解析订单 - 自定义 Prompt</h5>
                        <button type="button" class="btn-close" @click="showExcelPastePromptModal = false"></button>
                    </div>
                    <div class="modal-body">
                        <!-- CSV 数据预览 -->
                        <div class="mb-3">
                            <label class="form-label fw-bold">表格数据（CSV 格式）：</label>
                            <textarea
                                    class="form-control"
                                    rows="8"
                                    readonly
                                    v-model="excelPasteCsvData"
                                    style="font-family: monospace; font-size: 12px;"></textarea>
                        </div>
                        <!-- 附加 Prompt 输入 -->
                        <div class="mb-3">
                            <label class="form-label fw-bold">附加 Prompt（可选，用于补充说明）：</label>
                            <textarea
                                    class="form-control"
                                    rows="5"
                                    v-model="excelPastePromptText"
></textarea>
                            <small class="text-muted">系统已内置完整的解析规则，此处可输入额外的补充说明</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="showExcelPastePromptModal = false">取消</button>
                        <button
                                type="button"
                                class="btn btn-primary"
                                @click="aiRecogniseExcelPasteTable"
                                :disabled="showDeepSeekLoading">
                            {{ showDeepSeekLoading ? 'AI识别中...' : '开始识别' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="showExcelPastePromptModal" class="modal-backdrop fade show"></div>

        <div
            class="excel-paste-split"
            :class="{
                'is-left-active': activePane === 'left',
                'is-right-active': activePane === 'right'
            }"
            @mouseleave="activePane = ''">
            <!-- 左侧：Excel 粘贴表格区域（min-height:0 防止溢出遮挡底部滚动条） -->
            <div
                class="excel-paste-pane excel-paste-pane--left"
                @mouseenter="activePane = 'left'"
                @focusin="activePane = 'left'">
                <div class="card h-100" style="min-height: 0; overflow: hidden; display: flex; flex-direction: column;">
                    <div class="card-body p-2"
                         style="display: flex; flex-direction: column; min-height: 0; flex: 1; overflow: hidden; position: relative;">
                        <!-- AI 解析中蒙版 -->
                        <div v-if="showDeepSeekLoading" class="parsing-overlay">
                            <div class="parsing-content">
                                <div class="spinner-border text-primary" role="status"
                                     style="width: 3rem; height: 3rem;">
                                    <span class="visually-hidden">加载中...</span>
                                </div>
                                <div class="mt-3" style="color: #fff; font-size: 16px; font-weight: 500;">
                                    AI识别中...
                                </div>
                            </div>
                        </div>
<!--                        <h6 class="mb-2 px-2">📋 Excel 粘贴</h6>-->
                        <div class="mb-2 px-2 small text-muted" v-if="excelPasteOrderItems.length === 0 && !hasTableData">
                            💡 提示：请先点击表格中的任意单元格，然后按 Ctrl+V 粘贴 Excel 数据
                        </div>
                        <!-- 按钮区域 -->
                        <div class="d-flex justify-content-between align-items-center mb-2 px-2"
                             style="flex-shrink: 0;">

                            <h6 class="mb-0" v-if="excelPasteOrderItems.length > 0">解析订单 ({{ excelPasteOrderItems.length }} 项)</h6>
                            <div class="d-flex gap-2">
                                <!-- 状态1：草稿状态（excelPasteSaveCount == null） -->
                                <template v-if="hasTableData && excelPasteOrderItems.length == 0 ">
                                    <button

                                        class="btn btn-secondary btn-sm"
                                        @click="$emit('clear-table-data')">
                                        清空表格
                                    </button>
                                    <!-- Ai解析订单按钮始终显示，没有数据时禁用，提示用户可以编辑表格 -->
                                    <button
                                            v-if="hasTableData "
                                            class="btn btn-success btn-sm"
                                            @click="showExcelPastePromptDialog"
                                            :disabled="!hasTableData || savingOrder || showDeepSeekLoading"
                                            :title="!hasTableData ? '请先粘贴或输入表格数据' : ''">
                                        {{ showDeepSeekLoading ? 'AI识别中...' : 'Ai解析订单' }}
                                    </button>
                                    <button  v-if="hasTableData"
                                            class="btn btn-success btn-sm"
                                            @click="directConvertTableToOrders"
                                            :disabled="!hasTableData || savingOrder"
                                            :title="!hasTableData ? '请先粘贴或输入表格数据' : '按表格列直接转为订单，无需 AI'">
                                        解析订单
                                    </button>


                                </template>
                            </div>
                        </div>
                        <!-- vxe-table 表格容器（含左右滚动按钮） -->
                        <div class="excel-paste-table-wrap" style="flex: 1; min-height: 0; overflow: hidden; display: flex; align-items: stretch; position: relative;">
<!--                             左滚动按钮（有表格行且可编辑时显示）-->
<!--                            <button v-if="tableData.length > 0 && excelPasteOrderItems.length === 0"-->
<!--                                    type="button"-->
<!--                                    class="excel-paste-scroll-btn excel-paste-scroll-btn-left"-->
<!--                                    :disabled="!canScrollTableLeft"-->
<!--                                    title="向左滚动"-->
<!--                                    @click="scrollTableLeft">-->
<!--                                ‹-->
<!--                            </button>-->
                            <div
                                ref="excelPasteTableContainerRef"
                                style="flex: 1; min-height: 0; overflow: hidden;"
                                :class="{ 'table-disabled': excelPasteOrderItems.length > 0 }"
                                @paste="handleTablePaste"
                                @keydown="handleTableKeydown"
                                :tabindex="excelPasteOrderItems.length > 0 ? -1 : 0">
                            <vxe-table
                                ref="excelPasteTableRef"
                                :data="tableData"
                                :row-class-name="getExcelPasteRowClassName"
                                :edit-config="{ 
                                    trigger: excelPasteOrderItems.length > 0 ? 'manual' : 'click', 
                                    mode: 'cell',
                                    enabled: excelPasteOrderItems.length === 0
                                }"
                                :clipboard-option="{
                                    isCopy: true,
                                    isCut: true,
                                    isPaste: false
                                }"
                                :keyboard-config="{ isArrow: true, isDel: true, isEnter: true, isTab: true }"
                                :scroll-y="{ enabled: true }"
                                :scroll-x="{ enabled: true }"
                                border
                                height="100%"
                                size="small"
                                style="font-size: 12px;"
                                @cell-click="handleCellClick"
                                @edit-closed="handleEditClosed">
                                <vxe-column type="seq" title="序号" width="38" align="center" fixed="left"></vxe-column>
                                <vxe-column field="goodsName" title="商品名称" width="84" fixed="left"
                                            :edit-render="{ name: 'input', props: { placeholder: '商品名称' } }"></vxe-column>
                                <vxe-column field="quantity" title="数量" width="56" align="center"
                                            :edit-render="{ name: 'input', props: { placeholder: '数量' } }"></vxe-column>
                                <vxe-column field="specification" title="规格" width="56" align="center"
                                            :edit-render="{ name: 'input', props: { placeholder: '规格' } }"></vxe-column>
                                <vxe-column field="specificationWeight" title="规格重量" width="72" align="center"
                                            :edit-render="{ name: 'input', props: { placeholder: '规格重量' } }"></vxe-column>
                                <vxe-column field="cartonQuantity" title="大包装数量" width="72" align="center"
                                            :edit-render="{ name: 'input', props: { placeholder: '大包装数量' } }"></vxe-column>
                                <vxe-column field="cartonName" title="大包装名称" width="56" align="center"
                                            :edit-render="{ name: 'input', props: { placeholder: '大包装名称' } }"></vxe-column>
                                <vxe-column field="remark" title="备注" min-width="90"
                                            :edit-render="{ name: 'input', props: { placeholder: '备注' } }"></vxe-column>
                                <!-- 仅在「未生成右侧订单」时可编辑表格：操作列与 hasTableData 无关，有数据后仍需 +/− 调整行 -->
                                <vxe-column title="" width="60" align="center" fixed="right" class-name="excel-paste-actions-col" v-if="excelPasteOrderItems.length == 0">
                                    <template #default="{ row, rowIndex }" >
                                        <span v-if="rowHasData(row || tableData[rowIndex])" class="excel-paste-row-actions">
                                            <button type="button" class="excel-paste-btn excel-paste-btn-add" title="在上方插入一行" @click.stop="onInsertRowAbove(rowIndex)">+</button>
                                            <button type="button" class="excel-paste-btn excel-paste-btn-del" title="删除本行" @click.stop="onDeleteRow(rowIndex)">−</button>
                                        </span>
                                    </template>
                                </vxe-column>
                            </vxe-table>
                            </div>
                            <!-- 右滚动按钮 -->
<!--                            <button v-if="tableData.length > 0 && excelPasteOrderItems.length === 0"-->
<!--                                    type="button"-->
<!--                                    class="excel-paste-scroll-btn excel-paste-scroll-btn-right"-->
<!--                                    :disabled="!canScrollTableRight"-->
<!--                                    title="向右滚动"-->
<!--                                    @click="scrollTableRight">-->
<!--                                ›-->
<!--                            </button>-->
                        </div>
                    </div>
                </div>
            </div>

            <!-- 右侧：订单列表（Excel 粘贴独立） -->
            <div
                 class="excel-paste-pane excel-paste-pane--right order-items-section"
                 @mouseenter="activePane = 'right'"
                 @focusin="activePane = 'right'">
                <div class="card h-100 p-3"
                     style="display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                    <div class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                        <div>
                            <h6 class="mb-0">解析订单({{ excelPasteOrderItems.length }} 项)</h6>
                            <div v-if="currentTask" class="image-stats-row small text-muted mt-1 d-flex gap-3">
                                <span class="image-stats-item">
                                    订单:
                                    <template v-if="(currentTask.nxOcrTaskPendingOrders ?? 0) === 0">
                                        {{ currentTask.nxOcrTaskTotalOrders ?? 0 }}个
                                    </template>
                                    <template v-else>
                                        <span class="text-success">{{ currentTask.nxOcrTaskCompletedOrders ?? 0 }}</span>/{{ currentTask.nxOcrTaskTotalOrders ?? 0 }}个
                                    </template>
                                </span>
                            </div>
                        </div>

                        <div class="d-flex gap-2">

                        <template v-if="excelPasteSaveCount == null">
                            <button
                                    v-if="excelPasteOrderItems.length > 0"
                                    class="btn btn-secondary btn-sm"
                                    @click="$emit('clear-order-items')">
                                清空订单
                            </button>
                            <button
                                    v-if="excelPasteOrderItems.length > 0"
                                    class="btn btn-success btn-sm"
                                    @click="$emit('save-orders')"
                                    :disabled="savingOrder">
                                {{ savingOrder ? '保存中...' : '保存订单' }}
                            </button>
                        </template>
                        <template v-else>

                            <button
                                    v-if="excelPasteHasCache"
                                    class="btn btn-danger btn-sm"
                                    @click="$emit('re-upload')">
                                删除
                            </button>
                            <button
                                    v-if="excelPasteHasCache"
                                    class="btn btn-outline-info btn-sm"
                                    @click="$emit('show-fix-items')">
                                Ai协助调整
                            </button>

                            <button
                                    v-if="currentTask  && currentTask.nxOcrTaskPendingOrders  == 0"
                                    class="btn btn-success btn-sm"
                                    @click="$emit('finish-task')">
                                完成
                            </button>
                            <!-- 朗读：与粘贴/图片模式统一，由父组件同步 TTS 状态并调用 OrderList -->
                            <div class="d-flex align-items-center gap-2" style="flex-shrink: 0;">
                                <button
                                    v-if="!ttsPlaying && !ttsLoading && ttsStoppedIndex < 0"
                                    @click="$emit('read-order-list')"
                                    class="btn btn-sm btn-success"
                                    :disabled="excelPasteOrderItems.length === 0"
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
                                    class="btn btn-sm btn-success"
                                    style="min-width: 80px; font-weight: 500;">
                                    ▶️ 继续
                                </button>
                            </div>
                        </template>
                        </div>
                    </div>


                    <!-- 订单列表内容（Excel 粘贴独立显示）：包一层保证在 card 的 flex 布局里占满剩余高度并可滚动 -->
                    
                     <!-- 订单列表内容（复制粘贴独立显示）：包一层保证在 card 的 flex 布局里占满剩余高度并可滚动 -->
                     <div class="order-list-slot-wrap flex-grow-1"
                         style="min-height: 0; overflow: hidden; display: flex; flex-direction: column;">
                        <slot name="order-list"></slot>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Toast 提示组件 -->
    <Toast
            v-model:visible="toastVisible"
            :message="toastMessage"
            :type="toastType"
            :duration="toastDuration"
    />
    <AlertDialog ref="alertDialog" />
</template>

<script>
import api from "../../api/all";
import Toast from '../Toast.vue';
import AlertDialog from '../AlertDialog.vue';

export default {
    name: 'ExcelPasteUpload',
    components: {
        Toast,
        AlertDialog
    },
    props: {
        tableData: {
            type: Array,
            default: () => []
        },
        hasTableData: {
            type: Boolean,
            default: false
        },
        excelPasteOrderItems: {
            type: Array,
            default: () => []
        },
        excelPasteHasCache: {
            type: Boolean,
            default: false
        },
        excelPasteSaveCount: {
            type: [Number, null],
            default: null
        },
        showDeepSeekLoading: {
            type: Boolean,
            default: false
        },
        savingOrder: {
            type: Boolean,
            default: false
        },
        allOrdersAreDraft: {
            type: Boolean,
            default: false
        },
        parseExcelPasteData: {
            type: Function,
            default: null
        },
        /** 区分来源：'placeOrder' 下单页 | 'taskOrder' 任务页，用于按来源显示不同 UI（如任务栏仅在 placeOrder 显示） */
        source: {
            type: String,
            default: 'placeOrder',
            validator: (v) => !v || v === 'placeOrder' || v === 'taskOrder'
        },
        depId: {
            type: Number,
            default: null
        },
        taskType: {
            type: [Number, String],
            default: null
        },

        currentTask: { type: Object, default: null },
        currentTaskId: { type: [Number, String], default: null },
        /** 切换任务时请求任务内容中（显示蒙版） */
        selectTaskLoading: {
            type: Boolean,
            default: false
        },

        /** TTS 状态（由父组件从 OrderList 同步） */
        ttsPlaying: { type: Boolean, default: false },
        ttsLoading: { type: Boolean, default: false },
        ttsStoppedIndex: { type: Number, default: -1 }
    },
    emits: [
        'read-order-list',
        'pause-reading',
        'restart-reading',
        'stop-reading',
        'continue-reading',
        'clear-table-data',
        'ai-recognise',
        'clear-order-items',
        'save-orders',
        're-upload',
        'show-fix-items',
        'table-data-change',
        'table-data-update',
        'cell-click',
        'edit-closed',
        'ai-recognise-complete',
        'direct-table-to-orders',
        'select-task',
        'add-new-content',
        'close-new-content',
        'insert-row-above',
        'delete-row',
        'finish-task'
    ],
    data() {
        return {
            taskList: [],
            activeTaskId: null,
            activePane: '',
            loadingTaskList: false,
            currentPasteRowIndex: 0,
            currentPasteColIndex: 0,
            showExcelPastePromptModal: false, // 是否显示 Excel 粘贴的 Prompt 弹窗
            excelPastePromptText: '', // Excel 粘贴的 Prompt 文本
            excelPasteCsvData: '', // Excel 粘贴的 CSV 数据（用于预览）
            isUnmounted: false, // 组件是否已卸载标志
            failedRowIndex: -1, // 校验失败的行索引（0-based），用于高亮并滚动到该行
            tableScrollState: { scrollLeft: 0, scrollWidth: 0, clientWidth: 0 }, // 表格横向滚动状态，用于左右滚动按钮

            // Toast 提示相关
            toastVisible: false,
            toastMessage: '',
            toastType: 'info',
            toastDuration: 3000
        }
    },
    computed: {
        tableHasHorizontalScroll() {
            const s = this.tableScrollState;
            return s.scrollWidth > s.clientWidth;
        },
        canScrollTableLeft() {
            return this.tableScrollState.scrollLeft > 0;
        },
        canScrollTableRight() {
            const s = this.tableScrollState;
            const maxLeft = Math.max(0, s.scrollWidth - s.clientWidth);
            return s.scrollLeft < maxLeft - 1;
        }
    },
    watch: {
        depId: {
            handler(val) {
                this.cancelScheduledTaskListLoad();
                this.taskList = [];
                this.activeTaskId = null;
                if (val != null) {
                    // 先渲染可编辑表格；历史任务在浏览器空闲时静默读取。
                    this.scheduleTaskListLoad();
                }
            },
            immediate: false
        },
        currentTaskId(val) {
            this.activeTaskId = val != null ? val : null;
        },
        tableData: {
            handler() {
                this.$nextTick(() => {
                    this.updateTableScrollState();
                    this.bindTableScrollListener();
                });
            },
            deep: true
        }
    },
    mounted() {
        if (this.depId != null) this.scheduleTaskListLoad();
        this.$nextTick(() => {
            this.updateTableScrollState();
            this.bindTableScrollListener();
        });
        this._resizeHandler = () => {
            if (this.tableData.length > 0 && this.excelPasteOrderItems.length === 0) {
                this.updateTableScrollState();
            }
        };
        window.addEventListener('resize', this._resizeHandler);
    },
    beforeUnmount() {
        this.isUnmounted = true;
        this.cancelScheduledTaskListLoad();
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler);
        }
    },
    methods: {
        cancelScheduledTaskListLoad() {
            if (this._taskListIdleId != null && typeof window.cancelIdleCallback === 'function') {
                window.cancelIdleCallback(this._taskListIdleId);
            }
            if (this._taskListLoadTimer) clearTimeout(this._taskListLoadTimer);
            this._taskListIdleId = null;
            this._taskListLoadTimer = null;
        },
        scheduleTaskListLoad() {
            this.cancelScheduledTaskListLoad();
            const loadInBackground = () => {
                this._taskListIdleId = null;
                this._taskListLoadTimer = null;
                if (!this.isUnmounted && this.depId != null) {
                    this.loadTaskList(null, { selectFirst: false, silent: true });
                }
            };
            if (typeof window.requestIdleCallback === 'function') {
                this._taskListIdleId = window.requestIdleCallback(loadInBackground, { timeout: 1200 });
            } else {
                this._taskListLoadTimer = setTimeout(loadInBackground, 300);
            }
        },
        // 显示 Toast 提示
        showToast(message, type = 'info', duration = 3000) {
            this.toastMessage = message;
            this.toastType = type;
            this.toastDuration = duration;
            this.toastVisible = true;
        },

        /** 获取 vxe-table 横向滚动容器 */
        getTableScrollEl() {
            const table = this.$refs.excelPasteTableRef;
            if (!table || !table.$el) return null;
            // 遍历查找有横向溢出的可滚动元素（vxe-table 固定列时可能在不同元素上）
            const walk = (el) => {
                if (!el || el.nodeType !== 1) return null;
                const style = window.getComputedStyle(el);
                const overflowX = style.overflowX || style.overflow;
                if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
                    return el;
                }
                for (let i = 0; i < el.children.length; i++) {
                    const found = walk(el.children[i]);
                    if (found) return found;
                }
                return null;
            };
            const found = walk(table.$el);
            if (found) return found;
            // 回退：返回 body-wrapper
            return table.$el.querySelector('.vxe-table--body-wrapper') || table.$el.querySelector('.vxe-table--main-wrapper');
        },
        /** 更新表格横向滚动状态（用于左右按钮显示） */
        updateTableScrollState() {
            const el = this.getTableScrollEl();
            if (!el) return;
            this.tableScrollState = {
                scrollLeft: el.scrollLeft,
                scrollWidth: el.scrollWidth,
                clientWidth: el.clientWidth
            };
        },
        /** 绑定表格滚动监听，用于更新按钮状态 */
        bindTableScrollListener() {
            this.$nextTick(() => {
                const el = this.getTableScrollEl();
                if (!el || el.dataset.scrollListenerBound === '1') return;
                el.dataset.scrollListenerBound = '1';
                el.addEventListener('scroll', () => this.updateTableScrollState());
            });
        },
        /** 向左滚动 */
        scrollTableLeft() {
            const table = this.$refs.excelPasteTableRef;
            const el = this.getTableScrollEl();
            if (el) {
                el.scrollLeft = Math.max(0, el.scrollLeft - 150);
            } else if (table && typeof table.scrollTo === 'function') {
                const s = this.tableScrollState;
                table.scrollTo(Math.max(0, s.scrollLeft - 150), 0);
            }
            this.updateTableScrollState();
        },
        /** 向右滚动 */
        scrollTableRight() {
            const table = this.$refs.excelPasteTableRef;
            const el = this.getTableScrollEl();
            if (el) {
                const maxLeft = el.scrollWidth - el.clientWidth;
                el.scrollLeft = Math.min(maxLeft, el.scrollLeft + 150);
            } else if (table && typeof table.scrollTo === 'function') {
                const s = this.tableScrollState;
                const maxLeft = Math.max(0, s.scrollWidth - s.clientWidth);
                table.scrollTo(Math.min(maxLeft, s.scrollLeft + 150), 0);
            }
            this.updateTableScrollState();
        },
        /** 判断行是否有数据（用于 + - 按钮是否显示） */
        rowHasData(row) {
            if (!row) return false;
            const fields = ['goodsName', 'quantity', 'specification', 'specificationWeight', 'cartonQuantity', 'cartonName', 'remark'];
            return fields.some(f => {
                const v = row[f];
                return v != null && String(v).trim() !== '';
            });
        },

        /**
         * @param {number|null} [selectTaskId] - 刷新后要选中的任务 ID
         * @param {{selectFirst?: boolean, silent?: boolean}} [options]
         */
        async loadTaskList(selectTaskId, options = {}) {
            const requestDepId = this.depId;
            const selectFirst = options.selectFirst !== false;
            if (!options.silent) this.loadingTaskList = true;
            try {
                const taskType = this.taskType != null ? Number(this.taskType) : 2;
                const res = await api.depGetTaskList(requestDepId, taskType);
                if (String(requestDepId) !== String(this.depId)) return this.taskList;
                const data = res && res.data;
                if (data && data.code === 0) {
                    let list = data.data != null ? data.data : (data.list || data);
                    if (!Array.isArray(list)) list = [];
                    this.taskList = list.slice().sort((a, b) => {
                        const tA = (a.nxOcrTaskCreateDate || a.createDate || '').toString();
                        const tB = (b.nxOcrTaskCreateDate || b.createDate || '').toString();
                        return tB.localeCompare(tA);
                    });
                    if (this.taskList.length > 0) {
                        if (selectTaskId != null) {
                            this.activeTaskId = selectTaskId;
                            const found = this.taskList.find(t => {
                                const id = t.nxOcrTaskId != null ? t.nxOcrTaskId : t.id;
                                return id != null && Number(id) === Number(selectTaskId);
                            });
                            if (found) this.$emit('select-task', { taskId: selectTaskId, task: found });
                        } else if (selectFirst) {
                            const first = this.taskList[0];
                            this.activeTaskId = first.nxOcrTaskId != null ? first.nxOcrTaskId : first.id;
                            this.$emit('select-task', { taskId: this.activeTaskId, task: first });
                        }
                    }
                } else {
                    this.taskList = [];
                }
            } catch (e) {
                console.error('[PasteUpload] loadTaskList failed:', e);
                this.taskList = [];
            } finally {
                if (!options.silent) this.loadingTaskList = false;
            }
            return this.taskList;
        },
        isTaskActive(task) {
            const taskId = task.nxOcrTaskId != null ? task.nxOcrTaskId : task.id;
            if (taskId == null || taskId === '') return false;
            const a = Number(this.activeTaskId);
            const b = Number(taskId);
            if (!Number.isNaN(a) && !Number.isNaN(b) && a === b) return true;
            if (!this.currentTask) return false;
            const curId = this.currentTask.nxOcrTaskId != null ? this.currentTask.nxOcrTaskId : this.currentTask.id;
            if (curId == null || curId === '') return false;
            return Number(curId) === Number(taskId);
        },

        onSelectTask(task) {
            const id = task.nxOcrTaskId != null ? task.nxOcrTaskId : task.id;
            if (id == null) return;
            this.activeTaskId = id;
            this.$emit('select-task', {taskId: id, task});
        },
        /** 从任务 CSV 中提取商品名称，展示前几个商品各前 5 个字符 + ... */
        getExcelTaskDisplayName(task) {
            const csv = (task.nxOcrTaskOcrText != null ? task.nxOcrTaskOcrText : task.nxOcrTaskFileName) || '';
            if (!csv || typeof csv !== 'string' || !csv.trim()) return task.nxOcrTaskFileName || '任务';
            const lines = csv.trim().split(/\r?\n/).filter(Boolean);
            if (lines.length < 2) return task.nxOcrTaskFileName || '任务';
            const dataLines = lines.slice(1);
            const names = [];
            for (const line of dataLines) {
                const cols = line.split(',');
                const name = (cols[0] || '').trim();
                if (name) {
                    names.push(name.slice(0, 5));
                }
                if (names.length >= 3) break;
            }
            if (names.length === 0) return task.nxOcrTaskFileName || '任务';
            return names.join(',') + '...';
        },
        addOrUpdateTaskAndSelect(task) {
            if (!task) return;
            const taskId = task.nxOcrTaskId != null ? task.nxOcrTaskId : task.id;
            if (taskId == null) return;
            const idx = this.taskList.findIndex(t => {
                const id = t.nxOcrTaskId != null ? t.nxOcrTaskId : t.id;
                return id != null && Number(id) === Number(taskId);
            });
            if (idx >= 0) {
                this.taskList = this.taskList.map((t, i) => i === idx ? { ...t, ...task } : t);
            } else {
                this.taskList = [task, ...this.taskList];
            }
            this.activeTaskId = taskId;
        },
        /** “+“ 点击：若已在添加新内容状态则关闭（仅页面切换），否则进入添加新内容 */
        onAddNewContentClick() {
            if (this.currentTaskId == null && !this.currentTask) {
                this.$emit('close-new-content');
            } else {
                this.$emit('add-new-content');
            }
        },

        /** 在指定行上方插入一行空白 */
        onInsertRowAbove(rowIndex) {
            if (this.excelPasteOrderItems && this.excelPasteOrderItems.length > 0) return;
            this.$emit('insert-row-above', rowIndex);
        },

        /** 删除指定行 */
        onDeleteRow(rowIndex) {
            if (this.excelPasteOrderItems && this.excelPasteOrderItems.length > 0) return;
            this.$emit('delete-row', rowIndex);
        },

        /** 行动画 / 校验失败高亮：插入、删除、校验失败时返回对应 class */
        getExcelPasteRowClassName({ row, rowIndex }) {
            const classes = [];
            if (row._justInserted) classes.push('excel-paste-row-inserting');
            if (row._deleting) classes.push('excel-paste-row-deleting');
            if (this.failedRowIndex === rowIndex) classes.push('excel-paste-row-validation-failed');
            return classes.join(' ') || '';
        },

        async handleTablePaste(event) {
            // 检查组件是否已卸载
            if (this.isUnmounted) {
                console.warn('⚠️ [表格粘贴] 组件已卸载，取消操作');
                return;
            }

            // 如果右侧已有订单，禁止继续粘贴，避免数据混乱
            if (this.excelPasteOrderItems && this.excelPasteOrderItems.length > 0) {
                console.warn('⚠️ [表格粘贴] 右侧已有订单，禁止继续粘贴，请先清空订单');
                event.preventDefault();
                this.showToast('右侧已有订单，如需继续编辑表格，请先清空订单', 'warning');
                return;
            }

            console.log('📋 [表格粘贴] 粘贴事件触发');
            event.preventDefault();

            const pasteData = event.clipboardData.getData('text');
            console.log('📋 [表格粘贴] 原始粘贴数据:', pasteData);
            console.log('📋 [表格粘贴] 数据长度:', pasteData.length);

            if (!pasteData) {
                console.warn('⚠️ [表格粘贴] 没有粘贴数据');
                return;
            }

            // 解析粘贴的数据（调用父组件的方法）
            const rows = this.parseExcelPasteData ? this.parseExcelPasteData(pasteData) : this.defaultParseExcelPasteData(pasteData);

            console.log('📋 [表格粘贴] 解析后的行数:', rows.length);
            console.log('📋 [表格粘贴] 解析后的数据:', rows);

            // 获取当前选中的单元格信息（检查组件是否已卸载）
            if (!this.$refs || !this.$refs.excelPasteTableRef) {
                console.warn('⚠️ [表格粘贴] 无法获取表格引用，组件可能正在卸载');
                return;
            }
            const table = this.$refs.excelPasteTableRef;

            // 使用保存的当前单元格位置
            const columns = ['goodsName', 'quantity', 'specification', 'specificationWeight', 'cartonQuantity', 'cartonName', 'remark'];
            let startRowIndex = this.currentPasteRowIndex;
            let startColIndex = this.currentPasteColIndex;

            console.log('📋 [表格粘贴] 使用保存的位置 - 起始行索引:', startRowIndex, '起始列索引:', startColIndex);
            console.log('📋 [表格粘贴] 当前保存的位置 - 行:', this.currentPasteRowIndex, '列:', this.currentPasteColIndex);

            // 检查粘贴的数据是否会超出表格最大行数（50行）
            const maxRows = 50;
            const lastRowIndex = startRowIndex + rows.length - 1;
            const exceededRows = lastRowIndex >= maxRows ? lastRowIndex - maxRows + 1 : 0;
            const validRows = exceededRows > 0 ? rows.length - exceededRows : rows.length;

            if (exceededRows > 0) {
                const message = `表格最多支持 ${maxRows} 行数据。您粘贴了 ${rows.length} 行数据，起始于第 ${startRowIndex + 1} 行。将有 ${exceededRows} 行数据被丢弃（第 ${startRowIndex + validRows + 1} 行到第 ${lastRowIndex + 1} 行）。`;
                console.warn(`⚠️ [表格粘贴] ${message}`);
                this.showToast(message, 'warning');
            }

            // 将数据填充到表格中（通过 emit 通知父组件更新 tableData）
            const updates = [];
            rows.forEach((rowData, rowIndex) => {
                const targetRowIndex = startRowIndex + rowIndex;
                console.log(`📋 [表格粘贴] 处理第 ${rowIndex + 1} 行，目标行索引: ${targetRowIndex}`);
                console.log(`📋 [表格粘贴] 行数据:`, rowData);

                if (targetRowIndex >= 0 && targetRowIndex < this.tableData.length && targetRowIndex < maxRows) {
                    const targetRow = this.tableData[targetRowIndex];
                    const rowUpdate = { rowIndex: targetRowIndex, updates: {} };

                    // 填充每一列的数据
                    rowData.forEach((cellValue, colIndex) => {
                        const targetColIndex = startColIndex + colIndex;
                        if (targetColIndex >= 0 && targetColIndex < columns.length) {
                            const fieldName = columns[targetColIndex];
                            console.log(`📋 [表格粘贴] 填充单元格 [${targetRowIndex}][${fieldName}] = "${cellValue}"`);
                            rowUpdate.updates[fieldName] = cellValue || '';
                        }
                    });

                    if (Object.keys(rowUpdate.updates).length > 0) {
                        updates.push(rowUpdate);
                    }

                    console.log(`📋 [表格粘贴] 第 ${targetRowIndex + 1} 行填充完成:`, targetRow);
                } else {
                    console.warn(`⚠️ [表格粘贴] 目标行索引 ${targetRowIndex} 超出范围（表格最大行数: ${maxRows}）`);
                }
            });

            // 通知父组件更新表格数据
            if (updates.length > 0) {
                this.$emit('table-data-update', updates);
            }

            // 粘贴完成后，自动更新光标位置到粘贴区域的下一行，方便用户继续粘贴
            // 计算粘贴的最后一个单元格位置
            const lastPastedRowIndex = Math.min(startRowIndex + validRows - 1, maxRows - 1);
            const nextRowIndex = lastPastedRowIndex + 1;
            
            // 如果下一行还在表格范围内，自动移动到下一行
            if (nextRowIndex < maxRows && nextRowIndex < this.tableData.length) {
                this.currentPasteRowIndex = nextRowIndex;
                // 列位置保持不变，从第一列开始（商品名称列）
                this.currentPasteColIndex = 0;
                console.log(`✅ [表格粘贴] 已自动移动到下一行，下次粘贴将从第 ${nextRowIndex + 1} 行开始`);
                
                // 自动滚动到下一行的位置，让用户知道可以继续粘贴
                this.$nextTick(() => {
                    try {
                        if (table && typeof table.scrollToRow === 'function') {
                            table.scrollToRow({ row: this.tableData[nextRowIndex], align: 'top' });
                            console.log(`✅ [表格粘贴] 已滚动到第 ${nextRowIndex + 1} 行`);
                        }
                    } catch (error) {
                        console.warn('⚠️ [表格粘贴] 滚动到下一行失败:', error);
                    }
                });
            } else {
                // 如果已经到了表格末尾，提示用户
                console.log('⚠️ [表格粘贴] 已到达表格末尾，无法继续向下移动');
                if (nextRowIndex >= maxRows) {
                    await this.$refs.alertDialog.alert(`表格最多支持 ${maxRows} 行数据，已达到上限。`, 'warning');
                }
            }

            // 粘贴完成后，关闭当前单元格的编辑状态，让它失去焦点
            // 这样可以确保粘贴的内容立即显示，并且不容易被意外修改
            this.$nextTick(() => {
                try {
                    // 关闭所有正在编辑的单元格，让它们失去焦点
                    // 这样粘贴的内容会立即显示，并且不容易被意外修改
                    if (table && typeof table.clearEdit === 'function') {
                        table.clearEdit();
                        console.log('✅ [表格粘贴] 已关闭单元格编辑状态，内容将立即显示');
                    }
                } catch (error) {
                    console.warn('⚠️ [表格粘贴] 关闭编辑状态失败:', error);
                }
            });

            console.log('✅ [表格粘贴] 粘贴处理完成');
        },
        // 默认的 Excel 粘贴数据解析方法（如果父组件没有提供）
        defaultParseExcelPasteData(pasteData) {
            const rows = [];
            let currentRow = [];
            let currentCell = '';
            let inQuotes = false;
            let i = 0;

            while (i < pasteData.length) {
                const char = pasteData[i];
                const nextChar = pasteData[i + 1];

                if (char === '"') {
                    if (inQuotes && nextChar === '"') {
                        currentCell += '"';
                        i += 2;
                    } else {
                        inQuotes = !inQuotes;
                        i++;
                    }
                } else if (char === '\t' && !inQuotes) {
                    currentRow.push(currentCell.trim());
                    currentCell = '';
                    i++;
                } else if ((char === '\n' || char === '\r') && !inQuotes) {
                    if (char === '\r' && nextChar === '\n') {
                        i += 2;
                    } else {
                        i++;
                    }
                    // 每遇换行都产生一行（含 Excel 中的完全空行），否则中间空行会被吃掉、后面行对齐错位
                    currentRow.push(currentCell.trim());
                    rows.push(currentRow.slice());
                    currentRow = [];
                    currentCell = '';
                } else {
                    currentCell += char;
                    i++;
                }
            }

            if (currentCell.length > 0 || currentRow.length > 0) {
                currentRow.push(currentCell.trim());
                rows.push(currentRow.slice());
            }

            return rows;
        },
        beforeUnmount() {
            // 标记组件已卸载
            this.isUnmounted = true;
            // 组件卸载前清理：移除事件监听器（如果有的话）
            // vxe-table 会自动清理，这里主要是防止异步操作访问已销毁的组件
            this.excelPasteCsvData = '';
            this.excelPastePromptText = '';
            this.showExcelPastePromptModal = false;
        },
        handleTableKeydown(event) {
            // 可以在这里处理键盘事件
            if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
                console.log('⌨️ [键盘事件] 检测到 Ctrl+V 或 Cmd+V');
            }
        },
        handleCellClick({ row, column, rowIndex, columnIndex }) {
            this.failedRowIndex = -1;
            // 如果右侧已有订单，禁止编辑单元格
            if (this.excelPasteOrderItems && this.excelPasteOrderItems.length > 0) {
                console.warn('⚠️ [单元格点击] 右侧已有订单，禁止编辑，请先清空订单');
                return;
            }

            // 验证 rowIndex 是否正确：通过 row 对象在数组中的实际位置
            const actualRowIndex = this.tableData.findIndex(item => item === row);
            const finalRowIndex = actualRowIndex !== -1 ? actualRowIndex : rowIndex;

            // 保存当前选中的单元格位置
            this.currentPasteRowIndex = finalRowIndex;

            // 根据列字段名找到列索引
            const columns = ['goodsName', 'quantity', 'specification', 'specificationWeight', 'cartonQuantity', 'cartonName', 'remark'];
            if (column && column.field) {
                const colIndex = columns.findIndex(col => col === column.field);
                if (colIndex !== -1) {
                    this.currentPasteColIndex = colIndex;
                }
            }

            this.$emit('cell-click', { row, column, rowIndex: finalRowIndex, columnIndex: this.currentPasteColIndex });
        },
        handleEditClosed({ row, column, rowIndex, columnIndex }) {
            // 不更新粘贴位置，粘贴位置只由点击事件决定
            this.$emit('edit-closed', { row, column, rowIndex, columnIndex });
        },
        // 将表格数据转换为 CSV
        convertTableDataToCsv() {
            const columns = ['goodsName', 'quantity', 'specification', 'specificationWeight', 'cartonQuantity', 'cartonName', 'remark'];
            const headers = ['商品名称', '数量', '规格', '规格重量', '大包装数量', '大包装名称', '备注'];

            // 过滤出有数据的行（至少商品名称不为空）
            const dataRows = this.tableData.filter(row => row.goodsName && row.goodsName.trim() !== '');

            if (dataRows.length === 0) {
                return '';
            }

            // 构建 CSV
            const csvLines = [];

            // 添加表头
            csvLines.push(headers.join(','));

            // 添加数据行
            dataRows.forEach(row => {
                const values = columns.map(col => {
                    let value = row[col] || '';
                    // 如果值包含逗号、引号或换行符，需要用引号包裹，并转义引号
                    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                        value = '"' + value.replace(/"/g, '""') + '"';
                    }
                    return value;
                });
                csvLines.push(values.join(','));
            });

            return csvLines.join('\n');
        },
        // 按表格列直接转为订单（不调 DeepSeek）
        directConvertTableToOrders() {
            this.failedRowIndex = -1;
            if (!this.hasTableData) {
                this.showToast('请先粘贴或输入表格数据', 'warning');
                return;
            }
            const tableData = this.tableData || [];
            const chineseOnly = /^[\u4e00-\u9fff]+$/;

            for (let i = 0; i < tableData.length; i++) {
                const row = tableData[i];
                const name = row.goodsName != null ? String(row.goodsName).trim() : '';
                const qtyStr = row.quantity != null ? String(row.quantity).trim() : '';
                const specStr = row.specification != null ? String(row.specification).trim() : '';

                // 本行完全为空则跳过
                if (!name && !qtyStr && !specStr) continue;

                // 有内容则商品名称必填
                if (!name) {
                    this.failedRowIndex = i;
                    this.showToast(`第 ${i + 1} 行：商品名称不能为空`, 'error');
                    this.scrollToTableRow(i);
                    return;
                }

                // 校验数量与规格
                if (qtyStr === '') {
                    this.failedRowIndex = i;
                    this.showToast(`第 ${i + 1} 行：数量不能为空`, 'error');
                    this.scrollToTableRow(i);
                    return;
                }
                const qtyNum = Number(row.quantity);
                if (Number.isNaN(qtyNum) || qtyNum <= 0) {
                    this.failedRowIndex = i;
                    this.showToast(`第 ${i + 1} 行：数量必须是大于 0 的数字`, 'error');
                    this.scrollToTableRow(i);
                    return;
                }

                if (!specStr) {
                    this.failedRowIndex = i;
                    this.showToast(`第 ${i + 1} 行：规格不能为空`, 'error');
                    this.scrollToTableRow(i);
                    return;
                }
                if (!chineseOnly.test(specStr)) {
                    this.failedRowIndex = i;
                    this.showToast(`第 ${i + 1} 行：规格必须为汉字`, 'error');
                    this.scrollToTableRow(i);
                    return;
                }
                if (specStr.length > 2) {
                    this.failedRowIndex = i;
                    this.showToast(`第 ${i + 1} 行：规格不能超过 2 个汉字，当前为 ${specStr.length} 个`, 'error');
                    this.scrollToTableRow(i);
                    return;
                }
            }

            const rows = tableData.filter(row => row.goodsName && String(row.goodsName).trim() !== '');
            if (rows.length === 0) {
                this.showToast('表格中没有有效数据（商品名称不能为空）', 'warning');
                return;
            }
            const list = rows.map(row => ({
                name: row.goodsName || '',
                quantity: row.quantity ?? '',
                spec: row.specification || '',
                remark: row.remark || '',
                standardWeight: row.specificationWeight || '',
                itemUnit: row.itemUnit || '',
                itemsPerCarton: row.cartonQuantity ?? '',
                cartonUnit: row.cartonName || ''
            }));
            this.$emit('direct-table-to-orders', list);
        },

        /** 滚动表格到指定行并居中，用于校验失败后定位 */
        scrollToTableRow(rowIndex) {
            this.$nextTick(() => {
                try {
                    const table = this.$refs.excelPasteTableRef;
                    if (table && typeof table.scrollToRow === 'function' && this.tableData && this.tableData[rowIndex]) {
                        table.scrollToRow({ row: this.tableData[rowIndex], align: 'center' });
                    }
                } catch (e) {
                    console.warn('[ExcelPasteUpload] scrollToTableRow failed:', e);
                }
            });
        },
        // 显示 Prompt 弹窗（准备 CSV 数据，走 AI 解析）
        showExcelPastePromptDialog() {
            // 检查是否有数据
            if (!this.hasTableData) {
                this.showToast('表格中没有数据，请先粘贴数据', 'warning');
                return;
            }

            // 转换为 CSV
            const csvData = this.convertTableDataToCsv();
            if (!csvData) {
                this.showToast('无法生成 CSV 数据', 'error');
                return;
            }

            // 清空附加 Prompt（用户可选填）
            this.excelPastePromptText = '';

            this.excelPasteCsvData = csvData;
            this.showExcelPastePromptModal = true;
        },
            // AI 识别 Excel 粘贴表格数据（改为调用父组件方法）
        async aiRecogniseExcelPasteTable() {
            // 检查组件是否已卸载
            if (this.isUnmounted) {
                console.warn('⚠️ [AI识别] 组件已卸载，取消操作');
                return;
            }

            if (!this.excelPasteCsvData || !this.excelPasteCsvData.trim()) {
                this.showToast('CSV 数据为空', 'error');
                return;
            }

            console.log('========== [AI识别] 开始执行 ==========');
            console.log('📋 [AI识别] CSV 数据长度:', this.excelPasteCsvData?.length);
            console.log('📋 [AI识别] CSV 数据（前500字符）:', this.excelPasteCsvData?.substring(0, 500));
            console.log('📝 [AI识别] 用户附加 Prompt:', this.excelPastePromptText || '(无)');
            console.log('📝 [AI识别] 用户附加 Prompt 长度:', this.excelPastePromptText?.length || 0);

            // 通知父组件开始加载（这会触发 showDeepSeekLoading = true）
            this.$emit('ai-recognise');

            // 关闭弹窗
            this.showExcelPastePromptModal = false;

            // 通知父组件识别完成，传递 CSV 数据和用户 Prompt，让父组件统一处理
            this.$emit('ai-recognise-complete', this.excelPasteCsvData, this.excelPastePromptText || '');
        }
    }
}
</script>

<style scoped>
    .excel-paste-split {
        display: grid;
        flex: 1;
        min-height: 0;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
        overflow: hidden;
        align-items: stretch;
        transition: grid-template-columns 220ms ease;
    }

    .excel-paste-split.is-left-active {
        grid-template-columns: minmax(0, 1.12fr) minmax(0, .88fr);
    }

    .excel-paste-split.is-right-active {
        grid-template-columns: minmax(0, .88fr) minmax(0, 1.12fr);
    }

    .excel-paste-pane {
        display: flex;
        min-width: 0;
        min-height: 0;
        height: 100%;
        flex-direction: column;
        overflow: hidden;
    }

    /* 表格左右滚动按钮 */
    .excel-paste-table-wrap {
        position: relative;
    }
    .excel-paste-scroll-btn {
        width: 28px;
        min-width: 28px;
        padding: 0;
        font-size: 18px;
        font-weight: bold;
        line-height: 1;
        color: #495057;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 5;
    }
    .excel-paste-scroll-btn:hover:not(:disabled) {
        background: #e9ecef;
        color: #0d6efd;
    }
    .excel-paste-scroll-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    .excel-paste-scroll-btn-left {
        margin-right: 4px;
    }
    .excel-paste-scroll-btn-right {
        margin-left: 4px;
    }

    /* 横向滚动条样式：更醒目（Chrome/Safari/Edge + Firefox） */
    .excel-paste-table-wrap ::v-deep(.vxe-table--body-wrapper),
    .excel-paste-table-wrap ::v-deep(.vxe-table--content-wrapper),
    .excel-paste-table-wrap ::v-deep(.vxe-table--main-wrapper) {
        scrollbar-width: auto;
        scrollbar-color: #495057 #dee2e6;
    }
    .excel-paste-table-wrap ::v-deep(.vxe-table--body-wrapper)::-webkit-scrollbar,
    .excel-paste-table-wrap ::v-deep(.vxe-table--content-wrapper)::-webkit-scrollbar,
    .excel-paste-table-wrap ::v-deep(.vxe-table--main-wrapper)::-webkit-scrollbar {
        height: 16px;
    }
    .excel-paste-table-wrap ::v-deep(.vxe-table--body-wrapper)::-webkit-scrollbar-track,
    .excel-paste-table-wrap ::v-deep(.vxe-table--content-wrapper)::-webkit-scrollbar-track,
    .excel-paste-table-wrap ::v-deep(.vxe-table--main-wrapper)::-webkit-scrollbar-track {
        background: #dee2e6;
        border-radius: 8px;
    }
    .excel-paste-table-wrap ::v-deep(.vxe-table--body-wrapper)::-webkit-scrollbar-thumb,
    .excel-paste-table-wrap ::v-deep(.vxe-table--content-wrapper)::-webkit-scrollbar-thumb,
    .excel-paste-table-wrap ::v-deep(.vxe-table--main-wrapper)::-webkit-scrollbar-thumb {
        background: #495057;
        border-radius: 8px;
        border: 2px solid #dee2e6;
    }
    .excel-paste-table-wrap ::v-deep(.vxe-table--body-wrapper)::-webkit-scrollbar-thumb:hover,
    .excel-paste-table-wrap ::v-deep(.vxe-table--content-wrapper)::-webkit-scrollbar-thumb:hover,
    .excel-paste-table-wrap ::v-deep(.vxe-table--main-wrapper)::-webkit-scrollbar-thumb:hover {
        background: #212529;
    }

    /* 表格禁用状态样式 - 允许滚动但禁止编辑 */
    .table-disabled {
        position: relative;
        opacity: 0.8;
    }
    
    /* 禁用单元格点击编辑，但允许滚动 */
    .table-disabled ::v-deep(.vxe-body--column),
    .table-disabled ::v-deep(.vxe-body--column .vxe-cell) {
        pointer-events: none;
        cursor: not-allowed;
        user-select: none;
    }
    
    /* 确保滚动条可以正常工作 */
    .table-disabled ::v-deep(.vxe-table--body-wrapper) {
        pointer-events: auto;
        overflow-y: auto !important;
    }
    
    /* 表格整体视觉提示 - 禁止选择文本 */
    .table-disabled ::v-deep(.vxe-table) {
        user-select: none;
    }
    
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

    /* 表格最后一列：+ / - 操作按钮，固定在右侧 */
    .excel-paste-row-actions {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
    }

    .excel-paste-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        font-size: 16px;
        line-height: 1;
        font-weight: 400;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        background: #fff;
        color: #495057;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
    }

    .excel-paste-btn:hover {
        border-color: #0a58ca;
        background: #f0f7ff;
        color: #0a58ca;
    }

    .excel-paste-btn-del:hover {
        border-color: #c82333;
        background: #fff5f5;
        color: #c82333;
    }

    /* 行插入/删除动画（vxe-table 行类名会加在 tr 上），边框淡蓝色 */
    ::v-deep(.excel-paste-row-inserting) {
        box-shadow: inset 0 0 0 2px rgba(13, 110, 253, 0.35);
        animation: excel-paste-row-insert 0.3s ease-out;
    }

    ::v-deep(.excel-paste-row-deleting) {
        overflow: hidden;
        box-shadow: inset 0 0 0 2px rgba(13, 110, 253, 0.25);
        animation: excel-paste-row-delete 0.28s ease-out forwards;
    }

    /* 校验失败行高亮（转订单时不符合规则的那一行） */
    ::v-deep(.excel-paste-row-validation-failed) {
        background-color: #fff5f5 !important;
        box-shadow: inset 0 0 0 2px rgba(220, 53, 69, 0.4);
    }

    @keyframes excel-paste-row-insert {
        from {
            opacity: 0;
            transform: translateY(-8px);
            box-shadow: inset 0 0 0 2px rgba(13, 110, 253, 0.5);
        }
        to {
            opacity: 1;
            transform: translateY(0);
            box-shadow: inset 0 0 0 2px rgba(13, 110, 253, 0.2);
        }
    }

    @keyframes excel-paste-row-delete {
        from {
            opacity: 1;
            max-height: 56px;
            box-shadow: inset 0 0 0 2px rgba(13, 110, 253, 0.35);
        }
        to {
            opacity: 0;
            max-height: 0;
            padding-top: 0;
            padding-bottom: 0;
            border-top-width: 0;
            border-bottom-width: 0;
            box-shadow: inset 0 0 0 2px rgba(13, 110, 253, 0.1);
        }
    }
</style>
