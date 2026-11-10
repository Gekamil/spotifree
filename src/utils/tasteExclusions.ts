/**
 * Spotify's "Excluir de tu perfil de gustos": what you play from these playlists doesn't teach
 * your mixes and recommendations (white noise, a kids' playlist...). Kept per account.
 */
const key = () => {
  try {
    return `spotifree_taste_excluded_${localStorage.getItem('spotifree_active_user_id') || 'active'}`;
  } catch {
    return 'spotifree_taste_excluded_active';
  }
};

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key()) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function isExcludedFromTaste(playlistId?: string | null): boolean {
  if (!playlistId) return false;
  return read().includes(playlistId);
}

/** Returns whether the playlist is excluded afterwards */
export function toggleExcludedFromTaste(playlistId: string): boolean {
  const list = read();
  const next = list.includes(playlistId) ? list.filter((x) => x !== playlistId) : [...list, playlistId];
  try {
    localStorage.setItem(key(), JSON.stringify(next.slice(-500)));
  } catch {}
  return next.includes(playlistId);
}
