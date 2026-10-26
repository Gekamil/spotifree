import puppeteer from 'puppeteer-core';

async function checkPlayer() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('5173'));

  const res = await page.evaluate(async () => {
    const m = await import('/src/store/usePlayerStore');
    const oldPlaying = m.usePlayerStore.getState().isPlaying;
    const track = m.usePlayerStore.getState().currentTrack;
    m.usePlayerStore.setState({ isPlaying: !oldPlaying });
    return {
      oldPlaying,
      newPlaying: m.usePlayerStore.getState().isPlaying,
      trackName: track?.name,
    };
  });
  console.log('Player toggle result:', res);

  await new Promise((r) => setTimeout(r, 400));
  const buttonTitle = await page.evaluate(() => {
    const btn = document.querySelector('button[title="Pausar"]') || document.querySelector('button[title="Reproducir"]');
    return btn ? btn.getAttribute('title') : 'NOT FOUND';
  });
  console.log('Player button title in DOM:', buttonTitle);

  browser.disconnect();
}

checkPlayer();
