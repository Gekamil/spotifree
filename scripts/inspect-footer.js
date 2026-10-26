import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));

  const footerHtml = await spotifyPage.evaluate(() => {
    const footer = document.querySelector('footer');
    return footer ? footer.innerHTML.slice(0, 2000) : 'none';
  });

  console.log('Footer innerHTML:', footerHtml);
  browser.disconnect();
}

main().catch(console.error);
