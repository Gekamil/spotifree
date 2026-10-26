import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const page = pages.find((p) => p.url().includes('spotify.com')) || pages[0];

  console.log('Connected to tab:', page.url());

  // Show visual indicator in the user's visible Chrome window
  await page.evaluate(() => {
    let indicator = document.getElementById('antigravity-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'antigravity-indicator';
      indicator.style.position = 'fixed';
      indicator.style.bottom = '16px';
      indicator.style.right = '16px';
      indicator.style.backgroundColor = '#1ed760';
      indicator.style.color = '#000000';
      indicator.style.padding = '10px 18px';
      indicator.style.borderRadius = '500px';
      indicator.style.fontWeight = 'bold';
      indicator.style.fontSize = '14px';
      indicator.style.zIndex = '2147483647';
      indicator.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
      indicator.style.transition = 'all 0.3s ease';
      indicator.innerText = '⚡ Conectado con Antigravity AI en vivo';
      document.body.appendChild(indicator);
    }
  });

  // Check login state
  const state = await page.evaluate(() => {
    const isLoggedOut = !!document.querySelector('button[data-testid="login-button"], a[href^="/login"], a[data-testid="login-button"]') ||
                        document.body.innerText.includes('Iniciar sesión');
    const userWidget = document.querySelector('[data-testid="user-widget-link"]') ||
                       document.querySelector('[data-testid="profile-button"]');

    return {
      title: document.title,
      isLoggedOut,
      hasUserWidget: !!userWidget,
    };
  });

  console.log('State:', JSON.stringify(state, null, 2));
  browser.disconnect();
}

main().catch(console.error);
