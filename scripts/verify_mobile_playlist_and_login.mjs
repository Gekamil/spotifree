import puppeteer from 'puppeteer-core';

async function testMobile() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  console.log('Navigating to Spotifree Mobile...');
  await page.goto('https://spotifreeweb.vercel.app/', { waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Test clicking a playlist from mobile home
  console.log('Clicking on a playlist card in mobile home...');
  const clickedName = await page.evaluate(() => {
    // Click on Romeo & Prince or first shortcut/card
    const cards = Array.from(document.querySelectorAll('.px-4 .h-14, .w-\\[140px\\]'));
    const target = cards.find((c) => c.innerText.includes('Romeo') || c.innerText.includes('Prince')) || cards[0];
    if (target) {
      target.click();
      return target.innerText.split('\n')[0];
    }
    return null;
  });
  console.log('Clicked playlist card:', clickedName);
  await new Promise((r) => setTimeout(r, 1500));

  // Check playlist view tracks on mobile
  const playlistViewStatus = await page.evaluate(() => {
    const title = document.querySelector('h1, .truncate.max-w-\\[200px\\]');
    const tracks = Array.from(document.querySelectorAll('.flex.items-center.justify-between.p-2\\.5'));
    const trackNames = tracks.slice(0, 5).map((t) => {
      const name = t.querySelector('.font-bold.text-sm');
      const artist = t.querySelector('.text-xs.text-\\[\\#b3b3b3\\]');
      return `${name ? name.innerText : ''} - ${artist ? artist.innerText : ''}`;
    });

    return {
      title: title ? title.innerText : null,
      totalTracksRendered: tracks.length,
      sampleTracks: trackNames,
    };
  });
  console.log('Mobile Playlist detail view status:', playlistViewStatus);

  // 2. Test opening login modal on mobile
  console.log('Opening Login Modal on mobile...');
  // Click back to home
  await page.evaluate(() => {
    const backBtn = document.querySelector('button[title="Atrás"]');
    if (backBtn) backBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  // Click library or profile to open login
  await page.evaluate(() => {
    const libBtn = Array.from(document.querySelectorAll('nav button')).find((b) => b.innerText.includes('biblioteca'));
    if (libBtn) libBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  await page.evaluate(() => {
    const addAccountBtn = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Añadir cuenta'));
    if (addAccountBtn) addAccountBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  const modalStatus = await page.evaluate(() => {
    const modal = document.querySelector('.bg-\\[\\#121212\\]');
    const emailInput = document.querySelector('input[type="text"][placeholder*="ejemplo@correo.com"]');
    const pwdInput = document.querySelector('input[type="password"]');
    const tabs = Array.from(document.querySelectorAll('.rounded-full button, .bg-white\\/5 button')).map((b) => b.innerText);
    return {
      modalVisible: !!modal,
      hasEmailInput: !!emailInput,
      hasPasswordInput: !!pwdInput,
      tabs: tabs.filter(Boolean),
    };
  });
  console.log('Login Modal Status on Mobile:', modalStatus);

  await browser.close();
}

testMobile().catch(console.error);
