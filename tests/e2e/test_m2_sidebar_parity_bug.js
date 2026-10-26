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

async function run() {
  console.log('='.repeat(80));
  console.log('   EMPIRICAL REPRODUCTION: SIDEBAR SELECTED VS PLAYING STATE CONFLATION');
  console.log('='.repeat(80));

  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
  
  await page.waitForFunction(() => {
    const s = window.__useSpotifyDataStore?.getState();
    return s && s.playlists && s.playlists.length >= 2;
  }, { timeout: 10000 });
  await new Promise((r) => setTimeout(r, 800));

  console.log('\nStep 1: Start playback of Playlist 0 by clicking play button in quick access grid...');
  // Click the quick play button on the second quick-access card (Playlist 0)
  const clickedPlay = await page.evaluate(() => {
    const quickGrid = document.querySelector('.grid.grid-cols-2.lg\\:grid-cols-4');
    if (!quickGrid) return false;
    const cards = quickGrid.children;
    // Card 1 corresponds to playlists[0] ("Novedades Viernes España")
    const card = cards[1] || cards[0];
    const playBtn = card.querySelector('button');
    if (playBtn) {
      playBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked play button on quick access card:', clickedPlay);
  await new Promise((r) => setTimeout(r, 600));

  console.log('\nStep 2: User clicks Playlist 1 ("Radar de Novedades") in sidebar to view/select it...');
  const clickedSidebar = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = aside.querySelectorAll('div.cursor-pointer.group');
    if (items[1]) {
      items[1].click();
      return true;
    }
    return false;
  });
  console.log('Clicked Playlist 1 in sidebar:', clickedSidebar);
  await new Promise((r) => setTimeout(r, 600));

  console.log('\nStep 3: Measure computed styles of Playlist 0 and Playlist 1 in sidebar DOM...');
  const results = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    const items = Array.from(aside.querySelectorAll('div.cursor-pointer.group')).slice(0, 2);
    return items.map((item, idx) => {
      const p = item.querySelector('p');
      const style = window.getComputedStyle(p);
      const hasEqualizer = !!item.querySelector('.animate-bounce');
      const isSelected = item.className.includes('bg-[#282828]');
      return {
        index: idx,
        name: p?.innerText,
        color: style.color,
        hasEqualizer,
        isSelected,
      };
    });
  });

  const p0Hex = rgbToHex(results[0].color);
  const p1Hex = rgbToHex(results[1].color);

  console.log(`\nPlaylist 0 (${results[0].name}) [PLAYING, NOT SELECTED]:`);
  console.log(`  - Color: ${p0Hex} (expected #1ed760)`);
  console.log(`  - Equalizer: ${results[0].hasEqualizer} (expected true)`);
  console.log(`  - Selected: ${results[0].isSelected}`);

  console.log(`\nPlaylist 1 (${results[1].name}) [NOT PLAYING, SELECTED]:`);
  console.log(`  - Color: ${p1Hex} (expected #ffffff, got ${p1Hex})`);
  console.log(`  - Equalizer: ${results[1].hasEqualizer} (expected false, got ${results[1].hasEqualizer})`);
  console.log(`  - Selected: ${results[1].isSelected}`);

  await page.close();
  browser.disconnect();

  const bugFound = p1Hex === '#1ed760' || results[1].hasEqualizer === true;
  console.log('\n' + '='.repeat(80));
  if (bugFound) {
    console.log('CRITICAL BUG CONFIRMED: Playlist 1 (selected but NOT playing) turned green #1ed760 and showed animated equalizer waves!');
    console.log('Root Cause: DesktopSidebar.tsx lines 205 & 274: `(isSelected && isPlaying && currentTrack !== null)`');
  } else {
    console.log('Bug not reproduced: Playlist 1 remained #ffffff without equalizer.');
  }
  console.log('='.repeat(80));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
