import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const captured = [];

    const onResponse = async (response) => {
      const url = response.url();
      if (url.includes('pathfinder/v2/query') || url.includes('spclient.spotify.com')) {
        try {
          const req = response.request();
          const postData = req.postData();
          let parsedPost = null;
          try { parsedPost = JSON.parse(postData); } catch(e) { parsedPost = postData; }
          
          let resJson = null;
          try { resJson = await response.json(); } catch(e) {}

          captured.push({
            url,
            operationName: parsedPost?.operationName,
            variables: parsedPost?.variables,
            responsePreview: resJson ? Object.keys(resJson?.data || {}) : null,
            data: resJson?.data,
          });
        } catch (e) {}
      }
    };

    spotifyPage.on('response', onResponse);

    // Scroll down and reload to capture home & library data
    await spotifyPage.reload({ waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 3000));

    spotifyPage.off('response', onResponse);

    const artifactDir = 'C:\\Users\\jorge\\.gemini\\antigravity\\brain\\b7d3ec29-c076-4935-90b5-23f42c286313';
    fs.writeFileSync(path.join(artifactDir, 'captured-spotify-queries.json'), JSON.stringify(captured, null, 2));
    console.log(`Captured ${captured.length} Pathfinder queries/responses!`);
    
    // Print operation names captured
    console.log('Operations:', captured.map(c => c.operationName).filter(Boolean));
  }
  browser.disconnect();
}
run().catch(console.error);
