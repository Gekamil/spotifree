import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z0-9]+$/i.test(specifier) && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (fs.existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});

const { rankSearchPlaylists, playlistSearchScore, PLAYLIST_FRANCHISE_MAP } = await import('../src/utils/searchRanking.ts');
const { FRANCHISE_SEARCH_ALIASES, rankPlaylists } = await import('../api/_lib/extract-session.js');

describe('v076: Official Spotify Playlist Search Ranking, Dynamic Covers and Franchise Expansion', () => {
  const rankingSource = fs.readFileSync(path.resolve('src/utils/searchRanking.ts'), 'utf8');
  const spotifyApiSource = fs.readFileSync(path.resolve('src/services/spotifyApi.ts'), 'utf8');
  const mobileSearchSource = fs.readFileSync(path.resolve('src/components/mobile/MobileSearchView.tsx'), 'utf8');
  const extractSessionSource = fs.readFileSync(path.resolve('api/_lib/extract-session.js'), 'utf8');
  const serverSource = fs.readFileSync(path.resolve('server.mjs'), 'utf8');
  const apiSearchSource = fs.readFileSync(path.resolve('api/search.js'), 'utf8');
  const playlistSource = fs.readFileSync(path.resolve('api/playlist.js'), 'utf8');

  it('1. Strict Zero-Emoji Rule: No emojis anywhere in modified code', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    assert.strictEqual(emojiRegex.test(rankingSource), false, 'searchRanking must not contain emojis');
    assert.strictEqual(emojiRegex.test(spotifyApiSource), false, 'spotifyApi must not contain emojis');
    assert.strictEqual(emojiRegex.test(mobileSearchSource), false, 'MobileSearchView must not contain emojis');
    assert.strictEqual(emojiRegex.test(extractSessionSource), false, 'extract-session must not contain emojis');
    assert.strictEqual(emojiRegex.test(serverSource), false, 'server.mjs must not contain emojis');
    assert.strictEqual(emojiRegex.test(apiSearchSource), false, 'api/search.js must not contain emojis');
    assert.strictEqual(emojiRegex.test(playlistSource), false, 'api/playlist.js must not contain emojis');
  });

  it('2. Backend Bug Fix: server.mjs uses deezerTracksRes?.total, preventing ReferenceError dzTracks', () => {
    assert.strictEqual(serverSource.includes('dzTracks.total'), false, 'server.mjs must not reference dzTracks.total');
    assert.ok(
      serverSource.includes('typeof deezerTracksRes?.total === \'number\' ? deezerTracksRes.total'),
      'server.mjs must use deezerTracksRes?.total'
    );
  });

  it('3. Franchise Search Aliases: Maps Spanish franchise queries to official Spotify playlist names', () => {
    assert.ok(Array.isArray(FRANCHISE_SEARCH_ALIASES), 'FRANCHISE_SEARCH_ALIASES must be exported as an array');
    const hgMatch = FRANCHISE_SEARCH_ALIASES.find((f) => f.match.test('los juegos del hambre'));
    assert.ok(hgMatch, 'Must match los juegos del hambre');
    assert.strictEqual(hgMatch.alias, 'The Hunger Games');

    const hgMatchShort = FRANCHISE_SEARCH_ALIASES.find((f) => f.match.test('juegos del hambre'));
    assert.ok(hgMatchShort, 'Must match juegos del hambre');

    const lotrMatch = FRANCHISE_SEARCH_ALIASES.find((f) => f.match.test('el señor de los anillos'));
    assert.ok(lotrMatch, 'Must match señor de los anillos');
  });

  it('4. Playlist Relevance Ranking: Official Spotify Hunger Games playlist ranks #0 over audiobooks', () => {
    const samplePlaylists = [
      {
        id: '1Dey42oZkJZKnyhuI9cHco',
        name: 'Los juegos del hambre saga completa Audiolibro',
        owner: { display_name: 'FerRava2803', id: 'ferrava' },
        description: 'Audiolibro completo de la saga',
        images: [{ url: 'https://i.scdn.co/image/audiobook.jpg' }],
      },
      {
        id: '2jVRVbDoJqHP4FAqNritj9',
        name: 'Los juegos del hambre soundtrack',
        owner: { display_name: 'Priscila', id: 'priscila' },
        description: 'Banda sonora completa de las peliculas',
        images: [{ url: 'https://i.scdn.co/image/soundtrack.jpg' }],
      },
      {
        id: '37i9dQZF1DWT3BGkpbwZZs',
        name: 'The Hunger Games: Sunrise on the Reaping Official Playlist',
        owner: { display_name: 'Spotify', id: 'spotify' },
        description: 'The official playlist for The Hunger Games: Sunrise on the Reaping.',
        images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706f000000013618887db4f9589853327eb9' }],
      },
      {
        id: '50hOyOVps0GOEMtumXGlNZ',
        name: 'Saga - Los Juegos del Hambre - Lee Conmigo',
        owner: { display_name: 'Cesar Aguilar Mendez', id: 'cesar' },
        description: 'Capitulos leidos de los juegos del hambre',
        images: [{ url: 'https://i.scdn.co/image/reading.jpg' }],
      },
    ];

    const ranked = rankSearchPlaylists('los juegos del hambre', samplePlaylists);
    assert.strictEqual(
      ranked[0].id,
      '37i9dQZF1DWT3BGkpbwZZs',
      'The Hunger Games Official Spotify Playlist must be ranked at position #0'
    );
    assert.strictEqual(
      ranked[1].id,
      '2jVRVbDoJqHP4FAqNritj9',
      'User soundtrack playlist must be ranked #1'
    );

    // Audiobooks pushed to bottom
    const lastTwoIds = [ranked[2].id, ranked[3].id];
    assert.ok(lastTwoIds.includes('1Dey42oZkJZKnyhuI9cHco'), 'Audiobook must be below music playlists');
    assert.ok(lastTwoIds.includes('50hOyOVps0GOEMtumXGlNZ'), 'Lee Conmigo must be below music playlists');
  });

  it('5. Audio Intent Recognition: Audiobooks rank higher when user explicitly searches for audiobooks', () => {
    const samplePlaylists = [
      {
        id: '2jVRVbDoJqHP4FAqNritj9',
        name: 'Los juegos del hambre soundtrack',
        owner: { display_name: 'Priscila', id: 'priscila' },
        description: 'Banda sonora',
        images: [{ url: 'https://i.scdn.co/image/soundtrack.jpg' }],
      },
      {
        id: '1Dey42oZkJZKnyhuI9cHco',
        name: 'Los juegos del hambre saga completa Audiolibro',
        owner: { display_name: 'FerRava2803', id: 'ferrava' },
        description: 'Audiolibro completo de la saga',
        images: [{ url: 'https://i.scdn.co/image/audiobook.jpg' }],
      },
    ];

    const rankedAudio = rankSearchPlaylists('audiolibro juegos del hambre', samplePlaylists);
    assert.strictEqual(
      rankedAudio[0].id,
      '1Dey42oZkJZKnyhuI9cHco',
      'Audiobook must rank first when query explicitly contains audiolibro'
    );
  });

  it('6. Backend and Frontend Integration: Playlists are ranked before delivery', () => {
    assert.ok(
      spotifyApiSource.includes('rankSearchPlaylists(cleanQ, rawMergedPlaylists)'),
      'spotifyApi must rank mergedPlaylists'
    );
    assert.ok(
      serverSource.includes('rankPlaylists(cleanQ, playlists)'),
      'server.mjs must rank playlists'
    );
    assert.ok(
      apiSearchSource.includes('rankPlaylists(cleanQ, playlists)'),
      'api/search.js must rank playlists'
    );
    assert.ok(
      mobileSearchSource.includes('results.playlists.slice(0, 6)'),
      'MobileSearchView must show top 6 playlists in todo tab'
    );
  });

  it('7. Dynamic Covers and Official IDs: Playlist details extractor parses dynamic covers and paths', () => {
    assert.ok(
      playlistSource.includes('pl.images?.items?.[0]?.sources?.[0]?.url ||'),
      'api/playlist.js must check items sources'
    );
    assert.ok(
      playlistSource.includes('pl.images?.sources?.[0]?.url ||'),
      'api/playlist.js must check sources'
    );
    assert.ok(
      playlistSource.includes('pl.images?.[0]?.url'),
      'api/playlist.js must check direct images array'
    );
  });
});
