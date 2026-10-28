import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';

async function main() {
  console.log('Starting preview server on port 4173...');
  const server = spawn('cmd', ['/c', 'npx', 'vite', 'preview', '--port', '4173'], {
    stdio: 'ignore',
    detached: false,
  });

  // Wait until server is responding
  let connected = false;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://localhost:4173');
      if (res.ok) {
        connected = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!connected) {
    throw new Error('Vite preview server failed to start on port 4173');
  }

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';

  try {
    // 1. Desktop Unauthenticated Test (1280x800)
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle2' });
    
    // Ensure clean state (no cookies or local storage tokens)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    // Screenshot 1: Desktop Unauthenticated Home View
    await page.screenshot({
      path: path.join(artifactDir, 'desktop_unauthenticated_clean_home.png'),
    });
    console.log('Saved desktop_unauthenticated_clean_home.png');

    // 2. Mobile Viewport (iPhone 390x844) - Clean Unauthenticated State
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mobilePage.goto('http://localhost:4173', { waitUntil: 'networkidle2' });
    
    await mobilePage.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await mobilePage.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1200));

    // Screenshot 2: Mobile Unauthenticated Home View (Música para todos, Conectar cuenta, Gear icon)
    await mobilePage.screenshot({
      path: path.join(artifactDir, 'mobile_unauthenticated_clean_home.png'),
    });
    console.log('Saved mobile_unauthenticated_clean_home.png');

    // Click the gear icon to open Settings on mobile
    await mobilePage.evaluate(() => {
      const headerButtons = Array.from(document.querySelectorAll('header button'));
      const settingsBtn = headerButtons.find(b => b.getAttribute('title') === 'Configuración');
      if (settingsBtn) {
        settingsBtn.click();
      }
    });
    await new Promise(r => setTimeout(r, 800));

    // Screenshot 3: Mobile Settings View with Volver al inicio and Cookie Input
    await mobilePage.screenshot({
      path: path.join(artifactDir, 'mobile_settings_view_opened.png'),
    });
    console.log('Saved mobile_settings_view_opened.png');

    // Click 'Tu biblioteca' tab
    await mobilePage.evaluate(() => {
      const navButtons = Array.from(document.querySelectorAll('nav button'));
      const libBtn = navButtons.find(b => b.textContent && b.textContent.includes('Tu biblioteca'));
      if (libBtn) libBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Screenshot 4: Mobile Unauthenticated Library View
    await mobilePage.screenshot({
      path: path.join(artifactDir, 'mobile_unauthenticated_clean_library.png'),
    });
    console.log('Saved mobile_unauthenticated_clean_library.png');

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
    server.kill();
  }
}

main();
