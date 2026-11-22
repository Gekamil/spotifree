import React, { useState, useEffect } from 'react';
import { useLanguageStore } from './i18n';

export const DJ_BANNER_MESSAGES_ES = [
  'Holi, soy tu DJ y te estoy esperando con toda esa buena música.',
  'Holi, aquí tu DJ. ¿Qué escuchamos hoy?',
  'Música lista para tu momento.',
  'Tus favoritos y temazos nuevos mezclados para ti.',
  '¿Qué vibra buscas hoy? Pídeme lo que quieras.',
  'Dale al play y déjame la música a mí.',
  'Mezclando tus temas preferidos y descubrimientos.',
  'Sintonizando tu ritmo personal.',
];

export const DJ_BANNER_MESSAGES_EN = [
  "Hey, I'm your DJ, ready when you are with great music.",
  "Hey! I'm your DJ. What's the vibe today?",
  'Fresh music lined up just for your moment.',
  'Your favorites and new gems mixed for you.',
  'Tell me what vibe you want and leave it to me.',
  'Hit play and leave the mixing to me.',
  'Mixing your top tracks and new discoveries.',
  'Tuning in to your personal rhythm.',
];

export const DJ_BANNER_MESSAGES = DJ_BANNER_MESSAGES_ES;

interface RotatingDJBannerTextProps {
  className?: string;
  intervalMs?: number;
}

/**
 * Authentic Spotify Rotating DJ Banner Text:
 * Displays bold, solid, punchy headlines with a smooth cross-fade transition between phrases.
 */
export const RotatingDJBannerText: React.FC<RotatingDJBannerTextProps> = ({
  className = '',
  intervalMs = 6500,
}) => {
  const { language } = useLanguageStore();
  const messages = language === 'en' ? DJ_BANNER_MESSAGES_EN : DJ_BANNER_MESSAGES_ES;

  const [currentIndex, setCurrentIndex] = useState(() => Math.floor(Math.random() * messages.length));
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
        setIsFading(false);
      }, 350);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [messages.length, intervalMs]);

  const currentMessage = messages[currentIndex % messages.length] || messages[0];

  return (
    <p
      className={`${className} font-['SpotifyMixUITitle',sans-serif] text-white font-black leading-tight transition-opacity duration-350 ease-in-out ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {currentMessage}
    </p>
  );
};
