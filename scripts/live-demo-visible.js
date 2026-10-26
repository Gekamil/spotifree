import puppeteer from 'puppeteer-core';

async function runLiveVisible() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('spotify.com')) || pages[0];

  if (!page) {
    console.log('No page found');
    return;
  }

  await page.bringToFront();

  // Highlight elements with a green border and interact so user sees it in real time
  await page.evaluate(() => {
    // Add banner on top of the page indicating AI inspection
    const banner = document.createElement('div');
    banner.id = 'ai-inspection-banner';
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '50%';
    banner.style.transform = 'translateX(-50%)';
    banner.style.backgroundColor = '#1ed760';
    banner.style.color = '#000000';
    banner.style.padding = '8px 24px';
    banner.style.fontSize = '14px';
    banner.style.fontWeight = 'bold';
    banner.style.zIndex = '999999';
    banner.style.borderRadius = '0 0 12px 12px';
    banner.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
    banner.innerText = '🤖 Antigravity AI conectado en vivo a tu navegador';
    document.body.appendChild(banner);
  });

  // Smooth scroll down to show live action
  await page.evaluate(async () => {
    window.scrollBy({ top: 300, behavior: 'smooth' });
  });

  await new Promise((r) => setTimeout(r, 1200));

  await page.evaluate(async () => {
    window.scrollBy({ top: -300, behavior: 'smooth' });
  });

  browser.disconnect();
}

runLiveVisible().catch(console.error);
