import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    let capturedAuthHeader = null;
    let capturedRequests = [];

    const onRequest = (req) => {
      const headers = req.headers();
      if (headers['authorization']) {
        capturedAuthHeader = headers['authorization'];
        capturedRequests.push({
          url: req.url(),
          auth: headers['authorization'].slice(0, 30) + '...',
        });
      }
    };

    spotifyPage.on('request', onRequest);

    // Reload spotify page to catch initial authorized requests
    await spotifyPage.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 2000));

    spotifyPage.off('request', onRequest);

    console.log('Captured Auth Header:', capturedAuthHeader ? (capturedAuthHeader.slice(0, 35) + '... (len: ' + capturedAuthHeader.length + ')') : 'NONE');
    console.log('Sample Requests:', capturedRequests.slice(0, 5));

    if (capturedAuthHeader) {
      // Test fetching user data with this captured token!
      const profileRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: capturedAuthHeader }
      });
      const profile = await profileRes.json();
      console.log('Profile via Captured Token:', profile);
    }
  }
  browser.disconnect();
}
run().catch(console.error);
