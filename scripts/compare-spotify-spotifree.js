import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  
  const spotifreePage = pages.find(p => p.url().includes('5173'));
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));

  const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

  if (spotifyPage) {
    await spotifyPage.bringToFront();
    await spotifyPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 1000));
    await spotifyPage.screenshot({ path: path.join(artifactDir, 'spotify-live-1440.png') });
    console.log('Saved spotify-live-1440.png');
  }

  if (spotifreePage) {
    await spotifreePage.bringToFront();
    await spotifreePage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 1000));
    await spotifreePage.screenshot({ path: path.join(artifactDir, 'spotifree-live-1440.png') });
    console.log('Saved spotifree-live-1440.png');
  }

  // Extract structural comparison from Spotify
  if (spotifyPage) {
    const analysis = await spotifyPage.evaluate(() => {
      function getComputed(selector) {
        const el = document.querySelector(selector);
        if (!el) return null;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          selector,
          width: rect.width,
          height: rect.height,
          background: style.backgroundColor,
          color: style.color,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          fontFamily: style.fontFamily,
          borderRadius: style.borderRadius,
          padding: style.padding,
          margin: style.margin,
          display: style.display,
          boxShadow: style.boxShadow,
        };
      }

      // Collect key elements
      return {
        topNav: {
          container: getComputed('header, [data-testid="topbar"]'),
          searchBox: getComputed('[data-testid="search-input"], form[role="search"]'),
          homeButton: getComputed('button[aria-label="Inicio"], [data-testid="home-button"]'),
        },
        sidebar: {
          container: getComputed('nav[aria-label="Tu biblioteca"], [data-testid="your-library"]'),
          header: getComputed('header[aria-label="Tu biblioteca"], [data-testid="your-library-header"]'),
          firstItem: getComputed('[data-testid="your-library"] [role="listitem"], [data-testid="rootlist-item"]'),
        },
        mainView: {
          container: getComputed('main'),
          filterPills: Array.from(document.querySelectorAll('button[role="checkbox"], [data-testid="chip-inner-element"]')).slice(0, 4).map(el => ({
            text: el.textContent?.trim(),
            bg: window.getComputedStyle(el).backgroundColor,
            color: window.getComputedStyle(el).color,
            fontSize: window.getComputedStyle(el).fontSize,
            height: el.getBoundingClientRect().height,
          })),
          shelfHeader: getComputed('section h2, [data-testid="shelf-header"]'),
          card: getComputed('[data-testid="card-click-handler"], [data-testid="shelf-item"]'),
        },
        player: {
          container: getComputed('footer, [data-testid="now-playing-bar"]'),
          trackTitle: getComputed('[data-testid="context-item-info-title"]'),
          trackArtist: getComputed('[data-testid="context-item-info-subtitles"]'),
          playButton: getComputed('button[data-testid="control-button-playpause"]'),
          progressBar: getComputed('[data-testid="playback-progressbar"]'),
        }
      };
    });

    fs.writeFileSync(path.join(artifactDir, 'spotify-extracted-styles.json'), JSON.stringify(analysis, null, 2));
    console.log('Saved spotify-extracted-styles.json');
  }

  browser.disconnect();
}

run().catch(console.error);
