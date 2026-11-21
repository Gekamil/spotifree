import React, { useEffect, useRef } from 'react';

export type DJVisualizerState = 'idle' | 'speaking' | 'listening' | 'playing';

export interface SpotifyDJVisualizerProps {
  state?: DJVisualizerState;
  voiceLevel?: number; // 0 to 1
  size?: number; // width/height in px
  onClick?: () => void;
  className?: string;
  mini?: boolean; // For floating button icon
  themeColor?: string; // Dynamic track dominant color
  forceWaves?: boolean; // Keep the multi-layer undulating speech waves active
}

/**
 * Shortest circular arc distance between two angles in radians [-PI, PI].
 */
export function getAngularDistance(theta: number, targetTheta: number): number {
  let diff = theta - targetTheta;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return diff;
}

/**
 * Upper-right localization weight using Gaussian envelope.
 * Target angle is -PI/4 rad (-45 deg / 315 deg).
 * Spread sigma ≈ 0.85 rad (~48.7 deg).
 */
export function getUpperRightWeight(theta: number, sigma: number = 0.85): number {
  const targetTheta = -Math.PI / 4;
  const dist = getAngularDistance(theta, targetTheta);
  return Math.exp(-(dist * dist) / (2 * sigma * sigma));
}

/**
 * Procedural displacement for talking orb layers (0 = Core, 1 = Mid, 2 = Outer).
 * Option 1 Liquid Plasma Wave: smooth harmonic traveling waves around the entire circle,
 * combined with localized upper-right talking delamination when active/speaking.
 */
export function calculateOrbLayerDisplacement(
  layerIndex: number,
  theta: number,
  time: number,
  voiceLevel: number,
  splitAmount: number,
  bulgeBase: number,
  size: number,
  mini: boolean = false
): number {
  // Option 1 Liquid Plasma: two counter-propagating harmonic waves around the entire circle
  const t1 = mini ? time * 0.9 : time * 0.8;
  const t2 = mini ? time * 0.6 : time * 0.6;
  const wave1 = Math.sin(theta * 2 - t1) * 0.65;
  const wave2 = Math.cos(theta * 3 + t2) * 0.35;
  const baseOffset = (wave1 + wave2) * bulgeBase;

  if (splitAmount <= 0.001) {
    // All layers collapse cleanly
    return baseOffset;
  }

  // Angular upper-right Gaussian weight (maximum at -45 deg, smooth roll-off)
  const W = getUpperRightWeight(theta, 0.85);
  const scaleFactor = mini ? size / 38 : size / 260;

  if (layerIndex === 0) {
    // Layer 0 (Core ring): Sinks inward in the upper-right speaking quadrant
    const inwardDip = (mini ? 2.5 : 14.0) * scaleFactor * (0.4 + voiceLevel * 0.6);
    return baseOffset - splitAmount * W * inwardDip;
  }

  if (layerIndex === 1) {
    // Layer 1 (Mid ring): displaced ~18-22px toward upper-right with standing breathing harmonics
    const midBaseDisplacement = (mini ? 2.6 : 18.0) * scaleFactor;
    const midSpeechHarmonic =
      (0.25 + voiceLevel * 0.65) * (mini ? 1.2 : 5.5) * scaleFactor * Math.sin(theta * 3) * Math.cos(time * 0.75);
    const midLayerOffset = splitAmount * W * (midBaseDisplacement + midSpeechHarmonic);
    return baseOffset + midLayerOffset;
  }

  if (layerIndex === 2) {
    // Layer 2 (Outer ring): displaced ~32-38px toward upper-right with elegant speech wave delamination
    const outerBaseDisplacement = (mini ? 4.5 : 34.0) * scaleFactor;
    const outerSpeechFlutter =
      (0.3 + voiceLevel * 0.6) * (mini ? 1.5 : 7.0) * scaleFactor * Math.cos(theta * 4) * (0.6 + 0.4 * Math.cos(time * 0.85)) +
      (mini ? 0.8 : 3.0) * scaleFactor * Math.sin(theta * 2) * Math.cos(time * 0.55);
    const outerLayerOffset = splitAmount * W * (outerBaseDisplacement + outerSpeechFlutter);
    return baseOffset + outerLayerOffset;
  }

  return baseOffset;
}

