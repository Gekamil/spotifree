import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Spotifree v1.7.1: Artist 3-Dots Menu, Default Device Downloads & Batch Move, and Offline Shuffle Fix', async (t) => {
  await t.test('1. downloadFolders defaults to device music folder and supports batch moving', async () => {
    const downloadFoldersPath = path.join(rootDir, 'src', 'utils', 'downloadFolders.ts');
    const content = fs.readFileSync(downloadFoldersPath, 'utf8');

    // Verify default fallback is FOLDER_DEVICE_ID
    assert.match(
      content,
      /return\s+FOLDER_DEVICE_ID;/,
      'getTrackFolderId must fallback to FOLDER_DEVICE_ID by default'
    );

    // Verify moveTracksToFolder batch function exists and is exported
    assert.match(
      content,
      /export\s+function\s+moveTracksToFolder\s*\(/,
      'moveTracksToFolder batch function must be exported'
    );
    assert.match(
      content,
      /moveTrackToFolder\(trackId:\s*string,\s*folderId:\s*string\)/,
      'moveTrackToFolder must delegate to batch moving'
    );
  });

  await t.test('2. LocalFilesView fixes shuffle reset and integrates batch selection', async () => {
    const localFilesViewPath = path.join(rootDir, 'src', 'components', 'common', 'LocalFilesView.tsx');
    const content = fs.readFileSync(localFilesViewPath, 'utf8');

    // Verify shuffle toggling without resetting playlist to track 0
    assert.match(
      content,
      /handleToggleShuffle/,
      'LocalFilesView must implement handleToggleShuffle'
    );
    assert.match(
      content,
      /toggleShuffle\(\)/,
      'handleToggleShuffle must call toggleShuffle to cycle modes'
    );
    assert.match(
      content,
      /SmartShuffleNativeIcon/,
      'LocalFilesView must render SmartShuffleNativeIcon for smart shuffle'
    );
    assert.doesNotMatch(
      content,
      /onClick=\{\(\)\s*=>\s*playAll\(true\)\}/,
      'LocalFilesView must no longer call playAll(true) on the shuffle button'
    );

    // Verify batch selection and multi-move
    assert.match(
      content,
      /isSelectMode/,
      'LocalFilesView must track multi-selection mode'
    );
    assert.match(
      content,
      /selectedTrackIds/,
      'LocalFilesView must maintain selectedTrackIds set'
    );
    assert.match(
      content,
      /moveTracksToFolder/,
      'LocalFilesView must import and call moveTracksToFolder'
    );
    assert.match(
      content,
      /handleBatchSaveToDevice/,
      'LocalFilesView must support saving multiple tracks to device'
    );
  });

  await t.test('3. ContextMenu implements dedicated Artist context actions', async () => {
    const contextMenuPath = path.join(rootDir, 'src', 'components', 'desktop', 'ContextMenu.tsx');
    const content = fs.readFileSync(contextMenuPath, 'utf8');

    // Verify robust artist detection even when targetPlaylist is not in store
    assert.match(
      content,
      /contextMenu\.playlistId\?\.startsWith\('art-'\)/,
      'isArtist must detect art- prefix'
    );
    assert.match(
      content,
      /contextMenu\.playlistId\?\.startsWith\('spotify:artist:'\)/,
      'isArtist must detect spotify:artist: URI prefix'
    );

    // Verify artist actions
    assert.match(
      content,
      /Ir a la radio del artista/,
      'ContextMenu must include artist radio action'
    );
    assert.match(
      content,
      /Copiar enlace del artista/,
      'ContextMenu must include copy artist link action'
    );
    assert.match(
      content,
      /Dejar de seguir.*Seguir/,
      'ContextMenu must include artist follow/unfollow toggle'
    );
  });

  await t.test('4. MobilePlaylistView adds 3-dots action button and dedicated artist sheet items', async () => {
    const mobilePlaylistPath = path.join(rootDir, 'src', 'components', 'mobile', 'MobilePlaylistView.tsx');
    const content = fs.readFileSync(mobilePlaylistPath, 'utf8');

    // Verify 3-dots button is in action row
    assert.match(
      content,
      /title=\{isArtist \? 'M[aá]s opciones del artista' : 'M[aá]s opciones de la playlist'\}/,
      'MobilePlaylistView action row must include 3-dots button'
    );

    // Verify dedicated artist sheet branch
    assert.match(
      content,
      /isArtist \? \(/,
      'MobileSheet must have dedicated branch for artists'
    );
    assert.match(
      content,
      /Ir a la radio del artista/,
      'MobileSheet must include artist radio action'
    );
    assert.match(
      content,
      /Copiar enlace del artista/,
      'MobileSheet must include copy artist link action'
    );
  });

  await t.test('5. offlineStorage downloadPlaylist saves physical files when device is available', async () => {
    const offlineStoragePath = path.join(rootDir, 'src', 'utils', 'offlineStorage.ts');
    const content = fs.readFileSync(offlineStoragePath, 'utf8');

    assert.match(
      content,
      /if \(isDeviceMusicAvailable\(\)\)\s*\{\s*await saveTrackAsMp3File\(track\)\.catch\(/,
      'downloadPlaylist must save to real device when on device'
    );
  });

  await t.test('6. Strict Zero-Emoji Rule across all modified files', async () => {
    const filesToCheck = [
      path.join(rootDir, 'src', 'utils', 'downloadFolders.ts'),
      path.join(rootDir, 'src', 'utils', 'offlineStorage.ts'),
      path.join(rootDir, 'src', 'components', 'common', 'LocalFilesView.tsx'),
      path.join(rootDir, 'src', 'components', 'desktop', 'ContextMenu.tsx'),
      path.join(rootDir, 'src', 'components', 'desktop', 'DesktopPlaylistView.tsx'),
      path.join(rootDir, 'src', 'components', 'mobile', 'MobilePlaylistView.tsx'),
      __filename,
    ];

    const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]/;

    for (const filePath of filesToCheck) {
      const text = fs.readFileSync(filePath, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        assert.ok(
          !emojiRegex.test(line),
          `Found emoji in ${path.basename(filePath)} at line ${i + 1}: ${line}`
        );
      }
    }
  });
});
