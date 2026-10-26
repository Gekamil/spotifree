import puppeteer from 'puppeteer-core';

async function extractPreferencesDOM() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const spPage = (await browser.pages()).find(p => p.url().includes('preferences'));
  if (!spPage) {
    console.log('No preferences tab found');
    browser.disconnect();
    return;
  }

  const data = await spPage.evaluate(() => {
    // Extract main sections and content
    const main = document.querySelector('main');
    if (!main) return null;

    const sections = [];
    const headings = main.querySelectorAll('h2, h3, [role="heading"]');
    headings.forEach(h => {
      const sectionEl = h.closest('section') || h.parentElement;
      sections.push({
        heading: h.innerText.trim(),
        text: sectionEl ? sectionEl.innerText.trim() : '',
        html: sectionEl ? sectionEl.innerHTML : '',
      });
    });

    return {
      title: main.querySelector('h1')?.innerText,
      sectionsCount: sections.length,
      sections: sections.map(s => ({ heading: s.heading, text: s.text.substring(0, 300) })),
      fullText: main.innerText,
    };
  });

  console.log('Spotify Preferences Data:', JSON.stringify(data, null, 2));
  browser.disconnect();
}

extractPreferencesDOM().catch(console.error);
