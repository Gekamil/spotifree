import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('spotify.com'));
  
  const info = await page.evaluate(() => {
    // Look for top navigation elements
    const homeBtn = document.querySelector('button[aria-label="Inicio"]') || 
                    document.querySelector('a[aria-label="Inicio"]') ||
                    document.querySelector('a[href="/"]');
    
    const searchInput = document.querySelector('input[data-testid="search-input"]') || 
                        document.querySelector('input[placeholder*="reproducir"]') ||
                        document.querySelector('input');
    
    const topBarContainer = (homeBtn || searchInput)?.closest('nav, header, div[class*="top"], div[class*="Root"]');
    
    // Look for now playing bar
    const playPauseBtn = document.querySelector('button[data-testid="control-button-playpause"]') ||
                         document.querySelector('button[aria-label*="Reproducir"], button[aria-label*="Pausar"]');
    
    const nowPlayingContainer = playPauseBtn?.closest('footer, div[data-testid="now-playing-bar"], div[class*="now-playing"]');

    // Main layout grid
    const mainGrid = document.querySelector('#main') || document.querySelector('.Root') || document.body.firstElementChild;

    return {
      homeBtn: homeBtn ? {
        tag: homeBtn.tagName,
        ariaLabel: homeBtn.getAttribute('aria-label'),
        class: homeBtn.className,
        rect: homeBtn.getBoundingClientRect(),
        parentTag: homeBtn.parentElement?.tagName,
        parentClass: homeBtn.parentElement?.className
      } : null,
      searchInput: searchInput ? {
        placeholder: searchInput.placeholder,
        rect: searchInput.getBoundingClientRect(),
        parentHTML: searchInput.parentElement?.outerHTML.slice(0, 300)
      } : null,
      playPauseBtn: playPauseBtn ? {
        ariaLabel: playPauseBtn.getAttribute('aria-label'),
        rect: playPauseBtn.getBoundingClientRect(),
        containerHTML: nowPlayingContainer ? nowPlayingContainer.outerHTML.slice(0, 500) : null
      } : null,
      gridChildren: Array.from(document.body.children).map(c => ({
        tag: c.tagName,
        id: c.id,
        class: c.className.slice(0, 50),
        rect: c.getBoundingClientRect()
      }))
    };
  });

  console.log('DOM CONTAINERS INFO:');
  console.log(JSON.stringify(info, null, 2));

  browser.disconnect();
}

run().catch(console.error);
