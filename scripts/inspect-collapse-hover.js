import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));

  const cssInfo = await spotifyPage.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="Contraer Tu biblioteca"]');
    const span = btn?.querySelector('span');
    
    // Get all matched CSS rules
    const getRules = (el) => {
      const sheets = Array.from(document.styleSheets);
      const matched = [];
      for (const sheet of sheets) {
        try {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule.selectorText && el.matches(rule.selectorText)) {
              matched.push({ selector: rule.selectorText, cssText: rule.cssText });
            }
          }
        } catch (e) {}
      }
      return matched;
    };

    return {
      btnRules: btn ? getRules(btn) : [],
      spanRules: span ? getRules(span) : [],
      initialSpanStyle: span ? {
        opacity: window.getComputedStyle(span).opacity,
        transform: window.getComputedStyle(span).transform,
        width: window.getComputedStyle(span).width,
        transition: window.getComputedStyle(span).transition,
      } : null
    };
  });

  console.log('CSS Rules for collapse icon:', JSON.stringify(cssInfo, null, 2));

  // Now hover over the button and check computed styles
  await spotifyPage.hover('button[aria-label*="Contraer Tu biblioteca"]');
  await new Promise(r => setTimeout(r, 200));

  const hoveredInfo = await spotifyPage.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="Contraer Tu biblioteca"]');
    const span = btn?.querySelector('span');
    return {
      hoveredSpanStyle: span ? {
        opacity: window.getComputedStyle(span).opacity,
        transform: window.getComputedStyle(span).transform,
        width: window.getComputedStyle(span).width,
        transition: window.getComputedStyle(span).transition,
      } : null
    };
  });

  console.log('Hovered styles:', JSON.stringify(hoveredInfo, null, 2));

  browser.disconnect();
}

main().catch(console.error);
