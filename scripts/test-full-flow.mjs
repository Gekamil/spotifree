import puppeteer from 'puppeteer-core';

async function testFullFlow() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('5173'));

  console.log('1. Clicking on "míticas" from home shortcuts...');
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('span, p, div'));
    const miticas = cards.find(el => el.innerText?.trim() === 'míticas');
    if (miticas) {
      (miticas.closest('.cursor-pointer, [onClick]') || miticas).click();
    }
  });

  await new Promise(r => setTimeout(r, 2000));

  console.log('2. Clicking green Play button on the playlist...');
  await page.evaluate(() => {
    const playBtn = document.querySelector('button[title="Reproducir"]');
    if (playBtn) playBtn.click();
  });

  console.log('3. Monitoring player times continuously for 12 seconds...');
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const state = await page.evaluate(() => {
      const footer = document.querySelector('footer');
      const textSpans = Array.from(footer?.querySelectorAll('span') || []).map(s => s.innerText);
      const isPlaying = !!footer?.querySelector('button[title="Pausa"]');
      const isPaused = !!footer?.querySelector('button[title="Reproducir"]');
      return {
        track: footer?.querySelector('.text-\\[13px\\]')?.innerText,
        isPlaying,
        isPaused,
        textSpans: textSpans.filter(t => t.includes(':')),
      };
    });
    console.log(`Second ${i+1}:`, state);
  }

  await page.screenshot({ path: 'spotifree-continuous-playback.png' });
  console.log('Screenshot saved to spotifree-continuous-playback.png');

  browser.disconnect();
}

testFullFlow().catch(console.error);
