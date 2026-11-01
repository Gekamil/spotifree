import React from 'react';

export type DJVisualizerState = 'idle' | 'speaking' | 'listening' | 'playing';

interface SpotifyDJVisualizerProps {
  state?: DJVisualizerState;
  voiceLevel?: number; // 0 to 1
  size?: number; // width/height in px
  onClick?: () => void;
  className?: string;
}

export const SpotifyDJVisualizer: React.FC<SpotifyDJVisualizerProps> = ({
  state = 'idle',
  voiceLevel = 0,
  size = 280,
  onClick,
  className = '',
}) => {
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';
  const isPlaying = state === 'playing';

  // Dynamic bar height multipliers for the 9-bar spectrum equalizer
  const barMultipliers = [0.45, 0.7, 0.9, 1.15, 1.3, 1.15, 0.9, 0.7, 0.45];

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center select-none cursor-pointer group transition-all duration-300 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* 1. Spotify Neon Ambient Glow Backdrop */}
      <div
        className="absolute inset-0 rounded-full blur-[60px] pointer-events-none transition-all duration-500"
        style={{
          background: isListening
            ? 'radial-gradient(circle, rgba(0,242,254,0.65) 0%, rgba(13,114,234,0.3) 60%, transparent 80%)'
            : isSpeaking
            ? 'radial-gradient(circle, rgba(30,215,96,0.6) 0%, rgba(0,242,254,0.5) 45%, rgba(13,114,234,0.2) 80%, transparent 100%)'
            : isPlaying
            ? 'radial-gradient(circle, rgba(30,215,96,0.35) 0%, rgba(0,210,196,0.2) 55%, transparent 80%)'
            : 'radial-gradient(circle, rgba(0,242,254,0.25) 0%, rgba(30,215,96,0.15) 50%, transparent 80%)',
          opacity: isSpeaking ? 0.9 : 0.6,
          transform: `scale(${1 + voiceLevel * 0.25})`,
        }}
      />

      {/* 2. Concentric Acoustic Wave Shockwaves */}
      {(isSpeaking || isListening) && (
        <>
          <div
            className="absolute rounded-full border border-[#1ed760]/25 pointer-events-none animate-ping"
            style={{
              width: size * 0.92,
              height: size * 0.92,
              animationDuration: isSpeaking ? '1.8s' : '2.4s',
            }}
          />
          <div
            className="absolute rounded-full border border-[#00f2fe]/20 pointer-events-none animate-pulse"
            style={{
              width: size * 1.1,
              height: size * 1.1,
            }}
          />
        </>
      )}

      {/* 3. Sleek Spotify DJ Deck Disc with Vinyl Texture & Metallic Ring */}
      <div
        className="relative rounded-full flex flex-col items-center justify-center border border-white/10 shadow-[0_15px_40px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300 group-hover:scale-105"
        style={{
          width: size * 0.78,
          height: size * 0.78,
          background: 'radial-gradient(circle at 50% 50%, #121820 0%, #0d1117 55%, #05070a 100%)',
          boxShadow: isSpeaking
            ? '0 0 35px rgba(30,215,96,0.35), 0 0 20px rgba(0,242,254,0.25), inset 0 0 25px rgba(255,255,255,0.06)'
            : isListening
            ? '0 0 30px rgba(0,242,254,0.5), inset 0 0 20px rgba(255,255,255,0.08)'
            : '0 10px 30px rgba(0,0,0,0.6), inset 0 0 15px rgba(255,255,255,0.04)',
        }}
      >
        {/* Vinyl Groove Rings */}
        <div className="absolute inset-2 rounded-full border border-white/[0.04] pointer-events-none" />
        <div className="absolute inset-6 rounded-full border border-white/[0.03] pointer-events-none" />
        <div className="absolute inset-10 rounded-full border border-white/[0.02] pointer-events-none" />

        {/* 3D Specular Light Sweep */}
        <div
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.02) 40%, transparent 60%)',
          }}
        />

        {/* DJ Monogram Badge */}
        <div className="relative z-10 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.08] border border-white/10 mb-3 shadow-inner">
          <span
            className="w-2 h-2 rounded-full transition-colors duration-300"
            style={{
              backgroundColor: isListening ? '#00f2fe' : isSpeaking ? '#1ed760' : '#1ed760',
              boxShadow: isSpeaking ? '0 0 8px #1ed760' : 'none',
            }}
          />
          <span className="text-xs font-black tracking-widest text-white uppercase font-['SpotifyMixUITitle']">
            DJ
          </span>
        </div>

        {/* 4. Live Reactive Audio Equalizer Spectrum (9 Bars) */}
        <div className="relative z-10 flex items-center justify-center gap-1.5 h-12 w-full px-8">
          {barMultipliers.map((mult, idx) => {
            // Compute animated height based on voiceLevel, state and index
            let height = 8;
            if (isSpeaking) {
              const pulse = Math.sin((idx + 1) * 1.5 + performance.now() * 0.008) * 0.5 + 0.5;
              height = Math.max(8, Math.min(42, (12 + voiceLevel * 32 * mult) * (0.6 + pulse * 0.4)));
            } else if (isListening) {
              height = 14 + Math.sin(idx * 0.8 + performance.now() * 0.005) * 8;
            } else if (isPlaying) {
              height = 10 + Math.sin(idx * 1.2 + performance.now() * 0.003) * 6;
            }

            return (
              <div
                key={idx}
                className="w-1.5 rounded-full transition-all duration-75"
                style={{
                  height: `${height}px`,
                  background: isListening
                    ? 'linear-gradient(to top, #00f2fe, #0d72ea)'
                    : isSpeaking
                    ? 'linear-gradient(to top, #1ed760, #00f2fe)'
                    : 'linear-gradient(to top, #555, #888)',
                  boxShadow: isSpeaking
                    ? '0 0 8px rgba(30,215,96,0.6)'
                    : isListening
                    ? '0 0 8px rgba(0,242,254,0.6)'
                    : 'none',
                }}
              />
            );
          })}
        </div>

        {/* Status Prompt */}
        <span className="relative z-10 text-[10px] font-bold tracking-wider text-[#a7a7a7] mt-3 uppercase">
          {isListening
            ? 'Escuchando...'
            : isSpeaking
            ? 'DJ Hablando'
            : isPlaying
            ? 'En reproducción'
            : 'Toca para hablar'}
        </span>
      </div>
    </div>
  );
};
