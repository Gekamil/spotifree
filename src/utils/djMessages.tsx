import React, { useState, useEffect } from 'react';

export const DJ_BANNER_MESSAGES = [
  'Holi, soy tu DJ y te estoy esperando con toda esa música que te encanta.',
  '¿Listo para descubrir nueva música? Dale al play y déjamelo a mí.',
  'He preparado una selección con tus temas favoritos y novedades que te van a flipar.',
  '¿Un cambio de rollo? Cuéntame qué te apetece escuchar hoy.',
  'Música fresca seleccionada para tu momento. ¿Empezamos?',
  'Tus clásicos de siempre y temazos que no te esperas.',
  'Dime qué vibra buscas y yo me encargo del resto.',
  'Pídeme lo que quieras escuchar: géneros, estados de ánimo o artistas.',
];

/**
 * Hook to rotate DJ messages with state
 */
export function useRotatingDJMessage(intervalMs = 6500): string {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * DJ_BANNER_MESSAGES.length));

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % DJ_BANNER_MESSAGES.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return DJ_BANNER_MESSAGES[index];
}

interface RotatingDJBannerTextProps {
  className?: string;
  intervalMs?: number;
}

/**
 * Animated component that smoothly transitions with blur, scale and fade
 * between rotating DJ banner messages (Photo 3)
 */
export const RotatingDJBannerText: React.FC<RotatingDJBannerTextProps> = ({
  className = '',
  intervalMs = 6500,
}) => {
  const [currentIndex, setCurrentIndex] = useState(() => Math.floor(Math.random() * DJ_BANNER_MESSAGES.length));
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      // 1. Fade out & soft blur
      setIsTransitioning(true);

      // 2. Change text at the midpoint
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % DJ_BANNER_MESSAGES.length);
        // 3. Fade in & settle
        setIsTransitioning(false);
      }, 400);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return (
    <p
      className={`${className} transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isTransitioning
          ? 'opacity-0 -translate-y-2 filter blur-[3px] scale-[0.98]'
          : 'opacity-100 translate-y-0 filter blur-0 scale-100'
      }`}
    >
      {DJ_BANNER_MESSAGES[currentIndex]}
    </p>
  );
};
