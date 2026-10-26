import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function testConnect() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = parseInt(fs.readFileSync(portFile, 'utf8').split('\n')[0].trim(), 10);
  console.log('Connecting to browser on port:', port);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  console.log('Successfully connected! Pages count:', (await browser.pages()).length);
  const pages = await browser.pages();
  console.log('Pages:', pages.map(p => p.url()));
  browser.disconnect();
}

testConnect().catch(console.error);
