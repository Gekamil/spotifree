import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    // Execute fetch inside spotifyPage context so all cookies (sp_dc, sp_key) are sent automatically!
    const tokenResult = await spotifyPage.evaluate(async () => {
      try {
        const res = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player');
        if (!res.ok) {
          return { error: 'Status: ' + res.status + ' ' + res.statusText };
        }
        const data = await res.json();
        return {
          success: true,
          clientId: data.clientId,
          accessToken: data.accessToken,
          accessTokenExpirationTimestampMs: data.accessTokenExpirationTimestampMs,
          isAnonymous: data.isAnonymous,
        };
      } catch (err) {
        return { error: err.message };
      }
    });

    console.log('Token result:', {
      success: tokenResult.success,
      clientId: tokenResult.clientId,
      hasToken: !!tokenResult.accessToken,
      isAnonymous: tokenResult.isAnonymous,
      tokenPreview: tokenResult.accessToken ? tokenResult.accessToken.slice(0, 25) + '...' : null,
      error: tokenResult.error
    });

    // If we have token, test fetching user profile directly from api.spotify.com
    if (tokenResult.accessToken) {
      const profile = await spotifyPage.evaluate(async (token) => {
        try {
          const res = await fetch('https://api.spotify.com/v1/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          return await res.json();
        } catch (e) {
          return { error: e.message };
        }
      }, tokenResult.accessToken);

      console.log('User profile:', profile);

      // Fetch user playlists!
      const userPlaylists = await spotifyPage.evaluate(async (token) => {
        try {
          const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
            headers: { Authorization: `Bearer ${token}` }
          });
          return await res.json();
        } catch (e) {
          return { error: e.message };
        }
      }, tokenResult.accessToken);

      console.log('Playlists count:', userPlaylists.items?.length);
      console.log('First 5 playlists:', userPlaylists.items?.slice(0, 5).map(p => ({ id: p.id, name: p.name, tracks: p.tracks?.total })));
    }
  }
  browser.disconnect();
}
run().catch(console.error);
