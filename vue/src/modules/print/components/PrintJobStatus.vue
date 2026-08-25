<template>
    <transition name="print-status">
        <aside
                v-if="status"
                class="print-job-status"
                :class="`print-job-status--${status.state}`"
                role="status"
                aria-live="polite">
            <span class="print-job-status__indicator" aria-hidden="true"></span>
            <div class="print-job-status__content">
                <strong>{{ title }}</strong>
                <span>{{ status.message }}</span>
                <small v-if="status.state === 'failed' && status.retryable">
                    请检查打印机连接、缺纸或暂停状态后，从原页面重新打印。
                </small>
            </div>
            <button type="button" aria-label="关闭打印状态" @click="dismiss">×</button>
        </aside>
    </transition>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { subscribePrintJobStatus } from '../services/printStatusService';

const status = ref(null);
let cleanup = () => {};
let dismissTimer = null;

const title = computed(() => {
    if (status.value?.state === 'printing') return '正在打印';
    if (status.value?.state === 'success') return '打印已提交';
    return '打印未完成';
});

function dismiss() {
    status.value = null;
    if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
    }
}

function showStatus(nextStatus) {
    status.value = nextStatus;
    if (dismissTimer) clearTimeout(dismissTimer);
    const duration = nextStatus.state === 'failed' ? 12000 : 4000;
    dismissTimer = setTimeout(dismiss, duration);
}

onMounted(() => {
    cleanup = subscribePrintJobStatus(showStatus);
});

onBeforeUnmount(() => {
    cleanup();
    dismiss();
});
</script>

<style scoped>
.print-job-status {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 4000;
    display: grid;
    width: min(420px, calc(100vw - 48px));
    grid-template-columns: 10px minmax(0, 1fr) 24px;
    gap: 12px;
    align-items: start;
    padding: 16px;
    color: #17232d;
    background: #fff;
    border: 1px solid #dbe3e8;
    border-radius: 4px;
    box-shadow: 0 14px 36px rgba(28, 46, 58, 0.16);
}

.print-job-status__indicator {
    width: 8px;
    height: 8px;
    margin-top: 6px;
    background: #2f7d65;
    border-radius: 50%;
}

.print-job-status--failed .print-job-status__indicator {
    background: #c44d3e;
}

.print-job-status--printing .print-job-status__indicator {
    background: #b77a27;
}

.print-job-status__content {
    display: grid;
    gap: 4px;
}

.print-job-status__content strong {
    font-size: 14px;
}

.print-job-status__content span,
.print-job-status__content small {
    color: #5e6f79;
    font-size: 12px;
    line-height: 1.5;
}

.print-job-status button {
    padding: 0;
    color: #71808a;
    font-size: 20px;
    line-height: 20px;
    background: transparent;
    border: 0;
}

.print-status-enter-active,
.print-status-leave-active {
    transition: opacity 160ms ease, transform 160ms ease;
}

.print-status-enter-from,
.print-status-leave-to {
    opacity: 0;
    transform: translateY(8px);
}
</style>
