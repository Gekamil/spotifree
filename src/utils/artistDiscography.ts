export interface ArtistReleaseItem {
  id: string;
  name: string;
  cover: string | null;
  releaseDate?: string;
  year?: string;
  recordType: 'album' | 'single' | 'ep' | 'compile';
  fans?: number;
  isLatest?: boolean;
  artistName?: string;
}

export interface ArtistPlaylistItem {
  id: string;
  name: string;
  image: string | null;
  owner?: string;
  description?: string;
}

export type DiscographyFilter = 'popular' | 'album' | 'single_ep' | 'compile';

export function formatReleaseTypeLabel(recordType: ArtistReleaseItem['recordType']): string {
  if (recordType === 'single') return 'Sencillo';
  if (recordType === 'ep') return 'EP';
  if (recordType === 'compile') return 'Recopilatorio';
  return 'Álbum';
}

export function formatDesktopReleaseSubtitle(item: ArtistReleaseItem): string {
  const typeLabel = formatReleaseTypeLabel(item.recordType);
  if (item.isLatest) return `Último lanzamiento • ${typeLabel}`;
  return item.year ? `${item.year} • ${typeLabel}` : typeLabel;
}

export function formatMobileReleaseSubtitle(item: ArtistReleaseItem): string {
  const typeLabel = formatReleaseTypeLabel(item.recordType);
  if (item.isLatest && item.year) return `Último lanzamiento • ${typeLabel} • ${item.year}`;
  if (item.isLatest) return `Último lanzamiento • ${typeLabel}`;
  return item.year ? `${typeLabel} • ${item.year}` : typeLabel;
}

export function filterAndSortDiscography(
  items: ArtistReleaseItem[],
  filter: DiscographyFilter
): ArtistReleaseItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (filter === 'popular') {
    return [...items].sort((a, b) => {
      const scoreA = (a.fans || 0) + (a.isLatest ? 50000 : 0) + (a.recordType === 'album' ? 15000 : 0);
      const scoreB = (b.fans || 0) + (b.isLatest ? 50000 : 0) + (b.recordType === 'album' ? 15000 : 0);
      return scoreB - scoreA;
    });
  }
  if (filter === 'album') return items.filter((it) => it.recordType === 'album');
  if (filter === 'single_ep') return items.filter((it) => it.recordType === 'single' || it.recordType === 'ep');
  return items.filter((it) => it.recordType === 'compile');
}
