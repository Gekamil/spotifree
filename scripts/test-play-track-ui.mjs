import puppeteer from 'puppeteer-core';

async function testPlayTrackInUI() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('5173'));

  console.log('Clicking on track 2 (DtMF) to play...');
  await page.evaluate(() => {
    const allDivs = Array.from(document.querySelectorAll('div, tr, span, p'));
    const dtmf = allDivs.find(d => d.innerText?.trim() === 'DtMF');
    if (dtmf) {
      console.log('Found DtMF track row, clicking...');
      (dtmf.closest('.group\\/track') || dtmf.closest('tr') || dtmf.closest('.cursor-pointer') || dtmf).click();
    }
  });

  console.log('Waiting 3.5 seconds for audio stream...');
  await new Promise(r => setTimeout(r, 3500));

  const playerState = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    const trackName = footer?.querySelector('.text-\\[13px\\]')?.innerText;
    const artistName = footer?.querySelector('.text-\\[11px\\]')?.innerText;
    const playPauseBtn = footer?.querySelector('button[title="Pausar"], button[title="Reproducir"]')?.getAttribute('title');
    const timeSpans = Array.from(footer?.querySelectorAll('.text-\\[11px\\]') || []).map(s => s.innerText);

    return {
      trackName,
      artistName,
      playPauseBtn,
      timeSpans,
    };
  });

  console.log('Bottom Player State:', playerState);

  await page.screenshot({ path: 'spotifree-playback-verified.png' });
  console.log('Screenshot saved to spotifree-playback-verified.png');

  browser.disconnect();
}

testPlayTrackInUI().catch(console.error);
