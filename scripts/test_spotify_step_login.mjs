import puppeteer from 'puppeteer-core';

async function testStep() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('spotify.com') && (url.includes('password') || url.includes('login') || url.includes('challenge') || url.includes('identifier') || url.includes('client_token'))) {
      console.log('RESPONSE:', res.status(), url);
      try {
        const text = await res.text();
        console.log('BODY:', text.slice(0, 300));
      } catch {}
    }
  });

  await page.goto('https://accounts.spotify.com/es/login', { waitUntil: 'networkidle2' });
  await page.type('#username', 'testemailspotifree@gmail.com');
  await page.click('button[data-testid="login-button"]');
  await new Promise(r => setTimeout(r, 3000));

  const inputsAfter = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      id: i.id,
      name: i.name,
      type: i.type,
      placeholder: i.placeholder,
      'data-testid': i.getAttribute('data-testid')
    }));
  });
  console.log('Inputs after Continue:', inputsAfter);

  await browser.close();
}

testStep().catch(console.error);
