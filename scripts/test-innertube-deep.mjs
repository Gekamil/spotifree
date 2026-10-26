import { Innertube, UniversalCache } from 'youtubei.js';

async function testInnertubeDeep() {
  const yt = await Innertube.create({
    cache: new UniversalCache(false),
    generate_session_locally: true,
  });

  console.log('Testing yt.music.getInfo...');
  try {
    const info = await yt.music.getInfo('2_x_xgFuz1o');
    console.log('Music title:', info.basic_info.title);
    console.log('Streaming data:', !!info.streaming_data);
    const audio = info.streaming_data?.adaptive_formats?.filter(f => f.has_audio && !f.has_video);
    console.log('Audio formats count:', audio?.length);
    for (const a of audio || []) {
      console.log('Format:', a.itag, a.mime_type, 'has url:', !!a.url, 'cipher:', !!a.signature_cipher);
      if (a.url) {
        console.log('DIRECT URL FOUND:', a.url.slice(0, 100));
        return;
      }
    }
  } catch (e) {
    console.error('Music getInfo error:', e.message);
  }
}

testInnertubeDeep();
