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

  let tokenBody = null;
  client.on('Network.responseReceived', async (e) => {
    if (e.response.url.includes('/api/token')) {
      try {
        const body = await client.send('Network.getResponseBody', { requestId: e.requestId });
        tokenBody = body.body;
      } catch (err) {}
    }
  });

  await spotifyPage.reload({ waitUntil: 'networkidle2' });

  console.log('Got /api/token body:', tokenBody);

  await client.detach();
  browser.disconnect();
}

main().catch(console.error);
