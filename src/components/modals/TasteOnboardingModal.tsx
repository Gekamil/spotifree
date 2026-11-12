import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { handleImageError } from '../../utils/imageFallback';
import { ARTIST_IMAGE_CACHE, getArtistPicture, persistArtistImage } from '../../utils/artistImage';
import { showGlobalToast } from '../../utils/globalToast';
import {
  saveOnboardingArtistSeeds,
  getOnboardingArtistSeeds,
  type OnboardingArtistSeed,
} from '../../services/spotifreeMixes';

interface OnboardingArtist {
  name: string;
  image: string;
  genre?: string;
}

// Curated list of popular artists across major genres with reliable CDN images
const DEFAULT_ONBOARDING_ARTISTS: OnboardingArtist[] = [
  {
    name: 'Bad Bunny',
    image: 'https://cdn-images.dzcdn.net/images/artist/9867d5112c6714c935a86b98b4dd288c/500x500-000000-80-0-0.jpg',
    genre: 'Reggaetón & Urbano',
  },
  {
    name: 'Taylor Swift',
    image: 'https://cdn-images.dzcdn.net/images/artist/9dc37b12d1b8c2ecab76f82db45bb389/500x500-000000-80-0-0.jpg',
    genre: 'Pop',
  },
  {
    name: 'Quevedo',
    image: 'https://cdn-images.dzcdn.net/images/artist/9f2a4ebcbb0920d0f77ea6bbda756d11/500x500-000000-80-0-0.jpg',
    genre: 'Urbano Latino',
  },
  {
    name: 'Rosalía',
    image: 'https://cdn-images.dzcdn.net/images/artist/335d259fa2bfa2f722c1db49ec85e888/500x500-000000-80-0-0.jpg',
    genre: 'Pop & Flamenco',
  },
  {
    name: 'Feid',
    image: 'https://cdn-images.dzcdn.net/images/artist/aa4b4943fcf3f27f8a7e4b9015ba6cf5/500x500-000000-80-0-0.jpg',
    genre: 'Reggaetón',
  },
  {
    name: 'Aitana',
    image: 'https://cdn-images.dzcdn.net/images/artist/8b965ba9eec81e7d235889ea8848db2c/500x500-000000-80-0-0.jpg',
    genre: 'Pop Español',
  },
  {
    name: 'Rauw Alejandro',
    image: 'https://cdn-images.dzcdn.net/images/artist/66258414fa1d6c81bb65c404cf9feef4/500x500-000000-80-0-0.jpg',
    genre: 'Reggaetón & R&B',
  },
  {
    name: 'Duki',
    image: 'https://cdn-images.dzcdn.net/images/artist/e7ef554a938cbb4fe4ce89ecabfc5577/500x500-000000-80-0-0.jpg',
    genre: 'Trap Argentino',
  },
  {
    name: 'Coldplay',
    image: 'https://cdn-images.dzcdn.net/images/artist/4c442cf8da7a5b3f7f985a11c81cbffc/500x500-000000-80-0-0.jpg',
    genre: 'Pop Rock',
  },
  {
    name: 'Billie Eilish',
    image: 'https://cdn-images.dzcdn.net/images/artist/605db084c6efcf0da67280fe2ad40d34/500x500-000000-80-0-0.jpg',
    genre: 'Alternative Pop',
  },
  {
    name: 'Travis Scott',
    image: 'https://cdn-images.dzcdn.net/images/artist/b6f50b86a8ff78b975e11c5e4070a931/500x500-000000-80-0-0.jpg',
    genre: 'Hip-Hop & Trap',
  },
  {
    name: 'Myke Towers',
    image: 'https://cdn-images.dzcdn.net/images/artist/c32906b29f9df3cf090ba285817d2da5/500x500-000000-80-0-0.jpg',
    genre: 'Reggaetón & Rap',
  },
  {
    name: 'The Weeknd',
    image: 'https://cdn-images.dzcdn.net/images/artist/5d2ff903b14e6669fec6f3743cfecaa6/500x500-000000-80-0-0.jpg',
    genre: 'R&B & Pop',
  },
  {
    name: 'Estopa',
    image: 'https://cdn-images.dzcdn.net/images/artist/cb8d9bc4e4ae328229b0a7aa1dbb1016/500x500-000000-80-0-0.jpg',
    genre: 'Rumba & Pop Rock',
  },
  {
    name: 'Mora',
    image: 'https://cdn-images.dzcdn.net/images/artist/241dc73ff262d2a4ea9767f3ae34293a/500x500-000000-80-0-0.jpg',
    genre: 'Trap & Reggaetón',
  },
  {
    name: 'Drake',
    image: 'https://cdn-images.dzcdn.net/images/artist/5f8ef858cf09f1dc854749f1dbb15745/500x500-000000-80-0-0.jpg',
    genre: 'Hip-Hop & Rap',
  },
  {
    name: 'Dua Lipa',
    image: 'https://cdn-images.dzcdn.net/images/artist/f1ff2e59df18c32f8dfc7a6e1fe0d453/500x500-000000-80-0-0.jpg',
    genre: 'Dance Pop',
  },
  {
    name: 'Melendi',
    image: 'https://cdn-images.dzcdn.net/images/artist/c176288b22a6136db6ff4c28c8efd927/500x500-000000-80-0-0.jpg',
    genre: 'Pop Rock Español',
  },
  {
    name: 'Bizarrap',
    image: 'https://cdn-images.dzcdn.net/images/artist/6f72c0c79ecbe7ba491295fcfaefbe13/500x500-000000-80-0-0.jpg',
    genre: 'EDM & Urban Sessions',
  },
  {
    name: 'C. Tangana',
    image: 'https://cdn-images.dzcdn.net/images/artist/91ff1465e903d8d6411dd78e3dbff0d0/500x500-000000-80-0-0.jpg',
    genre: 'Música Latina & Fusión',
  },
  {
    name: 'Harry Styles',
    image: 'https://cdn-images.dzcdn.net/images/artist/1e74f3d1b7a2ae552ae077a98dbcc221/500x500-000000-80-0-0.jpg',
    genre: 'Pop & Rock',
  },
  {
    name: 'Anuel AA',
    image: 'https://cdn-images.dzcdn.net/images/artist/77864df1fb3eebfba1a1c327fc0ff959/500x500-000000-80-0-0.jpg',
    genre: 'Trap Latino',
  },
  {
    name: 'Morat',
    image: 'https://cdn-images.dzcdn.net/images/artist/96815ae1c8a5a40b991da93382717efb/500x500-000000-80-0-0.jpg',
    genre: 'Folk Pop',
  },
  {
    name: 'Saiko',
    image: 'https://cdn-images.dzcdn.net/images/artist/154fa4fb596fc7ae01b547eeae17b62e/500x500-000000-80-0-0.jpg',
    genre: 'Urbano',
  },
  {
    name: 'Kendrick Lamar',
    image: 'https://cdn-images.dzcdn.net/images/artist/145465bb2446ff9d10825e6e87a2d8ff/500x500-000000-80-0-0.jpg',
    genre: 'Hip-Hop',
  },
  {
    name: 'Imagine Dragons',
    image: 'https://cdn-images.dzcdn.net/images/artist/f786851221f7dbfc823fe3df85e5015b/500x500-000000-80-0-0.jpg',
    genre: 'Pop Rock & Alt',
  },
  {
    name: 'Ozuna',
    image: 'https://cdn-images.dzcdn.net/images/artist/8b0e74f1b5c92c57f20108873041c2c2/500x500-000000-80-0-0.jpg',
    genre: 'Reggaetón',
  },
  {
    name: 'Shakira',
    image: 'https://cdn-images.dzcdn.net/images/artist/b619eebe2a50a1e34f811ee361f38e55/500x500-000000-80-0-0.jpg',
    genre: 'Pop Latino',
  },
  {
    name: 'Bruno Mars',
    image: 'https://cdn-images.dzcdn.net/images/artist/7339d6cfec9e761005ca7ff1d19d690a/500x500-000000-80-0-0.jpg',
    genre: 'Funk & Pop',
  },
  {
    name: 'Ed Sheeran',
    image: 'https://cdn-images.dzcdn.net/images/artist/a2608447d2f9d695b2909405f69f2010/500x500-000000-80-0-0.jpg',
    genre: 'Acoustic Pop',
  },
  {
    name: 'Arctic Monkeys',
    image: 'https://cdn-images.dzcdn.net/images/artist/3ba222384a86f9eef64cefa351658428/500x500-000000-80-0-0.jpg',
    genre: 'Indie Rock',
  },
  {
    name: 'Queen',
    image: 'https://cdn-images.dzcdn.net/images/artist/23049102ef70d24f0c43666d911a3d3c/500x500-000000-80-0-0.jpg',
    genre: 'Classic Rock',
  },
  {
    name: 'J Balvin',
    image: 'https://cdn-images.dzcdn.net/images/artist/bb8fa3cfa3aa8c92a95c80dfce05d3ee/500x500-000000-80-0-0.jpg',
    genre: 'Reggaetón',
  },
  {
    name: 'Manuel Carrasco',
    image: 'https://cdn-images.dzcdn.net/images/artist/931294fc6bca0f5761073cbcf799ff24/500x500-000000-80-0-0.jpg',
    genre: 'Pop Español',
  },
  {
    name: 'Eminem',
    image: 'https://cdn-images.dzcdn.net/images/artist/19bb70e8a7194d8cb845422896d8b94d/500x500-000000-80-0-0.jpg',
    genre: 'Hip-Hop',
  },
  {
    name: 'Gorillaz',
    image: 'https://cdn-images.dzcdn.net/images/artist/f1ff2e59df18c32f8dfc7a6e1fe0d453/500x500-000000-80-0-0.jpg',
    genre: 'Alternative & Electronic',
  },
];

