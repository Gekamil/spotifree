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

  const tokenRequests = [];
  client.on('Network.responseReceived', async (e) => {
    const url = e.response.url;
    if (url.includes('token') || url.includes('session') || url.includes('login') || url.includes('auth')) {
      tokenRequests.push({ url, status: e.response.status });
    }
  });

  console.log('Reloading spotify tab to see token generation...');
  await spotifyPage.reload({ waitUntil: 'networkidle2' });

  console.log('Token/Auth responses:');
  for (const r of tokenRequests) {
    console.log(r.status, r.url);
  }

  await client.detach();
  browser.disconnect();
}

main().catch(console.error);
