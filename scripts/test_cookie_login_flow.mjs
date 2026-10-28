import puppeteer from 'puppeteer-core';

async function testCookieLoginFlow() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  await page.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // Open login modal
  await page.evaluate(() => {
    const libBtn = Array.from(document.querySelectorAll('nav button, nav a')).find((b) =>
      b.innerText && b.innerText.includes('biblioteca')
    );
    if (libBtn) libBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  await page.evaluate(() => {
    const addAccountBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText && b.innerText.includes('Añadir cuenta')
    );
    if (addAccountBtn) addAccountBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Check clicking "Pegar clave desde portapapeles y entrar" with invalid or valid test
  console.log('Testing button behavior...');
  const btn = await page.evaluate(() => {
    const pBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText && b.innerText.includes('Pegar clave')
    );
    if (pBtn) {
      pBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked paste button:', btn);
  await new Promise((r) => setTimeout(r, 500));

  const alertMsg = await page.evaluate(() => {
    const alert = document.querySelector('.bg-red-500\\/15, .bg-emerald-500\\/15');
    return alert ? alert.innerText : null;
  });
  console.log('Alert shown gracefully:', alertMsg);

  await browser.close();
}

testCookieLoginFlow().catch(console.error);
