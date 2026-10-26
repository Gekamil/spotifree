import puppeteer from 'puppeteer-core';

async function inspectSpotifyFilter() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) {
    console.log('No Spotify tab found');
    return;
  }

  // Inspect filter pills at the top of Spotify Home
  const pills = await spotifyPage.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button[role="checkbox"], div[role="tablist"] button, header button'));
    return buttons.map(b => ({
      text: b.textContent?.trim(),
      ariaChecked: b.getAttribute('aria-checked'),
      role: b.getAttribute('role'),
      className: b.className
    })).filter(b => b.text && (b.text.includes('Todo') || b.text.includes('Música') || b.text.includes('Pódcast')));
  });
  console.log('Spotify filter pills:', pills);

  // Click on "Música" pill in real Spotify and see what appears!
  console.log('Clicking Música pill in real Spotify...');
  await spotifyPage.evaluate(() => {
    const musicBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Música');
    if (musicBtn) musicBtn.click();
  });

  await new Promise(r => setTimeout(r, 1500));

  const afterPills = await spotifyPage.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.map(b => ({
      text: b.textContent?.trim(),
      className: b.className,
      ariaLabel: b.getAttribute('aria-label')
    })).filter(b => b.text && ['Todo', 'Música', 'Siguiendo', 'Pódcasts', 'Audiolibros'].some(k => b.text.includes(k)));
  });
  console.log('After clicking Música in Spotify:', afterPills);
}

inspectSpotifyFilter().catch(console.error);
