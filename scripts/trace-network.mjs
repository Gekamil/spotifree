import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

async function traceNetwork() {
  const userDataDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\ytm_profile';
  const devToolsPortFile = path.join(userDataDir, 'DevToolsActivePort');
  const portContent = fs.readFileSync(devToolsPortFile, 'utf8').trim().split('\n')[0];
  const port = parseInt(portContent, 10);
  const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
  const page = (await browser.pages())[0];

  const client = await page.createCDPSession();
  await client.send('Network.enable');

  const requests = [];
  client.on('Network.requestWillBeSent', e => {
    if (e.request.url.includes('videoplayback') || e.request.url.includes('googlevideo') || e.request.url.includes('youtubei/v1')) {
      requests.push({
        url: e.request.url.slice(0, 120),
        method: e.request.method,
        time: Date.now()
      });
    }
  });

  client.on('Network.responseReceived', e => {
    if (e.response.url.includes('videoplayback') || e.response.url.includes('googlevideo')) {
      console.log('VIDEOPLAYBACK RESPONSE:', e.response.status, e.response.statusText, e.response.url.slice(0, 100));
    }
  });

  client.on('Network.loadingFailed', e => {
    console.log('NETWORK FAILED:', e.errorText, e.requestId);
  });

  console.log('Listening to network events on YTM for 15s while stuck at 50s...');
  await new Promise(r => setTimeout(r, 15000));
  console.log('Total tracked requests:', requests.length);
  if (requests.length > 0) {
    console.log('Requests:', requests);
  }
}

traceNetwork().catch(console.error);
