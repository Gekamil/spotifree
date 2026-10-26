import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1500));

  const desktopPath = path.resolve(__dirname, '../screenshot-desktop.png');
  await page.screenshot({ path: desktopPath });
  console.log('Saved:', desktopPath);

  // Click on the first playlist ("Canciones que te gustan") to capture playlist view
  try {
    const playlistItem = await page.$('.group');
    if (playlistItem) {
      await playlistItem.click();
      await new Promise((r) => setTimeout(r, 1000));
      const playlistPath = path.resolve(__dirname, '../screenshot-playlist.png');
      await page.screenshot({ path: playlistPath });
      console.log('Saved:', playlistPath);
    }
  } catch (err) {
    console.error('Error clicking playlist:', err);
  }

  await browser.close();
}

run().catch(console.error);
