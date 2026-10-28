import fs from 'node:fs';

async function scanAll() {
  const data = JSON.parse(fs.readFileSync('src/data/liveExtractedSession.json', 'utf8'));
  const urls = new Set();

  function scan(obj) {
    if (!obj) return;
    if (typeof obj === 'string') {
      if (obj.startsWith('http://') || obj.startsWith('https://')) {
        urls.add(obj);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(scan);
    } else if (typeof obj === 'object') {
      Object.values(obj).forEach(scan);
    }
  }

  scan(data);
  console.log(`Checking all ${urls.size} URLs in liveExtractedSession.json...`);

  const results = await Promise.all(
    Array.from(urls).map(async url => {
      try {
        const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
        return { url, ok: res.ok, status: res.status };
      } catch (e) {
        return { url, ok: false, error: e.message };
      }
    })
  );

  const broken = results.filter(r => !r.ok);
  console.log(`Total URLs: ${results.length}, Broken: ${broken.length}`);
  if (broken.length > 0) {
    console.log('Broken:', broken);
  }
}

scanAll().catch(console.error);
