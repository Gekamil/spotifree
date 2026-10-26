import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  let appPage = pages.find(p => p.url().includes('127.0.0.1:5173'));
  if (!appPage) appPage = await browser.newPage();

  await appPage.goto('http://127.0.0.1:5173/');
  await new Promise(r => setTimeout(r, 2000));

  const state = await appPage.evaluate(() => {
    const store = window.__useSpotifyDataStore ? window.__useSpotifyDataStore.getState() : null;
    const aside = document.querySelector('aside');
    return {
      isAuthenticated: store ? store.isAuthenticated : false,
      userName: store?.user ? store.user.display_name : null,
      playlistsCount: store?.playlists ? store.playlists.length : 0,
      playlists: store?.playlists ? store.playlists.map(p => p.name) : [],
      asideText: aside ? aside.innerText.split('\n').filter(Boolean) : null
    };
  });

  console.log('Browser State:\n', JSON.stringify(state, null, 2));
  browser.disconnect();
}

main().catch(console.error);
