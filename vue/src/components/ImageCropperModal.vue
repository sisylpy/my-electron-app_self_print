<template>
    <teleport to="body">
        <div v-if="isOpen" class="icm-backdrop" @click.self="onCancel">
            <div class="icm-modal" role="dialog" aria-modal="true">
                <!-- Header -->
                <div class="icm-header">
                    <div class="icm-title">{{ title }}</div>
                    <div class="icm-subtitle">
                        原图：{{ naturalWidth }} × {{ naturalHeight }} px
                        <span v-if="fileSize">｜文件：{{ formatFileSize(fileSize) }}</span>
                        ｜缩放：{{ Math.round(zoom * 100) }}%
                    </div>
                    <button class="icm-close" type="button" @click="onCancel">✕</button>
                </div>

                <!-- Body -->
                <div class="icm-body">
                    <!-- Toolbar -->
                    <div class="icm-toolbar">
                        <div class="icm-toolbar-left">
                            <button type="button" class="icm-btn" @click="zoomOut">-</button>
                            <input
                                    class="icm-zoom"
                                    type="range"
                                    min="0.5"
                                    max="4"
                                    step="0.05"
                                    v-model.number="zoom"
                                    @input="onViewChanged"
                            />
                            <button type="button" class="icm-btn" @click="zoomIn">+</button>
                            <button type="button" class="icm-btn" @click="resetView">重置视图</button>
                            <button type="button" class="icm-btn" @click="resetCrop">重置裁剪框</button>
                        </div>

                        <div class="icm-toolbar-right">
                            <label class="icm-check">
                                <input type="checkbox" v-model="lockCropToImage" />
                                裁剪框限制在图片内
                            </label>
                        </div>
                    </div>

                    <!-- Viewport -->
                    <div
                            ref="viewport"
                            class="icm-viewport"
                            @pointerdown="onViewportPointerDown"
                    >
                        <img
                                ref="img"
                                class="icm-image"
                                :src="src"
                                alt="preview"
                                draggable="false"
                                @load="onImageLoad"
                                :style="imageTransformStyle"
                        />

                        <!-- Crop overlay -->
                        <div v-if="ready" class="icm-overlay">
                            <!-- crop box -->
                            <div
                                    class="icm-crop"
                                    :style="cropStyle"
                                    @pointerdown.stop="onCropPointerDown"
                            >
                                <!-- handles -->
                                <div class="icm-handle nw" @pointerdown.stop.prevent="onHandleDown($event,'nw')"></div>
                                <div class="icm-handle ne" @pointerdown.stop.prevent="onHandleDown($event,'ne')"></div>
                                <div class="icm-handle sw" @pointerdown.stop.prevent="onHandleDown($event,'sw')"></div>
                                <div class="icm-handle se" @pointerdown.stop.prevent="onHandleDown($event,'se')"></div>

                                <!-- dim outside (simple mask) -->
                                <div class="icm-crop-mask"></div>
                            </div>
                        </div>

                        <!-- Hint -->
                        <div class="icm-hint">
                            <div>拖动空白处：平移图片｜滚轮：缩放</div>
                            <div>拖动裁剪框：移动｜拖拽四角：缩放裁剪框</div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="icm-footer">
                    <button type="button" class="icm-btn ghost" @click="onCancel">取消</button>
                    <button type="button" class="icm-btn" :disabled="!ready" @click="onDirectRecognize">
                        直接识别
                    </button>
                    <button type="button" class="icm-btn primary" :disabled="!ready" @click="onConfirm">
                        确认裁剪
                    </button>
                </div>
            </div>
        </div>
    </teleport>
</template>

