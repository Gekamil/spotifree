async function testSmoothPlayback() {
  console.log('1. Calling /api/audio/play for "DtMF Bad Bunny"...');
  const res = await fetch('http://127.0.0.1:5173/api/audio/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'DtMF Bad Bunny', startSeconds: 0 }),
  });
  const data = await res.json();
  console.log('Play response:', data);

  console.log('2. Monitoring status every 1 second for 10 seconds (verifying smooth continuous playback)...');
  let lastTime = 0;
  let didStutter = false;

  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const statusRes = await fetch('http://127.0.0.1:5173/api/audio/status');
    const s = await statusRes.json();
    console.log(`Second ${i+1}:`, {
      isPlaying: s.isPlaying,
      currentTime: s.currentTime.toFixed(2),
      duration: s.duration.toFixed(2),
      ended: s.ended,
    });

    if (i > 0) {
      if (!s.isPlaying) {
        console.error(`ERROR: Paused at second ${i+1}!`);
        didStutter = true;
      }
      if (s.currentTime < lastTime) {
        console.error(`ERROR: currentTime jumped backwards from ${lastTime} to ${s.currentTime}!`);
        didStutter = true;
      }
    }
    lastTime = s.currentTime;
  }

  if (!didStutter) {
    console.log('SUCCESS! Playback played 100% smoothly without a single pause or backwards jump!');
  } else {
    console.error('FAIL: Stuttering or jumping detected.');
  }
}

testSmoothPlayback().catch(console.error);
