/**
 * Toast 管理器
 * 用于在 Vue 组件外部显示 Toast 提示
 */

let toastInstance = null;
let toastVisible = false;

export default {
    install(app) {
        app.config.globalProperties.$toast = {
            show(message, options = {}) {
                if (toastInstance) {
                    // 如果已有实例，复用
                    toastInstance.message = message;
                    toastInstance.type = options.type || 'info';
                    toastInstance.duration = options.duration !== undefined ? options.duration : 3000;
                    toastVisible = true;
                } else {
                    // 创建新实例
                    const container = document.createElement('div');
                    document.body.appendChild(container);
                    
                    const ToastComponent = {
                        template: `<toast 
                            v-model:visible="toastVisible" 
                            :message="message" 
                            :type="type" 
                            :duration="duration"
                            @update:visible="onVisibleChange"
                        ></toast>`,
                        data() {
                            return {
                                toastVisible: false,
                                message: '',
                                type: 'info',
                                duration: 3000
                            };
                        },
                        methods: {
                            onVisibleChange(val) {
                                toastVisible = val;
                            }
                        },
                        beforeUnmount() {
                            toastInstance = null;
                            toastVisible = false;
                            if (container.parentNode) {
                                container.parentNode.removeChild(container);
                            }
                        }
                    };
                    
                    const instance = app.mount(container);
                    instance.message = message;
                    instance.type = options.type || 'info';
                    instance.duration = options.duration !== undefined ? options.duration : 3000;
                    toastInstance = instance;
                    toastVisible = true;
                }
                
                return this;
            },
            success(message, duration) {
                return this.show(message, { type: 'success', duration });
            },
            error(message, duration) {
                return this.show(message, { type: 'error', duration });
            },
            warning(message, duration) {
                return this.show(message, { type: 'warning', duration });
            },
            info(message, duration) {
                return this.show(message, { type: 'info', duration });
            }
        };
        
        // 创建全局 Toast 组件
        app.component('toast', {
            props: ['visible', 'message', 'type', 'duration'],
            emits: ['update:visible'],
            template: `
                <teleport to="body">
                    <transition name="toast-fade">
                        <div v-if="visible" class="toast-container" :class="'toast-' + type">
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
            `,
            style: `
                <style scoped>
                .toast-container {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
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
                    transform: translateY(-20px);
                }
                .toast-fade-enter-to,
                .toast-fade-leave-from {
                    opacity: 1;
                    transform: translateY(0);
                }
                </style>
            `
        });
    }
};