<script>
    export default {
        name: "ImageCropperModal",

        // Vue3 用 modelValue；Vue2 可用 value/input
        props: {
            modelValue: { type: Boolean, default: undefined },
            value: { type: Boolean, default: undefined },

            src: { type: String, required: true },
            title: { type: String, default: "图片预览与裁剪" },
            fileSize: { type: Number, default: 0 },

            // 初始裁剪框占图片可视区域比例
            initialCropRatio: { type: Number, default: 0.8 }
        },

        emits: ["update:modelValue", "input", "cancel", "confirm", "direct-recognize"],

        data() {
            return {
                ready: false,

                naturalWidth: 0,
                naturalHeight: 0,

                // view transform
                zoom: 1,
                panX: 0,
                panY: 0,

                // crop rect in viewport coordinates
                crop: { x: 0, y: 0, w: 200, h: 200 },

                // behavior
                lockCropToImage: true,

                // interaction
                dragMode: null, // 'pan' | 'crop-move' | 'crop-resize'
                resizeHandle: null,
                pointerId: null,
                start: null
            };
        },

        computed: {
            isOpen() {
                // Vue3 优先 modelValue；Vue2 用 value
                if (typeof this.modelValue === "boolean") return this.modelValue;
                if (typeof this.value === "boolean") return this.value;
                return false;
            },

            imageTransformStyle() {
                // scale + translate（translate 不随 scale 放大，拖拽更自然）
                // 先居中：translate(-50%, -50%)，然后缩放，最后应用用户拖拽的偏移
                // transform 从右到左应用，所以顺序是：translate(pan) -> scale -> translate(-50%, -50%)
                return {
                    transform: `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom}) translate(-50%, -50%)`
                };
            },

            cropStyle() {
                return {
                    left: `${this.crop.x}px`,
                    top: `${this.crop.y}px`,
                    width: `${this.crop.w}px`,
                    height: `${this.crop.h}px`
                };
            }
        },

        watch: {
            isOpen(val) {
                if (val) {
                    this.$nextTick(() => {
                        this.bindWheelZoom();
                    });
                } else {
                    this.unbindWheelZoom();
                }
            },

            src() {
                // src 变化时重置状态
                this.ready = false;
                this.naturalWidth = 0;
                this.naturalHeight = 0;
                this.zoom = 1;
                this.panX = 0;
                this.panY = 0;
                this.dragMode = null;
                this.resizeHandle = null;
                this.pointerId = null;
                this.start = null;
            }
        },

        mounted() {
            if (this.isOpen) this.bindWheelZoom();
        },

        beforeUnmount() {
            this.unbindWheelZoom();
            this.unbindGlobalPointer();
        },

        methods: {
            // ---------- Public close ----------
            close() {
                this.$emit("update:modelValue", false);
                this.$emit("input", false);
            },

            onCancel() {
                this.$emit("cancel");
                this.close();
            },

            // ---------- Image load ----------
            onImageLoad(e) {
                const img = e.target;
                this.naturalWidth = img.naturalWidth || 0;
                this.naturalHeight = img.naturalHeight || 0;

                this.$nextTick(() => {
                    this.ready = true;
                    this.resetView();
                    this.resetCrop();
                });
            },

            // ---------- View helpers ----------
            bindWheelZoom() {
                const vp = this.$refs.viewport;
                if (!vp) return;
                vp.addEventListener("wheel", this.onWheel, { passive: false });
            },

            unbindWheelZoom() {
                const vp = this.$refs.viewport;
                if (!vp) return;
                vp.removeEventListener("wheel", this.onWheel);
            },

            onWheel(evt) {
                // Ctrl/trackpad often triggers zoom; we treat wheel as zoom for convenience
                evt.preventDefault();
                const delta = evt.deltaY;
                const factor = delta > 0 ? 0.95 : 1.05;
                const next = Math.min(4, Math.max(0.5, this.zoom * factor));
                this.zoom = Number(next.toFixed(4));
                this.onViewChanged();
            },

            zoomIn() {
                this.zoom = Math.min(4, Number((this.zoom + 0.1).toFixed(2)));
                this.onViewChanged();
            },

            zoomOut() {
                this.zoom = Math.max(0.5, Number((this.zoom - 0.1).toFixed(2)));
                this.onViewChanged();
            },

            resetView() {
                this.zoom = 1;
                this.panX = 0;
                this.panY = 0;
                this.onViewChanged();
            },

            onViewChanged() {
                // 视图变化后，裁剪框仍需 clamp
                this.$nextTick(() => {
                    if (this.lockCropToImage) this.clampCropToImage();
                });
            },

            // ---------- Crop init / clamp ----------
            resetCrop() {
                const imgInfo = this.getImageRectInViewport();
                if (!imgInfo) return;

                const ratio = Math.min(0.95, Math.max(0.3, this.initialCropRatio));
                const w = Math.max(80, imgInfo.width * ratio);
                const h = Math.max(80, imgInfo.height * ratio);

                this.crop.w = w;
                this.crop.h = h;
                this.crop.x = imgInfo.left + (imgInfo.width - w) / 2;
                this.crop.y = imgInfo.top + (imgInfo.height - h) / 2;

                if (this.lockCropToImage) this.clampCropToImage();
            },

            getImageRectInViewport() {
                const vp = this.$refs.viewport;
                const img = this.$refs.img;
                if (!vp || !img) return null;

                const vpRect = vp.getBoundingClientRect();
                const imgRect = img.getBoundingClientRect();

                return {
                    left: imgRect.left - vpRect.left,
                    top: imgRect.top - vpRect.top,
                    width: imgRect.width,
                    height: imgRect.height,
                    vpRect,
                    imgRect
                };
            },

            clampCropToImage() {
                const imgInfo = this.getImageRectInViewport();
                if (!imgInfo) return;

                const minSize = 60;

                // min size
                this.crop.w = Math.max(minSize, this.crop.w);
                this.crop.h = Math.max(minSize, this.crop.h);

                const minX = imgInfo.left;
                const minY = imgInfo.top;
                const maxX = imgInfo.left + imgInfo.width - this.crop.w;
                const maxY = imgInfo.top + imgInfo.height - this.crop.h;

                this.crop.x = Math.max(minX, Math.min(this.crop.x, maxX));
                this.crop.y = Math.max(minY, Math.min(this.crop.y, maxY));
            },

            // ---------- Pointer interactions ----------
            onViewportPointerDown(e) {
                if (!this.ready) return;

                // 在空白处按下：平移图片
                this.dragMode = "pan";
                this.pointerId = e.pointerId;

                this.start = {
                    x: e.clientX,
                    y: e.clientY,
                    panX: this.panX,
                    panY: this.panY
                };

                this.bindGlobalPointer();
                this.capturePointer(e);
            },

            onCropPointerDown(e) {
                if (!this.ready) return;

                // 拖动裁剪框
                this.dragMode = "crop-move";
                this.pointerId = e.pointerId;

                const vp = this.$refs.viewport;
                const vpRect = vp.getBoundingClientRect();

                this.start = {
                    x: e.clientX,
                    y: e.clientY,
                    cropX: this.crop.x,
                    cropY: this.crop.y,
                    offsetX: (e.clientX - vpRect.left) - this.crop.x,
                    offsetY: (e.clientY - vpRect.top) - this.crop.y
                };

                this.bindGlobalPointer();
                this.capturePointer(e);
            },

            onHandleDown(e, handle) {
                if (!this.ready) return;

                this.dragMode = "crop-resize";
                this.resizeHandle = handle;
                this.pointerId = e.pointerId;

                this.start = {
                    x: e.clientX,
                    y: e.clientY,
                    crop: { ...this.crop }
                };

                this.bindGlobalPointer();
                this.capturePointer(e);
            },

            capturePointer(e) {
                // 让后续 move/up 能稳定触发
                try {
                    e.currentTarget?.setPointerCapture?.(e.pointerId);
                } catch (_) {}
            },

            bindGlobalPointer() {
                window.addEventListener("pointermove", this.onGlobalPointerMove, { passive: false });
                window.addEventListener("pointerup", this.onGlobalPointerUp, { passive: false });
                window.addEventListener("pointercancel", this.onGlobalPointerUp, { passive: false });
            },

            unbindGlobalPointer() {
                window.removeEventListener("pointermove", this.onGlobalPointerMove);
                window.removeEventListener("pointerup", this.onGlobalPointerUp);
                window.removeEventListener("pointercancel", this.onGlobalPointerUp);
            },

            onGlobalPointerMove(e) {
                if (!this.ready) return;
                if (this.pointerId !== e.pointerId) return;
                if (!this.dragMode || !this.start) return;

                e.preventDefault();

                const dx = e.clientX - this.start.x;
                const dy = e.clientY - this.start.y;

                if (this.dragMode === "pan") {
                    // pan：拖拽速度按 zoom 抵消，体感更一致
                    this.panX = this.start.panX + dx / this.zoom;
                    this.panY = this.start.panY + dy / this.zoom;

                    if (this.lockCropToImage) this.$nextTick(() => this.clampCropToImage());
                    return;
                }

                const vp = this.$refs.viewport;
                const vpRect = vp.getBoundingClientRect();

                if (this.dragMode === "crop-move") {
                    const px = (e.clientX - vpRect.left) - this.start.offsetX;
                    const py = (e.clientY - vpRect.top) - this.start.offsetY;

                    this.crop.x = px;
                    this.crop.y = py;

                    if (this.lockCropToImage) this.clampCropToImage();
                    return;
                }

                if (this.dragMode === "crop-resize") {
                    const initial = this.start.crop;

                    let x = initial.x;
                    let y = initial.y;
                    let w = initial.w;
                    let h = initial.h;

                    switch (this.resizeHandle) {
                        case "nw":
                            x = initial.x + dx;
                            y = initial.y + dy;
                            w = initial.w - dx;
                            h = initial.h - dy;
                            break;
                        case "ne":
                            y = initial.y + dy;
                            w = initial.w + dx;
                            h = initial.h - dy;
                            break;
                        case "sw":
                            x = initial.x + dx;
                            w = initial.w - dx;
                            h = initial.h + dy;
                            break;
                        case "se":
                        default:
                            w = initial.w + dx;
                            h = initial.h + dy;
                            break;
                    }

                    this.crop.x = x;
                    this.crop.y = y;
                    this.crop.w = w;
                    this.crop.h = h;

                    if (this.lockCropToImage) this.clampCropToImage();
                }
            },

            onGlobalPointerUp(e) {
                if (this.pointerId !== e.pointerId) return;

                this.dragMode = null;
                this.resizeHandle = null;
                this.pointerId = null;
                this.start = null;

                this.unbindGlobalPointer();
            },

            // ---------- Crop computation (never offsets) ----------
            async makeCroppedDataUrl() {
                const imgEl = this.$refs.img;
                const vpEl = this.$refs.viewport;
                if (!imgEl || !vpEl) throw new Error("找不到图片或裁剪容器");

                const imgRect = imgEl.getBoundingClientRect(); // transformed display rect
                const vpRect = vpEl.getBoundingClientRect();

                // crop box (viewport coords) -> screen coords
                const cropLeft = vpRect.left + this.crop.x;
                const cropTop = vpRect.top + this.crop.y;

                // relative to image rect in screen
                const relX = cropLeft - imgRect.left;
                const relY = cropTop - imgRect.top;

                const scaleX = imgEl.naturalWidth / imgRect.width;
                const scaleY = imgEl.naturalHeight / imgRect.height;

                let sx = Math.round(relX * scaleX);
                let sy = Math.round(relY * scaleY);
                let sw = Math.round(this.crop.w * scaleX);
                let sh = Math.round(this.crop.h * scaleY);

                // clamp to natural image bounds
                sx = Math.max(0, Math.min(sx, imgEl.naturalWidth - 1));
                sy = Math.max(0, Math.min(sy, imgEl.naturalHeight - 1));
                sw = Math.max(1, Math.min(sw, imgEl.naturalWidth - sx));
                sh = Math.max(1, Math.min(sh, imgEl.naturalHeight - sy));

                // draw
                const canvas = document.createElement("canvas");
                canvas.width = sw;
                canvas.height = sh;

                const ctx = canvas.getContext("2d");
                const img = new Image();
                img.crossOrigin = "anonymous";

                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = this.src;
                });

                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

                return {
                    dataUrl: canvas.toDataURL("image/png"),
                    rect: { x: sx, y: sy, w: sw, h: sh } // in natural image coords
                };
            },

            onDirectRecognize() {
                // 直接识别，不裁剪
                this.$emit("direct-recognize", this.src);
                this.close();
            },

            async onConfirm() {
                try {
                    const { dataUrl, rect } = await this.makeCroppedDataUrl();
                    this.$emit("confirm", {
                        croppedDataUrl: dataUrl,
                        cropRect: rect,
                        naturalWidth: this.naturalWidth,
                        naturalHeight: this.naturalHeight,
                        zoom: this.zoom,
                        panX: this.panX,
                        panY: this.panY
                    });
                    this.close();
                } catch (e) {
                    // 你可以替换为 toast
                    console.error(e);
                    alert("裁剪失败，请重试");
                }
            },

            // ---------- Utils ----------
            formatFileSize(bytes) {
                if (!bytes) return "-";
                const units = ["B", "KB", "MB", "GB"];
                let size = bytes;
                let i = 0;
                while (size >= 1024 && i < units.length - 1) {
                    size /= 1024;
                    i++;
                }
                return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
            }
        }
    };
