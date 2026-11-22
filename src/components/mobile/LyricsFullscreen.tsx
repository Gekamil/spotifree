/**
 * Full-screen lyrics, like Spotify's: the song's colour fills the screen, the line being sung
 * stays in the middle and lights up word by word, tapping a line jumps there, and when you scroll
 * by hand it stops following for a moment (with a button to go back to the current line).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Track } from '../../types/spotify';
import { useKaraokeMode } from '../../utils/useKaraokeMode';
import { getSynchronizedLyricProgress } from '../../utils/lyricsService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { audioEngine } from '../../services/audioEngine';

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
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [dragLevel, setDragLevel] = useState<number | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const sliderRafId = useRef<number | null>(null);

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

  // Opening always starts following the song and pre-warms karaoke deck
  useEffect(() => {
    if (p.open) {
      setFollowing(true);
      if (p.track?.id) {
        void audioEngine.prepareKaraokeDeck(p.track);
      }
    }
  }, [p.open, p.track?.id]);

  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    if (sliderRafId.current) cancelAnimationFrame(sliderRafId.current);
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
    setDragLevel(newLevel);
    if (sliderRafId.current) {
      cancelAnimationFrame(sliderRafId.current);
    }
    sliderRafId.current = requestAnimationFrame(() => {
      void karaoke.setLevel(newLevel);
      sliderRafId.current = null;
    });
  };

  const handleSliderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingSlider(true);
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
    if (p.track) {
      void audioEngine.prepareKaraokeDeck(p.track);
    }
    updateSliderFromClientY(e.clientY);
  };

  const handleSliderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSlider) return;
    updateSliderFromClientY(e.clientY);
  };

  const handleSliderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingSlider(false);
    if (sliderRafId.current) {
      cancelAnimationFrame(sliderRafId.current);
      sliderRafId.current = null;
    }
    if (dragLevel !== null) {
      void karaoke.setLevel(dragLevel);
    }
    setDragLevel(null);
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
  };

  const handleToggleKaraoke = () => {
    if (!showKaraokeSlider || (karaoke.vocalLevel ?? 100) === 100 || !karaoke.active) {
      setShowKaraokeSlider(true);
      if (p.track) {
        void audioEngine.prepareKaraokeDeck(p.track);
      }
      void karaoke.setLevel(0);
      if (!karaoke.active) {
        void karaoke.toggle();
      }
    } else {
      setShowKaraokeSlider(false);
      void karaoke.setLevel(100);
      if (karaoke.active) {
        void karaoke.toggle();
      }
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
                  : line.text || (
                      <svg viewBox="0 0 16 16" width="22" height="22" fill="currentColor" className="inline-block opacity-60" aria-hidden="true">
                        <path d="M12 1v8.55A3.498 3.498 0 0 0 9.5 8C7.57 8 6 9.57 6 11.5S7.57 15 9.5 15 13 13.43 13 11.5V3h2V1h-3z" />
                      </svg>
                    )}
              </p>
            );
          })
        ) : p.plain ? (
          <div className="text-[22px] leading-[1.35] font-bold whitespace-pre-line -mt-[20vh]">{p.plain}</div>
        ) : (
          <p className="text-xl font-bold text-white/80 -mt-[16vh]">No hay letra disponible para esta canción.</p>
        )}
      </div>

      {/* Right-Side Floating Karaoke Microphone Button & Vertical Vocal Slider */}
      {karaoke.available && (
        <div
          className="fixed right-3.5 bottom-36 z-30 flex flex-col items-center select-none touch-none"
          style={{ marginBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
        >
          {/* Expanded Vertical Slider (Appears smoothly above the mic button when toggled) */}
          {showKaraokeSlider && (
            <div className="flex flex-col items-center mb-3 animate-in fade-in slide-in-from-bottom-3 duration-150">
              {/* Numeric Level Badge */}
              <div className="mb-2 px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md text-[11px] font-bold text-white tabular-nums border border-white/15 shadow-xl">
                {dragLevel !== null ? dragLevel : (karaoke.vocalLevel ?? 100)}%
              </div>
              {/* Vertical Pill Track */}
              <div
                ref={sliderRef}
                onPointerDown={handleSliderPointerDown}
                onPointerMove={handleSliderPointerMove}
                onPointerUp={handleSliderPointerUp}
                onPointerCancel={handleSliderPointerUp}
                className="w-10 h-40 bg-black/50 backdrop-blur-md rounded-full border border-white/20 p-1 flex flex-col justify-end relative overflow-hidden shadow-2xl cursor-pointer"
                aria-label="Volumen de voz / karaoke"
              >
                {/* Fill Bar */}
                <div
                  className="w-full bg-gradient-to-t from-[#1ed760] to-[#1db954] rounded-full relative flex items-start justify-center"
                  style={{
                    height: `${dragLevel !== null ? dragLevel : (karaoke.vocalLevel ?? 100)}%`,
                    transition: isDraggingSlider ? 'none' : 'height 0.12s cubic-bezier(0.2, 0, 0, 1)',
                  }}
                >
                  {/* Thumb pill */}
                  <div className="w-5 h-1.5 bg-white/90 rounded-full mt-1 shadow" />
                </div>
                {/* Bottom Icon */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none opacity-80 text-white">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Right-Side Microphone Toggle Button */}
          <button
            onClick={handleToggleKaraoke}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 active:scale-90 cursor-pointer ${
              karaoke.active || showKaraokeSlider
                ? 'bg-[#1ed760] text-black shadow-[0_0_20px_rgba(30,215,96,0.6)] scale-105'
                : 'bg-black/60 text-white border border-white/20 hover:bg-black/80'
            }`}
            title="Ajustar volumen de voz / karaoke"
            aria-label="Ajustar volumen de voz / karaoke"
          >
            {karaoke.switching ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
          </button>
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
