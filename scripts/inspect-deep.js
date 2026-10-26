import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deepInspect() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let page = pages.find((p) => p.url().includes('spotify.com')) || (await browser.newPage());
  await page.bringToFront();
  await page.setViewport({ width: 1440, height: 900 });

  // Dismiss cookie banner if present
  try {
    const acceptBtn = await page.$('#onetrust-accept-btn-handler, button:has-text("ACEPTO")');
    if (acceptBtn) {
      await acceptBtn.click();
      console.log('Dismissed cookie banner');
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find((b) => b.innerText.includes('ACEPTO') || b.innerText.includes('Aceptar'));
        if (btn) btn.click();
      });
      await new Promise((r) => setTimeout(r, 1500));
    }
  } catch (e) {
    console.log('No cookie banner or already dismissed');
  }

  // 1. Clean screenshot of open.spotify.com
  const cleanHomeShot = path.resolve(__dirname, '../spotify-clean-home.png');
  await page.screenshot({ path: cleanHomeShot });
  console.log('Saved clean home shot:', cleanHomeShot);

  // 2. Click "+ Crear" button and extract full CSS styles
  try {
    const createBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(
        (b) => b.innerText.includes('Crear') || b.getAttribute('aria-label')?.includes('Crear')
      );
    });
    if (createBtn) {
      await createBtn.click();
      await new Promise((r) => setTimeout(r, 600));
      const menuShot = path.resolve(__dirname, '../spotify-create-menu-clean.png');
      await page.screenshot({ path: menuShot });
      console.log('Saved clean create menu shot:', menuShot);
    }
  } catch (e) {
    console.error('Error on create menu:', e.message);
  }

  // 3. Click a playlist to see the playlist view table
  try {
    console.log('Navigating to a popular public playlist...');
    await page.goto('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', {
      waitUntil: 'networkidle2',
    });
    await new Promise((r) => setTimeout(r, 2000));
    const playlistShot = path.resolve(__dirname, '../spotify-live-playlist.png');
    await page.screenshot({ path: playlistShot });
    console.log('Saved live playlist shot:', playlistShot);

    // Right-click on first track to inspect context menu
    const trackRow = await page.$('[data-testid="tracklist-row"]');
    if (trackRow) {
      console.log('Found track row, right-clicking to open context menu...');
      await trackRow.click({ button: 'right' });
      await new Promise((r) => setTimeout(r, 800));
      const contextMenuShot = path.resolve(__dirname, '../spotify-track-context-menu.png');
      await page.screenshot({ path: contextMenuShot });
      console.log('Saved context menu shot:', contextMenuShot);

      const contextItems = await page.evaluate(() => {
        const menu = document.querySelector('[role="menu"]');
        if (!menu) return [];
        return Array.from(menu.querySelectorAll('[role="menuitem"], button, span')).map((el) =>
          el.innerText.trim()
        );
      });
      console.log('Track Context Menu Items:', contextItems);
    }
  } catch (e) {
    console.error('Error opening playlist/context menu:', e.message);
  }

  browser.disconnect();
}

deepInspect().catch(console.error);
