import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifreePage = pages.find(p => p.url().includes('5173'));

  if (!spotifreePage) {
    console.log('No Spotifree page found');
    return;
  }

  // Reload page to pick up latest edits
  await spotifreePage.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  const artifactDir = 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313';
  await spotifreePage.screenshot({
    path: `${artifactDir}/spotifree-live-reconnected.png`,
    fullPage: false
  });

  console.log('Screenshot saved to spotifree-live-reconnected.png');
  browser.disconnect();
}

main().catch(console.error);
