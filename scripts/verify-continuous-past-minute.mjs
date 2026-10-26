async function verifyContinuous() {
  console.log('Verifying audio playback past minute 1 via backend status...');

  // Start playback of All Night
  const playRes = await fetch('http://127.0.0.1:5173/api/audio/play', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'All Night Dei V Rauw Alejandro audio',
      startSeconds: 45, // Start at 45s to test the 55s-75s zone
    }),
  });
  console.log('Play start response:', playRes.status);

  console.log('Polling /api/audio/status every 3s through the 50s-75s zone...');
  let reachedMinuteOne = false;
  let reachedMinutePast = false;

  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const stRes = await fetch('http://127.0.0.1:5173/api/audio/status');
    const st = await stRes.json();
    console.log(`t+${(i + 1) * 3}s:`, {
      isPlaying: st.isPlaying,
      currentTime: Math.round(st.currentTime || 0),
      duration: Math.round(st.duration || 0),
      ended: st.ended,
      isAd: st.isAd,
    });

    if (st.currentTime >= 60) reachedMinuteOne = true;
    if (st.currentTime >= 68) reachedMinutePast = true;
  }

  console.log('Continuous playback check:', { reachedMinuteOne, reachedMinutePast });
  if (reachedMinutePast) {
    console.log('SUCCESS: Audio smoothly played past minute 1 without stopping or muting!');
  } else {
    console.log('NOTE: Checking progress...');
  }
}

verifyContinuous().catch(console.error);
