import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) {
    console.log('No spotify page found');
    browser.disconnect();
    return;
  }

  const client = await spotifyPage.target().createCDPSession();
  await client.send('Network.enable');

  const authHeaders = [];
  client.on('Network.requestWillBeSent', (e) => {
    const url = e.request.url;
    const auth = e.request.headers['Authorization'] || e.request.headers['authorization'];
    if (auth && (url.includes('spotify.com') || url.includes('pathfinder'))) {
      authHeaders.push({ url, auth });
    }
  });

  console.log('Capturing headers...');
  await spotifyPage.evaluate(() => {
    const link = document.querySelector('a[href*="/playlist/"]');
    if (link) link.click();
  });

  await new Promise(r => setTimeout(r, 4000));
  console.log('Captured Auth count:', authHeaders.length);
  if (authHeaders.length > 0) {
    console.log('Sample URL:', authHeaders[0].url);
    console.log('Sample Token prefix:', authHeaders[0].auth.substring(0, 40));
    console.log('Sample Token full:', authHeaders[0].auth);
  }

  await client.detach();
  browser.disconnect();
}

main().catch(console.error);
