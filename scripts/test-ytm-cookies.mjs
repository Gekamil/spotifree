import puppeteer from 'puppeteer-core';

async function testWithCookies() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const page = (await browser.pages())[0];
  const client = await page.createCDPSession();
  const { cookies } = await client.send('Network.getCookies', {
    urls: ['https://music.youtube.com', 'https://www.youtube.com']
  });
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  console.log('Testing YouTube Music search with user session...');
  const res = await fetch('https://music.youtube.com/youtubei/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20240318.01.00',
          hl: 'es',
          gl: 'ES',
        }
      },
      query: 'La Diabla Xavi'
    })
  });

  const data = await res.json();
  console.log('Search response status:', res.status);
  
  // Try player endpoint with cookies
  const videoId = 'HfzbN5ky5Co';
  const playerRes = await fetch('https://music.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://music.youtube.com/',
      'Origin': 'https://music.youtube.com',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20240318.01.00',
          hl: 'es',
          gl: 'ES',
        }
      },
      videoId: videoId
    })
  });

  const playerData = await playerRes.json();
  console.log('Player status:', playerData.playabilityStatus?.status);
  const formats = playerData.streamingData?.adaptiveFormats || playerData.streamingData?.formats || [];
  const audioFormats = formats.filter(f => f.mimeType?.includes('audio'));
  console.log('Audio formats count:', audioFormats.length);
  const directAudio = audioFormats.find(f => f.url);
  if (directAudio) {
    console.log('DIRECT AUDIO STREAM FOUND:', directAudio.mimeType, 'bitrate:', directAudio.bitrate);
    console.log('URL starts with:', directAudio.url.substring(0, 100));
  } else {
    console.log('Ciphered/signature formats:', audioFormats.map(f => ({ mime: f.mimeType, hasCipher: !!f.signatureCipher })));
  }

  browser.disconnect();
}

testWithCookies().catch(console.error);
