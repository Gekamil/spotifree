import { useEffect, useState } from 'react';
import type { Track } from '../../types/spotify';
import { usePlayerStore } from '../../store/usePlayerStore';
import { audioEngine, getSourceOverride, setSourceOverride, type SourceCandidate } from '../../services/audioEngine';
import { AUDIO_SOURCE_EVENT } from '../../utils/audioSourceSheet';
import { showGlobalToast } from '../../utils/globalToast';
import { useLanguageStore } from '../../utils/i18n';
import { useIsMobile } from '../../utils/useIsMobile';

const fmt = (sec: number) => {
  if (!sec || !isFinite(sec)) return '–:––';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * "Cambiar fuente de audio": every upload of the song found on YouTube Music, best first, with
 * which one is playing. Picking one plays it from the same second and remembers it for the
 * song; "Automática" goes back to the app's choice.
 */
export default function AudioSourceSheet() {
  const [track, setTrack] = useState<Track | null>(null);
  const [cands, setCands] = useState<SourceCandidate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [override, setOverride] = useState<string | null>(null);
  const en = useLanguageStore((s) => s.language) === 'en';
  const isMobile = useIsMobile();
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const t = (e as CustomEvent).detail?.track as Track | undefined;
      if (!t) return;
      setTrack(t);
      setCands(null);
      setOverride(getSourceOverride(t.id));
      audioEngine.fetchSourceCandidates(t).then(setCands);
    };
    window.addEventListener(AUDIO_SOURCE_EVENT, onOpen);
    return () => window.removeEventListener(AUDIO_SOURCE_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!track) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setTrack(null);
    const onBack = (e: Event) => {
      (e as CustomEvent).detail?.setHandled?.();
      setTrack(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('spotifree_android_back', onBack);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('spotifree_android_back', onBack);
    };
  }, [track]);

  if (!track) return null;

  const isCurrent = Boolean(currentTrack && currentTrack.id === track.id);
  const playingId = isCurrent ? audioEngine.getActiveVideoInfo()?.videoId || null : null;
  const spDur = (track.duration_ms || 0) / 1000;

  const choose = async (videoId: string | null) => {
    setBusy(videoId || 'auto');
    try {
      if (videoId === null) {
        setSourceOverride(track.id, null);
        setOverride(null);
        if (isCurrent) {
          const best = (cands || []).find((c) => c.match)?.videoId;
          if (best && best !== playingId) await audioEngine.switchSource(best, { reason: 'automática' });
        }
        showGlobalToast(en ? 'Audio source: automatic' : 'Fuente de audio: automática');
      } else {
        setSourceOverride(track.id, videoId);
        setOverride(videoId);
        if (isCurrent) await audioEngine.switchSource(videoId, { manual: true, reason: 'elegida a mano' });
        showGlobalToast(en ? 'Audio source changed' : 'Fuente de audio cambiada');
      }
      setTrack(null);
    } finally {
      setBusy(null);
    }
  };

  const Row = ({ c }: { c: SourceCandidate }) => {
    const playing = playingId === c.videoId;
    const chosen = override === c.videoId;
    const diff = spDur && c.durationSec ? c.durationSec - spDur : 0;
    return (
      <button
        onClick={() => choose(c.videoId)}
        disabled={Boolean(busy)}
        className={`w-full flex items-center gap-3 rounded-md p-2 text-left transition-colors ${
          playing ? 'bg-white/10' : 'hover:bg-white/[0.07] active:bg-white/10'
        } disabled:opacity-60`}
      >
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-[#282828]">
          <img
            src={`https://i.ytimg.com/vi/${c.videoId}/mqdefault.jpg`}
            alt=""
            className="h-full w-full object-cover"
          />
          {playing && (
            <div className="absolute inset-0 flex items-end justify-center gap-[2px] bg-black/50 pb-2">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-[3px] rounded-sm bg-[#1ed760] animate-pulse" style={{ height: 6 + i * 4, animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[15px] font-medium ${playing ? 'text-[#1ed760]' : 'text-white'}`}>{c.title || c.videoId}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[#b3b3b3]">
            <span
              className={`shrink-0 rounded-[3px] px-1 py-px text-[10px] font-bold uppercase tracking-wide ${
                c.kind === 'audio' ? 'bg-[#1ed760] text-black' : 'bg-[#535353] text-white'
              }`}
            >
              {c.kind === 'audio' ? (en ? 'Audio only' : 'Solo audio') : en ? 'Video' : 'Vídeo'}
            </span>
            <span className="truncate">{c.artist.replace(/^(Canción|Song|Vídeo|Video)\s*•\s*/i, '')}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[13px] tabular-nums text-[#b3b3b3]">{fmt(c.durationSec)}</p>
          {!c.match ? (
            <p className="text-[11px] font-semibold text-[#f3727f]">{en ? 'Does not match' : 'No coincide'}</p>
          ) : Math.abs(diff) > 4 ? (
            <p className="text-[11px] text-[#b3b3b3]">{diff > 0 ? '+' : '−'}{Math.round(Math.abs(diff))} s</p>
          ) : chosen ? (
            <p className="text-[11px] font-semibold text-[#1ed760]">{en ? 'Chosen' : 'Elegida'}</p>
          ) : null}
        </div>
      </button>
    );
  };

  const list = cands || [];
  const sheet = (
    <div
      translate="no"
      className={
        isMobile
          ? 'w-full max-h-[82vh] rounded-t-2xl bg-[#1f1f1f] pb-[calc(env(safe-area-inset-bottom,0px)+12px)] animate-slide-up-modal'
          : 'w-[480px] max-h-[78vh] rounded-lg bg-[#282828] shadow-[0_16px_48px_rgba(0,0,0,.6)]'
      }
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      {isMobile && <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-white/25" />}
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-bold text-white">{en ? 'Audio source' : 'Fuente de audio'}</h2>
          <p className="mt-0.5 truncate text-[14px] text-[#b3b3b3]">
            {track.name} · {track.artists?.map((a) => a.name).join(', ')} · {fmt(spDur)}
          </p>
        </div>
        <button
          onClick={() => setTrack(null)}
          aria-label={en ? 'Close' : 'Cerrar'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#b3b3b3] hover:bg-white/10 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 1 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06" />
          </svg>
        </button>
      </div>

      <div className="overflow-y-auto px-3 pb-3" style={{ maxHeight: isMobile ? 'calc(82vh - 90px)' : 'calc(78vh - 90px)' }}>
        <button
          onClick={() => choose(null)}
          disabled={Boolean(busy)}
          className="mb-2 flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-white/[0.07] active:bg-white/10 disabled:opacity-60"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[#1ed760] text-black">
            <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5.75.75 0 0 1 1.5 0 8 8 0 1 1-2.343-5.657V1.25a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5h1.832A6.48 6.48 0 0 0 8 1.5" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-white">{en ? 'Automatic (recommended)' : 'Automática (recomendada)'}</p>
            <p className="text-[13px] text-[#b3b3b3]">
              {en ? 'Audio-only upload with the same length as on Spotify' : 'La subida solo audio con la misma duración que en Spotify'}
            </p>
          </div>
          {!override && (
            <svg width="18" height="18" viewBox="0 0 16 16" fill="#1ed760" className="shrink-0">
              <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
            </svg>
          )}
        </button>

        <p className="px-2 pb-1 text-[12px] font-bold uppercase tracking-wider text-[#b3b3b3]">
          {en ? 'Uploads found' : 'Subidas encontradas'}
        </p>
        {cands === null ? (
          <div className="space-y-2 p-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-12 w-12 animate-pulse rounded bg-white/10" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="px-2 py-6 text-center text-[14px] text-[#b3b3b3]">
            {en ? 'No other uploads of this song were found.' : 'No se han encontrado otras subidas de esta canción.'}
          </p>
        ) : (
          list.map((c) => <Row key={c.videoId} c={c} />)
        )}
        {busy && (
          <p className="px-2 pt-2 text-center text-[13px] text-[#b3b3b3]">{en ? 'Changing…' : 'Cambiando…'}</p>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={`fixed inset-0 z-[2500] bg-black/60 ${isMobile ? 'flex items-end' : 'flex items-center justify-center'}`}
      onClick={() => setTrack(null)}
    >
      {sheet}
    </div>
  );
}
