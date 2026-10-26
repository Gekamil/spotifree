import puppeteer from 'puppeteer-core';

async function checkCookies() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];
  const client = await page.createCDPSession();
  const { cookies } = await client.send('Network.getCookies', {
    urls: ['https://music.youtube.com', 'https://www.youtube.com', 'https://open.spotify.com']
  });
  console.log('Total cookies found:', cookies.length);
  const ytCookies = cookies.filter(c => c.domain.includes('youtube'));
  console.log('YouTube cookies count:', ytCookies.map(c => c.name));
  browser.disconnect();
}

checkCookies().catch(console.error);
