import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  );

  await page.goto('https://open.spotify.com/intl-es/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const pageStructure = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, [role="heading"]')).map(h => ({
      tag: h.tagName,
      text: h.textContent?.trim(),
      className: h.className
    }));

    const bottomTabs = document.querySelector('[data-testid="bottom-tab-navigation"]');
    const bottomTabHtml = bottomTabs ? bottomTabs.outerHTML : null;
    const bottomTabComputed = bottomTabs ? {
      height: window.getComputedStyle(bottomTabs).height,
      background: window.getComputedStyle(bottomTabs).background,
      backgroundColor: window.getComputedStyle(bottomTabs).backgroundColor,
      backgroundImage: window.getComputedStyle(bottomTabs).backgroundImage,
      backdropFilter: window.getComputedStyle(bottomTabs).backdropFilter,
      borderTop: window.getComputedStyle(bottomTabs).borderTop,
      position: window.getComputedStyle(bottomTabs).position,
      bottom: window.getComputedStyle(bottomTabs).bottom,
      zIndex: window.getComputedStyle(bottomTabs).zIndex,
    } : null;

    const topBar = document.querySelector('header, [data-testid="top-bar"], .main-topBar-container, [data-testid="mobile-header"]');
    const topBarHtml = topBar ? topBar.outerHTML : null;

    // What cards or shelves are rendered on the mobile feed?
    const shelfTitles = Array.from(document.querySelectorAll('section, [data-testid="component-shelf"]')).map(s => {
      const title = s.querySelector('h2, h3, [role="heading"]')?.textContent?.trim();
      const cardCount = s.querySelectorAll('[role="gridcell"], [data-testid="card"], a[draggable="false"]').length;
      return { title, cardCount };
    });

    return {
      title: document.title,
      headings,
      bottomTabHtml,
      bottomTabComputed,
      topBarHtml,
      shelfTitles
    };
  });

  console.log('Page Structure:', JSON.stringify(pageStructure, null, 2));

  await page.close();
  browser.disconnect();
}

main().catch(console.error);
