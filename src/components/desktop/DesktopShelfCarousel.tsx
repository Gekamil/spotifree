import React, { useRef, useState, useEffect } from 'react';
import { PlayNativeIcon, PauseNativeIcon } from '../icons/SpotifyNativeIcons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import type { FeedCard } from '../../data/liveUserFeed';
import { toHDImage } from '../../utils/formatters';

function cleanSubtitle(text?: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

interface DesktopShelfCarouselProps {
  title: string;
  prefix?: string;
  subtitle?: string;
  items: FeedCard[];
  onShowAll?: () => void;
  onCardClick?: (item: FeedCard) => void;
  onPlayClick?: (item: FeedCard) => void;
}

const CarouselCard: React.FC<{
  card: FeedCard;
  isPlaying?: boolean;
  onClick?: () => void;
  onPlay?: () => void;
}> = ({ card, isPlaying = false, onClick, onPlay }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [radioBgColor, setRadioBgColor] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const isArtist = card.subtitle?.toLowerCase() === 'artista' || card.id.startsWith('artist-') || (card as any).isArtist;
  const isRadioCard = card.image?.includes('/img/radio/') || card.id.startsWith('rad-') || (card as any).isRadio;
  const hasValidImage = !!card.image && card.image.trim().length > 0 && !imageError;

  const handleImageLoad = () => {
    setImageLoaded(true);
    if (isRadioCard && imgRef.current) {
      try {
        const img = imgRef.current;
        const c = document.createElement('canvas');
        c.width = 1;
        c.height = 1;
        const ctx = c.getContext('2d');
        if (ctx && img.naturalWidth > 10) {
          const sampleX = Math.floor(img.naturalWidth / 2);
          const sampleY = Math.max(2, Math.floor(img.naturalHeight * 0.04));
          ctx.drawImage(img, sampleX, sampleY, 1, 1, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          setRadioBgColor(`rgb(${r}, ${g}, ${b})`);
        }
      } catch {}
    }
  };

  useEffect(() => {
    setImageError(false);
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      handleImageLoad();
    }
  }, [card.image]);

  return (
    <div
      onClick={onClick}
      className="w-[180px] shrink-0 bg-[#181818] hover:bg-[#282828] p-3 rounded-md transition-all duration-300 cursor-pointer flex flex-col relative group select-none shadow-sm hover:shadow-xl"
    >
      {/* Artwork Container with skeleton loader */}
      <div className={`relative aspect-square w-full ${isArtist ? 'rounded-full' : 'rounded-[4px]'} overflow-hidden mb-3 shadow-md bg-[#242424]`}>
        {/* Placeholder if no image, error or loading */}
        {(!imageLoaded || !hasValidImage || imageError) && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#2e2e2e] to-[#1a1a1a] flex items-center justify-center">
            {isArtist ? (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="#606060">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="#606060">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            )}
          </div>
        )}

        {card.video ? (
          <video
            src={card.video}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : hasValidImage && !imageError ? (
          <>
            <img
              ref={imgRef}
              src={toHDImage(card.image)}
              alt={card.title}
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              onLoad={handleImageLoad}
              onError={() => {
                setImageError(true);
                setImageLoaded(false);
              }}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isRadioCard ? 'scale-[1.10] origin-bottom' : ''
              } ${imageLoaded && !imageError ? 'opacity-100' : 'opacity-0'}`}
            />
            {/* Seamlessly cover Spotify Pickasso "RADIO" top-right badge if present */}
            {isRadioCard && radioBgColor && (
              <div
                className="absolute pointer-events-none rounded-full z-10"
                style={{
                  top: '4.5%',
                  right: '4.5%',
                  width: '35%',
                  height: '16%',
                  backgroundColor: radioBgColor,
                }}
              />
            )}
          </>
        ) : null}

        {/* Green Play Button on hover (Bottom right of image) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onPlay) {
              onPlay();
            } else if (onClick) {
              onClick();
            }
          }}
          className={`absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 active:scale-95 shadow-xl flex items-center justify-center transition-all duration-200 z-10 cursor-pointer ${
            isPlaying
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 scale-90'
          }`}
          title={isPlaying ? `Pausar ${card.title}` : `Reproducir ${card.title}`}
        >
          {isPlaying ? (
            <PauseNativeIcon size={18} className="text-black" />
          ) : (
            <PlayNativeIcon size={18} className="text-black ml-0.5" />
          )}
        </button>
      </div>

      {/* Title & Subtitle */}
      <h3 className="font-bold text-white text-[13px] truncate mb-1 font-['SpotifyMixUI']">
        {card.title}
      </h3>
      <p className="text-[#b3b3b3] text-xs line-clamp-2 leading-relaxed">
        {cleanSubtitle(card.subtitle)}
      </p>
    </div>
  );
};

export const DesktopShelfCarousel: React.FC<DesktopShelfCarouselProps> = ({
  title,
  prefix,
  subtitle,
  items,
  onShowAll,
  onCardClick,
  onPlayClick,
}) => {
  if (!items || items.length === 0) {
    return null;
  }

  const { currentTrack, isPlaying } = usePlayerStore(
    useShallow((s) => ({ currentTrack: s.currentTrack, isPlaying: s.isPlaying }))
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const distance = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
    setTimeout(checkScroll, 400);
  };

  return (
    <section
      className="space-y-3 relative group/shelf"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Shelf Header */}
      <div className="flex items-end justify-between">
        <div>
          {prefix && (
            <span className="text-xs font-bold text-[#b3b3b3] block mb-0.5">
              {prefix}
            </span>
          )}
          <h2
            onClick={onShowAll}
            className={`text-2xl font-black text-white tracking-tight font-['SpotifyMixUITitle'] ${
              onShowAll ? 'hover:underline cursor-pointer' : ''
            }`}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-[#b3b3b3] mt-0.5 font-normal">
              {cleanSubtitle(subtitle)}
            </p>
          )}
        </div>
        {onShowAll && (
          <button
            onClick={onShowAll}
            className="text-xs font-bold text-[#b3b3b3] hover:underline cursor-pointer hover:text-white transition-colors"
          >
            Mostrar todos
          </button>
        )}
      </div>

      {/* Relative container holding scroll row + navigation arrows */}
      <div className="relative">
        {/* Left Scroll Arrow Button */}
        {canScrollLeft && isHovered && (
          <button
            onClick={() => scroll('left')}
            className="w-10 h-10 rounded-full bg-[#121212]/90 hover:bg-[#282828] text-white flex items-center justify-center absolute -left-3 top-1/2 -translate-y-1/2 shadow-2xl border border-white/10 z-30 transition-transform hover:scale-106 active:scale-95"
            title="Desplazar hacia la izquierda"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.81 7.75l6.22 6.22a.75.75 0 1 1-1.06 1.06l-6.75-6.75a.75.75 0 0 1 0-1.06l6.75-6.75a.75.75 0 0 1 1.06 0z" />
            </svg>
          </button>
        )}

        {/* Right Scroll Arrow Button */}
        {canScrollRight && isHovered && (
          <button
            onClick={() => scroll('right')}
            className="w-10 h-10 rounded-full bg-[#121212]/90 hover:bg-[#282828] text-white flex items-center justify-center absolute -right-3 top-1/2 -translate-y-1/2 shadow-2xl border border-white/10 z-30 transition-transform hover:scale-106 active:scale-95"
            title="Desplazar hacia la derecha"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.97.47a.75.75 0 0 0 0 1.06L11.19 7.75l-6.22 6.22a.75.75 0 1 0 1.06 1.06l6.75-6.75a.75.75 0 0 0 0-1.06L5.03.47a.75.75 0 0 0-1.06 0z" />
            </svg>
          </button>
        )}

        {/* Horizontal Carousel Track */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 overflow-x-auto scroll-smooth no-scrollbar py-2 px-1"
        >
          {items.map((card) => {
            const isPlayingThisCard =
              isPlaying &&
              ((currentTrack as any)?.playlistId === card.id || currentTrack?.id === card.id);

            return (
              <CarouselCard
                key={card.id}
                card={card}
                isPlaying={isPlayingThisCard}
                onClick={() => onCardClick && onCardClick(card)}
                onPlay={() => onPlayClick && onPlayClick(card)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};
