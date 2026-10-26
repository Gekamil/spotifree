import puppeteer from 'puppeteer-core';

async function checkLivePlayerInUI() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('5173'));

  console.log('Inspecting Spotifree UI player after 4 seconds...');
  await new Promise(r => setTimeout(r, 4000));

  const state = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    const timeSpans = Array.from(footer?.querySelectorAll('.tabular-nums span, .text-\\[11px\\]') || []).map(s => s.innerText);
    const trackTitle = footer?.querySelector('.text-\\[13px\\]')?.innerText;
    const artist = footer?.querySelector('.text-\\[11px\\]')?.innerText;
    const playBtn = footer?.querySelector('button[title="Pausa"], button[title="Pausar"], button[title="Reproducir"]')?.getAttribute('title');

    return {
      trackTitle,
      artist,
      playBtn,
      timeSpans: timeSpans.slice(0, 5),
    };
  });

  console.log('UI Player State:', state);

  // Take a verified screenshot of the full Spotifree interface
  await page.screenshot({ path: 'spotifree-playing-live-verified.png' });
  console.log('Screenshot saved to spotifree-playing-live-verified.png');

  browser.disconnect();
}

checkLivePlayerInUI().catch(console.error);
