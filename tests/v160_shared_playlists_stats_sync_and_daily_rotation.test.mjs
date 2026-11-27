import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Spotifree v1.6 Shared Playlist Modal, Stats Cloud Sync, Car Call Recovery & Daily Rotation', () => {
  const root = process.cwd();

  it('1. Shared playlist invite modal and store are mounted in App.tsx', () => {
    const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf-8');
    assert.ok(appSrc.includes('SharedPlaylistInviteModal'), 'App.tsx must import and mount SharedPlaylistInviteModal');
    assert.ok(appSrc.includes('usePlaylistInviteStore'), 'App.tsx must check usePlaylistInviteStore for Android back button');
    assert.ok(appSrc.includes('<SharedPlaylistInviteModal />'), 'App.tsx must render SharedPlaylistInviteModal component');

    const modalPath = path.join(root, 'src/components/common/SharedPlaylistInviteModal.tsx');
    assert.ok(fs.existsSync(modalPath), 'SharedPlaylistInviteModal component file must exist');
    const modalSrc = fs.readFileSync(modalPath, 'utf-8');
    assert.ok(modalSrc.includes('Aceptar e importar'), 'Must contain Aceptar e importar button');
    assert.ok(modalSrc.includes('Solo abrir'), 'Must contain Solo abrir option for public playlists');
    assert.ok(modalSrc.includes('Cancelar'), 'Must contain Cancelar button');

    const storePath = path.join(root, 'src/store/usePlaylistInviteStore.ts');
    assert.ok(fs.existsSync(storePath), 'usePlaylistInviteStore must exist');
    const storeSrc = fs.readFileSync(storePath, 'utf-8');
    assert.ok(storeSrc.includes('openInviteLoading'), 'Store must support openInviteLoading');
    assert.ok(storeSrc.includes('setInvitePreview'), 'Store must support setInvitePreview');
    assert.ok(storeSrc.includes('closeInvite'), 'Store must support closeInvite');
  });

  it('2. Deep link handler and playlist sharing generate snapshot/collab share links', () => {
    const deepLinkSrc = fs.readFileSync(path.join(root, 'src/utils/deepLinkHandler.ts'), 'utf-8');
    assert.ok(deepLinkSrc.includes('openPlaylistInviteModal'), 'deepLinkHandler must invoke openPlaylistInviteModal');
    assert.ok(deepLinkSrc.includes('shareCode'), 'deepLinkHandler must extract shareCode');

    const sharedServiceSrc = fs.readFileSync(path.join(root, 'src/services/sharedPlaylists.ts'), 'utf-8');
    assert.ok(sharedServiceSrc.includes('createPlaylistShareLink'), 'sharedPlaylists must export createPlaylistShareLink');
    assert.ok(sharedServiceSrc.includes('previewSharedPlaylist'), 'sharedPlaylists must export previewSharedPlaylist');

    const contextMenuSrc = fs.readFileSync(path.join(root, 'src/components/desktop/ContextMenu.tsx'), 'utf-8');
    assert.ok(contextMenuSrc.includes('createPlaylistShareLink'), 'ContextMenu must use createPlaylistShareLink');
  });

  it('3. Desktop session restoration starts PAUSED without auto-play', () => {
    const desktopPlayerSrc = fs.readFileSync(path.join(root, 'src/components/desktop/DesktopPlayer.tsx'), 'utf-8');
    assert.ok(
      desktopPlayerSrc.includes('if (!usePlayerStore.getState().isPlaying) return;'),
      'DesktopPlayer useEffect must guard against playing when store isPlaying is false'
    );

    const audioEngineSrc = fs.readFileSync(path.join(root, 'src/services/audioEngine.ts'), 'utf-8');
    assert.ok(audioEngineSrc.includes('autoplay: 0'), 'YouTube iframe initialization must have autoplay: 0');
    assert.ok(
      audioEngineSrc.includes('if (this.isExplicitlyPaused || !usePlayerStore.getState().isPlaying)'),
      'handleYtStateChange must prevent auto-play when explicitly paused or store is not playing'
    );
  });

  it('4. Phone call and car audio interruption recovery is fully implemented', () => {
    const audioEngineSrc = fs.readFileSync(path.join(root, 'src/services/audioEngine.ts'), 'utf-8');
    assert.ok(audioEngineSrc.includes('wasPlayingBeforeInterruption'), 'audioEngine must track wasPlayingBeforeInterruption');
    assert.ok(audioEngineSrc.includes('markInterruptedBySystem'), 'audioEngine must expose markInterruptedBySystem');
    assert.ok(audioEngineSrc.includes('recoverFromSystemInterruption'), 'audioEngine must expose recoverFromSystemInterruption');

    const audioCtrlSrc = fs.readFileSync(path.join(root, 'src/components/common/AudioController.tsx'), 'utf-8');
    assert.ok(audioCtrlSrc.includes('recoverFromSystemInterruption'), 'AudioController must handle interruption recovery');
    assert.ok(audioCtrlSrc.includes('visibilitychange'), 'AudioController must listen to visibilitychange for call return');
    assert.ok(audioCtrlSrc.includes('appStateChange'), 'AudioController must listen to Capacitor appStateChange');
  });

  it('5. Listening stats sync bidirectionally with Firestore without overwriting with zeros', () => {
    const statsStoreSrc = fs.readFileSync(path.join(root, 'src/store/useStatsStore.ts'), 'utf-8');
    assert.ok(statsStoreSrc.includes('syncWithCloudStats'), 'useStatsStore must provide syncWithCloudStats method');
    assert.ok(statsStoreSrc.includes('getExportableStats'), 'useStatsStore must provide getExportableStats method');
    assert.ok(statsStoreSrc.includes('Math.max(state.totalSeconds || 0'), 'Must merge totalSeconds with Math.max');

    const authSrc = fs.readFileSync(path.join(root, 'src/services/spotifreeAuth.ts'), 'utf-8');
    assert.ok(authSrc.includes('syncWithCloudStats(st.listeningStats)'), 'applyAccountToAppStores must sync cloud listening stats');
    assert.ok(authSrc.includes('scheduleCloudStatsSync'), 'spotifreeAuth must provide scheduleCloudStatsSync');
    assert.ok(authSrc.includes('listeningStats'), 'updateCurrentAccount must include listeningStats in cloud payload');
  });

  it('6. Live daily charts (Top 50 Espana, Top 50 Global) route dynamically', () => {
    const serverSrc = fs.readFileSync(path.join(root, 'server.mjs'), 'utf-8');
    assert.ok(serverSrc.includes("rawId === 'sf-trend-spain'"), 'server.mjs must handle sf-trend-spain live chart');
    assert.ok(serverSrc.includes("rawId === 'sf-trend-global'"), 'server.mjs must handle sf-trend-global live chart');

    const apiPlaylistSrc = fs.readFileSync(path.join(root, 'api/playlist.js'), 'utf-8');
    assert.ok(apiPlaylistSrc.includes("cleanId === 'sf-trend-spain'"), 'api/playlist.js must handle sf-trend-spain');
    assert.ok(apiPlaylistSrc.includes("cleanId === 'sf-trend-global'"), 'api/playlist.js must handle sf-trend-global');
  });

  it('7. Classic 3-circle blue Radio cover and diverse cover styles are implemented', () => {
    const mixesSrc = fs.readFileSync(path.join(root, 'src/services/spotifreeMixes.ts'), 'utf-8');
    assert.ok(mixesSrc.includes('makeRadioCoverSvg'), 'Must export makeRadioCoverSvg');
    assert.ok(mixesSrc.includes('makeVinylCoverSvg'), 'Must export makeVinylCoverSvg');
    assert.ok(mixesSrc.includes("'radio'"), 'CoverStyle must include radio');
    assert.ok(mixesSrc.includes("'vinyl'"), 'CoverStyle must include vinyl');
    assert.ok(mixesSrc.includes('#70a6f4'), 'Radio cover must use Spotify sky blue accent');
  });

  it('8. Daily rotation of artist mixes and dynamic home shelves are active', () => {
    const mixesSrc = fs.readFileSync(path.join(root, 'src/services/spotifreeMixes.ts'), 'utf-8');
    assert.ok(mixesSrc.includes('dailyArtistSeed'), 'Must rotate artist pool deterministically each day');
    assert.ok(mixesSrc.includes('sf-inspired-shelves'), 'Must create dedicated inspired mixes shelf');
    assert.ok(mixesSrc.includes('dayCycle = dayOfYear % 3'), 'Must rotate home shelves ordering across days');
  });

  it('9. Version 1.6 / 1.6.0 metadata is consistent and strictly zero emojis in new files', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
    assert.ok(['1.6.0', '1.6.1', '1.7.0'].includes(pkg.version), 'package.json version must be 1.6.0, 1.6.1 or 1.7.0');

    const changelog = fs.readFileSync(path.join(root, 'src/data/changelog.ts'), 'utf-8');
    assert.ok(changelog.includes("export const APP_VERSION = '1.6") || changelog.includes("export const APP_VERSION = '1.7"), 'APP_VERSION must start with 1.6 or 1.7');
    assert.ok(changelog.includes("version: '1.6'"), 'Changelog must include version 1.6 release entry');

    // Emoji check
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/u;
    const testSrc = fs.readFileSync(path.join(root, 'tests/v160_shared_playlists_stats_sync_and_daily_rotation.test.mjs'), 'utf-8');
    assert.ok(!emojiRegex.test(testSrc), 'Test file must strictly contain zero emojis');
    assert.ok(!emojiRegex.test(changelog.slice(0, 500)), 'Changelog 1.6 header must strictly contain zero emojis');
  });
});
