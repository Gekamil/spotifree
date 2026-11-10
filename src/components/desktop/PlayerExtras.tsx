/**
 * Two buttons of the computer's player bar, like Spotify's:
 *  - "Conectar a un dispositivo": where the sound comes out (the computer's audio outputs when the
 *    browser allows choosing them) and "Escuchar juntos".
 *  - "Abrir el Minirreproductor": a small always-on-top window with the song and its controls
 *    (Document Picture-in-Picture; Chrome and Edge).
 */
import React, { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { audioEngine } from '../../services/audioEngine';
import { getTrackCoverUrl } from '../../utils/trackCovers';
import { showGlobalToast } from '../../utils/globalToast';
import { DeviceNativeIcon, MiniplayerNativeIcon } from '../icons/SpotifyNativeIcons';

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------
const SINK_KEY = 'spotifree_audio_output';

function canChooseOutput(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).AudioContext !== 'undefined' && 'setSinkId' in (window as any).AudioContext.prototype;
}

async function applyOutput(deviceId: string): Promise<boolean> {
  try {
    const ctx: any = (audioEngine as any).audioContext;
    if (ctx?.setSinkId) await ctx.setSinkId(deviceId === 'default' ? '' : deviceId);
    for (const a of ((audioEngine as any).audios || []) as any[]) {
      if (a?.setSinkId) await a.setSinkId(deviceId === 'default' ? '' : deviceId).catch(() => {});
    }
    localStorage.setItem(SINK_KEY, deviceId);
    return true;
  } catch {
    return false;
  }
}

