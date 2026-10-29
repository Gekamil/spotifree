export interface SpotifyImage {
  url: string;
  height?: number;
  width?: number;
}

export interface ArtistRef {
  id: string;
  name: string;
}

export interface AlbumRef {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date?: string;
}

export interface Track {
  id: string;
  name: string;
  artists: ArtistRef[];
  album: AlbumRef;
  duration_ms: number;
  is_liked?: boolean;
  added_at?: string;
  added_by?: string | { id?: string; name?: string; avatarUrl?: string };
  playlistId?: string;
  preview_url?: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  type?: 'playlist' | 'album' | 'artist' | 'folder' | string;
  is_folder?: boolean;
  owner: {
    display_name: string;
    id: string;
  };
  tracks: {
    total: number;
    items?: Track[];
  };
  is_pinned?: boolean;
  color?: string; // Dominant background color for header gradient
}

export interface UserProfile {
  id: string;
  display_name: string;
  email: string;
  images: SpotifyImage[];
  followers: { total: number };
}
