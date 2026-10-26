import puppeteer from 'puppeteer-core';

async function testUIPlaybackContinuity() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('5173'));

  console.log('1. Clicking track "BbY WOW" in Spotifree UI...');
  await page.evaluate(() => {
    const tracks = Array.from(document.querySelectorAll('div, span, tr'));
    const track = tracks.find(el => el.innerText?.trim() === 'BbY WOW');
    if (track) {
      (track.closest('.group\\/track') || track.closest('.cursor-pointer') || track).click();
    }
  });

  console.log('2. Monitoring UI scrubber and time display for 10 seconds...');
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const uiState = await page.evaluate(() => {
      const footer = document.querySelector('footer');
      const timeSpans = Array.from(footer?.querySelectorAll('.tabular-nums span, .text-\\[11px\\]') || []).map(s => s.innerText);
      const isPaused = footer?.querySelector('button[title="Reproducir"]');
      const isPlaying = footer?.querySelector('button[title="Pausa"]');
      return {
        track: footer?.querySelector('.text-\\[13px\\]')?.innerText,
        times: timeSpans,
        state: isPlaying ? 'PLAYING' : isPaused ? 'PAUSED' : 'UNKNOWN',
      };
    });
    console.log(`UI Second ${i+1}:`, uiState);
  }

  browser.disconnect();
}

testUIPlaybackContinuity().catch(console.error);
