import fs from 'node:fs';

async function checkUrls() {
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
  console.log(`Found ${urls.size} distinct URLs in liveExtractedSession.json. Testing HEAD requests...`);

  const broken = [];
  for (const url of Array.from(urls).slice(0, 50)) {
    try {
      const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) {
        broken.push({ url, status: res.status });
      }
    } catch (e) {
      broken.push({ url, error: e.message });
    }
  }

  console.log(`Tested 50 URLs, broken: ${broken.length}`);
  console.log(JSON.stringify(broken, null, 2));
}

checkUrls().catch(console.error);
