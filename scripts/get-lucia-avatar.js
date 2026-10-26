import puppeteer from 'puppeteer-core';

async function getLuciaAvatar() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const sp = pages.find(p => p.url().includes('open.spotify.com'));
  if (!sp) {
    browser.disconnect();
    return;
  }

  const avatars = await sp.evaluate(() => {
    const images = Array.from(document.querySelectorAll('header img, [data-testid="playlist-page"] header img, [data-testid="creator-link"] img, img[alt*="Lucía"], img[alt*="Jorgete"]')).map(img => ({
      src: img.src,
      alt: img.alt
    }));
    return images;
  });

  console.log('Lucía & creator avatars:', avatars);
  browser.disconnect();
}

getLuciaAvatar().catch(console.error);
