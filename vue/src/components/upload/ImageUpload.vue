<template>
    <div class="upload-section" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
        <div class="row g-3" style="flex: 1; min-height: 0; overflow: hidden; margin: 0; align-items: stretch;">
            <!-- 左侧：图片上传和预览 -->
            <div class="col-md-5">
                <div class="card h-100">
                    <!-- 任务：添加新内容 + 部门任务列表（仅 placeOrder 显示；TaskOrder 中不显示此块） -->
                    <div v-if="source === 'placeOrder' && depId && taskList.length > 0"
                         class="card-header py-2 px-2 d-flex align-items-center flex-wrap gap-1 image-task-header"
                         :class="{ 'image-task-header--flash': headerFlash }"
                         style="flex-shrink: 0;">
                        <button
                                type="button"
                                class="btn btn-sm flex-shrink-0"
                                :class="hasCache ? 'btn-outline-primary' : 'btn-primary'"
                                :title="hasCache ? '添加新图片' : '关闭添加图片'"
                                @click="onAddNewImageClick">
                            {{ hasCache? '+' : '×' }}
                        </button>
                        <template v-if="source === 'placeOrder' && taskList.length > 0">
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
                         style="display: flex; flex-direction: column; min-height: 0; position: relative;">
                        <!-- 点击「添加新图片」后由父组件清空状态，此处显示上传区 -->
                        <div v-if="!hasCache && source === 'placeOrder' " style="flex-shrink: 0;">
                            <div class="drop-zone border rounded p-3 mb-2 text-center"
                                 :class="{ 'drag-over': isDragOver }"
                                 @dragover.prevent="handleDragOver"
                                 @dragenter.prevent="handleDragEnter"
                                 @dragleave.prevent="handleDragLeave"
                                 @drop.prevent="handleDrop"
                                 @paste.prevent="handlePaste"
                                 @click="$refs.imageFileInput && $refs.imageFileInput.click()"
                                 tabindex="0"
                                 style="cursor: pointer; transition: all 0.3s; background-color: #f8f9fa;">
                                <input
                                        type="file"
                                        ref="imageFileInput"
                                        accept="image/*"
                                        @change="$emit('image-upload', $event)"
                                        @click.stop
                                        class="form-control mb-2"
                                />
                                <small class="text-muted d-block">支持JPG、PNG等图片格式，系统将自动识别图片中的订单信息</small>
                                <small class="text-primary d-block mt-1">💡 可从微信拖放图片，或复制图片后 Ctrl+V 粘贴</small>
                            </div>
                        </div>


                        <!-- 识别中蒙版（不依赖 imagePreview，只要有任务就显示）；支持拖放穿透，方便从微信等拖入图片 -->
                        <div v-if="hasRunningTask && !hasCache && !uploadedImageFile" class="recognizing-overlay"
                             @dragover.prevent="handleDragOver"
                             @dragenter.prevent="handleDragEnter"
                             @dragleave.prevent="handleDragLeave"
                             @drop.prevent="handleDrop"
                             style="position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 10;">
                            <div class="recognizing-content">
                                <div class="spinner-border text-primary mb-3" role="status">
                                    <span class="visually-hidden">识别中...</span>
                                </div>
                                <div class="text-white fw-bold">该客户正在识别中，请稍候...</div>
                            </div>
                        </div>
                        <!-- 解析中 / 加载任务中 / 后台异步处理中 蒙版；支持拖放穿透，方便从微信等拖入图片 -->
                        <div v-if="showDeepSeekLoading || (selectTaskLoading && source !== 'taskOrder') || (currentTask && currentTask.nxOcrTaskStatus === 0)"
                             class="parsing-overlay"
                             @dragover.prevent="handleDragOver"
                             @dragenter.prevent="handleDragEnter"
                             @dragleave.prevent="handleDragLeave"
                             @drop.prevent="handleDrop">
                            <div class="parsing-content">
                                <div class="spinner-border text-primary" role="status"
                                     style="width: 3rem; height: 3rem;">
                                    <span class="visually-hidden">加载中...</span>
                                </div>
                                <div class="mt-3" style="color: #fff; font-size: 16px; font-weight: 500;">
                                    {{ (currentTask && currentTask.nxOcrTaskStatus === 0) ? '后台处理中，请稍候...' : (selectTaskLoading ? '加载任务中...' : 'AI识别中...') }}
                                </div>
                            </div>
                        </div>
                        <!-- TaskOrder：加载任务内容时显示与 PasteUpload 一致的占位动画，接口返回后淡入图片 -->
                        <div v-if="source === 'taskOrder' && selectTaskLoading" class="image-task-loading-placeholder"
                             style="display: flex; flex-direction: column; flex: 1; min-height: 0; align-items: center; justify-content: center; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 0.375rem; animation: image-placeholder-pulse 1.5s ease-in-out infinite;">
                            <div class="spinner-border text-primary" role="status"
                                 style="width: 2.5rem; height: 2.5rem;"></div>
                            <div class="mt-2 small text-muted">加载任务内容...</div>
                        </div>
                        <!-- 图片/上传区：taskOrder 下等加载完再显示（无加载中占位时显示） -->
                        <div v-if="!(source === 'taskOrder' && selectTaskLoading)"
                             style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                            <div v-if="uploadedImageFile" class="flex-grow-1"
                                 style="display: flex; flex-direction: column; min-height: 0;">
                                <!-- 图片预览 -->
                                <div v-if="imagePreview" class="border rounded p-0 position-relative flex-grow-1"
                                         style="min-height: 0; overflow: hidden; cursor: move; background-color: #f5f5f5; display: flex; align-items: start; justify-content: start; position: relative !important;"
                             @mousedown="handleStartDrag"
                             @mousemove="handleOnDrag"
                             @mouseup="handleEndDrag"
                             @mouseleave="handleEndDrag"
                             @wheel.prevent="handleWheel"
                             @dragover.prevent="handleDragOver"
                             @dragenter.prevent="handleDragEnter"
                             @dragleave.prevent="handleDragLeave"
                             @drop.prevent="handleDrop">

                            <!-- 识别中蒙版（在图片预览区域内） -->
                            <div v-if="hasRunningTask && !hasCache" class="recognizing-overlay"
                                 style="position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;">
                                <div class="recognizing-content">
                                    <div class="spinner-border text-primary mb-3" role="status">
                                        <span class="visually-hidden">识别中...</span>
                                    </div>
                                    <div class="text-white fw-bold">该客户正在识别中，请稍候...</div>
                                </div>
                            </div>
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
                                 style="width: 100%; height: 100%; transform-origin: top left; position: relative;">
                                <img :src="imagePreview" alt="预览" class="img-fluid"
                                     ref="previewImage"
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
                                     @dblclick="handleImageClick"
                                     @dragstart.prevent>

                                <!-- 点击弹窗 -->
                                <div v-if="showClickPopup && stoppedReadingText"
                                     class="click-popup"
                                     :style="{
                                             left: popupX + 'px',
                                             top: popupY + 'px',
                                             position: 'absolute',
                                             zIndex: 2000
                                         }">
                                    <div class="popup-content">
                                        <div class="d-flex justify-content-between align-items-start mb-2">
                                            <span>{{ stoppedReadingText }}</span>
                                            <button
                                                    @click="closePopup"
                                                    class="btn-close btn-close-sm ms-2"
                                                    style="flex-shrink: 0;"
                                                    title="关闭">
                                            </button>
                                        </div>
                                        <div class="d-flex gap-2 mt-2">
                                            <button
                                                    @click="showPreviousOrder"
                                                    class="btn btn-sm btn-outline-primary"
                                                    :disabled="stoppedIndex <= 0">
                                                上一个订单
                                            </button>
                                            <button
                                                    @click="editCurrentOrder"
                                                    class="btn btn-sm btn-primary">
                                                修改
                                            </button>
                                            <button
                                                    @click="continueReading"
                                                    class="btn btn-sm btn-su"
                                                    :disabled="stoppedIndex < 0">
                                                继续
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
            <!-- 右侧：订单列表（图片模式） -->
            <div class="col-md-7 order-items-section"
                 style="display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;">
                    <div class="card h-100 p-3"
                         style="display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                        <div class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                            <div>
                                <h6 class="mb-0">转换订单 ({{ orderItems.length }} 项)</h6>
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
                            <div class="d-flex gap-2" v-if="currentTask && currentTask.nxOcrTaskTotalOrders != null">

                                <button
                                        class="btn btn-danger btn-sm"
                                        @click="$emit('re-upload')">
                                    删除
                                </button>
                                <button
                                        class="btn btn-outline-info btn-sm"
                                        @click="$emit('show-fix-items')">
                                    Ai协助调整
                                </button>
                                <button
                                        v-if="currentTask && currentTask.nxOcrTaskPendingOrders == 0"
                                        class="btn btn-success btn-sm"
                                        @click="$emit('finish-task')">
                                    完成
                                </button>

                                <div ref="ttsPlayerContainer">

                                    <div class="d-flex align-items-center gap-3">
                                        <div class="d-flex align-items-center gap-2" style="flex-shrink: 0;">
                                            <!-- 播放：由父组件调用 OrderList 的 readOrderList -->
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
                            </div>

                        </div>

                        <!-- 订单列表内容（图片模式）：包一层保证在 card 的 flex 布局里占满剩余高度 -->
                        <div class="order-list-slot-wrap flex-grow-1" style="min-height: 0; overflow: hidden; display: flex; flex-direction: column;">
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
</template>

