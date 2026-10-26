import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));

  // Go to /search in Spotify tab and check the home button SVG!
  await spotifyPage.goto('https://open.spotify.com/search');
  await new Promise(r => setTimeout(r, 1500));

  const homeBtnSvg = await spotifyPage.evaluate(() => {
    const homeBtn = document.querySelector('button[aria-label="Inicio"], [data-testid="home-button"]');
    return {
      svg: homeBtn?.querySelector('svg')?.outerHTML,
      path: homeBtn?.querySelector('svg path')?.getAttribute('d')
    };
  });

  console.log('Home button when on /search:', JSON.stringify(homeBtnSvg, null, 2));

  // Now go back to home
  await spotifyPage.goto('https://open.spotify.com/');
  browser.disconnect();
}

main().catch(console.error);
