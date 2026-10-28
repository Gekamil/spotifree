import http from 'http';
import WebSocket from 'ws';

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', (c) => (data += c));
  res.on('end', () => {
    const tabs = JSON.parse(data);
    const spotify = tabs.find((t) => t.url.includes('spotify.com'));
    const ws = new WebSocket(spotify.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: `(() => {
              const topContainer = document.querySelector('.globalNav, [data-testid="global-nav"]') || document.querySelector('header');
              const links = Array.from(document.querySelectorAll('a, button')).filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.top >= 0 && rect.top <= 64;
              }).map(el => ({
                tag: el.tagName,
                aria: el.getAttribute('aria-label'),
                text: el.innerText.trim(),
                href: el.getAttribute('href'),
                top: Math.round(el.getBoundingClientRect().top),
                left: Math.round(el.getBoundingClientRect().left),
              }));
              return { links };
            })()`,
            returnByValue: true,
          },
        })
      );
    });
    ws.on('message', (m) => {
      console.log(JSON.stringify(JSON.parse(m).result?.result?.value, null, 2));
      process.exit(0);
    });
  });
});