export const DevicePickerButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [current, setCurrent] = useState<string>(() => {
    try {
      return localStorage.getItem(SINK_KEY) || 'default';
    } catch {
      return 'default';
    }
  });
  const boxRef = useRef<HTMLDivElement>(null);
  const activeRightSidebar = useUIStore((s) => s.activeRightSidebar);

  useEffect(() => {
    if (!open) return;
    navigator.mediaDevices?.enumerateDevices?.()
      .then((list) => setOutputs(list.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'communications')))
      .catch(() => setOutputs([]));
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const choose = async (id: string, label: string) => {
    if (await applyOutput(id)) {
      setCurrent(id);
      showGlobalToast(`Sonando en: ${label}`);
    } else showGlobalToast('Este navegador no deja cambiar la salida de audio');
  };

  const others = outputs.filter((d) => d.deviceId !== 'default');
  const labelOf = (d: MediaDeviceInfo, i: number) => d.label || `Salida de audio ${i + 1}`;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`p-1 transition-colors ${open ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'}`}
        title="Conectar a un dispositivo"
        aria-expanded={open}
      >
        <DeviceNativeIcon size={16} className="currentColor" />
      </button>
      {open && (
        <div className="absolute bottom-10 right-1/2 translate-x-1/2 w-80 p-4 rounded-lg bg-[#282828] shadow-[0_16px_24px_rgba(0,0,0,0.3),0_6px_8px_rgba(0,0,0,0.2)] text-white z-50">
          <p className="text-base font-bold mb-3">Dispositivo actual</p>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-10 rounded-md bg-[#1ed760]/15 text-[#1ed760] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 3.75A2.75 2.75 0 0 1 2.75 1h10.5A2.75 2.75 0 0 1 16 3.75v6.5A2.75 2.75 0 0 1 13.25 13H8.75v1.5h2.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1 0-1.5h2.5V13h-4.5A2.75 2.75 0 0 1 0 10.25zM2.75 2.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1ed760]">Este ordenador</p>
              <p className="text-xs text-[#b3b3b3] truncate">
                {current === 'default' ? 'Salida predeterminada' : labelOf(others.find((d) => d.deviceId === current) || ({} as MediaDeviceInfo), 0)}
              </p>
            </div>
          </div>

          {canChooseOutput() && (
            <>
              <p className="text-sm font-bold mb-1.5">Salida de audio</p>
              <div className="space-y-0.5 mb-4 max-h-48 overflow-y-auto">
                {[{ deviceId: 'default', label: 'Predeterminada del sistema' } as MediaDeviceInfo, ...others].map((d, i) => (
                  <button
                    key={d.deviceId}
                    onClick={() => void choose(d.deviceId, d.deviceId === 'default' ? 'salida predeterminada' : labelOf(d, i - 1))}
                    className={`w-full flex items-center justify-between px-2 py-2 rounded hover:bg-white/10 text-left text-[13px] cursor-pointer ${
                      current === d.deviceId ? 'text-[#1ed760]' : 'text-white/90'
                    }`}
                  >
                    <span className="truncate">{d.deviceId === 'default' ? d.label : labelOf(d, i - 1)}</span>
                    {current === d.deviceId && (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="shrink-0">
                        <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
              {others.length > 0 && !others.some((d) => d.label) && (
                <p className="text-[11px] text-[#a7a7a7] -mt-3 mb-4">El navegador oculta los nombres de los altavoces hasta que das permiso de micrófono.</p>
              )}
            </>
          )}

          <button
            onClick={() => {
              setOpen(false);
              if (activeRightSidebar !== 'friends') useUIStore.getState().toggleRightSidebar('friends');
            }}
            className="w-full flex items-center gap-3 p-2 -mx-2 rounded hover:bg-white/10 text-left cursor-pointer"
          >
            <span className="w-10 h-10 rounded-md bg-white/10 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M6 0a4 4 0 1 0 0 8 4 4 0 0 0 0-8M3.5 4a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0M12 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5m-1 2.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0M0 13c0-2.21 2.686-4 6-4s6 1.79 6 4v1.5H0zm1.5 0h9c0-1.04-1.61-2.5-4.5-2.5S1.5 11.96 1.5 13" />
              </svg>
            </span>
            <span>
              <span className="block text-sm font-bold">Escuchar juntos</span>
              <span className="block text-xs text-[#b3b3b3]">Comparte el control con tus amigos</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

/** Restores the chosen audio output when the app starts */
export function restoreAudioOutput() {
  try {
    const id = localStorage.getItem(SINK_KEY);
    if (id && id !== 'default' && canChooseOutput()) void applyOutput(id);
  } catch {}
}

// ---------------------------------------------------------------------------
// Mini player (Document Picture-in-Picture)
// ---------------------------------------------------------------------------
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const MiniPlayerWindow: React.FC = () => {
  const { currentTrack, isPlaying, progressMs, durationMs, togglePlay, nextTrack, previousTrack, likedTrackIds, toggleLike } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      progressMs: s.progressMs,
      durationMs: s.durationMs,
      togglePlay: s.togglePlay,
      nextTrack: s.nextTrack,
      previousTrack: s.previousTrack,
      likedTrackIds: s.likedTrackIds,
      toggleLike: s.toggleLike,
    }))
  );
  if (!currentTrack) {
    return <div className="h-full flex items-center justify-center text-[#b3b3b3] text-sm">No suena nada</div>;
  }
  const cover = getTrackCoverUrl(currentTrack) || currentTrack.album?.images?.[0]?.url;
  const liked = likedTrackIds.includes(currentTrack.id);
  const pct = durationMs > 0 ? Math.min(100, (progressMs / durationMs) * 100) : 0;
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ms = ((e.clientX - r.left) / r.width) * durationMs;
    usePlayerStore.getState().setProgress(ms);
    audioEngine.seek(ms / 1000);
  };
  return (
    <div className="relative h-full w-full overflow-hidden select-none font-['SpotifyMixUI',sans-serif] text-white bg-[#121212]">
      {cover && <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <div className="absolute left-0 right-0 bottom-0 p-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold text-base truncate">{currentTrack.name}</p>
            <p className="text-sm text-white/70 truncate">{(currentTrack.artists || []).map((a) => a.name).join(', ')}</p>
          </div>
          <button onClick={() => toggleLike(currentTrack.id, currentTrack)} className="shrink-0 p-1 cursor-pointer" title={liked ? 'Quitar de Canciones que te gustan' : 'Guardar en Canciones que te gustan'}>
            {liked ? (
              <svg width="20" height="20" viewBox="0 0 16 16" fill="#1ed760"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m11.748-1.97a.75.75 0 0 0-1.06-1.06l-4.47 4.47-1.405-1.406a.75.75 0 1 0-1.061 1.06l2.466 2.467 5.53-5.53z" /></svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0" /><path d="M11.75 8a.75.75 0 0 1-.75.75H8.75V11a.75.75 0 0 1-1.5 0V8.75H5a.75.75 0 0 1 0-1.5h2.25V5a.75.75 0 0 1 1.5 0v2.25H11a.75.75 0 0 1 .75.75" /></svg>
            )}
          </button>
        </div>
        <div onClick={seek} className="mt-3 h-3 flex items-center cursor-pointer group">
          <div className="w-full h-1 rounded-full bg-white/30 overflow-hidden">
            <div className="h-full bg-white group-hover:bg-[#1ed760]" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex justify-between text-[11px] text-white/70 tabular-nums">
          <span>{fmt(progressMs)}</span>
          <span>{fmt(durationMs)}</span>
        </div>
        <div className="flex items-center justify-center gap-6 mt-1">
          <button onClick={previousTrack} className="p-1 cursor-pointer text-white/90 hover:text-white" title="Anterior">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7z" /></svg>
          </button>
          <button onClick={togglePlay} className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer" title={isPlaying ? 'Pausar' : 'Reproducir'}>
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" className="ml-0.5"><path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288z" /></svg>
            )}
          </button>
          <button onClick={nextTrack} className="p-1 cursor-pointer text-white/90 hover:text-white" title="Siguiente">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export const MiniPlayerButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const winRef = useRef<Window | null>(null);
  const rootRef = useRef<Root | null>(null);
  const supported = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

  useEffect(() => () => winRef.current?.close(), []);

  const open = async () => {
    if (winRef.current) {
      winRef.current.close();
      return;
    }
    if (!supported) {
      showGlobalToast('Tu navegador no admite el minirreproductor (usa Chrome o Edge)');
      return;
    }
    try {
      const pip: Window = await (window as any).documentPictureInPicture.requestWindow({ width: 320, height: 380 });
      const base = pip.document.createElement('base');
      base.href = window.location.origin + '/';
      pip.document.head.appendChild(base);
      pip.document.title = 'Spotifree';
      // The app's styles and fonts in the small window
      for (const ss of Array.from(document.styleSheets)) {
        try {
          const style = pip.document.createElement('style');
          style.textContent = Array.from(ss.cssRules).map((r) => r.cssText).join('\n');
          pip.document.head.appendChild(style);
        } catch {
          if (ss.href) {
            const link = pip.document.createElement('link');
            link.rel = 'stylesheet';
            link.href = ss.href;
            pip.document.head.appendChild(link);
          }
        }
      }
      pip.document.body.style.margin = '0';
      pip.document.body.style.background = '#121212';
      const mount = pip.document.createElement('div');
      mount.style.height = '100vh';
      pip.document.body.appendChild(mount);
      const root = createRoot(mount);
      root.render(<MiniPlayerWindow />);
      winRef.current = pip;
      rootRef.current = root;
      setIsOpen(true);
      pip.addEventListener('pagehide', () => {
        rootRef.current?.unmount();
        rootRef.current = null;
        winRef.current = null;
        setIsOpen(false);
      });
    } catch {
      showGlobalToast('No se ha podido abrir el minirreproductor');
    }
  };

  return (
    <button
      onClick={() => void open()}
      className={`transition-colors p-1 ${isOpen ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'}`}
      title={isOpen ? 'Cerrar el Minirreproductor' : 'Abrir el Minirreproductor'}
    >
      <MiniplayerNativeIcon size={16} className="currentColor" />
    </button>
  );
};
