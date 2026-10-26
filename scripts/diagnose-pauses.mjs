import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function diagnose() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (!v) return;

    window.__pauseEvents = [];
    v.addEventListener('pause', () => {
      const err = new Error('Pause detected');
      window.__pauseEvents.push({ time: v.currentTime, stack: err.stack });
    });

    // Intercept v.pause() method
    const originalPause = v.pause;
    v.pause = function() {
      const err = new Error('Explicit v.pause() called');
      window.__pauseEvents.push({ type: 'explicit_pause', time: v.currentTime, stack: err.stack });
      return originalPause.apply(this, arguments);
    };

    v.muted = false;
    v.play().catch(() => {});
  });

  console.log('Monitoring pause events for 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));

  const events = await page.evaluate(() => {
    return window.__pauseEvents || [];
  });

  console.log('Recorded pause events count:', events.length);
  console.log('Recorded pause events:', JSON.stringify(events, null, 2));

  browser.disconnect();
}

diagnose().catch(console.error);
