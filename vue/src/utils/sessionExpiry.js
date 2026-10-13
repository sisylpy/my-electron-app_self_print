export const ORDER_SESSION_EXPIRED_EVENT = 'grainprint:order-session-expired';

export function notifyOrderSessionExpired(source = 'unknown') {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(ORDER_SESSION_EXPIRED_EVENT, {
    detail: { source },
  }));
}
