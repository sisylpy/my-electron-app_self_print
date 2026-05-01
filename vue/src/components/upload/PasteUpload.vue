<template>
    <div class="upload-section" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
        <div class="row g-3" style="flex: 1; min-height: 0; overflow: hidden; margin: 0; align-items: stretch;">
            <!-- 左侧：粘贴输入框 -->
            <div class="col-md-4">
                <div class="card h-100">
                    <!-- 任务：添加新内容 + 部门任务列表 同一行 -->
                    <div v-if="depId  && source === 'placeOrder' && taskList.length > 0"
                         class="card-header py-2 px-2 d-flex align-items-center flex-wrap gap-1"
                         style="flex-shrink: 0;">
                        <button
                                type="button"
                                class="btn btn-sm flex-shrink-0"
                                :class="!pasteHasCache ? 'btn-primary' : 'btn-outline-primary'"
                                @click="onAddNewContentClick">
                            +
                        </button>
                        <template v-if="taskList.length > 0">
                            <div class="task-tabs-wrap d-flex flex-wrap gap-1 align-items-center">
                                <template v-for="(task, idx) in taskList"
                                          :key="task.nxOcrTaskId != null ? task.nxOcrTaskId : task.id || idx">
                                    <button
                                            type="button"
                                            class="btn btn-sm task-tab"
                                            :class="{ 'btn-primary': isTaskActive(task), 'btn-outline-secondary': !isTaskActive(task) }"
                                            :disabled="selectTaskLoading"
                                            @click="onSelectTask(task)">
                                        {{ task.nxOcrTaskFileName}}
                                    </button>
                                </template>
                            </div>
                        </template>
                        <div v-else-if="loadingTaskList" class="small text-muted">加载任务列表...</div>
                    </div>
                    <div class="card-body p-1"
                         style="display: flex; flex-direction: column; min-height: 0; flex: 1; position: relative;">
                        <!-- 解析中 / 加载任务中 蒙版（placeOrder 全屏蒙版；taskOrder 仅粘贴区用下方占位） -->
                        <div v-if="showDeepSeekLoading || (selectTaskLoading && source !== 'taskOrder')"
                             class="parsing-overlay">
                            <div class="parsing-content">
                                <div class="spinner-border text-primary" role="status"
                                     style="width: 3rem; height: 3rem;">
                                    <span class="visually-hidden">加载中...</span>
                                </div>
                                <div class="mt-3" style="color: #fff; font-size: 16px; font-weight: 500;">
                                    {{ selectTaskLoading ? '加载任务中...' : 'AI识别中...' }}
                                </div>
                            </div>
                        </div>
                        <!-- TaskOrder：加载任务内容时显示占位动画，不显示空白 textarea；接口返回后再淡入输入框 -->
                        <div v-if="source === 'taskOrder' && selectTaskLoading" class="paste-task-loading-placeholder"
                             style="display: flex; flex-direction: column; flex: 1; min-height: 0; align-items: center; justify-content: center; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 0.375rem; animation: paste-placeholder-pulse 1.5s ease-in-out infinite;">
                            <div class="spinner-border text-primary" role="status"
                                 style="width: 2.5rem; height: 2.5rem;"></div>
                            <div class="mt-2 small text-muted">加载任务内容...</div>
                        </div>
                        <!-- 粘贴输入框：外部更新（切换任务/添加新内容）时有一帧高亮动画；taskOrder 下等加载完再显示并淡入 -->
                        <transition name="paste-textarea-fade">
                            <div v-show="!(source === 'taskOrder' && selectTaskLoading)"
                                 style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                                <div class="paste-textarea-wrap" style="position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column;">
                                    <textarea
                                            ref="pasteTextareaRef"
                                            :value="pasteInputText"
                                            @input="onPasteInput"
                                            @scroll="syncInvalidOverlayScroll"
                                            :disabled="pasteHasCache || showDeepSeekLoading || selectTaskLoading"
                                            class="form-control mb-2 paste-textarea"
                                            :class="{
                                                'bg-light': pasteHasCache,
                                                'paste-textarea--just-updated': contentJustUpdated,
                                                'paste-textarea--has-invalid': (pasteInvalidSegments.length > 0 || pasteInvalidLineIndices.length > 0) && pasteInputText
                                            }"
                                            style="font-size: 18px; min-height: 0; flex: 1;"
                                    ></textarea>
                                    <!-- 校验不合格错误提示（显示在 textarea 下方） -->
                                    <div v-if="pasteNoValidOrder && pasteInputText"
                                         class="paste-invalid-alert mt-2">
                                        <div class="alert alert-warning mb-0" style="padding: 8px 12px; font-size: 14px;">
                                            <strong>⚠️ 未解析到有效订单，请检查格式（如：苹果 5 斤）</strong>
                                        </div>
                                    </div>
                                    <div v-if="(pasteInvalidSegments.length > 0 || pasteInvalidLineIndices.length > 0) && pasteInputText && !pasteNoValidOrder"
                                         class="paste-invalid-alert mt-2">
                                        <div class="alert alert-danger mb-0" style="padding: 8px 12px; font-size: 14px;">
                                            <strong>⚠️ 发现校验不合格内容：</strong>
                                            <div v-html="pasteInvalidOverlayHtml" style="white-space: pre-wrap; word-wrap: break-word; margin-top: 4px;"></div>
                                        </div>
                                    </div>
                                </div>
                                <!-- 保存订单后隐藏这三个按钮 -->
                                <div
                                        class="d-flex gap-2 mt-2 flex-wrap" style="margin-bottom:40px;">

                                    <div v-if="!pasteHasCache && pasteSaveCount == null && pasteOrderItems.length === 0"
                                        class="d-flex gap-2 w-100">
                                        <button class="btn btn-sm btn-primary flex-grow-1" @click="$emit('paste-from-clipboard')"
                                                :disabled="showDeepSeekLoading">从剪贴板粘贴
                                        </button>
                                        <button class="btn btn-sm btn-info flex-grow-1" @click="$emit('ai-recognise')"
                                                :disabled="!pasteInputText || pasteInputText.trim() === '' || showDeepSeekLoading">
                                            {{ showDeepSeekLoading ? 'AI识别中...' : 'Ai协助解析订单' }}
                                        </button>
                                        <button class="btn btn-success btn-sm flex-grow-1" @click="$emit('local-parse')"
                                                :disabled="!pasteInputText || pasteInputText.trim() === '' || showDeepSeekLoading"
                                                title="本地解析，不调用 AI">
                                            解析订单
                                        </button>
                                    </div>


                                </div>
                            </div>
                        </transition>
                    </div>
                </div>
            </div>

            <!-- 右侧：订单列表（复制粘贴独立） -->
            <div class="col-md-8 order-items-section"
                 style="display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;">
                <div class="card h-100 p-3"
                     style="display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                    <div class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                        <div>
                            <h6 class="mb-0">解析订单({{ pasteOrderItems.length }} 项)</h6>
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
                            <template v-if="pasteSaveCount == null && source === 'placeOrder'">
                                <button v-if="pasteOrderItems.length > 0  " class="btn btn-secondary btn-sm"
                                        @click="$emit('again-paste')">
                                    清空内容
                                </button>
                                <button v-if="pasteOrderItems.length > 0  " class="btn btn-success btn-sm"
                                        @click="$emit('save-paste-orders')" :disabled="savingOrder">
                                    {{ savingOrder ? '保存中...' : '保存订单' }}
                                </button>
                            </template>
                            <template v-else>
                                <button
                                        class="btn btn-danger btn-sm"
                                        @click="$emit('re-upload')">
                                    删除
                                </button>
                                <!-- <button
                                        class="btn btn-outline-info btn-sm"
                                        @click="$emit('show-fix-items')">
                                    Ai协助调整
                                </button> -->
                                <!-- <button
                                        v-if="currentTask && currentTask.nxOcrTaskStatus == 2"
                                        class="btn btn-success btn-sm"
                                        @click="$emit('finish-task')">
                                    完成
                                </button> -->

                                <div ref="ttsPlayerContainer">

                                    <div class="d-flex align-items-center gap-3">
                                        <div class="d-flex align-items-center gap-2" style="flex-shrink: 0;">
                                            <!-- 播放：由父组件调用 OrderList 的 readOrderList -->
                                            <button
                                                    v-if="!ttsPlaying && !ttsLoading && ttsStoppedIndex < 0"
                                                    @click="$emit('read-order-list')"
                                                    class="btn btn-sm btn-success"
                                                    :disabled="pasteOrderItems.length === 0"
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
                                    </div>

                                </div>
                            </template>
                        </div>
                    </div>

                    <!-- 订单列表内容（复制粘贴独立显示）：包一层保证在 card 的 flex 布局里占满剩余高度并可滚动 -->
                    <div class="order-list-slot-wrap flex-grow-1"
                         style="min-height: 0; overflow: hidden; display: flex; flex-direction: column;">
                        <slot name="order-list"></slot>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    import api from '../../api/all';

    export default {
        name: 'PasteUpload',
        props: {
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
            currentTask: {
                type: Object,
                default: null
            },
            currentTaskId: {
                type: [Number, String],
                default: null
            },

            pasteInputText: {
                type: String,
                default: ''
            },
            pasteInvalidLineIndices: {
                type: Array,
                default: () => []
            },
            pasteInvalidSegments: {
                type: Array,
                default: () => [] // { lineIndex, segmentText }
            },
            pasteNoValidOrder: {
                type: Boolean,
                default: false
            },
            pasteHasCache: {
                type: Boolean,
                default: false
            },
            pasteSaveCount: {
                type: [Number, null],
                default: null
            },
            pasteOrderItems: {
                type: Array,
                default: () => []
            },
            showDeepSeekLoading: {
                type: Boolean,
                default: false
            },
            /** 切换任务时请求任务内容中（显示蒙版） */
            selectTaskLoading: {
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
            hasCache: {
                type: Boolean,
                default: false
            },

            // 当前朗读的订单内容和序号
            currentReadingText: {
                type: String,
                default: ''
            },
            currentReadingIndex: {
                type: Number,
                default: -1
            },

            /** TTS 状态（由父组件从 OrderList 同步）：用于播放/暂停/重读/继续按钮显示 */
            ttsPlaying: {type: Boolean, default: false},
            ttsLoading: {type: Boolean, default: false},
            ttsStoppedIndex: {type: Number, default: -1},

        },
        data() {
            return {
                taskList: [],
                activeTaskId: null,
                loadingTaskList: false,
                /** 用于区分“用户在本框输入”与“外部更新内容”，避免输入时也触发高亮 */
                lastInputEmitAt: 0,
                /** 为 true 时文本框显示“内容已更新”高亮动画 */
                contentJustUpdated: false,
                contentUpdatedTimer: null
            };
        },
        computed: {
            /** 校验不合格片段高亮 HTML（只显示不合格的行） */
            pasteInvalidOverlayHtml() {
                const text = this.pasteInputText || '';
                const lines = text.split('\n');
                const segments = this.pasteInvalidSegments || [];
                const hasSegments = segments.length > 0;
                const invalidLineSet = new Set(this.pasteInvalidLineIndices || []);

                const escapeHtml = (s) => String(s)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');

                // 只保留不合格的行
                return lines
                    .map((line, lineIdx) => {
                        const lineSegments = hasSegments ? segments.filter(s => s.lineIndex === lineIdx).map(s => s.segmentText) : [];
                        if (lineSegments.length > 0) {
                            let remaining = line;
                            const sortedSegments = lineSegments
                                .map(st => ({ text: st, pos: remaining.indexOf(st) }))
                                .filter(s => s.pos >= 0)
                                .sort((a, b) => a.pos - b.pos);
                            if (sortedSegments.length > 0) {
                                let result = '';
                                let lastEnd = 0;
                                for (const { text: seg, pos } of sortedSegments) {
                                    if (pos < lastEnd) continue;
                                    result += escapeHtml(remaining.substring(lastEnd, pos));
                                    result += `<span class="paste-invalid-line">${escapeHtml(seg)}</span>`;
                                    lastEnd = pos + seg.length;
                                }
                                result += escapeHtml(remaining.substring(lastEnd));
                                return result;
                            }
                            return `<span class="paste-invalid-line">${escapeHtml(line)}</span>`;
                        }
                        const escaped = escapeHtml(line);
                        return invalidLineSet.has(lineIdx) ? `<span class="paste-invalid-line">${escaped}</span>` : null;
                    })
                    .filter(line => line !== null)  // 过滤掉 null（即合格的行）
                    .join('\n');
            }
        },
        watch: {
            pasteInputText(newVal, oldVal) {
                if (oldVal === undefined || newVal === oldVal) return;
                // 若在很短时间内刚触发过 input，视为用户在本框输入导致的双向同步，不播动画
                if (Date.now() - this.lastInputEmitAt < 220) return;
                this.triggerContentUpdatedFlash();
            },
            depId: {
                handler(val) {
                    if (val != null) this.loadTaskList();
                    else this.taskList = [];
                },
                immediate: true
            },
            currentTaskId(val) {
                this.activeTaskId = val != null ? val : null;
            },
            pasteInvalidLineIndices(val) {
                if (val && val.length > 0) {
                    this.$nextTick(() => this.syncInvalidOverlayScroll());
                }
            },
            pasteInvalidSegments(val) {
                if (val && val.length > 0) {
                    this.$nextTick(() => this.syncInvalidOverlayScroll());
                }
            }
        },
        emits: [
            'select-task',
            'add-new-content',
            'close-new-content',
            'paste-input',
            'paste-from-clipboard',
            'ai-recognise',
            'local-parse',
            'again-paste',
            'save-paste-orders',
            'clear-paste-save',
            're-upload',
            'show-fix-items',
            'stop-reading',
            'edit-order',
            'continue-reading',
            'finish-task'
        ],
        methods: {
            /**
             * @param {number|null} [selectTaskId] - 刷新后要选中的任务 ID，不传则选中第一个并 emit select-task
             */
            async loadTaskList(selectTaskId) {
                this.loadingTaskList = true;
                console.log("loadTaskListloadTaskList")
                try {
                    const taskType = this.taskType != null ? Number(this.taskType) : 3;
                    const res = await api.depGetTaskList(this.depId, taskType);
                    const data = res && res.data;
                    if (data && data.code === 0) {
                        let list = data.data != null ? data.data : (data.list || data);
                        if (!Array.isArray(list)) list = [];
                        this.taskList = list.slice().sort((a, b) => {
                            console.log("loadTaskListloadTaskListlocaleComparelocaleCompare")
                            const tA = (a.nxOcrTaskCreateDate || a.createDate || '').toString();
                            const tB = (b.nxOcrTaskCreateDate || b.createDate || '').toString();
                            return tB.localeCompare(tA);
                        });
                        if (this.taskList.length > 0) {
                            if (selectTaskId != null) {
                                console.log("selectTaskIdselectTaskIdselectTaskId")
                                this.activeTaskId = selectTaskId;
                                const found = this.taskList.find(t => {
                                    const id = t.nxOcrTaskId != null ? t.nxOcrTaskId : t.id;
                                    return id != null && Number(id) === Number(selectTaskId);
                                });
                                if (found) this.$emit('select-task', {taskId: selectTaskId, task: found});
                            } else {
                                const first = this.taskList[0];
                                this.activeTaskId = first.nxOcrTaskId != null ? first.nxOcrTaskId : first.id;
                                this.$emit('select-task', {taskId: this.activeTaskId, task: first});
                            }
                        }
                    } else {
                        this.taskList = [];
                    }
                } catch (e) {
                    console.error('[PasteUpload] loadTaskList failed:', e);
                    this.taskList = [];
                } finally {
                    this.loadingTaskList = false;
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
            /** 将接口返回的 task 追加/更新到任务列表并选中，避免重复请求 loadTaskList */
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
            /** “+” 点击：若已在添加新内容状态则关闭（仅页面切换），否则进入添加新内容 */
            onAddNewContentClick() {
                if (this.currentTaskId == null && this.currentTask == null) {
                    this.$emit('close-new-content');
                } else {
                    this.$emit('add-new-content');
                }
            },
            onPasteInput(ev) {
                this.lastInputEmitAt = Date.now();
                this.$emit('paste-input', ev);
            },
            syncInvalidOverlayScroll() {
                // 遮罩层已移除，此方法保留但不执行任何操作
                const ta = this.$refs.pasteTextareaRef;
                const overlay = this.$refs.pasteInvalidOverlayRef;
                if (ta && overlay && overlay.scrollTop !== ta.scrollTop) {
                    overlay.scrollTop = ta.scrollTop;
                    overlay.scrollLeft = ta.scrollLeft;
                }
            },
            /** 播放一次“内容已更新”高亮，用于切换任务/添加新内容后提示用户 */
            triggerContentUpdatedFlash() {
                if (this.contentUpdatedTimer) clearTimeout(this.contentUpdatedTimer);
                this.contentJustUpdated = true;
                this.contentUpdatedTimer = setTimeout(() => {
                    this.contentJustUpdated = false;
                    this.contentUpdatedTimer = null;
                }, 700);
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

    .task-tabs-wrap {
        max-height: 60px;
        overflow-y: auto;
    }

    .task-tab {
        white-space: nowrap;
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* 粘贴框“内容已更新”提示：柔和背景高亮 + 边框淡出，不干扰阅读 */
    .paste-textarea {
        transition: background-color 0.35s ease-out, box-shadow 0.35s ease-out;
    }

    /* 显示 overlay 时隐藏 textarea 文字，避免重影；仅保留光标可见 */
    .paste-textarea--overlay-visible {
        color: transparent !important;
        caret-color: #212529;
        text-shadow: none;
    }

    /* 校验不合格行红色高亮遮罩：覆盖在 textarea 上方，与 textarea 样式一致 */
    .paste-textarea-wrap {
        position: relative;
    }

    .paste-textarea--has-invalid {
        border-color: #dc3545;
        border-width: 2px;
    }

    .paste-invalid-alert {
        max-height: 150px;
        overflow-y: auto;
        flex-shrink: 0;
    }

    /* v-html 动态插入的内容需用 :deep 才能命中 scoped 样式 */
    .paste-invalid-alert :deep(.paste-invalid-line) {
        color: #dc3545 !important;
        font-weight: 500;
    }

    .paste-textarea--just-updated {
        animation: pasteContentUpdated 0.7s ease-out forwards;
    }

    @keyframes pasteContentUpdated {
        0% {
            background-color: rgba(23, 162, 184, 0.22);
            box-shadow: 0 0 0 2px rgba(23, 162, 184, 0.35);
        }
        100% {
            background-color: transparent;
            box-shadow: none;
        }
    }

    .paste-textarea.bg-light.paste-textarea--just-updated {
        animation: pasteContentUpdatedWithBg 0.7s ease-out forwards;
    }

    @keyframes pasteContentUpdatedWithBg {
        0% {
            background-color: rgba(23, 162, 184, 0.28);
            box-shadow: 0 0 0 2px rgba(23, 162, 184, 0.4);
        }
        100% {
            background-color: var(--bs-light, #f8f9fa);
            box-shadow: none;
        }
    }

    /* TaskOrder：加载任务内容占位动画 */
    @keyframes paste-placeholder-pulse {
        0%, 100% {
            opacity: 0.85;
        }
        50% {
            opacity: 1;
        }
    }

    /* 任务内容加载完成后输入框淡入 */
    .paste-textarea-fade-enter-active,
    .paste-textarea-fade-leave-active {
        transition: opacity 0.25s ease;
    }

    .paste-textarea-fade-enter-from,
    .paste-textarea-fade-leave-to {
        opacity: 0;
    }
</style>


