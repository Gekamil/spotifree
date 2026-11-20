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

    it('makeCuratedThemedCover loads photos via image-proxy and renders with visible alpha', () => {
      assert.ok(spotifreeMixesSource.includes('toProxiedImageUrl'), 'Must define toProxiedImageUrl');
      assert.ok(spotifreeMixesSource.includes('ctx.globalAlpha = 0.58'), 'Photos must be visibly blended with alpha 0.58');
      assert.ok(spotifreeMixesSource.includes('rgba(18, 18, 18, 0.40)'), 'Tint gradient must let photos shine through');
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
  });
});
