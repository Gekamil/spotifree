/**
 * "Explorar todo" categories: the phone's Buscar screen (MobileSearchView) and the car's
 * Explorar tab (nativeMedia.ts) show the same tiles, colours and photos.
 */
export interface BrowseCategory {
  id: string;
  title: string;
  titleEn: string;
  bgColor: string;
  imgSrc: string;
  playlistId: string;
}

export const BROWSE_CATEGORIES: BrowseCategory[] = [
  {
    id: 'cat-musica',
    title: 'Música',
    titleEn: 'Music',
    bgColor: 'rgb(220, 20, 140)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/fe/4c/99/fe4c99b8-c55b-6cab-4799-520953a9e74d/artwork.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DXcBWIGoYBM5M',
  },
  {
    id: 'cat-eventos',
    title: 'Eventos en directo',
    titleEn: 'Live Events',
    bgColor: 'rgb(115, 88, 255)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
    playlistId: '37i9dQZF1DWXRqgorJj26U',
  },
  {
    id: 'cat-para-ti',
    title: 'Especialmente para ti',
    titleEn: 'Made For You',
    bgColor: 'rgb(30, 50, 100)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4a/b8/51/4ab851d0-7c24-2406-6647-d6622f99d39b/199066743287.jpg/600x600bb.jpg',
    playlistId: '37i9dQZEVXcQ9NknPpJyRU',
  },
  {
    id: 'cat-novedades',
    title: 'Novedades',
    titleEn: 'New Releases',
    bgColor: 'rgb(45, 70, 185)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b8/02/bd/b802bd1d-c601-74a9-c194-b2fea8d5ed1b/5026854930541.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DWY1Pf31eEcxL',
  },
  {
    id: 'cat-latina',
    title: 'Latina',
    titleEn: 'Latin',
    bgColor: 'rgb(13, 115, 236)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/e2/3f/b1e23f6e-29ba-c816-cd4a-2f995c19a25d/886447345481.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DX10zKzsJ2jva',
  },
  {
    id: 'cat-pop',
    title: 'Pop',
    titleEn: 'Pop',
    bgColor: 'rgb(20, 138, 8)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/33/87/c8/3387c827-adaa-681d-bd10-ce7d8e888b9c/22UMGIM21054.rgb.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1EQncLwOalG3K7',
  },
  {
    id: 'cat-rock',
    title: 'Rock',
    titleEn: 'Rock',
    bgColor: 'rgb(188, 89, 0)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
    playlistId: '37i9dQZF1DWXRqgorJj26U',
  },
  {
    id: 'cat-futbol',
    title: 'Fútbol',
    titleEn: 'Football',
    bgColor: 'rgb(13, 115, 236)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a5/7e/97/a57e978e-6c3c-7ff5-d683-9976e754faac/8445888314351.png/600x600bb.jpg',
    playlistId: '37i9dQZF1DX748dD4y06Xh',
  },
  {
    id: 'cat-listas',
    title: 'Listas de éxitos',
    titleEn: 'Charts',
    bgColor: 'rgb(141, 103, 171)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/f1/74/df/f174df13-f2f9-51ad-0801-5a0168f0a1c5/cover.jpg/600x600bb.jpg',
    playlistId: '37i9dQZEVXbNFJfN1Vw8d9',
  },
  {
    id: 'cat-urbano',
    title: 'Urbano latino',
    titleEn: 'Urbano Latino',
    bgColor: 'rgb(188, 89, 0)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/49/f1/6949f1a9-db34-b9cb-4e58-6321d007c79b/artwork.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DWZdsS73T1ogG',
  },
  {
    id: 'cat-indie',
    title: 'Indie',
    titleEn: 'Indie',
    bgColor: 'rgb(96, 129, 8)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/9c/ae/7a/9cae7a72-29ed-08aa-1b42-913776bbb6ec/886443855571.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DX2Nc3B70tvx0',
  },
  {
    id: 'cat-dance',
    title: 'Dance / Electrónica',
    titleEn: 'Dance / Electronic',
    bgColor: 'rgb(220, 20, 140)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6c/c5/c2/6cc5c243-7151-05b8-6942-b98168cefa01/21UMGIM47963.rgb.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DX4dyzvuaRJ0n',
  },
];
