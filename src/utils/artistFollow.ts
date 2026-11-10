/**
 * "Seguir" an artist: like the artist page's own button, the artist goes to Tu biblioteca
 * (id "art-<id>", the same the artist page uses), so every "Seguir" button shows the same state.
 */
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import type { Playlist } from '../types/spotify';

export const artistLibraryId = (artistId?: string | null, name?: string | null) => {
  const id = String(artistId || '').replace(/^spotify:artist:/i, '').replace(/^art-/, '');
  return id ? `art-${id}` : name ? `art-${name.toLowerCase().replace(/\s+/g, '-')}` : '';
};

export function isFollowingArtist(artistId?: string | null, name?: string | null): boolean {
  const id = artistLibraryId(artistId, name);
  return !!id && useSpotifyDataStore.getState().playlists.some((p) => p.id === id);
}

/** Returns whether the artist is followed afterwards */
export function toggleFollowArtist(artist: { id?: string | null; name: string; image?: string }): boolean {
  const id = artistLibraryId(artist.id, artist.name);
  if (!id) return false;
  const st = useSpotifyDataStore.getState();
  let list: string[] = [];
  try {
    list = JSON.parse(localStorage.getItem('spotifree_saved_library_playlists') || '[]');
  } catch {}
  if (st.playlists.some((p) => p.id === id)) {
    st.deletePlaylist(id);
    list = list.filter((x) => x !== id);
    try {
      localStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(list));
    } catch {}
    return false;
  }
  const entry: Playlist = {
    id,
    name: artist.name,
    description: 'Artista',
    images: artist.image ? [{ url: artist.image }] : [],
    owner: { id: 'spotify', display_name: 'Spotify' },
    type: 'artist',
    tracks: { total: 0, items: [] },
  } as Playlist;
  st.addCustomPlaylist(entry);
  if (!list.includes(id)) list.push(id);
  try {
    localStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(list));
  } catch {}
  return true;
}
