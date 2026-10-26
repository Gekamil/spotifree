import { Innertube } from 'youtubei.js';

async function testInnertube() {
  console.log('Initializing Innertube...');
  const yt = await Innertube.create();
  console.log('Searching for Boza Hecha Pa Mi...');
  const search = await yt.music.search('Boza Hecha Pa Mi', { type: 'song' });
  console.log('Search results songs:', search.songs?.contents?.length);
  const song = search.songs?.contents?.[0];
  console.log('First song:', { id: song?.id, title: song?.title, artist: song?.artists?.[0]?.name });

  const videoId = song?.id || 'KKc8jsO0nIM';
  console.log('Getting info for:', videoId);
  const info = await yt.getInfo(videoId);
  console.log('Basic info title:', info.basic_info.title);
  console.log('Duration:', info.basic_info.duration);

  // Download stream or get streaming URL
  const format = info.chooseFormat({ type: 'audio', quality: 'best' });
  console.log('Chosen format:', {
    itag: format?.itag,
    mime_type: format?.mime_type,
    content_length: format?.content_length,
    hasDecipher: !!format?.decipher
  });

  const url = format?.decipher(yt.session.player);
  console.log('Direct audio URL:', url?.slice(0, 100));
}

testInnertube().catch(console.error);
