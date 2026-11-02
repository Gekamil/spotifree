import React, { useState, useEffect, useMemo } from 'react';
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
 * Animated component that simulates live speech / karaoke typing:
 * All words start in a soft translucent tone (text-white/35) and progressively
 * light up into bright solid white word-by-word as if the AI were actively speaking.
 */
export const RotatingDJBannerText: React.FC<RotatingDJBannerTextProps> = ({
  className = '',
}) => {
  const { language } = useLanguageStore();
  const messages = language === 'en' ? DJ_BANNER_MESSAGES_EN : DJ_BANNER_MESSAGES_ES;

  const [currentIndex, setCurrentIndex] = useState(() => Math.floor(Math.random() * messages.length));
  const [revealedWordIndex, setRevealedWordIndex] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const currentMessage = messages[currentIndex % messages.length] || messages[0];
  const words = useMemo(() => currentMessage.split(' '), [currentMessage]);

  useEffect(() => {
    let wordTimer: any = null;
    let holdTimer: any = null;
    let fadeTimer: any = null;

    // Reset speech progression for current phrase
    setRevealedWordIndex(0);
    setIsFadingOut(false);

    // Relaxed, calm progressive speaking pace (340ms per word)
    let currentWord = 0;
    wordTimer = setInterval(() => {
      currentWord++;
      setRevealedWordIndex(currentWord);

      if (currentWord >= words.length) {
        clearInterval(wordTimer);

        // Hold fully illuminated sentence for 6.5 seconds so user reads comfortably without rushing
        holdTimer = setTimeout(() => {
          setIsFadingOut(true);

          // Transition to next phrase after soft fade
          fadeTimer = setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % messages.length);
          }, 650);
        }, 6500);
      }
    }, 340);

    return () => {
      if (wordTimer) clearInterval(wordTimer);
      if (holdTimer) clearTimeout(holdTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [currentIndex, words, messages.length]);

  return (
    <p
      className={`${className} flex flex-wrap items-center break-words whitespace-normal font-['SpotifyMixUITitle',sans-serif] tracking-tight transition-opacity duration-300 ease-out ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {words.map((word, idx) => {
        const isSpoken = idx < revealedWordIndex;
        const isHighlight = /^(dj|música|ritmo|tu|temazos)$/i.test(word.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ''));
        return (
          <span
            key={`${word}-${idx}`}
            className={`inline-block mr-1.5 transition-colors duration-150 ${
              isSpoken
                ? isHighlight
                  ? 'text-[#93c5fd] font-black'
                  : 'text-white font-black'
                : 'text-white/40 font-bold'
            }`}
          >
            {word}
          </span>
        );
      })}
    </p>
  );
};
