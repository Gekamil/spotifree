import React, { useState, useEffect } from 'react';
import { useStatsStore } from '../../store/useStatsStore';

export const WrappedModal: React.FC = () => {
  const {
    isWrappedOpen,
    closeWrapped,
    totalSeconds,
    audioPersonality,
    getTopArtists,
    getTopTracks,
  } = useStatsStore();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const SLIDE_DURATION = 6500; // 6.5s per story
  const TOTAL_SLIDES = 5;

  const topArtists = getTopArtists(5);
  const topTracks = getTopTracks(5);

  const topArtist = topArtists[0] || {
    name: 'Romeo Santos',
    image: 'https://i.scdn.co/image/ab6761610000e5eb56e6d183815f9bca1b4a9296',
    minutes: 426,
    plays: 142,
  };

  const topSong = topTracks[0] || {
    name: 'Rain',
    artist: 'Trueno',
    image: 'https://i.scdn.co/image/ab67616d000048512fda43dd98cc1cad8b908d9f',
    plays: 38,
  };

  const totalMinutes = Math.max(1420, Math.floor(totalSeconds / 60));
  const totalHours = (totalMinutes / 60).toFixed(1);

  // Auto-advance stories
  useEffect(() => {
    if (!isWrappedOpen || isPaused) return;

    const timer = setTimeout(() => {
      if (currentSlide < TOTAL_SLIDES - 1) {
        setCurrentSlide((s) => s + 1);
      } else {
        closeWrapped();
      }
    }, SLIDE_DURATION);

    return () => clearTimeout(timer);
  }, [isWrappedOpen, currentSlide, isPaused, closeWrapped]);

  // Reset slide on open
  useEffect(() => {
    if (isWrappedOpen) {
      setCurrentSlide(0);
    }
  }, [isWrappedOpen]);

  if (!isWrappedOpen) return null;

  const handlePrev = () => {
    setCurrentSlide((s) => Math.max(0, s - 1));
  };

  const handleNext = () => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setCurrentSlide((s) => s + 1);
    } else {
      closeWrapped();
    }
  };

  const gradients = [
    'from-[#5018f0] via-[#9c18a0] to-[#121212]',
    'from-[#e91429] via-[#ba5d07] to-[#121212]',
    'from-[#1db954] via-[#0d73ec] to-[#121212]',
    'from-[#7358ff] via-[#e8115b] to-[#121212]',
    'from-[#ba5d07] via-[#148a08] to-[#121212]',
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center select-none animate-in fade-in duration-300">
      {/* Phone-aspect Container */}
      <div
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        className={`relative w-full max-w-[420px] h-[92vh] max-h-[820px] rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-b ${gradients[currentSlide]} border border-white/10 flex flex-col justify-between p-6 transition-all duration-700`}
      >
        {/* Ambient Bloom Background Glow */}
        <div className="absolute inset-0 bg-radial-gradient pointer-events-none opacity-40 blur-2xl" />

        {/* Top Progress Bars */}
        <div className="relative z-20 flex gap-1.5 pt-2">
          {Array.from({ length: TOTAL_SLIDES }).map((_, idx) => (
            <div key={idx} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className={`h-full bg-white transition-all ${
                  idx < currentSlide
                    ? 'w-full'
                    : idx === currentSlide && !isPaused
                    ? 'w-full duration-[6500ms] ease-linear'
                    : 'w-0'
                }`}
              />
            </div>
          ))}
        </div>

        {/* Top Bar: Spotify Logo & Close */}
        <div className="relative z-20 flex items-center justify-between pt-3">
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-sm tracking-wider font-['SpotifyMixUITitle'] uppercase">
              SPOTIFREE WRAPPED
            </span>
            <span className="text-xs bg-white/20 text-white font-bold px-2 py-0.5 rounded-full">
              2026
            </span>
          </div>
          <button
            onClick={closeWrapped}
            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/80 text-white flex items-center justify-center transition-transform hover:scale-110 active:scale-95 cursor-pointer"
            title="Cerrar"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.47 1.47a.75.75 0 0 1 1.06 0L8 6.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L9.06 8l5.47 5.47a.75.75 0 1 1-1.06 1.06L8 9.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L6.94 8 1.47 2.53a.75.75 0 0 1 0-1.06" />
            </svg>
          </button>
        </div>

        {/* Story Slide Content */}
        <div className="relative z-20 flex-1 flex flex-col justify-center my-6">
          {/* SLIDE 0: Minutos Escuchados */}
          {currentSlide === 0 && (
            <div className="space-y-6 text-center animate-in zoom-in-95 duration-500">
              <span className="text-sm font-bold uppercase tracking-widest text-white/80">
                Tu tiempo en música
              </span>
              <h2 className="text-6xl md:text-7xl font-black text-white tracking-tight drop-shadow-lg font-['SpotifyMixUITitle']">
                {totalMinutes.toLocaleString()}
              </h2>
              <p className="text-2xl font-bold text-white/90">
                minutos escuchados este año
              </p>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/10 text-left space-y-2 mt-8">
                <p className="text-white font-semibold text-sm">
                  🎧 Eso equivale a más de <strong className="text-[#1ed760] font-black">{totalHours} horas</strong> de canciones sin interrupciones.
                </p>
                <p className="text-xs text-white/70">
                  Has descubierto nuevos ritmos y acompañado cada momento con tu banda sonora favorita.
                </p>
              </div>
            </div>
          )}

          {/* SLIDE 1: Artista #1 */}
          {currentSlide === 1 && (
            <div className="space-y-6 text-center animate-in zoom-in-95 duration-500">
              <span className="text-sm font-bold uppercase tracking-widest text-[#1ed760]">
                Tu Artista Número 1
              </span>
              <div className="relative w-44 h-44 mx-auto rounded-full p-1 bg-gradient-to-tr from-[#1ed760] to-yellow-400 shadow-2xl">
                <img
                  src={topArtist.image}
                  alt={topArtist.name}
                  className="w-full h-full object-cover rounded-full shadow-inner"
                />
                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-[#1ed760] text-black font-black text-sm flex items-center justify-center shadow-lg">
                  #1
                </div>
              </div>
              <div>
                <h2 className="text-4xl font-black text-white tracking-tight font-['SpotifyMixUITitle']">
                  {topArtist.name}
                </h2>
                <p className="text-sm text-white/80 mt-1 font-medium">
                  {Math.floor(topArtist.minutes)} minutos juntos
                </p>
              </div>
              <div className="bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10">
                <p className="text-xs text-white/90 leading-relaxed font-semibold">
                  👑 Estuviste en el <span className="text-[#1ed760] font-black">top 1%</span> de sus mayores oyentes en todo el mundo.
                </p>
              </div>
            </div>
          )}

          {/* SLIDE 2: Top 5 Artistas */}
          {currentSlide === 2 && (
            <div className="space-y-4 animate-in zoom-in-95 duration-500">
              <span className="text-xs font-bold uppercase tracking-widest text-white/70 text-center block">
                Tus Artistas Principales
              </span>
              <h2 className="text-3xl font-black text-white text-center font-['SpotifyMixUITitle']">
                El Top 5 que definió tu año
              </h2>
              <div className="space-y-2.5 mt-4">
                {topArtists.map((a, i) => (
                  <div
                    key={a.id || i}
                    className="flex items-center gap-3.5 bg-white/10 backdrop-blur-md p-2.5 rounded-xl border border-white/10"
                  >
                    <span className="text-lg font-black text-[#1ed760] w-6 text-center">
                      #{i + 1}
                    </span>
                    <img
                      src={a.image}
                      alt={a.name}
                      className="w-11 h-11 rounded-full object-cover shadow"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{a.name}</p>
                      <p className="text-xs text-white/60">{Math.floor(a.minutes)} min</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SLIDE 3: Canción del Año */}
          {currentSlide === 3 && (
            <div className="space-y-6 text-center animate-in zoom-in-95 duration-500">
              <span className="text-xs font-bold uppercase tracking-widest text-white/70">
                Tu Canción Más Escuchada
              </span>
              <div className="relative w-48 h-48 mx-auto rounded-2xl overflow-hidden shadow-2xl bg-[#242424] border-2 border-white/20">
                <img
                  src={topSong.image}
                  alt={topSong.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white font-['SpotifyMixUITitle'] truncate">
                  {topSong.name}
                </h2>
                <p className="text-base text-white/80 font-semibold mt-1">
                  {topSong.artist}
                </p>
                <p className="text-xs text-[#1ed760] font-bold mt-2">
                  Reproducida {topSong.plays} veces
                </p>
              </div>
            </div>
          )}

          {/* SLIDE 4: Personalidad Musical */}
          {currentSlide === 4 && (
            <div className="space-y-6 text-center animate-in zoom-in-95 duration-500">
              <span className="text-xs font-bold uppercase tracking-widest text-white/70">
                Tu Aura Musical
              </span>
              <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-tr from-emerald-400 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl animate-pulse">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="white">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
              <div>
                <h2 className="text-4xl font-black text-white font-['SpotifyMixUITitle']">
                  {audioPersonality}
                </h2>
                <p className="text-sm text-white/80 mt-3 leading-relaxed max-w-[280px] mx-auto">
                  Tu energía musical no se conforma: combinas los ritmos latinos y urbanos con un flow auténtico y vibrante.
                </p>
              </div>
              <button
                onClick={closeWrapped}
                className="w-full py-3.5 rounded-full bg-white hover:bg-[#1ed760] text-black font-black text-sm uppercase tracking-wider transition-colors shadow-xl mt-4 cursor-pointer"
              >
                Volver a Spotifree
              </button>
            </div>
          )}
        </div>

        {/* Tap areas for prev / next */}
        <div
          onClick={handlePrev}
          className="absolute left-0 top-16 bottom-16 w-1/3 cursor-pointer z-10"
          title="Anterior"
        />
        <div
          onClick={handleNext}
          className="absolute right-0 top-16 bottom-16 w-1/3 cursor-pointer z-10"
          title="Siguiente"
        />

        {/* Bottom indicator hint */}
        <div className="relative z-20 text-center">
          <span className="text-[11px] text-white/50">
            Toca a los lados para avanzar o mantén pulsado para pausar
          </span>
        </div>
      </div>
    </div>
  );
};
