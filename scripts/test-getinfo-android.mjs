import { Innertube, ClientType } from 'youtubei.js';

async function testGetInfo() {
  const yt = await Innertube.create({ client_type: ClientType.ANDROID });
  console.log('Calling yt.getInfo for IOHh7vkX5O0 with ANDROID...');
  const info = await yt.getInfo('IOHh7vkX5O0');
  console.log('Title:', info.basic_info.title);
  const formats = info.streaming_data?.adaptive_formats || [];
  const audios = formats.filter(f => f.has_audio && !f.has_video);
  for (const a of audios) {
    console.log('Audio format:', a.itag, a.mime_type, 'hasUrl:', !!a.url);
  }
}

testGetInfo().catch(console.error);
