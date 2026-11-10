/**
 * Small pieces of collaborative playlists: the members' stacked avatars in the header and the
 * little avatar of who added each song (like Spotify).
 */
import { useEffect, useState } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { getSharedMembers, type SharedMember } from '../../services/sharedPlaylists';

/** shared_id of a playlist of the library (undefined when it isn't collaborative) */
export function useSharedCode(...ids: Array<string | undefined | null>): string | undefined {
  return useSpotifyDataStore((s) => {
    const p: any = s.playlists.find((x) => ids.includes(x.id));
    return p?.shared_id ? String(p.shared_id) : undefined;
  });
}

/** Members of a shared playlist, repainted whenever the cloud sends a change */
export function useSharedMembers(code: string | undefined): Record<string, SharedMember> {
  const [, force] = useState(0);
  useEffect(() => {
    if (!code) return;
    const on = (e: Event) => {
      if ((e as CustomEvent).detail?.code === code) force((n) => n + 1);
    };
    window.addEventListener('spotifree:shared-playlist', on);
    return () => window.removeEventListener('spotifree:shared-playlist', on);
  }, [code]);
  return getSharedMembers(code);
}

function Avatar({ name, url, size }: { name: string; url?: string; size: number }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return url ? (
    <img src={url} alt={name} title={name} className="rounded-full object-cover bg-[#333] shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span
      title={name}
      className="rounded-full bg-[#535353] text-white font-bold flex items-center justify-center shrink-0 leading-none"
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.5)) }}
    >
      {initial}
    </span>
  );
}

/** Header: stacked avatars + "Colaborativa · N personas" */
export function SharedMembersRow({ code }: { code: string }) {
  const members = Object.values(useSharedMembers(code)).sort((a, b) => a.joinedAt - b.joinedAt);
  if (!members.length) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-[#b3b3b3] font-medium">
      <div className="flex -space-x-1.5">
        {members.slice(0, 5).map((m, i) => (
          <span key={i} className="ring-2 ring-[#121212] rounded-full">
            <Avatar name={m.name} url={m.avatar} size={20} />
          </span>
        ))}
      </div>
      <span>
        Colaborativa · {members.length} {members.length === 1 ? 'persona' : 'personas'}
      </span>
    </div>
  );
}

/** Row: little avatar of who added the song */
export function AddedByAvatar({ members, track, size = 14 }: { members: Record<string, SharedMember>; track: any; size?: number }) {
  const by = track?.added_by;
  if (!by?.id) return null;
  const m = members[by.id];
  return <Avatar name={m?.name || by.name || ''} url={m?.avatar} size={size} />;
}
