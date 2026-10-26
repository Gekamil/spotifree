import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));

  const navHtml = await spotifyPage.evaluate(() => {
    const nav = document.querySelector('nav.BRNnyWqRD_oqVmH2UTfX') ||
                document.querySelector('nav');
    if (!nav) return 'No nav found';

    // Does nav contain the sidebar items or is the sidebar in a sibling div?
    const parent = nav.parentElement;
    const parentChildren = Array.from(parent ? parent.children : []).map(c => ({
      tag: c.tagName,
      className: c.className,
      textPreview: c.innerText?.slice(0, 100)
    }));

    // Find any element containing "Canciones que te gustan"
    const liked = Array.from(document.querySelectorAll('*')).find(
      el => el.textContent === 'Canciones que te gustan'
    );
    let likedChain = [];
    let curr = liked;
    while (curr && curr !== document.body) {
      likedChain.push({
        tag: curr.tagName,
        className: curr.className,
        id: curr.id,
        role: curr.getAttribute('role')
      });
      curr = curr.parentElement;
    }

    return {
      navClass: nav.className,
      parentChildren,
      likedChain: likedChain.slice(0, 8)
    };
  });

  console.log(JSON.stringify(navHtml, null, 2));
  browser.disconnect();
}

main().catch(console.error);
