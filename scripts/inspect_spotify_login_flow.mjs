import puppeteer from 'puppeteer-core';

async function inspectLogin() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  
  const requests = [];
  page.on('request', req => {
    if (req.url().includes('spotify.com') && (req.method() === 'POST' || req.url().includes('login') || req.url().includes('auth') || req.url().includes('challenge'))) {
      requests.push({ url: req.url(), method: req.method() });
    }
  });

  await page.goto('https://accounts.spotify.com/es/login', { waitUntil: 'networkidle2' });
  console.log('Page title:', await page.title());

  // Check inputs on the page
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      id: i.id,
      name: i.name,
      type: i.type,
      placeholder: i.placeholder,
      'data-testid': i.getAttribute('data-testid')
    }));
  });
  console.log('Inputs found on accounts.spotify.com:', inputs);

  // Check buttons
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      id: b.id,
      text: b.innerText,
      'data-testid': b.getAttribute('data-testid')
    }));
  });
  console.log('Buttons found:', buttons);

  await browser.close();
}

inspectLogin().catch(console.error);
