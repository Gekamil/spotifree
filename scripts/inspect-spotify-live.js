import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));
  const spotifreePage = pages.find(p => p.url().includes('5173'));

  if (!spotifyPage) {
    console.log('No Spotify tab found');
    return;
  }

  const info = await spotifyPage.evaluate(() => {
    const userEl = document.querySelector('[data-testid="user-widget-link"]') ||
                   document.querySelector('button[aria-label="Perfil"]') ||
                   document.querySelector('[data-testid="username"]');
    const titleEl = document.querySelector('[data-testid="context-item-info-title"]') ||
                    document.querySelector('[data-testid="nowplaying-track-link"]');
    const artistEl = document.querySelector('[data-testid="context-item-info-subtitles"]') ||
                     document.querySelector('[data-testid="track-info-artists"]');
    const homeBtn = document.querySelector('a[href="/"], button[aria-label="Inicio"]');
    const searchBtn = document.querySelector('a[href="/search"], button[aria-label="Buscar"]');
    const libraryCollapse = document.querySelector('button[aria-label*="biblioteca"], button[aria-label*="Reducir"], button[aria-label*="contraer"]');

    return {
      url: window.location.href,
      title: document.title,
      user: userEl ? userEl.innerText : null,
      track: titleEl ? titleEl.innerText : null,
      artist: artistEl ? artistEl.innerText : null,
      homeHtml: homeBtn ? homeBtn.outerHTML.slice(0, 300) : null,
      searchHtml: searchBtn ? searchBtn.outerHTML.slice(0, 300) : null,
      libraryCollapseHtml: libraryCollapse ? libraryCollapse.outerHTML.slice(0, 300) : null,
    };
  });

  console.log('Real Spotify Tab info:', JSON.stringify(info, null, 2));

  if (spotifreePage) {
    const spotifreeInfo = await spotifreePage.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
      };
    });
    console.log('Spotifree Tab info:', JSON.stringify(spotifreeInfo, null, 2));
  }

  browser.disconnect();
}

main().catch(console.error);
