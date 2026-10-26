import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const bgInfo = await spotifyPage.evaluate(() => {
      // Find elements with gradient
      const elementsWithGradient = Array.from(document.querySelectorAll('*')).filter(el => {
        const bg = window.getComputedStyle(el).backgroundImage;
        return bg && bg.includes('gradient');
      });

      return elementsWithGradient.map(el => ({
        tag: el.tagName,
        className: el.className,
        backgroundImage: window.getComputedStyle(el).backgroundImage,
        backgroundColor: window.getComputedStyle(el).backgroundColor,
        rect: {
          w: el.getBoundingClientRect().width,
          h: el.getBoundingClientRect().height,
          top: el.getBoundingClientRect().top,
        }
      }));
    });

    console.log(JSON.stringify(bgInfo, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
