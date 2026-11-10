/**
 * Automatic tests of the app's own logic (no browser, no network, no real account):
 * search order, "No me interesa", collaborative-playlist merge, the trash that travels in the
 * cloud account and the account document the database rules accept.
 * Run: node tests/app_logic.test.js (part of npm test)
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

// Lets Node load the app's .ts files by their extension-less imports
registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z0-9]+$/i.test(specifier) && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
  // Vite's import.meta.env doesn't exist in Node: an empty one (no Firebase project, nothing connects)
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    if (url.includes('/src/') && /\.ts$/.test(url) && result.source) {
      const src = String(result.source);
      if (src.includes('import.meta.env')) return { ...result, source: src.replaceAll('import.meta.env', '({} as any)') };
    }
    return result;
  },
});

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new MemoryStorage();
globalThis.window = globalThis.window || { dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
if (typeof globalThis.CustomEvent === 'undefined') globalThis.CustomEvent = class CustomEvent extends Event { constructor(t, o) { super(t); this.detail = o?.detail; } };

const { rankSearchTracks, searchScore, normText } = await import('../src/utils/searchRanking.ts');
const notInterested = await import('../src/utils/notInterested.ts');
const { mergeSharedTracks } = await import('../src/services/sharedPlaylistMerge.ts');
const trash = await import('../src/services/playlistTrash.ts');
const { prepareUserDocForFirestore } = await import('../src/services/firebase.ts');

const song = (name, artist, id = `${name}-${artist}`) => ({ id, name, artists: [{ id: artist, name: artist }], album: { id: 'a', name: 'a', images: [] }, duration_ms: 1000 });

describe('Search order', () => {
  it('"bad bunny" puts Bad Bunny songs before songs called "Bad"', () => {
    const list = [song('Bad', 'Michael Jackson'), song('Bad Romance', 'Lady Gaga'), song('Tití Me Preguntó', 'Bad Bunny'), song('Bad Habits', 'Ed Sheeran'), song('Monaco', 'Bad Bunny')];
    const out = rankSearchTracks('bad bunny', list).map((t) => t.artists[0].name);
    assert.deepEqual(out.slice(0, 2), ['Bad Bunny', 'Bad Bunny']);
  });

  it('the real song goes before karaoke / lullaby versions', () => {
    const list = [song('Flowers (Karaoke Version)', 'Sing2Piano'), song('Flowers (Lullaby)', 'Rockabye Baby!'), song('Flowers', 'Miley Cyrus')];
    assert.equal(rankSearchTracks('flowers', list)[0].artists[0].name, 'Miley Cyrus');
  });

  it('unless the karaoke version was asked for', () => {
    const list = [song('Flowers', 'Miley Cyrus'), song('Flowers (Karaoke Version)', 'Sing2Piano')];
    assert.equal(rankSearchTracks('flowers karaoke', list)[0].artists[0].name, 'Sing2Piano');
  });

  it('"song artist" finds that exact song first', () => {
    const list = [song('Monaco', 'Some Cover Band'), song('Tití Me Preguntó', 'Bad Bunny'), song('Monaco', 'Bad Bunny')];
    assert.equal(rankSearchTracks('monaco bad bunny', list)[0].id, 'Monaco-Bad Bunny');
  });

  it('accents and capitals do not matter; equal scores keep the original order', () => {
    assert.equal(normText('Tití ME Preguntó'), 'titi me pregunto');
    assert.ok(searchScore('titi me pregunto', song('Tití Me Preguntó', 'Bad Bunny')) > 0);
    const a = song('Uno', 'X', 'a');
    const b = song('Uno', 'X', 'b');
    assert.deepEqual(rankSearchTracks('uno', [a, b]).map((t) => t.id), ['a', 'b']);
  });
});

describe('No me interesa', () => {
  beforeEach(() => localStorage.clear());

  it('marks, filters and undoes per song (same song with another id or "(Remastered)" too)', () => {
    localStorage.setItem('spotifree_active_user_id', 'user-a');
    const s = song('Despacito', 'Luis Fonsi', 'id1');
    notInterested.markNotInterested(s);
    assert.ok(notInterested.isNotInterested(song('Despacito (Remastered)', 'Luis Fonsi', 'id2')));
    assert.deepEqual(notInterested.withoutNotInterested([s, song('Otra', 'X')]).map((t) => t.name), ['Otra']);
    notInterested.undoNotInterested(s);
    assert.ok(!notInterested.isNotInterested(s));
  });

  it('is kept per account', () => {
    localStorage.setItem('spotifree_active_user_id', 'user-a');
    notInterested.markNotInterested(song('Gasolina', 'Daddy Yankee'));
    localStorage.setItem('spotifree_active_user_id', 'user-b');
    assert.ok(!notInterested.isNotInterested(song('Gasolina', 'Daddy Yankee')));
  });
});

describe('Collaborative playlist merge', () => {
  const t = (id) => ({ id });
  const ids = (l) => l.map((x) => x.id).join(',');

  it('two people adding at the same time keep both songs', () => {
    const base = [t('a'), t('b')];
    const remote = [t('a'), t('b'), t('x')]; // the other person added x
    const mine = [t('a'), t('b'), t('y')]; // I added y
    assert.equal(ids(mergeSharedTracks(base, mine, remote)), 'a,b,x,y');
  });

  it('a removal here is applied without undoing what others added', () => {
    assert.equal(ids(mergeSharedTracks([t('a'), t('b')], [t('a')], [t('a'), t('b'), t('x')])), 'a,x');
  });

  it('a reorder here keeps my order and puts the others\' new songs after', () => {
    assert.equal(ids(mergeSharedTracks([t('a'), t('b'), t('c')], [t('c'), t('a'), t('b')], [t('a'), t('b'), t('c'), t('x')])), 'c,a,b,x');
  });

  it('no duplicates when both added the same song, and a size limit', () => {
    assert.equal(ids(mergeSharedTracks([], [t('a')], [t('a')])), 'a');
    const many = Array.from({ length: 20 }, (_, i) => t(`s${i}`));
    assert.equal(mergeSharedTracks([], many, [], 10).length, 10);
  });

  it('nothing changed here leaves the cloud version as it is', () => {
    const base = [t('a'), t('b')];
    assert.equal(ids(mergeSharedTracks(base, base, [t('b'), t('a'), t('z')])), 'b,a,z');
  });
});

describe('Playlist trash in the cloud account', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the newest playlists and at most ~600 songs (the account holds 1 MB)', () => {
    localStorage.setItem('spotifree_active_user_id', 'u1');
    const pl = (i, n) => ({ id: `p${i}`, name: `P${i}`, images: [], owner: { id: 'u1' }, tracks: { total: n, items: Array.from({ length: n }, (_, k) => song(`S${i}-${k}`, 'A')) } });
    for (let i = 0; i < 6; i++) trash.addToTrash(pl(i, 250));
    const { playlistTrash } = trash.trashForCloud();
    const songs = playlistTrash.reduce((n, e) => n + e.playlist.tracks.items.length, 0);
    assert.ok(songs <= 600, `${songs} songs`);
    assert.equal(playlistTrash[0].id, 'p5'); // newest first
    assert.ok(JSON.stringify(playlistTrash).length < 250000);
  });
});

describe('Account document for the database', () => {
  it('refuses accounts without a valid email', () => {
    assert.equal(prepareUserDocForFirestore('uid1', { email: 'no-es-un-correo' }), null);
  });

  it('keeps only the fields the rules accept and fits in 1 MB', () => {
    const big = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, name: `P${i}`, tracks: { total: 800, items: Array.from({ length: 800 }, (_, k) => song(`Canción ${k} de una playlist con un nombre largo`, `Artista ${k}`)) } }));
    const out = prepareUserDocForFirestore('uid1', { email: 'Test@Example.com', displayName: '  Ana  ', playlists: big, unknownField: 1, settings: { a: 1 } });
    assert.ok(out);
    assert.equal(out.uid, 'uid1');
    assert.equal(out.email, 'test@example.com');
    assert.equal(out.displayName, 'Ana');
    assert.ok(!('unknownField' in out));
    assert.deepEqual(out.stats.appSettings, { a: 1 });
    assert.ok(Buffer.byteLength(JSON.stringify(out)) < 1_000_000);
  });
});
