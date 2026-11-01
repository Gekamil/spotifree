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
    const baseRadius = size * (mini ? 0.35 : 0.34);
    const strokeWidth = Math.max(3.5, size * (mini ? 0.12 : 0.082));
    const numPoints = mini ? 70 : 160;

    const render = () => {
      // Smooth, continuous gentle rotation (no sudden direction jumps)
      time += mini ? 0.012 : 0.014;
      const currentState = stateRef.current;
      const targetVoice = voiceLevelRef.current;

      // Exponential moving average damping for voice reactivity
      smoothedVoiceRef.current += (targetVoice - smoothedVoiceRef.current) * 0.08;
      const currentVoice = smoothedVoiceRef.current;

      ctx.clearRect(0, 0, size, size);

      // Clean, un-distorted Spotify ring: almost a perfect circle with subtle organic oval breathing
      const pulseScale = mini
        ? 1
        : 1 + Math.sin(time * 0.8) * 0.008 + currentVoice * 0.015;
      const organicBulgeAmp = mini
        ? 0.3
        : (0.7 + currentVoice * 0.9) * (size / 260);

      ctx.save();
      ctx.beginPath();

      // Compute smooth, single-harmonic organic circle (Photo 2 - clean and NOT heavily distorted)
      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        // Smooth peristaltic oval wave (single gentle wave, no ripples or jitter)
        const offset = Math.sin(theta - time * 0.45) * organicBulgeAmp;
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

      // Dynamic Ring Gradient: Adapts smoothly to the song's theme color!
      const currentTheme = themeColorRef.current;
      const grad = ctx.createLinearGradient(
        centerX - baseRadius,
        centerY - baseRadius,
        centerX + baseRadius,
        centerY + baseRadius
      );

      if (currentState === 'listening') {
        grad.addColorStop(0, '#00f2fe');
        grad.addColorStop(0.5, currentTheme || '#3b82f6');
        grad.addColorStop(1, '#00f2fe');
      } else if (currentTheme && currentTheme !== '#1ed760' && currentTheme !== '#0c52cc') {
        grad.addColorStop(0, '#1ed760');
        grad.addColorStop(0.35, currentTheme);
        grad.addColorStop(0.7, '#00f2fe');
        grad.addColorStop(1, '#1ed760');
      } else {
        grad.addColorStop(0, '#1ed760');
        grad.addColorStop(0.5, '#00f2fe');
        grad.addColorStop(1, '#1ed760');
      }

      ctx.strokeStyle = grad;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Soft neon glow in track's theme color
      ctx.shadowColor = currentTheme || (currentState === 'listening' ? 'rgba(0, 242, 254, 0.7)' : 'rgba(30, 215, 96, 0.55)');
      ctx.shadowBlur = mini ? 4 : 16;

      // Stroke ONLY (Hollow center matching Photo 2)
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
        className="block transition-transform duration-200"
      />
    </div>
  );
};
