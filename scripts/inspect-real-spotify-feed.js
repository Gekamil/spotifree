import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (spotifyPage) {
    if (!spotifyPage.url().endsWith('open.spotify.com/') && !spotifyPage.url().endsWith('open.spotify.com')) {
      await spotifyPage.goto('https://open.spotify.com/');
      await new Promise(r => setTimeout(r, 2000));
    }

    const feedData = await spotifyPage.evaluate(() => {
      const sections = Array.from(document.querySelectorAll('section'));
      return sections.map((sec, secIdx) => {
        const titleEl = sec.querySelector('h2, [data-encore-id="text"]');
        const title = titleEl ? titleEl.textContent.trim() : null;
        const subtitleEl = sec.querySelector('p');
        const subtitle = subtitleEl ? subtitleEl.textContent.trim() : null;

        // Cards inside this section
        const cards = [];
        const cardContainers = Array.from(sec.querySelectorAll('[role="group"], [data-testid="card-click-handler"], [data-encore-id="card"]'));

        for (const card of cardContainers) {
          const title = card.querySelector('a[href*="/playlist/"], a[href*="/album/"], a[href*="/artist/"], [data-encore-id="text"]:first-child')?.textContent?.trim();
          const subtitle = card.querySelector('p, span[data-encore-id="text"]:last-child')?.textContent?.trim();
          const img = card.querySelector('img')?.src;
          const video = card.querySelector('video')?.src;
          const link = card.querySelector('a')?.getAttribute('href');

          // Check if it's a radio card or badge
          const radioBadge = card.querySelector('[data-encore-id="text"]')?.textContent?.includes('RADIO');

          if (title || img) {
            cards.push({ title, subtitle, img, video, link, isRadio: !!radioBadge });
          }
        }

        return { sectionIndex: secIdx, title, subtitle, cardCount: cards.length, cards: cards.slice(0, 10) };
      }).filter(s => s.title && s.cardCount > 0);
    });

    console.log('Real sections extracted from active Spotify tab:');
    for (const s of feedData) {
      console.log(`\n=== [${s.title}] (${s.cardCount} cards) ===`);
      if (s.subtitle) console.log(`   Subtitle: ${s.subtitle}`);
      for (const c of s.cards.slice(0, 5)) {
        console.log(`   - ${c.title} | ${c.subtitle} | img: ${!!c.img} | video: ${!!c.video} | link: ${c.link}`);
      }
    }
  }
  browser.disconnect();
}

main().catch(console.error);
