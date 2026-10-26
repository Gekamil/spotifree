import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function checkSongMode() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  console.log('Navigating to music.youtube.com/watch?v=IOHh7vkX5O0 ...');
  await page.goto('https://music.youtube.com/watch?v=IOHh7vkX5O0', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video', { timeout: 10000 });

  const toggles = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('ytmusic-player-page, tp-yt-paper-tab, [role="tab"], #song-video-toggle, ytmusic-av-toggle'));
    return btns.map(b => ({
      tag: b.tagName,
      id: b.id,
      text: b.textContent?.trim(),
      html: b.outerHTML.slice(0, 150)
    }));
  });
  console.log('Toggles found:', toggles);
}

checkSongMode().catch(console.error);
