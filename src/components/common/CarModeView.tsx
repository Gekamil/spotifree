import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { audioEngine } from '../../services/audioEngine';
import { fetchTrackCanvas } from '../../services/spotifyApi';
import { fetchLyricsUnified, parseEnhancedLyrics, type SyncedLine } from '../../utils/lyricsService';
import { useLanguageStore } from '../../utils/i18n';
import { CAR_MODE_EVENT } from '../../utils/carMode';
import type { Track } from '../../types/spotify';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const I = {
  close: 'M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 1 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06',
  play: 'M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288z',
  pause: 'M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z',
  next: 'M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z',
  prev: 'M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7z',
  shuffle: 'M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z M7.5 10.723l.98-1.167.957 1.14a2.25 2.25 0 0 0 1.724.804h1.947l-1.017-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.109 13H11.16a3.75 3.75 0 0 1-2.873-1.34l-.787-.938z',
  repeat: 'M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75z',
  heart: 'M1.69 2A4.582 4.582 0 0 1 8 2.023 4.583 4.583 0 0 1 11.88.817h.002a4.618 4.618 0 0 1 3.782 3.65v.003a4.543 4.543 0 0 1-1.011 3.84L9.35 14.629a1.765 1.765 0 0 1-2.093.464 1.762 1.762 0 0 1-.605-.463L1.348 8.309A4.582 4.582 0 0 1 1.689 2z',
  heartLine: 'M5.21 1.57a6.757 6.757 0 0 1 6.708 1.545.124.124 0 0 0 .165 0 6.741 6.741 0 0 1 5.715-1.78l.004.001a6.802 6.802 0 0 1 5.571 5.376v.003a6.689 6.689 0 0 1-1.49 5.655l-7.954 9.48a2.518 2.518 0 0 1-3.857 0L2.12 12.37A6.683 6.683 0 0 1 .627 6.714 6.757 6.757 0 0 1 5.21 1.57zm3.12 1.803a4.757 4.757 0 0 0-5.74 3.725l-.001.002a4.684 4.684 0 0 0 1.049 3.972l.003.003 7.958 9.48a.518.518 0 0 0 .793 0l7.955-9.479a4.688 4.688 0 0 0 1.049-3.972 4.803 4.803 0 0 0-3.931-3.79 4.74 4.74 0 0 0-4.023 1.256l-.008.008a2.123 2.123 0 0 1-2.9 0l-.007-.007a4.757 4.757 0 0 0-2.197-1.198z',
};
const Icon = ({ d, size = 24, view = 16 }: { d: string; size?: number; view?: number }) => (
  <svg width={size} height={size} viewBox={`0 0 ${view} ${view}`} fill="currentColor">
    <path d={d} />
  </svg>
);

type Panel = 'lyrics' | 'queue' | 'lists';

/**
 * "Modo coche": the phone as a car screen. Canvas video (or the cover) behind, very large
 * controls, and a side panel with Lyrics / Queue / your playlists. Landscape: panel on the
 * right; portrait: below. Keeps the screen on while open.
 */
export default function CarModeView() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = (e: Event) => setOpen((e as CustomEvent).detail?.open !== false);
    window.addEventListener(CAR_MODE_EVENT, onOpen);
    return () => window.removeEventListener(CAR_MODE_EVENT, onOpen);
  }, []);
  // The screen (and its subscription to the player) only exists while open
  return open ? <CarModeScreen onClose={() => setOpen(false)} /> : null;
}

