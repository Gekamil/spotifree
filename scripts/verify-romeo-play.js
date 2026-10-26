import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // Click Romeo & Prince in sidebar
  await page.evaluate(() => {
    const listItems = Array.from(document.querySelectorAll('aside p, aside span'));
    const target = listItems.find(el => el.textContent && el.textContent.trim() === 'Romeo & Prince');
    if (target) {
      target.closest('[role="row"], div')?.click();
    }
  });

  await new Promise((r) => setTimeout(r, 1500));

  // Click the big green play button (title="Reproducir")
  const played = await page.evaluate(() => {
    const playBtn = document.querySelector('button[title="Reproducir"]');
    if (playBtn) {
      playBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked big green play button:', played);

  await new Promise((r) => setTimeout(r, 2500));

  const outDir = 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313';
  await page.screenshot({ path: `${outDir}/spotifree-romeo-playing-active-000.png` });
  console.log('✓ Captured spotifree-romeo-playing-active-000.png');

  const bottomInfo = await page.evaluate(() => {
    const footer = document.querySelector('footer');
    return {
      text: footer?.innerText,
      hasPauseBtn: !!footer?.querySelector('button[title="Pausar"]')
    };
  });
  console.log('Bottom player state:', bottomInfo);

  await page.close();
  browser.disconnect();
}

main().catch(console.error);
