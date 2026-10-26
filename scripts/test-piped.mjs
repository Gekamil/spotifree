async function testPiped() {
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.privacydev.net',
    'https://piped-api.lunar.icu',
    'https://pipedapi.tokhmi.xyz',
    'https://api.piped.projectsegfau.lt',
  ];

  for (const inst of instances) {
    try {
      console.log('Testing instance:', inst);
      const res = await fetch(`${inst}/streams/2_x_xgFuz1o`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Success on', inst);
        console.log('Title:', data.title);
        console.log('Audio streams count:', data.audioStreams?.length);
        if (data.audioStreams?.length > 0) {
          console.log('First audio stream:', {
            url: data.audioStreams[0].url?.slice(0, 80),
            format: data.audioStreams[0].format,
            quality: data.audioStreams[0].quality,
            bitrate: data.audioStreams[0].bitrate,
          });
          return;
        }
      } else {
        console.log('Failed status:', res.status, res.statusText);
      }
    } catch (e) {
      console.log('Error on', inst, e.message);
    }
  }
}

testPiped();
