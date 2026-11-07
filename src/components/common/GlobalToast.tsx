import { useEffect, useState } from 'react';
import { GLOBAL_TOAST_EVENT } from '../../utils/globalToast';

/** Spotify-style notice pill, centered above the player. Fed by showGlobalToast(). */
export default function GlobalToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: number | undefined;
    let clearTimer: number | undefined;
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
      setMsg(String(detail.message || ''));
      setVisible(true);
      hideTimer = window.setTimeout(() => setVisible(false), Number(detail.durationMs) || 2800);
      clearTimer = window.setTimeout(() => setMsg(null), (Number(detail.durationMs) || 2800) + 300);
    };
    window.addEventListener(GLOBAL_TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(GLOBAL_TOAST_EVENT, onToast);
      window.clearTimeout(hideTimer);
      window.clearTimeout(clearTimer);
    };
  }, []);

  if (!msg) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 z-[3000] -translate-x-1/2 px-4 transition-all duration-300 pointer-events-none ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 140px)' }}
    >
      <div className="max-w-[92vw] rounded-lg bg-[#2a2a2a] px-4 py-3 text-center text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,.5)]">
        {msg}
      </div>
    </div>
  );
}
