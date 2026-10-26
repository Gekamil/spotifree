import { Innertube, ClientType } from 'youtubei.js';

async function testAndroidClient() {
  console.log('Testing Innertube with ANDROID client...');
  try {
    const yt = await Innertube.create({
      client_type: ClientType.ANDROID
    });

    console.log('Searching for Boza Hecha Pa Mi...');
    const search = await yt.search('Boza Hecha Pa Mi');
    const first = search.videos?.[0];
    console.log('Found video:', first?.title?.text, first?.id);

    const videoId = first?.id || 'IOHh7vkX5O0';
    console.log('Getting info for:', videoId);
    const info = await yt.getInfo(videoId);
    console.log('Title:', info.basic_info.title);
    console.log('Duration:', info.basic_info.duration);

    // Get streaming formats
    const formats = info.streaming_data?.adaptive_formats || [];
    console.log('Available adaptive formats:', formats.length);
    const audioFormats = formats.filter(f => f.has_audio && !f.has_video);
    for (const f of audioFormats) {
      console.log('Audio format:', {
        itag: f.itag,
        mime_type: f.mime_type,
        bitrate: f.bitrate,
        hasUrl: !!f.url,
        url: f.url ? f.url.slice(0, 100) : null
      });
    }

    if (audioFormats.some(f => f.url)) {
      console.log('SUCCESS! Direct unencrypted audio URL available without any decipher needed!');
    }
  } catch (err) {
    console.error('Android client error:', err);
  }
}

testAndroidClient().catch(console.error);
