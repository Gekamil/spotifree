/**
 * Friends from "Escuchar juntos": the people in the current session, and the ones this device
 * listened with before (kept on the device, most recent first). Shown in Settings.
 */
import { create } from 'zustand';
import { useSharedSessionStore, type SessionParticipant } from './sharedSessionService';

export interface ListenFriend {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  lastSeen: number;
  wasHost?: boolean;
}

const KEY = 'spotifree_listen_friends';
const MAX = 12;

function load(): ListenFriend[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const useListenFriends = create<{ recent: ListenFriend[] }>(() => ({ recent: typeof window === 'undefined' ? [] : load() }));

/** Same person again (new id each session): matched by name */
const sameFriend = (a: { id: string; name: string }, b: { id: string; name: string }) =>
  a.id === b.id || a.name.trim().toLowerCase() === b.name.trim().toLowerCase();

function remember(people: SessionParticipant[], me: string) {
  const others = people.filter((p) => p.id !== me && p.name);
  if (!others.length) return;
  let list = useListenFriends.getState().recent.slice();
  for (const p of others) {
    list = list.filter((f) => !sameFriend(f, p));
    list.unshift({ id: p.id, name: p.name, color: p.color, avatar: p.avatar, lastSeen: Date.now(), wasHost: p.isHost });
  }
  list = list.slice(0, MAX);
  useListenFriends.setState({ recent: list });
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

let started = false;
/** Starts remembering who joins this device's sessions */
export function initListenFriends() {
  if (started || typeof window === 'undefined') return;
  started = true;
  let lastSig = '';
  useSharedSessionStore.subscribe((s) => {
    if (!s.isInSession) return;
    const sig = s.participants.map((p) => `${p.id}:${p.name}:${p.avatar ? 1 : 0}`).join('|');
    if (sig === lastSig) return;
    lastSig = sig;
    remember(s.participants, s.myParticipantId);
  });
}

export function forgetListenFriend(id: string) {
  const list = useListenFriends.getState().recent.filter((f) => f.id !== id);
  useListenFriends.setState({ recent: list });
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}
