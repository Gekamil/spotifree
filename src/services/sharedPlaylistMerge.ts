/**
 * Merge of a collaborative playlist when several people edit it at once (pure function,
 * tests/app_logic.test.js). Applies this device's change (base -> mine) on top of the latest
 * version in the cloud (remote): songs added here are appended, songs removed here are removed,
 * and what the others did meanwhile is kept.
 */
export interface MergeTrack {
  id: string;
}

export const MAX_SHARED_TRACKS = 1000;

export function mergeSharedTracks<T extends MergeTrack>(base: T[], mine: T[], remote: T[], max = MAX_SHARED_TRACKS): T[] {
  const ids = (items: T[]) => items.map((t) => t.id);
  const baseIds = new Set(ids(base));
  const mineIds = new Set(ids(mine));
  const added = mine.filter((t) => !baseIds.has(t.id));
  const removed = new Set(base.filter((t) => !mineIds.has(t.id)).map((t) => t.id));
  let out = remote.filter((t) => !removed.has(t.id));
  const outIds = new Set(ids(out));
  for (const t of added) {
    if (!outIds.has(t.id)) {
      out.push(t);
      outIds.add(t.id);
    }
  }
  // Only reordered here (nothing added or removed): this device's order wins for its songs,
  // songs the others added meanwhile go after them
  if (!added.length && !removed.size && ids(mine).join('|') !== ids(base).join('|')) {
    const pos = new Map(ids(mine).map((id, i) => [id, i] as [string, number]));
    const known = out.filter((t) => pos.has(t.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
    const extra = out.filter((t) => !pos.has(t.id));
    out = [...known, ...extra];
  }
  return out.slice(0, max);
}
