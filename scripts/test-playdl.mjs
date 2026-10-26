import play from 'play-dl';

async function testPlayDl() {
  const videoId = '2_x_xgFuz1o';
  console.log('Testing play-dl on videoId:', videoId);
  try {
    const stream = await play.stream(`https://www.youtube.com/watch?v=${videoId}`);
    console.log('play-dl stream type:', stream.type);
    console.log('play-dl stream url:', stream.url?.slice(0, 80));
  } catch (err) {
    console.error('play-dl error:', err.message);
  }
}

testPlayDl();
