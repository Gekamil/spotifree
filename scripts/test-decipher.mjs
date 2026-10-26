import { Innertube, UniversalCache } from 'youtubei.js';

async function testDecipher() {
  const yt = await Innertube.create({
    cache: new UniversalCache(true),
  });

  const info = await yt.music.getInfo('2_x_xgFuz1o');
  const format = info.chooseFormat({ type: 'audio', quality: 'best' });
  console.log('Selected format:', format.itag, format.mime_type);
  console.log('Cipher url:', format.signature_cipher);

  try {
    const url = format.decipher(yt.session.player);
    console.log('Deciphered successfully:', typeof url, url);
  } catch (e) {
    console.error('Decipher error:', e);
  }
}

testDecipher();
