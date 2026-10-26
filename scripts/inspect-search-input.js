import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const inputStyle = await spotifyPage.evaluate(() => {
      const input = document.querySelector('input[data-encore-id="formInput"], input[placeholder*="reproducir"], input[type="text"]');
      if (!input) return 'Input not found';
      const cs = window.getComputedStyle(input);
      const parent = input.parentElement;
      const pcs = window.getComputedStyle(parent);
      return {
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        color: cs.color,
        letterSpacing: cs.letterSpacing,
        padding: cs.padding,
        height: cs.height,
        parentHeight: pcs.height,
        parentPadding: pcs.padding,
        parentAlignItems: pcs.alignItems,
        placeholder: input.getAttribute('placeholder')
      };
    });
    console.log(JSON.stringify(inputStyle, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
