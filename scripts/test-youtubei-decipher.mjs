import { Innertube } from 'youtubei.js';

async function testDecipher() {
  const yt = await Innertube.create({ client_type: 'ANDROID' });
  const info = await yt.getInfo('2_x_xgFuz1o');
  console.log('Title:', info.basic_info.title);
  console.log('Duration:', info.basic_info.duration);
  const format = info.chooseFormat({ type: 'audio', quality: 'best' });
  console.log('Format itag:', format.itag, 'mimeType:', format.mime_type);
  console.log('Has raw url:', !!format.url);
  if (format.url) {
    console.log('Raw URL:', format.url.slice(0, 80));
  } else {
    const deciphered = format.decipher(yt.session.player);
    console.log('Deciphered type:', typeof deciphered, 'isPromise:', deciphered instanceof Promise);
    const resolved = await deciphered;
    console.log('Resolved url:', typeof resolved, resolved?.slice ? resolved.slice(0, 80) : resolved);
  }
}
testDecipher().catch(console.error);
