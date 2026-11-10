/**
 * Full-screen lyrics, like Spotify's: the song's colour fills the screen, the line being sung
 * stays in the middle and lights up word by word, tapping a line jumps there, and when you scroll
 * by hand it stops following for a moment (with a button to go back to the current line).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface LyricLine {
  timeMs: number;
  text: string;
  words: Array<{ timeMs: number; text: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  artist: string;
  cover?: string;
  color: string;
  lines: LyricLine[];
  plain?: string | null;
  activeIndex: number;
  progressMs: number;
  durationMs: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function LyricsFullscreen(p: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrolling = useRef(false);

  // Keep the current line in the middle (unless the user is reading on their own)
  useEffect(() => {
    if (!p.open || !following || p.activeIndex < 0) return;
    const box = scrollRef.current;
    const el = box?.querySelector(`[data-fl-line="${p.activeIndex}"]`) as HTMLElement | null;
    if (!box || !el) return;
    autoScrolling.current = true;
    box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight * 0.38), behavior: 'smooth' });
    const t = setTimeout(() => (autoScrolling.current = false), 600);
    return () => clearTimeout(t);
  }, [p.open, p.activeIndex, following]);

  // Opening always starts following the song
  useEffect(() => {
    if (p.open) setFollowing(true);
  }, [p.open]);

  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  // Escape closes (desktop / keyboards)
  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && p.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.open, p.onClose]);

  if (!p.open || typeof document === 'undefined') return null;

  const userScrolled = () => {
    if (autoScrolling.current) return;
    setFollowing(false);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setFollowing(true), 5000);
  };
  const percent = p.durationMs > 0 ? Math.min(100, (p.progressMs / p.durationMs) * 100) : 0;
  const vocalMs = p.progressMs + 220;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex flex-col text-white animate-in fade-in duration-200"
      style={{ backgroundColor: p.color, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      role="dialog"
      aria-label="Letra"
    >
      {/* Header: close + song */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2 shrink-0">
        <button onClick={p.onClose} className="p-2 -ml-2 rounded-full active:scale-90 transition-transform" aria-label="Cerrar letra">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.793 8.043a1 1 0 0 1 1.414 0L12 15.836l7.793-7.793a1 1 0 1 1 1.414 1.414L12 18.664 2.793 9.457a1 1 0 0 1 0-1.414z" />
          </svg>
        </button>
        {p.cover && <img src={p.cover} alt="" className="w-10 h-10 rounded object-cover shadow" />}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[15px] truncate">{p.title}</p>
          <p className="text-[13px] text-white/70 truncate">{p.artist}</p>
        </div>
      </div>

      {/* Lyrics */}
      <div
        ref={scrollRef}
        onScroll={userScrolled}
        className="flex-1 overflow-y-auto px-6 pt-[30vh] pb-[45vh] scrollbar-none relative"
        style={{ overscrollBehavior: 'contain' }}
      >
        {p.lines.length > 0 ? (
          p.lines.map((line, idx) => {
            const isCurrent = idx === p.activeIndex;
            const isPast = p.activeIndex >= 0 && idx < p.activeIndex;
            return (
              <p
                key={`fl-${idx}-${line.timeMs}`}
                data-fl-line={idx}
                onClick={() => {
                  p.onSeek(line.timeMs);
                  setFollowing(true);
                }}
                className={`text-[26px] leading-[1.25] font-bold mb-5 cursor-pointer transition-colors duration-200 ${
                  isCurrent ? 'text-white' : isPast ? 'text-white/55' : 'text-black/55'
                }`}
              >
                {isCurrent && line.words.length > 0
                  ? line.words.map((w, wi) => (
                      <span key={wi} className={`transition-colors duration-150 ${vocalMs >= w.timeMs ? 'text-white' : 'text-black/55'}`}>
                        {w.text}
                        {wi < line.words.length - 1 ? ' ' : ''}
                      </span>
                    ))
                  : line.text || '♪'}
              </p>
            );
          })
        ) : p.plain ? (
          <div className="text-[22px] leading-[1.35] font-bold whitespace-pre-line -mt-[24vh]">{p.plain}</div>
        ) : (
          <p className="text-xl font-bold text-white/80 -mt-[20vh]">No hay letra disponible para esta canción.</p>
        )}
      </div>

      {/* Back to the current line */}
      {!following && p.lines.length > 0 && (
        <button
          onClick={() => setFollowing(true)}
          className="absolute left-1/2 -translate-x-1/2 bottom-[132px] px-4 py-2 rounded-full bg-white text-black text-[13px] font-bold shadow-lg active:scale-95 transition-transform"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          Volver a la letra actual
        </button>
      )}

      {/* Bottom: progress + play/pause */}
      <div className="shrink-0 px-6 pb-6 pt-3" style={{ background: `linear-gradient(to top, ${p.color} 70%, transparent)` }}>
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={percent}
          onChange={(e) => p.onSeek((Number(e.target.value) / 100) * p.durationMs)}
          className="w-full h-1 accent-white cursor-pointer"
          aria-label="Progreso"
        />
        <div className="flex justify-between text-[11px] text-white/70 mt-1 tabular-nums">
          <span>{fmt(p.progressMs)}</span>
          <span>{fmt(p.durationMs)}</span>
        </div>
        <div className="flex justify-center mt-2">
          <button
            onClick={p.onTogglePlay}
            className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center active:scale-95 transition-transform"
            aria-label={p.isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {p.isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7H5.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7h-2.6z" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="ml-0.5">
                <path d="m7.05 3.606 13.49 7.788a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
