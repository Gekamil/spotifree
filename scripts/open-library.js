import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const res = await spotifyPage.evaluate(async () => {
      const btn = document.querySelector('button[aria-label="Abre Tu biblioteca"]');
      if (btn) {
        btn.click();
        await new Promise(r => setTimeout(r, 1000));
      }
      const links = Array.from(document.querySelectorAll('.YourLibraryX a, .YourLibraryX [role="button"], [aria-label="Tu biblioteca"] a')).map(el => ({
        text: el.textContent.trim().replace(/\s+/g, ' '),
        href: el.getAttribute('href'),
      })).filter(x => x.text.length > 0 && x.href);
      return { clicked: !!btn, count: links.length, sample: links };
    });
    console.log('Result after opening library:', res);
  }
  browser.disconnect();
}

main().catch(console.error);
