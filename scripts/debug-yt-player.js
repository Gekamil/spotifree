import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2' });

  // Create a visible button and a player
  await page.evaluate(() => {
    const div = document.createElement('div');
    div.id = 'test-yt-container';
    div.style.cssText = 'position:fixed;top:10px;right:10px;width:240px;height:180px;z-index:9999;background:black;';
    
    const btn = document.createElement('button');
    btn.id = 'trigger-play-btn';
    btn.textContent = 'PLAY TEST';
    btn.style.cssText = 'padding:10px;background:green;color:white;';
    
    const playerDiv = document.createElement('div');
    playerDiv.id = 'test-player';

    div.appendChild(btn);
    div.appendChild(playerDiv);
    document.body.appendChild(div);

    (window).testYTPlayer = new (window).YT.Player('test-player', {
      height: '140',
      width: '240',
      videoId: '9LxMLbdForI',
      playerVars: { playsinline: 1 },
      events: {
        onReady: () => {
          console.log('Player is ready!');
        },
        onStateChange: (e) => {
          console.log('State:', e.data);
        }
      }
    });

    btn.onclick = () => {
      (window).testYTPlayer.playVideo();
    };
  });

  await new Promise(r => setTimeout(r, 2000));

  // Click the button using puppeteer user click!
  await page.click('#trigger-play-btn');
  console.log('Clicked #trigger-play-btn with real user mouse click');

  await new Promise(r => setTimeout(r, 3500));

  const state = await page.evaluate(() => {
    const p = (window).testYTPlayer;
    return {
      state: p?.getPlayerState(),
      curTime: p?.getCurrentTime(),
      dur: p?.getDuration()
    };
  });

  console.log('Player playback state after user click:', state);

  await page.close();
  browser.disconnect();
}

main().catch(console.error);
