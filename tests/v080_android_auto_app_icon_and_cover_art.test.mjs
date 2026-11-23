import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('v080: Android Auto App Icon & Media Cover Art Reliability', () => {

  it('1. Strict Zero-Emoji Rule: No emojis in code, tests or comments', () => {
    const files = [
      'native/android/SpotifreeArtProvider.java',
      'native/android/SpotifreeMediaService.java',
      'scripts/setup-android-app-icons.mjs',
      'scripts/setup-android-native.mjs',
      'tests/v080_android_auto_app_icon_and_cover_art.test.mjs'
    ];
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;

    for (const f of files) {
      const fullPath = path.resolve(f);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(!emojiRegex.test(content), `File ${f} must contain zero emojis`);
      }
    }
  });

  it('2. App Icon in Android Auto: MediaBrowserService declares icon and roundIcon', () => {
    const setupNative = fs.readFileSync(path.resolve('scripts/setup-android-native.mjs'), 'utf8');
    assert.ok(
      setupNative.includes('android:name=".SpotifreeMediaService"'),
      'Must declare SpotifreeMediaService'
    );
    assert.ok(
      setupNative.includes('android:icon="@mipmap/ic_launcher_app_default"'),
      'Media service must declare default app launcher icon for vehicle head units'
    );
    assert.ok(
      setupNative.includes('android:roundIcon="@mipmap/ic_launcher_app_default"'),
      'Media service must declare round icon for round launcher interfaces'
    );
    assert.ok(
      setupNative.includes('android:resource="@xml/automotive_app_desc"'),
      'Must declare automotive app descriptor'
    );
  });

  it('3. App Icon Assets: Multi-density coverage and static spotifree_logo drawable', () => {
    const setupIcons = fs.readFileSync(path.resolve('scripts/setup-android-app-icons.mjs'), 'utf8');
    assert.ok(
      setupIcons.includes('ALL_DENSITIES'),
      'setup-android-app-icons must declare all screen densities'
    );
    assert.ok(
      setupIcons.includes('ic_launcher.png'),
      'setup-android-app-icons must generate fallback ic_launcher.png'
    );
    assert.ok(
      setupIcons.includes('ic_launcher_round.png'),
      'setup-android-app-icons must generate fallback ic_launcher_round.png'
    );

    const logoPath = path.resolve('native/android/res/drawable/spotifree_logo.png');
    assert.ok(fs.existsSync(logoPath), 'spotifree_logo.png must exist in native drawable folder');
    const stats = fs.statSync(logoPath);
    assert.ok(stats.size > 1000, 'spotifree_logo.png must be a valid non-empty PNG');
  });

  it('4. SpotifreeArtProvider: Robust logo fallback and stream copying', () => {
    const artProvider = fs.readFileSync(path.resolve('native/android/SpotifreeArtProvider.java'), 'utf8');
    assert.ok(
      artProvider.includes('spotifree_logo'),
      'logoFile must check spotifree_logo drawable resource first'
    );
    assert.ok(
      artProvider.includes('openRawResource'),
      'logoFile must use openRawResource for direct byte stream copy'
    );
    assert.ok(
      artProvider.includes('ic_launcher_app_default'),
      'logoFile must check ic_launcher_app_default mipmap'
    );
    assert.ok(
      artProvider.includes('logoUri(ctx)'),
      'uriFor must fall back to logoUri when image URL is null or empty'
    );
  });

  it('5. SpotifreeArtProvider: Query size column and MIME types', () => {
    const artProvider = fs.readFileSync(path.resolve('native/android/SpotifreeArtProvider.java'), 'utf8');
    assert.ok(
      artProvider.includes('OpenableColumns.SIZE'),
      'query method must handle OpenableColumns.SIZE'
    );
    assert.ok(
      artProvider.includes('f.length()'),
      'query method must return actual file size for OpenableColumns.SIZE'
    );
    assert.ok(
      artProvider.includes('return "image/png";') && artProvider.includes('return "image/jpeg";'),
      'getType must return valid image MIME types'
    );
  });

  it('6. SpotifreeArtProvider: Extensive music CDN support and safe HTTPS allowance', () => {
    const artProvider = fs.readFileSync(path.resolve('native/android/SpotifreeArtProvider.java'), 'utf8');
    const expectedHosts = ['scdn.co', 'spotifycdn.com', 'deezer.com', 'ytimg.com', 'mzstatic.com', 'apple.com', 'soundcloud.com', 'tidal.com'];
    for (const host of expectedHosts) {
      assert.ok(artProvider.includes(host), `ALLOWED_HOST_SUFFIXES must contain ${host}`);
    }
    assert.ok(
      artProvider.includes('!host.startsWith("127.")') || artProvider.includes('host.equals("localhost")'),
      'allowed method must block non-routable loopback addresses'
    );
  });

  it('7. SpotifreeMediaService: Binder IPC protection via decodeScaledBitmap', () => {
    const mediaService = fs.readFileSync(path.resolve('native/android/SpotifreeMediaService.java'), 'utf8');
    assert.ok(
      mediaService.includes('decodeScaledBitmap'),
      'SpotifreeMediaService must implement decodeScaledBitmap'
    );
    assert.ok(
      mediaService.includes('Bitmap.Config.RGB_565'),
      'decodeScaledBitmap must use RGB_565 for compact Binder transaction footprint'
    );
    assert.ok(
      mediaService.includes('inSampleSize'),
      'decodeScaledBitmap must calculate inSampleSize before decoding'
    );
    assert.ok(
      mediaService.includes('decodeScaledBitmap(f, 384)'),
      'maybeLoadArt must decode with max 384 pixels'
    );
    assert.ok(
      mediaService.includes('decodeScaledBitmap(lf, 384)'),
      'refresh metadataArt must decode logo with max 384 pixels'
    );
    assert.ok(
      mediaService.includes('decodeScaledBitmap(lf, 256)'),
      'buildNotification must decode logo with max 256 pixels'
    );
  });

  it('8. SpotifreeMediaService: MediaMetadata URI keys set for vehicle head unit', () => {
    const mediaService = fs.readFileSync(path.resolve('native/android/SpotifreeMediaService.java'), 'utf8');
    assert.ok(
      mediaService.includes('MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI'),
      'Must set METADATA_KEY_ALBUM_ART_URI'
    );
    assert.ok(
      mediaService.includes('MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI'),
      'Must set METADATA_KEY_DISPLAY_ICON_URI'
    );
    assert.ok(
      mediaService.includes('MediaMetadataCompat.METADATA_KEY_ART_URI'),
      'Must set METADATA_KEY_ART_URI'
    );
    assert.ok(
      mediaService.includes('SpotifreeArtProvider.logoUri(this)'),
      'Must fall back to logoUri for DJ and playlist browse actions'
    );
  });

});
