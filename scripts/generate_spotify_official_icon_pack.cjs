const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.join(__dirname, '../public/alternate-icons');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Spotify 2026 20th Anniversary: Real Disco Ball
// Faceted emerald metallic disco sphere with 3D specular shine and Spotify wave grooves
const discoBallSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Background glow -->
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0a1a0f"/>
      <stop offset="100%" stop-color="#050805"/>
    </radialGradient>

    <!-- Disco sphere base gradient -->
    <radialGradient id="discoBase" cx="35%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#5bfb8a"/>
      <stop offset="25%" stop-color="#1ed760"/>
      <stop offset="60%" stop-color="#0e6b32"/>
      <stop offset="90%" stop-color="#063217"/>
      <stop offset="100%" stop-color="#021409"/>
    </radialGradient>

    <!-- Mirrored facet pattern -->
    <pattern id="facets" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(5)">
      <rect width="22" height="22" fill="#1ed760" fill-opacity="0.35"/>
      <rect x="0" y="0" width="22" height="2" fill="#ffffff" fill-opacity="0.6"/>
      <rect x="0" y="0" width="2" height="22" fill="#ffffff" fill-opacity="0.6"/>
      <rect x="0" y="20" width="22" height="2" fill="#000000" fill-opacity="0.6"/>
      <rect x="20" y="0" width="2" height="22" fill="#000000" fill-opacity="0.6"/>
    </pattern>

    <!-- Clip sphere -->
    <clipPath id="sphereClip">
      <circle cx="256" cy="256" r="236"/>
    </clipPath>
  </defs>

  <!-- Background base -->
  <rect width="512" height="512" rx="112" fill="url(#bgGlow)"/>

  <!-- Disco Sphere -->
  <g clip-path="url(#sphereClip)">
    <circle cx="256" cy="256" r="236" fill="url(#discoBase)"/>
    <rect x="20" y="20" width="472" height="472" fill="url(#facets)" opacity="0.85"/>

    <!-- Specular highlight overlay -->
    <ellipse cx="180" cy="150" rx="140" ry="80" fill="#ffffff" opacity="0.35" transform="rotate(-25 180 150)"/>
    <circle cx="160" cy="130" r="45" fill="#ffffff" opacity="0.65"/>
    <circle cx="340" cy="340" r="25" fill="#ffffff" opacity="0.25"/>
  </g>

  <!-- Spotify Waves in dark metallic embossed chrome -->
  <g transform="translate(16, 8)">
    <path d="M373.78 370.02c-5.12 7.66-14.1 10.24-21.78 5.12-60.16-37.12-135.68-44.82-225.3-24.34-8.92 2.6-16.62-3.82-19.18-11.5-2.56-8.98 3.84-16.64 11.52-19.2 97.28-21.78 181.76-12.8 248.32 28.16 8.96 3.84 10.22 14.06 6.42 21.76zm30.72-70.4c-6.4 8.96-17.92 12.8-26.88 6.4-69.12-42.24-174.08-55.04-254.72-29.44-10.24 2.56-21.76-2.56-24.32-12.8-2.56-10.24 2.56-21.78 12.8-24.34 92.16-28.16 207.36-14.08 286.72 34.56 7.7 3.86 11.52 16.64 6.4 25.62zm2.56-71.68c-82.56-49.28-219.52-53.76-298.24-29.44-12.8 3.82-25.6-3.86-29.44-15.38-3.84-12.8 3.84-25.6 15.36-29.44 90.88-26.88 240.64-21.76 335.36 34.56 11.52 6.4 15.36 21.76 8.96 33.28-6.4 8.98-21.76 12.8-32 6.42z" fill="#041208" opacity="0.92"/>
    <path d="M373.78 372.02c-5.12 7.66-14.1 10.24-21.78 5.12-60.16-37.12-135.68-44.82-225.3-24.34-8.92 2.6-16.62-3.82-19.18-11.5-2.56-8.98 3.84-16.64 11.52-19.2 97.28-21.78 181.76-12.8 248.32 28.16 8.96 3.84 10.22 14.06 6.42 21.76zm30.72-70.4c-6.4 8.96-17.92 12.8-26.88 6.4-69.12-42.24-174.08-55.04-254.72-29.44-10.24 2.56-21.76-2.56-24.32-12.8-2.56-10.24 2.56-21.78 12.8-24.34 92.16-28.16 207.36-14.08 286.72 34.56 7.7 3.86 11.52 16.64 6.4 25.62zm2.56-71.68c-82.56-49.28-219.52-53.76-298.24-29.44-12.8 3.82-25.6-3.86-29.44-15.38-3.84-12.8 3.84-25.6 15.36-29.44 90.88-26.88 240.64-21.76 335.36 34.56 11.52 6.4 15.36 21.76 8.96 33.28-6.4 8.98-21.76 12.8-32 6.42z" fill="#38f77d" opacity="0.4" stroke="#ffffff" stroke-width="1.5"/>
  </g>
