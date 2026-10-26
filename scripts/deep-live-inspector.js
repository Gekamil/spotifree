import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('Connecting to Chrome on port 9222...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find((p) => p.url().includes('spotify.com'));

  if (!spotifyPage) {
    console.error('Spotify page not found in open tabs!');
    process.exit(1);
  }

  await spotifyPage.bringToFront();
  console.log('Brought Spotify page to front:', spotifyPage.url());

  // Function to show/update floating banner in user's browser
  const updateBanner = async (message, status = 'active') => {
    console.log(`[BANNER] ${message}`);
    await spotifyPage.evaluate((msg, st) => {
      let banner = document.getElementById('antigravity-indicator');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'antigravity-indicator';
        banner.style.position = 'fixed';
        banner.style.bottom = '24px';
        banner.style.right = '24px';
        banner.style.padding = '12px 24px';
        banner.style.borderRadius = '30px';
        banner.style.fontWeight = '700';
        banner.style.fontSize = '14px';
        banner.style.fontFamily = 'SpotifyMixUI, CircularSp, system-ui, sans-serif';
        banner.style.zIndex = '99999999';
        banner.style.display = 'flex';
        banner.style.alignItems = 'center';
        banner.style.gap = '10px';
        banner.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8), 0 0 15px rgba(30,215,96,0.5)';
        banner.style.border = '2px solid #1ed760';
        banner.style.backgroundColor = '#121212';
        banner.style.color = '#ffffff';
        banner.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        document.body.appendChild(banner);
      }
      
      const dotColor = st === 'active' ? '#1ed760' : st === 'warn' ? '#f59e0b' : '#3b82f6';
      banner.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:${dotColor};box-shadow:0 0 8px ${dotColor};animation:pulse 1.5s infinite"></span> <span>${msg}</span>`;
    }, message, status);
  };

  // Pulse animation injection
  await spotifyPage.evaluate(() => {
    if (!document.getElementById('antigravity-styles')) {
      const style = document.createElement('style');
      style.id = 'antigravity-styles';
      style.innerHTML = `
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .antigravity-highlight {
          outline: 2px solid #1ed760 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 12px #1ed760 !important;
          transition: all 0.3s ease !important;
        }
      `;
      document.head.appendChild(style);
    }
  });

  // Step 1: Banner notify
  await updateBanner('🚀 [Antigravity IA] Conectado. Iniciando escaneo e interacción en vivo...', 'active');
  await sleep(1500);

  // Step 2: Highlight & inspect Top Navigation
  await updateBanner('🔍 [Antigravity IA] Analizando Header: Logo, Inicio, Buscador, Botones...', 'active');
  await spotifyPage.evaluate(() => {
    const header = document.querySelector('header') || document.querySelector('[data-testid="top-bar"]') || document.querySelector('nav');
    if (header) {
      header.classList.add('antigravity-highlight');
      header.scrollIntoView({ behavior: 'smooth' });
    }
  });
  await sleep(1200);

  // Extract detailed Top Nav info
  const topNavData = await spotifyPage.evaluate(() => {
    const header = document.querySelector('header') || document.querySelector('[role="banner"]') || document.body.firstElementChild;
    const buttons = Array.from(header ? header.querySelectorAll('button, a, input') : []).map(b => {
      const s = window.getComputedStyle(b);
      const svg = b.querySelector('svg');
      return {
        tag: b.tagName,
        ariaLabel: b.getAttribute('aria-label') || b.getAttribute('title') || b.innerText.trim(),
        text: b.innerText.trim().replace(/\n+/g, ' '),
        width: s.width,
        height: s.height,
        padding: s.padding,
        margin: s.margin,
        borderRadius: s.borderRadius,
        backgroundColor: s.backgroundColor,
        color: s.color,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        gap: s.gap,
        svg: svg ? {
          viewBox: svg.getAttribute('viewBox'),
          width: svg.getAttribute('width') || svg.clientWidth,
          height: svg.getAttribute('height') || svg.clientHeight,
          fill: svg.getAttribute('fill') || window.getComputedStyle(svg).fill,
          paths: Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d'))
        } : null
      };
    });

    const headerStyles = header ? window.getComputedStyle(header) : null;
    return {
      buttons,
      headerStyle: headerStyles ? {
        height: headerStyles.height,
        padding: headerStyles.padding,
        backgroundColor: headerStyles.backgroundColor,
        display: headerStyles.display,
        justifyContent: headerStyles.justifyContent,
        alignItems: headerStyles.alignItems
      } : null
    };
  });

  // Unhighlight header
  await spotifyPage.evaluate(() => {
    document.querySelectorAll('.antigravity-highlight').forEach(el => el.classList.remove('antigravity-highlight'));
  });

  // Step 3: Highlight & inspect Player (Bottom bar)
  await updateBanner('🎵 [Antigravity IA] Analizando Reproductor: Portada, Título, Botón (+), Play, Sliders...', 'active');
  await spotifyPage.evaluate(() => {
    const player = document.querySelector('footer') || document.querySelector('[data-testid="now-playing-bar"]');
    if (player) player.classList.add('antigravity-highlight');
  });
  await sleep(1500);

  const playerData = await spotifyPage.evaluate(() => {
    const footer = document.querySelector('footer') || document.querySelector('[data-testid="now-playing-bar"]');
    if (!footer) return null;
    const s = window.getComputedStyle(footer);
    
    // Find all controls
    const controls = Array.from(footer.querySelectorAll('button')).map(b => {
      const bs = window.getComputedStyle(b);
      const svg = b.querySelector('svg');
      return {
        ariaLabel: b.getAttribute('aria-label') || b.getAttribute('title') || b.getAttribute('data-testid') || '',
        testId: b.getAttribute('data-testid') || '',
        width: bs.width,
        height: bs.height,
        padding: bs.padding,
        borderRadius: bs.borderRadius,
        backgroundColor: bs.backgroundColor,
        color: bs.color,
        svg: svg ? {
          viewBox: svg.getAttribute('viewBox'),
          width: svg.getAttribute('width') || svg.clientWidth,
          height: svg.getAttribute('height') || svg.clientHeight,
          paths: Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d'))
        } : null
      };
    });

    // Album art & track info
    const img = footer.querySelector('img');
    const trackTitleEl = footer.querySelector('[data-testid="context-item-info-title"]') || footer.querySelector('a[href*="/track/"]') || footer.querySelector('a[href*="/album/"]');
    const artistEl = footer.querySelector('[data-testid="context-item-info-subtitles"]') || footer.querySelector('a[href*="/artist/"]');

    return {
      footerStyle: {
        height: s.height,
        padding: s.padding,
        backgroundColor: s.backgroundColor,
        borderTop: s.borderTop
      },
      img: img ? {
        src: img.src,
        width: img.width,
        height: img.height,
        borderRadius: window.getComputedStyle(img).borderRadius
      } : null,
      trackTitle: trackTitleEl ? trackTitleEl.textContent.trim() : null,
      artist: artistEl ? artistEl.textContent.trim() : null,
      controls
    };
  });

  // Unhighlight player
  await spotifyPage.evaluate(() => {
    document.querySelectorAll('.antigravity-highlight').forEach(el => el.classList.remove('antigravity-highlight'));
  });

  // Step 4: Highlight & inspect Left Sidebar
  await updateBanner('📚 [Antigravity IA] Analizando Tu Biblioteca: Cabecera, Filtros, Lista de Playlists...', 'active');
  await spotifyPage.evaluate(() => {
    const nav = document.querySelector('[aria-label="Tu biblioteca"]') || document.querySelector('nav');
    if (nav) nav.classList.add('antigravity-highlight');
  });
  await sleep(1500);

  const sidebarData = await spotifyPage.evaluate(() => {
    const nav = document.querySelector('[aria-label="Tu biblioteca"]') || document.querySelector('nav');
    if (!nav) return null;
    const buttons = Array.from(nav.querySelectorAll('button, a')).map(b => {
      const bs = window.getComputedStyle(b);
      const svg = b.querySelector('svg');
      return {
        text: b.innerText.trim(),
        ariaLabel: b.getAttribute('aria-label') || '',
        testId: b.getAttribute('data-testid') || '',
        width: bs.width,
        height: bs.height,
        fontSize: bs.fontSize,
        fontWeight: bs.fontWeight,
        borderRadius: bs.borderRadius,
        svg: svg ? {
          viewBox: svg.getAttribute('viewBox'),
          width: svg.getAttribute('width') || svg.clientWidth,
          height: svg.getAttribute('height') || svg.clientHeight,
          paths: Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d'))
        } : null
      };
    });

    return {
      buttons: buttons.slice(0, 20)
    };
  });

  // Unhighlight sidebar
  await spotifyPage.evaluate(() => {
    document.querySelectorAll('.antigravity-highlight').forEach(el => el.classList.remove('antigravity-highlight'));
  });

  // Step 5: Test Real User Interactions (Click Profile Menu, Click Create Menu)
  await updateBanner('🖱️ [Antigravity IA] Interactuando con botón de Perfil y desplegables...', 'active');
  
  // Find Profile button
  const profileClicked = await spotifyPage.evaluate(() => {
    const profileBtn = document.querySelector('button[data-testid="user-widget-link"]') ||
                       document.querySelector('button[aria-label*="perfil" i]') ||
                       document.querySelector('header button img')?.closest('button') ||
                       Array.from(document.querySelectorAll('header button')).find(b => b.querySelector('figure, img, span'));
    if (profileBtn) {
      profileBtn.click();
      return true;
    }
    return false;
  });

  if (profileClicked) {
    await sleep(1200);
    // Extract opened menu items
    const profileMenuItems = await spotifyPage.evaluate(() => {
      const menu = document.querySelector('[data-testid="context-menu"]') || document.querySelector('[role="menu"]');
      if (!menu) return null;
      return Array.from(menu.querySelectorAll('button, a, [role="menuitem"]')).map(item => ({
        text: item.innerText.trim(),
        role: item.getAttribute('role'),
        href: item.getAttribute('href')
      }));
    });
    console.log('Profile Menu Items:', profileMenuItems);

    // Close profile menu by clicking outside or pressing Escape
    await spotifyPage.keyboard.press('Escape');
    await sleep(600);
  }

  // Step 6: Test Hover on Quick Access Cards & Play Button apparition
  await updateBanner('✨ [Antigravity IA] Probando hover en tarjetas de acceso rápido (aparición de botón verde)...', 'active');
  const cardHovered = await spotifyPage.evaluate(() => {
    const card = document.querySelector('[data-testid="card-click-handler"], a[href^="/playlist/"], a[href^="/collection/tracks"]')?.closest('div');
    if (card) {
      card.classList.add('antigravity-highlight');
      card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      return true;
    }
    return false;
  });
  await sleep(1500);

  await spotifyPage.evaluate(() => {
    document.querySelectorAll('.antigravity-highlight').forEach(el => el.classList.remove('antigravity-highlight'));
  });

  // Step 7: Save all deep inspection data
  const fullExtractedData = {
    topNav: topNavData,
    player: playerData,
    sidebar: sidebarData,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    path.resolve(__dirname, '../deep-spotify-data.json'),
    JSON.stringify(fullExtractedData, null, 2)
  );

  // Step 8: Update banner to finish
  await updateBanner('✅ [Antigravity IA] Datos extraídos al 100%. Aplicando a Spotifree...', 'active');
  await sleep(3000);

  // Leave a persistent indicator so user knows Antigravity is active
  await spotifyPage.evaluate(() => {
    const banner = document.getElementById('antigravity-indicator');
    if (banner) {
      banner.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background-color:#1ed760;box-shadow:0 0 6px #1ed760;"></span> <span>🟢 Antigravity IA sincronizado con Spotify Web</span>`;
      banner.style.opacity = '0.9';
    }
  });

  browser.disconnect();
  console.log('Deep inspection and live interaction completed successfully!');
}

run().catch((err) => {
  console.error('Error running deep inspector:', err);
});
