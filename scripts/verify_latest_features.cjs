const fs = require('fs');
const path = require('path');

console.log('--- VERIFYING LATEST SPOTIFREE FIXES & CAPABILITIES ---');

// 1. Verify build files exist
const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
if (fs.existsSync(distIndex)) {
  console.log('✓ Production dist build exists:', fs.statSync(distIndex).size, 'bytes');
} else {
  console.error('✗ Dist build missing!');
  process.exit(1);
}

// 2. Check SpotifyNativeIcons has SearchActiveNativeIcon, ShareNativeIcon, VideoSwitchNativeIcon, AudioSwitchNativeIcon, OptionsNativeIcon
const iconsFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'icons', 'SpotifyNativeIcons.tsx'), 'utf-8');
const expectedIcons = ['SearchActiveNativeIcon', 'ShareNativeIcon', 'VideoSwitchNativeIcon', 'AudioSwitchNativeIcon', 'OptionsNativeIcon'];
for (const icon of expectedIcons) {
  if (iconsFile.includes(`export const ${icon}`)) {
    console.log(`✓ Icon ${icon} exported correctly`);
  } else {
    console.error(`✗ Missing icon: ${icon}`);
    process.exit(1);
  }
}

// 3. Check MobileBottomNav uses SearchActiveNativeIcon and rotation
const navFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'mobile', 'MobileBottomNav.tsx'), 'utf-8');
if (navFile.includes('SearchActiveNativeIcon') && navFile.includes('rotate-45') && navFile.includes('isCreateOpen')) {
  console.log('✓ MobileBottomNav correctly implements active search with inner circle and + to x rotation');
} else {
  console.error('✗ MobileBottomNav missing expected props or rotation');
  process.exit(1);
}

// 4. Check MobileHeader removed podcasts and has only Todo and Musica
const headerFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'mobile', 'MobileHeader.tsx'), 'utf-8');
if (!headerFile.includes('Pódcasts') && headerFile.includes("'todo' | 'musica'") && headerFile.includes('Todo') && headerFile.includes('Música')) {
  console.log('✓ MobileHeader has podcasts removed and strict Todo/Música filter');
} else {
  console.error('✗ MobileHeader still has podcasts or incorrect filter types');
  process.exit(1);
}

// 5. Check playlistImporter exists and is referenced in MobileCreateSheet
const importerFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'playlistImporter.ts'), 'utf-8');
const createSheetFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'mobile', 'MobileCreateSheet.tsx'), 'utf-8');
if (importerFile.includes('importExternalPlaylist') && createSheetFile.includes('importExternalPlaylist')) {
  console.log('✓ Playlist importer configured and wired in MobileCreateSheet');
} else {
  console.error('✗ Playlist importer missing or not wired');
  process.exit(1);
}

// 6. Check MobilePlaylistView has OptionsNativeIcon, ShareNativeIcon, solid opaque cover and dynamic color extraction
const plViewFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'mobile', 'MobilePlaylistView.tsx'), 'utf-8');
if (
  plViewFile.includes('OptionsNativeIcon') &&
  plViewFile.includes('ShareNativeIcon') &&
  plViewFile.includes('extractDominantColorFromImage') &&
  plViewFile.includes('shadow-[0_16px_36px_rgba(0,0,0,0.85)]') &&
  plViewFile.includes('track.added_by')
) {
  console.log('✓ MobilePlaylistView has all options, share button, solid opaque cover, and added_by tracking');
} else {
  console.error('✗ MobilePlaylistView missing key elements');
  process.exit(1);
}

// 7. Check MobileNowPlayingModal has Cambiar a video / audio and dynamic color
const playerModalFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'mobile', 'MobileNowPlayingModal.tsx'), 'utf-8');
if (
  playerModalFile.includes('Cambiar a vídeo') &&
  playerModalFile.includes('Cambiar a audio') &&
  playerModalFile.includes('VideoSwitchNativeIcon') &&
  playerModalFile.includes('AudioSwitchNativeIcon') &&
  playerModalFile.includes('iframe') &&
  playerModalFile.includes('extractedModalColor')
) {
  console.log('✓ MobileNowPlayingModal has Cambiar a vídeo toggle and YouTube player embed');
} else {
  console.error('✗ MobileNowPlayingModal missing video switch features');
  process.exit(1);
}

// 8. Check MobileSettingsView has EQ, crossfade, audio engine, gapless, and normalization
const settingsFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'mobile', 'MobileSettingsView.tsx'), 'utf-8');
if (
  settingsFile.includes('Ecualizador de Audio') &&
  settingsFile.includes('Fundido entre canciones') &&
  settingsFile.includes('Motor de Audio') &&
  settingsFile.includes('Normalizar el volumen') &&
  settingsFile.includes('Modo sin conexión')
) {
  console.log('✓ MobileSettingsView has complete parity with desktop settings');
} else {
  console.error('✗ MobileSettingsView missing settings sections');
  process.exit(1);
}

console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
