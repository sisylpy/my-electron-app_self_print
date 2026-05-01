<template>
    <teleport to="body">
        <transition name="toast-fade">
            <div v-if="visible"
                 class="toast-container"
                 :class="toastClass">
                <div class="toast-content">
                    <span v-if="type === 'success'" class="toast-icon">✅</span>
                    <span v-else-if="type === 'error'" class="toast-icon">❌</span>
                    <span v-else-if="type === 'warning'" class="toast-icon">⚠️</span>
                    <span v-else class="toast-icon">ℹ️</span>
                    <span class="toast-message">{{ message }}</span>
                </div>
            </div>
        </transition>
    </teleport>
</template>

<script>
export default {
    name: 'Toast',
    props: {
        visible: {
            type: Boolean,
            default: false
        },
        message: {
            type: String,
            default: ''
        },
        type: {
            type: String,
            default: 'info', // success, error, warning, info
            validator: (v) => ['success', 'error', 'warning', 'info'].includes(v)
        },
        duration: {
            type: Number,
            default: 3000 // 毫秒
        }
    },
    data() {
        return {
            timeoutId: null
        };
    },
    computed: {
        toastClass() {
            return `toast-${this.type}`;
        }
    },
    watch: {
        visible(newVal) {
            if (newVal) {
                this.startAutoHide();
            } else {
                this.stopAutoHide();
            }
        },
        duration() {
            if (this.visible) {
                this.startAutoHide();
            }
        }
    },
    methods: {
        startAutoHide() {
            this.stopAutoHide();
            if (this.duration > 0) {
                this.timeoutId = setTimeout(() => {
                    this.$emit('update:visible', false);
                }, this.duration);
            }
        },
        stopAutoHide() {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }
        }
    },
    beforeUnmount() {
        this.stopAutoHide();
    }
}
</script>

<style scoped>
.toast-container {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: center;
}

.toast-content {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    max-width: 500px;
}

.toast-success {
    background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
    color: #155724;
    border: 1px solid #b8dabc;
}

.toast-error {
    background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
    color: #721c24;
    border: 1px solid #f1aeb5;
}

.toast-warning {
    background: linear-gradient(135deg, #fff3cd 0%, #ffeba7 100%);
    color: #856404;
    border: 1px solid #fde2e6;
}

.toast-info {
    background: linear-gradient(135deg, #d1ecf1 0%, #bee5eb 100%);
    color: #0c5460;
    border: 1px solid #cff4fc;
}

.toast-icon {
    font-size: 18px;
    flex-shrink: 0;
}

.toast-message {
    font-size: 14px;
    font-weight: 500;
    word-break: break-word;
}

.toast-fade-enter-active,
.toast-fade-leave-active {
    transition: all 0.3s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.9);
}

.toast-fade-enter-to,
.toast-fade-leave-from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
}
</style>

