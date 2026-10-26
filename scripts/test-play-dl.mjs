import play from 'play-dl';

async function testPlayDl() {
  console.log('Testing play-dl for 2_x_xgFuz1o...');
  try {
    const stream = await play.stream('https://www.youtube.com/watch?v=2_x_xgFuz1o');
    console.log('Stream type:', stream.type);
    console.log('Stream url:', stream.url ? stream.url.slice(0, 80) : 'internal-stream');
    console.log('Has stream stream:', !!stream.stream);
    
    // Read first chunk
    let bytes = 0;
    for await (const chunk of stream.stream) {
      bytes += chunk.length;
      if (bytes > 50000) break;
    }
    console.log('Successfully read bytes via play-dl:', bytes);
  } catch (err) {
    console.error('play-dl error:', err);
  }
}

testPlayDl();
