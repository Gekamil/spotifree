import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioEngine } from '../../services/audioEngine';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useLanguageStore } from '../../utils/i18n';
import {
  EQ_BANDS,
  EQ_MAX,
  EQ_MIN,
  EQ_PRESETS,
  clampDb,
  detectPreset,
  loadEqBands,
  loadEqEnabled,
  loadEqPreset,
  saveEq,
} from '../../utils/eqSettings';

/**
 * Spotify-style equalizer: on/off switch, preset picker, a smooth curve with 6 draggable
 * points (60 Hz … 15 kHz, ±12 dB) and reset. Changes are applied to the audio engine live
 * and saved. Used by both the desktop and the mobile Settings.
 */
interface Props {
  variant?: 'desktop' | 'mobile';
}

const W = 600;
const H = 200;
const PAD_X = 36;
const PAD_Y = 18;

const xOf = (i: number) => PAD_X + (i * (W - PAD_X * 2)) / (EQ_BANDS.length - 1);
const yOf = (db: number) => PAD_Y + ((EQ_MAX - db) / (EQ_MAX - EQ_MIN)) * (H - PAD_Y * 2);

/** Smooth path through the points (monotone-ish Catmull-Rom → Bézier). */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (!pts.length) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t = 0.18;
    d += ` C ${p1.x + (p2.x - p0.x) * t} ${p1.y + (p2.y - p0.y) * t}, ${p2.x - (p3.x - p1.x) * t} ${p2.y - (p3.y - p1.y) * t}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export const SpotifyEqualizer: React.FC<Props> = ({ variant = 'desktop' }) => {
  const isEn = useLanguageStore((s) => s.language === 'en');
  const [enabled, setEnabled] = useState<boolean>(() => (typeof window !== 'undefined' ? loadEqEnabled() : true));
  const [values, setValues] = useState<number[]>(() => (typeof window !== 'undefined' ? loadEqBands() : EQ_BANDS.map(() => 0)));
  const [preset, setPreset] = useState<string>(() => (typeof window !== 'undefined' ? loadEqPreset() : 'flat'));
  const [active, setActive] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTrackId = usePlayerStore((s) => s.currentTrack?.id);
  const [processing, setProcessing] = useState(true);
  const chipsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setProcessing(audioEngine.isProcessingAudio());
  }, [isPlaying, currentTrackId]);

  // Keep the selected preset chip in view (mobile row scrolls horizontally)
  useEffect(() => {
    const row = chipsRef.current;
    const chip = row?.querySelector<HTMLElement>('[data-selected="true"]');
    if (row && chip) row.scrollTo({ left: Math.max(0, chip.offsetLeft - row.clientWidth / 2 + chip.clientWidth / 2), behavior: 'smooth' });
  }, [preset]);

  const apply = useCallback((vals: number[], on: boolean, pid: string) => {
    saveEq(vals, on, pid);
    try {
      audioEngine.applyEqualizerGains(on ? vals : vals.map(() => 0));
    } catch {}
  }, []);

  const setBand = useCallback(
    (i: number, db: number) => {
      setValues((prev) => {
        const next = [...prev];
        next[i] = clampDb(db);
        const pid = detectPreset(next);
        setPreset(pid);
        apply(next, true, pid);
        return next;
      });
      if (!enabled) setEnabled(true);
    },
    [apply, enabled]
  );

  const choosePreset = (id: string) => {
    const p = EQ_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    setValues([...p.values]);
    setEnabled(true);
    apply([...p.values], true, id);
  };

  const toggle = () => {
    const on = !enabled;
    setEnabled(on);
    apply(values, on, preset);
  };

  const reset = () => choosePreset('flat');

  // Pointer: grab the nearest band, then follow the finger/mouse vertically
  const dbFromEvent = (clientY: number) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r) return 0;
    const y = ((clientY - r.top) / r.height) * H;
    return EQ_MAX - ((y - PAD_Y) / (H - PAD_Y * 2)) * (EQ_MAX - EQ_MIN);
  };
  const bandFromEvent = (clientX: number) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r) return 0;
    const x = ((clientX - r.left) / r.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < EQ_BANDS.length; i++) {
      const d = Math.abs(xOf(i) - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const i = bandFromEvent(e.clientX);
    setActive(i);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setBand(i, dbFromEvent(e.clientY));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (active === null) return;
    setBand(active, dbFromEvent(e.clientY));
  };
  const endDrag = () => setActive(null);

  const pts = useMemo(() => values.map((v, i) => ({ x: xOf(i), y: yOf(v) })), [values]);
  const curve = useMemo(() => smoothPath(pts), [pts]);
  const area = `${curve} L ${pts[pts.length - 1].x} ${H - PAD_Y} L ${pts[0].x} ${H - PAD_Y} Z`;
  const presetName = (id: string) => {
    const p = EQ_PRESETS.find((x) => x.id === id);
    return p ? (isEn ? p.en : p.es) : isEn ? 'Custom' : 'Personalizado';
  };
  const isMobile = variant === 'mobile';
  const gradId = `eqFill-${variant}`;

  return (
    <section className="w-full select-none" translate="no">
      {/* Header row: title + switch, like Spotify's settings rows */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className={`${isMobile ? 'text-[15px]' : 'text-sm'} text-white font-medium`}>{isEn ? 'Equalizer' : 'Ecualizador'}</p>
          <p className="text-[13px] text-[#a7a7a7] mt-0.5 leading-snug">
            {isEn ? 'Adjust the sound to your taste or pick a preset.' : 'Ajusta el sonido a tu gusto o elige un ajuste predefinido.'}
          </p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          aria-label={isEn ? 'Equalizer' : 'Ecualizador'}
          onClick={toggle}
          className={`relative shrink-0 w-[42px] h-6 rounded-full transition-colors duration-200 cursor-pointer ${enabled ? 'bg-[#1ed760]' : 'bg-[#727272]'}`}
        >
          <span className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-black transition-transform duration-200 ${enabled ? 'translate-x-[18px]' : ''}`} />
        </button>
      </div>

      <div className={`mt-4 transition-opacity duration-200 ${enabled ? 'opacity-100' : 'opacity-40'}`}>
        {/* Preset + reset (desktop shows a dropdown, mobile uses chips under the graph) */}
        {!isMobile && (
          <div className="flex items-center justify-end gap-4 mb-3">
            <button onClick={reset} className="text-[13px] font-bold text-[#a7a7a7] hover:text-white transition-colors cursor-pointer">
              {isEn ? 'Reset' : 'Restablecer'}
            </button>
            <div className="relative">
              <select
                value={preset === 'custom' ? 'custom' : preset}
                onChange={(e) => e.target.value !== 'custom' && choosePreset(e.target.value)}
                className="appearance-none bg-[#2a2a2a] hover:bg-[#333] text-white text-[13px] font-medium pl-3 pr-9 py-2 rounded-[4px] outline-none cursor-pointer border border-transparent focus:border-white/30 min-w-[190px]"
              >
                {preset === 'custom' && <option value="custom">{presetName('custom')}</option>}
                {EQ_PRESETS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#282828]">
                    {isEn ? p.en : p.es}
                  </option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 16 16" fill="#fff">
                <path d="M14 6l-6 6-6-6h12z" />
              </svg>
            </div>
          </div>
        )}

        {/* Graph */}
        <div className="flex gap-2">
          <div className={`flex flex-col justify-between text-[11px] text-[#a7a7a7] tabular-nums shrink-0 text-right ${isMobile ? 'h-[190px]' : 'h-[200px]'} py-[10px]`}>
            <span>+12 dB</span>
            <span>0 dB</span>
            <span>-12 dB</span>
          </div>
          <div className="flex-1 min-w-0">
            <div
              ref={plotRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className={`relative w-full ${isMobile ? 'h-[190px]' : 'h-[200px]'} rounded-md bg-[#181818] touch-none cursor-pointer overflow-visible`}
            >
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1ed760" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#1ed760" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {[EQ_MAX, EQ_MAX / 2, 0, EQ_MIN / 2, EQ_MIN].map((db) => (
                  <line
                    key={db}
                    x1={0}
                    x2={W}
                    y1={yOf(db)}
                    y2={yOf(db)}
                    stroke="#fff"
                    strokeOpacity={db === 0 ? 0.22 : 0.07}
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {EQ_BANDS.map((_, i) => (
                  <line key={i} x1={xOf(i)} x2={xOf(i)} y1={PAD_Y} y2={H - PAD_Y} stroke="#fff" strokeOpacity={active === i ? 0.25 : 0.06} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                ))}
                <path d={area} fill={`url(#${gradId})`} />
                <path d={curve} fill="none" stroke={enabled ? '#1ed760' : '#b3b3b3'} strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              {/* Handles (HTML so they stay round at any width) */}
              {pts.map((p, i) => {
                const isActive = active === i;
                return (
                  <div
                    key={i}
                    role="slider"
                    tabIndex={0}
                    aria-label={EQ_BANDS[i].label}
                    aria-valuemin={EQ_MIN}
                    aria-valuemax={EQ_MAX}
                    aria-valuenow={values[i]}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        setBand(i, values[i] + 0.5);
                      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        setBand(i, values[i] - 0.5);
                      }
                    }}
                    onDoubleClick={() => setBand(i, 0)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 outline-none group"
                    style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` }}
                  >
                    <div
                      className={`rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.6)] transition-transform duration-100 ${
                        isMobile ? 'w-[18px] h-[18px]' : 'w-[14px] h-[14px]'
                      } ${isActive ? 'scale-125 ring-4 ring-[#1ed760]/35' : 'group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-white'}`}
                    />
                    {isActive && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-[#3e3e3e] text-white text-[11px] font-bold whitespace-nowrap shadow-lg pointer-events-none tabular-nums">
                        {values[i] > 0 ? '+' : ''}
                        {values[i]} dB
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="relative h-6 mt-1.5">
              {EQ_BANDS.map((b, i) => (
                <span
                  key={b.label}
                  className={`absolute -translate-x-1/2 text-[11px] tabular-nums transition-colors ${active === i ? 'text-white font-bold' : 'text-[#a7a7a7]'}`}
                  style={{ left: `${(xOf(i) / W) * 100}%` }}
                >
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: preset chips + reset */}
        {isMobile && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] text-[#a7a7a7]">{presetName(preset)}</span>
              <button onClick={reset} className="text-[13px] font-bold text-white/80 active:text-white cursor-pointer">
                {isEn ? 'Reset' : 'Restablecer'}
              </button>
            </div>
            <div ref={chipsRef} className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
              {EQ_PRESETS.map((p) => {
                const sel = preset === p.id;
                return (
                  <button
                    key={p.id}
                    data-selected={sel ? 'true' : undefined}
                    onClick={() => choosePreset(p.id)}
                    className={`shrink-0 h-8 px-3.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer ${
                      sel ? 'bg-[#1ed760] text-black' : 'bg-[#2a2a2a] text-white active:bg-[#3a3a3a]'
                    }`}
                  >
                    {isEn ? p.en : p.es}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!processing && enabled && (
          <p className="mt-3 text-[12px] text-[#a7a7a7] leading-snug flex gap-2">
            <svg className="shrink-0 mt-[1px]" width="14" height="14" viewBox="0 0 16 16" fill="#a7a7a7">
              <path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm7.25-3.25h1.5v1.5h-1.5v-1.5zm0 3h1.5v4.5h-1.5v-4.5z" />
            </svg>
            {isEn
              ? 'Applies to downloaded songs and direct audio. Songs streaming from the YouTube player can’t be processed by the browser, so they play unchanged.'
              : 'Se aplica a las canciones descargadas y al audio directo. Las que suenan desde el reproductor de YouTube no se pueden procesar en el navegador y suenan sin cambios.'}
          </p>
        )}
      </div>
    </section>
  );
};

export default SpotifyEqualizer;
