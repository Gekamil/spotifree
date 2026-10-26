import puppeteer from 'puppeteer-core';

async function testBrowserAudio() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifreePage = pages.find(p => p.url().includes('5173'));
  if (!spotifreePage) {
    console.log('Spotifree page not found');
    browser.disconnect();
    return;
  }

  console.log('Injecting test YouTube IFrame into Spotifree page...');
  const res = await spotifreePage.evaluate(async () => {
    return new Promise((resolve) => {
      // Load YouTube IFrame API
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      const checkYT = () => {
        if (window.YT && window.YT.Player) {
          let container = document.getElementById('test-audio-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'test-audio-container';
            container.style.cssText = 'position:fixed;bottom:-999px;left:-999px;width:1px;height:1px;opacity:0.01;pointer-events:none;';
            document.body.appendChild(container);
          }
          container.innerHTML = '<div id="test-yt-frame"></div>';

          const player = new window.YT.Player('test-yt-frame', {
            height: '1',
            width: '1',
            videoId: 'Zn37zIBGv5M', // Romeo Santos
            playerVars: {
              autoplay: 1,
              controls: 0,
              disablekb: 1,
              playsinline: 1,
            },
            events: {
              onReady: (e) => {
                e.target.setVolume(100);
                e.target.playVideo();
                setTimeout(() => {
                  const state = e.target.getPlayerState();
                  const time = e.target.getCurrentTime();
                  resolve({ success: true, state, time, duration: e.target.getDuration() });
                }, 2500);
              },
              onError: (err) => {
                resolve({ error: err.data });
              }
            }
          });
        } else {
          setTimeout(checkYT, 200);
        }
      };
      checkYT();
    });
  });

  console.log('Browser audio test result:', res);
  browser.disconnect();
}

testBrowserAudio().catch(console.error);
