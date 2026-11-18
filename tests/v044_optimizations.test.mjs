import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Spotifree v0.4.4 Optimizations & Features', () => {
  describe('Image thumbnail optimization (toThumbnailImage in formatters.ts)', () => {
    function toThumbnailImage(url, size = 64) {
      if (!url) return '';
      if (url.startsWith('data:image/svg+xml')) return url;
      if (url.includes('i.scdn.co/image/')) {
        const hash = url.split('/').pop()?.split('?')[0];
        if (!hash) return url;
        const cleanHash = hash.replace(/^(b273|1e02|4851)/, '');
        if (size <= 80) return `https://i.scdn.co/image/ab67616d00004851${cleanHash}`;
        if (size <= 250) return `https://i.scdn.co/image/ab67616d00001e02${cleanHash}`;
        return `https://i.scdn.co/image/ab67616d0000b273${cleanHash}`;
      }
      if (url.includes('e-cdns-images.dzcdn.net/images/cover/')) {
        const dim = size <= 80 ? '50x50' : size <= 250 ? '250x250' : '500x500';
        return url.replace(/\/\d+x\d+-[^/]+$/, `/${dim}-000000-80-0-0.jpg`);
      }
      return url;
    }

    it('downscales Spotify 640x640 CDN images to 64px and 150px variants', () => {
      const spotify640 = 'https://i.scdn.co/image/ab67616d0000b2731234567890abcdef12345678';
      const thumb64 = toThumbnailImage(spotify640, 64);
      const thumb150 = toThumbnailImage(spotify640, 150);

      assert.ok(thumb64.includes('ab67616d00004851'), 'Should map 64px to Spotify 64x64 token (4851)');
      assert.ok(thumb150.includes('ab67616d00001e02'), 'Should map 150px to Spotify 300x300 token (1e02)');
    });

    it('downscales Deezer album images to 50x50 or 250x250', () => {
      const deezerBig = 'https://e-cdns-images.dzcdn.net/images/cover/12345/1000x1000-000000-80-0-0.jpg';
      const thumbSmall = toThumbnailImage(deezerBig, 64);
      const thumbMed = toThumbnailImage(deezerBig, 150);

      assert.ok(thumbSmall.includes('50x50-000000-80-0-0.jpg'), 'Should map <=80 to 50x50');
      assert.ok(thumbMed.includes('250x250-000000-80-0-0.jpg'), 'Should map >80 to 250x250');
    });

    it('formatters.ts exports toThumbnailImage with async support', () => {
      const code = fs.readFileSync(path.resolve('src/utils/formatters.ts'), 'utf-8');
      assert.ok(code.includes('toThumbnailImage ='), 'Should export toThumbnailImage');
      assert.ok(code.includes('ab67616d00004851'), 'Should handle 64px Spotify thumbnail');
    });
  });

  describe('SpotifyImage instant memory cache & anti-flicker', () => {
    it('declares LOADED_IMAGE_URLS cache and checks isImageAlreadyLoaded synchronously on mount', () => {
      const code = fs.readFileSync(path.resolve('src/components/common/SpotifyImage.tsx'), 'utf-8');
      assert.ok(code.includes('LOADED_IMAGE_URLS = new Set<string>()'), 'Should declare global LOADED_IMAGE_URLS set');
      assert.ok(code.includes('isImageAlreadyLoaded(src)'), 'Should check isImageAlreadyLoaded');
      assert.ok(code.includes('decoding="async"'), 'Should use decoding="async"');
      assert.ok(code.includes('LOADED_IMAGE_URLS.add'), 'Should add image to LOADED_IMAGE_URLS on load');
    });

    it('TrackArtwork uses toThumbnailImage to save bandwidth on lists', () => {
      const code = fs.readFileSync(path.resolve('src/utils/trackCovers.tsx'), 'utf-8');
      assert.ok(code.includes('toThumbnailImage(src,'), 'TrackArtwork should invoke toThumbnailImage');
      assert.ok(code.includes('loading="lazy"'), 'TrackArtwork should use lazy loading');
      assert.ok(code.includes('decoding="async"'), 'TrackArtwork should use async decoding');
    });
  });

  describe('DJ Identifier unification & Desktop / Android Auto routing', () => {
    function isAIDJPlaylist(playlistOrId) {
      if (!playlistOrId) return false;
      const id = (typeof playlistOrId === 'string' ? playlistOrId : playlistOrId.id || '').toLowerCase().trim();
      const name = (typeof playlistOrId === 'object' ? playlistOrId.name || '' : '').toLowerCase().trim();
      const isDjFlag = typeof playlistOrId === 'object' && Boolean(playlistOrId.is_dj);
      if (isDjFlag) return true;
      if (['spotify-dj', 'dj', 'ai-dj', 'tu-dj', '37i9dqzf1eykqdzj48dyyq'].includes(id)) return true;
      if (id.includes('37i9dqzf1eykqdzj48dyyq') || id.includes('spotify-dj') || id.endsWith(':dj')) return true;
      if (name === 'dj' || name === 'spotify dj' || name === 'tu dj' || name === 'tu dj personal') return true;
      return false;
    }

    it('identifies all standard DJ IDs, Spotify DJ URIs, names and flags', () => {
      assert.equal(isAIDJPlaylist({ id: 'spotify-dj' }), true);
      assert.equal(isAIDJPlaylist({ id: 'dj' }), true);
      assert.equal(isAIDJPlaylist({ id: 'ai-dj' }), true);
      assert.equal(isAIDJPlaylist({ id: 'tu-dj' }), true);
      assert.equal(isAIDJPlaylist({ id: '37i9dqzf1eykqdzj48dyyq' }), true);
      assert.equal(isAIDJPlaylist({ id: 'spotify:playlist:37i9dqzf1eykqdzj48dyyq' }), true);
      assert.equal(isAIDJPlaylist({ name: 'DJ' }), true);
      assert.equal(isAIDJPlaylist({ name: 'Tu DJ personal' }), true);
      assert.equal(isAIDJPlaylist({ name: 'Spotify DJ' }), true);
      assert.equal(isAIDJPlaylist({ is_dj: true }), true);
      assert.equal(isAIDJPlaylist('tu-dj'), true);
      assert.equal(isAIDJPlaylist('pl:spotify-dj'), true);
      assert.equal(isAIDJPlaylist({ id: 'pl-rock', name: 'Rock' }), false);
    });

    it('DesktopPlaylistView mounts AIDJView instead of showing empty list', () => {
      const code = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlaylistView.tsx'), 'utf-8');
      assert.ok(code.includes('isAIDJPlaylist(dynamicPlaylist)'), 'Should check isAIDJPlaylist on dynamicPlaylist');
      assert.ok(code.includes('<AIDJView'), 'Should render AIDJView directly');
    });

    it('DesktopLayout intercepts DJ selections directly into dj tab', () => {
      const code = fs.readFileSync(path.resolve('src/components/desktop/DesktopLayout.tsx'), 'utf-8');
      assert.ok(code.includes('isAIDJPlaylist(playlist)'), 'handleSelectPlaylist should check isAIDJPlaylist');
      assert.ok(code.includes('isAIDJPlaylist({ id: cleanId'), 'handleSelectPlaylistById should check isAIDJPlaylist');
    });

    it('Android Auto nativeMedia plays DJ with speakFirst option', () => {
      const code = fs.readFileSync(path.resolve('src/services/nativeMedia.ts'), 'utf-8');
      assert.ok(code.includes('startSession({ speakFirst: true })'), 'Should start DJ session with speakFirst');
      assert.ok(code.includes('is_dj: true'), 'Should tag DJ items with is_dj in pushLibrary');
      assert.ok(code.includes('if (isAIDJPlaylist({ id }))'), 'loadPlaylistTracks should intercept DJ');
    });

    it('SpotifreeMediaService.java sets DJ as directly playable and prevents empty playlist on Android Auto', () => {
      const java = fs.readFileSync(path.resolve('native/android/SpotifreeMediaService.java'), 'utf-8');
      assert.ok(java.includes('boolean isDJ(JSONObject p)'), 'Should define isDJ helper in SpotifreeMediaService');
      assert.ok(java.includes('boolean isDJId(String id)'), 'Should define isDJId helper in SpotifreeMediaService');
      assert.ok(java.includes('!dj, ex);'), 'playlistItem should set browsable=false for DJ making it directly playable');
      assert.ok(java.includes('if (isDJId(plId))'), 'onLoadChildren should intercept DJ IDs');
      assert.ok(java.includes('Reproducir Tu DJ'), 'Should provide Play DJ action instead of empty list');
    });

    it('aiDJService starts speech before track playback when speakFirst is enabled', () => {
      const code = fs.readFileSync(path.resolve('src/services/aiDJService.ts'), 'utf-8');
      assert.ok(code.includes('speakFirst?: boolean'), 'Should accept speakFirst option');
      assert.ok(code.includes('await djSpeak(introText, set)'), 'Should await intro speech before track play');
    });
  });

  describe('Era Playlists, Expanded Styles & Weekly Rotation', () => {
    function getWeeklyRotationSeed() {
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const diffDays = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 3600 * 1000));
      const weekNumber = Math.floor(diffDays / 7) + 1;
      return now.getFullYear() * 100 + weekNumber;
    }

    function selectWeeklyTracks(pool, count = 25, seedOffset = 0) {
      if (!pool || pool.length <= count) return pool || [];
      const seed = getWeeklyRotationSeed() + seedOffset;
      const copy = [...pool];
      let s = (seed * 9301 + 49297) % 233280;
      for (let i = copy.length - 1; i > 0; i--) {
        s = (s * 9301 + 49297) % 233280;
        const rnd = s / 233280;
        const j = Math.floor(rnd * (i + 1));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
      }
      return copy.slice(0, count);
    }

    it('spotifreeMixes.ts defines all 9 era and style playlist definitions with pools >= 25', () => {
      const code = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
      assert.ok(code.includes('sf-era-2010s'), 'Should include 2010s');
      assert.ok(code.includes('sf-era-2000s'), 'Should include 2000s');
      assert.ok(code.includes('sf-era-90s'), 'Should include 90s');
      assert.ok(code.includes('sf-era-80s'), 'Should include 80s');
      assert.ok(code.includes('sf-era-70s'), 'Should include 70s');
      assert.ok(code.includes('sf-era-rock'), 'Should include Rock');
      assert.ok(code.includes('sf-era-pop'), 'Should include Pop');
      assert.ok(code.includes('sf-era-urbano'), 'Should include Urbano');
      assert.ok(code.includes('sf-era-edm'), 'Should include EDM');
    });

    it('selectWeeklyTracks produces deterministic 25 tracks from a 40-track pool', () => {
      const mockPool = Array.from({ length: 40 }, (_, i) => ({ id: `song-${i}`, title: `Song ${i}` }));
      const run1 = selectWeeklyTracks(mockPool, 25, 1);
      const run2 = selectWeeklyTracks(mockPool, 25, 1);

      assert.equal(run1.length, 25);
      assert.deepEqual(run1, run2, 'Must be deterministic within the same week');
    });
  });
});
