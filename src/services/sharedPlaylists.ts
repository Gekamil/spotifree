/**
 * Shared (collaborative) playlists, like Spotify's: the owner invites with a link, everyone who
 * opens it can add, remove and reorder songs, changes arrive in real time and each song shows who
 * added it.
 *
 * Storage: Firestore, collection "shared_sessions" (its rules already allow it), one document per
 * playlist with id "PL…" and kind "playlist":
 *   { kind, name, description, image, ownerId, ownerName, members: { id: {name, avatar, joinedAt} },
 *     tracks: [song + added_by {id, name} + added_at], updatedAt, updatedBy }
 * Locally it's a normal playlist of the library with `shared_id` = the document id.
 *
 * Simultaneous edits: each push is a transaction that merges this device's changes (since the
 * last version it saw) into the latest version in the cloud, so two people adding at once keep both.
 */
import { doc, getDoc, onSnapshot, runTransaction, setDoc, type Unsubscribe } from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';
import type { Playlist, Track } from '../types/spotify';
import { mergeSharedTracks, MAX_SHARED_TRACKS } from './sharedPlaylistMerge';

export interface SharedMember {
  name: string;
  avatar?: string;
  joinedAt: number;
}
interface SharedDoc {
  kind: 'playlist';
  name: string;
  description?: string;
  image?: string;
  ownerId: string;
  ownerName: string;
  members: Record<string, SharedMember>;
  tracks: Track[];
  updatedAt: number;
  updatedBy: string;
}

const COLLECTION = 'shared_sessions';
const MAX_TRACKS = MAX_SHARED_TRACKS;

