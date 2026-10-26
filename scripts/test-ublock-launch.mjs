import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

async function test() {
  const ublockPath = path.resolve('extensions/ublock/uBlock0.chromium');
  console.log('ublock exists:', fs.existsSync(ublockPath));
  const b = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    userDataDir: 'C:\\Users\\jorge\\.gemini\\antigravity\\temp_profile_test',
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${ublockPath}`,
      `--load-extension=${ublockPath}`,
    ],
  });
  await new Promise((r) => setTimeout(r, 2000));
  for (const t of b.targets()) {
    console.log(t.type(), t.url());
  }
  await b.close();
}
test().catch(console.error);
