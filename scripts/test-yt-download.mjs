import { Innertube, UniversalCache } from 'youtubei.js';

async function testDownloadStream() {
  const yt = await Innertube.create({
    cache: new UniversalCache(false),
  });

  const videoId = 'w4qLnb2J_J0';
  console.log('Testing yt.download for videoId:', videoId);
  try {
    const stream = await yt.download(videoId, {
      type: 'audio',
      quality: 'best',
    });
    console.log('Stream received! ReadableStream:', !!stream);
    const reader = stream.getReader();
    const { value, done } = await reader.read();
    console.log('First chunk received! Bytes length:', value?.byteLength, 'done:', done);
  } catch (err) {
    console.error('yt.download error:', err.message);
  }
}

testDownloadStream().catch(console.error);
