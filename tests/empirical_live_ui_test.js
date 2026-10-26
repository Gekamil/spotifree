import puppeteer from 'puppeteer-core';

function rgbToHex(rgbStr) {
  if (!rgbStr) return rgbStr;
  if (rgbStr.startsWith('#')) return rgbStr.toLowerCase();
  const match = rgbStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return rgbStr;
  const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
  const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
  const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toLowerCase();
}

async function runLiveUITest() {
  console.log('='.repeat(80));
  console.log('EMPIRICAL LIVE UI INTERACTION TEST — NO MOCK / STORE TAMPERING');
  console.log('='.repeat(80));

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let page = pages.find((p) => p.url().includes('5173'));

  if (!page) {
    page = await browser.newPage();
    await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
  } else {
    await page.bringToFront();
  }

  // Reload page to get clean fresh state
  console.log('Reloading application for fresh user session...');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise((r) => setTimeout(r, 1000));

  // Wait for sidebar playlist rows
  await page.waitForFunction(() => {
    const aside = document.querySelector('aside');
    return aside && aside.querySelectorAll('div.cursor-pointer.group').length > 0;
  }, { timeout: 10000 });

  console.log('App ready and authenticated with real Chrome session.');

  // 1. Inspect initial idle state typography in sidebar
  const idleInfo = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    const first = items[0];
    const pTitle = first?.querySelector('p');
    const pSubtitle = first?.querySelector('div.text-\\[14px\\]') || first?.querySelectorAll('p')[1] || first?.querySelector('span.truncate');
    return {
      titleText: pTitle?.innerText,
      titleFontSize: window.getComputedStyle(pTitle).fontSize,
      titleFontFamily: window.getComputedStyle(pTitle).fontFamily,
      titleColor: window.getComputedStyle(pTitle).color,
      subtitleText: pSubtitle?.innerText,
      subtitleFontSize: window.getComputedStyle(pSubtitle).fontSize,
      subtitleColor: window.getComputedStyle(pSubtitle).color,
      hasEqualizer: !!first?.querySelector('.animate-bounce'),
    };
  });

  console.log('\n--- 1. Idle Typography ---');
  console.log(`Title: "${idleInfo.titleText}" | Size: ${idleInfo.titleFontSize} | Color: ${rgbToHex(idleInfo.titleColor)} | Font: ${idleInfo.titleFontFamily}`);
  console.log(`Subtitle: "${idleInfo.subtitleText}" | Size: ${idleInfo.subtitleFontSize} | Color: ${rgbToHex(idleInfo.subtitleColor)}`);
  console.log(`Equalizer waves present: ${idleInfo.hasEqualizer}`);

  // 2. Play first card from Home top 8 grid
  console.log('\n--- 2. Starting Playback via Home Top 8 Grid ---');
  // Make sure we are on Home tab
  await page.evaluate(() => {
    const homeBtn = document.querySelector('header button[title="Spotify"]') || document.querySelector('header button');
    if (homeBtn) homeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Find quick access cards in Home view
  const cardFound = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('main div.grid button'));
    // Or quick play buttons
    const playBtns = Array.from(document.querySelectorAll('main button[title*="Reproducir"]'));
    if (playBtns.length > 0) {
      playBtns[0].click();
      return { clickedBtn: playBtns[0].getAttribute('title') };
    }
    // Alternatively click the first card directly
    const gridCards = Array.from(document.querySelectorAll('main div.grid > div'));
    if (gridCards.length > 0) {
      const btn = gridCards[0].querySelector('button');
      if (btn) {
        btn.click();
        return { clickedGridCardBtn: true };
      }
      gridCards[0].click();
      return { clickedGridCard: true };
    }
    return { error: 'No grid cards found' };
  });
  console.log('Play action result:', cardFound);
  await new Promise((r) => setTimeout(r, 600));

  // Inspect sidebar after starting playback
  const playingSidebarInfo = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    return items.slice(0, 3).map((item, idx) => {
      const p = item.querySelector('p');
      return {
        idx,
        title: p?.innerText,
        rawColor: window.getComputedStyle(p).color,
        hasEqualizer: !!item.querySelector('.animate-bounce'),
        isSelected: item.className.includes('bg-[#282828]'),
      };
    });
  });

  console.log('\nSidebar items during playback:');
  for (const it of playingSidebarInfo) {
    const hex = rgbToHex(it.rawColor);
    console.log(`  [${it.idx}] "${it.title}" | color: ${hex} | hasEqualizer: ${it.hasEqualizer} | isSelected: ${it.isSelected}`);
  }

  // 3. User selects Playlist 1 (Radar de Novedades) while Playlist 0 is playing
  console.log('\n--- 3. ADVERSARIAL STRESS TEST: Clicking Playlist 1 while Playlist 0 plays ---');
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    if (items[1]) items[1].click();
  });
  await new Promise((r) => setTimeout(r, 600));

  const crossSidebarInfo = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    return items.slice(0, 3).map((item, idx) => {
      const p = item.querySelector('p');
      return {
        idx,
        title: p?.innerText,
        rawColor: window.getComputedStyle(p).color,
        hasEqualizer: !!item.querySelector('.animate-bounce'),
        isSelected: item.className.includes('bg-[#282828]'),
      };
    });
  });

  console.log('Sidebar items after selecting Playlist 1:');
  for (const it of crossSidebarInfo) {
    const hex = rgbToHex(it.rawColor);
    console.log(`  [${it.idx}] "${it.title}" | color: ${hex} | hasEqualizer: ${it.hasEqualizer} | isSelected: ${it.isSelected}`);
  }

  // Evaluate BUG condition
  const p1Hex = rgbToHex(crossSidebarInfo[1].rawColor);
  const playlist1Bug = p1Hex === '#1ed760' && crossSidebarInfo[1].hasEqualizer === true;
  console.log(`\n>>> BUG CONFIRMATION: Did selected Playlist 1 falsely turn #1ed760 with equalizer waves? ${playlist1Bug}`);

  // 4. Pause playback
  console.log('\n--- 4. Pausing Playback via Bottom Player Bar ---');
  const pauseClicked = await page.evaluate(() => {
    const pauseBtn = document.querySelector('footer button[title="Pausa"]');
    if (pauseBtn) {
      pauseBtn.click();
      return true;
    }
    return false;
  });
  console.log(`Pause button clicked: ${pauseClicked}`);
  await new Promise((r) => setTimeout(r, 500));

  const pausedSidebarInfo = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group'));
    return items.slice(0, 3).map((item, idx) => {
      const p = item.querySelector('p');
      return {
        idx,
        title: p?.innerText,
        rawColor: window.getComputedStyle(p).color,
        hasEqualizer: !!item.querySelector('.animate-bounce'),
        isSelected: item.className.includes('bg-[#282828]'),
      };
    });
  });

  console.log('Sidebar items after pausing:');
  for (const it of pausedSidebarInfo) {
    const hex = rgbToHex(it.rawColor);
    console.log(`  [${it.idx}] "${it.title}" | color: ${hex} | hasEqualizer: ${it.hasEqualizer} | isSelected: ${it.isSelected}`);
  }

  browser.disconnect();
}

runLiveUITest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
