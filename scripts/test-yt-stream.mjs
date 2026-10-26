import { Innertube } from 'youtubei.js';

async function testDownload() {
  const yt = await Innertube.create();
  console.log('Downloading audio stream for 2_x_xgFuz1o ...');
  const stream = await yt.download('2_x_xgFuz1o', {
    type: 'audio',
    quality: 'best'
  });
  console.log('Stream received:', typeof stream);
  
  // Read first 1000 bytes
  const reader = stream.getReader();
  const { value, done } = await reader.read();
  console.log('Read chunk length:', value?.byteLength, 'done:', done);
}

testDownload().catch(console.error);
