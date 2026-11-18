/**
 * Centralized identifier helper for Spotifree AI DJ
 * Identifies DJ playlists by ID, name, description, or custom flag
 */
export function isAIDJPlaylist(playlist?: { id?: string; name?: string; is_dj?: boolean; description?: string } | null): boolean {
  if (!playlist) return false;
  const id = (playlist.id || '').toLowerCase().trim();
  const name = (playlist.name || '').toLowerCase().trim();
  const desc = (playlist.description || '').toLowerCase();

  return (
    id === 'spotify-dj' ||
    id === 'dj' ||
    id === 'ai-dj' ||
    id === 'tu-dj' ||
    id === 'personal-dj' ||
    id.includes('37i9dqzf1eykqdzj48dyyq') || // Spotify official DJ playlist URI
    Boolean((playlist as any).is_dj) ||
    name === 'dj' ||
    name === 'spotify dj' ||
    name === 'tu dj' ||
    name === 'ai dj' ||
    name.includes('tu dj personal') ||
    name.includes('personal dj') ||
    desc.includes('tu dj personal') ||
    desc.includes('tu dj con ia')
  );
}
