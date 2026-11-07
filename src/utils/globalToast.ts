/** App-wide short notice ("toast"), shown by <GlobalToast/>. Usable from services too. */
export const GLOBAL_TOAST_EVENT = 'spotifree:toast';

export function showGlobalToast(message: string, durationMs = 2800) {
  if (typeof window === 'undefined' || !message) return;
  window.dispatchEvent(new CustomEvent(GLOBAL_TOAST_EVENT, { detail: { message, durationMs } }));
}
