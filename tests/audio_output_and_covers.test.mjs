/**
 * Focused Verification Suite for Spotifree v0.2.3:
 * 1. Mobile & Android APK Audio Device Picker (1:1 parity with Desktop)
 * 2. Desktop Right Sidebar Direct Play Cover Resolution
 * 3. Audit fixes for v0.2.2 (Mobile album header update, AddToPlaylistModal selections & toast, real album release dates)
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

describe('Spotifree v0.2.3 — Audio Output Device Selector (Mobile & APK)', () => {
  it('Native Android plugin SpotifreeAudioOutputPlugin.java implements device enumeration, switching, and OS switcher', () => {
    const java = readRel('native/android/SpotifreeAudioOutputPlugin.java');
    assert.ok(java.includes('@CapacitorPlugin(name = "SpotifreeAudioOutput")'));
    assert.ok(java.includes('public void getOutputDevices('));
    assert.ok(java.includes('public void setOutputDevice('));
    assert.ok(java.includes('public void openSystemMediaOutput('));
    assert.ok(java.includes('AudioDeviceCallback'));
    assert.ok(java.includes('AudioManager.GET_DEVICES_OUTPUTS'));
    assert.ok(java.includes('getAudioDevicesForAttributes('));
    assert.ok(!java.includes('getDevicesForAttributes('));
    assert.ok(!java.includes('removeFlags('));
    assert.ok(java.includes('com.android.settings.panel.action.MEDIA_OUTPUT'));
  });

  it('MainActivity.java and scripts/setup-android-native.mjs register SpotifreeAudioOutputPlugin', () => {
    const mainActivity = readRel('native/android/MainActivity.java');
    const setupScript = readRel('scripts/setup-android-native.mjs');
    assert.ok(mainActivity.includes('registerPlugin(SpotifreeAudioOutputPlugin.class)'));
    assert.ok(setupScript.includes("'SpotifreeAudioOutputPlugin'"));
  });

  it('audioOutputService.ts bridges Desktop Web, Mobile Web, and Android APK cleanly', () => {
    const svc = readRel('src/services/audioOutputService.ts');
    assert.ok(svc.includes("registerPlugin<SpotifreeAudioOutputPlugin>('SpotifreeAudioOutput')"));
    assert.ok(svc.includes('useAudioOutputStore'));
    assert.ok(svc.includes('openDevicePickerSheet'));
    assert.ok(svc.includes('applyOutput'));
    assert.ok(svc.includes('restoreAudioOutput'));
    assert.ok(svc.includes('openSystemOutputSwitcher'));
  });

  it('MobileDevicePickerSheet.tsx matches Desktop PlayerExtras design (Dispositivo actual, Salida de audio, Escuchar juntos)', () => {
    const sheet = readRel('src/components/mobile/MobileDevicePickerSheet.tsx');
    assert.ok(sheet.includes('Dispositivo actual'));
    assert.ok(sheet.includes('Este teléfono'));
    assert.ok(sheet.includes('Salida de audio'));
    assert.ok(sheet.includes('Cambiar salida de audio'));
    assert.ok(sheet.includes('Escuchar juntos'));
    assert.ok(sheet.includes('#1ed760'));
    assert.ok(sheet.includes('spotifree_android_back'));
  });

  it('MobileMiniPlayer, MobileNowPlayingModal, and App.tsx wire the device button & sheet globally', () => {
    const mini = readRel('src/components/mobile/MobileMiniPlayer.tsx');
    const modal = readRel('src/components/mobile/MobileNowPlayingModal.tsx');
    const app = readRel('src/App.tsx');

    assert.ok(mini.includes('openDevicePickerSheet()'));
    assert.ok(mini.includes('SpotifyConnectNativeIcon'));
    assert.ok(modal.includes('openDevicePickerSheet()'));
    assert.ok(modal.includes('Este teléfono'));
    assert.ok(app.includes('<MobileDevicePickerSheet />'));
    assert.ok(app.includes('initAudioOutputListeners()'));
  });
});

describe('Spotifree v0.2.3 — Desktop Right Sidebar Cover Art on Direct Play', () => {
  it('usePlayerStore.ts hydrates and batch-resolves artwork when playTrack runs directly', () => {
    const storeCode = readRel('src/store/usePlayerStore.ts');
    assert.ok(storeCode.includes('hydrateCoverSync'));
    assert.ok(storeCode.includes('resolveTrackCoversBatch(coverTargets'));
    assert.ok(storeCode.includes('currentTrack: nextCurrent'));
  });

  it('DesktopRightSidebar.tsx resolves track covers, queue artwork, and artist fallbacks', () => {
    const sidebar = readRel('src/components/desktop/DesktopRightSidebar.tsx');
    assert.ok(sidebar.includes('resolveTrackCoversBatch'));
    assert.ok(sidebar.includes('coverOfTrack'));
    assert.ok(sidebar.includes('DEFAULT_FALLBACK_COVER'));
    assert.ok(sidebar.includes('onImgError={handleImageError}'));
    assert.ok(sidebar.includes('referrerPolicy="no-referrer"'));
  });

  it('MotionCover.tsx sets referrerPolicy and renders fallback image instead of blank/broken img', () => {
    const mc = readRel('src/components/common/MotionCover.tsx');
    assert.ok(mc.includes('referrerPolicy="no-referrer"'));
    assert.ok(mc.includes('DEFAULT_FALLBACK_COVER'));
    assert.ok(mc.includes('imgFailed'));
  });

  it('DesktopHomeView.tsx direct play supports Spotifree sf- mixes and passes playlist contextId', () => {
    const home = readRel('src/components/desktop/DesktopHomeView.tsx');
    assert.ok(home.includes('useSpotifreeMixes.getState().mixes'));
    assert.ok(home.includes('playTrack(start, items, card.id)'));
  });
});

describe('Spotifree v0.2.3 — Audit Fixes for Search Albums, Mobile Headers & Modal Playlist Creation', () => {
  it('Search APIs do not hardcode release_date 2026 and attach artist IDs & record_type', () => {
    for (const file of ['api/search.js', 'server.mjs', 'vite.config.ts']) {
      const code = readRel(file);
      assert.ok(!code.includes("release_date: '2026'"), `${file} must not hardcode release_date '2026'`);
      assert.ok(code.includes('record_type'), `${file} must preserve album record_type`);
    }
  });

  it('MobilePlaylistView.tsx updates activePlaylist state from fetched album/playlist API metadata', () => {
    const mpv = readRel('src/components/mobile/MobilePlaylistView.tsx');
    assert.ok(mpv.includes('setActivePlaylist(updatedActive)'));
    assert.ok(mpv.includes('{activePlaylist.name}'));
    assert.ok(mpv.includes("activePlaylist.type === 'album'"));
  });

  it('AddToPlaylistModal.tsx commits pending selections, reads multi-key storage, shows toast, and uses z-[150]', () => {
    const modal = readRel('src/components/modals/AddToPlaylistModal.tsx');
    assert.ok(modal.includes('getSavedCustomTracks'));
    assert.ok(modal.includes('commitPendingSelections'));
    assert.ok(modal.includes('showGlobalToast'));
    assert.ok(modal.includes('z-[150]'));
  });

  it('DesktopSearchView.tsx includes albums in results check and clean Remix label', () => {
    const dsv = readRel('src/components/desktop/DesktopSearchView.tsx');
    assert.ok(dsv.includes('searchResults.albums.length > 0'));
    assert.ok(dsv.includes('Remixes, Leaks y Slowed'));
    assert.ok(dsv.includes('handleQuickPlayCollection'));
  });
});
