import React, { useEffect, useRef } from 'react';

interface InteractiveMusicWavesProps {
  isPlaying: boolean;
  isSpeaking: boolean;
  voiceLevel?: number;
  themeColor?: string;
  className?: string;
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

export const InteractiveMusicWaves: React.FC<InteractiveMusicWavesProps> = ({
  isPlaying,
  isSpeaking,
  voiceLevel = 0,
  themeColor = '#1ed760',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const isSpeakingRef = useRef(isSpeaking);
  const voiceLevelRef = useRef(voiceLevel);
  const themeColorRef = useRef(themeColor);
  const smoothedLevelRef = useRef(0);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

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
    const currentRgb: [number, number, number] = parseHexToRgb(themeColorRef.current || '#1ed760');

    const resize = () => {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;

      const playing = isPlayingRef.current;
      const speaking = isSpeakingRef.current;
      const targetLevel = voiceLevelRef.current;

      // Exponential smoothing for vocal reactivity
      smoothedLevelRef.current += (targetLevel - smoothedLevelRef.current) * 0.16;
      const voice = smoothedLevelRef.current;

      // Dynamic wave speed
      const speed = speaking ? 0.045 : playing ? 0.028 : 0.015;
      time += speed;

      // Smooth color morphing interpolation
      const targetRgb = parseHexToRgb(themeColorRef.current || '#1ed760');
      currentRgb[0] += (targetRgb[0] - currentRgb[0]) * 0.04;
      currentRgb[1] += (targetRgb[1] - currentRgb[1]) * 0.04;
      currentRgb[2] += (targetRgb[2] - currentRgb[2]) * 0.04;
      const r = Math.round(currentRgb[0]);
      const g = Math.round(currentRgb[1]);
      const b = Math.round(currentRgb[2]);

      ctx.clearRect(0, 0, width, height);

      // 1. Render Layered Organic Waves across the mid-region
      const waveConfigs = [
        {
          frequency: 0.007,
          speedOffset: 0,
          amplitude: (speaking ? 28 + voice * 45 : playing ? 22 : 12),
          yCenter: height * 0.38,
          opacity: 0.22,
          phaseShift: 0,
        },
        {
          frequency: 0.011,
          speedOffset: 1.2,
          amplitude: (speaking ? 36 + voice * 55 : playing ? 26 : 14),
          yCenter: height * 0.42,
          opacity: 0.28,
          phaseShift: 1.5,
        },
        {
          frequency: 0.009,
          speedOffset: 2.1,
          amplitude: (speaking ? 24 + voice * 40 : playing ? 18 : 10),
          yCenter: height * 0.46,
          opacity: 0.18,
          phaseShift: 3.0,
        },
      ];

      ctx.save();

      waveConfigs.forEach((cfg) => {
        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 8) {
          const wave1 = Math.sin(x * cfg.frequency + time + cfg.speedOffset) * cfg.amplitude;
          const wave2 = Math.cos(x * (cfg.frequency * 1.8) - time * 0.8 + cfg.phaseShift) * (cfg.amplitude * 0.45);
          const y = cfg.yCenter + wave1 + wave2;

          if (x === 0) {
            ctx.lineTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, cfg.yCenter - cfg.amplitude, 0, height);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${cfg.opacity})`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${cfg.opacity * 0.4})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.fill();
      });

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
};
