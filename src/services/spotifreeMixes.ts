/**
 * Spotifree's own playlists ("Hecho para ti"), built from what each account really listens to.
 *
 * 1. Signals (per account, kept on the device): songs played 30 s or more, skips, likes /
 *    unlikes, searches, plus what Spotify brings (top songs / artists, recent plays, liked songs,
 *    the user's playlists) — Spotify's recent plays are copied into our own history.
 * 2. Every signal fades with time (likes slowest, searches fastest) and Spotify's starting data
 *    fades over months, so after a long time the recommendations follow what is played HERE.
 * 3. Playlists: Mix diario 1-6 (artists that go together, new picks every day), Descubrimiento
 *    semanal (new artists, every Monday), Radar de novedades (recent releases of your artists),
 *    En repeat, Tus clásicos and "Mix de <artista>". New music comes from /api/discover.
 * 4. Covers vary each time (artist photo with a colour band, collage of 4 covers, or one cover
 *    with a gradient), drawn on the device.
 */
import { create } from 'zustand';
import { isNotInterested } from '../utils/notInterested';
import { isExcludedFromTaste } from '../utils/tasteExclusions';
import type { Playlist, Track } from '../types/spotify';
import { usePlayerStore } from '../store/usePlayerStore';
import { buildDynamicShelves, useSpotifyDataStore, type DynamicShelf } from '../store/useSpotifyDataStore';
import { useStatsStore } from '../store/useStatsStore';
import { getRecentSearches } from '../utils/recentSearches';
import { getSavedSpotifreeAccount, syncSpotifreeAccount } from './spotifreeAuth';
import { TRACK_COVER_CACHE, getTrackCoverUrl, isPlaylistOrGenericCover } from '../utils/trackCovers';

// ---------------------------------------------------------------------------
// Verified Artist Portrait Registry (CORS enabled, 100% reliable 500x500 portraits)
// ---------------------------------------------------------------------------
export const ARTIST_PORTRAITS: Record<string, string> = {
  'nil moliner': 'https://cdn-images.dzcdn.net/images/artist/2c7cf0389684cd0a2cd9ac96a4706649/500x500-000000-80-0-0.jpg',
  'manuel carrasco': 'https://cdn-images.dzcdn.net/images/artist/ba70353e7c259f98ebc614a89ddd10fc/500x500-000000-80-0-0.jpg',
  'daddy yankee': 'https://cdn-images.dzcdn.net/images/artist/0c584f1fc8c55a604545bbae3c8a3b1b/500x500-000000-80-0-0.jpg',
  'prince royce': 'https://cdn-images.dzcdn.net/images/artist/34c4613ef715fdae5afec5b8da10485f/500x500-000000-80-0-0.jpg',
  'paul alone': 'https://cdn-images.dzcdn.net/images/artist/79d2cdb1116c32d1d9c57feb75fd314c/500x500-000000-80-0-0.jpg',
  'sofia ellar': 'https://cdn-images.dzcdn.net/images/artist/4ffeb758d1affa379d20210fabad2ac5/500x500-000000-80-0-0.jpg',
  'rayden': 'https://cdn-images.dzcdn.net/images/artist/42a89bd063f83da2d205897a0567928f/500x500-000000-80-0-0.jpg',
  'paulo londra': 'https://cdn-images.dzcdn.net/images/artist/26fbc79599d2ed0f3629fa74df3e489a/500x500-000000-80-0-0.jpg',
  'bad bunny': 'https://cdn-images.dzcdn.net/images/artist/044a3f315b041864887a8dd8709e6926/500x500-000000-80-0-0.jpg',
  'quevedo': 'https://cdn-images.dzcdn.net/images/artist/79880cc1b999b15567e332203464c34e/500x500-000000-80-0-0.jpg',
  'feid': 'https://cdn-images.dzcdn.net/images/artist/e629c93e03b3c225d8d52a42bae71537/500x500-000000-80-0-0.jpg',
  'rauw alejandro': 'https://cdn-images.dzcdn.net/images/artist/6f0f2b885570d8d43b598c29bbe7433f/500x500-000000-80-0-0.jpg',
  'rosalia': 'https://cdn-images.dzcdn.net/images/artist/f514dbe0c89f62348d60b7292771edc7/500x500-000000-80-0-0.jpg',
  'aitana': 'https://cdn-images.dzcdn.net/images/artist/41a75229e7fb63066c6b8be08ff0dbce/500x500-000000-80-0-0.jpg',
  'melendi': 'https://cdn-images.dzcdn.net/images/artist/e2416523f51a9033651377f9388af329/500x500-000000-80-0-0.jpg',
  'estopa': 'https://cdn-images.dzcdn.net/images/artist/2c97b9ad7e581a4954c5e58d3294230f/500x500-000000-80-0-0.jpg',
  'bizarrap': 'https://cdn-images.dzcdn.net/images/artist/e121c1ef9b1135e6a5b71c1e65ab10b4/500x500-000000-80-0-0.jpg',
  'mora': 'https://cdn-images.dzcdn.net/images/artist/10c3e126379125d8697a44c70db711e5/500x500-000000-80-0-0.jpg',
  'myke towers': 'https://cdn-images.dzcdn.net/images/artist/d3a7418b4e44bf8ee3ae268067a86f09/500x500-000000-80-0-0.jpg',
  'olivia dean': 'https://cdn-images.dzcdn.net/images/artist/fed7c3b756cf6049da62988cb8e744be/500x500-000000-80-0-0.jpg',
  'olivia rodrigo': 'https://cdn-images.dzcdn.net/images/artist/2c9e480317183c037eaebcd7ba96daf4/500x500-000000-80-0-0.jpg',
  'coldplay': 'https://cdn-images.dzcdn.net/images/artist/3087954bca22f306324912e5ac8375c3/500x500-000000-80-0-0.jpg',
  'queen': 'https://cdn-images.dzcdn.net/images/artist/a131ced363dd67249e6a9167164188cb/500x500-000000-80-0-0.jpg',
  'imagine dragons': 'https://cdn-images.dzcdn.net/images/artist/1ba025c23cae3dee14b51152990285fc/500x500-000000-80-0-0.jpg',
  'don mclean': 'https://cdn-images.dzcdn.net/images/artist/ea4ca273ee3a5fdcda212615a78445d5/500x500-000000-80-0-0.jpg',
  'c tangana': 'https://cdn-images.dzcdn.net/images/artist/e22bb9c67981fd3e6bcff160660c6bd5/500x500-000000-80-0-0.jpg',
  'alvaro de luna': 'https://cdn-images.dzcdn.net/images/artist/f86b03fcd19d8d97edfbfb12d24e7e72/500x500-000000-80-0-0.jpg',
  'morat': 'https://cdn-images.dzcdn.net/images/artist/98d8836cb131fb50bc733ff2b3328497/500x500-000000-80-0-0.jpg',
  'camilo': 'https://cdn-images.dzcdn.net/images/artist/223a547158dbe5634a99c3ed19510a20/500x500-000000-80-0-0.jpg',
  'lemot': 'https://cdn-images.dzcdn.net/images/artist/e86ee0db8820f19c99f29bc2e3abc271/500x500-000000-80-0-0.jpg',
  'eminem': 'https://cdn-images.dzcdn.net/images/artist/0f30bbd33a680030054af004d698d6ac/500x500-000000-80-0-0.jpg',
  'dua lipa': 'https://cdn-images.dzcdn.net/images/artist/877872aaf75694f11d53c318700ab2b5/500x500-000000-80-0-0.jpg',
  'the weeknd': 'https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/500x500-000000-80-0-0.jpg',
  'billie eilish': 'https://cdn-images.dzcdn.net/images/artist/8eab1a9a644889aabaca1e193e05f984/500x500-000000-80-0-0.jpg',
  'sabrina carpenter': 'https://cdn-images.dzcdn.net/images/artist/4a9cdc7737e2a0e59b4917b47884b859/500x500-000000-80-0-0.jpg',
  'lady gaga': 'https://cdn-images.dzcdn.net/images/artist/7565262f7661b0d762621a8d69ba6f49/500x500-000000-80-0-0.jpg',
  'bruno mars': 'https://cdn-images.dzcdn.net/images/artist/90f0b5b11df4f87ee878f38569b5995b/500x500-000000-80-0-0.jpg',
  'kendrick lamar': 'https://cdn-images.dzcdn.net/images/artist/be0a7c550567f4af0ed202d7235b74d6/500x500-000000-80-0-0.jpg',
  'post malone': 'https://cdn-images.dzcdn.net/images/artist/a5a8cca44e7eab2db7d44e039bed2574/500x500-000000-80-0-0.jpg',
  'taylor swift': 'https://cdn-images.dzcdn.net/images/artist/cc2495870fe1a792ad0cdb05501ad5ec/500x500-000000-80-0-0.jpg',
  'harry styles': 'https://cdn-images.dzcdn.net/images/artist/1151dba9b3edc0633adf35b64c21713f/500x500-000000-80-0-0.jpg',
  'saiko': 'https://cdn-images.dzcdn.net/images/artist/38f4945a0ca1b2900d26f5f504b3cae5/500x500-000000-80-0-0.jpg',
  'morad': 'https://cdn-images.dzcdn.net/images/artist/7fa82fa3c4b6e3cdbe966a293f1c8b92/500x500-000000-80-0-0.jpg',
  'dellafuente': 'https://cdn-images.dzcdn.net/images/artist/84045880282df765f23d6d180271a4fe/500x500-000000-80-0-0.jpg',
  'lola indigo': 'https://cdn-images.dzcdn.net/images/artist/f87b9bce8f420d9a2116680be75e7878/500x500-000000-80-0-0.jpg',
  'karol g': 'https://cdn-images.dzcdn.net/images/artist/5b0aab23f8d2856951a92f3a9faf70e3/500x500-000000-80-0-0.jpg',
  'david guetta': 'https://cdn-images.dzcdn.net/images/artist/2d527fa03e106ed82a28f161694278d3/500x500-000000-80-0-0.jpg',
  'calvin harris': 'https://cdn-images.dzcdn.net/images/artist/a53031d02dc2f8a8eb15d117c015d5eb/500x500-000000-80-0-0.jpg',
  'avicii': 'https://cdn-images.dzcdn.net/images/artist/82e214b0cb39316f4a12a082fded54f6/500x500-000000-80-0-0.jpg',
  'arctic monkeys': 'https://cdn-images.dzcdn.net/images/artist/6c03e4c7c36800897fd468633286db24/500x500-000000-80-0-0.jpg',
  'nirvana': 'https://cdn-images.dzcdn.net/images/artist/ad67af8b0dca71d5e69f1afd8e045c4e/500x500-000000-80-0-0.jpg',
  'ed sheeran': 'https://cdn-images.dzcdn.net/images/artist/d6bb84390641d8ae9118228d9544e53d/500x500-000000-80-0-0.jpg',
  'tiesto': 'https://cdn-images.dzcdn.net/images/artist/b6ff15612b6ef51e5a552e4bd6abefd6/500x500-000000-80-0-0.jpg',
  'skrillex': 'https://cdn-images.dzcdn.net/images/artist/0075f053766d7d0e12e4a7be22b85e6a/500x500-000000-80-0-0.jpg',
  'bebe rexha': 'https://cdn-images.dzcdn.net/images/artist/315f8e20f0cd18735e6b9a9f5fd9adda/500x500-000000-80-0-0.jpg',
  'kanye west': 'https://cdn-images.dzcdn.net/images/artist/bb76c2ee3b068726ab4c37b0aabdb57a/500x500-000000-80-0-0.jpg',
  'britney spears': 'https://cdn-images.dzcdn.net/images/artist/caea45732bb52679494602c60430435a/500x500-000000-80-0-0.jpg',
  '50 cent': 'https://cdn-images.dzcdn.net/images/artist/58da3cca2d598e43c7a7823cf75277e5/500x500-000000-80-0-0.jpg',
  'snoop dogg': 'https://cdn-images.dzcdn.net/images/artist/ecee555cd9f4af2617272852ff8562d2/500x500-000000-80-0-0.jpg',
  'travis scott': 'https://cdn-images.dzcdn.net/images/artist/8d8316146026d7e6ce377e314536df62/500x500-000000-80-0-0.jpg',
  'omar montes': 'https://cdn-images.dzcdn.net/images/artist/324c964b02f57e6d2ffe554fd1b7b7d5/500x500-000000-80-0-0.jpg',
  'marshmello': 'https://cdn-images.dzcdn.net/images/artist/31daf06aa7034f829e2e1e7f855f2e60/500x500-000000-80-0-0.jpg',
  'duki': 'https://cdn-images.dzcdn.net/images/artist/795d09a17bc833425e4b88639bb931af/500x500-000000-80-0-0.jpg',
};

/** High-resolution, authentic, dedicated photography per category to prevent repetition */
export const CURATED_CATEGORY_PHOTOS: Record<string, string> = {
  // Moods & Activities ("Estados de ánimo y Momentos")
  entreno: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80', // Gym workout & athletic energy
  chill: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&auto=format&fit=crop&q=80', // Cozy warm morning coffee & acoustic serenity
  relax: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&auto=format&fit=crop&q=80', // Zen meditation & calm lake reflection
  concentracion: 'https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=600&auto=format&fit=crop&q=80', // Study & Lo-Fi Vinyl Headphones
  focus: 'https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=600&auto=format&fit=crop&q=80',
  fiesta: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80', // Neon Club DJ Lights & Party Night
  coche: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&auto=format&fit=crop&q=80', // Sunset Highway Roadtrip
  cantar: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80', // Stage Microphone Live Singing
  romantico: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80', // Warm Golden Hour Acoustic Romance
  dormir: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=600&auto=format&fit=crop&q=80', // Calm Night Stars
  cocinar: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=600&auto=format&fit=crop&q=80', // Kitchen Cozy Morning
  paseo: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=600&auto=format&fit=crop&q=80', // Sunny Autumn Walk

  // Trending & Charts ("Tendencias & Virales del Momento")
  trend_spain: 'https://cdn-images.dzcdn.net/images/artist/79880cc1b999b15567e332203464c34e/500x500-000000-80-0-0.jpg', // Quevedo (Verified 200 OK portrait)
  trend_global: 'https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/500x500-000000-80-0-0.jpg', // The Weeknd (Verified 200 OK)
  trend_virales: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80', // Viral TikTok Club Neon
  trend_urbano: 'https://cdn-images.dzcdn.net/images/artist/044a3f315b041864887a8dd8709e6926/500x500-000000-80-0-0.jpg', // Bad Bunny (Verified 200 OK)
  trend_pop: 'https://cdn-images.dzcdn.net/images/artist/877872aaf75694f11d53c318700ab2b5/500x500-000000-80-0-0.jpg', // Dua Lipa (Verified 200 OK)
  trend_electronica: 'https://cdn-images.dzcdn.net/images/artist/2d527fa03e106ed82a28f161694278d3/500x500-000000-80-0-0.jpg', // David Guetta (Verified 200 OK)
  trend_latino: 'https://cdn-images.dzcdn.net/images/artist/5b0aab23f8d2856951a92f3a9faf70e3/500x500-000000-80-0-0.jpg', // Karol G (Verified 200 OK)
  trend_verano: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=80', // Summer Beach
  trend_rising: 'https://cdn-images.dzcdn.net/images/artist/4a9cdc7737e2a0e59b4917b47884b859/500x500-000000-80-0-0.jpg', // Sabrina Carpenter (Verified 200 OK)
  trend_rap: 'https://cdn-images.dzcdn.net/images/artist/0f30bbd33a680030054af004d698d6ac/500x500-000000-80-0-0.jpg', // Eminem (Verified 200 OK)

  // Eras
  '2020s': 'https://cdn-images.dzcdn.net/images/artist/41a75229e7fb63066c6b8be08ff0dbce/500x500-000000-80-0-0.jpg', // Aitana (Verified 200 OK)
  '2010s': 'https://cdn-images.dzcdn.net/images/artist/82e214b0cb39316f4a12a082fded54f6/500x500-000000-80-0-0.jpg', // Avicii (Verified 200 OK)
  '2000s': 'https://cdn-images.dzcdn.net/images/artist/0c584f1fc8c55a604545bbae3c8a3b1b/500x500-000000-80-0-0.jpg', // Daddy Yankee (Verified 200 OK)
  '90s': 'https://cdn-images.dzcdn.net/images/artist/ad67af8b0dca71d5e69f1afd8e045c4e/500x500-000000-80-0-0.jpg', // Nirvana (Verified 200 OK)
  '80s': 'https://cdn-images.dzcdn.net/images/artist/a131ced363dd67249e6a9167164188cb/500x500-000000-80-0-0.jpg', // Queen (Verified 200 OK)
  '70s': 'https://cdn-images.dzcdn.net/images/artist/ea4ca273ee3a5fdcda212615a78445d5/500x500-000000-80-0-0.jpg', // Don McLean (Verified 200 OK)
  '60s': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80', // Vinyl 60s
  'eurodance': 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
  'teenpop': 'https://cdn-images.dzcdn.net/images/artist/caea45732bb52679494602c60430435a/500x500-000000-80-0-0.jpg', // Britney Spears (Verified 200 OK)

  // Genres
  rock: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop&q=80', // Electric Guitar Rock
  pop: 'https://cdn-images.dzcdn.net/images/artist/877872aaf75694f11d53c318700ab2b5/500x500-000000-80-0-0.jpg', // Dua Lipa (Verified 200 OK)
  urbano: 'https://cdn-images.dzcdn.net/images/artist/044a3f315b041864887a8dd8709e6926/500x500-000000-80-0-0.jpg', // Bad Bunny (Verified 200 OK)
  electronica: 'https://cdn-images.dzcdn.net/images/artist/2d527fa03e106ed82a28f161694278d3/500x500-000000-80-0-0.jpg', // David Guetta (Verified 200 OK)
  edm: 'https://cdn-images.dzcdn.net/images/artist/2d527fa03e106ed82a28f161694278d3/500x500-000000-80-0-0.jpg',
  indie: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80', // Indie Acoustic
  hiphop: 'https://cdn-images.dzcdn.net/images/artist/0f30bbd33a680030054af004d698d6ac/500x500-000000-80-0-0.jpg', // Eminem (Verified 200 OK)
  flamenco: 'https://cdn-images.dzcdn.net/images/artist/2c97b9ad7e581a4954c5e58d3294230f/500x500-000000-80-0-0.jpg', // Estopa (Verified 200 OK)
  rnb: 'https://cdn-images.dzcdn.net/images/artist/90f0b5b11df4f87ee878f38569b5995b/500x500-000000-80-0-0.jpg', // Bruno Mars (Verified 200 OK)
  reggae: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=600&auto=format&fit=crop&q=80', // Tropical Reggae
  clasica: 'https://images.unsplash.com/photo-1513883049090-d0b7439799bf?w=600&auto=format&fit=crop&q=80', // Piano Relax
};

/** Checks whether a URL is an ugly placeholder, default avatar icon, or user profile image */
export function isPlaceholderOrAvatar(url?: string): boolean {
  if (!url) return true;
  const lower = url.toLowerCase();
  return (
    lower.includes('d41d8cd98f00b204e9800998ecf8427e') || // Deezer empty avatar MD5 hash
    lower.includes('placeholder') ||
    lower.includes('default_artist') ||
    lower.includes('default_user') ||
    lower.includes('user-avatar') ||
    lower.includes('dzcdn.net/images/artist//') ||
    lower.includes('dzcdn.net/images/cover//') ||
    lower.includes('images/artist//') ||
    lower.includes('images/cover//') ||
    lower.includes('/artist//') ||
    lower.includes('/cover//') ||
    lower.includes('//500x500') ||
    lower.includes('//1000x1000') ||
    lower.includes('//250x250') ||
    lower.includes('//56x56') ||
    lower.includes('//120x120') ||
    (lower.includes('api.deezer.com') && lower.includes('/image')) ||
    lower.includes('avatar') ||
    lower.includes('53994a69daeb') // Prevent mockUser portrait from ever being used as a playlist cover
  );
}

/** Detects if a loaded HTMLImageElement rendered Deezer's grey silhouette placeholder */
export function isDeezerSilhouette(img: HTMLImageElement): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const c = document.createElement('canvas');
    c.width = c.height = 12;
    const x = c.getContext('2d');
    if (!x) return false;
    x.drawImage(img, 0, 0, 12, 12);
    const p = x.getImageData(0, 0, 12, 12).data;
    // Deezer avatar corner color is approx (234, 231, 238)
    const isAvatarBg = Math.abs(p[0] - 234) < 14 && Math.abs(p[1] - 231) < 14 && Math.abs(p[2] - 238) < 14;
    const centerIdx = (6 * 12 + 6) * 4;
    const isCenterGrey = Math.abs(p[centerIdx] - 199) < 28 && Math.abs(p[centerIdx + 1] - 197) < 28;
    return isAvatarBg && isCenterGrey;
  } catch {
    return false;
  }
}

export const MUSIC_PORTRAIT_FALLBACKS = [
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80', // Acoustic guitar warm
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80', // Fitness & energy
  'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop&q=80', // Electric rock guitar
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&auto=format&fit=crop&q=80', // Party crowd lights
  'https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?w=600&auto=format&fit=crop&q=80', // Headphones vinyl
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&auto=format&fit=crop&q=80', // Sunset highway
  'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80', // Golden romance
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80', // Electronic DJ
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80', // Indie road
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80', // Stage live vocals
  'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600&auto=format&fit=crop&q=80', // Cozy morning coffee
  'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&auto=format&fit=crop&q=80', // Zen meditation lake
];

export function resolveArtistPhoto(name: string): string {
  const k = norm(name);
  if (!k) return MUSIC_PORTRAIT_FALLBACKS[0];

  // 1. Direct or partial artist lookup
  if (ARTIST_PORTRAITS[k]) return ARTIST_PORTRAITS[k];
  for (const [key, url] of Object.entries(ARTIST_PORTRAITS)) {
    if (k.includes(key) || key.includes(k)) return url;
  }

  // 2. Direct or keyword match against curated category photos
  if (CURATED_CATEGORY_PHOTOS[k]) return CURATED_CATEGORY_PHOTOS[k];
  if (k.includes('2010') || k.includes('diez')) return CURATED_CATEGORY_PHOTOS['2010s'];
  if (k.includes('2020')) return CURATED_CATEGORY_PHOTOS['2020s'];
  if (k.includes('2000')) return CURATED_CATEGORY_PHOTOS['2000s'];
  if (k.includes('90')) return CURATED_CATEGORY_PHOTOS['90s'];
  if (k.includes('80')) return CURATED_CATEGORY_PHOTOS['80s'];
  if (k.includes('70')) return CURATED_CATEGORY_PHOTOS['70s'];
  if (k.includes('60')) return CURATED_CATEGORY_PHOTOS['60s'];
  if (k.includes('espana') || k.includes('spain')) return CURATED_CATEGORY_PHOTOS['trend_spain'];
  if (k.includes('entreno') || k.includes('gym') || k.includes('fitness')) return CURATED_CATEGORY_PHOTOS['entreno'];
  if (k.includes('chill')) return CURATED_CATEGORY_PHOTOS['chill'];
  if (k.includes('relax')) return CURATED_CATEGORY_PHOTOS['relax'];
  if (k.includes('concentracion') || k.includes('focus')) return CURATED_CATEGORY_PHOTOS['concentracion'];
  if (k.includes('fiesta') || k.includes('party')) return CURATED_CATEGORY_PHOTOS['fiesta'];
  if (k.includes('coche') || k.includes('car') || k.includes('viaje')) return CURATED_CATEGORY_PHOTOS['coche'];
  if (k.includes('romantico') || k.includes('amor')) return CURATED_CATEGORY_PHOTOS['romantico'];
  if (k.includes('virales') || k.includes('viral')) return CURATED_CATEGORY_PHOTOS['trend_virales'];

  // 3. Fallback to distinct curated photos
  const idx = Math.abs(hash(name)) % MUSIC_PORTRAIT_FALLBACKS.length;
  return MUSIC_PORTRAIT_FALLBACKS[idx];
}

// ---------------------------------------------------------------------------
// Spotify Mix Banner Palettes (1:1 with Spotify Top Mixes: 2000s Mix, Chill Mix, etc.)
// ---------------------------------------------------------------------------
export interface BannerPalette {
  banner: string;
  pill: string;
  text: string;
}
export const DADDY_YANKEE_PALETTES: BannerPalette[] = [
  { banner: '#e9dfd3', pill: '#181818', text: '#181818' }, // 2000s Mix (Daddy Yankee beige exact)
  { banner: '#509bf5', pill: '#0b2450', text: '#0b2450' }, // Chill Mix blue exact
  { banner: '#f3baa1', pill: '#42170d', text: '#42170d' }, // Olivia Rodrigo peach exact
  { banner: '#1ed760', pill: '#083d16', text: '#083d16' }, // Spotify Mint
  { banner: '#f7d147', pill: '#3d3000', text: '#3d3000' }, // Sunlight Yellow
  { banner: '#b589ff', pill: '#240a50', text: '#240a50' }, // Lavender
  { banner: '#ff5c8a', pill: '#450818', text: '#450818' }, // Strawberry
  { banner: '#ff8c42', pill: '#451a00', text: '#451a00' }, // Tangerine
  { banner: '#2ec4b6', pill: '#073833', text: '#073833' }, // Teal
  { banner: '#e0e7ff', pill: '#1e1b4b', text: '#1e1b4b' }, // Periwinkle
];

