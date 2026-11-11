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
  // Base sinusoidal liquid waves across the entire circumference
  const wave1 = Math.sin(theta * 2 - (mini ? time * 1.3 : time * 0.9)) * 0.65;
  const wave2 = Math.cos(theta * 3 + (mini ? time * 1.0 : time * 0.7)) * 0.35;
  const baseOffset = (wave1 + wave2) * bulgeBase;

  if (splitAmount <= 0.001) {
    // Single ring when idle or playing: all layers collapse cleanly
    return baseOffset;
  }

  // Angular upper-right Gaussian weight (maximum at -45 deg, smooth roll-off)
  const W = getUpperRightWeight(theta, 0.85);
  const scaleFactor = mini ? size / 38 : size / 260;

  if (layerIndex === 0) {
    // Layer 0 (Core ring): Sinks inward ("se hunde") in the upper-right speaking quadrant
    const inwardDip = (mini ? 2.5 : 14.0) * scaleFactor * (0.35 + voiceLevel * 0.65);
    return baseOffset - splitAmount * W * inwardDip;
  }

  if (layerIndex === 1) {
    // Layer 1 (Mid ring): displaced ~18-22px toward upper-right with speech harmonics
    const midBaseDisplacement = (mini ? 2.2 : 18.0) * scaleFactor;
    const midSpeechHarmonic = (0.3 + voiceLevel * 0.7) * (mini ? 1.2 : 7.0) * scaleFactor * Math.sin(theta * 3 - time * 3.5);
    const midLayerOffset = splitAmount * W * (midBaseDisplacement + midSpeechHarmonic);
    return baseOffset + midLayerOffset;
  }

  if (layerIndex === 2) {
    // Layer 2 (Outer ring): displaced ~36-44px toward upper-right with high-frequency speech wave flutter
    const outerBaseDisplacement = (mini ? 4.2 : 36.0) * scaleFactor;
    const outerSpeechFlutter =
      (0.35 + voiceLevel * 0.65) * (mini ? 1.8 : 9.5) * scaleFactor * Math.cos(theta * 4 + time * 4.5) +
      (mini ? 0.8 : 4.0) * scaleFactor * Math.sin(theta * 2 + time * 2.8);
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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef(state);
  const voiceLevelRef = useRef(voiceLevel);
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
    // Ring tuned with room for 3-layer upper-right expansion without clipping
    const baseRadius = size * (mini ? 0.30 : 0.31);
    const strokeWidth = Math.max(3.5, size * (mini ? 0.12 : 0.078));
    const numPoints = mini ? 70 : 160;
    const currentRgb: [number, number, number] = parseHexToRgb(themeColorRef.current || '#1ed760');

    const drawRing = (
      layerIndex: number,
      pulseScale: number,
      bulgeBase: number,
      split: number,
      currentVoice: number,
      strokeStyle: string | CanvasGradient,
      lineWidth: number,
      alpha: number,
      shadowColor: string,
      shadowBlur: number
    ) => {
      if (alpha <= 0.001) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
      ctx.beginPath();

      for (let i = 0; i <= numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        const offset = calculateOrbLayerDisplacement(
          layerIndex,
          theta,
          time,
          currentVoice,
          split,
          bulgeBase,
          size,
          mini
        );
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
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
      ctx.stroke();
      ctx.restore();
    };

    const draw = () => {
      const currentState = stateRef.current;
      const targetVoice = voiceLevelRef.current;

      const isSpeaking = currentState === 'speaking' || currentState === 'listening';
      const isPlaying = currentState === 'playing';

      // Speed of rotation & wave travel: faster when speaking or playing, gentle when idle
      const speed = mini
        ? (isSpeaking ? 0.052 : isPlaying ? 0.038 : 0.024)
        : isSpeaking
        ? 0.042
        : isPlaying
        ? 0.028
        : 0.019;
      time += speed;

      // Exponential moving average damping for voice reactivity
      smoothedVoiceRef.current += (targetVoice - smoothedVoiceRef.current) * 0.16;
      const currentVoice = smoothedVoiceRef.current;

      // Smooth interpolation for 3-layer talking orb delamination
      const targetSplit = isSpeaking ? 1.0 : 0.0;
      const splitRate = targetSplit > splitAmountRef.current ? 0.08 : 0.05;
      splitAmountRef.current += (targetSplit - splitAmountRef.current) * splitRate;
      const split = splitAmountRef.current;

      // Frame-by-frame color interpolation for smooth transitions
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
        pulseScale = 1 + Math.sin(time * 1.8) * 0.035;
        bulgeBase = 0.35 * (size / 38);
      } else if (isSpeaking) {
        pulseScale = 1 + Math.sin(time * 1.8) * 0.018;
        bulgeBase = (1.0 + currentVoice * 0.8) * (size / 260);
      } else if (isPlaying) {
        pulseScale = 1 + Math.sin(time * 1.8) * 0.025 + Math.sin(time * 3.6) * 0.01;
        bulgeBase = 1.4 * (size / 260);
      } else {
        pulseScale = 1 + Math.sin(time * 1.4) * 0.024;
        bulgeBase = 1.9 * (size / 260);
      }

      // =========================================================================
      // LAYER 0: CORE RING (Stable circular foundation with Spotify DJ gradient)
      // =========================================================================
      const grad0 = ctx.createLinearGradient(
        centerX - baseRadius * 0.8,
        centerY + baseRadius * 0.8,
        centerX + baseRadius * 0.8,
        centerY - baseRadius * 0.8
      );
      if (currentState === 'listening') {
        grad0.addColorStop(0, '#00f2fe');
        grad0.addColorStop(0.5, smoothColor);
        grad0.addColorStop(1, '#00f2fe');
      } else {
        grad0.addColorStop(0, '#0c52cc');
        grad0.addColorStop(0.3, '#00f2fe');
        grad0.addColorStop(0.65, '#1ed760');
        grad0.addColorStop(1, '#5ffcd4');
      }

      const glowOpacity = isSpeaking ? 0.85 : isPlaying ? 0.65 : 0.45;
      const shadowColor0 = `rgba(${Math.round(currentRgb[0])}, ${Math.round(currentRgb[1])}, ${Math.round(currentRgb[2])}, ${glowOpacity})`;
      const shadowBlur0 = mini ? 6 : isSpeaking ? 24 : 18;

      drawRing(
        0,
        pulseScale,
        bulgeBase,
        split,
        currentVoice,
        grad0,
        strokeWidth,
        1.0,
        shadowColor0,
        shadowBlur0
      );

      // =========================================================================
      // LAYER 1 & 2: DYNAMIC TALKING ORB DELAMINATION (Upper-right quadrant)
      // Dividing into 3 resonant lobes/arcs when the DJ speaks
      // =========================================================================
      if (split > 0.005) {
        // LAYER 1: MID RING (cyan-teal gradient, high opacity, harmonic resonance)
        const grad1 = ctx.createLinearGradient(
          centerX,
          centerY - baseRadius * 1.25,
          centerX + baseRadius * 1.25,
          centerY
        );
        grad1.addColorStop(0, '#00f2fe');
        grad1.addColorStop(0.5, '#1ed760');
        grad1.addColorStop(1, '#5ffcd4');

        const alpha1 = split * (0.85 + currentVoice * 0.15);
        const lineWidth1 = strokeWidth * (mini ? 0.85 : 0.80);
        const shadowColor1 = `rgba(0, 242, 254, ${alpha1 * 0.9})`;
        const shadowBlur1 = mini ? 5 : 20;

        drawRing(
          1,
          pulseScale,
          bulgeBase,
          split,
          currentVoice,
          grad1,
          lineWidth1,
          alpha1,
          shadowColor1,
          shadowBlur1
        );

        // LAYER 2: OUTER RING (electric mint-neon bloom, high-frequency speech wave flutter)
        const grad2 = ctx.createLinearGradient(
          centerX,
          centerY - baseRadius * 1.45,
          centerX + baseRadius * 1.45,
          centerY
        );
        grad2.addColorStop(0, '#5ffcd4');
        grad2.addColorStop(0.5, '#00f2fe');
        grad2.addColorStop(1, '#1ed760');

        const alpha2 = split * (0.75 + currentVoice * 0.25);
        const lineWidth2 = strokeWidth * (mini ? 0.75 : 0.70);
        const shadowColor2 = `rgba(95, 252, 212, ${alpha2 * 0.95})`;
        const shadowBlur2 = mini ? 6 : 26;

        drawRing(
          2,
          pulseScale,
          bulgeBase,
          split,
          currentVoice,
          grad2,
          lineWidth2,
          alpha2,
          shadowColor2,
          shadowBlur2
        );
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
        style={{ width: size, height: size }}
        className="pointer-events-none drop-shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      />
    </div>
  );
};
