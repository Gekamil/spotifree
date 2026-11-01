import React, { useEffect, useRef } from 'react';

interface InteractiveMusicWavesProps {
  isPlaying: boolean;
  isSpeaking: boolean;
  voiceLevel?: number;
  themeColor?: string;
  className?: string;
}

interface AmbientParticle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speedY: number;
  driftX: number;
  phase: number;
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
  const particlesRef = useRef<AmbientParticle[]>([]);

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

    const resize = () => {
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);

      // Initialize or reset particles on resize
      if (particlesRef.current.length === 0) {
        const count = 28;
        const pts: AmbientParticle[] = [];
        for (let i = 0; i < count; i++) {
          pts.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 2.2 + 0.8,
            alpha: Math.random() * 0.45 + 0.15,
            speedY: Math.random() * 0.45 + 0.15,
            driftX: (Math.random() - 0.5) * 0.3,
            phase: Math.random() * Math.PI * 2,
          });
        }
        particlesRef.current = pts;
      }
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

      ctx.clearRect(0, 0, width, height);

      const currentTheme = themeColorRef.current || '#1ed760';

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
        grad.addColorStop(0, `${currentTheme}${Math.round(cfg.opacity * 255).toString(16).padStart(2, '0')}`);
        grad.addColorStop(0.5, `${currentTheme}${Math.round(cfg.opacity * 0.4 * 255).toString(16).padStart(2, '0')}`);
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.fill();
      });

      // 2. Render Floating Ambient Bokeh Particles that drift gently
      const particles = particlesRef.current;
      const energyBoost = speaking ? 1 + voice * 0.8 : playing ? 1.2 : 0.8;

      particles.forEach((p) => {
        p.y -= p.speedY * energyBoost;
        p.x += Math.sin(time + p.phase) * 0.4 + p.driftX;

        // Wrap around vertically
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const pulse = Math.sin(time * 1.5 + p.phase) * 0.2 + 0.8;
        const currentRadius = p.radius * pulse * (speaking ? 1 + voice * 0.5 : 1);
        const currentAlpha = Math.min(0.65, p.alpha * pulse * (playing ? 1.2 : 0.9));

        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha * 0.6})`;
        ctx.shadowColor = currentTheme;
        ctx.shadowBlur = 8;
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
