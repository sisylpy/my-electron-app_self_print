/**
 * 将渲染进程日志发到 Electron 主进程写入 userData/logs/
 * 非 Electron 环境（纯浏览器）静默跳过。
 */

/**
 * @param {'error'|'warn'|'info'|'debug'} level
 * @param {string} tag 模块标记，如 vue / renderer / api
 * @param {string} message
 * @param {Record<string, unknown>|undefined} meta
 */
export function writeAppLog(level, tag, message, meta) {
  if (typeof window === 'undefined') return;
  const api = window.electronAPI;
  if (!api || typeof api.writeAppLog !== 'function') return;
  try {
    api.writeAppLog(level, tag, message, meta);
  } catch {
    /* 避免日志本身再抛错 */
  }
}

