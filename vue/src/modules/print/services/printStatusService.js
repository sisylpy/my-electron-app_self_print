export function subscribePrintJobStatus(callback) {
    if (typeof callback !== 'function') {
        throw new TypeError('打印状态监听器必须是函数');
    }
    const subscribe = window.electronAPI?.onPrintJobStatus;
    if (typeof subscribe !== 'function') {
        return () => {};
    }
    return subscribe((status) => {
        if (!status || typeof status !== 'object') return;
        callback({
            jobId: String(status.jobId || ''),
            label: String(status.label || '打印任务'),
            state: ['printing', 'success', 'failed'].includes(status.state)
                ? status.state
                : 'failed',
            message: String(status.message || ''),
            retryable: Boolean(status.retryable),
            timestamp: status.timestamp || new Date().toISOString()
        });
    });
}

