import React, { useEffect, useRef } from 'react';

export type DJVisualizerState = 'idle' | 'speaking' | 'listening' | 'playing';

interface SpotifyDJVisualizerProps {
  state?: DJVisualizerState;
  voiceLevel?: number; // 0 to 1
  size?: number; // width/height in px
  onClick?: () => void;
  className?: string;
  mini?: boolean; // For floating button icon
  themeColor?: string; // Dynamic track dominant color
}

function parseHexToRgb(hex?: string): [number, number, number] {
  if (!hex || !hex.startsWith('#')) return [30, 215, 96];
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 30,
      parseInt(clean[1] + clean[1], 16) || 215,
      parseInt(clean[2] + clean[2], 16) || 96,
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16) || 30,
    parseInt(clean.slice(2, 4), 16) || 215,
    parseInt(clean.slice(4, 6), 16) || 96,
  ];
}

export const SpotifyDJVisualizer: React.FC<SpotifyDJVisualizerProps> = ({
  state = 'idle',
  voiceLevel = 0,
  size = 260,
  onClick,
  className = '',
  mini = false,
  themeColor,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const voiceLevelRef = useRef(voiceLevel);
  const smoothedVoiceRef = useRef(0);
  const themeColorRef = useRef(themeColor);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    voiceLevelRef.current = voiceLevel;
  }, [voiceLevel]);

  useEffect(() => {
    themeColorRef.current = themeColor;
  }, [themeColor]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const baseRadius = size * (mini ? 0.35 : 0.33);
    const strokeWidth = Math.max(3.5, size * (mini ? 0.13 : 0.082));
    const numPoints = mini ? 70 : 160;
    const currentRgb: [number, number, number] = parseHexToRgb(themeColorRef.current || '#1ed760');

    const render = () => {
      const currentState = stateRef.current;
      const targetVoice = voiceLevelRef.current;

      const isSpeaking = currentState === 'speaking' || currentState === 'listening';
      const isPlaying = currentState === 'playing';

      // Speed of rotation & wave travel: faster when speaking or playing, gentle and slow when idle
      const speed = mini
        ? (isSpeaking ? 0.052 : isPlaying ? 0.038 : 0.022)
        : isSpeaking
        ? 0.042
        : isPlaying
        ? 0.026
        : 0.012;
      time += speed;

      // Exponential moving average damping for voice reactivity
      smoothedVoiceRef.current += (targetVoice - smoothedVoiceRef.current) * 0.16;
      const currentVoice = smoothedVoiceRef.current;

      // Frame-by-frame color interpolation for buttery smooth transitions
      const targetRgb = parseHexToRgb(themeColorRef.current || '#1ed760');
      currentRgb[0] += (targetRgb[0] - currentRgb[0]) * 0.04;
      currentRgb[1] += (targetRgb[1] - currentRgb[1]) * 0.04;
      currentRgb[2] += (targetRgb[2] - currentRgb[2]) * 0.04;
      const smoothColor = `rgb(${Math.round(currentRgb[0])}, ${Math.round(currentRgb[1])}, ${Math.round(currentRgb[2])})`;

      ctx.clearRect(0, 0, size, size);

      // Dynamic Pulsing & Organic Plasma Breathing
      let pulseScale: number;
      let bulgeBase: number;

      if (mini) {
        pulseScale = 1 + Math.sin(time * 2.2) * 0.075;
        bulgeBase = 2.5 * (size / 38);
      } else if (isSpeaking) {
        // High reactivity to speech syllables
        pulseScale = 1 + Math.sin(time * 2.2) * 0.025 + currentVoice * 0.14;
        bulgeBase = (1.8 + currentVoice * 3.5) * (size / 260);
      } else if (isPlaying) {
        // Music beat pulse simulation
        pulseScale = 1 + Math.sin(time * 1.9) * 0.035 + Math.sin(time * 3.8) * 0.015;
        bulgeBase = 2.0 * (size / 260);
      } else {
        // Calm resting idle breathing
        pulseScale = 1 + Math.sin(time * 1.2) * 0.018;
        bulgeBase = 1.2 * (size / 260);
      }

      ctx.save();
      ctx.beginPath();

      // Compute multi-harmonic organic liquid circle (Photo 2 - Spotify DJ ring)
      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        // Two smooth waves: main wave + counter-rotating secondary wave for liquid look
        const wave1 = Math.sin(theta * 2 - (mini ? time * 1.3 : time * 0.9)) * 0.65;
        const wave2 = Math.cos(theta * 3 + (mini ? time * 1.0 : time * 0.7)) * 0.35;
        const offset = (wave1 + wave2) * bulgeBase;
        const r = (baseRadius + offset) * pulseScale;

        const px = centerX + Math.cos(theta) * r;
        const py = centerY + Math.sin(theta) * r;

        if (i === 0) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }

      ctx.closePath();

      // Dynamic Ring Gradient: Adapts smoothly to the track's theme color or classic Spotify neon
      const grad = ctx.createLinearGradient(
        centerX - baseRadius,
        centerY - baseRadius,
        centerX + baseRadius,
        centerY + baseRadius
      );

      if (currentState === 'listening') {
        grad.addColorStop(0, '#00f2fe');
        grad.addColorStop(0.5, smoothColor);
        grad.addColorStop(1, '#00f2fe');
      } else {
        grad.addColorStop(0, '#1ed760');
        grad.addColorStop(0.35, smoothColor);
        grad.addColorStop(0.7, '#00f2fe');
        grad.addColorStop(1, '#1ed760');
      }

      ctx.strokeStyle = grad;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Soft neon glow in smoothly transitioned color
      const glowOpacity = isSpeaking ? 0.75 : isPlaying ? 0.6 : 0.45;
      ctx.shadowColor = `rgba(${Math.round(currentRgb[0])}, ${Math.round(currentRgb[1])}, ${Math.round(currentRgb[2])}, ${glowOpacity})`;
      ctx.shadowBlur = mini ? 6 : isSpeaking ? 24 : 18;

      ctx.stroke();
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [size, mini]);

  return (
    <div
      onClick={onClick}
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center select-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="pointer-events-none drop-shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      />
    </div>
  );
};
