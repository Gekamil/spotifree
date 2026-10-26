import puppeteer from 'puppeteer-core';

async function inspect() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spPage) {
    console.log('No Spotify tab found');
    browser.disconnect();
    return;
  }

  // Go to Spotify home
  if (!spPage.url().includes('open.spotify.com/')) {
    await spPage.goto('https://open.spotify.com/', { waitUntil: 'networkidle2' });
  }

  // 1. Inspect top filter pills on Spotify Home
  const filters = await spPage.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('button, [role="button"], [data-testid="chip"]')).filter(el => {
      const t = el.innerText ? el.innerText.trim() : '';
      return ['Todo', 'Música', 'Pódcasts', 'Audiolibros', 'Siguiendo'].includes(t);
    });
    return chips.map(c => ({
      text: c.innerText ? c.innerText.trim() : '',
      tag: c.tagName,
      className: c.className,
      ariaSelected: c.getAttribute('aria-selected'),
      ariaChecked: c.getAttribute('aria-checked'),
      html: c.outerHTML.slice(0, 400)
    }));
  });
  console.log('1. Spotify Filter Pills:', JSON.stringify(filters, null, 2));

  // 2. Click each pill and see what changes in the feed
  console.log('2. Inspecting filter pill click behavior...');
  const testClick = await spPage.evaluate(async () => {
    const chips = Array.from(document.querySelectorAll('button, [role="button"]')).filter(el => {
      const t = el.innerText ? el.innerText.trim() : '';
      return ['Todo', 'Música', 'Pódcasts', 'Audiolibros'].includes(t);
    });
    const musicaChip = chips.find(c => c.innerText.trim() === 'Música');
    if (musicaChip) {
      musicaChip.click();
      await new Promise(r => setTimeout(r, 800));
      return { clickedMusica: true, newUrl: window.location.href };
    }
    return { clickedMusica: false };
  });
  console.log('Clicked Música result:', testClick);

  // 3. Inspect speaker icon in sidebar when playing
  const sidebarSpeaker = await spPage.evaluate(() => {
    const svgs = Array.from(document.querySelectorAll('nav svg, aside svg, [aria-label*="reproduc"], [data-testid*="speaker"]'));
    return svgs.map(s => ({
      label: s.getAttribute('aria-label') || s.getAttribute('data-encore-id'),
      viewBox: s.getAttribute('viewBox'),
      path: s.querySelector('path')?.getAttribute('d'),
      parentText: s.parentElement?.innerText?.slice(0, 30),
      color: window.getComputedStyle(s).color || window.getComputedStyle(s).fill
    }));
  });
  console.log('3. Sidebar SVG icons:', JSON.stringify(sidebarSpeaker.filter(s => s.path), null, 2));

  // 4. Equalizer in tracklist
  const equalizerBars = await spPage.evaluate(() => {
    const gifOrSvg = Array.from(document.querySelectorAll('img[src*="equaliser"], img[src*="equalizer"], [data-testid*="equalizer"]'));
    return gifOrSvg.map(g => ({
      tag: g.tagName,
      src: g.getAttribute('src'),
      outerHtml: g.outerHTML.slice(0, 400)
    }));
  });
  console.log('4. Equalizer element:', JSON.stringify(equalizerBars, null, 2));

  browser.disconnect();
}

inspect().catch(console.error);
