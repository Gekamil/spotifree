import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testAllInteractions() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Opening http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  // 1. Profile Dropdown
  const avatar = await page.$('button[title="Jorgeperezvk"]');
  if (avatar) {
    await avatar.click();
    await new Promise((r) => setTimeout(r, 400));
    const shot = path.resolve(__dirname, '../test-profile-menu.png');
    await page.screenshot({ path: shot });
    console.log('Saved:', shot);
    // Click outside to close
    await page.click('body', { offset: { x: 200, y: 200 } });
    await new Promise((r) => setTimeout(r, 300));
  }

  // 2. Create Menu Dropdown
  const createBtn = await page.$('button[title="Crea una lista, carpeta o Jam"]');
  if (createBtn) {
    await createBtn.click();
    await new Promise((r) => setTimeout(r, 400));
    const shot = path.resolve(__dirname, '../test-create-menu.png');
    await page.screenshot({ path: shot });
    console.log('Saved:', shot);
    await page.click('body', { offset: { x: 600, y: 200 } });
    await new Promise((r) => setTimeout(r, 300));
  }

  // 3. Sort Menu Dropdown
  const sortBtn = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find((b) => b.innerText.toLowerCase().includes('recientes'));
  });
  if (sortBtn) {
    await sortBtn.click();
    await new Promise((r) => setTimeout(r, 400));
    const shot = path.resolve(__dirname, '../test-sort-menu.png');
    await page.screenshot({ path: shot });
    console.log('Saved:', shot);
    await page.click('body', { offset: { x: 600, y: 200 } });
    await new Promise((r) => setTimeout(r, 300));
  }

  // 4. Search View
  const searchInput = await page.$('input[placeholder="¿Qué quieres reproducir?"]');
  if (searchInput) {
    await searchInput.type('Starboy');
    await new Promise((r) => setTimeout(r, 600));
    const shot = path.resolve(__dirname, '../test-search-view.png');
    await page.screenshot({ path: shot });
    console.log('Saved:', shot);
  }

  // 5. Queue Right Sidebar
  const queueBtn = await page.$('button[title="Cola de reproducción"]');
  if (queueBtn) {
    await queueBtn.click();
    await new Promise((r) => setTimeout(r, 500));
    const shot = path.resolve(__dirname, '../test-queue-sidebar.png');
    await page.screenshot({ path: shot });
    console.log('Saved:', shot);
  }

  await page.close();
  browser.disconnect();
}

testAllInteractions().catch(console.error);
