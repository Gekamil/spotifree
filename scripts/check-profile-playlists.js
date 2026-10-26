import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    await spotifyPage.goto('https://open.spotify.com/user/e6yr34zzwnf1yybcw49po6nrw');
    await new Promise(r => setTimeout(r, 3000));
    const profile = await spotifyPage.evaluate(() => {
      const name = document.querySelector('h1')?.textContent?.trim();
      const playlists = Array.from(document.querySelectorAll('a[href*="/playlist/"]')).map(a => ({
        name: a.textContent.trim(),
        href: a.href,
        img: a.querySelector('img')?.src
      })).filter(p => p.name.length > 0);
      return { name, playlists };
    });
    console.log('User profile scan:', profile);
  }
  browser.disconnect();
}

main().catch(console.error);
