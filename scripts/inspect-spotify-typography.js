import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('spotify.com'));

  const styles = await spotifyPage.evaluate(() => {
    // Look for element containing "Canciones que te gustan" or any playlist
    const all = Array.from(document.querySelectorAll('*'));
    const liked = all.find(el => el.children.length === 0 && el.textContent.includes('Canciones que te gustan'));
    if (!liked) return 'Not found';
    
    const comp = window.getComputedStyle(liked);
    const parentComp = liked.parentElement ? window.getComputedStyle(liked.parentElement) : null;
    
    // Also find subtitle (pin / Lista • 23 canciones)
    const sub = all.find(el => el.children.length === 0 && el.textContent.includes('canciones'));
    const subComp = sub ? window.getComputedStyle(sub) : null;

    return {
      title: {
        text: liked.textContent,
        fontFamily: comp.fontFamily,
        fontSize: comp.fontSize,
        fontWeight: comp.fontWeight,
        lineHeight: comp.lineHeight,
        letterSpacing: comp.letterSpacing,
        color: comp.color,
      },
      subtitle: sub ? {
        text: sub.textContent,
        fontFamily: subComp.fontFamily,
        fontSize: subComp.fontSize,
        fontWeight: subComp.fontWeight,
        lineHeight: subComp.lineHeight,
        color: subComp.color,
      } : null
    };
  });

  console.log('Real Spotify Exact Typography:', JSON.stringify(styles, null, 2));
  browser.disconnect();
}

main().catch(console.error);
