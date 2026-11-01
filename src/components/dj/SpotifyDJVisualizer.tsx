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
  // Compute acoustic scale and glow based on state & real voice level
  const acousticScale = state === 'speaking'
    ? 1 + Math.min(voiceLevel, 1) * 0.18
    : state === 'listening'
    ? 1.05
    : state === 'playing'
    ? 1.02
    : 1;

  const glowOpacity = state === 'speaking'
    ? 0.75 + Math.min(voiceLevel, 1) * 0.25
    : state === 'listening'
    ? 0.8
    : state === 'playing'
    ? 0.55
    : 0.35;

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center select-none cursor-pointer transition-transform duration-300 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* 1. Deep Ambient Aura Glow */}
      <div
        className="absolute inset-0 rounded-full blur-[55px] pointer-events-none transition-all duration-500"
        style={{
          background: state === 'listening'
            ? 'radial-gradient(circle, rgba(0,242,254,0.65) 0%, rgba(13,114,234,0.3) 60%, transparent 80%)'
            : state === 'speaking'
            ? 'radial-gradient(circle, rgba(0,242,254,0.55) 0%, rgba(30,215,96,0.45) 50%, rgba(13,114,234,0.2) 80%, transparent 100%)'
            : 'radial-gradient(circle, rgba(0,210,196,0.35) 0%, rgba(30,215,96,0.25) 50%, transparent 80%)',
          opacity: glowOpacity,
          transform: `scale(${acousticScale * 1.2})`,
        }}
      />

      {/* 2. Concentric Acoustic Rings (Active when speaking, listening, or playing) */}
      {(state === 'speaking' || state === 'listening' || state === 'playing') && (
        <>
          <div
            className="absolute rounded-full border border-[#00f2fe]/20 pointer-events-none transition-all duration-300"
            style={{
              width: size * 1.15,
              height: size * 1.15,
              transform: `scale(${acousticScale})`,
              opacity: state === 'speaking' ? 0.6 + voiceLevel * 0.4 : 0.4,
            }}
          />
          <div
            className="absolute rounded-full border border-[#1ed760]/15 pointer-events-none transition-all duration-500"
            style={{
              width: size * 1.32,
              height: size * 1.32,
              transform: `scale(${acousticScale * 1.04})`,
              opacity: state === 'speaking' ? 0.4 + voiceLevel * 0.3 : 0.2,
            }}
          />
        </>
      )}

      {/* 3. The Official Spotify Liquid DJ Morphing Orb */}
      <div
        className="relative rounded-full transition-transform duration-150 ease-out flex items-center justify-center overflow-hidden"
        style={{
          width: size * 0.72,
          height: size * 0.72,
          transform: `scale(${acousticScale})`,
          boxShadow: state === 'listening'
            ? '0 0 35px rgba(0,242,254,0.7), inset 0 0 25px rgba(255,255,255,0.4)'
            : state === 'speaking'
            ? '0 0 45px rgba(0,242,254,0.5), 0 0 25px rgba(30,215,96,0.4), inset 0 0 20px rgba(255,255,255,0.35)'
            : '0 0 25px rgba(0,210,196,0.3), inset 0 0 15px rgba(255,255,255,0.2)',
        }}
      >
        {/* Organic Morphing Gradient Blob */}
        <div
          className="absolute inset-0 transition-all duration-1000"
          style={{
            background: 'linear-gradient(135deg, #00f2fe 0%, #0d72ea 40%, #1ed760 75%, #059669 100%)',
            borderRadius: '43% 57% 65% 35% / 48% 45% 55% 52%',
            animation: state === 'speaking'
              ? 'djMorph 4s ease-in-out infinite alternate, djSpin 12s linear infinite'
              : 'djMorph 8s ease-in-out infinite alternate, djSpin 24s linear infinite',
          }}
        />

        {/* 3D Specular Highlight / Glossy Glass Layer */}
        <div
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.1) 40%, transparent 65%)',
          }}
        />

        {/* Dynamic Center Graphic: DJ Icon Monogram */}
        <div className="relative z-10 flex flex-col items-center justify-center text-black pointer-events-none">
          <span className="text-xl md:text-2xl font-black tracking-wider uppercase drop-shadow-sm font-['SpotifyMixUITitle']">
            DJ
          </span>
          {state === 'speaking' && (
            <div className="flex items-center gap-1 mt-1">
              <span className="w-1 h-3 bg-black rounded-full animate-pulse" />
              <span className="w-1 h-4 bg-black rounded-full animate-pulse delay-75" />
              <span className="w-1 h-2 bg-black rounded-full animate-pulse delay-150" />
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes djMorph {
          0% {
            border-radius: 43% 57% 65% 35% / 48% 45% 55% 52%;
          }
          33% {
            border-radius: 58% 42% 40% 60% / 55% 35% 65% 45%;
          }
          66% {
            border-radius: 35% 65% 58% 42% / 42% 62% 38% 58%;
          }
          100% {
            border-radius: 52% 48% 35% 65% / 60% 40% 60% 40%;
          }
        }
        @keyframes djSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};