// ---------------------------------------------------------------------------
// Who I am
// ---------------------------------------------------------------------------
export function myMemberId(): string {
  const u: any = useSpotifyDataStore.getState().user;
  if (u?.id) return String(u.id);
  try {
    let id = localStorage.getItem('spotifree_device_id');
    if (!id) {
      id = `dev-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('spotifree_device_id', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}
function myMember(): SharedMember {
  const u: any = useSpotifyDataStore.getState().user;
  let avatar: string | undefined;
  try {
    const raw = localStorage.getItem(`spotifree_custom_profile_${u?.id || 'default'}`) || localStorage.getItem('spotifree_custom_profile');
    const custom = raw ? JSON.parse(raw)?.avatarUrl : '';
    const url = custom || u?.images?.[0]?.url || '';
    if (/^https?:\/\//.test(url) || (url.startsWith('data:image') && url.length < 60000)) avatar = url;
  } catch {}
  return { name: (u?.display_name || 'Invitado').slice(0, 60), ...(avatar ? { avatar } : {}), joinedAt: Date.now() };
}

const slim = (t: any, fallbackBy?: { id: string; name: string }): Track => {
  const by = t.added_by && typeof t.added_by === 'object' && t.added_by.id ? { id: String(t.added_by.id), name: String(t.added_by.name || '') } : fallbackBy;
  return {
    id: t.id,
    name: t.name,
    duration_ms: t.duration_ms || 0,
    artists: (t.artists || []).slice(0, 3).map((a: any) => ({ id: a?.id || '', name: a?.name || '' })),
    album: { id: t.album?.id || '', name: t.album?.name || '', images: t.album?.images?.[0]?.url ? [{ url: t.album.images[0].url }] : [] },
    added_at: t.added_at || new Date().toISOString(),
    ...(by ? { added_by: by } : {}),
  } as Track;
};
const ids = (items: Track[] = []) => items.map((t) => t.id);
const newCode = () => `PL${Math.random().toString(36).slice(2, 7).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;

export const inviteLink = (code: string) => `${window.location.origin}/?collab=${encodeURIComponent(code)}`;

// ---------------------------------------------------------------------------
// Live sync of every shared playlist in the library
// ---------------------------------------------------------------------------
const subs = new Map<string, Unsubscribe>(); // code -> unsubscribe
const lastSeen = new Map<string, Track[]>(); // code -> songs as last synced (base of the merge)
const members = new Map<string, Record<string, SharedMember>>();
let applyingRemote = false;
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Members of a shared playlist (avatars in the header and rows) */
export function getSharedMembers(code: string | undefined | null): Record<string, SharedMember> {
  return (code && members.get(code)) || {};
}

function localIdFor(code: string): string | null {
  const p = useSpotifyDataStore.getState().playlists.find((x: any) => x.shared_id === code);
  return p?.id || null;
}

/** Codes with a change made here that isn't in the cloud yet (it must not be overwritten) */
const pending = new Set<string>();

/** Puts the cloud's songs in the local playlist */
function applyToLocal(code: string, tracks: Track[], name: string) {
  const localId = localIdFor(code);
  if (!localId) return;
  const st = useSpotifyDataStore.getState();
  const local = st.playlistDetailsCache[localId] || st.playlists.find((p) => p.id === localId);
  // The cloud decides what is in a shared playlist: songs another member added back must not stay
  // hidden here, and the device's own copies of the list's songs must match (the playlist screens
  // add those back otherwise)
  try {
    localStorage.removeItem(`spotifree_removed_tracks_${localId}`);
    const json = JSON.stringify(tracks);
    const keys = new Set([`spotifree_playlist_tracks_${localId}`]);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('spotifree_playlist_tracks_') && k.endsWith(`_${localId}`)) keys.add(k);
    }
    for (const k of keys) if (localStorage.getItem(k) !== json) localStorage.setItem(k, json);
  } catch {}
  const sig = (items: Track[] = []) => items.map((t: any) => `${t.id}:${t.added_by?.id || ''}`).join('|');
  if (local && sig(local.tracks?.items) === sig(tracks) && local.name === name) return;
  applyingRemote = true;
  try {
    st.updatePlaylist(localId, { name, tracks: { total: tracks.length, items: tracks } } as any);
    st.cachePlaylistDetails({ ...(local || ({} as Playlist)), id: localId, name, tracks: { total: tracks.length, items: tracks } } as Playlist);
  } finally {
    applyingRemote = false;
  }
}

function applyRemote(code: string, data: SharedDoc) {
  members.set(code, data.members || {});
  // repaint avatars / "who added it" even when the songs are the same
  window.dispatchEvent(new CustomEvent('spotifree:shared-playlist', { detail: { code } }));
  // A change made here is on its way: it gets merged with this version when it is sent
  if (pending.has(code)) return;
  lastSeen.set(code, data.tracks || []);
  applyToLocal(code, data.tracks || [], data.name);
}

function subscribe(code: string) {
  if (subs.has(code) || !db) return;
  const unsub = onSnapshot(
    doc(db, COLLECTION, code),
    (snap) => {
      if (!snap.exists() || snap.metadata.hasPendingWrites) return;
      const data = snap.data() as SharedDoc;
      if (data?.kind !== 'playlist') return;
      applyRemote(code, data);
    },
    (err) => console.warn('[SharedPlaylists] subscription error', err)
  );
  subs.set(code, unsub);
}

const merge = (base: Track[], mine: Track[], remote: Track[]) => mergeSharedTracks(base, mine, remote, MAX_TRACKS);

async function push(code: string) {
  pushTimers.delete(code);
  const localId = localIdFor(code);
  const st = useSpotifyDataStore.getState();
  const local = localId ? st.playlistDetailsCache[localId] || st.playlists.find((p) => p.id === localId) : null;
  if (!db || !local) {
    pending.delete(code);
    return;
  }
  const me = myMemberId();
  const meName = myMember().name;
  const base = lastSeen.get(code) || [];
  const baseById = new Map(base.map((t) => [t.id, t]));
  // Songs this device added carry its name; the others keep who added them
  const mine = (local.tracks?.items || []).map((t: any) => slim(t, baseById.get(t.id)?.added_by as any || { id: me, name: meName }));
  let result: { tracks: Track[]; name: string } | null = null;
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db!, COLLECTION, code);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const remote = (snap.data() as SharedDoc).tracks || [];
      const merged = merge(base, mine, remote);
      const name = local.name || (snap.data() as SharedDoc).name;
      tx.update(ref, { tracks: merged, name, updatedAt: Date.now(), updatedBy: me });
      result = { tracks: merged, name };
    });
  } catch (e) {
    console.warn('[SharedPlaylists] could not save the change', e);
  }
  const r = result as { tracks: Track[]; name: string } | null;
  if (r) lastSeen.set(code, r.tracks);
  // Another change made here while this one was being sent: it goes next
  if (pushTimers.has(code)) return;
  pending.delete(code);
  // What the others added meanwhile now shows here too
  if (r) applyToLocal(code, r.tracks, r.name);
}

/** A shared playlist changed on this device: send it (shortly, several changes go together) */
function schedulePush(code: string) {
  if (applyingRemote) return;
  pending.add(code);
  const t = pushTimers.get(code);
  if (t) clearTimeout(t);
  pushTimers.set(code, setTimeout(() => void push(code), 600));
}

