import puppeteer from 'puppeteer-core';

async function testSearchEmbeddable() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages()).find(p => p.url().includes('5173'));
  
  // Search YouTube for multiple video options for "Romeo Santos Necio"
  const queries = [
    'Romeo Santos Necio audio',
    'Romeo Santos Necio lyrics',
    'Romeo Santos Necio letra',
    'La Diabla Xavi audio',
    'La Diabla Xavi letra'
  ];

  for (const q of queries) {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    const html = await res.text();
    const ids = Array.from(html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)).map(m => m[1]);
    const uniqueIds = [...new Set(ids)].slice(0, 3);
    console.log(`Query "${q}" found video IDs:`, uniqueIds);

    // Test each ID in the browser iframe
    for (const vid of uniqueIds) {
      const testResult = await page.evaluate(async (vId) => {
        return new Promise((resolve) => {
          let container = document.getElementById('test-audio-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'test-audio-container';
            container.style.cssText = 'position:fixed;bottom:-999px;left:-999px;width:1px;height:1px;opacity:0.01;pointer-events:none;';
            document.body.appendChild(container);
          }
          container.innerHTML = '<div id="test-yt-v2"></div>';

          const player = new window.YT.Player('test-yt-v2', {
            height: '1',
            width: '1',
            videoId: vId,
            playerVars: { autoplay: 1, controls: 0 },
            events: {
              onReady: (e) => {
                e.target.setVolume(100);
                e.target.playVideo();
                setTimeout(() => {
                  const state = e.target.getPlayerState();
                  resolve({ success: true, vId, state, duration: e.target.getDuration() });
                }, 1500);
              },
              onError: (err) => {
                resolve({ error: err.data, vId });
              }
            }
          });
        });
      }, vid);
      console.log(`  -> Video ${vid}:`, testResult);
      if (testResult.success && testResult.state === 1) {
        console.log(`  ===> PLAYING SUCCESSFULLY: ${vid} with duration ${testResult.duration}s`);
        break;
      }
    }
  }

  browser.disconnect();
}

testSearchEmbeddable().catch(console.error);
