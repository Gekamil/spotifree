/**
 * Focused Verification Suite for Spotifree v0.2.4:
 * 1. Android Auto "Recientes" tab (only recently played playlists, albums, and songs)
 * 2. Both Android Widgets redesigned with blurred cover backdrops, dual-tone gradients,
 *    smooth 60 FPS animations (no choppy ViewFlipper), live Chronometer, and progress bars.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readRel(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

function existsRel(relPath) {
  return fs.existsSync(path.join(rootDir, relPath));
}

describe('Spotifree v0.2.4 — Android Auto "Recientes" Tab', () => {
  it('SpotifreeMediaService.java exposes recents tab, icon, persistence, and notifications', () => {
    const svc = readRel('native/android/SpotifreeMediaService.java');
    assert.ok(svc.includes('tabItem("recents", tr("Recientes", "Recents"), R.drawable.ic_car_tab_recents, STYLE_GRID)'));
    assert.ok(svc.includes('else if ("recents".equals(parentId))'));
    assert.ok(svc.includes('notifyChildrenChanged("recents")'));
    assert.ok(svc.includes('trackItem("rec:" + j'));
    assert.ok(existsRel('native/android/res/drawable/ic_car_tab_recents.xml'));
  });

  it('SpotifreeMediaPlugin.java forwards recent playlists and recentTracks to SpotifreeMediaService', () => {
    const plugin = readRel('native/android/SpotifreeMediaPlugin.java');
    assert.ok(plugin.includes('JSONArray recent = arr(call, "recent")'));
    assert.ok(plugin.includes('JSONArray recentTracks = arr(call, "recentTracks")'));
    assert.ok(plugin.includes('SpotifreeMediaService.saveLibrary(getContext(), playlists != null ? playlists : new JSONArray(), home, recent, recentTracks)'));
  });

  it('nativeMedia.ts populates genuine recent contexts (via snapshots) & recent tracks and supports rec: playback', () => {
    const ts = readRel('src/services/nativeMedia.ts');
    assert.ok(ts.includes('spotifree_car_recent_snapshots'));
    assert.ok(ts.includes('resolveContextCard'));
    assert.ok(ts.includes('collectRecentTracks'));
    assert.ok(ts.includes("mediaId.startsWith('rec:')"));
    assert.ok(ts.includes('recent: recent.slice(0, 16)'));
    assert.ok(ts.includes('recentTracks,'));
    assert.ok(ts.includes("window.addEventListener('spotifree:history_updated'"));
  });

  it('Android Auto search returns artists (authors), albums, playlists & songs and exploits native car UI hints/theme', () => {
    const svc = readRel('native/android/SpotifreeMediaService.java');
    const plugin = readRel('native/android/SpotifreeMediaPlugin.java');
    const ts = readRel('src/services/nativeMedia.ts');
    const setup = readRel('scripts/setup-android-native.mjs');
    const theme = readRel('native/android/res/values/spotifree_car_theme.xml');

    assert.ok(ts.includes('searchMetaCache'));
    assert.ok(ts.includes('artists,'));
    assert.ok(ts.includes('albums,'));
    assert.ok(plugin.includes('arr(call, "artists")'));
    assert.ok(plugin.includes('arr(call, "albums")'));
    assert.ok(svc.includes('tr("Artistas", "Artists")'));
    assert.ok(svc.includes('tr("Álbumes", "Albums")'));
    assert.ok(svc.includes('androidx.media.PlaybackStateCompat.Extras.KEY_MEDIA_ID'));
    assert.ok(svc.includes('android.media.extra.DOWNLOAD_STATUS'));
    assert.ok(svc.includes('android.media.browse.CONTENT_STYLE_SINGLE_ITEM_HINT'));
    assert.ok(setup.includes('com.google.android.gms.car.application.theme'));
    assert.ok(theme.includes('SpotifreeCarTheme'));
    assert.ok(theme.includes('#1ED760'));
  });
});

describe('Spotifree v0.2.4 — Redesigned Smooth Animated Widgets (Bar, Large, Small & Turntable)', () => {
  it('SpotifreeWidget.java renders blurred album art backdrop, dual-tone gradient, live Chronometer & progress bar', () => {
    const java = readRel('native/android/SpotifreeWidget.java');
    assert.ok(java.includes('blurSmall('));
    assert.ok(java.includes('extractPalette('));
    assert.ok(java.includes('renderBackdrop('));
    assert.ok(java.includes('LinearGradient'));
    assert.ok(java.includes('RadialGradient'));
    assert.ok(java.includes('R.id.widget_bg_art'));
    assert.ok(java.includes('R.id.widget_live_ring'));
    assert.ok(java.includes('R.id.widget_chronometer'));
    assert.ok(java.includes('R.id.widget_progress'));
    assert.ok(java.includes('setChronometer('));
    assert.ok(java.includes('setProgressBar(R.id.widget_progress'));
  });

  it('SpotifreeTurntableWidget.java removes choppy ViewFlipper and uses blurred cover backdrop & 60 FPS spin layers', () => {
    const java = readRel('native/android/SpotifreeTurntableWidget.java');
    assert.ok(!java.includes('import android.widget.ViewFlipper'));
    assert.ok(!java.includes('tt_flipper'));
    assert.ok(java.includes('SpotifreeWidget.wideBackdrop(ctx)'));
    assert.ok(java.includes('R.id.widget_bg_art'));
    assert.ok(java.includes('R.id.tt_spin'));
    assert.ok(java.includes('R.id.tt_label_sheen'));
    assert.ok(java.includes('R.id.widget_live_ring'));
    assert.ok(java.includes('R.id.widget_chronometer'));
    assert.ok(java.includes('R.id.widget_progress'));
  });

  it('Widget XML layouts & drawables declare all smooth animation, progress, sheen & backdrop assets cleanly', () => {
    const bar = readRel('native/android/res/layout/spotifree_widget.xml');
    const large = readRel('native/android/res/layout/spotifree_widget_large.xml');
    const small = readRel('native/android/res/layout/spotifree_widget_small.xml');
    const tt = readRel('native/android/res/layout/spotifree_widget_turntable.xml');

    for (const xml of [bar, large, small, tt]) {
      assert.ok(xml.includes('android:id="@+id/widget_bg_art"'));
      assert.ok(xml.includes('android:id="@+id/widget_live_ring"'));
      assert.ok(xml.includes('android:id="@+id/widget_progress"'));
      assert.ok(xml.includes('@drawable/spotifree_widget_progress'));
      assert.ok(xml.includes('@drawable/spotifree_live_ring'));
    }

    assert.ok(!tt.includes('<ViewFlipper'));
    assert.ok(!tt.includes('tt_flipper'));
    assert.ok(tt.includes('android:id="@+id/tt_label_sheen"'));
    assert.ok(tt.includes('@drawable/spotifree_label_sheen'));
    assert.ok(tt.includes('<Chronometer'));
    assert.ok(large.includes('<Chronometer'));
    assert.ok(small.includes('<Chronometer'));

    assert.ok(existsRel('native/android/res/drawable/spotifree_widget_progress.xml'));
    assert.ok(existsRel('native/android/res/drawable/spotifree_widget_btn_bg.xml'));
    assert.ok(existsRel('native/android/res/drawable/spotifree_live_ring.xml'));
    assert.ok(existsRel('native/android/res/drawable/spotifree_live_ring_vec.xml'));
    assert.ok(existsRel('native/android/res/drawable/spotifree_label_sheen.xml'));
    assert.ok(existsRel('native/android/res/drawable/spotifree_label_sheen_vec.xml'));
  });
});
