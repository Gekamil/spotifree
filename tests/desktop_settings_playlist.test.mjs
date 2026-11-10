import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Desktop Settings & Playlist Functionality (Requirement R3)', () => {
  const rootDir = process.cwd();
  const settingsPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopSettingsView.tsx');
  const playlistViewPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopPlaylistView.tsx');
  const contextMenuPath = path.join(rootDir, 'src', 'components', 'desktop', 'ContextMenu.tsx');
  const advancedSettingsPath = path.join(rootDir, 'src', 'components', 'common', 'AdvancedSettingsSection.tsx');

  const settingsContent = fs.readFileSync(settingsPath, 'utf8');
  const playlistContent = fs.readFileSync(playlistViewPath, 'utf8');
  const contextMenuContent = fs.readFileSync(contextMenuPath, 'utf8');
  const advancedSettingsContent = fs.readFileSync(advancedSettingsPath, 'utf8');

  describe('1. Desktop Settings Reorganization (8 Official Spotify Categories)', () => {
    it('has the 8 official Spotify desktop categories defined in exact order', () => {
      const categories = [
        'Cuenta',
        'Idioma',
        'Calidad de audio y Ecualizador',
        'Reproducción',
        'Visualización y Contenido',
        'Tu biblioteca y Archivos locales',
        'Almacenamiento',
        'Social y Acerca de',
      ];

      let lastIndex = -1;
      for (const cat of categories) {
        const idx = settingsContent.indexOf(cat);
        assert.ok(idx > -1, `Category "${cat}" must be present in DesktopSettingsView`);
        assert.ok(
          idx > lastIndex,
          `Category "${cat}" at index ${idx} must appear after previous category at index ${lastIndex}`
        );
        lastIndex = idx;
      }
    });

    it('Category 1 (Cuenta) contains SpotifreeAuthCard, sp_dc cookie session, and mobile QR link', () => {
      assert.ok(settingsContent.includes('<SpotifreeAuthCard'), 'Must contain SpotifreeAuthCard');
      assert.ok(settingsContent.includes('Cookie de sesión (sp_dc)'), 'Must contain sp_dc cookie session row');
      assert.ok(settingsContent.includes('Vincular con la app móvil'), 'Must contain mobile QR connection row');
    });

    it('Category 2 (Idioma) contains SpotifyCustomSelect language picker', () => {
      assert.ok(settingsContent.includes('<SpotifyCustomSelect'), 'Must contain SpotifyCustomSelect');
      assert.ok(settingsContent.includes('LANGUAGE_OPTIONS'), 'Must use LANGUAGE_OPTIONS');
    });

    it('Category 3 (Calidad de audio y Ecualizador) contains volume normalization and SpotifyEqualizer', () => {
      assert.ok(settingsContent.includes('Normalizar el volumen'), 'Must contain volume normalization toggle');
      assert.ok(settingsContent.includes('<SpotifyEqualizer variant="desktop" />'), 'Must contain SpotifyEqualizer');
    });

    it('Category 4 (Reproducción) contains gapless, crossfade slider, autoplay, DJ effects, and DJ voice picker', () => {
      assert.ok(settingsContent.includes('Reproducción sin pausas'), 'Must contain gapless toggle');
      assert.ok(settingsContent.includes('Fundido entre canciones'), 'Must contain crossfade section');
      assert.ok(settingsContent.includes('crossfadeSeconds'), 'Must contain crossfade slider');
      assert.ok(settingsContent.includes('Reproducción automática similar'), 'Must contain autoplay toggle');
      assert.ok(settingsContent.includes('<DJEffectsSelector />'), 'Must contain DJEffectsSelector');
      assert.ok(settingsContent.includes('<DJVoicePicker />'), 'Must contain DJVoicePicker');
    });

    it('Category 5 (Visualización y Contenido) contains now playing panel, photo banners, canvas, music videos, motion covers, app icon', () => {
      assert.ok(settingsContent.includes('Mostrar el panel Sonando al reproducir'), 'Must contain now playing panel toggle');
      assert.ok(settingsContent.includes('Convertir fotos a banners'), 'Must contain convert photos to banners toggle');
      assert.ok(settingsContent.includes('Canvas'), 'Must contain Canvas toggle');
      assert.ok(settingsContent.includes('Vídeos musicales'), 'Must contain music videos toggle');
      assert.ok(settingsContent.includes('<MotionCoverSetting />'), 'Must contain MotionCoverSetting');
      assert.ok(settingsContent.includes('<AppIconSelector variant="desktop" />'), 'Must contain AppIconSelector');
    });

    it('Category 6 (Tu biblioteca y Archivos locales) contains compact mode, local files link, shuffle algorithm, and recover playlists', () => {
      assert.ok(settingsContent.includes('Usar diseño de biblioteca compacta'), 'Must contain compact library mode toggle');
      assert.ok(settingsContent.includes("setActiveMainTab('local')"), 'Must wire local files button to setActiveMainTab local');
      assert.ok(settingsContent.includes('<AdvancedSettingsSection variant="desktop" />'), 'Must contain AdvancedSettingsSection');
      assert.ok(settingsContent.includes('<RecoverPlaylistsSection variant="desktop" />'), 'Must contain RecoverPlaylistsSection');
    });

    it('Category 7 (Almacenamiento) contains cache size and clear cache button', () => {
      assert.ok(settingsContent.includes('Caché de canciones y portadas'), 'Must contain cache row');
      assert.ok(settingsContent.includes('handleClearCache'), 'Must wire clear cache button');
    });

    it('Category 8 (Social y Acerca de) contains shared session listening, music taste onboarding, and app version', () => {
      assert.ok(settingsContent.includes('<ListeningFriendsSection variant="desktop" />'), 'Must contain ListeningFriendsSection');
      assert.ok(settingsContent.includes('openTasteOnboarding()'), 'Must wire music taste onboarding button');
      assert.ok(settingsContent.includes('<AboutAppSection variant="desktop" />'), 'Must contain AboutAppSection');
    });

    it('unifies row styling using flat rows with border-b border-white/5', () => {
      const flatRowMatches = settingsContent.match(/border-b border-white\/5/g);
      assert.ok(flatRowMatches && flatRowMatches.length >= 8, 'Must use flat row styling with border-b border-white/5 across sections');
      assert.ok(advancedSettingsContent.includes('border-b border-white/5'), 'AdvancedSettingsSection desktop variant must use border-b border-white/5');
    });
  });

  describe('2. Desktop Playlist View Interactive Buttons', () => {
    it('normalizes track ID comparison in isCurrentPlaylistPlaying with matchTrackId', () => {
      assert.ok(
        playlistContent.includes('matchTrackId(t.id, currentTrack?.id)'),
        'isCurrentPlaylistPlaying must use matchTrackId to normalize track IDs'
      );
    });

    it('handlePlayAll handles loading and empty states gracefully', () => {
      assert.ok(
        playlistContent.includes("if (loading)") && playlistContent.includes("showGlobalToast('Cargando canciones de la lista...')"),
        'handlePlayAll must show feedback toast while loading'
      );
      assert.ok(
        playlistContent.includes("showGlobalToast('La lista no tiene canciones disponibles')"),
        'handlePlayAll must show feedback toast when tracks is empty'
      );
    });

    it('add/save to library button excludes artists to avoid duplicate + button', () => {
      assert.ok(
        playlistContent.includes('!isLikedPlaylist && !isFolder && !isArtist'),
        'Add to library button condition must check !isArtist'
      );
      assert.ok(
        playlistContent.includes("showGlobalToast(next ? 'Añadida a Tu biblioteca' : 'Eliminada de Tu biblioteca')"),
        'handleToggleLibrary must dispatch showGlobalToast feedback'
      );
    });

    it('artist "Seguir / Siguiendo" button calls toggleFollowArtist from artistFollow.ts', () => {
      assert.ok(
        playlistContent.includes('handleToggleFollowArtist'),
        'Must define handleToggleFollowArtist'
      );
      assert.ok(
        playlistContent.includes('toggleFollowArtist({'),
        'Must call toggleFollowArtist with artist data'
      );
      assert.ok(
        playlistContent.includes('onClick={handleToggleFollowArtist}'),
        'Artist follow button must call handleToggleFollowArtist'
      );
    });

    it('playlist search bar contains inline clear button (X) when query is active', () => {
      assert.ok(
        playlistContent.includes("onClick={() => setFilterQuery('')}"),
        'Must have clear button triggering setFilterQuery empty'
      );
      assert.ok(
        playlistContent.includes('title="Borrar búsqueda"') || playlistContent.includes('aria-label="Borrar búsqueda"'),
        'Clear button must have descriptive title/aria-label'
      );
    });

    it('playlist displays dedicated empty search state when filter yields 0 matches', () => {
      assert.ok(
        playlistContent.includes('No se han encontrado resultados para «{filterQuery.trim()}»'),
        'Must display dedicated empty search message when filterQuery has no matches'
      );
    });

    it('creator links wire click handler to active tab / profile', () => {
      const profileWires = playlistContent.match(/onClick=\{\(\) => setActiveMainTab\('profile'\)\}/g);
      assert.ok(profileWires && profileWires.length >= 3, 'Creator links must wire onClick to setActiveMainTab profile');
    });
  });

  describe('3. Context Menu Playlist Options', () => {
    it('ContextMenu includes "Añadir a Tu biblioteca" / "Eliminar de Tu biblioteca" for playlists', () => {
      assert.ok(
        contextMenuContent.includes("isSavedInLibrary ? 'Eliminar de Tu biblioteca' : 'Añadir a Tu biblioteca'"),
        'Must display library toggle button in playlist context menu'
      );
    });

    it('ContextMenu includes "Descargar lista" and connects to offline download storage', () => {
      assert.ok(
        contextMenuContent.includes("'Descargar lista'"),
        'Must display Descargar lista in playlist context menu'
      );
      assert.ok(
        contextMenuContent.includes('downloadPlaylist(') && contextMenuContent.includes('isPlaylistDownloaded('),
        'Must wire downloadPlaylist and isPlaylistDownloaded in ContextMenu'
      );
    });
  });

  describe('4. Requirement R5: Preserved Files Integrity', () => {
    const preservedFiles = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js',
    ];

    for (const file of preservedFiles) {
      it(`preserves R5 file intact: ${file}`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `Preserved file ${file} must exist`);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(content.length > 50, `Preserved file ${file} must not be empty`);
      });
    }
  });
});