export const TasteOnboardingModal: React.FC = () => {
  const { isTasteOnboardingOpen, closeTasteOnboarding } = useUIStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArtists, setSelectedArtists] = useState<Map<string, OnboardingArtistSeed>>(new Map());
  const [artistList, setArtistList] = useState<OnboardingArtist[]>(DEFAULT_ONBOARDING_ARTISTS);
  const [searchResults, setSearchResults] = useState<OnboardingArtist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize with any previously saved seeds & hydrate live portraits in parallel batches
  useEffect(() => {
    if (!isTasteOnboardingOpen) return;

    const existing = getOnboardingArtistSeeds();
    if (existing.length > 0) {
      const m = new Map<string, OnboardingArtistSeed>();
      for (const s of existing) {
        m.set(s.name.toLowerCase(), s);
      }
      setSelectedArtists(m);
    }

    let cancelled = false;
    const hydrateArtistPhotos = async () => {
      const batchSize = 6;
      for (let i = 0; i < DEFAULT_ONBOARDING_ARTISTS.length; i += batchSize) {
        if (cancelled) return;
        const batch = DEFAULT_ONBOARDING_ARTISTS.slice(i, i + batchSize);
        const resolved = await Promise.all(
          batch.map(async (artist) => {
            const cached = ARTIST_IMAGE_CACHE.get(artist.name.toLowerCase());
            if (cached) return { name: artist.name, image: cached };
            const live = await getArtistPicture(artist.name).catch(() => null);
            return live ? { name: artist.name, image: live } : null;
          })
        );
        if (cancelled) return;
        const updates = new Map<string, string>();
        for (const r of resolved) {
          if (r?.image) {
            updates.set(r.name.toLowerCase(), r.image);
            persistArtistImage(r.name, r.image);
          }
        }
        if (updates.size > 0) {
          setArtistList((prev) =>
            prev.map((item) => {
              const liveUrl = updates.get(item.name.toLowerCase());
              return liveUrl && liveUrl !== item.image ? { ...item, image: liveUrl } : item;
            })
          );
        }
      }
    };
    void hydrateArtistPhotos();

    return () => {
      cancelled = true;
    };
  }, [isTasteOnboardingOpen]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isTasteOnboardingOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTasteOnboarding();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTasteOnboardingOpen, closeTasteOnboarding]);

  // Live search with debounce
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Use fast backend search (avoids browser CORS issues with Deezer)
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&fast=1`);
        let mapped: OnboardingArtist[] = [];
        if (res.ok) {
          const data = await res.json();
          const items = data?.artists?.items;
          if (Array.isArray(items) && items.length > 0) {
            mapped = await Promise.all(
              items.slice(0, 16).map(async (item: any) => {
                let img = item.images?.[0]?.url || ARTIST_IMAGE_CACHE.get(String(item.name || '').toLowerCase()) || '';
                if (!img && item.name) {
                  img = (await getArtistPicture(item.name).catch(() => null)) || '';
                }
                if (img && item.name) persistArtistImage(item.name, img);
                return {
                  name: item.name,
                  image: img,
                  genre: 'Artista',
                };
              })
            );
          }
        }
        if (mapped.length === 0) {
          const filtered = artistList.filter((a) =>
            a.name.toLowerCase().includes(q.toLowerCase())
          );
          if (filtered.length > 0) {
            mapped = filtered;
          } else {
            const directPic = await getArtistPicture(q).catch(() => null);
            if (directPic) {
              mapped = [{ name: q, image: directPic, genre: 'Artista' }];
            }
          }
        }
        setSearchResults(mapped);
      } catch {
        // Fallback filter over existing list
        const filtered = artistList.filter((a) =>
          a.name.toLowerCase().includes(q.toLowerCase())
        );
        setSearchResults(filtered);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, artistList]);

  // Dynamic Spotify-style discovery: when selecting an artist, discover related artists
  const fetchRelatedArtists = useCallback(async (artistName: string) => {
    try {
      const res = await fetch(`/api/discover?artist=${encodeURIComponent(artistName)}&v=2`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.related) && data.related.length > 0) {
        const newArtists: OnboardingArtist[] = [];
        for (const rel of data.related.slice(0, 4)) {
          if (rel?.name && rel?.picture) {
            newArtists.push({
              name: rel.name,
              image: rel.picture,
              genre: `Relacionado con ${artistName}`,
            });
          }
        }
        if (newArtists.length > 0) {
          setArtistList((prev) => {
            const seen = new Set(prev.map((a) => a.name.toLowerCase()));
            const toAdd = newArtists.filter((a) => !seen.has(a.name.toLowerCase()));
            if (!toAdd.length) return prev;
            // Prepend new related artists right near the top of the grid
            return [...toAdd, ...prev];
          });
        }
      }
    } catch {}
  }, []);

  const toggleArtist = (artist: OnboardingArtist) => {
    const key = artist.name.toLowerCase();
    setSelectedArtists((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { name: artist.name, image: artist.image });
        // Trigger live related artist expansion!
        void fetchRelatedArtists(artist.name);
      }
      return next;
    });
  };

  const handleComplete = async () => {
    if (selectedArtists.size < 3 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const seeds = Array.from(selectedArtists.values());
      saveOnboardingArtistSeeds(seeds);
      showGlobalToast('¡Listo! Hemos preparado tus recomendaciones personalizadas.');
      closeTasteOnboarding();
    } catch (e) {
      console.warn('[TasteOnboarding] Error submitting', e);
      closeTasteOnboarding();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('spotifree_taste_onboarding_completed', 'true');
    } catch {}
    closeTasteOnboarding();
  };

  if (!isTasteOnboardingOpen) return null;

  const count = selectedArtists.size;
  const isReady = count >= 3;
  const displayedArtists = searchQuery.trim() ? searchResults : artistList;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 select-none animate-in fade-in duration-200"
      onClick={handleSkip}
    >
      <div
        className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl bg-[#121212] sm:rounded-2xl border border-white/10 flex flex-col overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-6 pb-4 sm:p-8 sm:pb-5 border-b border-white/[0.08] relative shrink-0">
          <button
            onClick={handleSkip}
            aria-label="Cerrar o posponer"
            className="absolute top-5 right-5 sm:top-6 sm:right-6 w-9 h-9 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>

          <div className="max-w-xl">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-['SpotifyMixUITitle']">
              Elige 3 o más artistas que te gusten.
            </h1>
            <p className="text-sm text-[#b3b3b3] mt-1.5 leading-relaxed">
              Configuraremos tus mixes diarios, novedades y sugerencias personalizadas para que tu app comience con música que te encante.
            </p>
          </div>

          {/* Search Bar */}
          <div className="mt-5 relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#b3b3b3]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar artistas..."
              className="w-full pl-10 pr-10 py-2.5 rounded-full bg-white/10 hover:bg-white/15 focus:bg-[#242424] text-white placeholder-[#8e8e8e] text-sm font-medium border border-transparent focus:border-white/30 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#b3b3b3] hover:text-white"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Artist Grid Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#b3b3b3]">
              <div className="w-8 h-8 border-2 border-[#1ed760] border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs">Buscando artistas...</p>
            </div>
          ) : displayedArtists.length === 0 ? (
            <div className="text-center py-16 text-[#b3b3b3]">
              <p className="text-base font-bold text-white">No se encontraron artistas</p>
              <p className="text-xs mt-1">Prueba con otro nombre o término de búsqueda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 sm:gap-6">
              {displayedArtists.map((artist) => {
                const key = artist.name.toLowerCase();
                const isSelected = selectedArtists.has(key);

                return (
                  <button
                    key={`${artist.name}-${key}`}
                    type="button"
                    onClick={() => toggleArtist(artist)}
                    className="flex flex-col items-center group relative text-center focus:outline-none cursor-pointer"
                  >
                    {/* Circle Avatar with Selection Rings */}
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full overflow-hidden bg-[#282828] transition-all duration-200">
                      <img
                        src={ARTIST_IMAGE_CACHE.get(key) || artist.image}
                        alt={artist.name}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          const imgEl = e.currentTarget;
                          if (imgEl.dataset.artistRetried) {
                            handleImageError(e);
                            return;
                          }
                          imgEl.dataset.artistRetried = '1';
                          void getArtistPicture(artist.name)
                            .then((liveUrl) => {
                              if (liveUrl && imgEl.src !== liveUrl) {
                                persistArtistImage(artist.name, liveUrl);
                                imgEl.src = liveUrl;
                                setArtistList((prev) =>
                                  prev.map((a) => (a.name.toLowerCase() === key ? { ...a, image: liveUrl } : a))
                                );
                              } else {
                                handleImageError({ currentTarget: imgEl } as React.SyntheticEvent<HTMLImageElement, Event>);
                              }
                            })
                            .catch(() => {
                              handleImageError({ currentTarget: imgEl } as React.SyntheticEvent<HTMLImageElement, Event>);
                            });
                        }}
                        className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                          isSelected
                            ? 'ring-4 ring-[#1ed760] ring-offset-2 ring-offset-[#121212] brightness-105'
                            : 'ring-1 ring-white/10 group-hover:ring-white/30'
                        }`}
                      />

                      {/* Green Checkmark Badge for Selected */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-lg animate-in zoom-in-75 duration-150">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}

                      {/* Subtle hover overlay */}
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                    </div>

                    {/* Artist Name & Genre */}
                    <div className="mt-2.5 w-full px-1">
                      <p
                        className={`text-xs sm:text-sm font-bold truncate transition-colors ${
                          isSelected ? 'text-[#1ed760]' : 'text-white group-hover:text-white'
                        }`}
                        title={artist.name}
                      >
                        {artist.name}
                      </p>
                      {artist.genre && (
                        <p className="text-[10px] text-[#8e8e8e] truncate mt-0.5">
                          {artist.genre}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Floating Bottom Action Bar */}
        <div className="absolute bottom-0 inset-x-0 bg-[#181818]/95 backdrop-blur-md border-t border-white/[0.08] p-4 px-6 flex items-center justify-between z-10 shadow-2xl">
          {/* Counter pill */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs sm:text-sm font-bold ${
                isReady ? 'text-[#1ed760]' : 'text-[#b3b3b3]'
              }`}
            >
              {isReady
                ? `✓ ${count} seleccionados`
                : `${count} de 3 seleccionados`}
            </span>
            {!isReady && (
              <span className="text-[11px] text-[#727272] hidden sm:inline">
                (Elige al menos 3 artistas)
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className="px-4 py-2 text-xs sm:text-sm font-bold text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
            >
              Omitir por ahora
            </button>

            <button
              type="button"
              onClick={handleComplete}
              disabled={!isReady || isSubmitting}
              className={`px-6 sm:px-8 py-2.5 sm:py-3 rounded-full font-black text-xs sm:text-sm tracking-wide transition-all shadow-lg ${
                isReady
                  ? 'bg-[#1ed760] text-black hover:scale-105 active:scale-95 cursor-pointer shadow-[0_4px_20px_rgba(30,215,96,0.4)]'
                  : 'bg-[#535353] text-[#a7a7a7] cursor-not-allowed opacity-60'
              }`}
            >
              {isSubmitting ? 'Preparando...' : isReady ? 'Empezar a escuchar' : 'Elige al menos 3'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
