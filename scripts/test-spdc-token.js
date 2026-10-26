import puppeteer from 'puppeteer-core';

async function testSpDcToken() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  if (!spotifyPage) {
    browser.disconnect();
    return;
  }

  const client = await spotifyPage.target().createCDPSession();
  const { cookies } = await client.send('Network.getCookies');
  const spDc = cookies.find(c => c.name === 'sp_dc')?.value;
  console.log('Got sp_dc:', spDc ? spDc.substring(0, 15) + '...' : null);

  if (spDc) {
    const res = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
      headers: {
        'Cookie': `sp_dc=${spDc}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log('Token response status:', res.status);
    const data = await res.json();
    console.log('Web Access Token data:', {
      clientId: data.clientId,
      accessToken: data.accessToken ? data.accessToken.substring(0, 20) + '...' : null,
      accessTokenExpirationTimestampMs: data.accessTokenExpirationTimestampMs,
      isAnonymous: data.isAnonymous
    });

    if (data.accessToken && !data.isAnonymous) {
      console.log('Testing /v1/me with Web Player Access Token...');
      const meRes = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${data.accessToken}` }
      });
      console.log('API /v1/me status:', meRes.status);
      const meData = await meRes.json();
      console.log('User Profile:', meData.display_name, meData.id, meData.email);

      const plRes = await fetch('https://api.spotify.com/v1/me/playlists?limit=5', {
        headers: { Authorization: `Bearer ${data.accessToken}` }
      });
      console.log('API /v1/me/playlists status:', plRes.status);
      const plData = await plRes.json();
      console.log('User Playlists total:', plData.total, plData.items?.map(p => p.name));
    }
  }

  await client.detach();
  browser.disconnect();
}

testSpDcToken().catch(console.error);