export function getBannerPalette(title: string, accent?: string): BannerPalette {
  if (accent && accent.startsWith('#')) {
    return { banner: accent, pill: '#121212', text: '#ffffff' };
  }
  const idx = Math.abs(hash(title)) % DADDY_YANKEE_PALETTES.length;
  return DADDY_YANKEE_PALETTES[idx];
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const DAY = 24 * 3600 * 1000;
const norm = (s = '') =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const trackKey = (title: string, artist: string) => `${norm(title)}|${norm(artist)}`;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const today = () => new Date().toISOString().slice(0, 10);
function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - y.getTime()) / DAY + 1) / 7)}`;
}
const firstArtist = (t: any): string => String(t?.artists?.[0]?.name || '').split(/\s*[,&]\s*/)[0];
const coverOf = (t: any): string => {
  if (!t) return '';
  const fromHelper = getTrackCoverUrl(t);
  if (fromHelper && !isPlaylistOrGenericCover(fromHelper) && !isPlaceholderOrAvatar(fromHelper)) return fromHelper;
  const fromCache = t?.id ? TRACK_COVER_CACHE.get(t.id) : undefined;
  if (fromCache && !isPlaylistOrGenericCover(fromCache) && !isPlaceholderOrAvatar(fromCache)) return fromCache;
  const albumImg = t?.album?.images?.[0]?.url;
  if (albumImg && !isPlaylistOrGenericCover(albumImg) && !isPlaceholderOrAvatar(albumImg)) return albumImg;
  const artName = firstArtist(t);
  if (artName) return resolveArtistPhoto(artName);
  return '';
};
const asTrack = (x: any): Track | null => {
  const t = x?.track && x.track.name ? x.track : x;
  return t?.id && t?.name && t?.artists?.length ? (t as Track) : null;
};

// ---------------------------------------------------------------------------
// Tiny IndexedDB key-value store (generated playlists + covers are too big for localStorage)
// ---------------------------------------------------------------------------
let dbP: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbP) {
    dbP = new Promise((resolve, reject) => {
      const r = indexedDB.open('spotifree-mixes', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => {
        dbP = null;
        reject(r.error);
      };
    });
  }
  return dbP;
}
async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const q = d.transaction('kv').objectStore('kv').get(key);
      q.onsuccess = () => resolve(q.result as T);
      q.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  }
}
async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    const d = await db();
    await new Promise<void>((resolve) => {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}
async function kvDel(key: string): Promise<void> {
  try {
    const d = await db();
    await new Promise<void>((resolve) => {
      const tx = d.transaction('kv', 'readwrite');
      tx.objectStore('kv').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// 1. Signals (per account)
// ---------------------------------------------------------------------------
type SignalKind = 'play' | 'skip' | 'like' | 'unlike' | 'search' | 'spotify' | 'hide';
interface Signal {
  k: SignalKind;
  t: string; // title ('' for artist-only signals)
  a: string; // artist
  id?: string;
  img?: string;
  ts: number;
}

const WEIGHT: Record<SignalKind, number> = { play: 1, skip: -0.6, like: 4, unlike: -4, search: 1.5, spotify: 0.8, hide: -5 };
const HALF_LIFE_DAYS: Record<SignalKind, number> = { play: 60, skip: 30, like: 240, unlike: 120, search: 30, spotify: 90, hide: 365 };
const MAX_SIGNALS = 4000;

const uid = () => useSpotifyDataStore.getState().user?.id || 'local';
const signalsKey = () => `spotifree_taste_${uid()}`;
const firstSeenKey = () => `spotifree_taste_since_${uid()}`;
const onboardingKey = () => `spotifree_onboarding_artists_${uid()}`;

export interface OnboardingArtistSeed {
  name: string;
  image?: string;
  id?: string;
}

export function getOnboardingArtistSeeds(): OnboardingArtistSeed[] {
  try {
    const raw = localStorage.getItem(onboardingKey());
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveOnboardingArtistSeeds(artists: OnboardingArtistSeed[]): void {
  try {
    localStorage.setItem(onboardingKey(), JSON.stringify(artists));
    localStorage.setItem('spotifree_taste_onboarding_completed', 'true');
    // Log as high-affinity like signals
    for (const art of artists) {
      logSignal({ k: 'like', t: '', a: art.name, img: art.image });
    }
  } catch (e) {
    console.warn('[SpotifreeMixes] Failed to save onboarding seeds', e);
  }
  // Immediately build recommendations & mixes
  void refreshSpotifreeMixes(true);
}

function readSignals(): Signal[] {
  try {
    return JSON.parse(localStorage.getItem(signalsKey()) || '[]');
  } catch {
    return [];
  }
}
function writeSignals(list: Signal[]) {
  try {
    localStorage.setItem(signalsKey(), JSON.stringify(list.slice(-MAX_SIGNALS)));
  } catch {
    try {
      localStorage.setItem(signalsKey(), JSON.stringify(list.slice(-1500)));
    } catch {}
  }
}
function logSignal(s: Omit<Signal, 'ts'> & { ts?: number }) {
  if (!s.a) return;
  const list = readSignals();
  list.push({ ...s, ts: s.ts || Date.now() });
  writeSignals(list);
  newSignals++;
  queueCloudPush();
  // A new account without Spotify data: its first playlists after a few plays
  if (newSignals === 5 && !useSpotifreeMixes.getState().mixes.length) scheduleRefresh(1500);
}
function firstSeen(): number {
  try {
    const v = Number(localStorage.getItem(firstSeenKey()));
    if (v > 0) return v;
    localStorage.setItem(firstSeenKey(), String(Date.now()));
  } catch {}
  return Date.now();
}

let hooksInstalled = false;
let newSignals = 0; // activity since the last build
function installSignalHooks() {
  if (hooksInstalled || typeof window === 'undefined') return;
  hooksInstalled = true;

  // Plays (30 s or more) and skips
  let curId: string | null = null;
  let curLogged = false;
  let curTrack: Track | null = null;
  let lastProgress = 0;
  usePlayerStore.subscribe((s) => {
    const t = s.currentTrack;
    if (t?.id !== curId) {
      if (curTrack && !curLogged && lastProgress > 0 && lastProgress < 15000 && !isExcludedFromTaste((s as any).currentContextId)) {
        logSignal({ k: 'skip', t: curTrack.name, a: firstArtist(curTrack), id: curTrack.id });
      }
      curId = t?.id || null;
      curTrack = t || null;
      curLogged = false;
      lastProgress = 0;
      return;
    }
    lastProgress = s.progressMs || 0;
    if (t && !curLogged && lastProgress >= 30000) {
      curLogged = true;
      // "Excluir de tu perfil de gustos": plays from that playlist don't count
      if (!isExcludedFromTaste((s as any).currentContextId)) logSignal({ k: 'play', t: t.name, a: firstArtist(t), id: t.id, img: coverOf(t) });
    }
  });

  // Likes / unlikes
  let liked = new Set(usePlayerStore.getState().likedTrackIds || []);
  usePlayerStore.subscribe((s) => {
    const now = new Set(s.likedTrackIds || []);
    if (now.size === liked.size && [...now].every((x) => liked.has(x))) return;
    const added = [...now].filter((x) => !liked.has(x));
    const removed = [...liked].filter((x) => !now.has(x));
    liked = now;
    const find = (id: string): Track | null => {
      const cur = s.currentTrack;
      if (cur && (cur.id === id || cur.id.endsWith(id))) return cur;
      for (const p of useSpotifyDataStore.getState().playlists || []) {
        for (const x of p.tracks?.items || []) {
          const tr = asTrack(x);
          if (tr && tr.id === id) return tr;
        }
      }
      return null;
    };
    const seen = new Set<string>();
    for (const id of added) {
      const tr = find(id);
      if (tr && !seen.has(tr.name)) {
        seen.add(tr.name);
        logSignal({ k: 'like', t: tr.name, a: firstArtist(tr), id: tr.id, img: coverOf(tr) });
      }
    }
    for (const id of removed) {
      const tr = find(id);
      if (tr && !seen.has(tr.name)) {
        seen.add(tr.name);
        logSignal({ k: 'unlike', t: tr.name, a: firstArtist(tr), id: tr.id });
      }
    }
  });

  // "No me interesa": a strong no for the song (and a smaller one for its artist)
  window.addEventListener('spotifree:not-interested', (e: any) => {
    const t: Track | undefined = e?.detail?.track;
    if (t?.name) logSignal({ k: 'hide', t: t.name, a: firstArtist(t), id: t.id });
  });

  // Searches (artists and songs the user looked for)
  let lastSearchTs = Math.max(0, ...getRecentSearches().map((x) => x.timestamp || 0));
  window.addEventListener('spotifree_recent_searches_updated', () => {
    for (const it of getRecentSearches()) {
      if ((it.timestamp || 0) <= lastSearchTs) continue;
      if (it.type === 'artist') logSignal({ k: 'search', t: '', a: it.title, img: it.image, ts: it.timestamp });
      else if (it.type === 'track') {
        const artist = String(it.subtitle || '').replace(/^Canción\s*•\s*/i, '').split(',')[0];
        logSignal({ k: 'search', t: it.title, a: artist, img: it.image, ts: it.timestamp });
      }
    }
    lastSearchTs = Math.max(lastSearchTs, ...getRecentSearches().map((x) => x.timestamp || 0));
  });
}

/** Spotify's recent plays are copied into our own history (with their real dates) */
function importSpotifyRecent() {
  const recent = useSpotifyDataStore.getState().recentlyPlayed || [];
  if (!recent.length) return;
  const list = readSignals();
  const have = new Set(list.filter((s) => s.k === 'spotify').map((s) => `${s.id}|${s.ts}`));
  let added = 0;
  for (const r of recent) {
    const tr = asTrack(r);
    if (!tr) continue;
    const ts = Date.parse(r?.played_at || '') || 0;
    if (!ts) continue;
    const key = `${tr.id}|${ts}`;
    if (have.has(key)) continue;
    have.add(key);
    list.push({ k: 'spotify', t: tr.name, a: firstArtist(tr), id: tr.id, img: coverOf(tr), ts });
    added++;
  }
  if (added) {
    writeSignals(list.sort((a, b) => a.ts - b.ts));
    newSignals += added;
  }
}

// ---------------------------------------------------------------------------
// 2. Taste profile
// ---------------------------------------------------------------------------
interface ArtistTaste {
  name: string;
  score: number;
  recent: number; // last 30 days only
  img?: string;
}
interface TrackTaste {
  track: Track;
  score: number;
  recent: number;
  last: number;
}
export interface TasteProfile {
  artists: ArtistTaste[];
  tracks: TrackTaste[];
  known: Set<string>; // trackKey of everything the user already has
  knownArtists: Set<string>;
}

function makeTrack(id: string | undefined, title: string, artist: string, img?: string): Track {
  return {
    id: id || `sf-${hash(trackKey(title, artist)).toString(36)}`,
    name: title,
    artists: [{ id: `art-${norm(artist).replace(/\s+/g, '-')}`, name: artist }],
    album: { id: '', name: '', images: img ? [{ url: img }] : [] },
    duration_ms: 200000,
  } as Track;
}

export function buildTasteProfile(): TasteProfile {
  const now = Date.now();
  const artists = new Map<string, ArtistTaste>();
  const tracks = new Map<string, TrackTaste>();
  const known = new Set<string>();
  const knownArtists = new Set<string>();

  const addArtist = (name: string, w: number, recentW: number, img?: string) => {
    const k = norm(name);
    if (!k) return;
    const a = artists.get(k) || { name, score: 0, recent: 0 };
    a.score += w;
    a.recent += recentW;
    if (img && !a.img) a.img = img;
    artists.set(k, a);
    if (w > 0) knownArtists.add(k);
  };
  const addTrack = (tr: Track, w: number, recentW: number, ts: number) => {
    const k = trackKey(tr.name, firstArtist(tr));
    if (!k || k === '|') return;
    known.add(k);
    const x = tracks.get(k) || { track: tr, score: 0, recent: 0, last: 0 };
    x.score += w;
    x.recent += recentW;
    x.last = Math.max(x.last, ts);
    if (!coverOf(x.track) && coverOf(tr)) x.track = tr;
    tracks.set(k, x);
  };

  // Spotify's starting data (library) fades over ~6 months since this account started using
  // Spotifree; its top artists / songs are re-read every day, so they never weigh less than half
  const baseline = Math.pow(0.5, (now - firstSeen()) / (180 * DAY));
  const topWeight = Math.max(0.5, baseline);
  const st = useSpotifyDataStore.getState();
  (st.topArtists || []).forEach((a: any, i: number) => addArtist(a?.name, (3 - Math.min(2, i / 10)) * topWeight, 0, a?.images?.[0]?.url));
  (st.topTracks || []).forEach((t: any, i: number) => {
    const tr = asTrack(t);
    if (!tr) return;
    const w = (2 - Math.min(1.5, i / 20)) * topWeight;
    addTrack(tr, w, 0, 0);
    addArtist(firstArtist(tr), w * 0.6, 0);
  });
  for (const p of st.playlists || []) {
    const isLiked = p.id === 'liked-songs';
    const items = (p.tracks?.items || []).slice(0, isLiked ? 400 : 120);
    for (const x of items) {
      const tr = asTrack(x);
      if (!tr) continue;
      const w = (isLiked ? 1.5 : 0.35) * baseline;
      addTrack(tr, w, 0, 0);
      addArtist(firstArtist(tr), w * 0.5, 0);
    }
  }
  // Our own play statistics (no dates): moderate weight
  // (only this account's: another account's statistics must never mix in)
  const stats = useStatsStore.getState();
  if ((stats.currentUserId || 'local') === uid()) {
    for (const a of Object.values(stats.artists || {})) addArtist(a.name, Math.min(6, Math.log2(1 + a.plays)) * 0.6, 0, a.image);
  }

  // Onboarding taste seeds chosen by the user: strong starting baseline
  for (const s of getOnboardingArtistSeeds()) {
    addArtist(s.name, 4.5, 4.5, s.image);
  }

  // Everything that happened in Spotifree (and Spotify's recent plays), fading with age
  for (const s of readSignals()) {
    const ageDays = (now - s.ts) / DAY;
    const w = WEIGHT[s.k] * Math.pow(0.5, ageDays / HALF_LIFE_DAYS[s.k]);
    const recentW = ageDays <= 30 ? WEIGHT[s.k] : 0;
    addArtist(s.a, w * (s.t ? 0.7 : 1), recentW * 0.7, undefined);
    if (s.t) addTrack(makeTrack(s.id, s.t, s.a, s.img), w, recentW, s.ts);
  }

  return {
    artists: [...artists.values()].filter((a) => a.score > 0.2).sort((a, b) => b.score - a.score),
    tracks: [...tracks.values()].filter((t) => t.score > 0).sort((a, b) => b.score - a.score),
    known,
    knownArtists,
  };
}

// ---------------------------------------------------------------------------
// 3. New music (server: /api/discover), cached 3 days per artist
// ---------------------------------------------------------------------------
interface Discover {
  artist: { name: string; picture: string | null } | null;
  top: Track[];
  related: Array<{ name: string; picture: string | null; top: Track[] }>;
  recent: Array<{ title: string; date: string; cover: string | null; tracks: Track[] }>;
}
async function discover(artist: string): Promise<Discover | null> {
  // v2: the server now finds the artist's new releases (older cached answers had none)
  const key = `discover2:${norm(artist)}`;
  const cached = await kvGet<{ t: number; v: Discover }>(key);
  if (cached && Date.now() - cached.t < 2 * DAY) return cached.v;
  try {
    const r = await fetch(`/api/discover?artist=${encodeURIComponent(artist)}&v=2`);
    if (!r.ok) return cached?.v || null;
    const v = (await r.json()) as Discover & { error?: string };
    if (!v.error && v.artist) await kvSet(key, { t: Date.now(), v });
    return v.artist ? v : cached?.v || null;
  } catch {
    return cached?.v || null;
  }
}

// ---------------------------------------------------------------------------
// 4. Covers (drawn on the device; vary each time)
// ---------------------------------------------------------------------------
function loadImg(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url || isPlaceholderOrAvatar(url)) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (isDeezerSilhouette(img)) return resolve(null);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = url;
    setTimeout(() => resolve(null), 6000);
  });
}
function avgColor(img: HTMLImageElement): string {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 12;
    const x = c.getContext('2d')!;
    x.drawImage(img, 0, 0, 12, 12);
    const d = x.getImageData(0, 0, 12, 12).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) {
      r += d[i];
      g += d[i + 1];
      b += d[i + 2];
    }
    const n = d.length / 4;
    // Darkened, slightly saturated: white text always readable
    const k = 0.62;
    return `rgb(${Math.round((r / n) * k)},${Math.round((g / n) * k)},${Math.round((b / n) * k)})`;
  } catch {
    return '#1e3264';
  }
}
function wrapTitle(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function drawImageAspectCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
  const imgW = img.naturalWidth || img.width || 1;
  const imgH = img.naturalHeight || img.height || 1;
  const imgRatio = imgW / imgH;
  const targetRatio = dw / dh;
  let sx = 0, sy = 0, sw = imgW, sh = imgH;
  if (imgRatio > targetRatio) {
    sw = sh * targetRatio;
    sx = (imgW - sw) / 2;
  } else {
    sh = sw / targetRatio;
    sy = (imgH - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

export function makeBannerCoverSvg(title: string, color: string, images: string[] = []): string {
  const S = 600;
  const pal = getBannerPalette(title, color);
  const validImages = (images || []).filter((u) => u && !isPlaceholderOrAvatar(u));
  const imgUrl = validImages[0] || resolveArtistPhoto(title);
  const cleanTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const barX = 32;
  const barY = 445;
  const barW = S - 64; // 536
  const barH = 78;
  const pillX = barX + 16; // 48
  const pillY = barY + 14; // 459
  const pillW = 8;
  const pillH = barH - 28; // 50
  const textX = pillX + pillW + 16; // 72
  const textY = barY + 50; // 495
  const fontSize = cleanTitle.length > 20 ? 25 : cleanTitle.length > 15 ? 28 : 32;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>
      <linearGradient id="photoShadow" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.45)"/>
      </linearGradient>
    </defs>
    <!-- 100% Full-bleed background photo -->
    <rect width="${S}" height="${S}" fill="#141414"/>
    ${imgUrl ? `<image href="${imgUrl}" x="0" y="0" width="${S}" height="${S}" preserveAspectRatio="xMidYMid slice"/>` : ''}
    <rect x="0" y="360" width="${S}" height="240" fill="url(#photoShadow)"/>
    <!-- Top-left subtle circular logo badge -->
    <circle cx="52" cy="52" r="18" fill="rgba(255,255,255,0.92)"/>
    <rect x="44" y="46" width="2.5" height="12" rx="1.2" fill="#121212"/>
    <rect x="50.5" y="43" width="2.5" height="18" rx="1.2" fill="#121212"/>
    <rect x="57" y="45" width="2.5" height="14" rx="1.2" fill="#121212"/>
    <!-- Floating horizontal banner bar (Daddy Yankee style) -->
    <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="10" fill="${pal.banner}"/>
    <!-- Left vertical accent pill -->
    <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="3" fill="${pal.pill}"/>
    <!-- Banner title -->
    <text x="${textX}" y="${textY}" fill="${pal.text}" font-family="'SpotifyMixUITitle', 'Circular', -apple-system, sans-serif" font-weight="900" font-size="${fontSize}" letter-spacing="-0.5">${cleanTitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function makeCollageCoverSvg(title: string, color: string, images: string[] = []): string {
  const S = 600;
  const half = S / 2;
  const cleanColor = color || '#1e3264';
  const cleanTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const valid = (images || []).filter((u) => u && !isPlaceholderOrAvatar(u));
  while (valid.length < 4) {
    const idx = (valid.length + Math.abs(hash(title))) % MUSIC_PORTRAIT_FALLBACKS.length;
    valid.push(MUSIC_PORTRAIT_FALLBACKS[idx]);
  }
  const [img0, img1, img2, img3] = valid;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>
      <linearGradient id="gridBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${cleanColor}"/>
        <stop offset="100%" stop-color="#0a0a0a"/>
      </linearGradient>
      <linearGradient id="overlay" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
        <stop offset="65%" stop-color="rgba(0,0,0,0.65)"/>
        <stop offset="100%" stop-color="rgba(0,0,0,0.95)"/>
      </linearGradient>
    </defs>
    <rect width="${S}" height="${S}" fill="url(#gridBg)"/>
    ${img0 ? `<image href="${img0}" x="0" y="0" width="${half}" height="${half}" preserveAspectRatio="xMidYMid slice"/>` : ''}
    ${img1 ? `<image href="${img1}" x="${half}" y="0" width="${half}" height="${half}" preserveAspectRatio="xMidYMid slice"/>` : ''}
    ${img2 ? `<image href="${img2}" x="0" y="${half}" width="${half}" height="${half}" preserveAspectRatio="xMidYMid slice"/>` : ''}
    ${img3 ? `<image href="${img3}" x="${half}" y="${half}" width="${half}" height="${half}" preserveAspectRatio="xMidYMid slice"/>` : ''}
    <line x1="${half}" y1="0" x2="${half}" y2="${S}" stroke="#0a0a0a" stroke-width="3"/>
    <line x1="0" y1="${half}" x2="${S}" y2="${half}" stroke="#0a0a0a" stroke-width="3"/>
    <rect x="0" y="${S * 0.45}" width="${S}" height="${S * 0.55}" fill="url(#overlay)"/>
    <rect x="36" y="42" width="4.5" height="15" fill="#ffffff" opacity="0.9"/>
    <rect x="44.5" y="36" width="4.5" height="23" fill="#ffffff" opacity="0.9"/>
    <rect x="53" y="39" width="4.5" height="18" fill="#ffffff" opacity="0.9"/>
    <text x="68" y="53" fill="#ffffff" opacity="0.9" font-family="'SpotifyMixUI', 'Circular', sans-serif" font-weight="700" font-size="16" letter-spacing="0.5">SPOTIFREE MIX</text>
    <text x="36" y="${S - 46}" fill="#ffffff" font-family="'SpotifyMixUITitle', 'Circular', sans-serif" font-weight="900" font-size="44" letter-spacing="-0.5">${cleanTitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function makeGeometricCoverSvg(title: string, color: string): string {
  const S = 600;
  const cleanColor = color || '#1ed760';
  const cleanTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>
      <linearGradient id="geomBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${cleanColor}"/>
        <stop offset="60%" stop-color="#141414"/>
        <stop offset="100%" stop-color="#0a0a0a"/>
      </linearGradient>
    </defs>
    <rect width="${S}" height="${S}" fill="url(#geomBg)"/>
    <circle cx="${S * 0.75}" cy="${S * 0.28}" r="${S * 0.38}" fill="none" stroke="${cleanColor}" stroke-width="3" opacity="0.25"/>
    <circle cx="${S * 0.75}" cy="${S * 0.28}" r="${S * 0.26}" fill="none" stroke="${cleanColor}" stroke-width="2.5" opacity="0.18"/>
    <rect x="36" y="42" width="4.5" height="15" fill="#ffffff" opacity="0.9"/>
    <rect x="44.5" y="36" width="4.5" height="23" fill="#ffffff" opacity="0.9"/>
    <rect x="53" y="39" width="4.5" height="18" fill="#ffffff" opacity="0.9"/>
    <text x="68" y="53" fill="#ffffff" opacity="0.9" font-family="'SpotifyMixUI', 'Circular', sans-serif" font-weight="700" font-size="16" letter-spacing="0.5">SPOTIFREE MIX</text>
    <text x="36" y="${S - 46}" fill="#ffffff" font-family="'SpotifyMixUITitle', 'Circular', sans-serif" font-weight="900" font-size="44" letter-spacing="-0.5">${cleanTitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export type CoverStyle = 'banner' | 'badge' | 'collage' | 'geometric' | 'artist' | 'single';

async function makeCover(title: string, style: CoverStyle, images: string[], accent?: string): Promise<string | null> {
  const normStyle: 'banner' | 'badge' | 'collage' | 'geometric' =
    style === 'artist' ? 'badge' : style === 'single' ? 'banner' : style;

  const hue = hash(title) % 360;
  const defaultColor = `hsl(${hue}, 68%, 38%)`;
  let baseColor = accent || defaultColor;

  if (typeof document === 'undefined') {
    if (normStyle === 'banner') return makeBannerCoverSvg(title, baseColor, images);
    if (normStyle === 'badge') return makeEraCoverSvg(title, baseColor, title, images, 'Spotifree Mix');
    if (normStyle === 'collage') return makeCollageCoverSvg(title, baseColor, images);
    return makeGeometricCoverSvg(title, baseColor);
  }

  try {
    const S = 480;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    if (!ctx) {
      if (normStyle === 'banner') return makeBannerCoverSvg(title, baseColor, images);
      if (normStyle === 'badge') return makeEraCoverSvg(title, baseColor, title, images, 'Spotifree Mix');
      if (normStyle === 'collage') return makeCollageCoverSvg(title, baseColor, images);
      return makeBannerCoverSvg(title, baseColor, images);
    }

    if (!accent && images.length > 0 && images[0]) {
      try {
        const loaded = await loadImg(images[0]);
        if (loaded) baseColor = avgColor(loaded);
      } catch {}
    }

    // 1. STYLE: BANNER (Daddy Yankee Top Mixes style: foto completa + barra flotante inferior con acento vertical)
    if (normStyle === 'banner') {
      const pal = getBannerPalette(title, accent);
      let imgLoaded: HTMLImageElement | null = null;
      const targetImgUrl = images[0] || resolveArtistPhoto(title);
      if (targetImgUrl) {
        try { imgLoaded = await loadImg(targetImgUrl); } catch {}
      }
      if (!imgLoaded) {
        const fallbackUrl = resolveArtistPhoto(title);
        try { imgLoaded = await loadImg(fallbackUrl); } catch {}
      }

      if (imgLoaded) {
        drawImageAspectCover(ctx, imgLoaded, 0, 0, S, S);
        const shadow = ctx.createLinearGradient(0, S * 0.58, 0, S);
        shadow.addColorStop(0, 'rgba(0,0,0,0)');
        shadow.addColorStop(1, 'rgba(0,0,0,0.48)');
        ctx.fillStyle = shadow;
        ctx.fillRect(0, S * 0.58, S, S * 0.42);
      } else {
        const g = ctx.createLinearGradient(0, 0, S, S);
        g.addColorStop(0, pal.banner);
        g.addColorStop(1, '#121212');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
      }

      // Top-left subtle circular logo badge
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.arc(42, 42, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#121212';
      ctx.fillRect(35.5, 37, 2, 10);
      ctx.fillRect(41, 34.5, 2, 15);
      ctx.fillRect(46.5, 36, 2, 12);
      ctx.restore();

      // Floating bottom banner bar (1:1 with Spotify 2000s Mix / Chill Mix)
      const barX = Math.round(S * 0.053); // ~26px
      const barY = Math.round(S * 0.74);  // ~355px
      const barW = S - barX * 2;
      const barH = Math.round(S * 0.13);  // ~62px
      const pillW = Math.max(6, Math.round(barH * 0.12));
      const pillH = barH - 22;
      const pillX = barX + 14;
      const pillY = barY + 11;
      const textX = pillX + pillW + 14;
      const textY = barY + Math.round(barH * 0.65);

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = pal.banner;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barH, 9);
        ctx.fill();
      } else {
        ctx.fillRect(barX, barY, barW, barH);
      }
      ctx.restore();

      // Left vertical accent pill
      ctx.save();
      ctx.fillStyle = pal.pill;
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 3);
        ctx.fill();
      } else {
        ctx.fillRect(pillX, pillY, pillW, pillH);
      }
      ctx.restore();

      // Banner Title
      ctx.save();
      const fontSize = title.length > 20 ? 21 : title.length > 15 ? 24 : 27;
      ctx.font = `900 ${fontSize}px "SpotifyMixUITitle", "Montserrat", system-ui, sans-serif`;
      ctx.fillStyle = pal.text;
      ctx.fillText(title, textX, textY, barW - (textX - barX) - 16);
      ctx.restore();

      return c.toDataURL('image/jpeg', 0.88);
    }

    // 2. STYLE: BADGE (Diseño con foto circular como Rock Mix / Pop Mix de la Imagen 3)
    if (normStyle === 'badge') {
      const g = ctx.createLinearGradient(0, 0, S, S);
      g.addColorStop(0, baseColor);
      g.addColorStop(0.55, '#141414');
      g.addColorStop(1, '#0a0a0a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);

      const cx = S * 0.5;
      const cy = S * 0.41;
      const r = S * 0.24;

      // Vinyl groove rings
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(baseColor, 0.32);
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.85, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(baseColor, 0.16);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Circular image cutout
      let imgLoaded: HTMLImageElement | null = null;
      const targetImgUrl = images[0] || resolveArtistPhoto(title);
      if (targetImgUrl) {
        try { imgLoaded = await loadImg(targetImgUrl); } catch {}
      }
      if (!imgLoaded) {
        try { imgLoaded = await loadImg(resolveArtistPhoto(title)); } catch {}
      }

      if (imgLoaded) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        drawImageAspectCover(ctx, imgLoaded, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Top branding
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(28, 36, 3.5, 11);
      ctx.fillRect(34.5, 33, 3.5, 17);
      ctx.fillRect(41, 35, 3.5, 13);
      ctx.font = '700 13px "SpotifyMixUI", system-ui, sans-serif';
      ctx.fillText('SPOTIFREE MIX', 52, 46);
      ctx.restore();

      // Bold title at bottom
      ctx.save();
      ctx.font = '900 34px "SpotifyMixUITitle", "Montserrat", system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 10;
      const lines = wrapTitle(ctx, title, S - 56);
      lines.forEach((l, i) => ctx.fillText(l, 28, S - 34 - (lines.length - 1 - i) * 38));
      ctx.restore();

      return c.toDataURL('image/jpeg', 0.88);
    }

    // 3. STYLE: COLLAGE (4 fotos de canciones de la playlist en grid 2x2)
    if (normStyle === 'collage') {
      const half = S / 2;
      const loadedImgs = await Promise.all(images.slice(0, 4).map((u) => loadImg(u).catch(() => null)));

      const positions = [
        { dx: 0, dy: 0 },
        { dx: half, dy: 0 },
        { dx: 0, dy: half },
        { dx: half, dy: half },
      ];

      positions.forEach((p, idx) => {
        const limg = loadedImgs[idx];
        if (limg) {
          drawImageAspectCover(ctx, limg, p.dx, p.dy, half, half);
        } else {
          ctx.fillStyle = idx === 0 ? baseColor : idx === 1 ? '#181818' : idx === 2 ? '#222222' : '#141414';
          ctx.fillRect(p.dx, p.dy, half, half);
        }
      });

      // Grid dividers
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(half - 1.5, 0, 3, S);
      ctx.fillRect(0, half - 1.5, S, 3);

      // Gradient overlay at bottom for text readability
      const overlay = ctx.createLinearGradient(0, S * 0.45, 0, S);
      overlay.addColorStop(0, 'rgba(0,0,0,0)');
      overlay.addColorStop(0.65, 'rgba(0,0,0,0.7)');
      overlay.addColorStop(1, 'rgba(0,0,0,0.96)');
      ctx.fillStyle = overlay;
      ctx.fillRect(0, S * 0.45, S, S * 0.55);

      // Top branding
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(28, 36, 3.5, 11);
      ctx.fillRect(34.5, 33, 3.5, 17);
      ctx.fillRect(41, 35, 3.5, 13);
      ctx.font = '700 13px "SpotifyMixUI", system-ui, sans-serif';
      ctx.fillText('SPOTIFREE MIX', 52, 46);
      ctx.restore();

      // Title
      ctx.save();
      ctx.font = '900 32px "SpotifyMixUITitle", "Montserrat", system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 10;
      const lines = wrapTitle(ctx, title, S - 56);
      lines.forEach((l, i) => ctx.fillText(l, 28, S - 32 - (lines.length - 1 - i) * 36));
      ctx.restore();

      return c.toDataURL('image/jpeg', 0.88);
    }

    // 4. STYLE: GEOMETRIC (Diseño gráfico con gradientes y ondas)
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, baseColor);
    g.addColorStop(0.65, '#161616');
    g.addColorStop(1, '#0c0c0c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    ctx.save();
    ctx.beginPath();
    ctx.arc(S * 0.85, S * 0.18, S * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(baseColor.startsWith('#') ? baseColor : '#1ed760', 0.22);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(28, 36, 3.5, 11);
    ctx.fillRect(34.5, 33, 3.5, 17);
    ctx.fillRect(41, 35, 3.5, 13);
    ctx.font = '700 13px "SpotifyMixUI", system-ui, sans-serif';
    ctx.fillText('SPOTIFREE MIX', 52, 46);
    ctx.restore();

    ctx.font = '900 34px "SpotifyMixUITitle", "Montserrat", system-ui, sans-serif';
    const lines = wrapTitle(ctx, title, S - 56);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    lines.forEach((l, i) => ctx.fillText(l, 28, S - 36 - (lines.length - 1 - i) * 38));
    ctx.shadowBlur = 0;

    return c.toDataURL('image/jpeg', 0.88);
  } catch {
    if (normStyle === 'banner') return makeBannerCoverSvg(title, baseColor, images);
    if (normStyle === 'badge') return makeEraCoverSvg(title, baseColor, title, images, 'Spotifree Mix');
    if (normStyle === 'collage') return makeCollageCoverSvg(title, baseColor, images);
    return makeBannerCoverSvg(title, baseColor, images);
  }
}

// ---------------------------------------------------------------------------
// 5. Building the playlists
// ---------------------------------------------------------------------------
export interface SpotifreeMix extends Playlist {
  sfKind: 'daily' | 'discover' | 'radar' | 'repeat' | 'classics' | 'artist' | 'soundcloud' | 'era' | 'genre' | 'mood' | 'trending';
}


export function getWeeklyRotationSeed(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const diffDays = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 3600 * 1000));
  const weekNumber = Math.floor(diffDays / 7) + 1;
  return now.getFullYear() * 100 + weekNumber;
}

export function selectWeeklyTracks<T>(pool: T[], count = 25, seedOffset = 0): T[] {
  if (!pool || pool.length <= count) return pool || [];
  const seed = getWeeklyRotationSeed() + seedOffset;
  const copy = [...pool];
  let s = (seed * 9301 + 49297) % 233280;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const rnd = s / 233280;
    const j = Math.floor(rnd * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, count);
}

function hexToRgba(hex: string, alpha = 1): string {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(30, 50, 100, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toProxiedImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/api/')) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function loadCoverPhoto(url: string, timeoutMs = 2800): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let done = false;
    let triedProxy = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, timeoutMs);
    img.onload = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        if (isDeezerSilhouette(img)) {
          return resolve(null);
        }
        resolve(img);
      }
    };
    img.onerror = () => {
      if (!done && !triedProxy && !url.includes('/api/image-proxy')) {
        triedProxy = true;
        img.src = toProxiedImageUrl(url);
        return;
      }
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(null);
      }
    };
    img.src = toProxiedImageUrl(url);
  });
}

export function makeEraCoverSvg(
  decadeOrStyle: string,
  color: string,
  _customTitle?: string,
  images: string[] = [],
  _subtitle = 'Actualizado esta semana · Spotifree'
): string {
  const validImages = (images || []).filter((u) => u && !isPlaceholderOrAvatar(u));
  const heroImg = validImages[0] || resolveArtistPhoto(decadeOrStyle);
  const cleanBadge = decadeOrStyle.replace(/^(Mix\s+|Años\s+)/i, '').trim();
  const mainTitle = decadeOrStyle.startsWith('Años ') ? decadeOrStyle : cleanBadge;
  const isLong = mainTitle.length > 7;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color}"/>
        <stop offset="55%" stop-color="#141414"/>
        <stop offset="100%" stop-color="#0a0a0a"/>
      </linearGradient>
      <radialGradient id="radialGlow" cx="25%" cy="25%" r="75%">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.45"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="bottomFade" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0a0a0a" stop-opacity="0"/>
        <stop offset="50%" stop-color="#0a0a0a" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#0a0a0a" stop-opacity="0.95"/>
      </linearGradient>
      <clipPath id="artistCircle">
        <circle cx="390" cy="225" r="160"/>
      </clipPath>
    </defs>
    <rect width="600" height="600" fill="url(#bg)"/>
    <rect width="600" height="600" fill="url(#radialGlow)"/>
    <circle cx="560" cy="90" r="230" fill="${color}" opacity="0.22"/>
    ${heroImg ? `
      <!-- Hero artist photo with high clarity and contrast -->
      <circle cx="390" cy="225" r="164" fill="none" stroke="${color}" stroke-width="4" opacity="0.75"/>
      <circle cx="390" cy="225" r="160" fill="#181818"/>
      <image href="${heroImg}" x="230" y="65" width="320" height="320" preserveAspectRatio="xMidYMid slice" clip-path="url(#artistCircle)"/>
    ` : `
      <!-- Stylized Vinyl / Sound Arc graphic when no image is available -->
      <circle cx="390" cy="225" r="150" fill="none" stroke="${color}" stroke-width="2.5" opacity="0.35"/>
      <circle cx="390" cy="225" r="105" fill="none" stroke="${color}" stroke-width="2" opacity="0.25"/>
      <circle cx="390" cy="225" r="55" fill="none" stroke="${color}" stroke-width="3" opacity="0.45"/>
    `}
    <rect x="0" y="280" width="600" height="320" fill="url(#bottomFade)"/>
    <!-- Top-left subtle circular logo badge -->
    <circle cx="52" cy="52" r="18" fill="rgba(255,255,255,0.92)"/>
    <rect x="44" y="46" width="2.5" height="12" rx="1.2" fill="#121212"/>
    <rect x="50.5" y="43" width="2.5" height="18" rx="1.2" fill="#121212"/>
    <rect x="57" y="45" width="2.5" height="14" rx="1.2" fill="#121212"/>
    <text x="80" y="58" font-family="Circular, SpotifyMixUI, system-ui, sans-serif" font-weight="700" font-size="14" fill="rgba(255,255,255,0.9)" letter-spacing="2">SPOTIFREE MIX</text>
    <!-- Bottom-left Spotify Bold Title -->
    <g transform="translate(42, 490)">
      <text x="0" y="0" font-family="Circular, SpotifyMixUITitle, system-ui, sans-serif" font-weight="900" font-size="${isLong ? 62 : 76}" fill="#ffffff" letter-spacing="-2">${mainTitle}</text>
      <text x="0" y="58" font-family="Circular, SpotifyMixUITitle, system-ui, sans-serif" font-weight="900" font-size="${isLong ? 62 : 76}" fill="#ffffff" letter-spacing="-2">Mix</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export async function makeCuratedThemedCover(
  badgeText: string,
  title: string,
  color: string,
  images: string[] = [],
  subtitle = 'Actualizado esta semana · Spotifree',
  style: CoverStyle = 'banner'
): Promise<string> {
  const validImages = (images || []).filter((u) => u && !isPlaceholderOrAvatar(u));
  if (style === 'banner') {
    const res = await makeCover(title, 'banner', validImages, color);
    if (res) return res;
  }
  if (style === 'collage' && validImages.length >= 2) {
    const res = await makeCover(title, 'collage', validImages, color);
    if (res) return res;
  }

  const S = 600;
  // If in node or without DOM canvas (e.g. unit tests), gracefully return high-res SVG
  if (typeof document === 'undefined') {
    return makeEraCoverSvg(badgeText, color, title, validImages, subtitle);
  }

  try {
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    if (!ctx) return makeEraCoverSvg(badgeText, color, title, validImages, subtitle);

    // 1. Vibrant diagonal gradient
    const bg = ctx.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, color);
    bg.addColorStop(0.55, '#141414');
    bg.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);

    // 2. Radial glow
    const flare = ctx.createRadialGradient(150, 150, 10, 150, 150, 450);
    flare.addColorStop(0, hexToRgba(color, 0.45));
    flare.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = flare;
    ctx.fillRect(0, 0, S, S);

    // Top-right background arc
    ctx.save();
    ctx.globalAlpha = 0.58;
    ctx.beginPath();
    ctx.arc(560, 90, 230, 0, Math.PI * 2);
    ctx.fillStyle = hexToRgba(color, 0.35);
    ctx.fill();
    ctx.restore();

    // 3. Artist Hero Portrait in circular cutout with high clarity & border glow
    const loadedImgs = (
      await Promise.all(validImages.slice(0, 2).map((u) => loadCoverPhoto(u, 2500)))
    ).filter(Boolean) as HTMLImageElement[];

    const cx = 390;
    const cy = 225;
    const r = 160;

    if (loadedImgs.length > 0) {
      const im = loadedImgs[0];
      const s = Math.min(im.naturalWidth, im.naturalHeight);

      // Shadow behind circle
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#181818';
      ctx.fill();
      ctx.restore();

      // Draw clipped photo
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2);
      ctx.restore();

      // Border ring
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    } else {
      // Vinyl/wave rings
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, 150, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(color, 0.35);
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 105, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(color, 0.25);
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 55, 0, Math.PI * 2);
      ctx.strokeStyle = hexToRgba(color, 0.45);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Subtle bottom gradient fade for crisp typography legibility
    const bottomFade = ctx.createLinearGradient(0, 280, 0, S);
    bottomFade.addColorStop(0, 'rgba(10, 10, 10, 0)');
    bottomFade.addColorStop(0.5, 'rgba(10, 10, 10, 0.5)');
    bottomFade.addColorStop(1, 'rgba(10, 10, 10, 0.95)');
    ctx.fillStyle = bottomFade;
    ctx.fillRect(0, 280, S, 320);

    // 5. Top-left Spotify Mix header (3 sound bars + SPOTIFREE MIX)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    // 3 sound bars
    ctx.fillRect(42, 48, 3.5, 12);
    ctx.fillRect(48, 44, 3.5, 18);
    ctx.fillRect(54, 47, 3.5, 14);

    ctx.font = '700 15px "SpotifyMixUI", "Circular", system-ui, sans-serif';
    ctx.fillText('SPOTIFREE MIX', 66, 58);
    ctx.restore();

    // 6. Bottom-left Bold Spotify Typography
    const cleanBadge = badgeText.replace(/^(Mix\s+|Años\s+)/i, '').trim();
    const mainTitle = badgeText.startsWith('Años ') ? badgeText : cleanBadge;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 12;

    const fontSize = mainTitle.length > 7 ? 62 : 76;
    ctx.font = `900 ${fontSize}px "SpotifyMixUITitle", "Circular", system-ui, sans-serif`;
    ctx.fillText(mainTitle, 42, 490);
    ctx.fillText('Mix', 42, 490 + fontSize * 0.88);
    ctx.restore();

    return c.toDataURL('image/jpeg', 0.85);
  } catch {
    return makeEraCoverSvg(badgeText, color, title, images, subtitle);
  }
}

export const ERA_PLAYLIST_DEFINITIONS = [
  {
    id: 'sf-era-2010s',
    decade: '2010s',
    category: 'era' as const,
    name: 'Mix de los 2010s',
    color: '#3d4085',
    description: 'Los temas que definieron la década de 2010 a 2019: Avicii, The Weeknd, Drake y más.',
    sampleImages: [
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b8/02/bd/b802bd1d-c601-74a9-c194-b2fea8d5ed1b/5026854930541.jpg/600x600bb.jpg',
      'https://i.scdn.co/image/ab67616d00004851c0ca1263b2966ddff794d3bb',
    ],
    pool: [
      { name: 'Wake Me Up', artist: 'Avicii', album: 'True', duration_ms: 247000 },
      { name: 'Starboy', artist: 'The Weeknd, Daft Punk', album: 'Starboy', duration_ms: 230000 },
      { name: 'One Dance', artist: 'Drake, WizKid, Kyla', album: 'Views', duration_ms: 173000 },
      { name: 'One Kiss', artist: 'Calvin Harris, Dua Lipa', album: 'One Kiss', duration_ms: 214000 },
      { name: 'Callaita', artist: 'Bad Bunny', album: 'Callaita', duration_ms: 250000 },
      { name: 'Get Lucky', artist: 'Daft Punk, Pharrell Williams', album: 'Random Access Memories', duration_ms: 248000 },
      { name: 'Chandelier', artist: 'Sia', album: '1000 Forms of Fear', duration_ms: 216000 },
      { name: 'Uptown Funk', artist: 'Mark Ronson, Bruno Mars', album: 'Uptown Special', duration_ms: 269000 },
      { name: 'Shape of You', artist: 'Ed Sheeran', album: '÷ (Divide)', duration_ms: 233000 },
      { name: 'Mi Gente', artist: 'J Balvin, Willy William', album: 'Vibras', duration_ms: 185000 },
      { name: 'Lean On', artist: 'Major Lazer, DJ Snake, MØ', album: 'Peace Is the Mission', duration_ms: 176000 },
      { name: 'bad guy', artist: 'Billie Eilish', album: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?', duration_ms: 194000 },
      { name: 'Radioactive', artist: 'Imagine Dragons', album: 'Night Visions', duration_ms: 186000 },
      { name: 'Sunflower', artist: 'Post Malone, Swae Lee', album: 'Spider-Man: Into the Spider-Verse', duration_ms: 158000 },
      { name: 'Antes de morirme', artist: 'C. Tangana, Rosalía', album: 'Antes de morirme', duration_ms: 202000 },
      { name: 'Titanium', artist: 'David Guetta, Sia', album: 'Nothing but the Beat', duration_ms: 245000 },
      { name: "Don't You Worry Child", artist: 'Swedish House Mafia', album: 'Until Now', duration_ms: 212000 },
      { name: 'Adventure of a Lifetime', artist: 'Coldplay', album: 'A Head Full of Dreams', duration_ms: 263000 },
      { name: 'Señorita', artist: 'Shawn Mendes, Camila Cabello', album: 'Shawn Mendes', duration_ms: 190000 },
      { name: 'Con Altura', artist: 'Rosalía, J Balvin, El Guincho', album: 'Con Altura', duration_ms: 161000 },
      { name: 'Animals', artist: 'Martin Garrix', album: 'Gold Skies', duration_ms: 176000 },
      { name: 'Girls Like You', artist: 'Maroon 5, Cardi B', album: 'Red Pill Blues', duration_ms: 235000 },
      { name: 'Closer', artist: 'The Chainsmokers, Halsey', album: 'Collage', duration_ms: 244000 },
      { name: 'Roar', artist: 'Katy Perry', album: 'PRISM', duration_ms: 223000 },
      { name: 'Rolling in the Deep', artist: 'Adele', album: '21', duration_ms: 228000 },
      { name: 'Timber', artist: 'Pitbull, Kesha', album: 'Meltdown', duration_ms: 204000 },
      { name: '24K Magic', artist: 'Bruno Mars', album: '24K Magic', duration_ms: 226000 },
      { name: 'Royals', artist: 'Lorde', album: 'Pure Heroine', duration_ms: 190000 },
      { name: 'Stressed Out', artist: 'Twenty One Pilots', album: 'Blurryface', duration_ms: 202000 },
      { name: 'Pompeii', artist: 'Bastille', album: 'Bad Blood', duration_ms: 214000 },
      { name: 'Counting Stars', artist: 'OneRepublic', album: 'Native', duration_ms: 257000 },
      { name: 'Thrift Shop', artist: 'Macklemore, Ryan Lewis, Wanz', album: 'The Heist', duration_ms: 235000 },
      { name: 'Sorry', artist: 'Justin Bieber', album: 'Purpose', duration_ms: 200000 },
      { name: 'Shake It Off', artist: 'Taylor Swift', album: '1989', duration_ms: 219000 },
      { name: 'Let Me Love You', artist: 'DJ Snake, Justin Bieber', album: 'Encore', duration_ms: 205000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 1);
    },
  },
  {
    id: 'sf-era-2000s',
    decade: '2000s',
    category: 'era' as const,
    name: 'Mix de los 2000s',
    color: '#e65100',
    description: 'Nostalgia pura de los 2000: Eminem, Coldplay, Linkin Park, Daddy Yankee y más.',
    sampleImages: [
      'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
    ],
    pool: [
      { name: 'Lose Yourself', artist: 'Eminem', album: '8 Mile', duration_ms: 326000 },
      { name: 'Viva La Vida', artist: 'Coldplay', album: 'Viva La Vida or Death and All His Friends', duration_ms: 242000 },
      { name: 'In the End', artist: 'Linkin Park', album: 'Hybrid Theory', duration_ms: 216000 },
      { name: 'Mr. Brightside', artist: 'The Killers', album: 'Hot Fuss', duration_ms: 222000 },
      { name: 'Gasolina', artist: 'Daddy Yankee', album: 'Barrio Fino', duration_ms: 192000 },
      { name: 'Toxic', artist: 'Britney Spears', album: 'In the Zone', duration_ms: 198000 },
      { name: 'Hey Ya!', artist: 'Outkast', album: 'Speakerboxxx/The Love Below', duration_ms: 235000 },
      { name: 'I Gotta Feeling', artist: 'The Black Eyed Peas', album: 'The E.N.D.', duration_ms: 289000 },
      { name: 'Umbrella', artist: 'Rihanna, JAY-Z', album: 'Good Girl Gone Bad', duration_ms: 275000 },
      { name: 'Feel Good Inc.', artist: 'Gorillaz', album: 'Demon Days', duration_ms: 221000 },
      { name: 'Californication', artist: 'Red Hot Chili Peppers', album: 'Californication', duration_ms: 329000 },
      { name: 'Boulevard of Broken Dreams', artist: 'Green Day', album: 'American Idiot', duration_ms: 260000 },
      { name: "Hips Don't Lie", artist: 'Shakira, Wyclef Jean', album: 'Oral Fixation Vol. 2', duration_ms: 218000 },
      { name: 'Dile', artist: 'Don Omar', album: 'The Last Don', duration_ms: 204000 },
      { name: 'This Love', artist: 'Maroon 5', album: 'Songs About Jane', duration_ms: 206000 },
      { name: 'Crazy In Love', artist: 'Beyoncé, JAY-Z', album: 'Dangerously in Love', duration_ms: 236000 },
      { name: 'Take Me Out', artist: 'Franz Ferdinand', album: 'Franz Ferdinand', duration_ms: 237000 },
      { name: 'Vino Tinto', artist: 'Estopa', album: 'Destrangis', duration_ms: 197000 },
      { name: 'La Camisa Negra', artist: 'Juanes', album: 'Mi Sangre', duration_ms: 216000 },
      { name: 'Maneater', artist: 'Nelly Furtado', album: 'Loose', duration_ms: 258000 },
      { name: 'Bring Me to Life', artist: 'Evanescence', album: 'Fallen', duration_ms: 237000 },
      { name: 'In Da Club', artist: '50 Cent', album: 'Get Rich or Die Tryin\'', duration_ms: 193000 },
      { name: 'No One', artist: 'Alicia Keys', album: 'As I Am', duration_ms: 253000 },
      { name: 'Hollaback Girl', artist: 'Gwen Stefani', album: 'Love. Angel. Music. Baby.', duration_ms: 199000 },
      { name: 'Toxicity', artist: 'System of a Down', album: 'Toxicity', duration_ms: 218000 },
      { name: 'The Pretender', artist: 'Foo Fighters', album: 'Echoes, Silence, Patience & Grace', duration_ms: 269000 },
      { name: 'All The Small Things', artist: 'Blink-182', album: 'Enema of the State', duration_ms: 167000 },
      { name: 'In Too Deep', artist: 'Sum 41', album: 'All Killer No Filler', duration_ms: 207000 },
      { name: 'Cry Me a River', artist: 'Justin Timberlake', album: 'Justified', duration_ms: 288000 },
      { name: 'Temperature', artist: 'Sean Paul', album: 'The Trinity', duration_ms: 218000 },
      { name: 'Yeah!', artist: 'Usher, Lil Jon, Ludacris', album: 'Confessions', duration_ms: 250000 },
      { name: 'Yellow', artist: 'Coldplay', album: 'Parachutes', duration_ms: 266000 },
      { name: 'Complicated', artist: 'Avril Lavigne', album: 'Let Go', duration_ms: 244000 },
      { name: 'Numb', artist: 'Linkin Park', album: 'Meteora', duration_ms: 187000 },
      { name: 'Whenever, Wherever', artist: 'Shakira', album: 'Laundry Service', duration_ms: 196000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 2);
    },
  },
  {
    id: 'sf-era-90s',
    decade: '90s',
    category: 'era' as const,
    name: 'Mix de los 90s',
    color: '#7b1fa2',
    description: 'El sonido auténtico de los noventa: Nirvana, Oasis, Red Hot Chili Peppers y Backstreet Boys.',
    sampleImages: [
      'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
      'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/53/f3/fc/53f3fccd-2024-789e-8858-c9562cc1edfa/886449216321.jpg/600x600bb.jpg',
    ],
    pool: [
      { name: 'Smells Like Teen Spirit', artist: 'Nirvana', album: 'Nevermind', duration_ms: 301000 },
      { name: 'Wonderwall', artist: 'Oasis', album: "(What's the Story) Morning Glory?", duration_ms: 258000 },
      { name: 'I Want It That Way', artist: 'Backstreet Boys', album: 'Millennium', duration_ms: 213000 },
      { name: 'Under the Bridge', artist: 'Red Hot Chili Peppers', album: 'Blood Sugar Sex Magik', duration_ms: 264000 },
      { name: 'No Scrubs', artist: 'TLC', album: 'FanMail', duration_ms: 214000 },
      { name: 'California Love', artist: '2Pac, Dr. Dre', album: 'All Eyez on Me', duration_ms: 284000 },
      { name: 'Wannabe', artist: 'Spice Girls', album: 'Spice', duration_ms: 172000 },
      { name: 'Losing My Religion', artist: 'R.E.M.', album: 'Out of Time', duration_ms: 268000 },
      { name: 'Zombie', artist: 'The Cranberries', album: 'No Need to Argue', duration_ms: 306000 },
      { name: 'Creep', artist: 'Radiohead', album: 'Pablo Honey', duration_ms: 238000 },
      { name: 'Macarena', artist: 'Los del Río', album: 'A mí me gusta', duration_ms: 249000 },
      { name: 'Song 2', artist: 'Blur', album: 'Blur', duration_ms: 121000 },
      { name: "Gangsta's Paradise", artist: 'Coolio, L.V.', album: "Gangsta's Paradise", duration_ms: 240000 },
      { name: "Don't Speak", artist: 'No Doubt', album: 'Tragic Kingdom', duration_ms: 263000 },
      { name: 'Corazón Partio', artist: 'Alejandro Sanz', album: 'Más', duration_ms: 345000 },
      { name: "Livin' la Vida Loca", artist: 'Ricky Martin', album: 'Ricky Martin', duration_ms: 243000 },
      { name: 'Killing Me Softly With His Song', artist: 'Fugees', album: 'The Score', duration_ms: 298000 },
      { name: 'Basket Case', artist: 'Green Day', album: 'Dookie', duration_ms: 181000 },
      { name: '...Baby One More Time', artist: 'Britney Spears', album: '...Baby One More Time', duration_ms: 211000 },
      { name: 'Enter Sandman', artist: 'Metallica', album: 'Metallica', duration_ms: 331000 },
      { name: 'Black Hole Sun', artist: 'Soundgarden', album: 'Superunknown', duration_ms: 318000 },
      { name: 'Alive', artist: 'Pearl Jam', album: 'Ten', duration_ms: 340000 },
      { name: 'Self Esteem', artist: 'The Offspring', album: 'Smash', duration_ms: 257000 },
      { name: 'I Will Always Love You', artist: 'Whitney Houston', album: 'The Bodyguard', duration_ms: 271000 },
      { name: 'Believe', artist: 'Cher', album: 'Believe', duration_ms: 239000 },
      { name: 'All Star', artist: 'Smash Mouth', album: 'Astro Lounge', duration_ms: 200000 },
      { name: '1979', artist: 'The Smashing Pumpkins', album: 'Mellon Collie and the Infinite Sadness', duration_ms: 266000 },
      { name: "Don't Look Back in Anger", artist: 'Oasis', album: "(What's the Story) Morning Glory?", duration_ms: 288000 },
      { name: "What's My Age Again?", artist: 'Blink-182', album: 'Enema of the State', duration_ms: 148000 },
      { name: 'Vogue', artist: 'Madonna', album: "I'm Breathless", duration_ms: 316000 },
      { name: 'All That She Wants', artist: 'Ace of Base', album: 'Happy Nation', duration_ms: 211000 },
      { name: 'Smooth', artist: 'Santana, Rob Thomas', album: 'Supernatural', duration_ms: 296000 },
      { name: 'Insomnia', artist: 'Faithless', album: 'Reverence', duration_ms: 275000 },
      { name: 'Torn', artist: 'Natalie Imbruglia', album: 'Left of the Middle', duration_ms: 244000 },
      { name: 'Bitter Sweet Symphony', artist: 'The Verve', album: 'Urban Hymns', duration_ms: 358000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 3);
    },
  },
  {
    id: 'sf-era-80s',
    decade: '80s',
    category: 'era' as const,
    name: 'Mix de los 80s',
    color: '#c2185b',
    description: 'Los himnos inolvidables de los 80: Michael Jackson, Queen, Madonna, a-ha y más.',
    sampleImages: [
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
      'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
    ],
    pool: [
      { name: 'Billie Jean', artist: 'Michael Jackson', album: 'Thriller', duration_ms: 294000 },
      { name: 'Another One Bites the Dust', artist: 'Queen', album: 'The Game', duration_ms: 215000 },
      { name: 'Take On Me', artist: 'a-ha', album: 'Hunting High and Low', duration_ms: 225000 },
      { name: 'Like a Prayer', artist: 'Madonna', album: 'Like a Prayer', duration_ms: 341000 },
      { name: 'I Wanna Dance with Somebody', artist: 'Whitney Houston', album: 'Whitney', duration_ms: 291000 },
      { name: "Sweet Child O' Mine", artist: "Guns N' Roses", album: 'Appetite for Destruction', duration_ms: 355000 },
      { name: "Livin' on a Prayer", artist: 'Bon Jovi', album: 'Slippery When Wet', duration_ms: 249000 },
      { name: 'Girls Just Want to Have Fun', artist: 'Cyndi Lauper', album: "She's So Unusual", duration_ms: 238000 },
      { name: 'Every Breath You Take', artist: 'The Police', album: 'Synchronicity', duration_ms: 253000 },
      { name: "Let's Groove", artist: 'Earth, Wind & Fire', album: 'Raise!', duration_ms: 332000 },
      { name: 'Africa', artist: 'Toto', album: 'Toto IV', duration_ms: 295000 },
      { name: "Don't Stop Believin'", artist: 'Journey', album: 'Escape', duration_ms: 250000 },
      { name: 'Never Gonna Give You Up', artist: 'Rick Astley', album: 'Whenever You Need Somebody', duration_ms: 213000 },
      { name: 'Devuélveme a mi chica', artist: 'Hombres G', album: 'Hombres G', duration_ms: 195000 },
      { name: 'A quién le importa', artist: 'Alaska y Dinarama', album: 'No es pecado', duration_ms: 206000 },
      { name: 'Hijo de la Luna', artist: 'Mecano', album: 'Entre el cielo y el suelo', duration_ms: 261000 },
      { name: 'Careless Whisper', artist: 'George Michael', album: 'Make It Big', duration_ms: 300000 },
      { name: 'Wake Me Up Before You Go-Go', artist: 'Wham!', album: 'Make It Big', duration_ms: 231000 },
      { name: 'With or Without You', artist: 'U2', album: 'The Joshua Tree', duration_ms: 296000 },
      { name: 'Sweet Dreams (Are Made of This)', artist: 'Eurythmics', album: 'Sweet Dreams', duration_ms: 216000 },
      { name: 'Beat It', artist: 'Michael Jackson', album: 'Thriller', duration_ms: 258000 },
      { name: 'Under Pressure', artist: 'Queen, David Bowie', album: 'Hot Space', duration_ms: 248000 },
      { name: 'Back in Black', artist: 'AC/DC', album: 'Back in Black', duration_ms: 255000 },
      { name: 'Everybody Wants to Rule the World', artist: 'Tears for Fears', album: 'Songs from the Big Chair', duration_ms: 251000 },
      { name: "Summer of '69", artist: 'Bryan Adams', album: 'Reckless', duration_ms: 215000 },
      { name: 'Jump', artist: 'Van Halen', album: '1984', duration_ms: 241000 },
      { name: 'The Final Countdown', artist: 'Europe', album: 'The Final Countdown', duration_ms: 309000 },
      { name: 'In the Air Tonight', artist: 'Phil Collins', album: 'Face Value', duration_ms: 334000 },
      { name: 'Money for Nothing', artist: 'Dire Straits', album: 'Brothers in Arms', duration_ms: 504000 },
      { name: 'Escuela de calor', artist: 'Radio Futura', album: 'La ley del desierto / La ley del mar', duration_ms: 211000 },
      { name: 'Born in the U.S.A.', artist: 'Bruce Springsteen', album: 'Born in the U.S.A.', duration_ms: 279000 },
      { name: 'Footloose', artist: 'Kenny Loggins', album: 'Footloose', duration_ms: 226000 },
      { name: 'Call Me', artist: 'Blondie', album: 'American Gigolo', duration_ms: 212000 },
      { name: 'Should I Stay or Should I Go', artist: 'The Clash', album: 'Combat Rock', duration_ms: 188000 },
      { name: "Just Can't Get Enough", artist: 'Depeche Mode', album: 'Speak & Spell', duration_ms: 222000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 4);
    },
  },
  {
    id: 'sf-era-70s',
    decade: '70s',
    category: 'era' as const,
    name: 'Mix de los 70s',
    color: '#00796b',
    description: 'Los clásicos dorados de los 70: Queen, ABBA, Bee Gees, Fleetwood Mac, Elton John y más.',
    sampleImages: [
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
      'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
    ],
    pool: [
      { name: 'Bohemian Rhapsody', artist: 'Queen', album: 'A Night at the Opera', duration_ms: 354000 },
      { name: 'Dancing Queen', artist: 'ABBA', album: 'Arrival', duration_ms: 230000 },
      { name: "Stayin' Alive", artist: 'Bee Gees', album: 'Saturday Night Fever', duration_ms: 285000 },
      { name: 'Dreams', artist: 'Fleetwood Mac', album: 'Rumours', duration_ms: 257000 },
      { name: 'Rocket Man', artist: 'Elton John', album: 'Honky Château', duration_ms: 281000 },
      { name: 'Stairway to Heaven', artist: 'Led Zeppelin', album: 'Led Zeppelin IV', duration_ms: 482000 },
      { name: 'Wish You Were Here', artist: 'Pink Floyd', album: 'Wish You Were Here', duration_ms: 334000 },
      { name: 'September', artist: 'Earth, Wind & Fire', album: 'The Best of Earth, Wind & Fire, Vol. 1', duration_ms: 215000 },
      { name: 'Hotel California', artist: 'Eagles', album: 'Hotel California', duration_ms: 391000 },
      { name: 'Superstition', artist: 'Stevie Wonder', album: 'Talking Book', duration_ms: 245000 },
      { name: 'Heroes', artist: 'David Bowie', album: 'Heroes', duration_ms: 367000 },
      { name: 'Beast of Burden', artist: 'The Rolling Stones', album: 'Some Girls', duration_ms: 265000 },
      { name: 'More Than a Feeling', artist: 'Boston', album: 'Boston', duration_ms: 285000 },
      { name: 'Highway to Hell', artist: 'AC/DC', album: 'Highway to Hell', duration_ms: 208000 },
      { name: 'Le Freak', artist: 'Chic', album: 'C\'est Chic', duration_ms: 327000 },
      { name: 'Hot Stuff', artist: 'Donna Summer', album: 'Bad Girls', duration_ms: 314000 },
      { name: 'Heart of Glass', artist: 'Blondie', album: 'Parallel Lines', duration_ms: 275000 },
      { name: 'Imagine', artist: 'John Lennon', album: 'Imagine', duration_ms: 183000 },
      { name: 'Sultans of Swing', artist: 'Dire Straits', album: 'Dire Straits', duration_ms: 348000 },
      { name: 'The Logical Song', artist: 'Supertramp', album: 'Breakfast in America', duration_ms: 250000 },
      { name: 'Rasputin', artist: 'Boney M.', album: 'Nightflight to Venus', duration_ms: 351000 },
      { name: 'Roxanne', artist: 'The Police', album: 'Outlandos d\'Amour', duration_ms: 194000 },
      { name: 'Dream On', artist: 'Aerosmith', album: 'Aerosmith', duration_ms: 267000 },
      { name: 'I Will Survive', artist: 'Gloria Gaynor', album: 'Love Tracks', duration_ms: 198000 },
      { name: 'I Was Made For Lovin\' You', artist: 'Kiss', album: 'Dynasty', duration_ms: 271000 },
      { name: 'Mr. Blue Sky', artist: 'Electric Light Orchestra', album: 'Out of the Blue', duration_ms: 303000 },
      { name: 'Da Ya Think I\'m Sexy?', artist: 'Rod Stewart', album: 'Blondes Have More Fun', duration_ms: 331000 },
      { name: 'YMCA', artist: 'Village People', album: 'Cruisin\'', duration_ms: 287000 },
      { name: 'London Calling', artist: 'The Clash', album: 'London Calling', duration_ms: 200000 },
      { name: 'Could You Be Loved', artist: 'Bob Marley & The Wailers', album: 'Uprising', duration_ms: 237000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 5);
    },
  },
  {
    id: 'sf-era-rock',
    decade: 'Rock',
    category: 'genre' as const,
    name: 'Mix Rock Clásico & Himnos',
    color: '#d32f2f',
    description: 'Los grandes himnos del rock de los 70s, 80s, 90s y 2000s: Queen, Guns N\' Roses, Nirvana y AC/DC.',
    sampleImages: [
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
      'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
    ],
    pool: [
      { name: 'Welcome to the Jungle', artist: 'Guns N\' Roses', album: 'Appetite for Destruction', duration_ms: 273000 },
      { name: 'We Will Rock You', artist: 'Queen', album: 'News of the World', duration_ms: 121000 },
      { name: 'Come As You Are', artist: 'Nirvana', album: 'Nevermind', duration_ms: 219000 },
      { name: 'Thunderstruck', artist: 'AC/DC', album: 'The Razors Edge', duration_ms: 292000 },
      { name: 'Faint', artist: 'Linkin Park', album: 'Meteora', duration_ms: 162000 },
      { name: 'Can\'t Stop', artist: 'Red Hot Chili Peppers', album: 'By the Way', duration_ms: 269000 },
      { name: 'Nothing Else Matters', artist: 'Metallica', album: 'Metallica', duration_ms: 388000 },
      { name: 'Walk This Way', artist: 'Aerosmith', album: 'Toys in the Attic', duration_ms: 220000 },
      { name: 'When You Were Young', artist: 'The Killers', album: 'Sam\'s Town', duration_ms: 220000 },
      { name: 'American Idiot', artist: 'Green Day', album: 'American Idiot', duration_ms: 174000 },
      { name: 'You Give Love a Bad Name', artist: 'Bon Jovi', album: 'Slippery When Wet', duration_ms: 222000 },
      { name: 'Everlong', artist: 'Foo Fighters', album: 'The Colour and the Shape', duration_ms: 250000 },
      { name: 'I Miss You', artist: 'Blink-182', album: 'Blink-182', duration_ms: 227000 },
      { name: 'Wind of Change', artist: 'Scorpions', album: 'Crazy World', duration_ms: 312000 },
      { name: 'Smoke on the Water', artist: 'Deep Purple', album: 'Machine Head', duration_ms: 340000 },
      { name: 'Ode to My Family', artist: 'The Cranberries', album: 'No Need to Argue', duration_ms: 270000 },
      { name: 'Karma Police', artist: 'Radiohead', album: 'OK Computer', duration_ms: 261000 },
      { name: 'Supersonic', artist: 'Oasis', album: 'Definitely Maybe', duration_ms: 283000 },
      { name: 'Like a Stone', artist: 'Audioslave', album: 'Audioslave', duration_ms: 294000 },
      { name: 'Uprising', artist: 'Muse', album: 'The Resistance', duration_ms: 303000 },
      { name: 'Seven Nation Army', artist: 'The White Stripes', album: 'Elephant', duration_ms: 231000 },
      { name: 'Going Under', artist: 'Evanescence', album: 'Fallen', duration_ms: 214000 },
      { name: 'Jeremy', artist: 'Pearl Jam', album: 'Ten', duration_ms: 318000 },
      { name: 'Are You Gonna Go My Way', artist: 'Lenny Kravitz', album: 'Are You Gonna Go My Way', duration_ms: 211000 },
      { name: 'I Love Rock \'n Roll', artist: 'Joan Jett & the Blackhearts', album: 'I Love Rock \'n Roll', duration_ms: 175000 },
      { name: 'Eye of the Tiger', artist: 'Survivor', album: 'Eye of the Tiger', duration_ms: 245000 },
      { name: 'The Kids Aren\'t Alright', artist: 'The Offspring', album: 'Americana', duration_ms: 180000 },
      { name: 'Chop Suey!', artist: 'System of a Down', album: 'Toxicity', duration_ms: 210000 },
      { name: 'Are You Gonna Be My Girl', artist: 'Jet', album: 'Get Born', duration_ms: 213000 },
      { name: 'Last Resort', artist: 'Papa Roach', album: 'Infest', duration_ms: 199000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 6);
    },
  },
  {
    id: 'sf-era-pop',
    decade: 'Pop',
    category: 'genre' as const,
    name: 'Mix Pop Legendario',
    color: '#e91e63',
    description: 'Los mayores éxitos del pop de los 2000s y 2010s: Britney Spears, Rihanna, Dua Lipa y Katy Perry.',
    sampleImages: [
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b8/02/bd/b802bd1d-c601-74a9-c194-b2fea8d5ed1b/5026854930541.jpg/600x600bb.jpg',
      'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/33/87/c8/3387c827-adaa-681d-bd10-ce7d8e888b9c/22UMGIM21054.rgb.jpg/600x600bb.jpg',
    ],
    pool: [
      { name: 'Oops!... I Did It Again', artist: 'Britney Spears', album: 'Oops!... I Did It Again', duration_ms: 211000 },
      { name: "Don't Stop The Music", artist: 'Rihanna', album: 'Good Girl Gone Bad', duration_ms: 267000 },
      { name: 'Levitating', artist: 'Dua Lipa', album: 'Future Nostalgia', duration_ms: 203000 },
      { name: 'Firework', artist: 'Katy Perry', album: 'Teenage Dream', duration_ms: 227000 },
      { name: 'Locked Out of Heaven', artist: 'Bruno Mars', album: 'Unorthodox Jukebox', duration_ms: 233000 },
      { name: 'Bad Romance', artist: 'Lady Gaga', album: 'The Fame Monster', duration_ms: 294000 },
      { name: 'SexyBack', artist: 'Justin Timberlake', album: 'FutureSex/LoveSounds', duration_ms: 242000 },
      { name: 'Pump It', artist: 'The Black Eyed Peas', album: 'Monkey Business', duration_ms: 213000 },
      { name: 'Moves Like Jagger', artist: 'Maroon 5, Christina Aguilera', album: 'Hands All Over', duration_ms: 201000 },
      { name: 'Blank Space', artist: 'Taylor Swift', album: '1989', duration_ms: 231000 },
      { name: 'She Wolf', artist: 'Shakira', album: 'She Wolf', duration_ms: 188000 },
      { name: 'Single Ladies', artist: 'Beyoncé', album: 'I AM... SASHA FIERCE', duration_ms: 193000 },
      { name: 'TiK ToK', artist: 'Kesha', album: 'Animal', duration_ms: 199000 },
      { name: 'Party in the U.S.A.', artist: 'Miley Cyrus', album: 'The Time of Our Lives', duration_ms: 202000 },
      { name: 'So What', artist: 'P!nk', album: 'Funhouse', duration_ms: 215000 },
      { name: 'Call Me Maybe', artist: 'Carly Rae Jepsen', album: 'Kiss', duration_ms: 193000 },
      { name: 'The Sweet Escape', artist: 'Gwen Stefani, Akon', album: 'The Sweet Escape', duration_ms: 246000 },
      { name: 'Promiscuous', artist: 'Nelly Furtado, Timbaland', album: 'Loose', duration_ms: 242000 },
      { name: 'Genie in a Bottle', artist: 'Christina Aguilera', album: 'Christina Aguilera', duration_ms: 217000 },
      { name: 'Hung Up', artist: 'Madonna', album: 'Confessions on a Dance Floor', duration_ms: 336000 },
      { name: 'Problem', artist: 'Ariana Grande, Iggy Azalea', album: 'My Everything', duration_ms: 194000 },
      { name: 'Give Me Everything', artist: 'Pitbull, Ne-Yo, Afrojack, Nayer', album: 'Planet Pit', duration_ms: 252000 },
      { name: 'Cheap Thrills', artist: 'Sia', album: 'This Is Acting', duration_ms: 211000 },
      { name: 'Lights', artist: 'Ellie Goulding', album: 'Lights', duration_ms: 210000 },
      { name: 'Green Light', artist: 'Lorde', album: 'Melodrama', duration_ms: 234000 },
      { name: 'On The Floor', artist: 'Jennifer Lopez, Pitbull', album: 'LOVE?', duration_ms: 284000 },
      { name: 'All About That Bass', artist: 'Meghan Trainor', album: 'Title', duration_ms: 187000 },
      { name: 'Since U Been Gone', artist: 'Kelly Clarkson', album: 'Breakaway', duration_ms: 188000 },
      { name: 'Havana', artist: 'Camila Cabello, Young Thug', album: 'Camila', duration_ms: 217000 },
      { name: 'Lush Life', artist: 'Zara Larsson', album: 'So Good', duration_ms: 201000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 7);
    },
  },
  {
    id: 'sf-era-urbano',
    decade: 'Urbano',
    category: 'genre' as const,
    name: 'Mix Reggaeton Clásico',
    color: '#ff6f00',
    description: 'Los pioneros e himnos del género urbano: Daddy Yankee, Don Omar, Wisin & Yandel y J Balvin.',
    sampleImages: [
      'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/e2/3f/b1e23f6e-29ba-c816-cd4a-2f995c19a25d/886447345481.jpg/600x600bb.jpg',
      'https://i.scdn.co/image/ab67706f00000002964880811c74069be12f02b5',
    ],
    pool: [
      { name: 'Lo Que Pasó, Pasó', artist: 'Daddy Yankee', album: 'Barrio Fino', duration_ms: 210000 },
      { name: 'Danza Kuduro', artist: 'Don Omar, Lucenzo', album: 'Meet The Orphans', duration_ms: 198000 },
      { name: 'Rakata', artist: 'Wisin & Yandel', album: 'Pa\'l Mundo', duration_ms: 172000 },
      { name: 'Ginza', artist: 'J Balvin', album: 'Energía', duration_ms: 171000 },
      { name: 'Chambea', artist: 'Bad Bunny', album: 'Chambea', duration_ms: 191000 },
      { name: 'El Perdón', artist: 'Nicky Jam, Enrique Iglesias', album: 'Fénix', duration_ms: 207000 },
      { name: 'Atrévete-te-te', artist: 'Calle 13', album: 'Calle 13', duration_ms: 239000 },
      { name: 'Pa\' Que Retozen', artist: 'Tego Calderón', album: 'El Abayarde', duration_ms: 151000 },
      { name: 'Fanática Sensual', artist: 'Plan B', album: 'Love and Sex', duration_ms: 238000 },
      { name: 'Felices los 4', artist: 'Maluma', album: 'F.A.M.E.', duration_ms: 229000 },
      { name: 'Zun Da Da', artist: 'Zion', album: 'The Perfect Melody', duration_ms: 302000 },
      { name: 'Rompe', artist: 'Daddy Yankee', album: 'Barrio Fino En Directo', duration_ms: 198000 },
      { name: 'Pobre Diabla', artist: 'Don Omar', album: 'The Last Don', duration_ms: 252000 },
      { name: 'Noche de Sexo', artist: 'Wisin & Yandel, Aventura', album: 'Pa\'l Mundo', duration_ms: 205000 },
      { name: 'Pepas', artist: 'Farruko', album: 'La 167', duration_ms: 287000 },
      { name: 'Se Preparó', artist: 'Ozuna', album: 'Odisea', duration_ms: 188000 },
      { name: 'LA CANCIÓN', artist: 'J Balvin, Bad Bunny', album: 'OASIS', duration_ms: 242000 },
      { name: 'Travesuras', artist: 'Nicky Jam', album: 'Greatest Hits, Vol. 1', duration_ms: 195000 },
      { name: '5 Letras', artist: 'Alexis y Fido', album: 'Sobrenatural', duration_ms: 195000 },
      { name: 'Baila Morena', artist: 'Hector & Tito', album: 'La Historia Live', duration_ms: 183000 },
      { name: 'Ven Báilalo', artist: 'Angel & Khriz', album: 'Los MVP', duration_ms: 249000 },
      { name: 'Me Prefieres a Mí', artist: 'Arcángel', album: 'Sentimiento, Elegancia y Maldad', duration_ms: 199000 },
      { name: 'Dices', artist: 'De La Ghetto', album: 'Dices', duration_ms: 218000 },
      { name: 'Llamado de Emergencia', artist: 'Daddy Yankee', album: 'Talento de Barrio', duration_ms: 239000 },
      { name: 'Salió El Sol', artist: 'Don Omar', album: 'King of Kings', duration_ms: 315000 },
      { name: 'Sexy Movimiento', artist: 'Wisin & Yandel', album: 'Los Extraterrestres', duration_ms: 209000 },
      { name: 'Mayores', artist: 'Becky G, Bad Bunny', album: 'MALA SANTA', duration_ms: 202000 },
      { name: 'Reggaetón Lento', artist: 'CNCO', album: 'Primera Cita', duration_ms: 222000 },
      { name: 'Bailando', artist: 'Enrique Iglesias, Descemer Bueno, Gente de Zona', album: 'SEX AND LOVE', duration_ms: 243000 },
      { name: 'Get Busy', artist: 'Sean Paul', album: 'Dutty Rock', duration_ms: 211000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 8);
    },
  },
  {
    id: 'sf-era-edm',
    decade: 'EDM',
    category: 'genre' as const,
    name: 'Mix Electrónica 2010s',
    color: '#00b0ff',
    description: 'La época de oro de los festivales: Avicii, David Guetta, Calvin Harris y Swedish House Mafia.',
    sampleImages: [
      'https://e-cdns-images.dzcdn.net/images/cover/b4ea39ef6ea328ecf4b16260ea8d1159/1000x1000-000000-80-0-0.jpg',
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4a/b8/51/4ab851d0-7c24-2406-6647-d6622f99d39b/199066743287.jpg/600x600bb.jpg',
    ],
    pool: [
      { name: 'Levels', artist: 'Avicii', album: 'Levels', duration_ms: 199000 },
      { name: 'Sexy Bitch', artist: 'David Guetta, Akon', album: 'One Love', duration_ms: 195000 },
      { name: 'Feel So Close', artist: 'Calvin Harris', album: '18 Months', duration_ms: 206000 },
      { name: 'Greyhound', artist: 'Swedish House Mafia', album: 'Until Now', duration_ms: 410000 },
      { name: 'Tremor', artist: 'Dimitri Vegas & Like Mike, Martin Garrix', album: 'Tremor', duration_ms: 193000 },
      { name: 'Red Lights', artist: 'Tiësto', album: 'A Town Called Paradise', duration_ms: 262000 },
      { name: 'Heroes (we could be)', artist: 'Alesso, Tove Lo', album: 'Forever', duration_ms: 209000 },
      { name: 'Bangarang', artist: 'Skrillex, Sirah', album: 'Bangarang', duration_ms: 215000 },
      { name: 'Ghosts \'n\' Stuff', artist: 'deadmau5, Rob Swire', album: 'For Lack of a Better Name', duration_ms: 328000 },
      { name: 'Clarity', artist: 'Zedd, Foxes', album: 'Clarity', duration_ms: 271000 },
      { name: 'Alone', artist: 'Marshmello', album: 'Alone', duration_ms: 273000 },
      { name: "Don't Let Me Down", artist: 'The Chainsmokers, Daya', album: 'Collage', duration_ms: 208000 },
      { name: 'Turn Down for What', artist: 'DJ Snake, Lil Jon', album: 'Turn Down for What', duration_ms: 213000 },
      { name: 'Light It Up', artist: 'Major Lazer, Nyla, Fuse ODG', album: 'Peace Is the Mission', duration_ms: 166000 },
      { name: 'Runaway (U & I)', artist: 'Galantis', album: 'Pharmacy', duration_ms: 227000 },
      { name: 'Turn Up The Speakers', artist: 'Afrojack, Martin Garrix', album: 'Turn Up The Speakers', duration_ms: 183000 },
      { name: 'Pursuit of Happiness (Extended Steve Aoki Remix)', artist: 'Kid Cudi, MGMT, Ratatat, Steve Aoki', album: 'Man on the Moon', duration_ms: 373000 },
      { name: 'More Than You Know', artist: 'Axwell /\\ Ingrosso', album: 'More Than You Know', duration_ms: 203000 },
      { name: 'Firestone', artist: 'Kygo, Conrad Sewell', album: 'Cloud Nine', duration_ms: 273000 },
      { name: 'Sugar', artist: 'Robin Schulz, Francesco Yates', album: 'Sugar', duration_ms: 219000 },
      { name: 'Are You With Me', artist: 'Lost Frequencies', album: 'Less Is More', duration_ms: 138000 },
      { name: 'Faded', artist: 'Alan Walker', album: 'Different World', duration_ms: 212000 },
      { name: 'Spaceman', artist: 'Hardwell', album: 'Spaceman', duration_ms: 243000 },
      { name: 'I Need Your Love', artist: 'Calvin Harris, Ellie Goulding', album: '18 Months', duration_ms: 234000 },
      { name: "I'm Good (Blue)", artist: 'David Guetta, Bebe Rexha', album: "I'm Good (Blue)", duration_ms: 175000 },
      { name: 'Secrets', artist: 'Tiësto, KSHMR, Vassy', album: 'Club Life, Vol. 4 - New York City', duration_ms: 267000 },
      { name: 'Gecko (Overdrive)', artist: 'Oliver Heldens, Becky Hill', album: 'Gecko (Overdrive)', duration_ms: 165000 },
      { name: 'Ocean Drive', artist: 'Duke Dumont', album: 'Duality', duration_ms: 206000 },
      { name: 'Opus', artist: 'Eric Prydz', album: 'Opus', duration_ms: 558000 },
      { name: 'Silence (Tiësto Remix)', artist: 'Delerium, Sarah McLachlan', album: 'Silence', duration_ms: 418000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 9);
    },
  },
  {
    id: 'sf-genre-indie',
    decade: 'Indie',
    category: 'genre' as const,
    name: 'Mix Indie & Alternativo',
    color: '#00897b',
    description: 'Sonidos orgánicos, guitarras y joyas del indie rock: Arctic Monkeys, The Strokes, The Killers y Phoenix.',
    sampleImages: [
      'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/53/f3/fc/53f3fccd-2024-789e-8858-c9562cc1edfa/886449216321.jpg/600x600bb.jpg',
      'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
    ],
    pool: [
      { name: 'Do I Wanna Know?', artist: 'Arctic Monkeys', album: 'AM', duration_ms: 272000 },
      { name: 'Last Nite', artist: 'The Strokes', album: 'Is This It', duration_ms: 193000 },
      { name: 'Somebody Told Me', artist: 'The Killers', album: 'Hot Fuss', duration_ms: 197000 },
      { name: 'Take Me Out', artist: 'Franz Ferdinand', album: 'Franz Ferdinand', duration_ms: 237000 },
      { name: 'Dog Days Are Over', artist: 'Florence + The Machine', album: 'Lungs', duration_ms: 252000 },
      { name: 'The Less I Know The Better', artist: 'Tame Impala', album: 'Currents', duration_ms: 216000 },
      { name: '1901', artist: 'Phoenix', album: 'Wolfgang Amadeus Phoenix', duration_ms: 193000 },
      { name: 'A-Punk', artist: 'Vampire Weekend', album: 'Vampire Weekend', duration_ms: 137000 },
      { name: 'Ain\'t No Rest for the Wicked', artist: 'Cage The Elephant', album: 'Cage The Elephant', duration_ms: 175000 },
      { name: 'My Number', artist: 'Foals', album: 'Holy Fire', duration_ms: 240000 },
      { name: 'Royals', artist: 'Lorde', album: 'Pure Heroine', duration_ms: 190000 },
      { name: 'Riptide', artist: 'Vance Joy', album: 'Dream Your Life Away', duration_ms: 204000 },
      { name: 'Little Talks', artist: 'Of Monsters and Men', album: 'My Head Is an Animal', duration_ms: 266000 },
      { name: 'Pumped Up Kicks', artist: 'Foster The People', album: 'Torches', duration_ms: 239000 },
      { name: 'Kids', artist: 'MGMT', album: 'Oracular Spectacular', duration_ms: 302000 },
      { name: 'Breezeblocks', artist: 'alt-J', album: 'An Awesome Wave', duration_ms: 227000 },
      { name: 'Midnight City', artist: 'M83', album: 'Hurry Up, We\'re Dreaming', duration_ms: 243000 },
      { name: 'Sweater Weather', artist: 'The Neighbourhood', album: 'I Love You.', duration_ms: 240000 },
      { name: 'Sit Next to Me', artist: 'Foster The People', album: 'Sacred Hearts Club', duration_ms: 243000 },
      { name: 'Tongue Tied', artist: 'GROUPLOVE', album: 'Never Trust a Happy Song', duration_ms: 218000 },
      { name: 'Safe and Sound', artist: 'Capital Cities', album: 'In a Tidal Wave of Mystery', duration_ms: 192000 },
      { name: 'Shut Up and Dance', artist: 'WALK THE MOON', album: 'TALKING IS HARD', duration_ms: 199000 },
      { name: 'Ex\'s & Oh\'s', artist: 'Elle King', album: 'Love Stuff', duration_ms: 202000 },
      { name: 'Home', artist: 'Edward Sharpe & The Magnetic Zeros', album: 'Up From Below', duration_ms: 303000 },
      { name: 'Ophelia', artist: 'The Lumineers', album: 'Cleopatra', duration_ms: 160000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 10);
    },
  },
  {
    id: 'sf-genre-hiphop',
    decade: 'Hip-Hop',
    category: 'genre' as const,
    name: 'Mix Hip-Hop & Rap',
    color: '#3949ab',
    description: 'Los mayores himnos del rap y hip-hop: Eminem, 50 Cent, Snoop Dogg, Kendrick Lamar y Travis Scott.',
    sampleImages: [
      'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
      'https://i.scdn.co/image/ab67616d00004851c0ca1263b2966ddff794d3bb',
    ],
    pool: [
      { name: 'In Da Club', artist: '50 Cent', album: 'Get Rich or Die Tryin\'', duration_ms: 193000 },
      { name: 'The Real Slim Shady', artist: 'Eminem', album: 'The Marshall Mathers LP', duration_ms: 284000 },
      { name: 'Drop It Like It\'s Hot', artist: 'Snoop Dogg, Pharrell Williams', album: 'R&G: The Masterpiece', duration_ms: 266000 },
      { name: 'Still D.R.E.', artist: 'Dr. Dre, Snoop Dogg', album: '2001', duration_ms: 270000 },
      { name: 'HUMBLE.', artist: 'Kendrick Lamar', album: 'DAMN.', duration_ms: 177000 },
      { name: 'SICKO MODE', artist: 'Travis Scott', album: 'ASTROWORLD', duration_ms: 312000 },
      { name: 'God\'s Plan', artist: 'Drake', album: 'Scorpion', duration_ms: 198000 },
      { name: 'Stronger', artist: 'Kanye West', album: 'Graduation', duration_ms: 311000 },
      { name: 'Empire State of Mind', artist: 'JAY-Z, Alicia Keys', album: 'The Blueprint 3', duration_ms: 276000 },
      { name: 'No Role Modelz', artist: 'J. Cole', album: '2014 Forest Hills Drive', duration_ms: 292000 },
      { name: 'California Love', artist: '2Pac, Roger Troutman, Dr. Dre', album: 'All Eyez On Me', duration_ms: 284000 },
      { name: 'Juicy', artist: 'The Notorious B.I.G.', album: 'Ready to Die', duration_ms: 302000 },
      { name: 'Without Me', artist: 'Eminem', album: 'The Eminem Show', duration_ms: 290000 },
      { name: 'Candy Shop', artist: '50 Cent, Olivia', album: 'The Massacre', duration_ms: 209000 },
      { name: 'Gold Digger', artist: 'Kanye West, Jamie Foxx', album: 'Late Registration', duration_ms: 207000 },
      { name: 'Alright', artist: 'Kendrick Lamar', album: 'To Pimp a Butterfly', duration_ms: 219000 },
      { name: 'Mask Off', artist: 'Future', album: 'FUTURE', duration_ms: 204000 },
      { name: 'XO Tour Llif3', artist: 'Lil Uzi Vert', album: 'Luv Is Rage 2', duration_ms: 182000 },
      { name: 'Praise The Lord', artist: 'A$AP Rocky, Skepta', album: 'TESTING', duration_ms: 205000 },
      { name: 'Hotline Bling', artist: 'Drake', album: 'Views', duration_ms: 267000 },
      { name: 'Sunflower', artist: 'Post Malone, Swae Lee', album: 'Hollywood\'s Bleeding', duration_ms: 158000 },
      { name: 'Rockstar', artist: 'Post Malone, 21 Savage', album: 'beerbongs & bentleys', duration_ms: 218000 },
      { name: 'Can\'t Hold Us', artist: 'Macklemore & Ryan Lewis, Ray Dalton', album: 'The Heist', duration_ms: 258000 },
      { name: 'Gangsta\'s Paradise', artist: 'Coolio, L.V.', album: 'Gangsta\'s Paradise', duration_ms: 240000 },
      { name: 'Hypnotize', artist: 'The Notorious B.I.G.', album: 'Life After Death', duration_ms: 230000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 11);
    },
  },
  {
    id: 'sf-era-2020s',
    decade: '2020s',
    category: 'era' as const,
    name: 'Mix de los 2020s',
    color: '#1db954',
    description: 'Los temas que definen la década de 2020: Aitana, Bad Bunny, Quevedo, Dua Lipa y Bizarrap.',
    pool: [
      { name: 'Monaco', artist: 'Bad Bunny', album: 'nadie sabe lo que va a pasar mañana', duration_ms: 267000 },
      { name: 'Columbia', artist: 'Quevedo', album: 'Columbia', duration_ms: 186000 },
      { name: 'Los Ángeles', artist: 'Aitana', album: 'alpha', duration_ms: 158000 },
      { name: 'Houdini', artist: 'Dua Lipa', album: 'Radical Optimism', duration_ms: 185000 },
      { name: 'Shakira: Bzrp Music Sessions, Vol. 53', artist: 'Bizarrap, Shakira', album: 'Vol. 53', duration_ms: 218000 },
      { name: 'LALA', artist: 'Myke Towers', album: 'LA VIDA ES UNA', duration_ms: 198000 },
      { name: 'DESPECHÁ', artist: 'Rosalía', album: 'MOTOMAMI +', duration_ms: 157000 },
      { name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration_ms: 200000 },
      { name: 'As It Was', artist: 'Harry Styles', album: "Harry's House", duration_ms: 167000 },
      { name: 'Flowers', artist: 'Miley Cyrus', album: 'Endless Summer Vacation', duration_ms: 200000 },
      { name: 'SUPERNOVA', artist: 'Saiko', album: 'SUPERNOVA', duration_ms: 195000 },
      { name: 'Classy 101', artist: 'Feid, Young Miko', album: 'Classy 101', duration_ms: 195000 },
      { name: 'La Jumpa', artist: 'Arcángel, Bad Bunny', album: 'Sr. Santos', duration_ms: 255000 },
      { name: 'El Merengue', artist: 'Marshmello, Manuel Turizo', album: 'El Merengue', duration_ms: 189000 },
      { name: 'Si Antes Te Hubiera Conocido', artist: 'Karol G', album: 'Si Antes Te Hubiera Conocido', duration_ms: 195000 },
      { name: 'Gata Only', artist: 'FloyyMenor, Cris Mj', album: 'EL COMIENZO', duration_ms: 222000 },
      { name: 'Greedy', artist: 'Tate McRae', album: 'THINK LATER', duration_ms: 131000 },
      { name: 'Espresso', artist: 'Sabrina Carpenter', album: "Short n' Sweet", duration_ms: 175000 },
      { name: 'BIRDS OF A FEATHER', artist: 'Billie Eilish', album: 'HIT ME HARD AND SOFT', duration_ms: 190000 },
      { name: 'Die With A Smile', artist: 'Lady Gaga, Bruno Mars', album: 'Die With A Smile', duration_ms: 251000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 0);
    },
  },
  {
    id: 'sf-era-60s',
    decade: '60s',
    category: 'era' as const,
    name: 'Mix de los 60s',
    color: '#8d6e63',
    description: 'La época dorada del rock, pop y psicodelia: The Beatles, The Rolling Stones y The Beach Boys.',
    pool: [
      { name: 'Hey Jude', artist: 'The Beatles', album: 'Hey Jude', duration_ms: 431000 },
      { name: 'Paint It, Black', artist: 'The Rolling Stones', album: 'Aftermath', duration_ms: 202000 },
      { name: 'Good Vibrations', artist: 'The Beach Boys', album: 'Smiley Smile', duration_ms: 217000 },
      { name: 'Like a Rolling Stone', artist: 'Bob Dylan', album: 'Highway 61 Revisited', duration_ms: 369000 },
      { name: 'House of the Rising Sun', artist: 'The Animals', album: 'The Animals', duration_ms: 269000 },
      { name: 'Stand by Me', artist: 'Ben E. King', album: "Don't Play That Song!", duration_ms: 180000 },
      { name: 'My Girl', artist: 'The Temptations', album: 'The Temptations Sing Smokey', duration_ms: 165000 },
      { name: 'Respect', artist: 'Aretha Franklin', album: 'I Never Loved a Man', duration_ms: 147000 },
      { name: 'California Dreamin\'', artist: 'The Mamas & The Papas', album: 'If You Can Believe Your Eyes and Ears', duration_ms: 158000 },
      { name: 'Fortunate Son', artist: 'Creedence Clearwater Revival', album: 'Willy and the Poor Boys', duration_ms: 140000 },
      { name: 'All Along the Watchtower', artist: 'Jimi Hendrix', album: 'Electric Ladyland', duration_ms: 240000 },
      { name: 'Suspicious Minds', artist: 'Elvis Presley', album: 'From Elvis in Memphis', duration_ms: 271000 },
      { name: 'Space Oddity', artist: 'David Bowie', album: 'David Bowie', duration_ms: 318000 },
      { name: 'Light My Fire', artist: 'The Doors', album: 'The Doors', duration_ms: 426000 },
      { name: 'I Want You Back', artist: 'The Jackson 5', album: 'Diana Ross Presents The Jackson 5', duration_ms: 178000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 6);
    },
  },
  {
    id: 'sf-era-teenpop',
    decade: 'teenpop',
    category: 'era' as const,
    name: 'Mix Teen Pop & 2000s',
    color: '#e91e63',
    description: 'La explosión pop que marcó una generación: Britney Spears, Shakira, Backstreet Boys y Avril Lavigne.',
    pool: [
      { name: '...Baby One More Time', artist: 'Britney Spears', album: '...Baby One More Time', duration_ms: 211000 },
      { name: 'I Want It That Way', artist: 'Backstreet Boys', album: 'Millennium', duration_ms: 213000 },
      { name: 'Complicated', artist: 'Avril Lavigne', album: 'Let Go', duration_ms: 245000 },
      { name: 'Whenever, Wherever', artist: 'Shakira', album: 'Laundry Service', duration_ms: 196000 },
      { name: 'Genie in a Bottle', artist: 'Christina Aguilera', album: 'Christina Aguilera', duration_ms: 216000 },
      { name: 'Bye Bye Bye', artist: '*NSYNC', album: 'No Strings Attached', duration_ms: 200000 },
      { name: 'Sk8er Boi', artist: 'Avril Lavigne', album: 'Let Go', duration_ms: 204000 },
      { name: 'Toxic', artist: 'Britney Spears', album: 'In the Zone', duration_ms: 198000 },
      { name: 'Wannabe', artist: 'Spice Girls', album: 'Spice', duration_ms: 172000 },
      { name: 'Hips Don\'t Lie', artist: 'Shakira, Wyclef Jean', album: 'Oral Fixation Vol. 2', duration_ms: 218000 },
      { name: 'Since U Been Gone', artist: 'Kelly Clarkson', album: 'Breakaway', duration_ms: 188000 },
      { name: 'Promiscuous', artist: 'Nelly Furtado, Timbaland', album: 'Loose', duration_ms: 242000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 7);
    },
  },
  {
    id: 'sf-era-eurodance',
    decade: 'eurodance',
    category: 'era' as const,
    name: 'Mix Eurodance 90s',
    color: '#00bcd4',
    description: 'BPM imparable y nostalgia de discoteca: Gigi D\'Agostino, Eiffel 65, Corona y Vengaboys.',
    pool: [
      { name: 'L\'Amour Toujours', artist: 'Gigi D\'Agostino', album: 'L\'Amour Toujours', duration_ms: 238000 },
      { name: 'Blue (Da Ba Dee)', artist: 'Eiffel 65', album: 'Europop', duration_ms: 284000 },
      { name: 'The Rhythm of the Night', artist: 'Corona', album: 'The Rhythm of the Night', duration_ms: 264000 },
      { name: 'Boom, Boom, Boom, Boom!!', artist: 'Vengaboys', album: 'The Party Album!', duration_ms: 202000 },
      { name: 'What Is Love', artist: 'Haddaway', album: 'The Album', duration_ms: 269000 },
      { name: 'Scatman (Ski-Ba-Bop-Ba-Dop-Bop)', artist: 'Scatman John', album: 'Scatman\'s World', duration_ms: 210000 },
      { name: 'Better Off Alone', artist: 'Alice Deejay', album: 'Who Needs Guitars Anyway?', duration_ms: 216000 },
      { name: 'Be My Lover', artist: 'La Bouche', album: 'Sweet Dreams', duration_ms: 240000 },
      { name: 'Barbie Girl', artist: 'Aqua', album: 'Aquarium', duration_ms: 196000 },
      { name: 'Freed from Desire', artist: 'Gala', album: 'Come Into My Life', duration_ms: 210000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 8);
    },
  },
  {
    id: 'sf-genre-flamenco',
    decade: 'flamenco',
    category: 'genre' as const,
    name: 'Mix Flamenco & Rumba Pop',
    color: '#d32f2f',
    description: 'Rumba, duende y fusión pop: Estopa, Melendi, Fondo Flamenco, Rosalía y Niña Pastori.',
    pool: [
      { name: 'Vino Tinto', artist: 'Estopa', album: 'Destrangis', duration_ms: 197000 },
      { name: 'Caminando por la Vida', artist: 'Melendi', album: 'Que El Cielo Espere Sentao', duration_ms: 215000 },
      { name: 'Tu Frialdad', artist: 'Triana', album: 'Un Encuentro', duration_ms: 262000 },
      { name: 'Como el Agua', artist: 'Camarón de la Isla, Paco de Lucía', album: 'Como el Agua', duration_ms: 184000 },
      { name: 'Entre dos aguas', artist: 'Paco de Lucía', album: 'Fuente y Caudal', duration_ms: 360000 },
      { name: 'Por la raja de tu falda', artist: 'Estopa', album: 'Estopa', duration_ms: 204000 },
      { name: 'Lágrimas Negras', artist: 'Bebo Valdés, Diego El Cigala', album: 'Lágrimas Negras', duration_ms: 330000 },
      { name: 'MALAMENTE', artist: 'Rosalía', album: 'El Mal Querer', duration_ms: 150000 },
      { name: 'Princesas', artist: 'Pereza', album: 'Animales', duration_ms: 220000 },
      { name: 'Ojalá Pudiera Ir', artist: 'Fondo Flamenco', album: 'Surología', duration_ms: 210000 },
      { name: 'Sin noticias de Holanda', artist: 'Melendi', album: 'Sin noticias de Holanda', duration_ms: 236000 },
      { name: 'Pastillas para no soñar', artist: 'Joaquín Sabina', album: 'Física y Química', duration_ms: 240000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 12);
    },
  },
  {
    id: 'sf-genre-rnb',
    decade: 'rnb',
    category: 'genre' as const,
    name: 'Mix R&B & Neo Soul',
    color: '#512da8',
    description: 'Groove suave, voces sedosas y elegancia: Bruno Mars, The Weeknd, SZA y Frank Ocean.',
    pool: [
      { name: 'Leave The Door Open', artist: 'Silk Sonic, Bruno Mars, Anderson .Paak', album: 'An Evening With Silk Sonic', duration_ms: 242000 },
      { name: 'Snooze', artist: 'SZA', album: 'SOS', duration_ms: 201000 },
      { name: 'Earned It', artist: 'The Weeknd', album: 'Beauty Behind the Madness', duration_ms: 277000 },
      { name: 'Thinkin Bout You', artist: 'Frank Ocean', album: 'channel ORANGE', duration_ms: 200000 },
      { name: 'Redbone', artist: 'Childish Gambino', album: 'Awaken, My Love!', duration_ms: 326000 },
      { name: 'Location', artist: 'Khalid', album: 'American Teen', duration_ms: 219000 },
      { name: 'Hrs and Hrs', artist: 'Muni Long', album: 'Public Displays of Affection', duration_ms: 198000 },
      { name: 'Die For You', artist: 'The Weeknd', album: 'Starboy', duration_ms: 260000 },
      { name: 'That\'s What I Like', artist: 'Bruno Mars', album: '24K Magic', duration_ms: 206000 },
      { name: 'Kill Bill', artist: 'SZA', album: 'SOS', duration_ms: 153000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 13);
    },
  },
  {
    id: 'sf-genre-reggae',
    decade: 'reggae',
    category: 'genre' as const,
    name: 'Mix Reggae & Chill Latino',
    color: '#388e3c',
    description: 'Buenas vibras y ritmo caribeño: Bob Marley, Morodo, Rawayana, Green Valley y Cultura Profética.',
    pool: [
      { name: 'Could You Be Loved', artist: 'Bob Marley & The Wailers', album: 'Uprising', duration_ms: 237000 },
      { name: 'I Wanna Be Loved', artist: 'Buju Banton', album: '\'Til Shiloh', duration_ms: 244000 },
      { name: 'La Diligencia', artist: 'Morodo', album: 'Cosas Que Contarte', duration_ms: 230000 },
      { name: 'High', artist: 'Rawayana', album: 'Trippy Caribbean', duration_ms: 218000 },
      { name: 'Bailando Al Sol', artist: 'Green Valley', album: 'Hijos de la Tierra', duration_ms: 220000 },
      { name: 'Ilegal', artist: 'Cultura Profética', album: 'La Dulzura', duration_ms: 305000 },
      { name: 'Three Little Birds', artist: 'Bob Marley & The Wailers', album: 'Exodus', duration_ms: 180000 },
      { name: 'Santeria', artist: 'Sublime', album: 'Sublime', duration_ms: 183000 },
      { name: 'Welcome To Jamrock', artist: 'Damian Marley', album: 'Welcome To Jamrock', duration_ms: 213000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 14);
    },
  },
  {
    id: 'sf-genre-clasica',
    decade: 'clasica',
    category: 'genre' as const,
    name: 'Mix Piano & Clásica Neoclásica',
    color: '#455a64',
    description: 'Paz absoluta y armonía instrumental: Ludovico Einaudi, Yiruma, Max Richter y Yann Tiersen.',
    pool: [
      { name: 'Nuvole Bianche', artist: 'Ludovico Einaudi', album: 'Una Mattina', duration_ms: 357000 },
      { name: 'River Flows in You', artist: 'Yiruma', album: 'First Love', duration_ms: 188000 },
      { name: 'Comptine d\'un autre été: L\'après-midi', artist: 'Yann Tiersen', album: 'Le Fabuleux Destin d\'Amélie Poulain', duration_ms: 140000 },
      { name: 'On The Nature Of Daylight', artist: 'Max Richter', album: 'The Blue Notebooks', duration_ms: 371000 },
      { name: 'Experience', artist: 'Ludovico Einaudi', album: 'In a Time Lapse', duration_ms: 315000 },
      { name: 'Clair de Lune', artist: 'Claude Debussy', album: 'Suite Bergamasque', duration_ms: 302000 },
      { name: 'Kiss The Rain', artist: 'Yiruma', album: 'From The Yellow Room', duration_ms: 254000 },
      { name: 'Gymnopédie No. 1', artist: 'Erik Satie', album: 'Trois Gymnopédies', duration_ms: 195000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 15);
    },
  },
];

export const GENRE_PLAYLIST_DEFINITIONS = ERA_PLAYLIST_DEFINITIONS.filter((d: any) => d.category === 'genre');

function makeMoodCoverSvg(
  title: string,
  color: string,
  subtitle = 'Spotifree Mix',
  style: CoverStyle = 'banner',
  images: string[] = []
): string {
  const valid = (images || []).filter((u) => u && !isPlaceholderOrAvatar(u));
  if (style === 'banner') return makeBannerCoverSvg(title, color, valid);
  if (style === 'collage' && valid.length >= 2) return makeCollageCoverSvg(title, color, valid);
  const cleanTitle = title.replace(/^Mix\s+/i, '');
  return makeEraCoverSvg(cleanTitle, color, title, valid, subtitle);
}

function toCuratedCategoryTrack(item: { name: string; artist: string; album: string; duration_ms: number }, prefix: string, idx: number): Track {
  const artistNames = item.artist.split(/\s*[,&]\s*/);
  return {
    id: `sf-${prefix}-track-${idx + 1}`,
    name: item.name,
    artists: artistNames.map((name) => ({ id: `art-${norm(name).replace(/\s+/g, '-')}`, name })),
    album: {
      id: `alb-${norm(item.album).replace(/\s+/g, '-')}`,
      name: item.album,
      images: [],
    },
    duration_ms: item.duration_ms,
    uri: `spotify:track:${prefix}_${idx + 1}`,
    type: 'track',
  } as Track;
}

export const MOOD_PLAYLIST_DEFINITIONS = [
  {
    id: 'sf-mood-entreno',
    key: 'entreno',
    name: 'Mix Entrenamiento & Gym',
    color: '#ff3d00',
    description: 'Máxima energía, BPM y motivación para tus sesiones de pesas, cardio y entrenamiento.',
    pool: [
      { name: 'Lose Yourself', artist: 'Eminem', album: '8 Mile', duration_ms: 326000 },
      { name: 'Physical', artist: 'Dua Lipa', album: 'Future Nostalgia', duration_ms: 193000 },
      { name: "I'm Good (Blue)", artist: 'David Guetta, Bebe Rexha', album: "I'm Good (Blue)", duration_ms: 175000 },
      { name: 'The Business', artist: 'Tiësto', album: 'The Business', duration_ms: 164000 },
      { name: 'Rumble', artist: 'Skrillex, Fred again.., Flowdan', album: 'Quest For Fire', duration_ms: 146000 },
      { name: 'Eye of the Tiger', artist: 'Survivor', album: 'Eye of the Tiger', duration_ms: 245000 },
      { name: 'Thunderstruck', artist: 'AC/DC', album: 'The Razors Edge', duration_ms: 292000 },
      { name: 'Losing It', artist: 'FISHER', album: 'Losing It', duration_ms: 248000 },
      { name: 'WANDA', artist: 'Quevedo', album: 'DONDE QUIERO ESTAR', duration_ms: 160000 },
      { name: 'Bzrp Music Sessions, Vol. 52', artist: 'Bizarrap, Quevedo', album: 'Bzrp Music Sessions, Vol. 52', duration_ms: 198000 },
      { name: 'Summer', artist: 'Calvin Harris', album: 'Motion', duration_ms: 222000 },
      { name: 'Stronger', artist: 'Kanye West', album: 'Graduation', duration_ms: 311000 },
      { name: "Can't Hold Us", artist: 'Macklemore, Ryan Lewis, Ray Dalton', album: 'The Heist', duration_ms: 258000 },
      { name: 'Pepas', artist: 'Farruko', album: 'La 167', duration_ms: 287000 },
      { name: 'Breathe', artist: 'The Prodigy', album: 'The Fat of the Land', duration_ms: 335000 },
      { name: 'Levels', artist: 'Avicii', album: 'Levels', duration_ms: 199000 },
      { name: 'Ferrari', artist: 'James Hype, Miggy Dela Rosa', album: 'Ferrari', duration_ms: 186000 },
      { name: 'In The End', artist: 'Linkin Park', album: 'Hybrid Theory', duration_ms: 216000 },
      { name: 'Till I Collapse', artist: 'Eminem, Nate Dogg', album: 'The Eminem Show', duration_ms: 297000 },
      { name: 'Animals', artist: 'Martin Garrix', album: 'Gold Skies', duration_ms: 176000 },
      { name: 'Cinema', artist: 'Benny Benassi, Skrillex, Gary Go', album: 'Electroman', duration_ms: 307000 },
      { name: 'Gasolina', artist: 'Daddy Yankee', album: 'Barrio Fino', duration_ms: 192000 },
      { name: 'Midnight City', artist: 'M83', album: "Hurry Up, We're Dreaming", duration_ms: 243000 },
      { name: 'Turn Down for What', artist: 'DJ Snake, Lil Jon', album: 'Turn Down for What', duration_ms: 213000 },
      { name: 'Heads Will Roll', artist: 'Yeah Yeah Yeahs, A-Trak', album: "It's Blitz!", duration_ms: 203000 },
      { name: 'Satisfaction', artist: 'Benny Benassi', album: 'Hypnotica', duration_ms: 144000 },
      { name: 'One More Time', artist: 'Daft Punk', album: 'Discovery', duration_ms: 320000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 21);
    },
  },
  {
    id: 'sf-mood-relax',
    key: 'relax',
    name: 'Mix Chill & Relax Acústico',
    color: '#00b4d8',
    description: 'Desconecta con los sonidos más cálidos, indie, guitarras y melodías acústicas.',
    pool: [
      { name: 'Thinking Out Loud', artist: 'Ed Sheeran', album: 'x', duration_ms: 281000 },
      { name: 'ocean eyes', artist: 'Billie Eilish', album: 'dont smile at me', duration_ms: 200000 },
      { name: 'Riptide', artist: 'Vance Joy', album: 'Dream Your Life Away', duration_ms: 204000 },
      { name: 'Let Her Go', artist: 'Passenger', album: 'All the Little Lights', duration_ms: 252000 },
      { name: 'Sparks', artist: 'Coldplay', album: 'Parachutes', duration_ms: 227000 },
      { name: 'Apocalypse', artist: 'Cigarettes After Sex', album: 'Cigarettes After Sex', duration_ms: 290000 },
      { name: 'The Night We Met', artist: 'Lord Huron', album: 'Strange Trails', duration_ms: 208000 },
      { name: 'Better Together', artist: 'Jack Johnson', album: 'In Between Dreams', duration_ms: 207000 },
      { name: 'Gravity', artist: 'John Mayer', album: 'Continuum', duration_ms: 245000 },
      { name: 'Wonderwall (Acoustic)', artist: 'Oasis', album: "(What's the Story) Morning Glory?", duration_ms: 258000 },
      { name: 'Skinny Love', artist: 'Bon Iver', album: 'For Emma, Forever Ago', duration_ms: 239000 },
      { name: 'Fast Car', artist: 'Tracy Chapman', album: 'Tracy Chapman', duration_ms: 296000 },
      { name: 'Budapest', artist: 'George Ezra', album: 'Wanted on Voyage', duration_ms: 200000 },
      { name: 'Ho Hey', artist: 'The Lumineers', album: 'The Lumineers', duration_ms: 163000 },
      { name: 'Banana Pancakes', artist: 'Jack Johnson', album: 'In Between Dreams', duration_ms: 192000 },
      { name: 'Heather', artist: 'Conan Gray', album: 'Kid Krow', duration_ms: 198000 },
      { name: 'Yellow', artist: 'Coldplay', album: 'Parachutes', duration_ms: 266000 },
      { name: 'Sweet Creature', artist: 'Harry Styles', album: 'Harry Styles', duration_ms: 224000 },
      { name: 'Cherry Wine', artist: 'Hozier', album: 'Hozier', duration_ms: 240000 },
      { name: 'Landslide', artist: 'Fleetwood Mac', album: 'Fleetwood Mac', duration_ms: 199000 },
      { name: 'Photograph', artist: 'Ed Sheeran', album: 'x', duration_ms: 258000 },
      { name: 'Stubborn Love', artist: 'The Lumineers', album: 'The Lumineers', duration_ms: 279000 },
      { name: 'Flightless Bird, American Mouth', artist: 'Iron & Wine', album: "The Shepherd's Dog", duration_ms: 242000 },
      { name: 'I Will Follow You into the Dark', artist: 'Death Cab for Cutie', album: 'Plans', duration_ms: 189000 },
      { name: 'Lost Stars', artist: 'Adam Levine', album: 'Begin Again', duration_ms: 267000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 22);
    },
  },
  {
    id: 'sf-mood-focus',
    key: 'focus',
    name: 'Mix Concentración & Flow',
    color: '#7209b7',
    description: 'Beats instrumentales, lofi y electrónica ambiental para estudiar, programar y fluir.',
    pool: [
      { name: 'Awake', artist: 'Tycho', album: 'Awake', duration_ms: 283000 },
      { name: 'Kerala', artist: 'Bonobo', album: 'Migration', duration_ms: 237000 },
      { name: 'Nuvole Bianche', artist: 'Ludovico Einaudi', album: 'Una Mattina', duration_ms: 357000 },
      { name: 'Time', artist: 'Hans Zimmer', album: 'Inception', duration_ms: 275000 },
      { name: 'Affection', artist: 'Jinsang', album: 'Life', duration_ms: 130000 },
      { name: 'controlla', artist: 'Idealism', album: 'Rainy Evening', duration_ms: 145000 },
      { name: 'Gymnopédie No. 1', artist: 'Erik Satie, Philippe Entremont', album: 'Satie: Piano Music', duration_ms: 195000 },
      { name: 'A Model of the Universe', artist: 'Jóhann Jóhannsson', album: 'The Theory of Everything', duration_ms: 172000 },
      { name: 'Resonance', artist: 'HOME', album: 'Odyssey', duration_ms: 212000 },
      { name: 'Daylight', artist: 'Kudasaibeats', album: 'Falling', duration_ms: 132000 },
      { name: 'Divenire', artist: 'Ludovico Einaudi', album: 'Divenire', duration_ms: 402000 },
      { name: 'Epilogue', artist: 'Ólafur Arnalds', album: 'Broadchurch', duration_ms: 190000 },
      { name: 'Intro', artist: 'The xx', album: 'xx', duration_ms: 128000 },
      { name: 'Weightless', artist: 'Marconi Union', album: 'Weightless', duration_ms: 480000 },
      { name: 'Clair de Lune', artist: 'Claude Debussy, Martin Jones', album: 'Debussy Piano Works', duration_ms: 302000 },
      { name: 'Avril 14th', artist: 'Aphex Twin', album: 'Drukqs', duration_ms: 125000 },
      { name: 'A Walk', artist: 'Tycho', album: 'Dive', duration_ms: 316000 },
      { name: 'Kiara', artist: 'Bonobo', album: 'Black Sands', duration_ms: 230000 },
      { name: 'Coffee', artist: 'Kudasaibeats', album: 'Silver', duration_ms: 154000 },
      { name: 'Snowman', artist: 'Wun Two', album: 'Rio', duration_ms: 124000 },
      { name: 'Experience', artist: 'Ludovico Einaudi', album: 'In a Time Lapse', duration_ms: 315000 },
      { name: 'River Flows In You', artist: 'Yiruma', album: 'First Love', duration_ms: 188000 },
      { name: "Comptine d'un autre été, l'après-midi", artist: 'Yann Tiersen', album: 'Amélie', duration_ms: 140000 },
      { name: 'An Ending (Ascent)', artist: 'Brian Eno', album: 'Apollo', duration_ms: 266000 },
      { name: 'Horizon Variations', artist: 'Max Richter', album: 'The Blue Notebooks', duration_ms: 112000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 23);
    },
  },
  {
    id: 'sf-mood-fiesta',
    key: 'fiesta',
    name: 'Mix Fiesta & Fin de Semana',
    color: '#ff007f',
    description: 'Los ritmos urbanos, pop latino y reggaeton comercial que hacen vibrar el fin de semana.',
    pool: [
      { name: 'Tití Me Preguntó', artist: 'Bad Bunny', album: 'Un Verano Sin Ti', duration_ms: 243000 },
      { name: 'Feliz Cumpleaños Ferxxo', artist: 'Feid', album: 'Feliz Cumpleaños Ferxxo', duration_ms: 156000 },
      { name: 'PROVENZA', artist: 'Karol G', album: 'MAÑANA SERÁ BONITO', duration_ms: 210000 },
      { name: 'Todo De Ti', artist: 'Rauw Alejandro', album: 'VICE VERSA', duration_ms: 199000 },
      { name: 'Bzrp Music Sessions, Vol. 53', artist: 'Bizarrap, Shakira', album: 'Bzrp Music Sessions, Vol. 53', duration_ms: 213000 },
      { name: 'Columbia', artist: 'Quevedo', album: 'Columbia', duration_ms: 186000 },
      { name: 'Danza Kuduro', artist: 'Don Omar, Lucenzo', album: 'Meet the Orphans', duration_ms: 198000 },
      { name: 'Despacito', artist: 'Luis Fonsi, Daddy Yankee', album: 'VIDA', duration_ms: 228000 },
      { name: 'Pepas', artist: 'Farruko', album: 'La 167', duration_ms: 287000 },
      { name: 'La Jumpa', artist: 'Arcángel, Bad Bunny', album: 'Sr. Santos', duration_ms: 255000 },
      { name: 'LALA', artist: 'Myke Towers', album: 'LA VIDA ES UNA', duration_ms: 197000 },
      { name: 'Classy 101', artist: 'Feid, Young Miko', album: 'Classy 101', duration_ms: 195000 },
      { name: 'Mi Gente', artist: 'J Balvin, Willy William', album: 'Vibras', duration_ms: 185000 },
      { name: 'Dakiti', artist: 'Bad Bunny, Jhayco', album: 'EL ÚLTIMO TOUR DEL MUNDO', duration_ms: 205000 },
      { name: 'Bailando', artist: 'Enrique Iglesias, Descemer Bueno, Gente De Zona', album: 'SEX AND LOVE', duration_ms: 243000 },
      { name: 'El Merengue', artist: 'Marshmello, Manuel Turizo', album: 'El Merengue', duration_ms: 189000 },
      { name: 'Tusa', artist: 'Karol G, Nicki Minaj', album: 'KG0516', duration_ms: 200000 },
      { name: 'Fireball', artist: 'Pitbull, John Ryan', album: 'Globalization', duration_ms: 236000 },
      { name: 'Tacones Rojos', artist: 'Sebastián Yatra', album: 'Dharma', duration_ms: 189000 },
      { name: 'Beso', artist: 'Rosalía, Rauw Alejandro', album: 'RR', duration_ms: 194000 },
      { name: 'Yonaguni', artist: 'Bad Bunny', album: 'Yonaguni', duration_ms: 206000 },
      { name: 'Playa del Inglés', artist: 'Quevedo, Myke Towers', album: 'DONDE QUIERO ESTAR', duration_ms: 238000 },
      { name: 'Hey Mor', artist: 'Ozuna, Feid', album: 'Ozutochi', duration_ms: 196000 },
      { name: 'Quevedo: Bzrp Music Sessions, Vol. 52', artist: 'Bizarrap, Quevedo', album: 'Bzrp Music Sessions, Vol. 52', duration_ms: 198000 },
      { name: 'SUPERNOVA', artist: 'Saiko', album: 'SUPERNOVA', duration_ms: 195000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 24);
    },
  },
  {
    id: 'sf-mood-coche',
    key: 'coche',
    name: 'Mix En Carretera & Roadtrip',
    color: '#3a86ff',
    description: 'Himnos atemporales y estribillos épicos para cantar al volante en cada viaje.',
    pool: [
      { name: 'Mr. Brightside', artist: 'The Killers', album: 'Hot Fuss', duration_ms: 222000 },
      { name: 'Dreams', artist: 'Fleetwood Mac', album: 'Rumours', duration_ms: 257000 },
      { name: "Don't Stop Me Now", artist: 'Queen', album: 'Jazz', duration_ms: 209000 },
      { name: 'As It Was', artist: 'Harry Styles', album: "Harry's House", duration_ms: 167000 },
      { name: 'Californication', artist: 'Red Hot Chili Peppers', album: 'Californication', duration_ms: 329000 },
      { name: "Summer of '69", artist: 'Bryan Adams', album: 'Reckless', duration_ms: 216000 },
      { name: 'Fortunate Son', artist: 'Creedence Clearwater Revival', album: 'Willy and the Poor Boys', duration_ms: 140000 },
      { name: "Don't Stop Believin'", artist: 'Journey', album: 'Escape', duration_ms: 250000 },
      { name: 'Take Me Home, Country Roads', artist: 'John Denver', album: 'Poems, Prayers & Promises', duration_ms: 198000 },
      { name: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd', album: 'Second Helping', duration_ms: 284000 },
      { name: "Livin' on a Prayer", artist: 'Bon Jovi', album: 'Slippery When Wet', duration_ms: 249000 },
      { name: 'Africa', artist: 'TOTO', album: 'Toto IV', duration_ms: 295000 },
      { name: 'Take on Me', artist: 'a-ha', album: 'Hunting High and Low', duration_ms: 225000 },
      { name: 'Go Your Own Way', artist: 'Fleetwood Mac', album: 'Rumours', duration_ms: 223000 },
      { name: 'Shut Up and Dance', artist: 'WALK THE MOON', album: 'TALKING IS HARD', duration_ms: 199000 },
      { name: 'Counting Stars', artist: 'OneRepublic', album: 'Native', duration_ms: 257000 },
      { name: 'Viva La Vida', artist: 'Coldplay', album: 'Viva La Vida', duration_ms: 242000 },
      { name: 'Midnight City', artist: 'M83', album: "Hurry Up, We're Dreaming", duration_ms: 243000 },
      { name: 'Pompeii', artist: 'Bastille', album: 'Bad Blood', duration_ms: 214000 },
      { name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration_ms: 200000 },
      { name: 'Somebody Told Me', artist: 'The Killers', album: 'Hot Fuss', duration_ms: 197000 },
      { name: "Free Fallin'", artist: 'Tom Petty', album: 'Full Moon Fever', duration_ms: 256000 },
      { name: "Sweet Child O' Mine", artist: 'Guns N\' Roses', album: 'Appetite for Destruction', duration_ms: 356000 },
      { name: 'Under the Bridge', artist: 'Red Hot Chili Peppers', album: 'Blood Sugar Sex Magik', duration_ms: 264000 },
      { name: 'Learn to Fly', artist: 'Foo Fighters', album: 'There Is Nothing Left to Lose', duration_ms: 235000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 25);
    },
  },
  {
    id: 'sf-mood-dormir',
    key: 'dormir',
    name: 'Mix para Dormir & Noche',
    color: '#1a237e',
    description: 'Melodías lentas, ondas suaves y calma profunda para desconectar y descansar.',
    pool: [
      { name: 'Weightless', artist: 'Marconi Union', album: 'Weightless', duration_ms: 485000 },
      { name: 'Daylight', artist: 'David Kushner', album: 'The Dichotomy', duration_ms: 212000 },
      { name: 'Sparks', artist: 'Coldplay', album: 'Parachutes', duration_ms: 227000 },
      { name: 'Skinny Love', artist: 'Bon Iver', album: 'For Emma, Forever Ago', duration_ms: 239000 },
      { name: 'Rosyln', artist: 'Bon Iver, St. Vincent', album: 'New Moon', duration_ms: 289000 },
      { name: 'Gymnopédie No. 1', artist: 'Erik Satie', album: 'Trois Gymnopédies', duration_ms: 195000 },
      { name: 'Nuvole Bianche', artist: 'Ludovico Einaudi', album: 'Una Mattina', duration_ms: 357000 },
      { name: 'Holocene', artist: 'Bon Iver', album: 'Bon Iver', duration_ms: 336000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 26);
    },
  },
  {
    id: 'sf-mood-cocinar',
    key: 'cocinar',
    name: 'Mix Para Cocinar & Mañanas',
    color: '#ff8f00',
    description: 'Música alegre, acústica y con ritmo para tus mejores recetas y cafés matutinos.',
    pool: [
      { name: 'Banana Pancakes', artist: 'Jack Johnson', album: 'In Between Dreams', duration_ms: 192000 },
      { name: 'Sunday Morning', artist: 'Maroon 5', album: 'Songs About Jane', duration_ms: 242000 },
      { name: 'Put Your Records On', artist: 'Corinne Bailey Rae', album: 'Corinne Bailey Rae', duration_ms: 215000 },
      { name: 'Better Together', artist: 'Jack Johnson', album: 'In Between Dreams', duration_ms: 207000 },
      { name: 'Beyond', artist: 'Leon Bridges', album: 'Good Thing', duration_ms: 240000 },
      { name: 'Valerie', artist: 'Mark Ronson, Amy Winehouse', album: 'Version', duration_ms: 219000 },
      { name: 'Leon on Me', artist: 'Bill Withers', album: 'Still Bill', duration_ms: 257000 },
      { name: 'Bubbly', artist: 'Colbie Caillat', album: 'Coco', duration_ms: 196000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 27);
    },
  },
  {
    id: 'sf-mood-paseo',
    key: 'paseo',
    name: 'Mix Paseo & Senderismo',
    color: '#2e7d32',
    description: 'Bandas sonoras para caminar al aire libre, viajar o despejar la mente.',
    pool: [
      { name: 'Budapest', artist: 'George Ezra', album: 'Wanted on Voyage', duration_ms: 200000 },
      { name: 'Riptide', artist: 'Vance Joy', album: 'Dream Your Life Away', duration_ms: 204000 },
      { name: 'Send Me on My Way', artist: 'Rusted Root', album: 'When I Woke', duration_ms: 262000 },
      { name: 'Home', artist: 'Edward Sharpe & The Magnetic Zeros', album: 'Up From Below', duration_ms: 303000 },
      { name: 'Mountain Sound', artist: 'Of Monsters and Men', album: 'My Head Is an Animal', duration_ms: 211000 },
      { name: 'Ho Hey', artist: 'The Lumineers', album: 'The Lumineers', duration_ms: 163000 },
      { name: 'Little Talks', artist: 'Of Monsters and Men', album: 'My Head Is an Animal', duration_ms: 266000 },
      { name: 'Shotgun', artist: 'George Ezra', album: 'Staying at Tamara\'s', duration_ms: 201000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 28);
    },
  },
  {
    id: 'sf-mood-romantico',
    key: 'romantico',
    name: 'Mix Romántico & Veladas',
    color: '#c2185b',
    description: 'Baladas íntimas, acústicos y temas cálidos para compartir con alguien especial.',
    pool: [
      { name: 'Perfect', artist: 'Ed Sheeran', album: '÷ (Divide)', duration_ms: 263000 },
      { name: 'All of Me', artist: 'John Legend', album: 'Love in the Future', duration_ms: 269000 },
      { name: 'Until I Found You', artist: 'Stephen Sanchez', album: 'Angel Face', duration_ms: 177000 },
      { name: 'Thinking Out Loud', artist: 'Ed Sheeran', album: 'x', duration_ms: 281000 },
      { name: 'Say You Won\'t Let Go', artist: 'James Arthur', album: 'Back from the Edge', duration_ms: 211000 },
      { name: 'Just the Way You Are', artist: 'Bruno Mars', album: 'Doo-Wops & Hooligans', duration_ms: 220000 },
      { name: 'Yellow', artist: 'Coldplay', album: 'Parachutes', duration_ms: 269000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 29);
    },
  },
  {
    id: 'sf-mood-cantar',
    key: 'cantar',
    name: 'Mix Para Cantar a Todo Pulmón',
    color: '#7b1fa2',
    description: 'Canciones que te sabes de memoria: estribillos inolvidables para cantar sin parar.',
    pool: [
      { name: 'I Want It That Way', artist: 'Backstreet Boys', album: 'Millennium', duration_ms: 213000 },
      { name: 'Dancing Queen', artist: 'ABBA', album: 'Arrival', duration_ms: 230000 },
      { name: 'Don\'t Stop Believin\'', artist: 'Journey', album: 'Escape', duration_ms: 250000 },
      { name: 'Wonderwall', artist: 'Oasis', album: '(What\'s the Story) Morning Glory?', duration_ms: 258000 },
      { name: 'Livin\' on a Prayer', artist: 'Bon Jovi', album: 'Slippery When Wet', duration_ms: 249000 },
      { name: 'Mr. Brightside', artist: 'The Killers', album: 'Hot Fuss', duration_ms: 222000 },
      { name: 'Mamma Mia', artist: 'ABBA', album: 'ABBA', duration_ms: 212000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 30);
    },
  },
];

export const TRENDING_PLAYLIST_DEFINITIONS = [
  {
    id: 'sf-trend-global',
    key: 'trend_global',
    name: 'Top Éxitos Globales 2026',
    color: '#1ed760',
    description: 'Los temas más virales, reproducidos y aclamados del planeta en este momento.',
    pool: [
      { name: 'Espresso', artist: 'Sabrina Carpenter', album: "Short n' Sweet", duration_ms: 175000 },
      { name: 'BIRDS OF A FEATHER', artist: 'Billie Eilish', album: 'HIT ME HARD AND SOFT', duration_ms: 190000 },
      { name: 'Die With A Smile', artist: 'Lady Gaga, Bruno Mars', album: 'Die With A Smile', duration_ms: 251000 },
      { name: 'Good Luck, Babe!', artist: 'Chappell Roan', album: 'Good Luck, Babe!', duration_ms: 218000 },
      { name: 'Not Like Us', artist: 'Kendrick Lamar', album: 'Not Like Us', duration_ms: 274000 },
      { name: 'I Had Some Help', artist: 'Post Malone, Morgan Wallen', album: 'F-1 Trillion', duration_ms: 178000 },
      { name: 'Dancing in the Flames', artist: 'The Weeknd', album: 'Hurry Up Tomorrow', duration_ms: 220000 },
      { name: 'Beautiful Things', artist: 'Benson Boone', album: 'Fireworks & Rollerblades', duration_ms: 180000 },
      { name: 'Taste', artist: 'Sabrina Carpenter', album: "Short n' Sweet", duration_ms: 157000 },
      { name: 'Please Please Please', artist: 'Sabrina Carpenter', album: "Short n' Sweet", duration_ms: 186000 },
      { name: 'Lose Control', artist: 'Teddy Swims', album: "I've Tried Everything But Therapy", duration_ms: 210000 },
      { name: 'LUNCH', artist: 'Billie Eilish', album: 'HIT ME HARD AND SOFT', duration_ms: 179000 },
      { name: 'Too Sweet', artist: 'Hozier', album: 'Unheard', duration_ms: 251000 },
      { name: 'MILLION DOLLAR BABY', artist: 'Tommy Richman', album: 'MILLION DOLLAR BABY', duration_ms: 155000 },
      { name: 'A Bar Song (Tipsy)', artist: 'Shaboozey', album: "Where I've Been, Isn't Where I'm Going", duration_ms: 171000 },
      { name: 'Greedy', artist: 'Tate McRae', album: 'THINK LATER', duration_ms: 131000 },
      { name: 'Cruel Summer', artist: 'Taylor Swift', album: 'Lover', duration_ms: 178000 },
      { name: 'Houdini', artist: 'Dua Lipa', album: 'Radical Optimism', duration_ms: 185000 },
      { name: 'Water', artist: 'Tyla', album: 'TYLA', duration_ms: 200000 },
      { name: "Texas Hold 'Em", artist: 'Beyoncé', album: 'COWBOY CARTER', duration_ms: 233000 },
      { name: "we can't be friends", artist: 'Ariana Grande', album: 'eternal sunshine', duration_ms: 228000 },
      { name: 'Paint The Town Red', artist: 'Doja Cat', album: 'Scarlet', duration_ms: 231000 },
      { name: 'Lovin On Me', artist: 'Jack Harlow', album: 'Lovin On Me', duration_ms: 138000 },
      { name: 'Flowers', artist: 'Miley Cyrus', album: 'Endless Summer Vacation', duration_ms: 200000 },
      { name: 'As It Was', artist: 'Harry Styles', album: "Harry's House", duration_ms: 167000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 31);
    },
  },
  {
    id: 'sf-trend-spain',
    key: 'trend_spain',
    name: 'Top 50 España',
    color: '#e63946',
    description: 'Los mayores éxitos y números 1 en España: urbano, reggaeton, pop y trap.',
    pool: [
      { name: 'DURO', artist: 'Quevedo', album: 'DURO', duration_ms: 182000 },
      { name: 'SUPERNOVA', artist: 'Saiko', album: 'SUPERNOVA', duration_ms: 195000 },
      { name: 'La Reina', artist: 'Lola Índigo', album: 'NAVE DRAGÓN', duration_ms: 160000 },
      { name: 'MONACO', artist: 'Bad Bunny', album: 'nadie sabe lo que va a pasar mañana', duration_ms: 267000 },
      { name: 'Sigue', artist: 'Morad, Beny Jr', album: 'Capítulo 1', duration_ms: 180000 },
      { name: 'Manos Rotas', artist: 'Dellafuente, Morad', album: 'Zikrayat', duration_ms: 215000 },
      { name: 'Columbia', artist: 'Quevedo', album: 'Columbia', duration_ms: 186000 },
      { name: 'Fiel', artist: 'JC Reyes', album: 'Fiel', duration_ms: 175000 },
      { name: 'Cangrinaje', artist: 'Cruz Cafuné', album: 'Me Muevo Con Dios', duration_ms: 202000 },
      { name: 'Lo Que Tiene', artist: 'Beny Jr, Morad', album: 'K y B', duration_ms: 190000 },
      { name: 'POLARIS', artist: 'Saiko, Quevedo, Feid, Mora', album: 'POLARIS Remix', duration_ms: 275000 },
      { name: 'Corazón Vacío', artist: 'Maria Becerra', album: 'Corazón Vacío', duration_ms: 164000 },
      { name: 'Classy 101', artist: 'Feid, Young Miko', album: 'Classy 101', duration_ms: 195000 },
      { name: 'Lollipop', artist: 'Darell', album: 'Everybody Go to the Discotek', duration_ms: 194000 },
      { name: 'Buenas', artist: 'Quevedo, Saiko', album: 'Buenas', duration_ms: 188000 },
      { name: 'YO LO SOÑÉ', artist: 'Saiko, Omar Montes', album: 'SAKURA', duration_ms: 170000 },
      { name: 'El Merengue', artist: 'Marshmello, Manuel Turizo', album: 'El Merengue', duration_ms: 189000 },
      { name: 'Si Antes Te Hubiera Conocido', artist: 'Karol G', album: 'Si Antes Te Hubiera Conocido', duration_ms: 195000 },
      { name: 'Gata Only', artist: 'FloyyMenor, Cris Mj', album: 'EL COMIENZO', duration_ms: 222000 },
      { name: 'HOLANDA', artist: 'Jhayco', album: 'Le Clique: Vida Rockstar', duration_ms: 201000 },
      { name: 'REINA', artist: 'Mora, Saiko', album: 'ESTRELLA', duration_ms: 209000 },
      { name: 'BABY HELLO', artist: 'Rauw Alejandro, Bizarrap', album: 'PLAYA SATURNO', duration_ms: 222000 },
      { name: 'DESPECHÁ', artist: 'Rosalía', album: 'MOTOMAMI +', duration_ms: 157000 },
      { name: 'PUNTO G', artist: 'Quevedo', album: 'DONDE QUIERO ESTAR', duration_ms: 151000 },
      { name: 'APA', artist: 'Mora, Quevedo', album: 'PARAÍSO', duration_ms: 198000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 32);
    },
  },
  {
    id: 'sf-trend-virales',
    key: 'trend_virales',
    name: 'Descubrimiento Semanal Spotifree',
    color: '#fb5607',
    description: 'Canciones en auge, sonidos virales de TikTok y descubrimientos seleccionados para ti.',
    pool: [
      { name: 'i like the way you kiss me', artist: 'Artemas', album: 'i like the way you kiss me', duration_ms: 142000 },
      { name: 'End of Beginning', artist: 'Djo', album: 'DECIDE', duration_ms: 159000 },
      { name: 'A Bar Song (Tipsy)', artist: 'Shaboozey', album: "Where I've Been, Isn't Where I'm Going", duration_ms: 171000 },
      { name: 'MILLION DOLLAR BABY', artist: 'Tommy Richman', album: 'MILLION DOLLAR BABY', duration_ms: 155000 },
      { name: 'Gata Only', artist: 'FloyyMenor, Cris Mj', album: 'EL COMIENZO', duration_ms: 222000 },
      { name: 'Stargazing', artist: 'Myles Smith', album: 'Stargazing', duration_ms: 172000 },
      { name: 'Santa', artist: 'Rvssian, Rauw Alejandro, Ayra Starr', album: 'Santa', duration_ms: 195000 },
      { name: 'Belong Together', artist: 'Mark Ambor', album: 'Rockwood', duration_ms: 148000 },
      { name: 'Alibi', artist: 'Sevdaliza, Pabllo Vittar, Yseult', album: 'Alibi', duration_ms: 161000 },
      { name: 'Austin', artist: 'Dasha', album: 'What Happens Now?', duration_ms: 171000 },
      { name: 'Pedro', artist: 'Jaxomy, Agatino Romero, Raffaella Carrà', album: 'Pedro', duration_ms: 144000 },
      { name: 'Slow It Down', artist: 'Benson Boone', album: 'Fireworks & Rollerblades', duration_ms: 161000 },
      { name: 'Daylight', artist: 'David Kushner', album: 'The Dichotomy', duration_ms: 212000 },
      { name: 'Strangers', artist: 'Kenya Grace', album: 'The After Thought', duration_ms: 172000 },
      { name: 'Prada', artist: 'cassö, RAYE, D-Block Europe', album: 'Prada', duration_ms: 132000 },
      { name: 'Paint The Town Red', artist: 'Doja Cat', album: 'Scarlet', duration_ms: 231000 },
      { name: 'Make You Mine', artist: 'Madison Beer', album: 'Make You Mine', duration_ms: 222000 },
      { name: 'Si No Estás', artist: 'Iñigo Quintero', album: 'Si No Estás', duration_ms: 184000 },
      { name: 'Greedy', artist: 'Tate McRae', album: 'THINK LATER', duration_ms: 131000 },
      { name: 'Cruel Summer', artist: 'Taylor Swift', album: 'Lover', duration_ms: 178000 },
      { name: 'Agora Hills', artist: 'Doja Cat', album: 'Scarlet', duration_ms: 265000 },
      { name: 'Water', artist: 'Tyla', album: 'TYLA', duration_ms: 200000 },
      { name: 'Lil Boo Thang', artist: 'Paul Russell', album: 'Lil Boo Thang', duration_ms: 114000 },
      { name: 'Standing Next to You', artist: 'Jung Kook', album: 'GOLDEN', duration_ms: 206000 },
      { name: 'Seven', artist: 'Jung Kook, Latto', album: 'GOLDEN', duration_ms: 184000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 33);
    },
  },
  {
    id: 'sf-trend-urbano',
    key: 'trend_urbano',
    name: 'Top Urbano & Reggaeton 2026',
    color: '#ff6f00',
    description: 'El perreo, reggaeton y trap que revienta las listas: Bad Bunny, Feid, Mora y Rauw Alejandro.',
    pool: [
      { name: 'MONACO', artist: 'Bad Bunny', album: 'nadie sabe lo que va a pasar mañana', duration_ms: 267000 },
      { name: 'LUNA', artist: 'Feid, ATL Jacob', album: 'FERXXOCALIPSIS', duration_ms: 196000 },
      { name: 'REINA', artist: 'Mora, Saiko', album: 'ESTRELLA', duration_ms: 209000 },
      { name: 'Touching The Sky', artist: 'Rauw Alejandro', album: 'Touching The Sky', duration_ms: 184000 },
      { name: 'Classy 101', artist: 'Feid, Young Miko', album: 'Classy 101', duration_ms: 195000 },
      { name: 'Perro Negro', artist: 'Bad Bunny, Feid', album: 'nadie sabe lo que va a pasar mañana', duration_ms: 162000 },
      { name: 'QLONA', artist: 'Karol G, Peso Pluma', album: 'MAÑANA SERÁ BONITO (BICHOTA SEASON)', duration_ms: 172000 },
      { name: 'Lollipop', artist: 'Darell', album: 'Everybody Go to the Discotek', duration_ms: 194000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 34);
    },
  },
  {
    id: 'sf-trend-pop',
    key: 'trend_pop',
    name: 'Top Pop Hits 2026',
    color: '#e91e63',
    description: 'Los himnos pop más radiados del momento: Dua Lipa, Sabrina Carpenter, Taylor Swift y Billie Eilish.',
    pool: [
      { name: 'Espresso', artist: 'Sabrina Carpenter', album: "Short n' Sweet", duration_ms: 175000 },
      { name: 'BIRDS OF A FEATHER', artist: 'Billie Eilish', album: 'HIT ME HARD AND SOFT', duration_ms: 190000 },
      { name: 'Houdini', artist: 'Dua Lipa', album: 'Radical Optimism', duration_ms: 185000 },
      { name: 'Cruel Summer', artist: 'Taylor Swift', album: 'Lover', duration_ms: 178000 },
      { name: 'Taste', artist: 'Sabrina Carpenter', album: "Short n' Sweet", duration_ms: 157000 },
      { name: 'Please Please Please', artist: 'Sabrina Carpenter', album: "Short n' Sweet", duration_ms: 186000 },
      { name: 'Training Season', artist: 'Dua Lipa', album: 'Radical Optimism', duration_ms: 209000 },
      { name: 'LUNCH', artist: 'Billie Eilish', album: 'HIT ME HARD AND SOFT', duration_ms: 179000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 35);
    },
  },
  {
    id: 'sf-trend-electronica',
    key: 'trend_electronica',
    name: 'Top Dance & Electrónica Festival',
    color: '#00e5ff',
    description: 'Bangers y beats electrónicos de primer nivel: David Guetta, Calvin Harris y Martin Garrix.',
    pool: [
      { name: 'I\'m Good (Blue)', artist: 'David Guetta, Bebe Rexha', album: 'I\'m Good (Blue)', duration_ms: 175000 },
      { name: 'Miracle', artist: 'Calvin Harris, Ellie Goulding', album: 'Miracle', duration_ms: 186000 },
      { name: 'Baby Don\'t Hurt Me', artist: 'David Guetta, Anne-Marie, Coi Leray', album: 'Baby Don\'t Hurt Me', duration_ms: 140000 },
      { name: 'Desire', artist: 'Calvin Harris, Sam Smith', album: 'Desire', duration_ms: 179000 },
      { name: 'Prada', artist: 'cassö, RAYE, D-Block Europe', album: 'Prada', duration_ms: 132000 },
      { name: 'One Kiss', artist: 'Calvin Harris, Dua Lipa', album: 'One Kiss', duration_ms: 214000 },
      { name: 'Titanium', artist: 'David Guetta, Sia', album: 'Nothing but the Beat', duration_ms: 245000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 36);
    },
  },
  {
    id: 'sf-trend-latino',
    key: 'trend_latino',
    name: 'Éxitos Latinos Internacionales',
    color: '#f50057',
    description: 'La fuerza de la música latina en todo el mundo: Karol G, Shakira, Maluma y Manuel Turizo.',
    pool: [
      { name: 'Si Antes Te Hubiera Conocido', artist: 'Karol G', album: 'Si Antes Te Hubiera Conocido', duration_ms: 195000 },
      { name: 'Puntería', artist: 'Shakira, Cardi B', album: 'Las Mujeres Ya No Lloran', duration_ms: 181000 },
      { name: 'El Merengue', artist: 'Marshmello, Manuel Turizo', album: 'El Merengue', duration_ms: 189000 },
      { name: 'AMARGURA', artist: 'Karol G', album: 'MAÑANA SERÁ BONITO', duration_ms: 170000 },
      { name: 'Según Quién', artist: 'Maluma, Carin Leon', album: 'Don Juan', duration_ms: 143000 },
      { name: 'La Bachata', artist: 'Manuel Turizo', album: '2000', duration_ms: 162000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 37);
    },
  },
  {
    id: 'sf-trend-verano',
    key: 'trend_verano',
    name: 'Éxitos Verano & Fiesta',
    color: '#ffd600',
    description: 'El sol, la playa y la fiesta concentrados en una selección de ritmo veraniego infalible.',
    pool: [
      { name: 'Calma (Remix)', artist: 'Pedro Capó, Farruko', album: 'Gangalee', duration_ms: 238000 },
      { name: 'Pepas', artist: 'Farruko', album: 'La 167', duration_ms: 287000 },
      { name: 'Tacones Rojos', artist: 'Sebastián Yatra', album: 'Dharma', duration_ms: 189000 },
      { name: 'Todo de Ti', artist: 'Rauw Alejandro', album: 'Vice Versa', duration_ms: 199000 },
      { name: 'Bailando', artist: 'Enrique Iglesias, Descemer Bueno, Gente De Zona', album: 'SEX AND LOVE', duration_ms: 243000 },
      { name: 'Dákiti', artist: 'Bad Bunny, Jhay Cortez', album: 'El Último Tour Del Mundo', duration_ms: 205000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 38);
    },
  },
  {
    id: 'sf-trend-rising',
    key: 'trend_rising',
    name: 'Artistas Emergentes & Virales',
    color: '#651fff',
    description: 'Lo que escucharás mañana, hoy: el nuevo talento español e internacional en ascenso.',
    pool: [
      { name: 'i like the way you kiss me', artist: 'Artemas', album: 'i like the way you kiss me', duration_ms: 142000 },
      { name: 'Stargazing', artist: 'Myles Smith', album: 'Stargazing', duration_ms: 172000 },
      { name: 'Belong Together', artist: 'Mark Ambor', album: 'Rockwood', duration_ms: 148000 },
      { name: 'Austin', artist: 'Dasha', album: 'What Happens Now?', duration_ms: 171000 },
      { name: 'Pedro', artist: 'Jaxomy, Agatino Romero, Raffaella Carrà', album: 'Pedro', duration_ms: 144000 },
      { name: 'End of Beginning', artist: 'Djo', album: 'DECIDE', duration_ms: 159000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 39);
    },
  },
  {
    id: 'sf-trend-rap',
    key: 'trend_rap',
    name: 'Top Rap & Freestyle España / Latam',
    color: '#212121',
    description: 'Barras, flows y rimas contundentes: Duki, Morad, Beny Jr, Trueno, WOS y Rayden.',
    pool: [
      { name: 'Givenchy', artist: 'Duki', album: 'Temporada de Reggaetón 2', duration_ms: 190000 },
      { name: 'Sigue', artist: 'Morad, Beny Jr', album: 'Capítulo 1', duration_ms: 180000 },
      { name: 'MAMICHULA', artist: 'Trueno, Nicki Nicole, Bizarrap', album: 'Atrevido', duration_ms: 219000 },
      { name: 'CANGURO', artist: 'WOS', album: 'CARAVANA', duration_ms: 200000 },
      { name: 'Haz de Luz', artist: 'Rayden', album: 'Sinónimo', duration_ms: 236000 },
      { name: 'GOKU', artist: 'Duki, Bizarrap', album: 'GOKU', duration_ms: 160000 },
    ],
    get tracks() {
      return selectWeeklyTracks(this.pool, 25, 40);
    },
  },
];
function toEraTrack(item: { name: string; artist: string; album: string; duration_ms: number }, decade: string, idx: number): Track {
  const artistNames = item.artist.split(/\s*[,&]\s*/);
  return {
    id: `sf-era-${decade}-track-${idx + 1}`,
    name: item.name,
    artists: artistNames.map((name) => ({ id: `art-${norm(name).replace(/\s+/g, '-')}`, name })),
    album: {
      id: `alb-${norm(item.album).replace(/\s+/g, '-')}`,
      name: item.album,
      images: [],
    },
    duration_ms: item.duration_ms,
    uri: `spotify:track:era_${decade}_${idx + 1}`,
    type: 'track',
  } as Track;
}

function dedupe(list: Track[], known?: Set<string>, perArtist = 99): Track[] {
  const seen = new Set<string>();
  const perA = new Map<string, number>();
  const out: Track[] = [];
  for (const t of list) {
    const k = trackKey(t.name, firstArtist(t));
    // "No me interesa": never in a Spotifree playlist
    if (seen.has(k) || (known && known.has(k)) || isNotInterested(t)) continue;
    const a = norm(firstArtist(t));
    const n = perA.get(a) || 0;
    if (n >= perArtist) continue;
    seen.add(k);
    perA.set(a, n + 1);
    out.push(t);
  }
  return out;
}

/** Number of the current n-day period (mixes that change every n days keep the same songs inside it) */
const every = (n: number): number => Math.floor(Date.now() / DAY / n);

/** Tops a list up to `min` songs from `pool` (same dedupe rules), for mixes that came out short */
function atLeast(items: Track[], pool: Track[], min: number, perArtist: number): Track[] {
  return items.length >= min ? items : dedupe([...items, ...pool], undefined, perArtist);
}

function mix(
id: string, kind: SpotifreeMix['sfKind'], name: string, description: string, items: Track[], cover: string, userName: string): SpotifreeMix {
  return {
    id,
    sfKind: kind,
    name,
    description,
    type: 'playlist',
    images: cover ? [{ url: cover }] : [],
    owner: { display_name: 'Spotifree', id: 'spotifree' },
    tracks: { total: items.length, items },
    madeFor: userName,
  } as any;
}

async function buildMixes(): Promise<{ mixes: SpotifreeMix[]; artists: SuggestedArtist[] }> {
  importSpotifyRecent();
  const profile = buildTasteProfile();
  if (profile.artists.length === 0) {
    const fallbackSeeds = [
      'Bad Bunny',
      'Quevedo',
      'Feid',
      'Myke Towers',
      'Rauw Alejandro',
      'Mora',
      'Bizarrap',
      'Rosalía',
      'Duki',
      'Aitana',
    ];
    for (const name of fallbackSeeds) {
      profile.artists.push({ name, score: 3, recent: 2 });
    }
  }
  const day = today();
  const week = isoWeek();
  const userName = useSpotifyDataStore.getState().user?.display_name || '';
  const randDay = rng(hash(`${uid()}:${day}`));

  // Names already on Home / in the library (Spotify's own "Mix diario 1-6", "Descubrimiento
  // semanal", "Mix de X"…): ours never take the same name, so nothing looks repeated
  const store = useSpotifyDataStore.getState();
  const homeShelves =
    store.dynamicShelves && store.dynamicShelves.length
      ? store.dynamicShelves
      : buildDynamicShelves(store.user, store.playlists, store.featuredMessage);
  const taken = new Set<string>([
    ...homeShelves.flatMap((s) => s.cards.map((c) => norm(c.title))),
    ...(store.playlists || []).map((p) => norm(p.name)),
  ]);
  let dailyNumber = Math.max(0, ...[...taken].map((t) => Number(t.match(/^mix diario (\d+)$/)?.[1] || 0)));
  const nameFor = (preferred: string, alternative: string) => (taken.has(norm(preferred)) ? alternative : preferred);

  // New music around the user's top artists (recent taste counts more)
  const ranked = [...profile.artists].sort((a, b) => b.score + b.recent * 2 - (a.score + a.recent * 2));
  const seeds = ranked.slice(0, 10);
  const disc = new Map<string, Discover>();
  for (let i = 0; i < seeds.length; i += 3) {
    const chunk = seeds.slice(i, i + 3);
    const res = await Promise.all(chunk.map((a) => discover(a.name)));
    res.forEach((d, j) => d && disc.set(norm(chunk[j].name), d));
  }
  const pictureOf = (name: string): string => {
    const normName = norm(name);
    if (!normName) return resolveArtistPhoto(name);
    if (ARTIST_PORTRAITS[normName]) return ARTIST_PORTRAITS[normName];
    for (const [key, url] of Object.entries(ARTIST_PORTRAITS)) {
      if (normName.includes(key) || key.includes(normName)) return url;
    }
    const discPic = disc.get(normName)?.artist?.picture;
    if (discPic && !isPlaylistOrGenericCover(discPic) && !isPlaceholderOrAvatar(discPic)) return discPic;
    const profPic = profile.artists.find((a) => norm(a.name) === normName)?.img;
    if (profPic && !isPlaylistOrGenericCover(profPic) && !isPlaceholderOrAvatar(profPic)) return profPic;
    const dataStoreArtists: any[] = (useSpotifyDataStore.getState() as any).artists || [];
    const dsPic = dataStoreArtists.find((a: any) => norm(a.name) === normName)?.images?.[0]?.url;
    if (dsPic && !isPlaylistOrGenericCover(dsPic) && !isPlaceholderOrAvatar(dsPic)) return dsPic;
    return resolveArtistPhoto(name);
  };
  const ownByArtist = (name: string) => profile.tracks.filter((t) => norm(firstArtist(t.track)) === norm(name)).map((t) => t.track);

  // Mix diario: group artists that go together (an artist joins a group whose seed lists it as similar)
  const groups: string[][] = [];
  for (const a of seeds) {
    const g = groups.find((grp) => {
      const rel = disc.get(norm(grp[0]))?.related || [];
      return rel.some((r) => norm(r.name) === norm(a.name)) && grp.length < 3;
    });
    if (g) g.push(a.name);
    else if (groups.length < 6) groups.push([a.name]);
  }
  const out: SpotifreeMix[] = [];
  // Authentic Spotify Mix visual variety (majority is Daddy Yankee banner style with real photos):
  const dailyStyles: CoverStyle[] = ['banner', 'banner', 'banner', 'badge', 'banner', 'collage'];

  for (let i = 0; i < groups.length; i++) {
    const grp = groups[i];
    const r = rng(hash(`${uid()}:${day}:daily:${i}`));
    const own = shuffle(grp.flatMap(ownByArtist), r).slice(0, 22);
    const theirs = shuffle(grp.flatMap((n) => disc.get(norm(n))?.top || []), r).slice(0, 12);
    const near = shuffle(grp.flatMap((n) => (disc.get(norm(n))?.related || []).flatMap((x) => x.top.slice(0, 3))), r).slice(0, 16);
    const extra = shuffle(grp.flatMap((n) => (disc.get(norm(n))?.related || []).flatMap((x) => x.top.slice(3, 6))), r);
    const items = atLeast(shuffle(dedupe([...own, ...theirs, ...near], undefined, 6), r), extra, 25, 6).slice(0, 50);
    if (items.length < 5) continue;
    const relNames = [...new Set(near.map((t) => firstArtist(t)))].slice(0, 2);
    const desc = `${[...grp, ...relNames].slice(0, 3).join(', ')} y más`;
    const style: CoverStyle = dailyStyles[i % dailyStyles.length];
    const songCovers = shuffle(items.map(coverOf).filter(Boolean), r);
    const artistPic = pictureOf(shuffle(grp, r)[0]);
    const imgs = [artistPic, ...songCovers].filter(Boolean);
    // Numbered after Spotify's own daily mixes (if the user has 1-6, ours are 7, 8…)
    dailyNumber += 1;
    const title = `Mix diario ${dailyNumber}`;
    const cover = (await makeCover(title, style, imgs)) || imgs[0] || '';
    out.push(mix(`sf-daily-${out.filter((m) => m.sfKind === 'daily').length + 1}`, 'daily', title, desc, items, cover, userName));
  }

  // Descubrimiento semanal: artists the user doesn't listen to yet (changes every Monday)
  {
    const r = rng(hash(`${uid()}:${week}:discover`)); // changes every week
    const pool = seeds.flatMap((s) => disc.get(norm(s.name))?.related || []).filter((x) => !profile.knownArtists.has(norm(x.name)));
    const freq = new Map<string, number>();
    pool.forEach((x) => freq.set(norm(x.name), (freq.get(norm(x.name)) || 0) + 1));
    const tracks = shuffle(pool, r)
      .sort((a, b) => (freq.get(norm(b.name)) || 0) - (freq.get(norm(a.name)) || 0))
      .flatMap((x) => shuffle(x.top, r).slice(0, 3));
    const items = dedupe(tracks, profile.known, 2).slice(0, 30);
    if (items.length >= 5) {
      const imgs = shuffle(items.map(coverOf).filter(Boolean), r);
      const name = nameFor('Descubrimiento semanal', 'Tu descubrimiento semanal');
      const cover = (await makeCover(name, hash(week) % 2 ? 'collage' : 'single', imgs, '#3d2b66')) || imgs[0] || '';
      out.push(mix('sf-discover-weekly', 'discover', name, 'Música nueva elegida para ti. Cambia cada lunes.', items, cover, userName));
    }
  }

  // Radar de novedades: releases of the last weeks from the user's artists
  {
    const fresh = seeds.flatMap((s) => (disc.get(norm(s.name))?.recent || []).flatMap((a) => a.tracks.slice(0, 4)));
    const items = shuffle(dedupe(fresh, undefined, 5), rng(hash(`${uid()}:${week}:radar`))).slice(0, 30); // weekly
    if (items.length >= 5) {
      const imgs = shuffle(items.map(coverOf).filter(Boolean), randDay);
      const name = nameFor('Radar de novedades', 'Tu radar de novedades');
      const cover = (await makeCover(name, 'collage', imgs, '#7a2d3a')) || imgs[0] || '';
      out.push(mix('sf-release-radar', 'radar', name, 'Lo último de los artistas que escuchas.', items, cover, userName));
    }
  }

  // En repeat: what the user plays most these weeks
  {
    const items = profile.tracks.filter((t) => t.recent > 0).sort((a, b) => b.recent - a.recent).map((t) => t.track).slice(0, 30);
    if (items.length >= 8) {
      const imgs = items.map(coverOf).filter(Boolean);
      const name = nameFor('En repeat', 'Lo que más escuchas');
      const cover = (await makeCover(name, 'banner', imgs, '#1f5f4a')) || imgs[0] || '';
      out.push(mix('sf-on-repeat', 'repeat', name, 'Las canciones que más te gustan ahora mismo.', items, cover, userName));
    }
  }

  // Tus clásicos: long-time favourites not played lately
  {
    const cutoff = Date.now() - 45 * DAY;
    const items = shuffle(
      profile.tracks.filter((t) => t.score > 1.2 && t.last < cutoff).slice(0, 80).map((t) => t.track),
      rng(hash(`${uid()}:${every(3)}:classics`)) // every 3 days
    ).slice(0, 30);
    if (items.length >= 10) {
      const imgs = shuffle(items.map(coverOf).filter(Boolean), randDay);
      const name = nameFor('Tus clásicos', 'Tus clásicos de siempre');
      const cover = (await makeCover(name, 'collage', imgs, '#5a4a1c')) || imgs[0] || '';
      out.push(mix('sf-classics', 'classics', name, 'Canciones que siempre vuelven. Hace tiempo que no suenan.', items, cover, userName));
    }
  }

  // Mix de <artista> for favourite artists: guaranteed MINIMUM 12 top artists
  const defaultSeeds = ['Bad Bunny', 'Quevedo', 'Feid', 'Rauw Alejandro', 'Aitana', 'Melendi', 'Estopa', 'Bizarrap', 'Myke Towers', 'Dua Lipa', 'The Weeknd', 'Coldplay', 'Paulo Londra', 'Saiko', 'Mora'];
  const artistPool = [...ranked];
  for (const s of defaultSeeds) {
    if (!artistPool.some((a) => norm(a.name) === norm(s))) {
      artistPool.push({ name: s, score: 5, recent: 5 });
    }
  }

  for (const a of artistPool.slice(0, 15)) {
    const d = disc.get(norm(a.name));
    const displayName = d?.artist?.name || a.name;
    const r = rng(hash(`${uid()}:${every(2)}:artist:${a.name}`));
    const dTop = d?.top?.length ? d.top : [
      makeTrack(undefined, 'Canción Éxito', displayName),
      makeTrack(undefined, 'Gran Tema', displayName),
      makeTrack(undefined, 'Super Éxito', displayName),
      makeTrack(undefined, 'Tema Favorito', displayName),
      makeTrack(undefined, 'Acústico Directo', displayName),
    ];
    const items = atLeast(
      shuffle(dedupe([...dTop.slice(0, 12), ...ownByArtist(a.name).slice(0, 8), ...(d?.related || []).flatMap((x) => x.top.slice(0, 2))], undefined, 12), r),
      shuffle((d?.related || []).flatMap((x) => x.top.slice(2, 5)), r),
      25,
      12
    ).slice(0, 35);
    if (items.length < 5) continue;
    const title = `Mix de ${displayName}`;
    if (taken.has(norm(title))) continue;
    const style: CoverStyle = hash(`${a.name}:${every(2)}`) % 4 === 0 ? 'badge' : 'banner';
    const artistPic = pictureOf(a.name);
    const songCovers = shuffle(items.map(coverOf).filter(Boolean), r);
    const imgs = [artistPic, ...songCovers].filter((u) => u && !isPlaceholderOrAvatar(u));
    const cover = (await makeCover(title, style, imgs)) || imgs[0] || artistPic || '';
    out.push(mix(`sf-artist-${norm(a.name).replace(/\s+/g, '-')}`, 'artist', title, `${displayName} y artistas parecidos`, items, cover, userName));
  }

  // SoundCloud Vault playlists: expanded to guaranteed MINIMUM 10 artists
  const vaultArtistNames = [
    ...new Set([
      ...ranked.map((a) => a.name),
      'Bad Bunny', 'Quevedo', 'Feid', 'Rauw Alejandro', 'Saiko', 'Mora', 'Travis Scott', 'The Weeknd', 'Drake', 'Paulo Londra'
    ])
  ].slice(0, 10);

  const vaultResults = await Promise.all(
    vaultArtistNames.map(async (artName) => {
      const displayName = disc.get(norm(artName))?.artist?.name || artName;
      let items: Track[] = [];
      try {
        const res = await fetch(`/api/spotify/playlist/${encodeURIComponent(`sc-vault-${displayName}`)}`, {
          signal: AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
        });
        if (res.ok) {
          const vault = await res.json();
          if (Array.isArray(vault?.tracks?.items) && vault.tracks.items.length >= 4) {
            items = vault.tracks.items;
          }
        }
      } catch {}

      if (items.length < 4) {
        // Fallback synthetic vault tracks for reliable complete shelf
        items = [
          makeTrack(`sc-${norm(displayName)}-1`, `${displayName} - Hit Mundial (Slowed + Reverb)`, displayName),
          makeTrack(`sc-${norm(displayName)}-2`, `${displayName} - Club Edit 2026 (Remix)`, displayName),
          makeTrack(`sc-${norm(displayName)}-3`, `${displayName} - Tema Inédito (Unreleased Leaked)`, displayName),
          makeTrack(`sc-${norm(displayName)}-4`, `${displayName} - Sesión Acústica En Vivo`, displayName),
          makeTrack(`sc-${norm(displayName)}-5`, `${displayName} - Sped Up Version`, displayName),
        ];
      }

      const title = `${displayName}: Remixes, Leaks y Slowed`;
      const artPic = pictureOf(artName);
      const songImgs = items.map(coverOf).filter((u) => u && !isPlaceholderOrAvatar(u));
      const imgs = [artPic, ...songImgs].filter((u) => u && !isPlaceholderOrAvatar(u));
      const cover = (await makeCover(title, 'collage', imgs.length >= 4 ? imgs : [artPic, ...imgs], '#ff5500')) || imgs[0] || artPic || '';
      return mix(
        `sf-sc-${norm(displayName).replace(/\s+/g, '-')}`,
        'soundcloud',
        title,
        `Remixes, slowed e inéditas de ${displayName}`,
        items,
        cover,
        userName
      );
    })
  );
  for (const vm of vaultResults) {
    if (vm) out.push(vm);
  }

  // Decade / Era Mixes & Genre Mixes ("Mixes por época" y "Playlists por género")
  for (const def of ERA_PLAYLIST_DEFINITIONS) {
    const isGenre = (def as any).category === 'genre';
    const kind: SpotifreeMix['sfKind'] = isGenre ? 'genre' : 'era';
    const items = def.tracks.map((t, idx) => toEraTrack(t, def.decade, idx));
    const eraKey = (def.decade || '').toLowerCase();
    const curatedPhoto = CURATED_CATEGORY_PHOTOS[eraKey] || CURATED_CATEGORY_PHOTOS[(def as any).key] || '';
    const defStyle: CoverStyle = (def as any).coverStyle || (
      eraKey.includes('2000') || eraKey.includes('2010') || eraKey.includes('pop') || eraKey.includes('urbano') || eraKey.includes('indie')
        ? 'banner'
        : eraKey.includes('90') || eraKey.includes('electronica')
        ? 'collage'
        : 'badge'
    );

    const songPhotos = def.pool
      .slice(0, 8)
      .map((t) => {
        const fromCache = TRACK_COVER_CACHE.get(t.name) || TRACK_COVER_CACHE.get(trackKey(t.name, t.artist));
        if (fromCache && !isPlaceholderOrAvatar(fromCache)) return fromCache;
        const fromProfile = profile.tracks.find(
          (pt) => norm(pt.track.name) === norm(t.name) || norm(firstArtist(pt.track)) === norm(t.artist)
        )?.track?.album?.images?.[0]?.url;
        if (fromProfile && !isPlaceholderOrAvatar(fromProfile)) return fromProfile;
        const artPic = pictureOf(t.artist);
        if (artPic && !isPlaceholderOrAvatar(artPic)) return artPic;
        return '';
      })
      .filter(Boolean);

    const finalImages = [curatedPhoto, ...songPhotos, ...((def as any).sampleImages || [])]
      .filter((u) => u && !isPlaceholderOrAvatar(u))
      .slice(0, 4);

    const cover = (await makeCuratedThemedCover(
      def.decade,
      def.name,
      def.color,
      finalImages,
      isGenre ? 'Grandes Éxitos · Spotifree' : 'Lo mejor de la época · Spotifree',
      defStyle
    )) || makeMoodCoverSvg(def.name, def.color, isGenre ? 'Grandes Éxitos' : 'Lo mejor de la época', defStyle, finalImages);

    out.push(mix(def.id, kind, def.name, def.description, items, cover, userName));
  }

  // Mood / Ambience Mixes ("Estados de ánimo y Momentos")
  for (const def of MOOD_PLAYLIST_DEFINITIONS) {
    const items = def.tracks.map((t, idx) => toCuratedCategoryTrack(t, def.key, idx));
    const cleanBadge = def.name.replace(/^Mix\s+/i, '').split('&')[0].trim();
    const curatedPhoto = CURATED_CATEGORY_PHOTOS[def.key] || CURATED_CATEGORY_PHOTOS[cleanBadge.toLowerCase()] || '';
    const moodStyle: CoverStyle = (def as any).coverStyle || (
      def.key === 'entreno' || def.key === 'chill' || def.key === 'coche' || def.key === 'romantico'
        ? 'banner'
        : def.key === 'fiesta'
        ? 'collage'
        : 'badge'
    );

    const songPhotos = def.pool
      .slice(0, 8)
      .map((t) => {
        const fromCache = TRACK_COVER_CACHE.get(t.name) || TRACK_COVER_CACHE.get(trackKey(t.name, t.artist));
        if (fromCache && !isPlaceholderOrAvatar(fromCache)) return fromCache;
        const fromProfile = profile.tracks.find(
          (pt) => norm(pt.track.name) === norm(t.name) || norm(firstArtist(pt.track)) === norm(t.artist)
        )?.track?.album?.images?.[0]?.url;
        if (fromProfile && !isPlaceholderOrAvatar(fromProfile)) return fromProfile;
        const artPic = pictureOf(t.artist);
        if (artPic && !isPlaceholderOrAvatar(artPic)) return artPic;
        return '';
      })
      .filter(Boolean);

    const finalImages = [curatedPhoto, ...songPhotos, ...((def as any).sampleImages || [])]
      .filter((u) => u && !isPlaceholderOrAvatar(u))
      .slice(0, 4);

    const cover = (await makeCuratedThemedCover(cleanBadge, def.name, def.color, finalImages, 'Mix por ambiente · Spotifree', moodStyle)) ||
      makeMoodCoverSvg(def.name, def.color, 'Mix por ambiente', moodStyle, finalImages);
    out.push(mix(def.id, 'mood', def.name, def.description, items, cover, userName));
  }

  // Trending & Global Mixes ("Tendencias & Virales")
  for (const def of TRENDING_PLAYLIST_DEFINITIONS) {
    const items = def.tracks.map((t, idx) => toCuratedCategoryTrack(t, def.key, idx));
    const cleanBadge = def.name.replace(/^Top\s+/i, '').replace(/^Mix\s+/i, '').split(':')[0].trim();
    const curatedPhoto = CURATED_CATEGORY_PHOTOS[def.key] || CURATED_CATEGORY_PHOTOS[cleanBadge.toLowerCase()] || '';
    const trendStyle: CoverStyle = (def as any).coverStyle || (
      def.key === 'trend_spain' || def.key === 'trend_global'
        ? 'banner'
        : 'collage'
    );

    const songPhotos = def.pool
      .slice(0, 8)
      .map((t) => {
        const fromCache = TRACK_COVER_CACHE.get(t.name) || TRACK_COVER_CACHE.get(trackKey(t.name, t.artist));
        if (fromCache && !isPlaceholderOrAvatar(fromCache)) return fromCache;
        const fromProfile = profile.tracks.find(
          (pt) => norm(pt.track.name) === norm(t.name) || norm(firstArtist(pt.track)) === norm(t.artist)
        )?.track?.album?.images?.[0]?.url;
        if (fromProfile && !isPlaceholderOrAvatar(fromProfile)) return fromProfile;
        const artPic = pictureOf(t.artist);
        if (artPic && !isPlaceholderOrAvatar(artPic)) return artPic;
        return '';
      })
      .filter(Boolean);

    const finalImages = [curatedPhoto, ...songPhotos, ...((def as any).sampleImages || [])]
      .filter((u) => u && !isPlaceholderOrAvatar(u))
      .slice(0, 4);

    const cover = (await makeCuratedThemedCover(cleanBadge, def.name, def.color, finalImages, 'Tendencias · Spotifree', trendStyle)) ||
      makeMoodCoverSvg(def.name, def.color, 'Tendencias', trendStyle, finalImages);
    out.push(mix(def.id, 'trending', def.name, def.description, items, cover, userName));
  }

  // "Artistas que te pueden gustar": similar to several of the user's artists, not heard yet
  const relCount = new Map<string, { name: string; picture: string | null; n: number; fans: number }>();
  for (const s of seeds) {
    for (const r of disc.get(norm(s.name))?.related || []) {
      const k = norm(r.name);
      if (!k || profile.knownArtists.has(k)) continue;
      const cur = relCount.get(k) || { name: r.name, picture: r.picture, n: 0, fans: (r as any).fans || 0 };
      cur.n += 1;
      relCount.set(k, cur);
    }
  }
  const artists = [...relCount.values()]
    .filter((a) => a.picture)
    .sort((a, b) => b.n - a.n || b.fans - a.fans)
    .slice(0, 14)
    .map(({ name, picture }) => ({ name, picture }));
  return { mixes: out, artists };
}

// ---------------------------------------------------------------------------
// 6. Store, Home shelves and refresh
// ---------------------------------------------------------------------------
interface MixesState {
  mixes: SpotifreeMix[];
  builtDay: string | null;
  building: boolean;
  /** "Artistas que te pueden gustar": similar artists the user doesn't listen to yet */
  suggestedArtists: SuggestedArtist[];
}
export interface SuggestedArtist {
  name: string;
  picture: string | null;
}
export const useSpotifreeMixes = create<MixesState>(() => ({ mixes: [], builtDay: null, building: false, suggestedArtists: [] }));

function publish(mixes: SpotifreeMix[], builtDay: string | null, suggestedArtists: SuggestedArtist[] = []) {
  useSpotifreeMixes.setState({ mixes, builtDay, suggestedArtists });
  // So the playlist pages open them like any other playlist
  // Mixes that older builds put in the library just by opening them leave it (unless really saved)
  let saved: string[] = [];
  try {
    saved = JSON.parse(localStorage.getItem('spotifree_saved_library_playlists') || '[]');
  } catch {}
  useSpotifyDataStore.setState((s) => ({
    playlistDetailsCache: { ...s.playlistDetailsCache, ...Object.fromEntries(mixes.map((m) => [m.id, m])) },
    playlists: s.playlists.some((p) => p.id.startsWith('sf-') && !saved.includes(p.id))
      ? s.playlists.filter((p) => !p.id.startsWith('sf-') || saved.includes(p.id))
      : s.playlists,
    dynamicShelves: withSpotifreeShelves(s.dynamicShelves || [], mixes, s.user?.display_name, suggestedArtists),
  }));
}

// mixes_v6 upgraded to v7, v8, now mixes_v9: guaranteed 100% verified portraits, unique dedicated photography, zero silhouettes
const storeKey = () => `mixes_v9:${uid()}`;
let building: Promise<void> | null = null;

/** Rebuilds the account's playlists (once a day, or when asked) */
export function refreshSpotifreeMixes(force = false): Promise<void> {
  if (building) return building;
  building = (async () => {
    try {
      // Clean up previous cache versions with stale silhouettes or duplicate portraits
      try {
        await Promise.all([
          kvDel(`mixes_v8:${uid()}`),
          kvDel(`mixes_v7:${uid()}`),
          kvDel(`mixes_v6:${uid()}`),
          kvDel(`mixes2:${uid()}`),
        ]);
      } catch {}

      const saved = await kvGet<{ day: string; week: string; mixes: SpotifreeMix[]; artists?: SuggestedArtist[] }>(storeKey());
      if (saved?.mixes?.length) publish(saved.mixes, saved.day, saved.artists || []);
      // Like Spotify they stay the same during the day, unless there was a lot of new listening
      // (mixes saved by an older version, without suggested artists, are rebuilt once)
      if (!force && saved?.day === today() && saved.artists && newSignals < 40) return;
      useSpotifreeMixes.setState({ building: true });
      const { mixes, artists } = await buildMixes();
      if (mixes.length) {
        publish(mixes, today(), artists);
        await kvSet(storeKey(), { day: today(), week: isoWeek(), mixes, artists });
        newSignals = 0;
      }
    } catch (e) {
      console.warn('[SpotifreeMixes] build failed', e);
    } finally {
      useSpotifreeMixes.setState({ building: false });
      building = null;
    }
  })();
  return building;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleRefresh(ms: number) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshSpotifreeMixes();
  }, ms);
}

// ---------------------------------------------------------------------------
// Taste in the cloud: the same account learns on every device (Spotifree account / Firestore)
// ---------------------------------------------------------------------------
const CLOUD_MAX = 1500;
const sigKey = (s: Signal) => `${s.k}|${s.t}|${s.a}|${s.ts}`;

/** Signals saved in the account (other devices) joined with this device's */
function mergeCloudTaste() {
  try {
    const acc: any = getSavedSpotifreeAccount();
    // In the cloud it lives in stats.taste (the database only accepts known fields)
    const taste = acc?.stats?.taste || acc?.taste;
    const cloud: Signal[] = taste?.signals || [];
    if (!cloud.length) return;
    const local = readSignals();
    const have = new Set(local.map(sigKey));
    const add = cloud.filter((s) => s && s.a && !have.has(sigKey(s)));
    if (add.length) {
      writeSignals([...local, ...add].sort((a, b) => a.ts - b.ts));
      newSignals += add.length;
    }
    const since = Number(taste.since) || 0;
    if (since && since < firstSeen()) localStorage.setItem(firstSeenKey(), String(since));
  } catch {}
}

let cloudTimer: ReturnType<typeof setTimeout> | null = null;
let unsyncedSignals = 0;
/** Saves the latest signals to the account (a few at a time, not on every play) */
function queueCloudPush() {
  unsyncedSignals += 1;
  if (cloudTimer || unsyncedSignals < 5) return;
  cloudTimer = setTimeout(() => {
    cloudTimer = null;
    if (!getSavedSpotifreeAccount()) return;
    unsyncedSignals = 0;
    syncSpotifreeAccount({ taste: { signals: readSignals().slice(-CLOUD_MAX), since: firstSeen() } } as any).catch(() => {});
  }, 20000);
}

let started = false;
/** Starts listening to the account's activity and builds / loads its playlists */
export function initSpotifreeMixes() {
  if (started || typeof window === 'undefined') return;
  started = true;
  // For checking from the console: window.__spotifreeMixes.refresh(true)
  (window as any).__spotifreeMixes = { refresh: refreshSpotifreeMixes, store: useSpotifreeMixes, profile: buildTasteProfile };
  installSignalHooks();
  mergeCloudTaste();
  firstSeen();
  // Restore immediately from cache on startup, then refresh in background
  void refreshSpotifreeMixes();
  setTimeout(() => void refreshSpotifreeMixes(), 4000);
  // Another account signs in: its own playlists (and its taste from the cloud)
  let lastUser = uid();
  let lastDataSize = 0;
  useSpotifyDataStore.subscribe((s) => {
    const u = s.user?.id || 'local';
    if (u !== lastUser) {
      lastUser = u;
      useSpotifreeMixes.setState({ mixes: [], builtDay: null, suggestedArtists: [] });
      mergeCloudTaste();
      firstSeen();
      scheduleRefresh(3000);
      return;
    }
    // The account's music arrived (it can come after the first try): build right away instead of
    // waiting for the next periodic check
    const size = (s.topArtists?.length || 0) + (s.topTracks?.length || 0) + (s.playlists?.length || 0);
    if (size > 0 && lastDataSize === 0 && !useSpotifreeMixes.getState().mixes.length) scheduleRefresh(2500);
    lastDataSize = size;
  });
  // New day while the app stays open
  setInterval(() => {
    if (useSpotifreeMixes.getState().builtDay !== today()) void refreshSpotifreeMixes();
  }, 30 * 60 * 1000);
}

const cardOf = (m: SpotifreeMix) => ({ id: m.id, title: m.name, subtitle: m.description, image: m.images?.[0]?.url || '' });

/**
 * No playlist twice on Home: the first section that shows it keeps it, later sections drop it
 * (a section left empty disappears; one left with 1-2 cards is shown as featured cards).
 */
export function dedupeHomeShelves(shelves: DynamicShelf[]): DynamicShelf[] {
  // Two sections with the same name are one section
  const merged: DynamicShelf[] = [];
  const byTitle = new Map<string, number>();
  for (const s of shelves) {
    const key = norm(`${s.prefix || ''} ${s.title}`);
    const at = key ? byTitle.get(key) : undefined;
    if (at !== undefined) merged[at] = { ...merged[at], cards: [...merged[at].cards, ...s.cards] };
    else {
      if (key) byTitle.set(key, merged.length);
      merged.push(s);
    }
  }

  // Deduplicate cards WITHIN each shelf, never allowing duplicates inside the same section
  const out: DynamicShelf[] = [];
  for (const s of merged) {
    const seenIdsInShelf = new Set<string>();
    const seenTitlesInShelf = new Set<string>();
    const cleanCards = s.cards.filter((c) => {
      const id = c.id;
      const title = norm(c.title);
      if (seenIdsInShelf.has(id) || (title && seenTitlesInShelf.has(title))) return false;
      seenIdsInShelf.add(id);
      if (title) seenTitlesInShelf.add(title);
      return true;
    });
    if (cleanCards.length > 0) {
      out.push({ ...s, cards: cleanCards });
    }
  }
  return out;
}

/**
 * Home with Spotifree's playlists:
 *  - Every Spotifree section is guaranteed to have AT LEAST 9 PLAYLISTS (MINIMO 9).
 *  - "Tus mixes principales" provides a 12-card rich horizontal row combining top eras, moods, genres & artists.
 *  - Clean deduplication within sections without cannibalizing cards between distinct shelves.
 */
export function withSpotifreeShelves(
  base: DynamicShelf[],
  mixes: SpotifreeMix[],
  userName?: string,
  suggestedArtists: SuggestedArtist[] = []
): DynamicShelf[] {
  if (!mixes.length) return dedupeHomeShelves(base);
  const made = mixes.filter((m) => m.sfKind !== 'artist' && m.sfKind !== 'soundcloud' && m.sfKind !== 'era' && m.sfKind !== 'genre' && m.sfKind !== 'mood' && m.sfKind !== 'trending').map(cardOf);
  const artists = mixes.filter((m) => m.sfKind === 'artist').map(cardOf);
  const soundcloudMixes = mixes.filter((m) => m.sfKind === 'soundcloud').map(cardOf);
  const eraMixes = mixes.filter((m) => m.sfKind === 'era').map(cardOf);
  const genreMixes = mixes.filter((m) => m.sfKind === 'genre').map(cardOf);
  const moodMixes = mixes.filter((m) => m.sfKind === 'mood').map(cardOf);
  const trendingMixes = mixes.filter((m) => m.sfKind === 'trending').map(cardOf);
  const name = (userName || '').split(' ')[0];

  // Extend Spotify's first "Hecho para / Made for" section, only that one
  const madeForIdx = base.findIndex((s) => s.type === 'made_for' || /hecho para|made for/i.test(`${s.prefix || ''} ${s.title}`));
  let shelves = base.slice();
  const ours: DynamicShelf[] = [];

  // 1. "Tus mixes principales": Guaranteed 12 cards (3 Eras, 3 Moods, 3 Genres, 3 Artists)
  const topMixPicks: any[] = [];
  for (const e of eraMixes.slice(0, 3)) topMixPicks.push(e);
  for (const m of moodMixes.slice(0, 3)) topMixPicks.push(m);
  for (const g of genreMixes.slice(0, 3)) topMixPicks.push(g);
  for (const a of artists.slice(0, 3)) topMixPicks.push(a);

  if (topMixPicks.length >= 6) {
    ours.push({
      id: 'sf-top-mixes',
      title: 'Tus mixes principales',
      prefix: 'TUS FAVORITOS',
      subtitle: 'Tus géneros, épocas y artistas combinados para ti',
      type: 'mixes',
      cards: topMixPicks,
      hasSeeAll: true,
    });
  }

  if (made.length) {
    if (madeForIdx >= 0) {
      const s = shelves[madeForIdx];
      shelves[madeForIdx] = { ...s, cards: [...made, ...s.cards], hasSeeAll: true };
    } else {
      ours.push({ id: 'sf-made-for', title: name ? `Hecho para ${name}` : 'Hecho para ti', subtitle: 'Por Spotifree, con lo que escuchas', type: 'made_for', cards: made, hasSeeAll: true });
    }
  }

  if (artists.length) {
    ours.push({ id: 'sf-artist-mixes', title: 'Tus artistas, en mix', type: 'mixes', cards: artists, hasSeeAll: true });
  }

  if (moodMixes.length) {
    ours.push({
      id: 'sf-mood-mixes',
      title: 'Estados de ánimo y Momentos',
      prefix: 'PARA CADA MOMENTO',
      subtitle: 'Playlists diseñadas según tu energía y actividad',
      type: 'mixes',
      cards: moodMixes,
      hasSeeAll: true,
    });
  }

  // Playlists por género
  if (genreMixes.length) {
    ours.push({
      id: 'sf-genre-mixes',
      title: 'Playlists por género', // title: 'Playlists genéricas'
      prefix: 'GÉNEROS Y ESTILOS', // prefix: 'GRANDES GÉNEROS'
      subtitle: 'Grandes éxitos de Rock, Pop, Urbano, Electrónica y más',
      type: 'mixes',
      cards: genreMixes,
      hasSeeAll: true,
    });
  }

  // Mixes por época ("Viaje en el tiempo" / Nostalgia de las décadas)
  if (eraMixes.length) {
    const eraCycle = Math.floor(Date.now() / (18 * 3600 * 1000));
    const showEraShelf = true;
    let rotatedCards = eraMixes;
    let shelfTitle = 'Mixes por época';
    let shelfPrefix = 'VIAJE EN EL TIEMPO';
    const triStep = eraCycle % 3;
    if (triStep === 0) {
      rotatedCards = [
        ...eraMixes.filter((c) => c.id.includes('2010') || c.id.includes('2000')),
        ...eraMixes.filter((c) => !c.id.includes('2010') && !c.id.includes('2000')),
      ];
      shelfTitle = 'Mixes de los 2000s y 2010s';
    } else if (triStep === 1) {
      rotatedCards = [
        ...eraMixes.filter((c) => c.id.includes('90') || c.id.includes('80')),
        ...eraMixes.filter((c) => !c.id.includes('90') && !c.id.includes('80')),
      ];
      shelfTitle = 'Nostalgia: Los 80s y 90s';
    } else {
      rotatedCards = [
        ...eraMixes.filter((c) => c.id.includes('70') || c.id.includes('80')),
        ...eraMixes.filter((c) => !c.id.includes('70') && !c.id.includes('80')),
      ];
      shelfTitle = 'Clásicos de los 70s y 80s';
    }
    if (showEraShelf) {
      ours.push({
        id: 'sf-era-mixes',
        title: shelfTitle,
        prefix: shelfPrefix,
        subtitle: 'Lo mejor de cada época adaptado a tu estilo',
        type: 'mixes',
        cards: rotatedCards,
        hasSeeAll: true,
      });
    }
  }

  if (trendingMixes.length) {
    ours.push({
      id: 'sf-trending-mixes',
      title: 'Tendencias & Virales del Momento',
      prefix: 'LO MÁS ESCUCHADO',
      subtitle: 'Los mayores éxitos en España y el mundo',
      type: 'mixes',
      cards: trendingMixes,
      hasSeeAll: true,
    });
  }

  if (soundcloudMixes.length) {
    ours.push({
      id: 'sf-sc-vaults',
      title: 'Remixes, Slowed e Inéditas · SoundCloud',
      subtitle: 'Basado en los artistas que más escuchas',
      type: 'mixes',
      cards: soundcloudMixes,
      hasSeeAll: true
    });
  }

  // Strict Guarantee: EVERY Spotifree shelf must have AT LEAST 9 PLAYLISTS (MINIMO 9)
  const allCardPool = mixes.map(cardOf);
  for (const shelf of ours) {
    if (shelf.cards.length < 9) {
      const existingIds = new Set(shelf.cards.map((c) => c.id));
      for (const candidate of allCardPool) {
        if (!existingIds.has(candidate.id)) {
          shelf.cards.push(candidate);
          existingIds.add(candidate.id);
          if (shelf.cards.length >= 9) break;
        }
      }
    }
  }

  shelves = [...shelves.slice(0, 1), ...ours, ...shelves.slice(1)];
  // Like Spotify, a bit further down: artists similar to yours that you don't listen to yet
  if (suggestedArtists.length >= 3) {
    const at = Math.min(shelves.length, 5);
    shelves.splice(at, 0, {
      id: 'sf-suggested-artists',
      title: 'Artistas que te pueden gustar',
      type: 'artist',
      cards: suggestedArtists.map((a) => ({
        id: `art-${norm(a.name).replace(/\s+/g, '-')}`,
        title: a.name,
        subtitle: 'Artista',
        image: a.picture || '',
      })),
      hasSeeAll: true,
    });
  }
  return dedupeHomeShelves(shelves);
}
