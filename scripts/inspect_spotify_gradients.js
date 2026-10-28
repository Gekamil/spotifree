import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  
  const results = await page.evaluate(() => {
    const list = [];
    document.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el);
      if (style.backgroundImage && style.backgroundImage.includes('gradient')) {
        list.push({
          tag: el.tagName,
          id: el.id,
          className: el.className ? String(el.className).slice(0, 50) : '',
          bg: style.backgroundImage,
          bgColor: style.backgroundColor,
          transition: style.transition
        });
      }
    });
    return list;
  });
  console.log('Results found:', results.length);
  console.log(JSON.stringify(results.slice(0, 8), null, 2));

  // Also take a screenshot of open.spotify.com desktop
  await page.screenshot({ path: 'public/spotify_desktop_real.png' });
  console.log('Saved public/spotify_desktop_real.png');

  await browser.close();
}

main().catch(console.error);
