const WebSocket = require('ws');
const http = require('http');

setTimeout(() => {
  http.get('http://127.0.0.1:9222/json', (res) => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      const tabs = JSON.parse(d);
      const tab = tabs.find(t => t.url.includes('spotifreeweb') || t.title.includes('Spotifree'));
      if (!tab) {
        console.log('No tab found');
        process.exit(1);
      }
      console.log('Connecting to tab:', tab.id, tab.url);
      const ws = new WebSocket(tab.webSocketDebuggerUrl);
      ws.on('open', () => {
        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: `(() => {
              const res = {
                title: document.title,
                store: !!window.__usePlayerStore,
                audioEngine: !!window.__audioEngine,
              };
              if (window.__usePlayerStore) {
                const s = window.__usePlayerStore.getState();
                res.shuffleMode = s.shuffleMode;
                res.shuffleVersion = s.shuffleVersion;
                // Test toggleShuffle
                s.toggleShuffle();
                const s2 = window.__usePlayerStore.getState();
                res.afterToggleShuffleMode = s2.shuffleMode;
                res.afterToggleShuffleVersion = s2.shuffleVersion;
              }
              // Check if any "Música y Biblioteca" options are visible
              res.hasMusicaYBiblioteca = document.body.innerText.includes('Música y Biblioteca');
              return res;
            })()`,
            returnByValue: true
          }
        }));
      });
      ws.on('message', (msg) => {
        const parsed = JSON.parse(msg);
        if (parsed.id === 1) {
          console.log('RESULT:', JSON.stringify(parsed.result?.result?.value, null, 2));
          ws.close();
          process.exit(0);
        }
      });
    });
  }).on('error', (err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}, 2500);