</svg>
`;

// 2. Modern Official (2015 - Present): Spotify Neon Green + Black Waves
const modernGreenSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <circle cx="256" cy="256" r="256" fill="#1ED760"/>
  <path d="M373.78 370.02c-5.12 7.66-14.1 10.24-21.78 5.12-60.16-37.12-135.68-44.82-225.3-24.34-8.92 2.6-16.62-3.82-19.18-11.5-2.56-8.98 3.84-16.64 11.52-19.2 97.28-21.78 181.76-12.8 248.32 28.16 8.96 3.84 10.22 14.06 6.42 21.76zm30.72-70.4c-6.4 8.96-17.92 12.8-26.88 6.4-69.12-42.24-174.08-55.04-254.72-29.44-10.24 2.56-21.76-2.56-24.32-12.8-2.56-10.24 2.56-21.78 12.8-24.34 92.16-28.16 207.36-14.08 286.72 34.56 7.7 3.86 11.52 16.64 6.4 25.62zm2.56-71.68c-82.56-49.28-219.52-53.76-298.24-29.44-12.8 3.82-25.6-3.86-29.44-15.38-3.84-12.8 3.84-25.6 15.36-29.44 90.88-26.88 240.64-21.76 335.36 34.56 11.52 6.4 15.36 21.76 8.96 33.28-6.4 8.98-21.76 12.8-32 6.42z" fill="#000000"/>
</svg>
`;

// 3. Classic Mobile (2013 - 2015): Olive/Forest Green + White Waves (Skeuomorphic Touch)
const classicOliveSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <radialGradient id="classicOliveGrad" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#93c90e"/>
      <stop offset="100%" stop-color="#699406"/>
    </radialGradient>
  </defs>
  <circle cx="256" cy="256" r="256" fill="url(#classicOliveGrad)"/>
  <circle cx="256" cy="256" r="252" fill="none" stroke="#567905" stroke-width="5" opacity="0.6"/>
  <path d="M373.78 370.02c-5.12 7.66-14.1 10.24-21.78 5.12-60.16-37.12-135.68-44.82-225.3-24.34-8.92 2.6-16.62-3.82-19.18-11.5-2.56-8.98 3.84-16.64 11.52-19.2 97.28-21.78 181.76-12.8 248.32 28.16 8.96 3.84 10.22 14.06 6.42 21.76zm30.72-70.4c-6.4 8.96-17.92 12.8-26.88 6.4-69.12-42.24-174.08-55.04-254.72-29.44-10.24 2.56-21.76-2.56-24.32-12.8-2.56-10.24 2.56-21.78 12.8-24.34 92.16-28.16 207.36-14.08 286.72 34.56 7.7 3.86 11.52 16.64 6.4 25.62zm2.56-71.68c-82.56-49.28-219.52-53.76-298.24-29.44-12.8 3.82-25.6-3.86-29.44-15.38-3.84-12.8 3.84-25.6 15.36-29.44 90.88-26.88 240.64-21.76 335.36 34.56 11.52 6.4 15.36 21.76 8.96 33.28-6.4 8.98-21.76 12.8-32 6.42z" fill="#FFFFFF"/>
