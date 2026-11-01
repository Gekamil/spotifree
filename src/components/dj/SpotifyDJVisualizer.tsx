import React, { useEffect, useRef } from 'react';

export type DJVisualizerState = 'idle' | 'speaking' | 'listening' | 'playing';

interface SpotifyDJVisualizerProps {
  state?: DJVisualizerState;
  voiceLevel?: number; // 0 to 1
  size?: number; // width/height in px
  onClick?: () => void;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speedX: number;
  speedY: number;
  color: string;
}

interface RippleRing {
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
  speed: number;
}

export const SpotifyDJVisualizer: React.FC<SpotifyDJVisualizerProps> = ({
  state = 'idle',
  voiceLevel = 0,
  size = 360,
  onClick,
  className = '',
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

    // Retina display scaling
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const centerX = size / 2;
    const centerY = size / 2;
    const baseRadius = size * 0.28;

    // Ambient floating particles
    const particleColors = ['#1ed760', '#00f2fe', '#3b82f6', '#8b5cf6', '#ffffff'];
    const particles: Particle[] = Array.from({ length: 24 }).map(() => ({
      x: centerX + (Math.random() - 0.5) * size * 0.8,
      y: centerY + (Math.random() - 0.5) * size * 0.8,
      size: Math.random() * 2 + 1,
      alpha: Math.random() * 0.6 + 0.2,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: (Math.random() - 0.5) * 0.4,
      color: particleColors[Math.floor(Math.random() * particleColors.length)],
    }));

    // Dynamic wave ripples (expanding shockwaves)
    const ripples: RippleRing[] = [];
    let lastRippleTime = 0;

    const render = () => {
      time += 0.035;
      const currentState = stateRef.current;
      const currentVoice = voiceLevelRef.current;

      ctx.clearRect(0, 0, size, size);

      // 1. Spawning dynamic acoustic ripples when speaking or listening
      const now = performance.now();
      const rippleInterval = currentState === 'speaking' ? 260 : currentState === 'listening' ? 450 : 800;

      if ((currentState === 'speaking' || (currentState === 'listening' && currentVoice > 0.15)) && now - lastRippleTime > rippleInterval) {
        lastRippleTime = now;
        const color = currentState === 'speaking' ? '#1ed760' : '#00f2fe';
        ripples.push({
          radius: baseRadius,
          maxRadius: size * 0.48,
          alpha: 0.85,
          color,
          speed: 1.6 + (currentState === 'speaking' ? currentVoice * 1.5 : 0.8),
        });
      }

      // 2. Render and expand ripple shockwaves
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.radius += rip.speed;
        rip.alpha -= 0.015;

        if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
          ripples.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, rip.radius, 0, Math.PI * 2);
        ctx.strokeStyle = rip.color;
        ctx.globalAlpha = rip.alpha * 0.7;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Secondary subtle harmonic ring
        ctx.beginPath();
        ctx.arc(centerX, centerY, rip.radius * 0.92, 0, Math.PI * 2);
        ctx.strokeStyle = '#00f2fe';
        ctx.globalAlpha = rip.alpha * 0.35;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Render floating stardust particles
      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;

        // Wrap around bounds
        if (p.x < centerX - size * 0.45) p.x = centerX + size * 0.45;
        if (p.x > centerX + size * 0.45) p.x = centerX - size * 0.45;
        if (p.y < centerY - size * 0.45) p.y = centerY + size * 0.45;
        if (p.y > centerY + size * 0.45) p.y = centerY - size * 0.45;

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * (0.6 + Math.sin(time + p.x) * 0.3);
        ctx.fill();
        ctx.restore();
      });

      // 4. Outer Aura Halo
      const auraGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.7,
        centerX,
        centerY,
        baseRadius * 1.6
      );

      if (currentState === 'speaking') {
        auraGradient.addColorStop(0, 'rgba(30, 215, 96, 0.45)');
        auraGradient.addColorStop(0.5, 'rgba(0, 242, 254, 0.25)');
        auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (currentState === 'listening') {
        auraGradient.addColorStop(0, 'rgba(0, 242, 254, 0.5)');
        auraGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.3)');
        auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else if (currentState === 'playing') {
        auraGradient.addColorStop(0, 'rgba(46, 119, 208, 0.4)');
        auraGradient.addColorStop(0.5, 'rgba(30, 215, 96, 0.2)');
        auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        auraGradient.addColorStop(0, 'rgba(30, 215, 96, 0.25)');
        auraGradient.addColorStop(0.6, 'rgba(46, 119, 208, 0.15)');
        auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }

      ctx.save();
      ctx.fillStyle = auraGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 5. Morphing Organic Fluid Core (Sine & Cosine waves)
      const numPoints = 120;
      let deformationMagnitude = 8;
      let pulseScale = 1;

      if (currentState === 'speaking') {
        deformationMagnitude = 16 + currentVoice * 22;
        pulseScale = 1 + Math.sin(time * 6) * 0.05 + currentVoice * 0.12;
      } else if (currentState === 'listening') {
        deformationMagnitude = 11 + currentVoice * 14;
        pulseScale = 1 + Math.sin(time * 3) * 0.04;
      } else if (currentState === 'playing') {
        deformationMagnitude = 10;
        pulseScale = 1 + Math.sin(time * 4) * 0.035;
      } else {
        deformationMagnitude = 6;
        pulseScale = 1 + Math.sin(time * 1.8) * 0.02;
      }

      ctx.save();
      ctx.beginPath();

      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        const wave1 = Math.sin(theta * 3 + time * 1.4) * 0.5;
        const wave2 = Math.cos(theta * 5 - time * 2.1) * 0.3;
        const wave3 = Math.sin(theta * 7 + time * 0.9) * 0.2;
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

      // Fluid Iridescent Gradient inside the orb
      const gradCenterX = centerX + Math.cos(time * 0.8) * 25;
      const gradCenterY = centerY + Math.sin(time * 0.6) * 25;

      const orbGradient = ctx.createRadialGradient(
        gradCenterX,
        gradCenterY,
        baseRadius * 0.15,
        centerX,
        centerY,
        baseRadius * 1.15
      );

      if (currentState === 'speaking') {
        orbGradient.addColorStop(0.0, '#ffffff'); // Inner bright core
        orbGradient.addColorStop(0.25, '#1ed760'); // Spotify green
        orbGradient.addColorStop(0.55, '#00f2fe'); // Electric cyan
        orbGradient.addColorStop(0.85, '#2e77d0'); // Cobalt blue
        orbGradient.addColorStop(1.0, '#8b5cf6'); // Violet edge
      } else if (currentState === 'listening') {
        orbGradient.addColorStop(0.0, '#ffffff');
        orbGradient.addColorStop(0.3, '#00f2fe'); // Electric cyan
        orbGradient.addColorStop(0.65, '#3b82f6'); // Vibrant blue
        orbGradient.addColorStop(0.9, '#a855f7'); // Magenta/purple
        orbGradient.addColorStop(1.0, '#1ed760');
      } else if (currentState === 'playing') {
        orbGradient.addColorStop(0.0, '#ffffff');
        orbGradient.addColorStop(0.28, '#2e77d0'); // Blue
        orbGradient.addColorStop(0.6, '#1ed760'); // Green
        orbGradient.addColorStop(0.88, '#00f2fe'); // Cyan
        orbGradient.addColorStop(1.0, '#4c1d95');
      } else {
        orbGradient.addColorStop(0.0, '#ffffff');
        orbGradient.addColorStop(0.3, '#1ed760');
        orbGradient.addColorStop(0.65, '#2e77d0');
        orbGradient.addColorStop(1.0, '#1030a0');
      }

      ctx.fillStyle = orbGradient;
      ctx.fill();

      // Inner fluid refraction highlight
      ctx.globalCompositeOperation = 'overlay';
      const highlight = ctx.createLinearGradient(
        centerX - baseRadius,
        centerY - baseRadius,
        centerX + baseRadius,
        centerY + baseRadius
      );
      highlight.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      highlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
      highlight.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
      ctx.fillStyle = highlight;
      ctx.fill();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [size]);

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center justify-center select-none cursor-pointer group transition-transform active:scale-95 ${className}`}
      style={{ width: size, height: size }}
      title="Spotify AI DJ"
    >
      {/* Dynamic Ambient Background Glow */}
      <div
        className={`absolute rounded-full transition-all duration-700 pointer-events-none ${
          state === 'speaking'
            ? 'w-[85%] h-[85%] bg-[#1ed760]/35 blur-[65px] animate-pulse'
            : state === 'listening'
            ? 'w-[90%] h-[90%] bg-[#00f2fe]/40 blur-[70px] animate-pulse'
            : state === 'playing'
            ? 'w-[75%] h-[75%] bg-[#2e77d0]/30 blur-[60px]'
            : 'w-[70%] h-[70%] bg-[#1ed760]/20 blur-[50px]'
        }`}
      />

      {/* Main Fluid Canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="relative z-10 drop-shadow-[0_0_35px_rgba(30,215,96,0.5)] transition-all duration-300 group-hover:scale-102"
      />
    </div>
  );
};
