/**
 * Curated playlists for each "Explorar todo" category (Buscar). dailyCategoryHub.ts reshuffles
 * them every day and adds live search results that change by date.
 */
export interface HubCard { id: string; title: string; subtitle: string; image: string }
export interface HubShelf { title: string; cards: HubCard[] }

export const CATEGORY_HUBS: Record<
  string,
  {
    shelves: Array<{
      title: string;
      cards: Array<{ id: string; title: string; subtitle: string; image: string }>;
    }>;
  }
> = {
  'cat-musica': {
    shelves: [
      {
        title: 'Descubrir música nueva',
        cards: [
          {
            id: '37i9dQZF1DWY1Pf31eEcxL',
            title: 'Novedades Viernes España',
            subtitle: 'Lo más nuevo de Quevedo, Saiko, Myke Towers y más.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b8/02/bd/b802bd1d-c601-74a9-c194-b2fea8d5ed1b/5026854930541.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZEVXcQ9NknPpJyRU',
            title: 'Descubrimiento semanal',
            subtitle: 'Joyas ocultas y canciones seleccionadas para ti.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4a/b8/51/4ab851d0-7c24-2406-6647-d6622f99d39b/199066743287.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZEVXbxJjY5x43H57',
            title: 'Radar de Novedades',
            subtitle: 'Las novedades de los artistas que sigues.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/42/dd/bb/42ddbb2d-ff39-cf04-7667-2872e77a6ca7/197338933862.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Los temas más escuchados ahora en España.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/f1/74/df/f174df13-f2f9-51ad-0801-5a0168f0a1c5/cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZEVXbNFJfN1Vw8d9',
            title: 'Top 50: España',
            subtitle: 'Tu actualización diaria de los temas más reproducidos.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d1/f9/69/d1f96944-7177-481f-8da9-12283cee8db1/196006235529.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DWZdsS73T1ogG',
            title: 'el nuevo urbano',
            subtitle: 'Lo más nuevo de la música urbana.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/49/f1/6949f1a9-db34-b9cb-4e58-6321d007c79b/artwork.jpg/600x600bb.jpg',
          },
        ],
      },
      {
        title: 'Listas populares y éxitos',
        cards: [
          {
            id: '37i9dQZF1DX2EiUAL7Wdfc',
            title: 'míticas',
            subtitle: 'Canciones que nunca pasarán de moda.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/53/f3/fc/53f3fccd-2024-789e-8858-c9562cc1edfa/886449216321.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1EQncLwOalG3K7',
            title: 'Pop con Ñ',
            subtitle: 'El mejor pop en español fresco y actual.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/33/87/c8/3387c827-adaa-681d-bd10-ce7d8e888b9c/22UMGIM21054.rgb.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX10zKzsJ2jva',
            title: 'Viva Latino',
            subtitle: 'El corazón y la energía de la música latina.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/e2/3f/b1e23f6e-29ba-c816-cd4a-2f995c19a25d/886447345481.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DWXRqgorJj26U',
            title: 'Rock Classics',
            subtitle: 'Grandes leyendas y clásicos del rock.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-pop': {
    shelves: [
      {
        title: 'Lo mejor del Pop',
        cards: [
          {
            id: '37i9dQZF1EQncLwOalG3K7',
            title: 'Pop con Ñ',
            subtitle: 'Pop actual en español.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/33/87/c8/3387c827-adaa-681d-bd10-ce7d8e888b9c/22UMGIM21054.rgb.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Las canciones pop más escuchadas.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/f1/74/df/f174df13-f2f9-51ad-0801-5a0168f0a1c5/cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX4JAvHpjipBk',
            title: 'Pop Hits Global',
            subtitle: 'Dua Lipa, Taylor Swift, Olivia Rodrigo.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/e9/c5/a8/e9c5a8a0-d698-137b-2e85-cf3a8d9548f8/190295303372.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DWY1Pf31eEcxL',
            title: 'Novedades Pop',
            subtitle: 'Estrenos y tendencias del pop internacional.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b8/02/bd/b802bd1d-c601-74a9-c194-b2fea8d5ed1b/5026854930541.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-latina': {
    shelves: [
      {
        title: 'Éxitos de la música latina',
        cards: [
          {
            id: '37i9dQZF1DX10zKzsJ2jva',
            title: 'Viva Latino',
            subtitle: 'Hoy suena lo mejor de Bad Bunny, Feid, Karol G y Rauw Alejandro.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/e2/3f/b1e23f6e-29ba-c816-cd4a-2f995c19a25d/886447345481.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DWZdsS73T1ogG',
            title: 'el nuevo urbano',
            subtitle: 'El sonido urbano que rompe esquemas.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/49/f1/6949f1a9-db34-b9cb-4e58-6321d007c79b/artwork.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Los ritmos latinos más sonados en la península.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/42/dd/bb/42ddbb2d-ff39-cf04-7667-2872e77a6ca7/197338933862.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX2EiUAL7Wdfc',
            title: 'míticas',
            subtitle: 'Los clásicos latinos que nunca pasarán de moda.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/82/eb/ac/82ebacd8-1b60-0fcd-92dc-6a1195125e8a/23a629dc-ae85-4d68-a2c3-704712e4596c.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-rock': {
    shelves: [
      {
        title: 'Leyendas y Clásicos del Rock',
        cards: [
          {
            id: '37i9dQZF1DWXRqgorJj26U',
            title: 'Rock Classics',
            subtitle: 'Queen, AC/DC, Led Zeppelin, Guns N Roses y más.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b0/ca/05/b0ca05aa-29c9-4e01-5a16-f6fa06bce05c/602527594347.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX3oM43CtKnRV',
            title: 'Rock Español',
            subtitle: 'Fito & Fitipaldis, Extremoduro, Héroes del Silencio.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/fe/4c/99/fe4c99b8-c55b-6cab-4799-520953a9e74d/artwork.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX1rVvRgjX59F',
            title: 'AC/DC & Hard Rock',
            subtitle: 'Riffs inmortales y energía pura.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1e/14/58/1e145814-281a-58e0-3ab1-145f5d1af421/886443673441.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX35Nm1Qj1v4b',
            title: 'Coldplay & Alt Rock',
            subtitle: 'Himnos de estadio y rock melódico.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/f5/93/8c/f5938c49-964c-31d1-4b33-78b634f71fb7/190295978075.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-dance': {
    shelves: [
      {
        title: 'Dance y Electrónica',
        cards: [
          {
            id: '37i9dQZF1DX4dyzvuaRJ0n',
            title: 'electronic circus',
            subtitle: 'Avicii, David Guetta, Calvin Harris y Tiësto.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/38/40/36/38403610-19a8-c161-4bcf-6860aa27fa37/00602537778492.rgb.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXa8NOEUWPn9W',
            title: 'Housewerk',
            subtitle: 'Deep house y grooves irresistibles para bailar.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6c/c5/c2/6cc5c243-7151-05b8-6942-b98168cefa01/21UMGIM47963.rgb.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX0BcQWzuB7ZO',
            title: 'Club Bangers',
            subtitle: 'Beats potentes y drops de festival.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/68/7f/d5/687fd582-2387-5044-a881-0bc4f0697338/825646194315.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX8tZsk68tuED',
            title: 'Tiësto Sessions',
            subtitle: 'La mejor selección electrónica actual.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/cf/81/b8/cf81b800-bc37-cb1e-008e-a1211ce21d19/075679803429.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-indie': {
    shelves: [
      {
        title: 'Lo mejor del Indie',
        cards: [
          {
            id: '37i9dQZF1DX2Nc3B70tvx0',
            title: 'Indie España',
            subtitle: 'Vetusta Morla, Love of Lesbian, Izal y Lori Meyers.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/7e/d6/4f/7ed64f00-1514-5545-5f7e-58930eb190e1/886446385365.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXdbXrPNafg9d',
            title: 'Indie Rock Legends',
            subtitle: 'Arctic Monkeys, The Strokes, Franz Ferdinand.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX7F6T2n25n8F',
            title: 'Love of Lesbian Radio',
            subtitle: 'Letras poéticas y melodías inolvidables.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/0e/97/ff/0e97ffd8-fc2b-1d00-393b-0808495a5b56/825646482818.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX7gP9a3y8z8x',
            title: 'The Strokes Vibes',
            subtitle: 'Clásicos y esenciales del indie rock moderno.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/9c/ae/7a/9cae7a72-29ed-08aa-1b42-913776bbb6ec/886443855571.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-futbol': {
    shelves: [
      {
        title: 'Himnos y Clásicos del Fútbol',
        cards: [
          {
            id: '37i9dQZF1DX748dD4y06Xh',
            title: 'Himnos del Fútbol',
            subtitle: 'La emoción de las gradas y el día del partido.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/63/57/9f/63579f9a-794d-e397-c825-3776299e00b2/cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXaW3t2z7y5aX',
            title: 'Motivación & Pre-Partido',
            subtitle: 'Canciones para motivarte y darlo todo en el campo.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/f0/91/5a/f0915a91-0d8d-4206-b9bc-9de4ff94c255/876061.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX0h0MNsuTqOQ',
            title: 'Beast Mode Cardio',
            subtitle: 'Ritmo constante para entrenamientos intensos.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a5/7e/97/a57e978e-6c3c-7ff5-d683-9976e754faac/8445888314351.png/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-listas': {
    shelves: [
      {
        title: 'Top Charts Global & España',
        cards: [
          {
            id: '37i9dQZEVXbNFJfN1Vw8d9',
            title: 'Top 50: España',
            subtitle: 'Tu actualización diaria de los temas más reproducidos en España.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d1/f9/69/d1f96944-7177-481f-8da9-12283cee8db1/196006235529.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZEVXbMDoHDwVN2tF',
            title: 'Top 50: Global',
            subtitle: 'Las canciones más escuchadas en todo el planeta.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/f1/74/df/f174df13-f2f9-51ad-0801-5a0168f0a1c5/cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Los temas que arrasan en listas oficiales.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/42/dd/bb/42ddbb2d-ff39-cf04-7667-2872e77a6ca7/197338933862.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-urbano': {
    shelves: [
      {
        title: 'Urbano Latino & Reggaeton',
        cards: [
          {
            id: '37i9dQZF1DWZdsS73T1ogG',
            title: 'el nuevo urbano',
            subtitle: 'Quevedo, Saiko, Mora, Bizarrap y Bad Bunny.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/49/f1/6949f1a9-db34-b9cb-4e58-6321d007c79b/artwork.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX10zKzsJ2jva',
            title: 'Bad Bunny & Éxitos',
            subtitle: 'Los temas más pegados del verano.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/b6/74/4d/b6744dbd-77ed-413a-3777-5ac6a2e780eb/197188732554.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX5h7gA6318s9',
            title: 'Saiko & Nueva Ola',
            subtitle: 'Sonido futurista y barras afiladas.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/36/86/e0/3686e0dc-633a-bb7c-7e02-813b57b22049/5063010827741_cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX9l9p1b0z7Y1',
            title: 'Ferxxo 100',
            subtitle: 'Los mejores perreos y barras de Feid.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/49/8d/b0/498db03e-5a0f-04fb-91c2-cd33d425f44b/22UMGIM88226.rgb.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-descubrir': {
    shelves: [
      {
        title: 'Descubrimientos & Novedades',
        cards: [
          {
            id: '37i9dQZEVXcQ9NknPpJyRU',
            title: 'Descubrimiento semanal',
            subtitle: 'Joyas ocultas y recomendaciones para ti.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4a/b8/51/4ab851d0-7c24-2406-6647-d6622f99d39b/199066743287.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZEVXbxJjY5x43H57',
            title: 'Radar de Novedades',
            subtitle: 'Lo último de tus artistas preferidos.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b8/02/bd/b802bd1d-c601-74a9-c194-b2fea8d5ed1b/5026854930541.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DWY1Pf31eEcxL',
            title: 'Novedades Viernes',
            subtitle: 'Los lanzamientos más frescos de la semana.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/42/dd/bb/42ddbb2d-ff39-cf04-7667-2872e77a6ca7/197338933862.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-para-ti': {
    shelves: [
      {
        title: 'Especialmente para ti',
        cards: [
          {
            id: '37i9dQZEVXcQ9NknPpJyRU',
            title: 'Descubrimiento semanal',
            subtitle: 'Tu mezcla personalizada semanal.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4a/b8/51/4ab851d0-7c24-2406-6647-d6622f99d39b/199066743287.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Mix Diario 1',
            subtitle: 'Tus temas más repetidos y novedades afines.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/e2/3f/b1e23f6e-29ba-c816-cd4a-2f995c19a25d/886447345481.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-eventos': {
    shelves: [
      {
        title: 'Eventos en directo',
        cards: [
          {
            id: '37i9dQZF1DWXRqgorJj26U',
            title: 'Live en Concierto',
            subtitle: 'Las mejores grabaciones en vivo de tus artistas.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX3oM43CtKnRV',
            title: 'Festivales de Verano',
            subtitle: 'Himnos que retumban en los grandes escenarios.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/af/7c/86/af7c8674-fed8-c034-1975-a663e23a3c4f/0.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
};
