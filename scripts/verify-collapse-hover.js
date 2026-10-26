import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifreePage = pages.find(p => p.url().includes('5173'));

  if (!spotifreePage) return;
  await spotifreePage.bringToFront();

  // Hover over the sidebar header
  await spotifreePage.hover('button[title="Contraer Tu biblioteca"]');
  await new Promise(r => setTimeout(r, 400));

  const artifactDir = 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313';
  await spotifreePage.screenshot({
    path: `${artifactDir}/spotifree-collapse-hovered.png`,
  });

  console.log('Hover screenshot captured');
  browser.disconnect();
}

main().catch(console.error);
