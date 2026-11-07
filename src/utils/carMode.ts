/** Opens / closes the phone's "Modo coche" screen (<CarModeView/>) */
export const CAR_MODE_EVENT = 'spotifree:car-mode';

export function openCarMode(open = true) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CAR_MODE_EVENT, { detail: { open } }));
}
