async function testClients(videoId) {
  const clients = [
    {
      name: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
      client: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'es',
        gl: 'ES'
      }
    },
    {
      name: 'IOS',
      client: {
        clientName: 'IOS',
        clientVersion: '19.29.1',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        hl: 'es',
        gl: 'ES'
      }
    },
    {
      name: 'ANDROID_TESTSUITE',
      client: {
        clientName: 'ANDROID_TESTSUITE',
        clientVersion: '1.9',
        hl: 'es',
        gl: 'ES'
      }
    }
  ];

  for (const c of clients) {
    console.log(`\n--- Testing ${c.name} ---`);
    try {
      const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        },
        body: JSON.stringify({
          context: { client: c.client },
          videoId: videoId
        })
      });
      const data = await res.json();
      console.log('Status:', data.playabilityStatus?.status);
      const formats = data.streamingData?.adaptiveFormats || [];
      const audioFormats = formats.filter(f => f.mimeType?.includes('audio'));
      console.log('Audio formats:', audioFormats.length);
      const urlFormat = audioFormats.find(f => f.url);
      if (urlFormat) {
        console.log('SUCCESS! Direct unenciphered stream found:', urlFormat.mimeType, 'bitrate:', urlFormat.bitrate);
        console.log('Stream URL prefix:', urlFormat.url.substring(0, 70));
        return { success: true, url: urlFormat.url };
      }
    } catch (e) {
      console.log('Error:', e.message);
    }
  }
}

testClients('Zn37zIBGv5M').catch(console.error);
