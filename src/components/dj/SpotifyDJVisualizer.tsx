import React, { useEffect, useRef } from 'react';

export type DJVisualizerState = 'idle' | 'speaking' | 'listening' | 'playing';

interface SpotifyDJVisualizerProps {
  state?: DJVisualizerState;
  voiceLevel?: number; // 0 to 1
  size?: number; // width/height in px
  onClick?: () => void;
  className?: string;
  mini?: boolean; // For floating button icon
}

export const SpotifyDJVisualizer: React.FC<SpotifyDJVisualizerProps> = ({
  state = 'idle',
  voiceLevel = 0,
  size = 260,
  onClick,
  className = '',
  mini = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const voiceLevelRef = useRef(voiceLevel);
  const smoothedVoiceRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    voiceLevelRef.current = voiceLevel;
  }, [voiceLevel]);

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
    const baseRadius = size * (mini ? 0.35 : 0.32);
    const strokeWidth = Math.max(3, size * (mini ? 0.12 : 0.075));
    const numPoints = mini ? 70 : 140;

    const render = () => {
      // Gentle, smooth time advancement (no erratic jumps or wild bouncing)
      time += mini ? 0.012 : 0.016;
      const currentState = stateRef.current;
      const targetVoice = voiceLevelRef.current;

      // Exponential moving average for silky-smooth voice reactivity
      smoothedVoiceRef.current += (targetVoice - smoothedVoiceRef.current) * 0.1;
      const currentVoice = smoothedVoiceRef.current;

      ctx.clearRect(0, 0, size, size);

      // Organic, elegant deformation matching real Spotify DJ ring (Photo 2)
      let deformationMagnitude = 4.5 * (size / 260);
      let pulseScale = 1;

      if (!mini) {
        if (currentState === 'speaking') {
          // Harmonic wave deformation - smooth breathing without bouncing erratically
          deformationMagnitude = (6.5 + currentVoice * 10) * (size / 260);
          pulseScale = 1 + Math.sin(time * 1.8) * 0.02 + currentVoice * 0.05;
        } else if (currentState === 'listening') {
          deformationMagnitude = (6 + currentVoice * 8) * (size / 260);
          pulseScale = 1 + Math.sin(time * 1.5) * 0.018;
        } else if (currentState === 'playing') {
          deformationMagnitude = 5 * (size / 260);
          pulseScale = 1 + Math.sin(time * 1.2) * 0.015;
        } else {
          deformationMagnitude = 4 * (size / 260);
          pulseScale = 1 + Math.sin(time * 0.9) * 0.01;
        }
      }

      ctx.save();
      ctx.beginPath();

      // Compute smooth organic morphing loop points (single continuous peristaltic wave)
      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        // Two gentle low-frequency harmonic waves for fluid liquid appearance
        const wave1 = Math.sin(theta * 2 + time * 1.1) * 0.65;
        const wave2 = Math.cos(theta * 3 - time * 0.8) * 0.35;
        const offset = (wave1 + wave2) * deformationMagnitude;
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

      // Authentic Spotify DJ Neon Green -> Electric Cyan gradient (Photo 2)
      const grad = ctx.createLinearGradient(
        centerX - baseRadius,
        centerY - baseRadius,
        centerX + baseRadius,
        centerY + baseRadius
      );

      if (currentState === 'listening') {
        grad.addColorStop(0, '#00f2fe');
        grad.addColorStop(0.5, '#3b82f6');
        grad.addColorStop(1, '#00f2fe');
      } else {
        grad.addColorStop(0, '#1ed760');
        grad.addColorStop(0.5, '#00f2fe');
        grad.addColorStop(1, '#1ed760');
      }

      ctx.strokeStyle = grad;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Soft neon glow
      ctx.shadowColor = currentState === 'listening' ? 'rgba(0, 242, 254, 0.7)' : 'rgba(30, 215, 96, 0.55)';
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