</svg>
`;

// 4. Retro Original (2006 - 2013): Bouncing 'O' Icon on Avocado Green Rounded Square
const retroOriginalSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="retroGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#9dd632"/>
      <stop offset="100%" stop-color="#70a316"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#retroGrad)"/>
  <!-- The iconic bouncing Spotify 'o' with soundwaves above -->
  <g transform="translate(146, 120)">
    <!-- 3 Soundwaves above the O -->
    <path d="M35 55 Q 110 5 185 55" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" fill="none"/>
    <path d="M50 95 Q 110 55 170 95" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round" fill="none"/>
    <path d="M68 135 Q 110 105 152 135" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round" fill="none"/>
    
    <!-- The jumping Spotify 'o' ring -->
    <ellipse cx="110" cy="225" rx="72" ry="78" fill="none" stroke="#FFFFFF" stroke-width="38"/>
  </g>
</svg>
`;

// 5. Official Spotify for Artists: Crisp White Backdrop + Green Emblem
const spotifyArtistsSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="115" fill="#FFFFFF"/>
  <circle cx="256" cy="256" r="256" fill="none"/>
  <g transform="translate(76, 76) scale(0.70)">
    <circle cx="256" cy="256" r="256" fill="#1DB954"/>
    <path d="M373.78 370.02c-5.12 7.66-14.1 10.24-21.78 5.12-60.16-37.12-135.68-44.82-225.3-24.34-8.92 2.6-16.62-3.82-19.18-11.5-2.56-8.98 3.84-16.64 11.52-19.2 97.28-21.78 181.76-12.8 248.32 28.16 8.96 3.84 10.22 14.06 6.42 21.76zm30.72-70.4c-6.4 8.96-17.92 12.8-26.88 6.4-69.12-42.24-174.08-55.04-254.72-29.44-10.24 2.56-21.76-2.56-24.32-12.8-2.56-10.24 2.56-21.78 12.8-24.34 92.16-28.16 207.36-14.08 286.72 34.56 7.7 3.86 11.52 16.64 6.4 25.62zm2.56-71.68c-82.56-49.28-219.52-53.76-298.24-29.44-12.8 3.82-25.6-3.86-29.44-15.38-3.84-12.8 3.84-25.6 15.36-29.44 90.88-26.88 240.64-21.76 335.36 34.56 11.52 6.4 15.36 21.76 8.96 33.28-6.4 8.98-21.76 12.8-32 6.42z" fill="#FFFFFF"/>
  </g>
</svg>
`;

// 6. Official Spotify Android 13+ Themed / Dark Stealth: Matte Charcoal #121212 + Pure White Waves
const spotifyStealthSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <circle cx="256" cy="256" r="256" fill="#121212"/>
  <path d="M373.78 370.02c-5.12 7.66-14.1 10.24-21.78 5.12-60.16-37.12-135.68-44.82-225.3-24.34-8.92 2.6-16.62-3.82-19.18-11.5-2.56-8.98 3.84-16.64 11.52-19.2 97.28-21.78 181.76-12.8 248.32 28.16 8.96 3.84 10.22 14.06 6.42 21.76zm30.72-70.4c-6.4 8.96-17.92 12.8-26.88 6.4-69.12-42.24-174.08-55.04-254.72-29.44-10.24 2.56-21.76-2.56-24.32-12.8-2.56-10.24 2.56-21.78 12.8-24.34 92.16-28.16 207.36-14.08 286.72 34.56 7.7 3.86 11.52 16.64 6.4 25.62zm2.56-71.68c-82.56-49.28-219.52-53.76-298.24-29.44-12.8 3.82-25.6-3.86-29.44-15.38-3.84-12.8 3.84-25.6 15.36-29.44 90.88-26.88 240.64-21.76 335.36 34.56 11.52 6.4 15.36 21.76 8.96 33.28-6.4 8.98-21.76 12.8-32 6.42z" fill="#FFFFFF"/>
</svg>
`;

