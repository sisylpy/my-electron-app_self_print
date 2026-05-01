<template>
    <teleport to="body">
        <!-- Alert 弹窗 (只有确定按钮) -->
        <div v-if="alertConfig.show" class="ad-backdrop" @click.self="closeAlert">
            <div class="ad-modal" role="dialog" aria-modal="true">
                <div class="ad-body">
                    <div class="ad-icon">
                        <span v-if="alertConfig.type === 'success'">✓</span>
                        <span v-else-if="alertConfig.type === 'error'">✕</span>
                        <span v-else-if="alertConfig.type === 'warning'">!</span>
                        <span v-else>ℹ</span>
                    </div>
                    <div class="ad-message">{{ alertConfig.message }}</div>
                </div>
                <div class="ad-footer">
                    <button type="button" class="ad-btn" @click="closeAlert">确定</button>
                </div>
            </div>
        </div>

        <!-- Confirm 弹窗 (有确定和取消按钮) -->
        <div v-if="confirmConfig.show" class="ad-backdrop" @click.self="closeConfirm(false)">
            <div class="ad-modal" role="dialog" aria-modal="true">
                <div class="ad-body">
                    <div class="ad-icon confirm">
                        <span>?</span>
                    </div>
                    <div class="ad-message">{{ confirmConfig.message }}</div>
                </div>
                <div class="ad-footer">
                    <button type="button" class="ad-btn ghost" @click="closeConfirm(false)">取消</button>
                    <button type="button" class="ad-btn" @click="closeConfirm(true)">确定</button>
                </div>
            </div>
        </div>
    </teleport>
</template>

<script>
export default {
    name: 'AlertDialog',
    data() {
        return {
            alertConfig: {
                show: false,
                message: '',
                type: 'info', // 'info', 'success', 'error', 'warning'
                callback: null
            },
            confirmConfig: {
                show: false,
                message: '',
                callback: null
            }
        };
    },
    methods: {
        // 显示 Alert
        alert(message, type = 'info') {
            return new Promise((resolve) => {
                this.alertConfig = {
                    show: true,
                    message,
                    type,
                    callback: resolve
                };
            });
        },
        // 显示 Confirm
        confirm(message) {
            return new Promise((resolve) => {
                this.confirmConfig = {
                    show: true,
                    message,
                    callback: resolve
                };
            });
        },
        // 关闭 Alert
        closeAlert() {
            this.alertConfig.show = false;
            if (this.alertConfig.callback) {
                this.alertConfig.callback();
                this.alertConfig.callback = null;
            }
        },
        // 关闭 Confirm
        closeConfirm(result) {
            this.confirmConfig.show = false;
            if (this.confirmConfig.callback) {
                this.confirmConfig.callback(result);
                this.confirmConfig.callback = null;
            }
        }
    }
};
</script>

<style scoped>
/* Backdrop */
.ad-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    backdrop-filter: blur(2px);
}

/* Modal */
.ad-modal {
    background-color: #ffffff;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    min-width: 320px;
    max-width: 480px;
    animation: adSlideIn 0.3s ease-out;
}

@keyframes adSlideIn {
    from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
    }
    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

/* Body */
.ad-body {
    padding: 24px 24px 16px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
}

/* Icon */
.ad-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: bold;
    flex-shrink: 0;
    flex-grow: 0;
}

.ad-icon span {
    font-size: 20px;
}

.ad-icon:not(.confirm) {
    background-color: #e3f2fd;
    color: #1976d2;
}

.ad-icon.confirm {
    background-color: #fff3e0;
    color: #f57c00;
}

.ad-icon[data-type="success"] {
    background-color: #e8f5e9;
    color: #43a047;
}

.ad-icon[data-type="error"] {
    background-color: #ffebee;
    color: #d32f2f;
}

.ad-icon[data-type="warning"] {
    background-color: #fff8e1;
    color: #ffa000;
}

/* Message */
.ad-message {
    flex: 1;
    font-size: 15px;
    color: #333333;
    line-height: 1.6;
    word-wrap: break-word;
}

/* Footer */
.ad-footer {
    padding: 12px 24px 24px;
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

/* Buttons */
.ad-btn {
    min-width: 80px;
    padding: 8px 20px;
    font-size: 14px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
}

.ad-btn {
    background-color: #1976d2;
    color: white;
}

.ad-btn:hover {
    background-color: #1565c0;
    box-shadow: 0 2px 8px rgba(25, 118, 210, 0.3);
}

.ad-btn:active {
    transform: scale(0.98);
}

.ad-btn.ghost {
    background-color: transparent;
    color: #666666;
    border: 1px solid #d0d0d0;
}

.ad-btn.ghost:hover {
    background-color: #f5f5f5;
    color: #333333;
    border-color: #b0b0b0;
}

/* 响应式 */
@media (max-width: 480px) {
    .ad-modal {
        min-width: 280px;
        margin: 0 16px;
    }
    
    .ad-body {
        padding: 20px;
    }
    
    .ad-footer {
        padding: 8px 20px 20px;
    }
}
</style>

