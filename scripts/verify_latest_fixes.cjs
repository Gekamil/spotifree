const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const distDir = path.join(__dirname, '..', 'dist');

// Simple static server for dist
function startServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json',
  };

  const server = http.createServer((req, res) => {
    let filePath = path.join(distDir, req.url.split('?')[0]);
    if (req.url === '/' || !path.extname(filePath)) {
      filePath = path.join(distDir, 'index.html');
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(content);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function run() {
  const { server, port } = await startServer();
  console.log(`Test server running at http://127.0.0.1:${port}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });

    // Seed mock active session via __useSpotifyDataStore
    await page.evaluate(() => {
      if (window.__useSpotifyDataStore) {
        window.__useSpotifyDataStore.setState({
          isAuthenticated: true,
          user: {
            id: 'test_user',
            display_name: 'Jorge Spotify',
            images: [{ url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb' }],
          },
          playlists: [
            {
              id: 'pl-test-1',
              name: 'Mix de Reggaetón 2026',
              images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745' }],
              tracks: {
                total: 2,
                items: [
                  {
                    id: 'trk-1',
                    name: 'Monaco',
                    artists: [{ id: 'bb', name: 'Bad Bunny' }],
                    album: { id: 'alb-1', name: 'Nadie Sabe', images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819' }] },
                    duration_ms: 240000,
                  },
                  {
                    id: 'trk-2',
                    name: 'Lollipop',
                    artists: [{ id: 'dd', name: 'Darell' }],
                    album: { id: 'alb-2', name: 'Lollipop', images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4' }] },
                    duration_ms: 190000,
                  },
                ],
              },
            },
          ],
        });
      }
    });

    await new Promise((r) => setTimeout(r, 600));

    // 1. Verify index.html meta tags and PWA icons
    const pwaCheck = await page.evaluate(() => {
      const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href');
      const manifest = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
      const appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content');
      return { appleTouchIcon, manifest, appTitle };
    });
    console.log('1. PWA Tags Check:', pwaCheck);
    if (!pwaCheck.appleTouchIcon || !pwaCheck.manifest || pwaCheck.appTitle !== 'Spotifree') {
      throw new Error(`PWA tags check failed: expected appTitle Spotifree, got ${pwaCheck.appTitle}`);
    }

    // 1b. Test Header 3 Filter Pills: "Todo", "Música", "Pódcasts"
    const headerPillsCheck = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button'));
      const todoBtn = buttons.find(b => b.textContent && b.textContent.trim() === 'Todo');
      const musicaBtn = buttons.find(b => b.textContent && b.textContent.trim() === 'Música');
      const podcastsBtn = buttons.find(b => b.textContent && b.textContent.trim() === 'Pódcasts');
      return {
        hasTodo: !!todoBtn,
        hasMusica: !!musicaBtn,
        hasPodcasts: !!podcastsBtn,
      };
    });
    console.log('1b. Header Filter Pills Check:', headerPillsCheck);
    if (!headerPillsCheck.hasTodo || !headerPillsCheck.hasMusica || !headerPillsCheck.hasPodcasts) {
      throw new Error('Header missing one of the 3 filter pills (Todo, Música, Pódcasts)');
    }

    // Click "Pódcasts" and verify podcast content appears
    await page.evaluate(() => {
      const podcastsBtn = Array.from(document.querySelectorAll('header button')).find(b => b.textContent && b.textContent.trim() === 'Pódcasts');
      if (podcastsBtn) podcastsBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const podcastsContentCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasWildProject: text.includes('The Wild Project') || text.includes('Jordi Wild'),
        hasPodcastsTitle: text.includes('pódcasts') || text.includes('Pódcasts'),
      };
    });
    console.log('1c. Podcasts Filter Content Check:', podcastsContentCheck);
    if (!podcastsContentCheck.hasWildProject) {
      throw new Error('Podcasts filter did not render podcast shelves');
    }

    // Switch back to "Todo"
    await page.evaluate(() => {
      const todoBtn = Array.from(document.querySelectorAll('header button')).find(b => b.textContent && b.textContent.trim() === 'Todo');
      if (todoBtn) todoBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // 2. Open Library and inspect Playlist & track covers
    console.log('2. Navigating to Library / Playlist on mobile...');
    await page.evaluate(() => {
      // Find Library bottom nav button (Tu biblioteca)
      const buttons = Array.from(document.querySelectorAll('button'));
      const libBtn = buttons.find(b => b.textContent && b.textContent.includes('Tu biblioteca'));
      if (libBtn) libBtn.click();
    });

    await new Promise((r) => setTimeout(r, 800));

    // Click on a playlist item
    await page.evaluate(() => {
      const playlistItems = document.querySelectorAll('.cursor-pointer');
      for (const item of playlistItems) {
        if (item.textContent && (item.textContent.includes('canciones') || item.textContent.includes('Playlist'))) {
          item.click();
          break;
        }
      }
    });

    await new Promise((r) => setTimeout(r, 1200));

    // Check track artworks inside playlist
    const trackArtCheck = await page.evaluate(() => {
      const images = document.querySelectorAll('img[alt]');
      const trackImages = Array.from(images).filter(img => img.className.includes('w-11') || img.className.includes('rounded'));
      return {
        totalImages: images.length,
        trackImagesCount: trackImages.length,
      };
    });
    console.log('2. Playlist Track Artworks:', trackArtCheck);

    const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
    await page.screenshot({ path: path.join(artifactDir, 'mobile_playlist_track_covers_verified.png') });

    // 3. Open Mobile Profile & Edit Profile Modal
    console.log('3. Navigating to Mobile Profile...');
    await page.evaluate(() => {
      // Go to home tab
      const buttons = Array.from(document.querySelectorAll('button'));
      const homeBtn = buttons.find(b => b.textContent && b.textContent.includes('Inicio'));
      if (homeBtn) homeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Click Avatar to open Profile
    await page.evaluate(() => {
      const topAvatar = document.querySelector('header button');
      if (topAvatar) topAvatar.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Verify gear button next to Editar perfil is removed
    const profileButtonsCheck = await page.evaluate(() => {
      const editBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Editar perfil'));
      const parent = editBtn?.parentElement;
      const siblingButtons = parent ? Array.from(parent.querySelectorAll('button')) : [];
      return {
        hasEditBtn: !!editBtn,
        siblingButtonCount: siblingButtons.length, // Should be exactly 1 (no duplicate gear!)
      };
    });
    console.log('3. Profile Button Check (should be 1 button, no duplicate gear):', profileButtonsCheck);
    if (profileButtonsCheck.siblingButtonCount !== 1) {
      throw new Error(`Expected 1 button in profile actions, found ${profileButtonsCheck.siblingButtonCount}`);
    }

    // Click "Editar perfil"
    await page.evaluate(() => {
      const editBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Editar perfil'));
      if (editBtn) editBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    // Verify modal has Banner and Avatar upload sections with GIF support
    const editModalCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      const hasBannerSection = text.includes('PORTADA / BANNER') || text.includes('Banner');
      const hasAvatarSection = text.includes('FOTO DE PERFIL') || text.includes('Cambiar');
      const hasGifMention = text.includes('.gif') || text.includes('GIF');
      const fileInputs = document.querySelectorAll('input[type="file"][accept*="gif"]');
      return { hasBannerSection, hasAvatarSection, hasGifMention, gifFileInputsCount: fileInputs.length };
    });
    console.log('3. Edit Profile Modal Check:', editModalCheck);
    if (!editModalCheck.hasBannerSection || editModalCheck.gifFileInputsCount < 2) {
      throw new Error('Edit Profile Modal missing Banner or GIF file inputs');
    }

    await page.screenshot({ path: path.join(artifactDir, 'mobile_edit_profile_modal_verified.png') });

    // Close edit modal
    await page.evaluate(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Cancelar'));
      if (cancelBtn) cancelBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // 4. Test Bell (Campanita) icon
    console.log('4. Testing Bell (Campanita) icon in Mobile...');
    await page.evaluate(() => {
      const backBtn = document.querySelector('button[title="Volver"]');
      if (backBtn) backBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // Click bell icon
    await page.evaluate(() => {
      const bellBtn = document.querySelector('button[title*="Novedades"]');
      if (bellBtn) bellBtn.click();
    });
    await new Promise((r) => setTimeout(r, 800));

    const bellModalCheck = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasTitle: text.includes('Novedades y Mensajes'),
        hasNovedadesTab: text.includes('Novedades'),
        hasMensajesTab: text.includes('Enviar Mensaje'),
      };
    });
    console.log('4. Bell Modal Check:', bellModalCheck);
    if (!bellModalCheck.hasTitle) {
      throw new Error('Bell Modal did not open or missing title');
    }

    await page.screenshot({ path: path.join(artifactDir, 'mobile_bell_modal_verified.png') });

    // 5. Test Mini Player and Fullscreen Player (Spotify Connect icon, no green pulses, artist info)
    console.log('5. Testing Mini Player and Fullscreen Player...');
    await page.evaluate(() => {
      // Close bell modal if open
      const closeBtn = document.querySelector('button[title="Cerrar"]');
      if (closeBtn) closeBtn.click();

      // Trigger playing track in player store
      if (window.__usePlayerStore) {
        window.__usePlayerStore.setState({
          isPlaying: true,
          currentTrack: {
            id: 'trk-test-long',
            name: 'Canción Con Un Título Increíblemente Largo Para Probar El Marquee Deslizante Suave',
            duration_ms: 215000,
            artists: [{ id: 'art-1', name: 'Bad Bunny' }],
            album: {
              id: 'alb-1',
              name: 'Un Verano Sin Ti',
              images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819' }],
            },
          },
        });
      }
    });

    await new Promise((r) => setTimeout(r, 600));

    // Verify Mini Player
    const miniPlayerCheck = await page.evaluate(() => {
      const mini = document.querySelector('[data-testid="mobile-mini-player"]');
      if (!mini) return { found: false };
      const hasDeviceBtn = mini.querySelector('button[title="Escuchando en este teléfono"]');
      const marqueeSpan = mini.querySelector('.animate-spotify-marquee-smooth');
      const pingPulses = mini.querySelectorAll('.animate-ping');
      return {
        found: true,
        hasDeviceBtn: !!hasDeviceBtn,
        hasSmoothMarquee: !!marqueeSpan,
        pingPulsesCount: pingPulses.length,
      };
    });
    console.log('5. Mini Player Check:', miniPlayerCheck);
    if (!miniPlayerCheck.found || !miniPlayerCheck.hasDeviceBtn) {
      throw new Error('Mini player or Spotify Connect device button not found');
    }
    if (miniPlayerCheck.pingPulsesCount > 0) {
      throw new Error(`Mini player should not have green ping pulses, found ${miniPlayerCheck.pingPulsesCount}`);
    }

    // Click Mini Player to open Full Player
    await page.evaluate(() => {
      const mini = document.querySelector('[data-testid="mobile-mini-player"]');
      if (mini) mini.click();
    });

    await new Promise((r) => setTimeout(r, 800));

    const fullPlayerCheck = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0.z-\\[100\\]');
      if (!modal) return { found: false };
      const text = modal.innerText;
      const hasArtistCard = text.includes('Información sobre el artista');
      const hasLyricsCard = text.includes('Letras');
      const hasDeviceBar = text.includes('ESTE TELÉFONO') || text.includes('Este teléfono');
      const pingPulses = modal.querySelectorAll('.animate-ping');
      const minimizeBtn = modal.querySelector('button[title="Minimizar"]');
      const minimizeSvg = minimizeBtn?.querySelector('svg');
      const minimizeSvgWidth = minimizeSvg?.getAttribute('width');
      const hasShareBtn = Array.from(modal.querySelectorAll('button')).some(b => b.textContent && b.textContent.includes('Compartir'));
      return {
        found: true,
        hasArtistCard,
        hasLyricsCard,
        hasDeviceBar,
        pingPulsesCount: pingPulses.length,
        minimizeSvgWidth,
        hasShareBtn,
      };
    });
    console.log('5. Full Player Modal Check:', fullPlayerCheck);
    if (!fullPlayerCheck.found || !fullPlayerCheck.hasArtistCard || !fullPlayerCheck.hasLyricsCard) {
      throw new Error('Full player modal or cards missing');
    }
    if (fullPlayerCheck.minimizeSvgWidth !== '28') {
      throw new Error(`Expected minimize chevron width 28, got ${fullPlayerCheck.minimizeSvgWidth}`);
    }
    if (!fullPlayerCheck.hasShareBtn) {
      throw new Error('Full player missing lyrics Compartir button');
    }

    await page.screenshot({ path: path.join(artifactDir, 'mobile_now_playing_verified.png') });

    // Minimize player
    await page.evaluate(() => {
      const minimizeBtn = document.querySelector('button[title="Minimizar"]');
      if (minimizeBtn) minimizeBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    // 6. Test Buscar icon filling solid when active
    console.log('6. Testing Buscar icon filling solid when active...');
    await page.evaluate(() => {
      const searchTabBtn = Array.from(document.querySelectorAll('nav button')).find(b => b.textContent && b.textContent.includes('Buscar'));
      if (searchTabBtn) searchTabBtn.click();
    });
    await new Promise((r) => setTimeout(r, 600));

    const searchTabCheck = await page.evaluate(() => {
      const nav = document.querySelector('nav');
      const searchBtn = Array.from(nav?.querySelectorAll('button') || []).find(b => b.textContent && b.textContent.includes('Buscar'));
      const svgPath = searchBtn?.querySelector('svg path')?.getAttribute('d') || '';
      // Filled icon uses solid arc M10.533 2.5a8.033... without donut cutout
      const isFilled = svgPath.includes('M10.533 2.5a8.033') && !svgPath.includes('zm-7.407');
      return { isFilled, svgPathSnippet: svgPath.slice(0, 30) };
    });
    console.log('6. Search Filled Icon Check:', searchTabCheck);
    if (!searchTabCheck.isFilled) {
      throw new Error('Search button icon did not fill solid when active');
    }

    await page.screenshot({ path: path.join(artifactDir, 'mobile_search_filled_verified.png') });

    console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
