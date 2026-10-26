import puppeteer from 'puppeteer-core';

async function testClickExpand() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];

  console.log('Clicking < button...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Mostrar la vista Sonando"]');
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 1000));

  const result = await page.evaluate(() => {
    const aside = document.querySelector('aside#Desktop_PanelContainer_Id');
    const headerTitle = aside?.querySelector('span.font-bold')?.textContent;
    const lyrics = (aside?.textContent || '').includes('Vista previa de la letra');
    const videos = (aside?.textContent || '').includes('Vídeos musicales relacionados');
    const artist = (aside?.textContent || '').includes('Información sobre el artista');
    const credits = (aside?.textContent || '').includes('Créditos');
    return {
      asidePresent: !!aside,
      headerTitle,
      lyrics,
      videos,
      artist,
      credits
    };
  });
  console.log('Sidebar opened result:', result);
}

testClickExpand().catch(console.error);
