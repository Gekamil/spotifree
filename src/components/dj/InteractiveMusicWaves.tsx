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
      const width = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;
      if (!width || !height) return;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        resize();
      });
      ro.observe(canvas);
      if (canvas.parentElement) {
        ro.observe(canvas.parentElement);
      }
    }

    const render = () => {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const targetW = Math.round((canvas.clientWidth || canvas.parentElement?.clientWidth || 300) * dpr);
      const targetH = Math.round((canvas.clientHeight || canvas.parentElement?.clientHeight || 150) * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        if (targetW > 10 && targetH > 10) {
          canvas.width = targetW;
          canvas.height = targetH;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.scale(dpr, dpr);
        }
      }

      const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 300;
      const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 150;

      const playing = isPlayingRef.current;
      const speaking = isSpeakingRef.current;
      const targetLevel = voiceLevelRef.current;

      // Exponential smoothing for vocal reactivity
      smoothedLevelRef.current += (targetLevel - smoothedLevelRef.current) * 0.12;
      const voice = smoothedLevelRef.current;

      // Dynamic wave speed: smooth and organic, never chaotic
      const speed = speaking
        ? 0.016 + voice * 0.008
        : playing
        ? 0.011
        : 0.006;
      time += speed;

      // Amplitude stays calm and gentle
      const ampScale = speaking
        ? 1.05 + voice * 0.15
        : playing
        ? 0.95
        : 0.8;

      // Smooth color morphing interpolation
      const targetRgb = parseHexToRgb(themeColorRef.current || '#1ed760');
      currentRgb[0] += (targetRgb[0] - currentRgb[0]) * 0.04;
      currentRgb[1] += (targetRgb[1] - currentRgb[1]) * 0.04;
      currentRgb[2] += (targetRgb[2] - currentRgb[2]) * 0.04;
      const r = Math.round(currentRgb[0]);
      const g = Math.round(currentRgb[1]);
      const b = Math.round(currentRgb[2]);

      ctx.clearRect(0, 0, width, height);

      // Layered Organic Waves with noticeable, aesthetic presence
      const waveConfigs = [
        {
          frequency: 0.007,
          speedOffset: 0,
          amplitude: (speaking ? 28 : playing ? 22 : 16) * ampScale,
          yCenter: height * 0.38,
          opacity: speaking ? 0.48 : playing ? 0.38 : 0.28,
          phaseShift: 0,
        },
        {
          frequency: 0.010,
          speedOffset: 1.2,
          amplitude: (speaking ? 32 : playing ? 26 : 18) * ampScale,
          yCenter: height * 0.43,
          opacity: speaking ? 0.52 : playing ? 0.44 : 0.32,
          phaseShift: 1.5,
        },
        {
          frequency: 0.008,
          speedOffset: 2.1,
          amplitude: (speaking ? 24 : playing ? 20 : 14) * ampScale,
          yCenter: height * 0.48,
          opacity: speaking ? 0.40 : playing ? 0.34 : 0.24,
          phaseShift: 3.0,
        },
      ];

      ctx.save();

      waveConfigs.forEach((cfg) => {
        // Compute points along the organic wave
        const points: Array<{ x: number; y: number }> = [];
        // Sample up to the exact right edge (the last sample used to stop a few px short,
        // leaving a faint rectangle where the fill was closed straight down to the corner)
        const step = 8;
        for (let i = 0, n = Math.ceil(width / step); i <= n; i++) {
          const x = Math.min(width, i * step);
          const wave1 = Math.sin(x * cfg.frequency + time + cfg.speedOffset) * cfg.amplitude;
          const wave2 = Math.cos(x * (cfg.frequency * 1.8) - time * 0.8 + cfg.phaseShift) * (cfg.amplitude * 0.45);
          points.push({ x, y: cfg.yCenter + wave1 + wave2 });
        }

        // 1. Fill gradient path (closed along bottom)
        ctx.beginPath();
        ctx.moveTo(0, height);
        points.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.lineTo(width, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, cfg.yCenter - cfg.amplitude, 0, height);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${cfg.opacity})`);
        grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${cfg.opacity * 0.5})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.fill();

        // 2. Stroke ONLY top crest line (open path, zero side/bottom borders)
        ctx.beginPath();
        points.forEach((p, idx) => {
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.85, cfg.opacity * 1.6)})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      });

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
};
