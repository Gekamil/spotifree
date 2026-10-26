import https from 'node:https';

async function testAndroidInnertube() {
  const videoId = '2_x_xgFuz1o';
  const postData = JSON.stringify({
    context: {
      client: {
        clientName: 'ANDROID_MUSIC',
        clientVersion: '6.43.52',
        androidSdkVersion: 34,
        hl: 'es',
        gl: 'ES',
      },
    },
    videoId,
  });

  const options = {
    hostname: 'music.youtube.com',
    port: 443,
    path: '/youtubei/v1/player',
    method: 'POST',
    family: 4,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'User-Agent': 'com.google.android.apps.youtube.music/6.43.52 (Linux; U; Android 14; US)',
    },
  };

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
      const data = JSON.parse(body);
      console.log('Playability:', data.playabilityStatus?.status);
      const formats = data.streamingData?.adaptiveFormats || [];
      const audio = formats.filter(f => f.mimeType?.startsWith('audio/'));
      console.log('Audio formats:', audio.length);
      for (const f of audio.slice(0, 3)) {
        console.log({
          itag: f.itag,
          mimeType: f.mimeType,
          bitrate: f.bitrate,
          hasDirectUrl: !!f.url,
          urlSample: f.url ? f.url.slice(0, 60) : 'none',
        });
      }
    });
  });

  req.on('error', (e) => console.error(e));
  req.write(postData);
  req.end();
}

testAndroidInnertube();
