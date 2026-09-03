/**
 * Global Event Bus for Portly Toast Notifications
 */
export function triggerToast({ title, message, type = 'info', duration = 4000 }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('portly-toast', {
      detail: { id: Date.now() + Math.random(), title, message, type, duration },
    })
  );
}