<script>
    import api from '../../api/all';
    import Toast from '../Toast.vue';

    export default {
        name: 'ImageUpload',
        components: {
            Toast
        },
        props: {
            /** 区分来源：'placeOrder' 下单页 | 'taskOrder' 任务页，用于按来源显示不同 UI（如任务栏仅在 placeOrder 显示） */
            source: {
                type: String,
                default: 'placeOrder',
                validator: (v) => !v || v === 'placeOrder' || v === 'taskOrder'
            },
            depId: {
                type: [Number, String],
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
            hasCache: {
                type: Boolean,
                default: false
            },
            /** 切换任务时请求任务内容中（显示蒙版） */
            selectTaskLoading: {
                type: Boolean,
                default: false
            },
            /** DeepSeek AI 识别中（显示蒙版） */
            showDeepSeekLoading: {
                type: Boolean,
                default: false
            },
            hasRunningTask: {
                type: Boolean,
                default: false
            },
            uploadedImageFile: {
                type: Object,
                default: null
            },
            imagePreview: {
                type: String,
                default: null
            },
            imageScale: {
                type: Number,
                default: 1
            },
            imageTranslateX: {
                type: Number,
                default: 0
            },
            imageTranslateY: {
                type: Number,
                default: 0
            },
            isDragging: {
                type: Boolean,
                default: false
            },
            orderItems: {
                type: Array,
                default: () => []
            },
            allOrdersAreDraft: {
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
            hideTaskList: {
                type: Boolean,
                default: false
            }
        },
        emits: [
            'image-upload',
            'reset-transform',
            'zoom-in',
            'zoom-out',
            'image-load',
            're-upload',
            'show-fix-items',
            'start-drag',
            'on-drag',
            'end-drag',
            'wheel',
            'stop-reading',
            'edit-order',
            'continue-reading',
            'select-task',
            'add-new-image',
            'close-new-image',
            'finish-task'
        ],
        data() {
            return {
                showClickPopup: false,
                popupX: 0,
                popupY: 0,
                stoppedReadingText: '', // 保存停止时的朗读文本
                stoppedIndex: -1, // 保存停止时的订单索引
                isDragOver: false, // 拖放悬停状态
                taskList: [], // 部门任务列表（type=1 图片）
                activeTaskId: null, // 当前选中的任务 ID（nxOcrTaskId）
                loadingTaskList: false,
                headerFlash: false, // 任务栏点击高亮动画
                headerFlashTimer: null,

                // Toast 提示相关
                toastVisible: false,
                toastMessage: '',
                toastType: 'info',
                toastDuration: 3000
            };
        },
        mounted() {
            this._pasteHandler = (e) => this.handlePaste(e);
            document.addEventListener('paste', this._pasteHandler);
        },
        beforeUnmount() {
            document.removeEventListener('paste', this._pasteHandler);
        },
        watch: {
            depId: {
                handler(val) {
                    if (val != null) this.loadTaskList();
                    else this.taskList = [];
                },
                immediate: true
            },
            currentTaskId(val) {
                this.activeTaskId = val != null ? val : null;
            }
        },
        methods: {
            // 显示 Toast 提示
            showToast(message, type = 'info', duration = 3000) {
                this.toastMessage = message;
                this.toastType = type;
                this.toastDuration = duration;
                this.toastVisible = true;
            },

            async loadTaskList(selectTaskId, opts) {
                this.loadingTaskList = true;
                try {
                    // 支持单次请求使用返回任务的类型（如 pasteSearchGoods 返回的 task 可能是 type=3）
                    const taskType = (opts && opts.type != null) ? Number(opts.type) : (this.taskType != null ? Number(this.taskType) : 1);
                    const res = await api.depGetTaskList(this.depId, taskType);
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
                    console.error('[ImageUpload] loadTaskList failed:', e);
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
                this.triggerHeaderFlash();
                this.activeTaskId = id;
                this.$emit('select-task', {taskId: id, task});
            },

            /** “+” 点击：若已在添加新图片状态则关闭（仅页面恢复），否则进入添加新图片 */
            onAddNewImageClick() {
                this.triggerHeaderFlash();
                if (this.hasCache) {
                    this.$emit('add-new-image');
                } else {
                    this.$emit('close-new-image');
                }
            },

            /** 任务栏点击高亮动画 */
            triggerHeaderFlash() {
                if (this.headerFlashTimer) clearTimeout(this.headerFlashTimer);
                this.headerFlash = true;
                this.headerFlashTimer = setTimeout(() => {
                    this.headerFlash = false;
                    this.headerFlashTimer = null;
                }, 600);
            },
            /** 将 base64 转为 File 对象 */
            base64ToFile(base64, fileName) {
                const mime = (fileName.match(/\.(jpe?g|png|gif|webp|bmp)$/i) || [])[1];
                const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
                const type = mime ? (mimeMap[mime.toLowerCase()] || 'image/png') : 'image/png';
                const bin = atob(base64);
                const arr = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
                return new File([arr], fileName, { type });
            },
            formatFileSize(bytes) {
                if (!bytes) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
            },
            handleStartDrag(event) {
                this.$emit('start-drag', event);
            },
            handleOnDrag(event) {
                this.$emit('on-drag', event);
            },
            handleEndDrag(event) {
                this.$emit('end-drag', event);
            },
            handleWheel(event) {
                this.$emit('wheel', event);
            },
            closePopup(event) {
                // 阻止事件冒泡，防止触发图片点击事件
                if (event) {
                    event.stopPropagation();
                }

                this.showClickPopup = false;
                this.stoppedReadingText = '';
                this.stoppedIndex = -1;
            },

            // 显示上一个订单
            showPreviousOrder(event) {
                // 阻止事件冒泡，防止触发图片点击事件
                if (event) {
                    event.stopPropagation();
                }

                if (this.stoppedIndex > 0 && this.orderItems && this.orderItems.length > 0) {
                    const prevIndex = this.stoppedIndex - 1;
                    const prevItem = this.orderItems[prevIndex];

                    if (prevItem) {
                        // 格式化上一个订单的文本
                        const prevText = this.formatOrderText(prevItem, prevIndex + 1);
                        this.stoppedReadingText = prevText;
                        this.stoppedIndex = prevIndex;
                        console.log('[ImageUpload] 显示上一个订单，索引:', prevIndex, '文本:', prevText);
                    }
                }
            },

            // 格式化订单文本（和 OrderList 中的格式一致）
            formatOrderText(item, index) {
                let text = '';

                // 序号
                text += `第${index}条,`;

                // 商品名称
                if (item.nxDoGoodsName) {
                    text += item.nxDoGoodsName;
                }

                // 数量+单位
                if (item.nxDoQuantity && item.nxDoStandard) {
                    text += item.nxDoQuantity + item.nxDoStandard;
                } else if (item.nxDoQuantity) {
                    text += item.nxDoQuantity;
                } else if (item.nxDoStandard) {
                    text += item.nxDoStandard;
                }

                // 备注（如果有）
                if (item.nxDoRemark && item.nxDoRemark.trim()) {
                    text += '。备注' + item.nxDoRemark;
                } else {
                    text += '。';
                }

                return text;
            },

            // 继续朗读订单（由父组件调用 OrderList.continueReading）
            continueReading(event) {
                if (event) event.stopPropagation();
                this.$emit('continue-reading');
            },

            // 修改当前订单
            editCurrentOrder(event) {
                // 阻止事件冒泡，防止触发图片点击事件
                if (event) {
                    event.stopPropagation();
                }

                console.log('[ImageUpload] editCurrentOrder 被调用，stoppedIndex:', this.stoppedIndex, 'orderItems长度:', this.orderItems?.length);

                if (this.stoppedIndex >= 0 && this.orderItems && this.orderItems.length > this.stoppedIndex) {
                    const orderItem = this.orderItems[this.stoppedIndex];
                    console.log('[ImageUpload] 修改订单，索引:', this.stoppedIndex, '订单:', orderItem);

                    // 通知父组件打开修改订单弹窗
                    this.$emit('edit-order', {
                        item: orderItem,
                        index: this.stoppedIndex
                    });
                    console.log('[ImageUpload] 已发送 edit-order 事件');
                } else {
                    console.warn('[ImageUpload] 无法修改订单，条件不满足:', {
                        stoppedIndex: this.stoppedIndex,
                        hasOrderItems: !!this.orderItems,
                        orderItemsLength: this.orderItems?.length
                    });
                }
            },

            handleImageClick(event) {
                console.log('[ImageUpload] 图片双击事件，currentReadingText:', this.currentReadingText, 'currentReadingIndex:', this.currentReadingIndex, 'showClickPopup:', this.showClickPopup);

                // 如果弹窗已经显示，再次双击图片时关闭弹窗
                if (this.showClickPopup) {
                    console.log('[ImageUpload] 弹窗已显示，关闭弹窗');
                    this.closePopup();
                    return;
                }

                // 如果正在朗读，显示弹窗并停止朗读
                if (this.currentReadingText && this.currentReadingText.trim() && this.currentReadingIndex >= 0) {
                    // ✅ 先保存当前朗读文本和索引（停止后会被清空）
                    this.stoppedReadingText = this.currentReadingText;
                    this.stoppedIndex = this.currentReadingIndex;
                    console.log('[ImageUpload] 显示弹窗，文本:', this.stoppedReadingText, '索引:', this.stoppedIndex);

                    // 获取点击位置（相对于图片容器）
                    const imgElement = event.currentTarget;
                    const container = imgElement.closest('.position-relative');

                    if (container) {
                        const rect = container.getBoundingClientRect();
                        this.popupX = event.clientX - rect.left;
                        this.popupY = event.clientY - rect.top;
                    } else {
                        // 如果没有找到容器，使用图片的 offset
                        this.popupX = event.offsetX;
                        this.popupY = event.offsetY;
                    }

                    console.log('[ImageUpload] 弹窗位置:', this.popupX, this.popupY);

                    // 显示弹窗
                    this.showClickPopup = true;

                    // 停止朗读
                    this.$emit('stop-reading', {
                        index: this.currentReadingIndex,
                        text: this.stoppedReadingText
                    });

                    // 弹窗不自动关闭，需要手动关闭
                } else {
                    console.log('[ImageUpload] 没有正在朗读的内容，不显示弹窗');
                }
            },

            // 处理拖放悬停
            handleDragOver(event) {
                event.preventDefault();
                this.isDragOver = true;
            },

            // 处理粘贴（从微信复制图片后 Ctrl+V，比拖拽更可靠）
            handlePaste(event) {
                // 在输入框内粘贴时不拦截，让默认行为生效
                if (event.target && (event.target.closest?.('input, textarea, [contenteditable="true"]'))) return;
                const clipboardData = event.clipboardData || (event.originalEvent && event.originalEvent.clipboardData);
                if (!clipboardData || !clipboardData.items) return;
                for (let i = 0; i < clipboardData.items.length; i++) {
                    const item = clipboardData.items[i];
                    if (item.kind === 'file' && item.type && item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) {
                            event.preventDefault();
                            event.stopPropagation();
                            this.$emit('image-upload', { target: { files: [file] } });
                            return;
                        }
                    }
                }
            },
            // 处理拖放进入
            handleDragEnter(event) {
                event.preventDefault();
                this.isDragOver = true;
            },

            // 处理拖放离开
            handleDragLeave(event) {
                event.preventDefault();
                // 只有当真正离开拖放区域时才取消高亮
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    this.isDragOver = false;
                }
            },

            // 处理拖放放置（支持从微信等外部应用拖入，dataTransfer.files 可能为空，需尝试 items）
            async handleDrop(event) {
                event.preventDefault();
                this.isDragOver = false;

                const dt = event.dataTransfer;
                const files = dt?.files ?? [];
                const items = dt?.items ?? [];

                let file = null;

                // 优先从 files 获取（常规拖放）
                if (files && files.length > 0) {
                    file = files[0];
                }

                // 从微信等外部应用拖入时 files 可能为空，尝试从 items 获取
                if (!file && items.length > 0) {
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        if (item.kind === 'file' && item.type && item.type.startsWith('image/')) {
                            file = item.getAsFile();
                            break;
                        }
                    }
                }

                // 尝试 getData('text/uri-list')：部分应用（如微信）可能只提供文件路径
                if (!file && typeof window !== 'undefined' && window.electronAPI?.readFile) {
                    try {
                        const uriList = dt.getData('text/uri-list') || dt.getData('text/plain') || '';
                        const filePaths = uriList.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
                        for (const uri of filePaths) {
                            let path = uri;
                            if (path.startsWith('file://')) {
                                path = path.replace(/^file:\/\/\/?/, '/').replace(/%20/g, ' ');
                            }
                            if (path && /\.(jpe?g|png|gif|webp|bmp)$/i.test(path)) {
                                const res = await window.electronAPI.readFile(path);
                                if (res?.success && res?.data) {
                                    file = this.base64ToFile(res.data, res.fileName || 'image.png');
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        // getData/readFile 失败时静默，继续走后续逻辑
                    }
                }

                if (!file) {
                    // 从微信等外部应用拖入时 dataTransfer 为空，Chromium 无法获取数据
                    this.showToast('从微信拖入暂不支持，请尝试：在微信中右键图片→复制，然后在此处按 Ctrl+V 粘贴', 'warning');
                    return;
                }

                // 验证文件类型
                if (!file.type || !file.type.startsWith('image/')) {
                    this.showToast('请拖放有效的图片文件', 'error');
                    return;
                }

                // 创建一个模拟的事件对象，兼容父组件的 handleImageUpload 方法
                const syntheticEvent = {
                    target: {
                        files: [file]
                    }
                };

                // 触发图片上传事件
                this.$emit('image-upload', syntheticEvent);
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

    /* 识别中蒙版样式（与 PasteUpload 加载占位同款呼吸动画） */
    .recognizing-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.55);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10;
        border-radius: 0.25rem;
        animation: recognizing-pulse 1.5s ease-in-out infinite;
    }

    @keyframes recognizing-pulse {
        0%, 100% {
            opacity: 0.85;
        }
        50% {
            opacity: 1;
        }
    }

    .recognizing-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    /* 点击弹窗样式 */
    .click-popup {
        position: absolute;
        z-index: 2000;
        pointer-events: none; /* 弹窗容器不拦截，允许点击穿透到图片 */
        transform: translate(-50%, -100%);
        margin-top: -10px;
    }

    .popup-content {
        pointer-events: auto; /* ✅ 只有内容可点击 */
        background-color: rgba(255, 255, 255, 0.95);
        color: #000;
        padding: 10px 15px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: bold;
        text-shadow: none;
        max-width: 300px;
        word-wrap: break-word;
        white-space: normal;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(0, 0, 0, 0.1);
    }

    /* 拖放区域样式 */
    .drop-zone {
        transition: all 0.3s ease;
    }

    .drop-zone.drag-over {
        background-color: #e3f2fd !important;
        border-color: #2196f3 !important;
        border-width: 2px !important;
        transform: scale(1.02);
    }

    /* 任务栏（+ 与任务标签）点击高亮动画 */
    .image-task-header {
        transition: background-color 0.3s ease-out, box-shadow 0.3s ease-out;
    }

    .image-task-header--flash {
        animation: imageTaskHeaderFlash 0.6s ease-out forwards;
    }

    @keyframes imageTaskHeaderFlash {
        0% {
            background-color: rgba(23, 162, 184, 0.2);
            box-shadow: inset 0 0 0 2px rgba(23, 162, 184, 0.35);
        }
        100% {
            background-color: transparent;
            box-shadow: none;
        }
    }

    /* TaskOrder：加载任务内容占位动画（与 PasteUpload 一致） */
    @keyframes image-placeholder-pulse {
        0%, 100% {
            opacity: 0.85;
        }
        50% {
            opacity: 1;
        }
    }

    /* 任务内容加载完成后图片区淡入 */
    .image-task-content-fade-enter-active,
    .image-task-content-fade-leave-active {
        transition: opacity 0.25s ease;
    }

    .image-task-content-fade-enter-from,
    .image-task-content-fade-leave-to {
        opacity: 0;
    }
</style>


