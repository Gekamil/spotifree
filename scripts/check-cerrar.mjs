import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function check() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const port = parseInt(fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(), 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];
  const btn = await page.evaluate(() => {
    const el = document.querySelector('button[aria-label="Cerrar"]');
    return el ? { text: el.innerText, html: el.outerHTML, parent: el.parentElement?.tagName } : null;
  });
  console.log('Button found with aria-label Cerrar:', btn);
  browser.disconnect();
}

check().catch(console.error);
