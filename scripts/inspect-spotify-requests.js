import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) {
    browser.disconnect();
    return;
  }

  const client = await spotifyPage.target().createCDPSession();
  await client.send('Network.enable');

  const requests = [];
  client.on('Network.requestWillBeSent', (e) => {
    if (e.request.url.includes('pathfinder') || e.request.url.includes('spclient')) {
      requests.push({
        url: e.request.url,
        method: e.request.method,
        postData: e.request.postData ? e.request.postData.substring(0, 100) : null
      });
    }
  });

  // Navigate to a playlist in the Spotify Web tab
  await spotifyPage.goto('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
  await new Promise(r => setTimeout(r, 4000));

  console.log('Intercepted pathfinder / spclient requests:');
  for (const r of requests.slice(0, 10)) {
    console.log(r.method, r.url.substring(0, 100), r.postData || '');
  }

  await client.detach();
  browser.disconnect();
}

main().catch(console.error);
