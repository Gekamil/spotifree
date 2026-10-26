import play from 'play-dl';

async function testPlayDL() {
  const url = 'https://www.youtube.com/watch?v=Qv_fsdCZRF0';
  console.log('Testing video_info on', url);
  try {
    const info = await play.video_info(url);
    console.log('Title:', info.video_details.title);
    console.log('Duration seconds:', info.video_details.durationInSec);
    const stream = await play.stream_from_info(info);
    console.log('SUCCESS! Stream type:', stream.type);
    console.log('Stream readable:', stream.stream.readable);
  } catch (err) {
    console.error('Info/Stream error:', err.message);
  }
}

testPlayDL().catch(console.error);
