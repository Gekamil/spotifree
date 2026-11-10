import React, { useEffect, useState } from 'react';
import { create } from 'zustand';

interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  resolve: (ok: boolean) => void;
}

const useConfirmStore = create<{ req: ConfirmRequest | null }>(() => ({ req: null }));

/** Spotify-style confirmation ("¿Eliminar de Tu biblioteca?"): resolves true on confirm */
export function confirmDialog(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().req?.resolve(false);
    useConfirmStore.setState({ req: { ...opts, resolve } });
  });
}

/** Mounted once (App): shows the current confirmation */
export const ConfirmDialogHost: React.FC = () => {
  const req = useConfirmStore((s) => s.req);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!req) return;
    setClosing(false);
    // (Enter is left to the focused button: the confirm button has the focus when it opens, and
    // Enter on "Cancelar" must cancel, not delete)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;

  function finish(ok: boolean) {
    const r = useConfirmStore.getState().req;
    setClosing(true);
    setTimeout(() => {
      useConfirmStore.setState({ req: null });
      r?.resolve(ok);
    }, 150);
  }

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/70 font-['SpotifyMixUI'] transition-opacity duration-150 ${closing ? 'opacity-0' : 'opacity-100 animate-in fade-in'}`}
      onClick={() => finish(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={req.title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-[400px] rounded-xl bg-[#282828] p-6 text-white shadow-[0_16px_48px_rgba(0,0,0,0.6)] transition-transform duration-150 ${
          closing ? 'scale-95' : 'scale-100 animate-in zoom-in-95'
        }`}
      >
        <h2 className="text-[20px] font-bold leading-tight font-['SpotifyMixUITitle']">{req.title}</h2>
        {req.body && <p className="mt-2 text-[14px] text-[#b3b3b3] leading-snug">{req.body}</p>}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => finish(false)}
            className="h-10 px-5 rounded-full text-[15px] font-bold text-white hover:scale-[1.03] active:scale-95 transition-transform cursor-pointer"
          >
            {req.cancelLabel || 'Cancelar'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => finish(true)}
            className="h-10 px-6 rounded-full bg-[#1ed760] text-black text-[15px] font-bold hover:scale-[1.04] hover:bg-[#3be477] active:scale-95 transition-transform cursor-pointer"
          >
            {req.confirmLabel || 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
};