// 7. Official Spotify for Podcasters (formerly Anchor): Deep Purple + Vibrant Podcasting Isotype
const spotifyPodcastersSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="podGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7214ff"/>
      <stop offset="100%" stop-color="#4600b3"/>
    </linearGradient>
    <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f2fe"/>
      <stop offset="50%" stop-color="#4facfe"/>
      <stop offset="100%" stop-color="#f093fb"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#podGrad)"/>
  <circle cx="256" cy="256" r="140" fill="#200057"/>
  <path d="M373.78 370.02c-5.12 7.66-14.1 10.24-21.78 5.12-60.16-37.12-135.68-44.82-225.3-24.34-8.92 2.6-16.62-3.82-19.18-11.5-2.56-8.98 3.84-16.64 11.52-19.2 97.28-21.78 181.76-12.8 248.32 28.16 8.96 3.84 10.22 14.06 6.42 21.76zm30.72-70.4c-6.4 8.96-17.92 12.8-26.88 6.4-69.12-42.24-174.08-55.04-254.72-29.44-10.24 2.56-21.76-2.56-24.32-12.8-2.56-10.24 2.56-21.78 12.8-24.34 92.16-28.16 207.36-14.08 286.72 34.56 7.7 3.86 11.52 16.64 6.4 25.62zm2.56-71.68c-82.56-49.28-219.52-53.76-298.24-29.44-12.8 3.82-25.6-3.86-29.44-15.38-3.84-12.8 3.84-25.6 15.36-29.44 90.88-26.88 240.64-21.76 335.36 34.56 11.52 6.4 15.36 21.76 8.96 33.28-6.4 8.98-21.76 12.8-32 6.42z" fill="url(#waveGrad)"/>
</svg>
`;

const icons = [
  { id: 'disco-ball', name: 'Spotify 20 Aniversario (Bola de DJ / Discoteca)', year: 'Mayo 2026', svg: discoBallSvg },
  { id: 'modern-green', name: 'Spotify Oficial Moderno (Verde Neón)', year: '2015 - Actualidad', svg: modernGreenSvg },
  { id: 'classic-olive', name: 'Spotify Clásico (Verde Oliva con Ondas Blancas)', year: '2013 - 2015', svg: classicOliveSvg },
  { id: 'retro-original', name: 'Spotify Retro Original (Letra O saltando)', year: '2006 - 2013', svg: retroOriginalSvg },
  { id: 'spotify-artists', name: 'Spotify for Artists Oficial (Blanco y Verde)', year: 'App Oficial', svg: spotifyArtistsSvg },
  { id: 'dark-stealth', name: 'Spotify Stealth / Android Themed (Monocromo)', year: 'Android 13+', svg: spotifyStealthSvg },
  { id: 'podcasters', name: 'Spotify for Podcasters Oficial (Púrpura y Neón)', year: 'App Oficial', svg: spotifyPodcastersSvg },
];

async function run() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  for (const item of icons) {
    const svgPath = path.join(outDir, `${item.id}.svg`);
    const pngPath512 = path.join(outDir, `${item.id}-512.png`);
    const pngPath192 = path.join(outDir, `${item.id}-192.png`);

    fs.writeFileSync(svgPath, item.svg.trim());

    // Render 512
    await page.setViewport({ width: 512, height: 512, deviceScaleFactor: 1 });
    const html512 = `<!DOCTYPE html><html><head><style>body { margin:0; padding:0; overflow:hidden; display:flex; align-items:center; justify-content:center; width:512px; height:512px; background:transparent; }</style></head><body>${item.svg}</body></html>`;
    await page.setContent(html512, { waitUntil: 'load', timeout: 5000 });
    await page.screenshot({ path: pngPath512, omitBackground: true });

    // Render 192
    await page.setViewport({ width: 192, height: 192, deviceScaleFactor: 1 });
    const html192 = `<!DOCTYPE html><html><head><style>body { margin:0; padding:0; overflow:hidden; display:flex; align-items:center; justify-content:center; width:192px; height:192px; background:transparent; }</style></head><body>${item.svg}</body></html>`;
    await page.setContent(html192, { waitUntil: 'load', timeout: 5000 });
    await page.screenshot({ path: pngPath192, omitBackground: true });

    console.log(`Rendered ${item.id} (512x512, 192x192, SVG)`);
  }

  await browser.close();
  console.log('All real Spotify alternate icons rendered!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
