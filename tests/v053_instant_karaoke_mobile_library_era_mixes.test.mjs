import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const audioEngineSource = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf-8');
const mobileLayoutSource = fs.readFileSync(path.resolve('src/components/mobile/MobileLayout.tsx'), 'utf-8');
const spotifreeMixesSource = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
const serverSource = fs.readFileSync(path.resolve('server.mjs'), 'utf-8');
const nowPlayingSource = fs.readFileSync(path.resolve('src/components/mobile/MobileNowPlayingModal.tsx'), 'utf-8');
const djVisualizerSource = fs.readFileSync(path.resolve('src/components/dj/SpotifyDJVisualizer.tsx'), 'utf-8');

describe('Spotifree v0.5.3: Instant Seamless Karaoke, Mobile Library Layout, & Era/Genre Mixes Photos', () => {
  describe('1. Instant Karaoke Hot-Swap (0ms silence / no dropout)', () => {
    it('Implements seamlessAudioSourceSwap using dual-deck crossfade', () => {
      assert.ok(audioEngineSource.includes('seamlessAudioSourceSwap'), 'Must define seamlessAudioSourceSwap');
      assert.ok(audioEngineSource.includes('targetSecYt.setVolume(0)'), 'Must buffer target player silently at volume 0');
      assert.ok(audioEngineSource.includes('targetSecYt.playVideo()'), 'Must start playback on incoming deck in background');
      assert.ok(audioEngineSource.includes('this.activeYtIndex = this.activeYtIndex === 0 ? 1 : 0'), 'Must swap active deck index');
    });

    it('Pre-cues instrumental source when found in checkInstrumentalSource', () => {
      assert.ok(audioEngineSource.includes('cueVideoById({ videoId: cand.sourceId'), 'Must pre-cue instrumental on secondary player');
    });

    it('toggleKaraokeMode calls seamlessAudioSourceSwap instead of pausing audio beforehand', () => {
      assert.ok(audioEngineSource.includes('this.seamlessAudioSourceSwap(inst.sourceId'), 'Must call seamlessAudioSourceSwap when turning on karaoke');
      assert.ok(audioEngineSource.includes('this.seamlessAudioSourceSwap(restoreId'), 'Must call seamlessAudioSourceSwap when restoring original');
    });
  });

  describe('2. Mobile Library Interface & Spotify Dense Spacing Alignment', () => {
    it('Uses compact page container (px-4 pt-2.5 pb-28 space-y-2.5)', () => {
      assert.ok(mobileLayoutSource.includes('px-4 pt-2.5 pb-28 space-y-2.5'), 'Library container must have dense spacing matching Spotify');
    });

    it('Implements horizontal scrollable filter chips with clear button', () => {
      assert.ok(mobileLayoutSource.includes('overflow-x-auto scrollbar-none -mx-4 px-4 py-0.5'), 'Chips must be in a horizontally scrollable container');
      assert.ok(mobileLayoutSource.includes('title="Borrar filtro"'), 'Must render clear filter button when a chip is active');
      assert.ok(mobileLayoutSource.includes('Álbumes'), 'Must include Álbumes chip');
    });

    it('Restores normal artwork size (w-14 h-14 / w-11 h-11) while keeping tight spacing (py-1 px-1 / space-y-0.5)', () => {
      assert.ok(mobileLayoutSource.includes("isCompact ? 'w-11 h-11' : 'w-14 h-14'"), 'Artwork must be standard w-14 h-14 in list mode');
      assert.ok(mobileLayoutSource.includes("isCompact ? 'py-0.5 px-1' : 'py-1 px-1'"), 'Row padding must be tight py-1 px-1');
      assert.ok(mobileLayoutSource.includes('space-y-0.5'), 'Row spacing must be tightened to space-y-0.5');
      assert.ok(mobileLayoutSource.includes('font-semibold text-white text-[15px] leading-tight truncate'), 'Title typography must match Spotify dense text');
    });

    it('Grid view cards use edge-to-edge p-0 artwork without bloated margins', () => {
      assert.ok(mobileLayoutSource.includes('className="p-0 cursor-pointer flex flex-col active:scale-[0.98] transition-all group select-none"'), 'Grid cards must use p-0');
      assert.ok(mobileLayoutSource.includes('pt-1.5 pb-1 px-0.5 min-w-0'), 'Grid label container must be tight pt-1.5 pb-1');
    });

    it('Removes standalone Buenas tardes greeting and sticks shortcuts grid directly to top bar', () => {
      assert.ok(!mobileLayoutSource.includes('¡Buenas tardes!'), 'Must remove greeting text from Home');
      assert.ok(mobileLayoutSource.includes('px-4 pt-1 mb-5'), 'Shortcuts grid must sit right below header bar');
    });

    it('Home DJ Card subscribes to live DJ speech visualizerState and voiceLevel', () => {
      assert.ok(mobileLayoutSource.includes("visualizerState: s.visualizerState"), 'Must subscribe to visualizerState');
      assert.ok(mobileLayoutSource.includes("voiceLevel: s.voiceLevel"), 'Must subscribe to voiceLevel');
      assert.ok(mobileLayoutSource.includes("visualizerState === 'speaking'"), 'Must react when DJ is speaking');
    });
  });

  describe('3. Era vs Generic Playlists Separation & Visible Background Cover Photos', () => {
    it('server.mjs includes /api/image-proxy endpoint with CORS headers', () => {
      assert.ok(serverSource.includes("pathname === '/api/image-proxy'"), 'server.mjs must provide /api/image-proxy');
    });

    it('makeCuratedThemedCover renders authentic Spotify Mix design with circular hero portrait and branding', () => {
      assert.ok(spotifreeMixesSource.includes('toProxiedImageUrl'), 'Must define toProxiedImageUrl');
      assert.ok(spotifreeMixesSource.includes('SPOTIFREE MIX'), 'Must render SPOTIFREE MIX header with equalizer sound bars');
      assert.ok(spotifreeMixesSource.includes('artistCircle') || spotifreeMixesSource.includes('ctx.arc(cx, cy, r'), 'Must render circular hero artist portrait');
      assert.ok(spotifreeMixesSource.includes('ctx.createLinearGradient(0, 280, 0, S)'), 'Must use smooth bottom gradient fade without harsh rectangular seam');
    });

    it('makeEraCoverSvg embeds SVG image layers for direct browser rendering', () => {
      assert.ok(spotifreeMixesSource.includes('<image href='), 'makeEraCoverSvg must embed SVG image layers');
      assert.ok(spotifreeMixesSource.includes('preserveAspectRatio="xMidYMid slice"'), 'Images must preserve aspect ratio');
    });

    it('Separates "Viaje en el tiempo" and "Playlists genéricas"', () => {
      assert.ok(spotifreeMixesSource.includes("id: 'sf-era-mixes'"), 'Must create sf-era-mixes shelf');
      assert.ok(spotifreeMixesSource.includes("title: 'Playlists genéricas'"), 'Must create Playlists genéricas shelf');
      assert.ok(spotifreeMixesSource.includes("prefix: 'GRANDES GÉNEROS'"), 'Must have GRANDES GÉNEROS prefix');
      assert.ok(spotifreeMixesSource.includes("id: 'sf-genre-indie'"), 'Must define Indie genre');
      assert.ok(spotifreeMixesSource.includes("id: 'sf-genre-hiphop'"), 'Must define Hip-Hop genre');
    });
  });

  describe('4. Vercel Serverless Function Limit Compliance (<= 12 functions)', () => {
    it('api directory contains at most 12 Serverless Function files (Hobby plan limit)', () => {
      const apiFiles = fs.readdirSync(path.resolve('api'))
        .filter(f => f.endsWith('.js') && !f.startsWith('_'));
      assert.ok(apiFiles.length <= 12, `Must not exceed 12 functions, found ${apiFiles.length} (${apiFiles.join(', ')})`);
      assert.ok(apiFiles.length <= 10, `Optimized to <= 10 functions for safety buffer, found ${apiFiles.length}`);
    });

    it('api/metadata.js consolidates canvas and image-proxy', () => {
      const metaSource = fs.readFileSync(path.resolve('api/metadata.js'), 'utf-8');
      assert.ok(metaSource.includes("handleImageProxy"), 'metadata.js must handle image-proxy');
      assert.ok(metaSource.includes("handleCanvas"), 'metadata.js must handle canvas');
    });

    it('api/login.js consolidates session extraction and token exchange', () => {
      const loginSource = fs.readFileSync(path.resolve('api/login.js'), 'utf-8');
      assert.ok(loginSource.includes("handleToken"), 'login.js must handle token exchange');
    });

    it('api/auth.js consolidates user profile customization', () => {
      const authSource = fs.readFileSync(path.resolve('api/auth.js'), 'utf-8');
      assert.ok(authSource.includes("handleUserProfile"), 'auth.js must handle user profiles');
    });

    it('vercel.json routes all consolidated endpoints correctly', () => {
      const vercelConfig = JSON.parse(fs.readFileSync(path.resolve('vercel.json'), 'utf-8'));
      const rewrites = vercelConfig.rewrites || [];
      assert.ok(rewrites.some(r => r.source === '/api/image-proxy' && r.destination.includes('/api/metadata')), 'rewrites must route /api/image-proxy to metadata');
      assert.ok(rewrites.some(r => r.source === '/api/token' && r.destination.includes('/api/login')), 'rewrites must route /api/token to login');
      assert.ok(rewrites.some(r => r.source === '/api/user-profile' && r.destination.includes('/api/auth')), 'rewrites must route /api/user-profile to auth');
    });
  });

  describe('5. Spotify Parity: AI DJ Active Speaking Orb & Bottom Sheets for Queue & Menu', () => {
    it('DJ Visualizer implements active undulating speech wave dynamics (bulgeBase and pulseScale)', () => {
      assert.ok(djVisualizerSource.includes('bulgeBase = (2.4 + currentVoice * 3.6)'), 'Must amplify speech wave displacement when speaking');
      assert.ok(djVisualizerSource.includes('pulseScale = 1 + Math.sin(time * 2.6) * 0.035 + Math.sin(time * 5.2) * 0.018 + currentVoice * 0.055'), 'Must pulse orb radius dynamically with voice volume and harmonics');
    });

    it('Track 3-Dots Menu is a bottom sheet with clean Spotify SVG icons and purple gradient heart', () => {
      assert.ok(nowPlayingSource.includes('max-h-[75vh] overflow-y-auto border-t border-white/10 shadow-2xl select-none'), 'Menu must be a bottom sheet drawer');
      assert.ok(nowPlayingSource.includes('from-[#450af5] to-[#8e8ee5]'), 'Canciones que te gustan must have iconic Spotify purple gradient heart');
      assert.ok(nowPlayingSource.includes('Ir a la cola'), 'Menu must have Ir a la cola action');
      assert.ok(nowPlayingSource.includes('Añadir a la cola'), 'Menu must have Añadir a la cola action');
      assert.ok(!nowPlayingSource.includes('w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0'), 'Must remove gray circular icon wrappers');
    });

    it('Queue is a bottom sheet drawer (~78vh) with now playing row, upcoming queue, and sticky action bar', () => {
      assert.ok(nowPlayingSource.includes('max-h-[82vh] h-[78vh] flex flex-col shadow-2xl border-t border-white/10'), 'Queue must be a bottom sheet drawer');
      assert.ok(nowPlayingSource.includes('Cola'), 'Must render Cola title');
      assert.ok(nowPlayingSource.includes('Reproduciendo <span className="font-medium text-white/90">{contextName}</span>'), 'Must render active playback context');
      assert.ok(nowPlayingSource.includes('text-[#1ed760] truncate font-[\'SpotifyMixUITitle\']'), 'Currently playing track title must be green');
      assert.ok(nowPlayingSource.includes('w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-lg'), 'Now playing must have circular white play/pause button');
      assert.ok(nowPlayingSource.includes('Modo aleatorio desde:'), 'Must render Modo aleatorio desde section');
      assert.ok(nowPlayingSource.includes('Aleatorio'), 'Must render Aleatorio bottom pill');
      assert.ok(nowPlayingSource.includes('Temporizador'), 'Must render Temporizador bottom pill');
    });

    it('useDragToDismiss supports universal pointer events and animated exit transitions', () => {
      const dragHookSource = fs.readFileSync(path.resolve('src/hooks/useDragToDismiss.ts'), 'utf-8');
      assert.ok(dragHookSource.includes('onPointerDown'), 'Must handle pointer down for mouse and touch');
      assert.ok(dragHookSource.includes('onPointerMove'), 'Must handle pointer move');
      assert.ok(dragHookSource.includes('onPointerUp'), 'Must handle pointer up');
      assert.ok(dragHookSource.includes('setPointerCapture'), 'Must use setPointerCapture for drag reliability');
      assert.ok(dragHookSource.includes('triggerDismiss'), 'Must expose triggerDismiss for animated programmatic closing');
      assert.ok(nowPlayingSource.includes('dismissMenu'), 'Mobile player must use dismissMenu');
      assert.ok(nowPlayingSource.includes('dismissQueue'), 'Mobile player must use dismissQueue');
    });
  });

  describe('6. Spotifree Mobile Refinements: Clean 4-Tab Bar, 2-Filter Header, Compact 48px Shortcuts, & Right-Side Karaoke Controls', () => {
    it('MobileBottomNav implements clean 4-tab layout without Premium', () => {
      const navSource = fs.readFileSync(path.resolve('src/components/mobile/MobileBottomNav.tsx'), 'utf-8');
      assert.ok(!navSource.includes('title="Premium"'), 'Must NOT include Premium tab');
      assert.ok(navSource.includes('Tu biblioteca'), 'Must include Tu biblioteca tab');
      assert.ok(navSource.includes('Buscar'), 'Must include Buscar tab');
      assert.ok(navSource.includes('Inicio'), 'Must include Inicio tab');
      assert.ok(navSource.includes('Crear'), 'Must include Crear tab');
    });

    it('MobileHeader includes relevant music pills (Todos, Música) without audiobooks/podcasts', () => {
      const headerSource = fs.readFileSync(path.resolve('src/components/mobile/MobileHeader.tsx'), 'utf-8');
      assert.ok(!headerSource.includes('Audiolibros'), 'Must NOT include Audiolibros pill');
      assert.ok(!headerSource.includes('Pódcasts'), 'Must NOT include Pódcasts pill');
      assert.ok(headerSource.includes('Todos'), 'Must include Todos pill');
      assert.ok(headerSource.includes('Música'), 'Must include Música pill');
    });

    it('Shortcuts grid uses compact 48px height (h-12) with flush artwork (w-12 h-12)', () => {
      const currentLayout = fs.readFileSync(path.resolve('src/components/mobile/MobileLayout.tsx'), 'utf-8');
      assert.ok(currentLayout.includes('h-12 bg-[#282828]'), 'Shortcuts card must be sleek 48px tall');
      assert.ok(currentLayout.includes('w-12 h-12 shrink-0 rounded-l-md'), 'Shortcuts image must be 48px square');
      assert.ok(currentLayout.includes('grid grid-cols-2 gap-2'), 'Shortcuts grid must use gap-2');
    });

    it('LyricsFullscreen features right-side floating karaoke microphone button and vertical slider', () => {
      const lyricsSource = fs.readFileSync(path.resolve('src/components/mobile/LyricsFullscreen.tsx'), 'utf-8');
      assert.ok(lyricsSource.includes('fixed right-3.5 bottom-36'), 'Must position karaoke controls on the right side');
      assert.ok(lyricsSource.includes('aria-label="Ajustar volumen de voz / karaoke"'), 'Must have right-side mic button');
      assert.ok(lyricsSource.includes('karaoke.vocalLevel'), 'Must support variable vocal attenuation');
    });
  });
});
