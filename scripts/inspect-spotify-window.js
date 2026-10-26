import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const webPlayerInfo = await spotifyPage.evaluate(() => {
      // Find token in session storage or Redux/React internal state
      const scripts = Array.from(document.querySelectorAll('script')).map(s => s.id || s.src).filter(Boolean);
      
      // Look for session data in window
      const winKeys = Object.keys(window).filter(k => 
        k.toLowerCase().includes('spotify') || 
        k.toLowerCase().includes('session') || 
        k.toLowerCase().includes('token') ||
        k.toLowerCase().includes('auth')
      );

      // Check session storage
      const ssKeys = Object.keys(sessionStorage);

      return {
        scripts,
        winKeys,
        ssKeys,
      };
    });

    console.log(JSON.stringify(webPlayerInfo, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
