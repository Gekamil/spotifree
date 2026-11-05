const http = require('http');
const WebSocket = require('ws');

async function run() {
  const tabs = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const spotifreeTab = tabs.find(t => t.url.includes('spotifree'));
  if (!spotifreeTab) {
    console.error('No spotifree tab found');
    return;
  }

  const ws = new WebSocket(spotifreeTab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.on('open', resolve));

  let reqId = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = reqId++;
      const handler = (msg) => {
        const parsed = JSON.parse(msg);
        if (parsed.id === id) {
          ws.off('message', handler);
          resolve(parsed.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  console.log('Reloading page...');
  await send('Page.reload');
  await new Promise(r => setTimeout(r, 4000));

  console.log('Evaluating session host UI and shuffle...');
  const testRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const results = {};
      
      // 1. Check shuffleMode & toggleShuffle
      const pStore = window.__usePlayerStore ? window.__usePlayerStore.getState() : null;
      if (pStore) {
        results.initialShuffleMode = pStore.shuffleMode;
        results.initialShuffleVersion = pStore.shuffleVersion;
        
        // Call toggleShuffle
        window.__usePlayerStore.getState().toggleShuffle();
        const nextState = window.__usePlayerStore.getState();
        results.afterToggleMode = nextState.shuffleMode;
        results.afterToggleVersion = nextState.shuffleVersion;
      }
      
      // 2. Check DOM for 'Música y Biblioteca' buttons
      const bodyText = document.body.innerText;
      results.hasMusicaYBiblioteca = bodyText.includes('Música y Biblioteca');
      
      // Look for session host elements
      const hostCards = Array.from(document.querySelectorAll('*')).filter(el => 
        el.textContent && el.textContent.includes('Eres el anfitrión de la sesión')
      );
      results.hasHostBanner = hostCards.length > 0;

      return results;
    })()`,
    returnByValue: true
  });

  console.log('Audit results:', JSON.stringify(testRes.result?.value, null, 2));
  ws.close();
}

run().catch(console.error);
