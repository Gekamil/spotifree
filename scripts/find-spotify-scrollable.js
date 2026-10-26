import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const info = await spotifyPage.evaluate(() => {
      const allDivs = Array.from(document.querySelectorAll('*'));
      const scrollables = allDivs.filter(d => {
        const style = window.getComputedStyle(d);
        return (style.overflowY === 'auto' || style.overflowY === 'scroll') && d.scrollHeight > d.clientHeight;
      });
      return scrollables.map(s => ({
        tag: s.tagName,
        className: s.className,
        id: s.id,
        scrollHeight: s.scrollHeight,
        clientHeight: s.clientHeight
      }));
    });
    console.log(JSON.stringify(info, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