</script>

<style scoped>
    .icm-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    }

    .icm-modal {
        width: min(980px, 96vw);
        height: min(720px, 92vh);
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 18px 60px rgba(0,0,0,.35);
        display: flex;
        flex-direction: column;
    }

    .icm-header {
        position: relative;
        padding: 14px 44px 12px 16px;
        border-bottom: 1px solid #eee;
        background: #fafafa;
    }

    .icm-title {
        font-weight: 700;
        font-size: 16px;
    }

    .icm-subtitle {
        margin-top: 6px;
        font-size: 12px;
        color: #666;
    }

    .icm-close {
        position: absolute;
        right: 10px;
        top: 10px;
        border: 0;
        background: transparent;
        font-size: 18px;
        cursor: pointer;
        line-height: 1;
    }

    .icm-body {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    .icm-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 12px;
        border-bottom: 1px solid #eee;
        background: #fff;
    }

    .icm-toolbar-left, .icm-toolbar-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .icm-btn {
        border: 1px solid #ddd;
        background: #fff;
        padding: 7px 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
    }
    .icm-btn:hover { background: #f7f7f7; }

    .icm-btn.primary {
        border-color: #2c7;
        background: #2c7;
        color: #fff;
    }
    .icm-btn.primary:hover { filter: brightness(0.97); }

    .icm-btn.ghost {
        background: #fff;
    }

    .icm-btn:disabled {
        opacity: .6;
        cursor: not-allowed;
    }

    .icm-zoom {
        width: 220px;
    }

    .icm-check {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #444;
    }

    .icm-viewport {
        position: relative;
        flex: 1;
        min-height: 0;
        background: #111;
        overflow: hidden;
        user-select: none;
        touch-action: none; /* 关键：支持指针拖拽，不被浏览器手势抢走 */
    }

    .icm-image {
        position: absolute;
        left: 50%;
        top: 50%;
        max-width: 100%;
        max-height: 100%;
        transform-origin: center center;
        /* 注意：实际 transform 由 :style 覆盖，基础居中靠 left/top 50% + transform */
    }

    .icm-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    /* crop box */
    .icm-crop {
        position: absolute;
        border: 2px solid rgba(255,255,255,.9);
        border-radius: 8px;
        box-shadow: 0 0 0 9999px rgba(0,0,0,.35);
        pointer-events: auto;
        cursor: move;
    }

    .icm-crop-mask {
        position: absolute;
        inset: 0;
        border-radius: 6px;
        background: rgba(0,0,0,.00);
    }

    /* handles */
    .icm-handle {
        position: absolute;
        width: 14px;
        height: 14px;
        background: #fff;
        border-radius: 4px;
        border: 1px solid rgba(0,0,0,.25);
    }

    .icm-handle.nw { left: -7px; top: -7px; cursor: nwse-resize; }
    .icm-handle.ne { right: -7px; top: -7px; cursor: nesw-resize; }
    .icm-handle.sw { left: -7px; bottom: -7px; cursor: nesw-resize; }
    .icm-handle.se { right: -7px; bottom: -7px; cursor: nwse-resize; }

    .icm-hint {
        position: absolute;
        left: 10px;
        bottom: 10px;
        font-size: 12px;
        color: rgba(255,255,255,.85);
        background: rgba(0,0,0,.35);
        padding: 8px 10px;
        border-radius: 10px;
        backdrop-filter: blur(4px);
    }

    .icm-footer {
        padding: 12px;
        border-top: 1px solid #eee;
        background: #fff;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }
</style>
