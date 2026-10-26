import ytdl from '@distube/ytdl-core';

async function testYtdl() {
  const videoId = '2_x_xgFuz1o';
  console.log('Testing @distube/ytdl-core on videoId:', videoId);
  try {
    const info = await ytdl.getInfo(videoId);
    console.log('Title:', info.videoDetails.title);
    console.log('Duration:', info.videoDetails.lengthSeconds);
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    console.log('Found audio formats count:', audioFormats.length);
    if (audioFormats.length > 0) {
      const best = audioFormats[0];
      console.log('Best format itag:', best.itag, 'mimeType:', best.mimeType, 'bitrate:', best.audioBitrate);
      console.log('Stream URL available:', !!best.url, best.url?.slice(0, 80));
    }
  } catch (err) {
    console.error('ytdl error:', err.message);
  }
}

testYtdl();