function CarModeScreen({ onClose }: { onClose: () => void }) {
  const [panel, setPanel] = useState<Panel>('lyrics');
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [lines, setLines] = useState<SyncedLine[]>([]);
  const [plain, setPlain] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [landscape, setLandscape] = useState(() => typeof window !== 'undefined' && window.innerWidth > window.innerHeight);
  const en = useLanguageStore((s) => s.language) === 'en';
  const p = usePlayerStore();
  const playlists = useSpotifyDataStore((s) => s.playlists);
  const t = p.currentTrack;
  const lyricsRef = useRef<HTMLDivElement | null>(null);
  const wakeRef = useRef<any>(null);

  useEffect(() => {
    const onResize = () => setLandscape(window.innerWidth > window.innerHeight);
    const tick = window.setInterval(() => setClock(new Date()), 15000);
    const onBack = (e: Event) => {
      (e as CustomEvent).detail?.setHandled?.();
      onClose();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('spotifree_android_back', onBack);
    try {
      (navigator as any).wakeLock?.request?.('screen').then((s: any) => (wakeRef.current = s)).catch(() => {});
    } catch {}
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('spotifree_android_back', onBack);
      try {
        wakeRef.current?.release?.();
      } catch {}
      wakeRef.current = null;
    };
  }, []);

  // Canvas + lyrics of the current song
  useEffect(() => {
    if (!t) return;
    let cancelled = false;
    setCanvasUrl(null);
    setLines([]);
    setPlain(null);
    fetchTrackCanvas(t.id, t.name, t.artists?.[0]?.name)
      .then((u) => !cancelled && setCanvasUrl(u))
      .catch(() => {});
    fetchLyricsUnified(t.name, t.artists?.[0]?.name || '', (t.duration_ms || 0) / 1000)
      .then((r) => {
        if (cancelled) return;
        const parsed = r.syncedLyrics ? parseEnhancedLyrics(r.syncedLyrics).filter((l) => l.text?.trim()) : [];
        setLines(parsed);
        setPlain(parsed.length ? null : r.plainLyrics || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [t?.id]);

  const activeLine = useMemo(() => {
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].timeMs <= p.progressMs + 250) idx = i;
      else break;
    }
    return idx;
  }, [lines, p.progressMs]);

  useEffect(() => {
    const box = lyricsRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-line="${activeLine}"]`);
    if (box && el) box.scrollTo({ top: el.offsetTop - box.clientHeight * 0.38, behavior: 'smooth' });
  }, [activeLine, panel]);

  const liked = Boolean(t && (p.likedTrackIds || []).includes(t.id));
  const cover = t?.album?.images?.[0]?.url || '';
  const dur = p.durationMs || t?.duration_ms || 0;
  const pct = dur ? Math.min(100, (p.progressMs / dur) * 100) : 0;
  const upcoming: Track[] = p.getUpcomingTracks?.(25) || [];
  const quickLists = (playlists || []).filter((x) => (x.tracks?.items?.length || 0) > 0).slice(0, 12);
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const ms = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * dur;
    audioEngine.seek(ms / 1000);
    p.setProgress(ms);
  };
  const playList = (id: string) => {
    const pl = playlists.find((x) => x.id === id);
    const items = ((pl?.tracks?.items || []) as any[]).map((x) => x?.track || x).filter((x: any) => x?.id);
    if (items[0]) p.playTrack(items[0], items, id);
  };

  const tabs: { id: Panel; label: string }[] = [
    { id: 'lyrics', label: en ? 'Lyrics' : 'Letra' },
    { id: 'queue', label: en ? 'Up next' : 'A continuación' },
    { id: 'lists', label: en ? 'Playlists' : 'Playlists' },
  ];

  const controls = (
    <div className="flex items-center justify-between gap-1 w-full max-w-[560px]">
      <button onClick={() => p.toggleShuffle()} aria-label="Shuffle" className={`h-10 w-10 sm:h-14 sm:w-14 shrink-0 grid place-items-center rounded-full ${p.isShuffle ? 'text-[#1ed760]' : 'text-white/80'}`}>
        <Icon d={I.shuffle} size={28} />
      </button>
      <button onClick={() => p.previousTrack()} aria-label="Previous" className="h-12 w-12 sm:h-[72px] sm:w-[72px] shrink-0 grid place-items-center rounded-full bg-white/10 active:scale-95 text-white">
        <Icon d={I.prev} size={30} />
      </button>
      <button onClick={() => p.togglePlay()} aria-label="Play" className="h-[72px] w-[72px] sm:h-[104px] sm:w-[104px] shrink-0 grid place-items-center rounded-full bg-[#1ed760] text-black active:scale-95 shadow-[0_8px_30px_rgba(30,215,96,.35)]">
        <Icon d={p.isPlaying ? I.pause : I.play} size={44} />
      </button>
      <button onClick={() => p.nextTrack()} aria-label="Next" className="h-12 w-12 sm:h-[72px] sm:w-[72px] shrink-0 grid place-items-center rounded-full bg-white/10 active:scale-95 text-white">
        <Icon d={I.next} size={30} />
      </button>
      <button onClick={() => p.toggleRepeat()} aria-label="Repeat" className={`relative h-10 w-10 sm:h-14 sm:w-14 shrink-0 grid place-items-center rounded-full ${p.repeatMode !== 'off' ? 'text-[#1ed760]' : 'text-white/80'}`}>
        <Icon d={I.repeat} size={28} />
        {p.repeatMode === 'one' && <span className="absolute top-2 right-2 text-[10px] font-bold">1</span>}
      </button>
    </div>
  );

  const side = (
    <div className={`flex flex-col min-h-0 min-w-0 w-full rounded-2xl bg-black/45 backdrop-blur-md ${landscape ? 'h-full' : 'flex-1'}`}>
      <div className="flex gap-2 p-3 pb-2 overflow-x-auto no-scrollbar shrink-0">
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setPanel(x.id)}
            className={`px-4 py-2 rounded-full text-[15px] font-bold whitespace-nowrap shrink-0 ${panel === x.id ? 'bg-white text-black' : 'bg-white/10 text-white'}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div ref={lyricsRef} className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 relative">
        {panel === 'lyrics' &&
          (lines.length ? (
            <div className="py-2 space-y-3">
              {lines.map((l, i) => (
                <p
                  key={i}
                  data-line={i}
                  onClick={() => {
                    audioEngine.seek(l.timeMs / 1000);
                    p.setProgress(l.timeMs);
                  }}
                  className={`text-[22px] sm:text-[24px] leading-tight font-bold break-words transition-colors cursor-pointer ${
                    i === activeLine ? 'text-white' : i < activeLine ? 'text-white/45' : 'text-white/30'
                  }`}
                >
                  {l.text}
                </p>
              ))}
            </div>
          ) : plain ? (
            <p className="whitespace-pre-line text-[20px] leading-snug font-bold text-white/80 py-2">{plain}</p>
          ) : (
            <p className="text-white/60 text-[16px] py-6">{en ? 'No lyrics for this song.' : 'Esta canción no tiene letra disponible.'}</p>
          ))}
        {panel === 'queue' &&
          (upcoming.length ? (
            upcoming.map((x, i) => (
              <button
                key={`${x.id}-${i}`}
                onClick={() => p.playTrack(x, p.queue, p.currentContextId || undefined)}
                className="w-full flex items-center gap-3 py-2 text-left active:bg-white/10 rounded-lg"
              >
                <img src={x.album?.images?.[0]?.url || ''} alt="" className="h-14 w-14 rounded-md object-cover bg-white/10 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-bold text-white">{x.name}</p>
                  <p className="truncate text-[15px] text-white/60">{x.artists?.map((a) => a.name).join(', ')}</p>
                </div>
              </button>
            ))
          ) : (
            <p className="text-white/60 text-[16px] py-6">{en ? 'Nothing up next.' : 'No hay nada a continuación.'}</p>
          ))}
        {panel === 'lists' && (
          <div className="grid grid-cols-2 gap-3 py-2">
            {quickLists.map((pl) => (
              <button key={pl.id} onClick={() => playList(pl.id)} className="flex items-center gap-3 rounded-lg bg-white/10 active:bg-white/20 overflow-hidden text-left">
                <img src={pl.images?.[0]?.url || ''} alt="" className="h-16 w-16 object-cover shrink-0 bg-white/10" />
                <span className="text-[15px] font-bold text-white line-clamp-2 pr-2">{pl.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div translate="no" className="fixed inset-0 z-[2800] bg-black text-white overflow-hidden select-none" style={{ fontFamily: 'SpotifyMixUI, sans-serif' }}>
      {/* Background: Canvas video, or the cover blurred */}
      {canvasUrl ? (
        <video key={canvasUrl} src={canvasUrl} autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        cover && <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover scale-125 blur-3xl opacity-60" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/85" />

      <div
        className={`relative h-full flex ${landscape ? 'flex-row gap-6' : 'flex-col gap-4'} p-4 sm:p-5`}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        <div className={`flex flex-col ${landscape ? 'flex-[1.25] min-w-0' : 'shrink-0'}`}>
          <div className="flex items-center justify-between">
            <button onClick={onClose} aria-label={en ? 'Close' : 'Cerrar'} className="h-12 w-12 grid place-items-center rounded-full bg-black/40">
              <Icon d={I.close} size={20} />
            </button>
            <span className="text-[13px] font-bold uppercase tracking-[.18em] text-white/80">{en ? 'Car mode' : 'Modo coche'}</span>
            <span className="text-[22px] font-bold tabular-nums min-w-12 text-right pr-1">
              {clock.getHours()}:{String(clock.getMinutes()).padStart(2, '0')}
            </span>
          </div>

          <div className={`flex ${landscape ? 'flex-1 items-center' : 'items-center mt-5'} gap-3 sm:gap-5 min-h-0`}>
            {!canvasUrl && cover && (
              <img src={cover} alt="" className={`${landscape ? 'h-[min(34vh,220px)] w-[min(34vh,220px)]' : 'h-20 w-20 sm:h-28 sm:w-28'} rounded-xl object-cover shadow-2xl shrink-0`} />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[clamp(24px,5vw,46px)] font-bold leading-tight line-clamp-2 break-words">{t?.name || 'Spotifree'}</p>
              <p className="text-[clamp(18px,2.6vw,24px)] text-white/75 truncate mt-1">{t?.artists?.map((a) => a.name).join(', ')}</p>
              {lines[activeLine] && panel !== 'lyrics' && (
                <p className="text-[20px] text-[#1ed760] font-bold mt-2 line-clamp-2">♪ {lines[activeLine].text}</p>
              )}
            </div>
            <button
              onClick={() => t && p.toggleLike(t.id, t)}
              aria-label={en ? 'Like' : 'Me gusta'}
              className={`h-12 w-12 sm:h-14 sm:w-14 grid place-items-center rounded-full shrink-0 ${liked ? 'text-[#1ed760]' : 'text-white'}`}
            >
              {liked ? <Icon d={I.heart} size={30} /> : <Icon d={I.heartLine} size={30} view={24} />}
            </button>
          </div>

          <div className="mt-5">
            <div className="h-10 flex items-center cursor-pointer" onPointerDown={seek}>
              <div className="relative h-2 w-full rounded-full bg-white/25">
                <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${pct}%` }} />
                <div className="absolute top-1/2 h-5 w-5 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow" style={{ left: `${pct}%` }} />
              </div>
            </div>
            <div className="flex justify-between text-[14px] text-white/70 tabular-nums -mt-1">
              <span>{fmt(p.progressMs)}</span>
              <span>{fmt(dur)}</span>
            </div>
          </div>
          <div className="mt-4 flex justify-center">{controls}</div>
        </div>

        <div className={landscape ? 'flex-1 min-w-0 min-h-0' : 'flex-1 min-h-0 min-w-0 flex'}>{side}</div>
      </div>
    </div>
  );
}
