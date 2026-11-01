import { useState, useEffect } from 'react';

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
 * Hook to rotate DJ messages with a smooth transition
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
