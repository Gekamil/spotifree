import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spPage) {
    const data = await spPage.evaluate(() => {
      const title = document.querySelector('h1')?.innerText;
      const subtitle = document.querySelector('[data-encore-id="text"]')?.innerText;
      const trackRows = Array.from(document.querySelectorAll('[data-testid="tracklist-row"]')).map(r => {
        const title = r.querySelector('[data-encore-id="textMediumBold"]')?.innerText;
        const artist = r.querySelector('[data-encore-id="textSmall"]')?.innerText;
        return { title, artist };
      });
      return { url: window.location.href, title, subtitle, trackCount: trackRows.length, sample: trackRows.slice(0, 5) };
    });
    console.log('Spotify page data:', JSON.stringify(data, null, 2));
  } else {
    console.log('No Spotify tab found');
  }
  browser.disconnect();
}

main().catch(console.error);
