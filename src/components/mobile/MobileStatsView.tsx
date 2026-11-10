import React, { useEffect, useMemo, useState } from 'react';
import { useStatsStore } from '../../store/useStatsStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import { handleImageError } from '../../utils/imageFallback';
import type { Track } from '../../types/spotify';
import { useLanguageStore } from '../../utils/i18n';

interface MobileStatsViewProps {
  onBack: () => void;
  onSelectArtist?: (artistName: string) => void;
}

const DAY_MS = 86400000;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const WEEKDAY = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

/** 75 min → "1 h 15 min"; 40 → "40 min" */
function fmtMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

const PARTS = [
  { label: 'Madrugada', en: 'Late night', from: 0, to: 6 },
  { label: 'Mañana', en: 'Morning', from: 6, to: 12 },
  { label: 'Tarde', en: 'Afternoon', from: 12, to: 20 },
  { label: 'Noche', en: 'Evening', from: 20, to: 24 },
];

/** "Estadísticas de escucha": what, how much and when this account listens (data of this device) */
export const MobileStatsView: React.FC<MobileStatsViewProps> = ({ onBack, onSelectArtist }) => {
  const { totalSeconds, totalTracksPlayed, audioPersonality, daily, hourly, getTopArtists, getTopTracks } = useStatsStore(
    useShallow((s) => ({
      totalSeconds: s.totalSeconds,
      totalTracksPlayed: s.totalTracksPlayed,
      audioPersonality: s.audioPersonality,
      daily: s.daily,
      hourly: s.hourly,
      getTopArtists: s.getTopArtists,
      getTopTracks: s.getTopTracks,
    }))
  );
  const en = useLanguageStore((s) => s.language) === 'en';
  const { playTrack, currentTrack, isPlaying } = usePlayerStore(
    useShallow((s) => ({ playTrack: s.playTrack, currentTrack: s.currentTrack, isPlaying: s.isPlaying }))
  );

  // Bars grow in after the first paint
  const [ready, setReady] = useState(false);
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 40);
    return () => clearTimeout(t);
  }, []);

  // Recomputed when the minute changes, not on every second of playback
  const minuteTick = Math.floor(totalSeconds / 60);
  const week = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today.getTime() - (6 - i) * DAY_MS);
      return { key: dayKey(d), label: WEEKDAY[d.getDay()], date: d, min: (daily?.[dayKey(d)] || 0) / 60 };
    });
    const prev = Array.from({ length: 7 }, (_, i) => (daily?.[dayKey(new Date(today.getTime() - (13 - i) * DAY_MS))] || 0) / 60);
    const total = days.reduce((a, d) => a + d.min, 0);
    const prevTotal = prev.reduce((a, b) => a + b, 0);
    const max = Math.max(1, ...days.map((d) => d.min));
    return { days, total, prevTotal, max };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minuteTick, daily]);

  const parts = useMemo(() => {
    const h = hourly || [];
    const list = PARTS.map((p) => ({ ...p, min: h.slice(p.from, p.to).reduce((a, b) => a + (b || 0), 0) / 60 }));
    const total = list.reduce((a, p) => a + p.min, 0);
    const top = total > 0 ? list.reduce((a, b) => (b.min > a.min ? b : a)) : null;
    return { list, total, top };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minuteTick, hourly]);

  const topArtists = useMemo(() => getTopArtists(10), [getTopArtists, totalTracksPlayed, minuteTick]);
  const topTracks = useMemo(() => getTopTracks(10), [getTopTracks, totalTracksPlayed]);
  const maxArtistMin = Math.max(1, ...topArtists.map((a) => a.minutes || 0));
  const maxTrackPlays = Math.max(1, ...topTracks.map((t) => t.plays || 0));

  const totalMinutes = totalSeconds / 60;
  const diff = week.prevTotal > 0 ? Math.round(((week.total - week.prevTotal) / week.prevTotal) * 100) : null;
  const hero = topArtists[0];

  const handleTrackClick = (trk: any) => {
    const trackObj: Track = {
      id: trk.id,
      name: trk.name,
      duration_ms: 180000,
      artists: [{ id: `art-${trk.artist}`, name: trk.artist }],
      album: { id: `alb-${trk.id}`, name: trk.name, images: [{ url: trk.image }] },
    };
    playTrack(trackObj);
  };

  const shown = pickedDay !== null ? week.days[pickedDay] : null;

  return (
    <div className="select-none min-h-full pb-28 bg-[#121212] font-['SpotifyMixUI'] text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 px-2 py-2 bg-[#121212]/90 backdrop-blur-md flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
          aria-label="Volver"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>
        <h1 className="text-[16px] font-bold tracking-tight">Estadísticas de escucha</h1>
      </div>

      <div className="px-4 pt-2 space-y-7">
        {/* Hero: this week */}
        <section
          className="relative overflow-hidden rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-2 duration-500"
          style={{ background: 'linear-gradient(135deg, #1ed760 0%, #0f7a37 45%, #0b2a17 100%)' }}
        >
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <p className="text-[12px] font-bold text-black/70 uppercase tracking-wider">Esta semana</p>
          <p className="mt-1 text-[40px] leading-none font-black tracking-tight text-black font-['SpotifyMixUITitle']">
            {fmtMinutes(week.total)}
          </p>
          <p className="mt-2 text-[13px] font-semibold text-black/75">
            {diff === null
              ? 'Escuchando música en Spotifree'
              : diff >= 0
              ? `▲ ${diff}% más que la semana pasada`
              : `▼ ${Math.abs(diff)}% menos que la semana pasada`}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { v: totalMinutes < 60 ? `${Math.round(totalMinutes)} min` : `${(totalMinutes / 60).toFixed(1).replace('.', ',')} h`, l: 'en total' },
              { v: String(totalTracksPlayed), l: en ? 'songs' : 'canciones' },
              { v: String(Object.keys(useStatsStore.getState().artists || {}).length), l: en ? 'artists' : 'artistas' },
            ].map((k) => (
              <div key={k.l} className="rounded-xl bg-black/25 backdrop-blur-sm px-3 py-2">
                <p className="text-[15px] font-black text-white truncate">{k.v}</p>
                <p className="text-[11px] text-white/70">{k.l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Last 7 days */}
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-[20px] font-bold tracking-tight font-['SpotifyMixUITitle']">Últimos 7 días</h2>
            <span className="text-[12px] text-[#a7a7a7] h-4">
              {shown ? `${shown.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}: ${fmtMinutes(shown.min)}` : 'Toca un día'}
            </span>
          </div>
          <div className="h-40 flex items-end gap-2 rounded-2xl bg-[#181818] px-3 pt-4 pb-2">
            {week.days.map((d, i) => {
              const isToday = i === 6;
              const pct = d.min > 0 ? Math.max(4, (d.min / week.max) * 100) : 2;
              const picked = pickedDay === i;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setPickedDay(picked ? null : i)}
                  className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 cursor-pointer"
                  aria-label={`${d.label}: ${fmtMinutes(d.min)}`}
                >
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-md transition-[height,background-color] duration-700 ease-out ${
                        picked ? 'bg-white' : isToday ? 'bg-[#1ed760]' : 'bg-[#3a3a3a]'
                      }`}
                      style={{ height: ready ? `${pct}%` : '0%', transitionDelay: `${i * 50}ms` }}
                    />
                  </div>
                  <span className={`text-[11px] font-bold ${isToday ? 'text-white' : 'text-[#a7a7a7]'}`}>{d.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* When you listen */}
        <section className="space-y-3">
          <h2 className="text-[20px] font-bold tracking-tight font-['SpotifyMixUITitle']">Cuándo escuchas</h2>
          <div className="rounded-2xl bg-[#181818] p-4 space-y-3">
            {parts.top ? (
              <p className="text-[14px]">
                {en ? 'Mostly in the ' : 'Sobre todo por la '}<span className="font-bold text-[#1ed760]" translate="no">{(en ? parts.top.en : parts.top.label).toLowerCase()}</span>
              </p>
            ) : (
              <p className="text-[13px] text-[#a7a7a7]">Escucha un poco y aquí verás tus horas favoritas.</p>
            )}
            {/* 24 h strip */}
            <div className="flex items-end gap-[2px] h-12">
              {(hourly || new Array(24).fill(0)).map((s, h) => {
                const max = Math.max(1, ...(hourly || [1]));
                return (
                  <div
                    key={h}
                    className="flex-1 rounded-sm bg-[#1ed760] transition-[height,opacity] duration-700 ease-out"
                    style={{ height: ready ? `${Math.max(6, (s / max) * 100)}%` : '0%', opacity: s > 0 ? 0.35 + 0.65 * (s / max) : 0.12 }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-[#727272]">
              <span>0 h</span>
              <span>6 h</span>
              <span>12 h</span>
              <span>18 h</span>
              <span>24 h</span>
            </div>
            {parts.total > 0 && (
              <div className="grid grid-cols-4 gap-2 pt-1">
                {parts.list.map((p) => (
                  <div key={p.label} className={`rounded-lg px-2 py-2 text-center ${parts.top?.label === p.label ? 'bg-[#1ed760]/15' : 'bg-white/[0.04]'}`}>
                    <p className="text-[11px] font-bold" translate="no">{en ? p.en : p.label}</p>
                    <p className="text-[10px] text-[#a7a7a7]">{Math.round((p.min / parts.total) * 100)}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Top artists */}
        <section className="space-y-3">
          <h2 className="text-[20px] font-bold tracking-tight font-['SpotifyMixUITitle']">Tus artistas más escuchados</h2>
          {!hero ? (
            <div className="py-6 px-4 bg-[#181818] rounded-2xl text-center text-[13px] text-[#a7a7a7]">Aún no hay suficientes datos de artistas.</div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSelectArtist?.(hero.name)}
                className="relative w-full h-44 rounded-2xl overflow-hidden text-left active:scale-[0.99] transition-transform cursor-pointer"
              >
                {hero.image ? (
                  <img src={hero.image} alt={hero.name} onError={handleImageError} className="absolute inset-0 w-full h-full object-cover scale-105" />
                ) : (
                  <div className="absolute inset-0 bg-[#2a2a2a]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                <div className="absolute left-4 bottom-4 right-4">
                  <p className="text-[12px] font-bold text-[#1ed760]">#1 · tu artista</p>
                  <p className="text-[28px] font-black leading-tight truncate font-['SpotifyMixUITitle']">{hero.name}</p>
                  <p className="text-[12px] text-white/80">
                    {fmtMinutes(hero.minutes || 0)} · {hero.plays} {hero.plays === 1 ? 'reproducción' : 'reproducciones'}
                  </p>
                </div>
              </button>
              <div className="space-y-1">
                {topArtists.slice(1).map((a, i) => (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => onSelectArtist?.(a.name)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg active:bg-white/[0.06] transition-colors text-left cursor-pointer"
                  >
                    <span className="w-5 text-center text-[13px] font-bold text-[#a7a7a7]">{i + 2}</span>
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-[#2a2a2a] shrink-0">
                      {a.image ? (
                        <img src={a.image} alt={a.name} onError={handleImageError} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold">{(a.name || 'A').charAt(0)}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-bold truncate">{a.name}</p>
                      <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#1ed760] transition-[width] duration-700 ease-out"
                          style={{ width: ready ? `${Math.max(4, ((a.minutes || 0) / maxArtistMin) * 100)}%` : '0%', transitionDelay: `${i * 40}ms` }}
                        />
                      </div>
                    </div>
                    <span className="text-[12px] text-[#a7a7a7] tabular-nums shrink-0">{fmtMinutes(a.minutes || 0)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Top tracks */}
        <section className="space-y-3">
          <h2 className="text-[20px] font-bold tracking-tight font-['SpotifyMixUITitle']">Tus canciones más escuchadas</h2>
          {topTracks.length === 0 ? (
            <div className="py-6 px-4 bg-[#181818] rounded-2xl text-center text-[13px] text-[#a7a7a7]">Aún no hay reproducciones registradas.</div>
          ) : (
            <div className="space-y-1">
              {topTracks.map((trk, idx) => {
                const isCurrentPlaying = isPlaying && currentTrack?.id === trk.id;
                return (
                  <button
                    key={trk.id}
                    type="button"
                    onClick={() => handleTrackClick(trk)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg active:bg-white/[0.06] transition-colors text-left cursor-pointer"
                  >
                    <span className={`w-5 text-center font-bold text-[13px] ${isCurrentPlaying ? 'text-[#1ed760]' : 'text-[#a7a7a7]'}`}>{idx + 1}</span>
                    <div className="w-12 h-12 rounded-[4px] overflow-hidden bg-[#2a2a2a] shrink-0">
                      {trk.image ? <img src={trk.image} alt={trk.name} onError={handleImageError} className="w-full h-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[15px] font-bold truncate ${isCurrentPlaying ? 'text-[#1ed760]' : ''}`}>{trk.name}</p>
                      <p className="text-[12.5px] text-[#a7a7a7] truncate">{trk.artist}</p>
                      <div className="mt-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-white/50 transition-[width] duration-700 ease-out"
                          style={{ width: ready ? `${Math.max(4, (trk.plays / maxTrackPlays) * 100)}%` : '0%' }}
                        />
                      </div>
                    </div>
                    <span className="text-[12px] text-[#a7a7a7] tabular-nums shrink-0">
                      {trk.plays} {trk.plays === 1 ? 'vez' : 'veces'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Personality */}
        <section className="rounded-2xl p-4 bg-[#181818] flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#1ed760]/15 text-[#1ed760] flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[#a7a7a7] uppercase tracking-wider">Tu personalidad de escucha</p>
            <p className="text-[17px] font-bold truncate">{audioPersonality || 'Oyente Musical'}</p>
          </div>
        </section>

        <p className="text-center text-[11px] text-[#727272] pb-2">Datos de lo que escuchas en este dispositivo</p>
      </div>
    </div>
  );
};
