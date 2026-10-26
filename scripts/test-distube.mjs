import ytdl from '@distube/ytdl-core';

async function test() {
  const url = 'https://www.youtube.com/watch?v=HfzbN5ky5Co'; // Xavi - La Diabla
  console.log('Fetching info for:', url);
  try {
    const info = await ytdl.getInfo(url);
    console.log('Title:', info.videoDetails.title);
    const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
    console.log('Found format:', format.mimeType, 'url prefix:', format.url ? format.url.substring(0, 60) : 'none');
    if (format.url) {
      console.log('SUCCESS: Direct audio stream URL available!');
    }
  } catch (err) {
    console.error('Error with ytdl:', err.message);
  }
}

test().catch(console.error);