let started = false;
/** Keeps every shared playlist of the library in sync (call once at start) */
export function initSharedPlaylists() {
  if (started || typeof window === 'undefined' || !isFirebaseConfigured()) return;
  started = true;
  const sigOf = new Map<string, string>();
  const scan = () => {
    const shared = useSpotifyDataStore.getState().playlists.filter((p: any) => p.shared_id);
    const codes = new Set(shared.map((p: any) => String(p.shared_id)));
    for (const code of codes) subscribe(code);
    for (const [code, unsub] of subs) {
      if (!codes.has(code)) {
        unsub();
        subs.delete(code);
      }
    }
    // Local changes of a shared playlist's songs or name
    const st = useSpotifyDataStore.getState();
    for (const p of shared as any[]) {
      const full = st.playlistDetailsCache[p.id] || p;
      const sig = `${p.name}|${ids(full.tracks?.items || []).join(',')}`;
      const prev = sigOf.get(p.shared_id);
      sigOf.set(p.shared_id, sig);
      if (prev !== undefined && prev !== sig && lastSeen.has(p.shared_id)) schedulePush(p.shared_id);
    }
  };
  scan();
  useSpotifyDataStore.subscribe(scan);
}

/** Makes a playlist of the library collaborative and returns its invitation link */
export async function shareAsCollaborative(playlistId: string): Promise<string | null> {
  if (!isFirebaseConfigured() || !db) return null;
  const st = useSpotifyDataStore.getState();
  const p: any = st.playlistDetailsCache[playlistId] || st.playlists.find((x) => x.id === playlistId);
  if (!p) return null;
  if (p.shared_id) return inviteLink(p.shared_id);
  const code = newCode();
  const me = myMemberId();
  const member = myMember();
  const tracks = (p.tracks?.items || []).slice(0, MAX_TRACKS).map((t: any) => slim(t, { id: me, name: member.name }));
  const image = p.images?.[0]?.url && !String(p.images[0].url).startsWith('data:') ? p.images[0].url : '';
  const data: SharedDoc = {
    kind: 'playlist',
    name: p.name || 'Playlist',
    description: p.description || '',
    image,
    ownerId: me,
    ownerName: member.name,
    members: { [me]: member },
    tracks,
    updatedAt: Date.now(),
    updatedBy: me,
  };
  await setDoc(doc(db, COLLECTION, code), data);
  lastSeen.set(code, tracks);
  members.set(code, data.members);
  st.updatePlaylist(playlistId, { shared_id: code, collaborative: true, tracks: { total: tracks.length, items: tracks } } as any);
  subscribe(code);
  return inviteLink(code);
}

/** Opens an invitation: joins the playlist and adds it to the library. Returns its local id. */
export async function joinSharedPlaylist(code: string): Promise<string | null> {
  if (!isFirebaseConfigured() || !db || !/^PL[A-Z0-9]{4,20}$/.test(code)) return null;
  const existing = localIdFor(code);
  if (existing) return existing;
  const ref = doc(db, COLLECTION, code);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as SharedDoc;
  if (data.kind !== 'playlist') return null;
  const me = myMemberId();
  if (!data.members?.[me]) {
    await runTransaction(db, async (tx) => {
      const s = await tx.get(ref);
      if (!s.exists()) return;
      tx.update(ref, { [`members.${me}`]: myMember(), updatedAt: Date.now(), updatedBy: me });
    }).catch(() => {});
  }
  const localId = `shared-${code}`;
  lastSeen.set(code, data.tracks || []);
  members.set(code, { ...(data.members || {}), [me]: myMember() });
  useSpotifyDataStore.getState().addCustomPlaylist({
    id: localId,
    name: data.name,
    description: data.description || `Playlist colaborativa de ${data.ownerName}`,
    images: data.image ? [{ url: data.image }] : [],
    owner: { id: data.ownerId, display_name: data.ownerName },
    tracks: { total: (data.tracks || []).length, items: data.tracks || [] },
    is_custom: true,
    shared_id: code,
    collaborative: true,
  } as any);
  subscribe(code);
  return localId;
}

/** Stops sharing from this device (leaves the playlist as a normal one here) */
export function leaveSharedPlaylist(playlistId: string) {
  const st = useSpotifyDataStore.getState();
  const p: any = st.playlists.find((x) => x.id === playlistId);
  if (!p?.shared_id) return;
  const unsub = subs.get(p.shared_id);
  unsub?.();
  subs.delete(p.shared_id);
  st.updatePlaylist(playlistId, { shared_id: undefined, collaborative: false } as any);
}
