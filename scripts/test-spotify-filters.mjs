import puppeteer from 'puppeteer-core';

async function testClickFilters() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const spPage = (await browser.pages()).find(p => p.url().includes('open.spotify.com'));
  if (!spPage) return;

  const res = await spPage.evaluate(async () => {
    const chips = Array.from(document.querySelectorAll('button')).filter(b => ['Todo', 'Música', 'Pódcasts', 'Audiolibros'].includes(b.innerText.trim()));
    const p1 = chips.find(b => b.innerText.trim() === 'Pódcasts');
    if (p1) {
      p1.click();
      await new Promise(r => setTimeout(r, 800));
      const h2s = Array.from(document.querySelectorAll('section[data-testid="component-shelf"] h2')).map(h => h.innerText);
      return { clickedPodcasts: true, h2s };
    }
    return { clickedPodcasts: false };
  });
  console.log('Podcasts feed:', res);

  // Return back to Todo
  await spPage.evaluate(async () => {
    const chips = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === 'Todo');
    if (chips[0]) chips[0].click();
  });
  browser.disconnect();
}
testClickFilters().catch(console.error);
