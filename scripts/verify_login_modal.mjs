import puppeteer from 'puppeteer-core';
import { spawn } from 'child_process';
import path from 'path';

async function main() {
  console.log('Starting preview server on port 4173...');
  const server = spawn('cmd', ['/c', 'npx', 'vite', 'preview', '--port', '4173'], {
    stdio: 'inherit',
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
    // 1. Desktop Test (1280x800)
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle2' });

    // Pre-populate saved accounts for testing the Saved Accounts tab
    await page.evaluate(() => {
      localStorage.setItem('spotifree_saved_accounts', JSON.stringify([
        {
          id: 'user_111',
          displayName: 'Jorge Perez',
          email: 'jorge@example.com',
          avatarUrl: '',
          cookie: 'AQ_jorge_sample_cookie',
          lastUsed: Date.now() - 5000,
        },
        {
          id: 'user_222',
          displayName: 'Maria Garcia',
          email: 'maria@example.com',
          avatarUrl: '',
          cookie: 'AQ_maria_sample_cookie',
          lastUsed: Date.now() - 50000,
        }
      ]));
    });

    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    // Open login modal via custom event
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('spotifree_open_login_modal'));
    });
    await new Promise(r => setTimeout(r, 800));

    // Screenshot 1: Desktop Modal (Saved Accounts tab initially since accounts exist)
    await page.screenshot({
      path: path.join(artifactDir, 'desktop_authentic_login_modal_saved_tab.png'),
    });
    console.log('Saved desktop_authentic_login_modal_saved_tab.png');

    // Switch to 'Clave de sesión' tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const cookieTab = tabs.find(t => t.textContent && t.textContent.includes('Clave de sesión'));
      if (cookieTab) cookieTab.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Type sample text into input to showcase authentic Spotify typography (no font-mono)
    await page.evaluate(() => {
      const input = document.querySelector('input[type="password"]');
      if (input) {
        input.value = 'AQB654321_sp_dc_cookie_sample_test_typography';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise(r => setTimeout(r, 500));

    // Screenshot 2: Desktop Modal Cookie tab with typed cookie & enabled green button
    await page.screenshot({
      path: path.join(artifactDir, 'desktop_authentic_login_modal_cookie_tab.png'),
    });
    console.log('Saved desktop_authentic_login_modal_cookie_tab.png');

    // Switch to 'Página oficial' tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const oauthTab = tabs.find(t => t.textContent && t.textContent.includes('Página oficial'));
      if (oauthTab) oauthTab.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Screenshot 3: Desktop Modal OAuth tab with developer mode warning
    await page.screenshot({
      path: path.join(artifactDir, 'desktop_authentic_login_modal_oauth_tab.png'),
    });
    console.log('Saved desktop_authentic_login_modal_oauth_tab.png');

    // 2. Mobile Viewport (iPhone 390x844)
    const mobilePage = await browser.newPage();
    await mobilePage.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await mobilePage.goto('http://localhost:4173', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 1000));

    // Open login modal on mobile via custom event
    await mobilePage.evaluate(() => {
      window.dispatchEvent(new CustomEvent('spotifree_open_login_modal'));
    });
    await new Promise(r => setTimeout(r, 800));

    // Switch to cookie tab on mobile
    await mobilePage.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button'));
      const cookieTab = tabs.find(t => t.textContent && t.textContent.includes('Clave de sesión'));
      if (cookieTab) cookieTab.click();
    });
    await new Promise(r => setTimeout(r, 500));

    // Screenshot 4: Mobile Modal Cookie Tab
    await mobilePage.screenshot({
      path: path.join(artifactDir, 'mobile_authentic_login_modal_cookie_tab.png'),
    });
    console.log('Saved mobile_authentic_login_modal_cookie_tab.png');

  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    await browser.close();
    server.kill();
  }
}

main();
