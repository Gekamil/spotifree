import puppeteer from 'puppeteer-core';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const authPage = pages.find((p) => p.url().includes('accounts.spotify.com'));

  if (authPage) {
    console.log('Found Spotify Auth Page:', authPage.url());
    console.log('Title:', await authPage.title());

    // Check buttons on the page
    const buttons = await authPage.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map((b) => ({
        text: b.innerText.trim(),
        id: b.id,
        testId: b.getAttribute('data-testid'),
      }));
    });
    console.log('Buttons on auth page:', buttons);

    // Click "Aceptar" or the primary auth button
    const acceptClicked = await authPage.evaluate(() => {
      const btn = document.querySelector('button[data-testid="auth-accept"]') ||
                  Array.from(document.querySelectorAll('button')).find(b => b.innerText.toLowerCase().includes('aceptar') || b.innerText.toLowerCase().includes('agree'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    console.log('Accept button clicked:', acceptClicked);
    await sleep(3000);

    console.log('Post-auth URL:', authPage.url());
  } else {
    console.log('No accounts.spotify.com tab found. Open pages:');
    pages.forEach(p => console.log(' - ', p.url()));
  }

  browser.disconnect();
}

run().catch(console.error);
