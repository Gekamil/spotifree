import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const info = await spotifyPage.evaluate(() => {
      // Find element containing 'Canciones que te gustan'
      const allSpans = Array.from(document.querySelectorAll('span'));
      const likedSpan = allSpans.find(s => s.textContent?.includes('Canciones que te gustan') && s.getBoundingClientRect().left < 300);
      if (!likedSpan) return 'not found';

      let curr = likedSpan;
      const chain = [];
      while (curr && curr !== document.body) {
        chain.push({
          tag: curr.tagName,
          role: curr.getAttribute('role'),
          class: curr.className,
          rect: { left: curr.getBoundingClientRect().left, top: curr.getBoundingClientRect().top }
        });
        curr = curr.parentElement;
      }
      return chain;
    });

    console.log(JSON.stringify(info, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
