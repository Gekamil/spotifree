import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  console.log('Navigating to Desktop Spotifree...');
  await page.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Check shelf titles
  const shelfTitles = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h2')).map((h) => h.innerText.trim());
  });
  console.log('Desktop Shelf Titles found:', shelfTitles);

  // 2. Check "Mostrar todos" buttons
  const seeAllButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).filter((b) =>
      b.innerText.toLowerCase().includes('mostrar todos') || b.innerText.toLowerCase().includes('ver todo')
    ).map((b) => b.innerText);
  });
  console.log('Found See All Buttons:', seeAllButtons.length);

  // 3. Test clicking "Mostrar todos"
  console.log('Clicking first "Mostrar todos" button...');
  const clicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      b.innerText.toLowerCase().includes('mostrar todos')
    );
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked see all:', clicked);
  await new Promise((r) => setTimeout(r, 800));

  // Check if expanded view is visible
  const expandedTitle = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const gridCards = document.querySelectorAll('.grid > div');
    return {
      h1: h1 ? h1.innerText : null,
      cardCount: gridCards.length,
    };
  });
  console.log('Expanded view status:', expandedTitle);

  // 4. Test clicking Top Nav Back Arrow
  console.log('Clicking Top Nav Back arrow...');
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
      page.click('header button[title="Volver"]'),
    ]);
  } catch (err) {
    console.log('Navigated back safely.');
  }
  await new Promise((r) => setTimeout(r, 1000));

  const afterBackH1 = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const h2s = Array.from(document.querySelectorAll('h2')).map((h) => h.innerText);
    return {
      h1: h1 ? h1.innerText : null,
      shelvesCount: h2s.length,
    };
  });
  console.log('Status after back button:', afterBackH1);

  // 5. Test instant playlist click and vibrant hero glow
  console.log('Testing instant playlist click on Radio Romeo Santos...');
  const playlistInfo = await page.evaluate(() => {
    // Find card with Radio Romeo Santos or first shelf card
    const cards = Array.from(document.querySelectorAll('.group.cursor-pointer'));
    const target = cards.find((c) => c.innerText.includes('Romeo Santos')) || cards[0];
    if (target) {
      target.click();
      return target.innerText.split('\n')[0];
    }
    return null;
  });
  console.log('Clicked card:', playlistInfo);
  await new Promise((r) => setTimeout(r, 1000));

  const playlistStatus = await page.evaluate(() => {
    const titleEl = document.querySelector('h1');
    const tracks = document.querySelectorAll('.group.h-14, [role="row"]');
    const hero = document.querySelector('.px-8.pt-8.pb-6') || document.querySelector('[style*="linear-gradient"]');
    const heroStyle = hero ? hero.getAttribute('style') : '';
    const glowDiv = document.querySelector('.blur-\\[110px\\]');
    const glowColor = glowDiv ? glowDiv.getAttribute('style') : '';

    return {
      title: titleEl ? titleEl.innerText : null,
      trackCount: tracks.length,
      heroGradient: heroStyle ? heroStyle.slice(0, 100) : 'none',
      glowAuraColor: glowColor,
    };
  });
  console.log('Playlist view status:', playlistStatus);
  console.log('Console errors:', consoleErrors.length);

  await browser.close();
}

run().catch(console.error);
