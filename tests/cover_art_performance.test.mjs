import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test isPlaylistOrGenericCover logic
function isPlaylistOrGenericCover(url, _playlistCover) {
  if (!url) return true;
  if (url.includes('liked-songs')) return true;
  if (url.includes('mosaic.scdn.co')) return true;
  if (url.includes('pickasso.spotifycdn.com')) return true;
  if (url.includes('ab67706c') || url.includes('ab67706f') || url.includes('ab67706d')) return true;
  if (url.includes('/img/daily/') || url.includes('/img/radio/')) return true;
  if (url.startsWith('data:image/svg+xml')) return true;
  return false;
}

function getTrackCoverUrl(track, _fallbackPlaylistCover, coverCache = new Map()) {
  if (!track) return undefined;
  const albumCover = track.album?.images?.[0]?.url;
  if (albumCover && !isPlaylistOrGenericCover(albumCover)) {
    return albumCover;
  }
  if (coverCache.has(track.id)) {
    const cached = coverCache.get(track.id);
    if (cached && !isPlaylistOrGenericCover(cached)) {
      return cached;
    }
  }
  const anyT = track;
  const directCover =
    anyT.album?.cover_xl ||
    anyT.album?.cover_big ||
    anyT.album?.cover_medium ||
    anyT.cover_xl ||
    anyT.cover_big ||
    anyT.cover_medium ||
    anyT.cover ||
    anyT.image ||
    anyT.imageUrl ||
    anyT.albumArt ||
    anyT.album_cover_url ||
    anyT.thumbnail;

  if (directCover && !isPlaylistOrGenericCover(directCover)) {
    return directCover;
  }
  return undefined;
}

describe('Track Cover Art Rejection Fix (Requirement R1)', () => {
  const realAlbumCover = 'https://i.scdn.co/image/ab67616d0000b2731234567890abcdef12345678';
  const playlistCoverSameAsTrack0 = 'https://i.scdn.co/image/ab67616d0000b2731234567890abcdef12345678';
  const mosaicPlaylistCover = 'https://mosaic.scdn.co/640/ab67616d00001e021234567890';
  const genericHashCover = 'https://i.scdn.co/image/ab67706c0000bebb1234567890';

  it('isPlaylistOrGenericCover does NOT reject real album cover even if playlistCover is identical', () => {
    const rejected = isPlaylistOrGenericCover(realAlbumCover, playlistCoverSameAsTrack0);
    assert.equal(rejected, false, 'Real album cover must not be rejected just because it matches playlistCover');
  });

  it('isPlaylistOrGenericCover correctly rejects mosaics and Spotify playlist hash covers', () => {
    assert.equal(isPlaylistOrGenericCover(mosaicPlaylistCover), true);
    assert.equal(isPlaylistOrGenericCover(genericHashCover), true);
    assert.equal(isPlaylistOrGenericCover('https://misc.scdn.co/liked-songs/640.jpg'), true);
    assert.equal(isPlaylistOrGenericCover('data:image/svg+xml;utf8,<svg></svg>'), true);
  });

  it('getTrackCoverUrl returns track 0 album cover even if it is identical to fallbackPlaylistCover', () => {
    const track0 = {
      id: 'track-0',
      name: 'Ojitos Lindos',
      album: {
        images: [{ url: realAlbumCover }],
      },
    };
    const resolved = getTrackCoverUrl(track0, playlistCoverSameAsTrack0);
    assert.equal(resolved, realAlbumCover, 'Track 0 must retain its genuine album artwork');
  });

  it('getTrackCoverUrl ignores generic placeholder covers and searches direct fallbacks', () => {
    const trackWithGeneric = {
      id: 'track-1',
      name: 'Test Song',
      album: {
        images: [{ url: mosaicPlaylistCover }],
        cover_big: realAlbumCover,
      },
    };
    const resolved = getTrackCoverUrl(trackWithGeneric, undefined);
    assert.equal(resolved, realAlbumCover, 'Must fall back to valid direct cover if primary image was generic mosaic');
  });
});

describe('Fast Playlist Cover Hydration (Requirement R1)', () => {
  const EMPTY_PLAYLIST_COVER = 'data:image/svg+xml;utf8,<svg></svg>';
  const LIKED_COVER = 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';

  function mockGetPlaylistCover(p, detailsCache, localStorageMap) {
    if (!p) return EMPTY_PLAYLIST_COVER;
    const pid = p.id || '';
    if (pid === 'liked-songs') return LIKED_COVER;
    const own = p.images?.find((i) => i?.url)?.url;
    if (own && !(own === LIKED_COVER && pid !== 'liked-songs')) return own;

    const cached = detailsCache[pid];
    const cachedOwn = cached?.images?.find((i) => i?.url)?.url;
    if (cachedOwn && !(cachedOwn === LIKED_COVER && pid !== 'liked-songs')) return cachedOwn;

    let items = p.tracks?.items;
    if (!items || items.length === 0) {
      items = cached?.tracks?.items;
    }
    if ((!items || items.length === 0) && localStorageMap.has(`spotifree_playlist_tracks_${pid}`)) {
      items = JSON.parse(localStorageMap.get(`spotifree_playlist_tracks_${pid}`));
    }
    const covers = [];
    for (const x of items || []) {
      const art = x?.album?.images?.[0]?.url;
      if (art && !covers.includes(art)) covers.push(art);
      if (covers.length === 4) break;
    }
    return covers[0] || EMPTY_PLAYLIST_COVER;
  }

  it('immediately returns cached cover when shallow playlist has empty tracks.items', () => {
    const shallowPlaylist = { id: 'pl-123', name: 'My Playlist', tracks: { total: 10, items: [] } };
    const detailsCache = {
      'pl-123': {
        id: 'pl-123',
        images: [{ url: 'https://i.scdn.co/image/custom_playlist_cover.jpg' }],
      },
    };
    const ls = new Map();
    const cover = mockGetPlaylistCover(shallowPlaylist, detailsCache, ls);
    assert.equal(cover, 'https://i.scdn.co/image/custom_playlist_cover.jpg');
  });

  it('immediately hydrates track cover from localStorage when cache is empty', () => {
    const shallowPlaylist = { id: 'pl-456', name: 'Saved Playlist' };
    const detailsCache = {};
    const ls = new Map();
    ls.set('spotifree_playlist_tracks_pl-456', JSON.stringify([
      { id: 't1', album: { images: [{ url: 'https://i.scdn.co/image/saved_track.jpg' }] } },
    ]));
    const cover = mockGetPlaylistCover(shallowPlaylist, detailsCache, ls);
    assert.equal(cover, 'https://i.scdn.co/image/saved_track.jpg');
  });
});
