/**
 * Vercel build step (vercel.json buildCommand, after `npm run build`): copies the latest APK
 * from the GitHub release "android-latest" into dist/, so the install page offers it from
 * spotifreeweb.vercel.app/Spotifree.apk. A file on our own domain downloads more reliably on
 * phones than GitHub's redirect to a temporary link, and each Vercel deployment keeps its copy,
 * so a download in progress is never cut when a new APK is published.
 * Writes dist/apk.json ({ updatedAt, size }) so the page can tell whether GitHub has a newer one.
 * Never fails the build: without the copy, the page links to GitHub as before.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = 'Gekamil/spotifree';
const TAG = 'android-latest';
const ASSET = 'Spotifree.apk';
const dist = path.resolve('dist');

async function main() {
  if (!fs.existsSync(dist)) {
    console.log('[apk] dist/ not found, skipping');
    return;
  }
  let updatedAt = null;
  let native = null;
  let url = `https://github.com/${REPO}/releases/download/${TAG}/${ASSET}`;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'spotifree-build' },
    });
    if (r.ok) {
      const rel = await r.json();
      // Last commit that changed the app itself (written by the APK workflow)
      native = (/native:\s*([0-9a-f]{7,40})/i.exec(rel.body || '') || [])[1] || null;
      const a = (rel.assets || []).find((x) => /\.apk$/i.test(x.name));
      if (a) {
        updatedAt = a.updated_at || rel.published_at || null;
        url = a.browser_download_url || url;
      }
    }
  } catch {}

  const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'spotifree-build' } });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // An APK is a zip: "PK\x03\x04"
  if (buf.length < 1024 * 1024 || buf.readUInt32LE(0) !== 0x04034b50) throw new Error('not an APK');
  if (!updatedAt) {
    const lm = res.headers.get('last-modified');
    updatedAt = lm ? new Date(lm).toISOString() : new Date().toISOString();
  }
  fs.writeFileSync(path.join(dist, ASSET), buf);
  fs.writeFileSync(path.join(dist, 'apk.json'), JSON.stringify({ updatedAt, size: buf.length, native }));
  console.log(`[apk] copied ${ASSET} (${(buf.length / 1048576).toFixed(1)} MB, ${updatedAt}, native ${native || '?'})`);
}

main().catch((e) => {
  console.log(`[apk] not copied (${e.message}); the install page will link to GitHub`);
});
