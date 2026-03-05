<template>
    <div class="upload-section" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
        <div class="row g-3" style="flex: 1; min-height: 0; overflow: hidden; margin: 0; align-items: stretch;">
            <!-- 左侧：图片上传和预览 -->
            <div class="col-md-6">
                <div class="card h-100">
                    <div class="card-body p-1" style="display: flex; flex-direction: column; min-height: 0; position: relative;">
                        <!-- 图片选择功能（有缓存或有进行中任务时隐藏，避免重复操作） -->
                        <div v-if="!hasCache && !hasRunningTask" style="flex-shrink: 0;">
                            <input
                                type="file"
                                ref="imageFileInput"
                                accept="image/*"
                                @change="$emit('image-upload', $event)"
                                class="form-control mb-2"
                            />
                            <small class="text-muted">支持JPG、PNG等图片格式，系统将自动识别图片中的订单信息</small>
                        </div>
                        
                       

                        <!-- 识别中蒙版（不依赖 imagePreview，只要有任务就显示） -->
                        <div v-if="hasRunningTask && !hasCache && !uploadedImageFile" class="recognizing-overlay" style="position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; z-index: 10;">
                            <div class="recognizing-content">
                                <div class="spinner-border text-primary mb-3" role="status">
                                    <span class="visually-hidden">识别中...</span>
                                </div>
                                <div class="text-white fw-bold">该客户正在识别中，请稍候...</div>
                            </div>
                        </div>

                        <div v-if="uploadedImageFile" class="flex-grow-1"
                             style="display: flex; flex-direction: column; min-height: 0;">
                            <div class="p-2 bg-light rounded mb-2" style="flex-shrink: 0;">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <div class="fw-bold">🖼️ {{ uploadedImageFile.name }}</div>
                                        <div class="small text-muted">大小: {{ formatFileSize(uploadedImageFile.size) }}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- 图片预览 -->
                            <div v-if="imagePreview" class="border rounded p-0 position-relative flex-grow-1"
                                 style="min-height: 0; overflow: hidden; cursor: move; background-color: #f5f5f5; display: flex; align-items: start; justify-content: start; position: relative !important;"
                                 @mousedown="handleStartDrag"
                                 @mousemove="handleOnDrag"
                                 @mouseup="handleEndDrag"
                                 @mouseleave="handleEndDrag"
                                 @wheel.prevent="handleWheel">
                                
                                <!-- 识别中蒙版（在图片预览区域内） -->
                                <div v-if="hasRunningTask && !hasCache" class="recognizing-overlay" style="position: absolute !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;">
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
                                                    class="btn btn-sm btn-outline-primary"
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

            <!-- 右侧：订单列表（图片模式） -->
            <div class="col-md-6 order-items-section"
                 style="display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;">
                <div class="card h-100 p-3"
                     style="display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                    <div class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                        <h6 class="mb-0">转换订单 ({{ orderItems.length }} 项)</h6>
                        <div class="d-flex gap-2">
                            <button
                                v-if="hasCache && allOrdersAreDraft"
                                class="btn btn-success btn-sm"
                                @click="$emit('clear-save')">
                                完成下单
                            </button>
                            <button
                                v-if="hasCache"
                                class="btn btn-danger btn-sm"
                                @click="$emit('re-upload')">
                                重新上传
                            </button>
                            <button
                                v-if="hasCache"
                                class="btn btn-primary btn-sm"
                                @click="$emit('show-fix-items')">
                                调整订单内容
                            </button>
                        </div>
                    </div>

                    <!-- 订单列表内容（图片模式） -->
                    <slot name="order-list"></slot>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'ImageUpload',
    props: {
        hasCache: {
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
        }
    },
    emits: [
        'image-upload',
        'reset-transform',
        'zoom-in',
        'zoom-out',
        'image-load',
        'clear-save',
        're-upload',
        'show-fix-items',
        'start-drag',
        'on-drag',
        'end-drag',
        'wheel',
        'stop-reading',
        'edit-order',
        'continue-reading'
    ],
    data() {
        return {
            showClickPopup: false,
            popupX: 0,
            popupY: 0,
            stoppedReadingText: '', // 保存停止时的朗读文本
            stoppedIndex: -1 // 保存停止时的订单索引
        }
    },
    methods: {
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
        
        // 继续朗读订单
        continueReading(event) {
            // 阻止事件冒泡，防止触发图片点击事件
            if (event) {
                event.stopPropagation();
            }
            
            console.log('[ImageUpload] 继续朗读订单');
            
            // 通知父组件继续朗读
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

    /* 识别中蒙版样式 */
    .recognizing-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(255, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10;
        border-radius: 0.25rem;
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
</style>

