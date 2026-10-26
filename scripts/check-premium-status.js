import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    const accountDetails = await spotifyPage.evaluate(() => {
      const upgradeBtn = document.querySelector('button[data-testid="upgrade-button"], a[href*="premium"]');
      const allButtons = Array.from(document.querySelectorAll('button, a')).map(el => el.textContent.trim()).filter(t => t.length > 0 && t.length < 40);
      return {
        hasUpgradeButton: !!upgradeBtn,
        upgradeText: upgradeBtn ? upgradeBtn.textContent : null,
        buttons: allButtons.slice(0, 20),
      };
    });
    console.log('Spotify account details:', accountDetails);
  }
  browser.disconnect();
}

main().catch(console.error);
