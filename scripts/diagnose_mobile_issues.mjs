import puppeteer from 'puppeteer-core';

async function diagnose() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  );

  const failedRequests = [];
  const consoleErrors = [];

  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  page.on('response', res => {
    if (res.status() >= 400 && !res.url().includes('favicon')) {
      failedRequests.push({ url: res.url(), status: res.status() });
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log('--- 1. Testing Mobile Home ---');
  await page.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2', timeout: 35000 });
  await new Promise(r => setTimeout(r, 3000));

  // Check all images currently rendered in DOM
  const imgCheck = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map(img => ({
      src: img.src,
      alt: img.alt,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      isBroken: img.complete && img.naturalWidth === 0
    }));
  });

  const brokenImgs = imgCheck.filter(i => i.isBroken);
  console.log(`Total images on Home: ${imgCheck.length}, Broken: ${brokenImgs.length}`);
  if (brokenImgs.length > 0) {
    console.log('Broken images on Home:', JSON.stringify(brokenImgs, null, 2));
  }

  // 2. Test Tab Search
  console.log('--- 2. Testing Mobile Search ---');
  const searchBtn = await page.$('[data-testid="bottom-tab-navigation"] button:nth-child(2)');
  if (searchBtn) {
    await searchBtn.click();
    await new Promise(r => setTimeout(r, 2000));
    
    const searchImgs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt,
        isBroken: img.complete && img.naturalWidth === 0
      })).filter(i => i.isBroken);
    });
    console.log(`Broken images on Search: ${searchImgs.length}`, searchImgs);
  }

  // 3. Test Tab Library
  console.log('--- 3. Testing Mobile Library ---');
  const libBtn = await page.$('[data-testid="bottom-tab-navigation"] button:nth-child(3)');
  if (libBtn) {
    await libBtn.click();
    await new Promise(r => setTimeout(r, 2000));

    const libImgs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        alt: img.alt,
        isBroken: img.complete && img.naturalWidth === 0
      })).filter(i => i.isBroken);
    });
    console.log(`Broken images on Library: ${libImgs.length}`, libImgs);
  }

  // 4. Test Playlist Navigation & Tracks
  console.log('--- 4. Testing Playlist detail ---');
  const homeBtn = await page.$('[data-testid="bottom-tab-navigation"] button:nth-child(1)');
  if (homeBtn) {
    await homeBtn.click();
    await new Promise(r => setTimeout(r, 1000));
  }
  const cards = await page.$$('.grid > div');
  if (cards.length > 1) {
    // Click second card: Romeo Santos & Prince Royce
    await cards[1].click();
    await new Promise(r => setTimeout(r, 2500));

    const plInfo = await page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent?.trim();
      const tracks = Array.from(document.querySelectorAll('.space-y-1 > div, .space-y-2 > div')).map(t => t.textContent?.trim());
      const broken = Array.from(document.querySelectorAll('img')).filter(img => img.complete && img.naturalWidth === 0).map(img => img.src);
      return { title, tracksCount: tracks.length, brokenImgsCount: broken.length, broken };
    });
    console.log('Playlist detail test:', plInfo);
  }

  console.log('Failed HTTP requests count:', failedRequests.length);
  if (failedRequests.length > 0) {
    console.log('Failed requests sample:', failedRequests.slice(0, 10));
  }
  console.log('Console errors count:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.log('Console errors:', consoleErrors.slice(0, 10));
  }

  await browser.close();
}

diagnose().catch(console.error);
