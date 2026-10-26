import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const appPage = pages[0];

  const track = {
    id: 'track-romeo-better-late',
    name: 'Better Late Than Never',
    duration_ms: 248000,
    artists: [{ id: 'a1', name: 'Romeo Santos' }, { id: 'a2', name: 'Prince Royce' }],
    album: {
      id: 'alb1',
      name: 'Romeo & Prince',
      images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31', width: 640, height: 640 }]
    }
  };

  await appPage.evaluate((t) => {
    window.__usePlayerStore.getState().playTrack(t);
  }, track);

  await new Promise(r => setTimeout(r, 600));

  const bottomBar = await appPage.evaluate(() => {
    const title = document.querySelector('footer span.text-white')?.innerText;
    const scrubber = !!document.querySelector('footer div[class*="group relative flex-1 h-3"]');
    return { title, scrubber };
  });
  console.log('Bottom Bar after playTrack:', bottomBar);

  await appPage.screenshot({ path: 'scripts/live-test-playing.png' });
  browser.disconnect();
}

main().catch(console.error);