export function parseHexToRgb(hex?: string): [number, number, number] {
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
  forceWaves = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const voiceLevelRef = useRef(voiceLevel);
  const forceWavesRef = useRef(forceWaves);
  const smoothedVoiceRef = useRef(0);
  const splitAmountRef = useRef(0);
  const themeColorRef = useRef(themeColor);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    voiceLevelRef.current = voiceLevel;
  }, [voiceLevel]);

  useEffect(() => {
    forceWavesRef.current = forceWaves;
  }, [forceWaves]);

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
    // Option 1 Elegant 360 Liquid Halo (Thick main ring with medium speaking wave)
    const baseRadius = size * (mini ? 0.32 : 0.325);
    const strokeWidth = mini ? Math.max(3.8, size * 0.12) : Math.max(7.2, size * 0.054);
    const outerStrokeWidth = mini ? Math.max(1.8, size * 0.05) : Math.max(2.4, size * 0.018);
    const numPoints = mini ? 70 : 140;
    const currentRgb: [number, number, number] = parseHexToRgb(themeColorRef.current || '#1ed760');

    const draw = () => {
      const currentState = stateRef.current;
      const hasForceWaves = Boolean(forceWavesRef.current);
      const isSpeaking = currentState === 'speaking' || currentState === 'listening' || hasForceWaves;
      const isPlaying = currentState === 'playing';
      const targetVoice = hasForceWaves && currentState !== 'speaking'
        ? Math.max(0.42, voiceLevelRef.current || 0.42)
        : voiceLevelRef.current;

      // Option 1 Serene liquid plasma speed (graceful fluid undulation across 360 degrees)
      const speed = mini
        ? (isSpeaking ? 0.018 : isPlaying ? 0.014 : 0.010)
        : isSpeaking
        ? 0.022
        : isPlaying
        ? 0.014
        : 0.012;
      time += speed;

      // Exponential moving average damping for voice reactivity (faster attack when speaking)
      const voiceAttack = isSpeaking ? 0.22 : 0.16;
      smoothedVoiceRef.current += (targetVoice - smoothedVoiceRef.current) * voiceAttack;
      const currentVoice = smoothedVoiceRef.current;

      // Multi-wave talking orb delamination: target 1.0 when speaking/waves enabled, 0.0 when idle
      const baseSplit = 0.88;
      const targetSplit = isSpeaking ? 1.0 : 0.0;
      const splitRate = targetSplit > splitAmountRef.current ? 0.08 : 0.05;
      splitAmountRef.current += (targetSplit - splitAmountRef.current) * splitRate;
      const split = hasForceWaves ? Math.max(baseSplit, splitAmountRef.current) : splitAmountRef.current;

      // Frame-by-frame color interpolation for smooth transitions
      const targetRgb = parseHexToRgb(themeColorRef.current || '#1ed760');
      currentRgb[0] += (targetRgb[0] - currentRgb[0]) * 0.04;
      currentRgb[1] += (targetRgb[1] - currentRgb[1]) * 0.04;
      currentRgb[2] += (targetRgb[2] - currentRgb[2]) * 0.04;
      const smoothColor = `rgb(${Math.round(currentRgb[0])}, ${Math.round(currentRgb[1])}, ${Math.round(currentRgb[2])})`;

      ctx.clearRect(0, 0, size, size);

      // Dynamic Pulsing & Organic Plasma Breathing across entire circumference
      let pulseScale: number;
      let bulgeBase: number;

      if (mini) {
        pulseScale = 1 + Math.sin(time * 1.8) * 0.035 + (isSpeaking ? Math.sin(time * 3.5) * 0.04 : 0);
        bulgeBase = (isSpeaking ? 0.65 : 0.35) * (size / 38);
      } else if (isSpeaking) {
        pulseScale = 1 + Math.sin(time * 2.2) * 0.038 + currentVoice * 0.045;
        bulgeBase = (2.2 + currentVoice * 1.4) * (size / 140);
      } else if (isPlaying) {
        pulseScale = 1 + Math.sin(time * 1.8) * 0.025 + Math.sin(time * 3.6) * 0.01;
        bulgeBase = 1.4 * (size / 140);
      } else {
        pulseScale = 1 + Math.sin(time * 1.4) * 0.022;
        bulgeBase = 1.5 * (size / 140);
      }

      // =========================================================================
      // MAIN 360° LIQUID NEON RING (Grueso ~7.2-7.5px)
      // =========================================================================
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        const w1 = Math.sin(theta * 2 - time * 0.8) * 0.65;
        const w2 = Math.cos(theta * 3 + time * 0.6) * 0.35;
        const offset = (w1 + w2) * bulgeBase;
        const r = (baseRadius + offset) * pulseScale;
        const px = centerX + Math.cos(theta) * r;
        const py = centerY + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      const grad0 = ctx.createLinearGradient(
        centerX - baseRadius,
        centerY - baseRadius,
        centerX + baseRadius,
        centerY + baseRadius
      );
      if (currentState === 'listening') {
        grad0.addColorStop(0, '#00f2fe');
        grad0.addColorStop(0.5, smoothColor);
        grad0.addColorStop(1, '#00f2fe');
      } else {
        grad0.addColorStop(0, '#0c52cc');
        grad0.addColorStop(0.35, '#00f2fe');
        grad0.addColorStop(0.7, smoothColor);
        grad0.addColorStop(1, '#5ffcd4');
      }

      const glowOpacity = isSpeaking ? 0.85 : isPlaying ? 0.65 : 0.45;
      const shadowColor0 = `rgba(${Math.round(currentRgb[0])}, ${Math.round(currentRgb[1])}, ${Math.round(currentRgb[2])}, ${glowOpacity})`;
      const shadowBlur0 = mini ? 6 : isSpeaking ? 24 : 16;

      ctx.strokeStyle = grad0;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = shadowColor0;
      ctx.shadowBlur = shadowBlur0;
      ctx.stroke();
      ctx.restore();

      // =========================================================================
      // SPEAKING OUTER HARMONIC WAVE (Tamaño medio ~2.4-2.5px across 360°)
      // Blooms and undulates smoothly around the entire circle when speaking
      // =========================================================================
      if (split > 0.005) {
        ctx.save();
        ctx.beginPath();
        const outerOffset = (mini ? 2.8 : size * 0.055) * pulseScale;
        for (let i = 0; i <= numPoints; i++) {
          const theta = (i / numPoints) * Math.PI * 2;
          const wOuter = Math.sin(theta * 4 - time * 1.6) * (mini ? 0.6 : 1.3) + Math.cos(theta * 2 + time * 0.9) * (mini ? 0.3 : 0.6);
          const rOuter = (baseRadius + outerOffset + wOuter * (mini ? 0.7 : 1.0)) * pulseScale;
          const px = centerX + Math.cos(theta) * rOuter;
          const py = centerY + Math.sin(theta) * rOuter;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        const outerAlpha = Math.min(1, Math.max(0, split * (0.8 + currentVoice * 0.2)));
        ctx.globalAlpha = outerAlpha;
        ctx.strokeStyle = 'rgba(95, 252, 212, 0.55)';
        ctx.lineWidth = outerStrokeWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#5ffcd4';
        ctx.shadowBlur = mini ? 5 : 14;
        ctx.stroke();
        ctx.restore();
      }
    };

    let onScreen = true;
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }) : null;
    io?.observe(canvas);
    let lastDraw = 0;
    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      if (!onScreen || document.hidden || now - lastDraw < 32) return;
      lastDraw = now;
      draw();
    };
    draw();
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      io?.disconnect();
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
        style={{ width: size, height: size, outline: 'none', border: 'none', background: 'transparent' }}
        className="pointer-events-none"
      />
    </div>
  );
};
