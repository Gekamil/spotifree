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

  const pathfinderBodies = [];
  client.on('Network.requestWillBeSent', (e) => {
    if (e.request.url.includes('pathfinder/v2/query') && e.request.postData) {
      pathfinderBodies.push(e.request.postData);
    }
  });

  await spotifyPage.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  for (const b of pathfinderBodies.slice(0, 5)) {
    console.log(b.substring(0, 150));
  }

  await client.detach();
  browser.disconnect();
}

main().catch(console.error);
