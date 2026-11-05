const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/B673EC4CBF3185821D879439200B336C');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const store = window.__usePlayerStore ? window.__usePlayerStore.getState() : null;
        let shuffleTest = null;
        if (store) {
          const initMode = store.shuffleMode;
          const initVer = store.shuffleVersion;
          store.toggleShuffle();
          const nextStore = window.__usePlayerStore.getState();
          shuffleTest = {
            initMode,
            initVer,
            afterMode: nextStore.shuffleMode,
            afterVer: nextStore.shuffleVersion
          };
        }
        return {
          title: document.title,
          storeAvailable: !!store,
          shuffleTest,
          hasMusicaYBiblioteca: document.body.innerText.includes('Música y Biblioteca')
        };
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
