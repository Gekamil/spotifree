import puppeteer from 'puppeteer-core';

async function captureAuthenticLoginModal() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  // Desktop capture
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to Spotifree...');
  await page.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // Open login modal via top right button
  console.log('Opening Login Modal...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, span')).find((b) =>
      b.innerText && b.innerText.includes('Iniciar sesión')
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  const desktopScreenshot = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313\\authentic_spotify_login_modal_desktop.png';
  await page.screenshot({ path: desktopScreenshot });
  console.log('Saved desktop screenshot:', desktopScreenshot);

  // Mobile capture
  const mobilePage = await browser.newPage();
  await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await mobilePage.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  await mobilePage.evaluate(() => {
    const libBtn = Array.from(document.querySelectorAll('nav button, nav a')).find((b) =>
      b.innerText && b.innerText.includes('biblioteca')
    );
    if (libBtn) libBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  await mobilePage.evaluate(() => {
    const addAccountBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText && b.innerText.includes('Añadir cuenta')
    );
    if (addAccountBtn) addAccountBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1000));

  const mobileScreenshot = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313\\authentic_spotify_login_modal_mobile.png';
  await mobilePage.screenshot({ path: mobileScreenshot });
  console.log('Saved mobile screenshot:', mobileScreenshot);

  await browser.close();
}

captureAuthenticLoginModal().catch(console.error);
