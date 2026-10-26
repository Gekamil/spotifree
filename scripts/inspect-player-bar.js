import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));

  const buttons = await spotifyPage.evaluate(() => {
    const footer = document.querySelector('footer');
    if (!footer) return 'No footer found';
    
    // Look for right container
    const rightSide = footer.querySelector('[data-testid="now-playing-bar-right-controls"], .now-playing-bar__right') ||
                     footer.children[footer.children.length - 1];

    const btns = Array.from(rightSide.querySelectorAll('button')).map(b => ({
      label: b.getAttribute('aria-label') || b.getAttribute('data-testid') || b.innerText,
      svg: b.querySelector('svg')?.outerHTML,
      classes: b.className
    }));

    return {
      rightSideHtml: rightSide.outerHTML.slice(0, 1200),
      buttons: btns
    };
  });

  console.log('Player right controls:', JSON.stringify(buttons, null, 2));
  browser.disconnect();
}

main().catch(console.error);
