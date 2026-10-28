import puppeteer from 'puppeteer-core';

async function testUpdatedLoginModal() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  console.log('Navigating to Spotifree...');
  await page.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // Open login modal via Library -> Añadir cuenta
  console.log('Navigating to library and opening login modal...');
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

  // Check modal contents
  const modalData = await page.evaluate(() => {
    const activeTab = document.querySelector('.bg-white.text-black')?.innerText;
    const pasteBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText && b.innerText.includes('Pegar clave')
    );
    const input = document.querySelector('input[type="password"]');
    const helpBtn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText && b.innerText.includes('¿Cómo obtener')
    );

    return {
      activeTab,
      hasPasteButton: !!pasteBtn,
      pasteButtonText: pasteBtn ? pasteBtn.innerText.trim() : null,
      hasPasswordInput: !!input,
      inputPlaceholder: input ? input.placeholder : null,
      hasHelpButton: !!helpBtn,
    };
  });
  console.log('Updated Login Modal State on Mobile:', modalData);

  // Take screenshot
  const screenshotPath = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313\\updated_login_modal_spdc_default.png';
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();
}

testUpdatedLoginModal().catch(console.error);
