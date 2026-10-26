import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));
  if (spotifyPage) {
    const info = await spotifyPage.evaluate(() => {
      // Find all rows in tracklist
      const rows = Array.from(document.querySelectorAll('div[data-testid="tracklist-row"]'));
      if (rows.length === 0) {
        // try finding all div[role="row"]
        const allRows = Array.from(document.querySelectorAll('div[role="row"]'));
        return {
          tracklistRows: 0,
          allRows: allRows.length,
          sampleRowText: allRows.slice(0, 10).map(r => r.innerText.replace(/\n+/g, ' | '))
        };
      }
      return {
        tracklistRows: rows.length,
        firstRow: rows[0].innerText.replace(/\n+/g, ' | '),
        firstRowHtml: rows[0].outerHTML
      };
    });
    console.log(JSON.stringify(info, null, 2));
  }
  browser.disconnect();
}

main().catch(console.error);
