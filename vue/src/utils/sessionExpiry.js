export const ORDER_SESSION_EXPIRED_EVENT = 'grainprint:order-session-expired';

export function notifyOrderSessionExpired(source = 'unknown', context = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(ORDER_SESSION_EXPIRED_EVENT, {
    detail: {
      source,
      method: String(context?.method || '').toUpperCase(),
      url: String(context?.url || ''),
    },
  }));
}
