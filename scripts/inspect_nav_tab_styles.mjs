import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();
  await page.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
  );

  await page.goto('https://open.spotify.com/intl-es/', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));

  const tabItemStyles = await page.evaluate(() => {
    const parentContainer = document.querySelector('[data-testid="bottom-tab-navigation"]')?.parentElement;
    const nav = document.querySelector('[data-testid="bottom-tab-navigation"]');
    const items = Array.from(document.querySelectorAll('[data-testid="bottom-tab-navigation"] a, [data-testid="bottom-tab-navigation"] button'));
    
    return {
      parentFixedStyles: parentContainer ? {
        position: window.getComputedStyle(parentContainer).position,
        bottom: window.getComputedStyle(parentContainer).bottom,
        left: window.getComputedStyle(parentContainer).left,
        right: window.getComputedStyle(parentContainer).right,
        height: window.getComputedStyle(parentContainer).height,
        backgroundImage: window.getComputedStyle(parentContainer).backgroundImage,
        backgroundColor: window.getComputedStyle(parentContainer).backgroundColor,
        backdropFilter: window.getComputedStyle(parentContainer).backdropFilter,
        zIndex: window.getComputedStyle(parentContainer).zIndex,
        padding: window.getComputedStyle(parentContainer).padding,
      } : null,
      navStyles: nav ? {
        display: window.getComputedStyle(nav).display,
        justifyContent: window.getComputedStyle(nav).justifyContent,
        alignItems: window.getComputedStyle(nav).alignItems,
        height: window.getComputedStyle(nav).height,
        padding: window.getComputedStyle(nav).padding,
      } : null,
      items: items.map(it => ({
        tag: it.tagName,
        text: it.textContent?.trim(),
        color: window.getComputedStyle(it).color,
        fontSize: window.getComputedStyle(it).fontSize,
        fontWeight: window.getComputedStyle(it).fontWeight,
        fontFamily: window.getComputedStyle(it).fontFamily,
        display: window.getComputedStyle(it).display,
        flexDirection: window.getComputedStyle(it).flexDirection,
        alignItems: window.getComputedStyle(it).alignItems,
        justifyContent: window.getComputedStyle(it).justifyContent,
        gap: window.getComputedStyle(it).gap,
      }))
    };
  });

  console.log('Tab Item Styles:', JSON.stringify(tabItemStyles, null, 2));

  await page.close();
  browser.disconnect();
}

main().catch(console.error);
