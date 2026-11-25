import React, { useMemo, useState } from 'react';
import { PlayNativeIcon } from '../icons/SpotifyNativeIcons';
import { handleImageError } from '../../utils/imageFallback';
import {
  filterAndSortDiscography,
  formatDesktopReleaseSubtitle,
  formatMobileReleaseSubtitle,
  type ArtistReleaseItem,
  type ArtistPlaylistItem,
  type DiscographyFilter,
} from '../../utils/artistDiscography';

export type { ArtistReleaseItem, ArtistPlaylistItem, DiscographyFilter };

interface DesktopArtistDiscographyProps {
  items: ArtistReleaseItem[];
  isLoading: boolean;
  onSelectAlbum: (item: ArtistReleaseItem) => void;
  onPlayAlbum: (item: ArtistReleaseItem) => void;
}

export const DesktopArtistDiscographySection: React.FC<DesktopArtistDiscographyProps> = ({
  items,
  isLoading,
  onSelectAlbum,
  onPlayAlbum,
}) => {
  const [filter, setFilter] = useState<DiscographyFilter>('popular');
  const [showAll, setShowAll] = useState(false);

  const availableFilters = useMemo(() => {
    const hasAlbums = items.some((i) => i.recordType === 'album');
    const hasSinglesEp = items.some((i) => i.recordType === 'single' || i.recordType === 'ep');
    const hasCompile = items.some((i) => i.recordType === 'compile');
    const list: Array<{ id: DiscographyFilter; label: string }> = [
      { id: 'popular', label: 'Títulos populares' },
    ];
    if (hasAlbums) list.push({ id: 'album', label: 'Álbumes' });
    if (hasSinglesEp) list.push({ id: 'single_ep', label: 'Sencillos y EP' });
    if (hasCompile) list.push({ id: 'compile', label: 'Recopilatorios' });
    return list;
  }, [items]);

  const activeFilter: DiscographyFilter = availableFilters.some((f) => f.id === filter) ? filter : 'popular';
  const filtered = useMemo(() => filterAndSortDiscography(items, activeFilter), [items, activeFilter]);
  const visible = showAll ? filtered : filtered.slice(0, 6);

  if (!isLoading && items.length === 0) return null;

  return (
    <div className="px-8 pt-8 pb-4 mt-4 border-t border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-black text-white font-['SpotifyMixUITitle']">
          Discografía
        </h2>
        {filtered.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-bold text-[#b3b3b3] hover:text-white hover:underline cursor-pointer transition-colors"
          >
            {showAll ? 'Mostrar menos' : 'Mostrar todos'}
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {availableFilters.map((f) => {
            const active = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                  active
                    ? 'bg-white text-black'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
        {isLoading && items.length === 0
          ? [1, 2, 3, 4, 5, 6].map((idx) => (
              <div key={`skel-disc-${idx}`} className="p-3.5 rounded-lg bg-[#181818] animate-pulse">
                <div className="aspect-square w-full rounded-[4px] bg-[#282828] mb-3" />
                <div className="h-4 w-3/4 bg-[#282828] rounded mb-2" />
                <div className="h-3 w-1/2 bg-[#282828] rounded" />
              </div>
            ))
          : visible.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectAlbum(item)}
                className="p-3.5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col shadow-md hover:shadow-xl relative"
              >
                <div className="aspect-square w-full rounded-[4px] overflow-hidden mb-3 relative shadow-lg bg-[#242424] flex items-center justify-center">
                  {item.cover ? (
                    <img
                      src={item.cover}
                      alt={item.name}
                      onError={handleImageError}
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#b3b3b3]">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayAlbum(item);
                    }}
                    className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-xl flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 cursor-pointer"
                    title={`Reproducir ${item.name}`}
                  >
                    <PlayNativeIcon size={18} className="text-black ml-0.5" />
                  </button>
                </div>
                <span className="font-bold text-white text-sm truncate w-full group-hover:underline">
                  {item.name}
                </span>
                <span className="text-xs text-[#b3b3b3] mt-1 truncate w-full">
                  {formatDesktopReleaseSubtitle(item)}
                </span>
              </div>
            ))}
      </div>
    </div>
  );
};

interface DesktopArtistPlaylistsProps {
  artistName: string;
  playlists: ArtistPlaylistItem[];
  onSelectPlaylist: (pl: ArtistPlaylistItem) => void;
  onPlayPlaylist: (pl: ArtistPlaylistItem) => void;
}

export const DesktopArtistPlaylistsSection: React.FC<DesktopArtistPlaylistsProps> = ({
  artistName,
  playlists,
  onSelectPlaylist,
  onPlayPlaylist,
}) => {
  const [showAll, setShowAll] = useState(false);

  if (!playlists || playlists.length === 0) return null;

  const visible = showAll ? playlists : playlists.slice(0, 6);

  return (
    <div className="px-8 pt-8 pb-4 mt-4 border-t border-white/10">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-2xl font-black text-white font-['SpotifyMixUITitle']">
          Incluye a {artistName}
        </h2>
        {playlists.length > 6 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-bold text-[#b3b3b3] hover:text-white hover:underline cursor-pointer transition-colors"
          >
            {showAll ? 'Mostrar menos' : 'Mostrar todos'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
        {visible.map((pl) => (
          <div
            key={pl.id}
            onClick={() => onSelectPlaylist(pl)}
            className="p-3.5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col shadow-md hover:shadow-xl relative"
          >
            <div className="aspect-square w-full rounded-[4px] overflow-hidden mb-3 relative shadow-lg bg-[#242424] flex items-center justify-center">
              {pl.image ? (
                <img
                  src={pl.image}
                  alt={pl.name}
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#b3b3b3]">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayPlaylist(pl);
                }}
                className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-xl flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 cursor-pointer"
                title={`Reproducir ${pl.name}`}
              >
                <PlayNativeIcon size={18} className="text-black ml-0.5" />
              </button>
            </div>
            <span className="font-bold text-white text-sm truncate w-full group-hover:underline">
              {pl.name}
            </span>
            <span className="text-xs text-[#b3b3b3] mt-1 truncate w-full">
              {pl.owner ? `De ${pl.owner}` : 'Spotify'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface DesktopArtistAboutProps {
  artistName: string;
  image?: string;
  listenersLabel: string;
  bio: string | null;
}

export const DesktopArtistAboutCard: React.FC<DesktopArtistAboutProps> = ({
  artistName,
  image,
  listenersLabel,
  bio,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-8 pt-8 pb-10 mt-6 border-t border-white/10">
      <h2 className="text-2xl font-black text-white font-['SpotifyMixUITitle'] mb-4">
        Información
      </h2>
      <div
        onClick={() => (bio && bio.length > 180 ? setExpanded((v) => !v) : undefined)}
        className={`rounded-xl bg-[#181818] hover:bg-[#222222] transition-colors p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6 max-w-4xl ${
          bio && bio.length > 180 ? 'cursor-pointer' : ''
        }`}
      >
        {image && (
          <img
            src={image}
            alt={artistName}
            onError={handleImageError}
            className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover shrink-0 shadow-lg"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-base font-bold text-white">{listenersLabel}</p>
          <p className={`text-sm text-[#d4d4d4] leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
            {bio || `Perfil oficial de ${artistName} en Spotifree. Disfruta de toda su discografía, sencillos, recopilatorios y mezclas recomendadas.`}
          </p>
          {bio && bio.length > 180 && (
            <span className="inline-block text-xs font-bold text-white/90 hover:underline">
              {expanded ? 'Ver menos' : 'Ver más'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

interface MobileArtistDiscoveryProps {
  artistName: string;
  discography: ArtistReleaseItem[];
  isLoadingDiscography: boolean;
  playlists: ArtistPlaylistItem[];
  bio: string | null;
  onSelectAlbum: (item: ArtistReleaseItem) => void;
  onSelectPlaylist: (pl: ArtistPlaylistItem) => void;
}

export const MobileArtistDiscoverySections: React.FC<MobileArtistDiscoveryProps> = ({
  artistName,
  discography,
  isLoadingDiscography,
  playlists,
  bio,
  onSelectAlbum,
  onSelectPlaylist,
}) => {
  const [isFullDiscographyOpen, setIsFullDiscographyOpen] = useState(false);
  const [fullFilter, setFullFilter] = useState<DiscographyFilter>('popular');
  const [expandedBio, setExpandedBio] = useState(false);

  const popularReleases = useMemo(
    () => filterAndSortDiscography(discography, 'popular').slice(0, 4),
    [discography]
  );

  const fullFilters = useMemo(() => {
    const list: Array<{ id: DiscographyFilter; label: string }> = [
      { id: 'popular', label: 'Todos' },
    ];
    if (discography.some((i) => i.recordType === 'album')) list.push({ id: 'album', label: 'Álbumes' });
    if (discography.some((i) => i.recordType === 'single' || i.recordType === 'ep')) {
      list.push({ id: 'single_ep', label: 'Sencillos y EP' });
    }
    if (discography.some((i) => i.recordType === 'compile')) list.push({ id: 'compile', label: 'Recopilatorios' });
    return list;
  }, [discography]);

  const activeFullFilter = fullFilters.some((f) => f.id === fullFilter) ? fullFilter : 'popular';
  const fullDiscographyItems = useMemo(
    () => (activeFullFilter === 'popular' ? discography : filterAndSortDiscography(discography, activeFullFilter)),
    [discography, activeFullFilter]
  );

  const truncatedBio = bio && bio.length > 125 ? `${bio.slice(0, 122).trimEnd()}...` : bio;

  return (
    <>
      {/* 1. Popular Releases ("Títulos populares") + "Ver discografía" */}
      {(popularReleases.length > 0 || isLoadingDiscography) && (
        <div className="pt-6 pb-2 border-t border-white/10 mt-6 px-1">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-[19px] font-bold text-white font-['SpotifyMixUITitle'] tracking-tight">
              Títulos populares
            </h3>
            {discography.length > 4 && (
              <button
                type="button"
                onClick={() => setIsFullDiscographyOpen(true)}
                className="text-xs font-bold text-[#b3b3b3] hover:text-white active:scale-95 transition-all cursor-pointer"
              >
                Mostrar todos
              </button>
            )}
          </div>

          <div className="space-y-3">
            {isLoadingDiscography && popularReleases.length === 0
              ? [1, 2, 3, 4].map((idx) => (
                  <div key={`m-rel-skel-${idx}`} className="flex items-center gap-3.5 animate-pulse">
                    <div className="w-16 h-16 rounded-[4px] bg-[#242424] shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-2/3 bg-[#242424] rounded" />
                      <div className="h-3 w-1/3 bg-[#242424] rounded" />
                    </div>
                  </div>
                ))
              : popularReleases.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectAlbum(item)}
                    className="flex items-center gap-3.5 rounded-lg active:bg-white/10 transition-colors cursor-pointer py-0.5"
                  >
                    <div className="w-16 h-16 rounded-[4px] overflow-hidden bg-[#242424] shrink-0 shadow">
                      {item.cover ? (
                        <img
                          src={item.cover}
                          alt={item.name}
                          onError={handleImageError}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/40">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-white truncate leading-snug">
                        {item.name}
                      </p>
                      <p className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                        {formatMobileReleaseSubtitle(item)}
                      </p>
                    </div>
                  </div>
                ))}
          </div>

          {discography.length > 0 && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setIsFullDiscographyOpen(true)}
                className="px-4 py-1.5 rounded-full border border-white/30 hover:border-white text-xs font-bold text-white active:scale-95 transition-all cursor-pointer"
              >
                Ver discografía
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Compact Bio Snippet Card (matching Spotify Mobile artist intro card) */}
      {bio && (
        <div
          onClick={() => setExpandedBio((v) => !v)}
          className="mt-5 mx-1 rounded-xl bg-[#1e1e1e] active:bg-[#262626] transition-colors p-3.5 cursor-pointer"
        >
          <p className="text-xs text-white/90 leading-relaxed">
            {expandedBio ? bio : truncatedBio}
            {bio.length > 125 && (
              <span className="font-bold text-white ml-1.5">
                {expandedBio ? 'ver menos' : 'ver más'}
              </span>
            )}
          </p>
        </div>
      )}

      {/* 3. Artist Playlists ("Listas del artista") */}
      {playlists.length > 0 && (
        <div className="pt-6 pb-2 border-t border-white/10 mt-6 px-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[19px] font-bold text-white font-['SpotifyMixUITitle'] tracking-tight">
              Listas del artista
            </h3>
          </div>

          <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4 snap-x">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                onClick={() => onSelectPlaylist(pl)}
                className="w-36 shrink-0 flex flex-col cursor-pointer active:scale-95 transition-transform snap-start"
              >
                <div className="w-36 h-36 rounded-[4px] overflow-hidden mb-2 shadow-lg bg-[#242424] flex items-center justify-center">
                  {pl.image ? (
                    <img
                      src={pl.image}
                      alt={pl.name}
                      onError={handleImageError}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/40">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="font-semibold text-white text-[13px] line-clamp-2 leading-snug">
                  {pl.name}
                </p>
                <p className="text-xs text-[#b3b3b3] mt-0.5 truncate w-full">
                  {pl.owner || artistName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Discography Overlay Screen when tapping "Ver discografía" / "Mostrar todos" */}
      {isFullDiscographyOpen && (
        <div className="fixed inset-0 z-[120] bg-[#121212] flex flex-col overflow-hidden animate-fadeIn">
          <div className="px-4 py-3 flex items-center gap-3 border-b border-white/10 bg-[#121212] shrink-0">
            <button
              type="button"
              onClick={() => setIsFullDiscographyOpen(false)}
              className="p-1.5 -ml-1 text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer"
              title="Volver"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.54 21.15L6.39 12l9.15-9.15.71.71L7.81 12l8.44 8.44-.71.71z" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[#b3b3b3] truncate">{artistName}</p>
              <h2 className="text-lg font-black text-white font-['SpotifyMixUITitle'] leading-tight">
                Discografía
              </h2>
            </div>
          </div>

          <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0 border-b border-white/5">
            {fullFilters.map((f) => {
              const active = activeFullFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFullFilter(f.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    active ? 'bg-[#1ed760] text-black' : 'bg-white/10 text-white'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 pb-24 space-y-3">
            {fullDiscographyItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setIsFullDiscographyOpen(false);
                  onSelectAlbum(item);
                }}
                className="flex items-center gap-3.5 rounded-lg active:bg-white/10 transition-colors cursor-pointer py-0.5"
              >
                <div className="w-16 h-16 rounded-[4px] overflow-hidden bg-[#242424] shrink-0 shadow">
                  {item.cover ? (
                    <img
                      src={item.cover}
                      alt={item.name}
                      onError={handleImageError}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/40">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-white truncate">{item.name}</p>
                  <p className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                    {formatMobileReleaseSubtitle(item)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
