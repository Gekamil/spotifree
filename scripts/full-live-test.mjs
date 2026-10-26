import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const appPage = pages[0];

  console.log('Navigating to http://127.0.0.1:5173/ ...');
  await appPage.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' });
  await appPage.waitForSelector('main', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 1000));

  // 1. Click playlist "Canciones que te gustan" or "Romeo & Prince" in sidebar
  console.log('Selecting playlist in sidebar...');
  await appPage.evaluate(() => {
    const asideItems = Array.from(document.querySelectorAll('aside p'));
    const target = asideItems.find(p => p.innerText.includes('Canciones') || p.innerText.includes('Romeo'));
    if (target) {
      const container = target.closest('div[class*="cursor-pointer"]') || target;
      container.click();
    }
  });
  await new Promise(r => setTimeout(r, 1500));

  // 2. Play track 1
  console.log('Starting track 1 playback...');
  await appPage.evaluate(() => {
    const playBtn = document.querySelector('button[title="Reproducir"]');
    if (playBtn) {
      playBtn.click();
    } else {
      const rows = Array.from(document.querySelectorAll('div[class*="grid-cols-[20px"]:not(.border-b)'));
      if (rows[0]) rows[0].click();
    }
  });
  await new Promise(r => setTimeout(r, 2000));

  // 3. Test Scrubber Dragging
  console.log('Testing Scrubber Dragging...');
  const dragRes = await appPage.evaluate(() => {
    const bar = document.querySelector('footer div[class*="group relative flex-1 h-3"]');
    if (!bar) return { error: 'No scrubber' };
    const rect = bar.getBoundingClientRect();
    bar.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rect.left + rect.width * 0.3 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + rect.width * 0.7 }));
    const fillEl = bar.querySelector('div > div');
    const widthDuringDrag = fillEl ? fillEl.style.width : null;
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.left + rect.width * 0.7 }));
    return { widthDuringDrag };
  });
  console.log('Scrubber Drag Result:', dragRes);

  // 4. Test Expand Handle ("<")
  console.log('Testing Expand Handle ("<")...');
  const expandHandle = await appPage.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Expand handle ("<") clicked:', expandHandle);
  await new Promise(r => setTimeout(r, 1200));

  // 5. Inspect Right Sidebar
  console.log('Inspecting Right Sidebar ("Vista Sonando")...');
  const sidebarData = await appPage.evaluate(() => {
    const aside = document.querySelector('aside#Desktop_PanelContainer_Id');
    if (!aside) return { error: 'No right sidebar' };
    return {
      title: aside.querySelector('h2')?.innerText,
      hasLyrics: aside.innerText.includes('Vista previa de la letra'),
      lyricsSample: Array.from(aside.querySelectorAll('p[class*="font-black"]')).map(p => p.innerText).slice(0, 3),
      hasVideos: aside.innerText.includes('Vídeos musicales relacionados'),
      hasArtistInfo: aside.innerText.includes('Información sobre el artista'),
      hasCredits: aside.innerText.includes('Créditos'),
      hasQueue: aside.innerText.includes('A continuación en la cola'),
      collapseBtn: !!aside.querySelector('button[aria-label="Ocultar la vista Sonando"]')
    };
  });
  console.log('Right Sidebar Data:', JSON.stringify(sidebarData, null, 2));

  await appPage.screenshot({ path: 'scripts/final-verification-screenshot.png' });
  console.log('Saved screenshot to scripts/final-verification-screenshot.png');

  browser.disconnect();
}

main().catch(console.error);
