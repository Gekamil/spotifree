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
    const numPoints = mini ? 60 : 120;

    const render = () => {
      time += mini ? 0.02 : 0.038;
      const currentState = stateRef.current;
      const currentVoice = voiceLevelRef.current;

      ctx.clearRect(0, 0, size, size);

      // Deformation dynamics matching real Spotify DJ ring (Photo 2)
      let deformationMagnitude = 6 * (size / 260);
      let pulseScale = 1;

      if (!mini) {
        if (currentState === 'speaking') {
          deformationMagnitude = (12 + currentVoice * 22) * (size / 260);
          pulseScale = 1 + Math.sin(time * 5) * 0.04 + currentVoice * 0.1;
        } else if (currentState === 'listening') {
          deformationMagnitude = (10 + currentVoice * 14) * (size / 260);
          pulseScale = 1 + Math.sin(time * 3) * 0.03;
        } else if (currentState === 'playing') {
          deformationMagnitude = 7 * (size / 260);
          pulseScale = 1 + Math.sin(time * 2.2) * 0.025;
        }
      }

      ctx.save();
      ctx.beginPath();

      // Compute smooth organic morphing loop points
      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        const wave1 = Math.sin(theta * 2 + time * 1.3) * 0.55;
        const wave2 = Math.cos(theta * 3 - time * 1.8) * 0.35;
        const wave3 = Math.sin(theta * 5 + time * 0.8) * 0.15;
        const offset = (wave1 + wave2 + wave3) * deformationMagnitude;
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
      ctx.shadowBlur = mini ? 4 : 18;

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
