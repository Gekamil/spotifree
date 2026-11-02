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
      const width = canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight;

      const playing = isPlayingRef.current;
      const speaking = isSpeakingRef.current;
      const targetLevel = voiceLevelRef.current;

      // Exponential smoothing for vocal reactivity
      smoothedLevelRef.current += (targetLevel - smoothedLevelRef.current) * 0.16;
      const voice = smoothedLevelRef.current;

      // Extract current music playback volume for dynamic wave responsiveness
      let musicVol = 0.8;
      if (typeof window !== 'undefined') {
        try {
          const pStore = (window as any).__usePlayerStore?.getState?.();
          if (pStore) {
            musicVol = pStore.isMuted ? 0 : (pStore.volume ?? 0.8);
          }
        } catch {}
      }

      // Dynamic wave speed:
      // - Si no suena (pausa): se mueve muy lentamente (speed = 0.005)
      // - Si suena poco: se mueve menos (speed = 0.012 + musicVol * 0.026)
      // - Si suena más: se mueve más (hasta 0.038)
      // - Si la IA habla: reacciona directamente al nivel de la voz (hasta 0.075)
      const speed = speaking
        ? 0.030 + voice * 0.045
        : playing
        ? 0.012 + musicVol * 0.026
        : 0.005;
      time += speed;

      // Dynamic wave amplitude scaling according to audio intensity
      const ampScale = speaking
        ? 1.0 + voice * 1.4
        : playing
        ? 0.55 + musicVol * 0.75
        : 0.35;

      // Smooth color morphing interpolation
      const targetRgb = parseHexToRgb(themeColorRef.current || '#1ed760');
      currentRgb[0] += (targetRgb[0] - currentRgb[0]) * 0.04;
      currentRgb[1] += (targetRgb[1] - currentRgb[1]) * 0.04;
      currentRgb[2] += (targetRgb[2] - currentRgb[2]) * 0.04;
      const r = Math.round(currentRgb[0]);
      const g = Math.round(currentRgb[1]);
      const b = Math.round(currentRgb[2]);

      ctx.clearRect(0, 0, width, height);

      // Layered Organic Waves
      const waveConfigs = [
        {
          frequency: 0.007,
          speedOffset: 0,
          amplitude: (speaking ? 28 + voice * 45 : playing ? 22 : 12) * ampScale,
          yCenter: height * 0.38,
          opacity: (speaking ? 0.28 : playing ? 0.22 : 0.12) * Math.min(1.2, ampScale),
          phaseShift: 0,
        },
        {
          frequency: 0.011,
          speedOffset: 1.2,
          amplitude: (speaking ? 36 + voice * 55 : playing ? 26 : 14) * ampScale,
          yCenter: height * 0.42,
          opacity: (speaking ? 0.34 : playing ? 0.28 : 0.14) * Math.min(1.2, ampScale),
          phaseShift: 1.5,
        },
        {
          frequency: 0.009,
          speedOffset: 2.1,
          amplitude: (speaking ? 25 + voice * 38 : playing ? 18 : 10) * ampScale,
          yCenter: height * 0.46,
          opacity: (speaking ? 0.22 : playing ? 0.18 : 0.10) * Math.min(1.2, ampScale),
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
