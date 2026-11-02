import React, { useState, useEffect, useMemo } from 'react';
import { useLanguageStore } from './i18n';

export const DJ_BANNER_MESSAGES_ES = [
  'Holi, aquí tu DJ. ¿Qué escuchamos?',
  'Música lista para tu momento.',
  'Tus favoritos y temazos nuevos.',
  '¿Qué vibra buscas hoy?',
  'Pídeme el estilo que te apetezca.',
  'Dale al play y déjamelo a mí.',
  'Mezclando tus temas preferidos.',
  'Sintonizando tu ritmo personal.',
];

export const DJ_BANNER_MESSAGES_EN = [
  "Hey! I'm your DJ. What's the vibe?",
  'Fresh music ready for you.',
  'Your favorites and new gems.',
  'Tell me what you want to hear.',
  'Hit play and leave it to me.',
  'Mixing your top tracks right now.',
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

    // Progressive speaking pace (~190ms per word)
    let currentWord = 0;
    wordTimer = setInterval(() => {
      currentWord++;
      setRevealedWordIndex(currentWord);

      if (currentWord >= words.length) {
        clearInterval(wordTimer);

        // Hold fully illuminated sentence for 2.6 seconds so user reads comfortably
        holdTimer = setTimeout(() => {
          setIsFadingOut(true);

          // Transition to next phrase after soft fade
          fadeTimer = setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % messages.length);
          }, 450);
        }, 2600);
      }
    }, 190);

    return () => {
      if (wordTimer) clearInterval(wordTimer);
      if (holdTimer) clearTimeout(holdTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [currentIndex, words, messages.length]);

  return (
    <p
      className={`${className} transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isFadingOut
          ? 'opacity-0 -translate-y-2 filter blur-[3px] scale-[0.98]'
          : 'opacity-100 translate-y-0 filter blur-0 scale-100'
      }`}
    >
      {words.map((word, idx) => {
        const isSpoken = idx < revealedWordIndex;
        return (
          <span
            key={`${word}-${idx}`}
            className={`inline-block mr-1.5 transition-all duration-200 ${
              isSpoken
                ? 'text-white opacity-100 filter drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]'
                : 'text-white/35 opacity-40'
            }`}
          >
            {word}
          </span>
        );
      })}
    </p>
  );
};
