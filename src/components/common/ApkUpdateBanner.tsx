import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

/**
 * APK only: the app's screens come from the web (always up to date), but widgets, the car and
 * other native parts only change by installing the new APK. When GitHub has a newer APK than the
 * installed one, this offers it (once per version).
 *  - Installed build: versionName = commit it was built from (scripts/setup-android-native.mjs).
 *    Older APKs say "1.0": they are always older than the published one.
 *  - Published build: "native: <sha>" in the android-latest release notes.
 */
const DISMISS_KEY = 'spotifree_apk_update_dismissed';

export const ApkUpdateBanner: React.FC = () => {
  const [latest, setLatest] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
    let alive = true;
    (async () => {
      try {
        const [info, res] = await Promise.all([
          CapApp.getInfo(),
          fetch('https://api.github.com/repos/Gekamil/spotifree/releases/tags/android-latest', { headers: { Accept: 'application/vnd.github+json' } }),
        ]);
        if (!res.ok) return;
        const rel = await res.json();
        const published = (/native:\s*([0-9a-f]{7,40})/i.exec(rel?.body || '') || [])[1]?.slice(0, 7);
        const installed = String(info?.version || '').trim();
        if (!published || installed === published) return;
        if (localStorage.getItem(DISMISS_KEY) === published) return;
        if (alive) setLatest(published);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!latest) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, latest);
    } catch {}
    setClosing(true);
    setTimeout(() => setLatest(null), 220);
  };

  return (
    <div
      className={`fixed left-3 right-3 z-[90] font-['SpotifyMixUI'] transition-all duration-200 ${
        closing ? 'opacity-0 -translate-y-3' : 'opacity-100 translate-y-0 animate-in fade-in slide-in-from-top-3 duration-300'
      }`}
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 10px)' }}
      role="status"
    >
      <div className="flex items-center gap-3 rounded-xl bg-[#2a2a2a] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
        <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-white leading-tight">Nueva versión de la app</p>
          <p className="text-[12px] text-[#b3b3b3] leading-snug">Incluye los widgets nuevos y mejoras para tu móvil.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            window.open('https://spotifreeweb.vercel.app/instalar.html', '_blank');
            close();
          }}
          className="px-3.5 py-2 rounded-full bg-white text-black text-[13px] font-bold active:scale-95 transition-transform shrink-0 cursor-pointer"
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Ahora no"
          className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-[#a7a7a7] active:bg-white/10 shrink-0 cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 0 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
