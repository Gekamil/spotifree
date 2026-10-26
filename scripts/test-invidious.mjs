async function testInvidious() {
  const instances = [
    'https://invidious.nerdvpn.de',
    'https://inv.nadeko.net',
    'https://invidious.projectsegfau.lt',
    'https://yewtu.be',
    'https://invidious.flokinet.to',
  ];

  for (const inst of instances) {
    try {
      console.log('Testing instance:', inst);
      const res = await fetch(`${inst}/api/v1/videos/2_x_xgFuz1o`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Success on', inst);
        console.log('Title:', data.title);
        console.log('Adaptive formats count:', data.adaptiveFormats?.length);
        const audio = data.adaptiveFormats?.filter(f => f.type?.includes('audio')) || [];
        console.log('Audio count:', audio.length);
        if (audio.length > 0) {
          console.log('Audio sample:', {
            url: audio[0].url?.slice(0, 80),
            type: audio[0].type,
            bitrate: audio[0].bitrate,
          });
          return;
        }
      } else {
        console.log('Failed status:', res.status);
      }
    } catch (e) {
      console.log('Error on', inst, e.message);
    }
  }
}

testInvidious();
