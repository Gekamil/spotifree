import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('spotify.com'));

  const headerElements = await page.evaluate(() => {
    // Find all interactive elements with y < 64
    const all = Array.from(document.querySelectorAll('button, a, input, [role="button"]'));
    const topElements = all.filter(el => {
      const r = el.getBoundingClientRect();
      return r.y >= 0 && r.y < 64 && r.width > 0 && r.height > 0;
    }).sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x);

    return topElements.map(el => {
      const r = el.getBoundingClientRect();
      const s = window.getComputedStyle(el);
      const svg = el.querySelector('svg');
      return {
        tag: el.tagName,
        text: el.innerText.trim().replace(/\n+/g, ' '),
        ariaLabel: el.getAttribute('aria-label') || el.title || el.placeholder || '',
        testId: el.getAttribute('data-testid') || '',
        rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
        css: {
          backgroundColor: s.backgroundColor,
          color: s.color,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          borderRadius: s.borderRadius,
          padding: s.padding,
          margin: s.margin,
          gap: s.gap
        },
        svg: svg ? {
          viewBox: svg.getAttribute('viewBox'),
          width: svg.getAttribute('width') || svg.clientWidth,
          height: svg.getAttribute('height') || svg.clientHeight,
          fill: svg.getAttribute('fill') || window.getComputedStyle(svg).fill,
          paths: Array.from(svg.querySelectorAll('path')).map(p => p.getAttribute('d'))
        } : null
      };
    });
  });

  console.log('ALL TOP BAR ELEMENTS (LEFT TO RIGHT):');
  console.log(JSON.stringify(headerElements, null, 2));

  browser.disconnect();
}

run().catch(console.error);
