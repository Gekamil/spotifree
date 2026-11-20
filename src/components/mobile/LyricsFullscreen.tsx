/**
 * Full-screen lyrics, like Spotify's: the song's colour fills the screen, the line being sung
 * stays in the middle and lights up word by word, tapping a line jumps there, and when you scroll
 * by hand it stops following for a moment (with a button to go back to the current line).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Track } from '../../types/spotify';
import { useKaraokeMode } from '../../utils/useKaraokeMode';
import { KaraokeMicButton } from '../common/KaraokeMicButton';
import { getSynchronizedLyricProgress } from '../../utils/lyricsService';
import { usePlayerStore } from '../../store/usePlayerStore';

export interface LyricLine {
  timeMs: number;
  text: string;
  words: Array<{ timeMs: number; text: string }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  track?: Track | null;
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
  onPrevious?: () => void;
  onNext?: () => void;
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
  const karaoke = useKaraokeMode(p.track, p.open);

  const [showKaraokeSlider, setShowKaraokeSlider] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDraggingSlider = useRef(false);

  const previousTrack = usePlayerStore((s) => s.previousTrack);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const handlePrevious = p.onPrevious || previousTrack;
  const handleNext = p.onNext || nextTrack;

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
  const vocalMs = getSynchronizedLyricProgress(p.progressMs, p.durationMs);

  const updateSliderFromClientY = (clientY: number) => {
    const el = sliderRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relY = clientY - rect.top;
    const ratio = 1 - Math.max(0, Math.min(1, relY / rect.height));
    const newLevel = Math.round(ratio * 100);
    karaoke.setLevel(newLevel);
  };

  const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingSlider.current = true;
    try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
    updateSliderFromClientY(e.clientY);
  };

  const handleSliderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSlider.current) return;
    updateSliderFromClientY(e.clientY);
  };

  const handleSliderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingSlider.current = false;
    try { (e.target as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
  };

  const handleToggleKaraoke = () => {
    setShowKaraokeSlider((prev) => !prev);
    if (!karaoke.active && !showKaraokeSlider) {
      karaoke.toggle();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 h-[100dvh] max-h-[100dvh] w-full flex flex-col text-white z-[10050] overflow-hidden select-none animate-in fade-in duration-200"
      style={{
        backgroundColor: p.color,
        paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
      }}
      role="dialog"
      aria-label="Letra"
    >
      {/* Header: close + song + verified Karaoke toggle */}
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3 pb-2 shrink-0">
        <button
          onClick={p.onClose}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-full active:scale-90 transition-transform"
          aria-label="Cerrar letra"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M2.793 8.043a1 1 0 0 1 1.414 0L12 15.836l7.793-7.793a1 1 0 1 1 1.414 1.414L12 18.664 2.793 9.457a1 1 0 0 1 0-1.414z" />
          </svg>
        </button>
        {p.cover && <img src={p.cover} alt="" className="w-10 h-10 rounded object-cover shadow shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[15px] truncate">{p.title}</p>
          <p className="text-[13px] text-white/70 truncate">
            {p.artist}
            {karaoke.active && ` · Modo karaoke (${karaoke.vocalLevel}%)`}
          </p>
        </div>
        {karaoke.available && (
          <KaraokeMicButton
            compact
            active={karaoke.active || showKaraokeSlider}
            switching={karaoke.switching}
            onToggle={handleToggleKaraoke}
          />
        )}
      </div>

      {/* Lyrics */}
      <div
        ref={scrollRef}
        onScroll={userScrolled}
        className="flex-1 overflow-y-auto px-6 pt-[25vh] pb-[35vh] scrollbar-none relative"
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
                  isCurrent
                    ? karaoke.active
                      ? 'text-white drop-shadow-[0_2px_18px_rgba(255,255,255,0.75)]'
                      : 'text-white'
                    : isPast
                    ? 'text-white/55'
                    : 'text-black/55'
                }`}
              >
                {isCurrent && line.words.length > 0
                  ? line.words.map((w, wi) => (
                      <span
                        key={wi}
                        className={`transition-colors duration-150 ${
                          vocalMs >= w.timeMs
                            ? karaoke.active
                              ? 'text-[#1ed760] drop-shadow-[0_0_12px_rgba(30,215,96,0.65)]'
                              : 'text-white'
                            : karaoke.active
                            ? 'text-white/45'
                            : 'text-black/55'
                        }`}
                      >
                        {w.text}
                        {wi < line.words.length - 1 ? ' ' : ''}
                      </span>
                    ))
                  : line.text || '♪'}
              </p>
            );
          })
        ) : p.plain ? (
          <div className="text-[22px] leading-[1.35] font-bold whitespace-pre-line -mt-[20vh]">{p.plain}</div>
        ) : (
          <p className="text-xl font-bold text-white/80 -mt-[16vh]">No hay letra disponible para esta canción.</p>
        )}
      </div>

      {/* Spotify-style Vertical Karaoke Vocal Slider on right */}
      {karaoke.available && (showKaraokeSlider || karaoke.active) && (
        <div
          className="fixed right-3 bottom-36 z-30 flex flex-col items-center select-none touch-none animate-in fade-in slide-in-from-right-4 duration-200"
          style={{ marginBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
        >
          {/* Numeric Level Badge */}
          <div className="mb-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-bold text-white tabular-nums border border-white/10 shadow-lg">
            {karaoke.vocalLevel}%
          </div>
          {/* Vertical Pill Track */}
          <div
            ref={sliderRef}
            onPointerDown={handleSliderPointerDown}
            onPointerMove={handleSliderPointerMove}
            onPointerUp={handleSliderPointerUp}
            onPointerCancel={handleSliderPointerUp}
            className="w-10 h-44 bg-black/40 backdrop-blur-md rounded-full border border-white/20 p-1 flex flex-col justify-end relative overflow-hidden shadow-2xl cursor-pointer"
            aria-label="Volumen de voz / karaoke"
          >
            {/* Fill Bar */}
            <div
              className="w-full bg-gradient-to-t from-[#1ed760] to-[#1db954] rounded-full transition-all duration-75 relative flex items-start justify-center"
              style={{ height: `${karaoke.vocalLevel}%` }}
            >
              {/* Thumb pill */}
              <div className="w-5 h-1.5 bg-white/90 rounded-full mt-1 shadow" />
            </div>
            {/* Bottom Icon */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-80 text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Back to the current line */}
      {!following && p.lines.length > 0 && (
        <button
          onClick={() => setFollowing(true)}
          className="absolute left-1/2 -translate-x-1/2 bottom-[144px] px-4 py-2 rounded-full bg-white text-black text-[13px] font-bold shadow-lg active:scale-95 transition-transform z-20"
          style={{ marginBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        >
          Volver a la letra actual
        </button>
      )}

      {/* Bottom: progress + play/pause/prev/next controls */}
      <div
        className="shrink-0 z-20 px-6 pb-4 pt-3 flex flex-col gap-2"
        style={{
          background: `linear-gradient(to top, ${p.color} 85%, transparent)`,
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 24px)',
        }}
      >
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
        <div className="flex justify-between text-[11px] text-white/70 tabular-nums">
          <span>{fmt(p.progressMs)}</span>
          <span>{fmt(p.durationMs)}</span>
        </div>
        <div className="flex items-center justify-center gap-8 mt-1">
          <button
            onClick={handlePrevious}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-transform"
            aria-label="Canción anterior"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="m6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </svg>
          </button>
          <button
            onClick={p.onTogglePlay}
            className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg active:scale-95 transition-transform"
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
          <button
            onClick={handleNext}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-transform"
            aria-label="Siguiente canción"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zm10-12h2v12h-2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
