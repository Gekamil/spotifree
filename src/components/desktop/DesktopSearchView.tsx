import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { PlayNativeIcon, PauseNativeIcon } from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { searchSpotify } from '../../services/spotifyApi';
import { DesktopShelfCarousel } from './DesktopShelfCarousel';

const CATEGORY_HUBS: Record<
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
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/f1/d3/c4/f1d3c41e-edfe-c6d2-1f6a-e685e71884ef/cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZEVXbxJjY5x43H57',
            title: 'Radar de Novedades',
            subtitle: 'Las novedades de los artistas que sigues.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/71/2d/61/712d617d-f4a4-5904-1b11-d4b4b45c47c5/828768588925.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Los temas más escuchados ahora en España.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/36/4b/09/364b095e-a5fb-b346-d189-efedc5d8abd7/8902633282728.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZEVXbNFJfN1Vw8d9',
            title: 'Top 50: España',
            subtitle: 'Tu actualización diaria de los temas más reproducidos.',
            image: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_es_large.jpg',
          },
          {
            id: '37i9dQZF1DWZdsS73T1ogG',
            title: 'el nuevo urbano',
            subtitle: 'Lo más nuevo de la música urbana.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Features114/v4/46/46/6a/46466a3b-bd39-5941-9d02-0bb5da7ee705/dj.vugpwnty.jpg/600x600bb.jpg',
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
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/2d/ea/99/2dea9931-3a4c-11c7-34b4-124264b98ff6/196922098765_Cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1EQncLwOalG3K7',
            title: 'Pop con Ñ',
            subtitle: 'El mejor pop en español fresco y actual.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d7/91/a1/d791a189-3b64-b93d-e8de-478641f3e048/5064009109640.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX10zKzsJ2jva',
            title: 'Viva Latino',
            subtitle: 'El corazón y la energía de la música latina.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/2d/ea/99/2dea9931-3a4c-11c7-34b4-124264b98ff6/196922098765_Cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DWXRqgorJj26U',
            title: 'Rock Classics',
            subtitle: 'Grandes leyendas y clásicos del rock.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/55/b3/ac/55b3ac56-50c9-27fd-be05-093c048ffb3a/634479952395.png/600x600bb.jpg',
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
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d7/91/a1/d791a189-3b64-b93d-e8de-478641f3e048/5064009109640.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Las canciones pop más escuchadas.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/36/4b/09/364b095e-a5fb-b346-d189-efedc5d8abd7/8902633282728.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX4JAvHpjipBk',
            title: 'Pop Internacional',
            subtitle: 'Estrenos pop del panorama global.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/71/2d/61/712d617d-f4a4-5904-1b11-d4b4b45c47c5/828768588925.jpg/600x600bb.jpg',
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
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/2d/ea/99/2dea9931-3a4c-11c7-34b4-124264b98ff6/196922098765_Cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DWZdsS73T1ogG',
            title: 'el nuevo urbano',
            subtitle: 'El sonido urbano que rompe esquemas.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Features114/v4/46/46/6a/46466a3b-bd39-5941-9d02-0bb5da7ee705/dj.vugpwnty.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Los ritmos latinos más sonados en la península.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/36/4b/09/364b095e-a5fb-b346-d189-efedc5d8abd7/8902633282728.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX2EiUAL7Wdfc',
            title: 'míticas',
            subtitle: 'Los clásicos latinos que nunca pasarán de moda.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/2d/ea/99/2dea9931-3a4c-11c7-34b4-124264b98ff6/196922098765_Cover.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-urbano': {
    shelves: [
      {
        title: 'El mejor género urbano',
        cards: [
          {
            id: '37i9dQZF1DWZdsS73T1ogG',
            title: 'el nuevo urbano',
            subtitle: 'Bizarrap, Duki, Quevedo, Mora, Saiko.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Features114/v4/46/46/6a/46466a3b-bd39-5941-9d02-0bb5da7ee705/dj.vugpwnty.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX10zKzsJ2jva',
            title: 'Viva Latino',
            subtitle: 'Reggaetón, trap y drill latino sin límites.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/2d/ea/99/2dea9931-3a4c-11c7-34b4-124264b98ff6/196922098765_Cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Toda la vanguardia que suena en la calle.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/36/4b/09/364b095e-a5fb-b346-d189-efedc5d8abd7/8902633282728.jpg/600x600bb.jpg',
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
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/55/b3/ac/55b3ac56-50c9-27fd-be05-093c048ffb3a/634479952395.png/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX3oM43CtKnRV',
            title: 'Rock Español',
            subtitle: 'Fito & Fitipaldis, Extremoduro, Héroes del Silencio.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/55/b3/ac/55b3ac56-50c9-27fd-be05-093c048ffb3a/634479952395.png/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DX1rVvRgjX59F',
            title: '90s Rock Anthems',
            subtitle: 'Nirvana, Pearl Jam, Red Hot Chili Peppers.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/55/b3/ac/55b3ac56-50c9-27fd-be05-093c048ffb3a/634479952395.png/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-indie': {
    shelves: [
      {
        title: 'Lo mejor del Indie y Alternativo',
        cards: [
          {
            id: 'cat-indie-shelf-1',
            title: 'Indie Rock',
            subtitle: 'Arctic Monkeys, The Strokes, The Killers y Franz Ferdinand.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg',
          },
          {
            id: 'cat-indie-shelf-2',
            title: 'Indie España',
            subtitle: 'Vetusta Morla, Love of Lesbian, Lori Meyers e Izal.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg',
          },
          {
            id: 'cat-indie-shelf-3',
            title: 'Chill Indie & Dream Pop',
            subtitle: 'Sonidos etéreos, guitarras envolventes y relax.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/1c/c1/e0/1cc1e064-255c-e1b8-71fa-00cc68a5918e/23UM1IM06665.rgb.jpg/600x600bb.jpg',
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
            title: 'Electronic Circus',
            subtitle: 'David Guetta, Calvin Harris, Tiësto, Alok.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/13/69/af/1369af3d-4103-ce42-65d5-57772545be7b/25CRGIM51251.rgb.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXa8NOEUWPn9W',
            title: 'Housewerk',
            subtitle: 'Deep house y grooves irresistibles para bailar.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/13/69/af/1369af3d-4103-ce42-65d5-57772545be7b/25CRGIM51251.rgb.jpg/600x600bb.jpg',
          },
          {
            id: 'cat-dance-festival',
            title: 'Mainstage Festival EDM',
            subtitle: 'La energía pura de Tomorrowland y Ultra.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/13/69/af/1369af3d-4103-ce42-65d5-57772545be7b/25CRGIM51251.rgb.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-listas': {
    shelves: [
      {
        title: 'Las listas más escuchadas',
        cards: [
          {
            id: '37i9dQZEVXbNFJfN1Vw8d9',
            title: 'Top 50: España',
            subtitle: 'Tu actualización diaria de los temas más reproducidos.',
            image: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_es_large.jpg',
          },
          {
            id: '37i9dQZEVXbMDoHDwVN2tF',
            title: 'Top 50: Global',
            subtitle: 'Las canciones más escuchadas en todo el mundo hoy.',
            image: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_global_large.jpg',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Grandes hits y números uno en Spotify España.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/36/4b/09/364b095e-a5fb-b346-d189-efedc5d8abd7/8902633282728.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-descubrir': {
    shelves: [
      {
        title: 'Descubre nuevas joyas y talentos',
        cards: [
          {
            id: '37i9dQZEVXbxJjY5x43H57',
            title: 'Radar de Novedades',
            subtitle: 'Artistas emergentes y nuevos lanzamientos seleccionados.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/18/c3/ea/18c3eaae-229c-c529-634c-d6219e161ccb/5059805957458_cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DWY1Pf31eEcxL',
            title: 'Novedades Viernes España',
            subtitle: 'Estrenos semanales y frescura musical.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/f1/d3/c4/f1d3c41e-edfe-c6d2-1f6a-e685e71884ef/cover.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-para-ti': {
    shelves: [
      {
        title: 'Hecho para ti',
        cards: [
          {
            id: '37i9dQZEVXbxJjY5x43H57',
            title: 'Radar de Novedades',
            subtitle: 'Basado en tus gustos musicales y artistas que amas.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/1c/c1/e0/1cc1e064-255c-e1b8-71fa-00cc68a5918e/23UM1IM06665.rgb.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Mix Personalizado',
            subtitle: 'Canciones favoritas y descubrimientos afines.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/36/4b/09/364b095e-a5fb-b346-d189-efedc5d8abd7/8902633282728.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-novedades': {
    shelves: [
      {
        title: 'Últimos lanzamientos',
        cards: [
          {
            id: '37i9dQZF1DWY1Pf31eEcxL',
            title: 'Novedades Viernes España',
            subtitle: 'Todo lo nuevo recién salido de los estudios.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/f1/d3/c4/f1d3c41e-edfe-c6d2-1f6a-e685e71884ef/cover.jpg/600x600bb.jpg',
          },
          {
            id: '37i9dQZEVXbxJjY5x43H57',
            title: 'Radar de Novedades',
            subtitle: 'Lo más reciente de la escena musical.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/71/2d/61/712d617d-f4a4-5904-1b11-d4b4b45c47c5/828768588925.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-eventos': {
    shelves: [
      {
        title: 'Directos y festivales',
        cards: [
          {
            id: 'cat-eventos-fest',
            title: 'Festivales de Verano',
            subtitle: 'Lo mejor que sonará en vivo en los escenarios.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/0c/73/fc/0c73fcc7-0d61-d994-af89-2909a39ea097/mzi.bfzyhzca.jpg/600x600bb.jpg',
          },
          {
            id: 'cat-eventos-conciertos',
            title: 'Conciertos de Leyenda',
            subtitle: 'Actuaciones históricas en directo.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/55/b3/ac/55b3ac56-50c9-27fd-be05-093c048ffb3a/634479952395.png/600x600bb.jpg',
          },
        ],
      },
    ],
  },
  'cat-futbol': {
    shelves: [
      {
        title: 'Música & Fútbol',
        cards: [
          {
            id: 'cat-futbol-himnos',
            title: 'Himnos de Estadio',
            subtitle: 'Las canciones que retumban en cada victoria.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d7/dd/d0/d7ddd0d9-208c-34c9-f150-e9aeada703b9/artwork.jpg/600x600bb.jpg',
          },
          {
            id: 'cat-futbol-motivacion',
            title: 'Motivación Deportiva',
            subtitle: 'Ritmo, fuerza y concentración para darlo todo.',
            image: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/13/69/af/1369af3d-4103-ce42-65d5-57772545be7b/25CRGIM51251.rgb.jpg/600x600bb.jpg',
          },
        ],
      },
    ],
  },
};

const CategoryCardItem: React.FC<{
  cat: typeof officialCategories[0];
  onClick: () => void;
}> = ({ cat, onClick }) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: cat.bgColor }}
      className="relative h-[180px] rounded-lg p-4 overflow-hidden cursor-pointer select-none shadow-md group hover:brightness-105 active:scale-98 transition-all"
    >
      <h3 className="text-2xl font-black text-white leading-tight break-words max-w-[65%] z-10 relative font-['SpotifyMixUITitle'] tracking-tight">
        {cat.title}
      </h3>
      {!imgFailed && cat.imgSrc ? (
        <img
          src={cat.imgSrc}
          alt={cat.title}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute -bottom-2 -right-4 w-[100px] h-[100px] rounded-[4px] shadow-[-2px_4px_12px_rgba(0,0,0,0.4)] transform rotate-[25deg] translate-x-2 translate-y-1 group-hover:scale-105 group-hover:rotate-[28deg] transition-transform duration-200 object-cover"
        />
      ) : (
        <div className="absolute -bottom-2 -right-4 w-[96px] h-[96px] rounded-full bg-white/10 flex items-center justify-center transform rotate-[20deg] translate-x-1 translate-y-1">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
      )}
    </div>
  );
};

const officialCategories = [
  {
    id: 'cat-musica',
    title: 'Música',
    bgColor: 'rgb(220, 20, 140)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/71/2d/61/712d617d-f4a4-5904-1b11-d4b4b45c47c5/828768588925.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-eventos',
    title: 'Eventos en directo',
    bgColor: 'rgb(115, 88, 255)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/0c/73/fc/0c73fcc7-0d61-d994-af89-2909a39ea097/mzi.bfzyhzca.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-para-ti',
    title: 'Especialmente para ti',
    bgColor: 'rgb(30, 50, 100)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/1c/c1/e0/1cc1e064-255c-e1b8-71fa-00cc68a5918e/23UM1IM06665.rgb.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-novedades',
    title: 'Novedades',
    bgColor: 'rgb(45, 70, 185)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/f1/d3/c4/f1d3c41e-edfe-c6d2-1f6a-e685e71884ef/cover.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-latina',
    title: 'Latina',
    bgColor: 'rgb(13, 115, 236)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/2d/ea/99/2dea9931-3a4c-11c7-34b4-124264b98ff6/196922098765_Cover.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-pop',
    title: 'Pop',
    bgColor: 'rgb(20, 138, 8)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/d7/91/a1/d791a189-3b64-b93d-e8de-478641f3e048/5064009109640.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-rock',
    title: 'Rock',
    bgColor: 'rgb(188, 89, 0)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/55/b3/ac/55b3ac56-50c9-27fd-be05-093c048ffb3a/634479952395.png/600x600bb.jpg',
  },
  {
    id: 'cat-futbol',
    title: 'Fútbol',
    bgColor: 'rgb(13, 115, 236)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d7/dd/d0/d7ddd0d9-208c-34c9-f150-e9aeada703b9/artwork.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-listas',
    title: 'Listas de éxitos',
    bgColor: 'rgb(141, 103, 171)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music118/v4/36/4b/09/364b095e-a5fb-b346-d189-efedc5d8abd7/8902633282728.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-urbano',
    title: 'Urbano latino',
    bgColor: 'rgb(188, 89, 0)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Features114/v4/46/46/6a/46466a3b-bd39-5941-9d02-0bb5da7ee705/dj.vugpwnty.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-indie',
    title: 'Indie',
    bgColor: 'rgb(96, 129, 8)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg',
  },
  {
    id: 'cat-dance',
    title: 'Dance / Electrónica',
    bgColor: 'rgb(220, 20, 140)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/13/69/af/1369af3d-4103-ce42-65d5-57772545be7b/25CRGIM51251.rgb.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-descubrir',
    title: 'Descubrir',
    bgColor: 'rgb(141, 103, 171)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/18/c3/ea/18c3eaae-229c-c529-634c-d6219e161ccb/5059805957458_cover.jpg/600x600bb.jpg',
  },
];

interface FullSearchResults {
  tracks: any[];
  artists: any[];
  albums: any[];
  playlists: any[];
}

const ArtistSearchCard: React.FC<{
  artist: any;
  onClick: () => void;
}> = ({ artist, onClick }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const avatarUrl = artist.images?.[0]?.url;

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col items-center text-center shadow-md hover:shadow-xl relative"
    >
      <div className="w-28 h-28 rounded-full overflow-hidden mb-3 relative shadow-lg bg-[#242424] flex items-center justify-center">
        {!imgFailed && avatarUrl ? (
          <img
            src={avatarUrl}
            alt={artist.name}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#5018f0] to-[#1ed760] flex items-center justify-center text-black font-black text-2xl shadow">
            {(artist.name || 'A').charAt(0).toUpperCase()}
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
          title={`Ver ${artist.name}`}
        >
          <PlayNativeIcon size={16} className="text-black ml-0.5" />
        </button>
      </div>
      <span className="font-bold text-white text-sm truncate w-full">
        {artist.name}
      </span>
      <span className="text-xs text-[#b3b3b3] mt-1">Artista</span>
    </div>
  );
};

const AlbumSearchCard: React.FC<{
  album: any;
  onClick: () => void;
}> = ({ album, onClick }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const cover = album.images?.[0]?.url;

  return (
    <div
      onClick={onClick}
      className="p-3.5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col shadow-md hover:shadow-xl relative"
    >
      <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 bg-[#242424] shadow-md flex items-center justify-center">
        {!imgFailed && cover ? (
          <img
            src={cover}
            alt={album.name}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#535353]">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
          title={`Reproducir ${album.name}`}
        >
          <PlayNativeIcon size={16} className="text-black ml-0.5" />
        </button>
      </div>
      <span className="font-bold text-white text-sm truncate">
        {album.name}
      </span>
      <span className="text-xs text-[#b3b3b3] truncate mt-1">
        {album.release_date || 'Álbum'} • {album.artists?.[0]?.name || 'Artista'}
      </span>
    </div>
  );
};

interface DesktopSearchViewProps {
  onSelectPlaylistById?: (id: string, customName?: string, customImage?: string) => void;
}

export const DesktopSearchView: React.FC<DesktopSearchViewProps> = ({ onSelectPlaylistById }) => {
  const { searchQuery } = useUIStore();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayerStore();
  const [selectedCategory, setSelectedCategory] = useState<typeof officialCategories[0] | null>(null);
  const [categoryAlbums, setCategoryAlbums] = useState<Array<{ id: string; title: string; subtitle: string; image: string }>>([]);
  const [searchFilter, setSearchFilter] = useState<'todo' | 'canciones' | 'artistas' | 'albumes' | 'playlists'>('todo');
  const [searchResults, setSearchResults] = useState<FullSearchResults>({
    tracks: [],
    artists: [],
    albums: [],
    playlists: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (searchQuery.trim() && selectedCategory) {
      setSelectedCategory(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!selectedCategory) {
      setCategoryAlbums([]);
      return;
    }

    let active = true;
    const q = selectedCategory.title;
    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=album&limit=12`)
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((data) => {
        if (active && data.results && data.results.length > 0) {
          const mapped = data.results.map((a: any, idx: number) => ({
            id: `alb-${a.collectionId || idx}`,
            title: a.collectionName || 'Álbum',
            subtitle: a.artistName || 'Álbum',
            image: (a.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
          }));
          setCategoryAlbums(mapped);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [selectedCategory]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ tracks: [], artists: [], albums: [], playlists: [] });
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const data = await searchSpotify(searchQuery);
        if (active) {
          setSearchResults({
            tracks: data?.tracks?.items || [],
            artists: data?.artists?.items || [],
            albums: data?.albums?.items || [],
            playlists: data?.playlists?.items || [],
          });
          setHasSearched(true);
        }
      } catch {
        if (active) {
          setSearchResults({ tracks: [], artists: [], albums: [], playlists: [] });
          setHasSearched(true);
        }
      } finally {
        if (active) setIsSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleTrackClick = (track: any) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, searchResults.tracks);
    }
  };

  return (
    <div className="p-6 pb-16 space-y-6 select-none bg-[#121212] min-h-full">
      {!searchQuery.trim() ? (
        selectedCategory ? (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Category Hero Banner Matching Spotify Screenshot 2 */}
            <div
              style={{ backgroundColor: selectedCategory.bgColor }}
              className="relative rounded-2xl p-8 lg:p-12 overflow-hidden shadow-2xl transition-all"
            >
              <button
                onClick={() => setSelectedCategory(null)}
                className="inline-flex items-center gap-2 text-white/90 hover:text-white font-bold text-xs uppercase tracking-wider bg-black/30 hover:bg-black/50 px-3.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer mb-4"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.81 7.75l6.22 6.22a.75.75 0 1 1-1.06 1.06l-6.75-6.75a.75.75 0 0 1 0-1.06l6.75-6.75a.75.75 0 0 1 1.06 0z" />
                </svg>
                <span>Explorar todo</span>
              </button>

              <h1 className="text-5xl lg:text-7xl font-black text-white tracking-tight font-['SpotifyMixUITitle'] drop-shadow-md">
                {selectedCategory.title}
              </h1>

              {selectedCategory.imgSrc && (
                <img
                  src={selectedCategory.imgSrc}
                  alt={selectedCategory.title}
                  className="absolute right-6 -bottom-6 w-44 h-44 lg:w-56 lg:h-56 rounded-xl shadow-[-6px_8px_24px_rgba(0,0,0,0.6)] transform rotate-[18deg] object-cover opacity-90 pointer-events-none"
                />
              )}
            </div>

            {/* Hub Shelves */}
            <div className="space-y-8">
              {(CATEGORY_HUBS[selectedCategory.id]?.shelves || CATEGORY_HUBS['cat-musica'].shelves).map(
                (shelf, idx) => (
                  <DesktopShelfCarousel
                    key={`${selectedCategory.id}-shelf-${idx}`}
                    title={shelf.title}
                    items={shelf.cards}
                    onCardClick={(card) => {
                      if (onSelectPlaylistById) {
                        onSelectPlaylistById(card.id, card.title, card.image);
                      }
                    }}
                    onPlayClick={(card) => {
                      if (onSelectPlaylistById) {
                        onSelectPlaylistById(card.id, card.title, card.image);
                      }
                    }}
                  />
                )
              )}

              {categoryAlbums.length > 0 && (
                <DesktopShelfCarousel
                  key={`${selectedCategory.id}-dynamic-albums`}
                  title={`Álbumes y lanzamientos populares de ${selectedCategory.title}`}
                  items={categoryAlbums}
                  onCardClick={(card) => {
                    if (onSelectPlaylistById) {
                      onSelectPlaylistById(card.id, card.title, card.image);
                    }
                  }}
                  onPlayClick={(card) => {
                    if (onSelectPlaylistById) {
                      onSelectPlaylistById(card.id, card.title, card.image);
                    }
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-black text-white tracking-tight font-['SpotifyMixUITitle']">
              Explorar todo
            </h2>

            {/* Real 4-column responsive grid with rotated 25deg cards matching Spotify exactly */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
              {officialCategories.map((cat) => (
                <CategoryCardItem
                  key={cat.id}
                  cat={cat}
                  onClick={() => setSelectedCategory(cat)}
                />
              ))}
            </div>
          </>
        )
      ) : (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white font-['SpotifyMixUITitle']">
            Resultados para «{searchQuery}»
          </h2>

          {/* Filter Pills matching Spotify Desktop Search */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(['todo', 'canciones', 'artistas', 'albumes', 'playlists'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSearchFilter(filter)}
                className={`h-8 px-4 rounded-full text-xs font-bold capitalize transition-all cursor-pointer ${
                  searchFilter === filter
                    ? 'bg-white text-black shadow'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {filter === 'todo' ? 'Todo' : filter === 'canciones' ? 'Canciones' : filter === 'artistas' ? 'Artistas' : filter === 'albumes' ? 'Álbumes' : 'Playlists'}
              </button>
            ))}
          </div>

          {searchResults.tracks.length > 0 || searchResults.artists.length > 0 ? (
            <div className="space-y-10">
              {/* TAB: TODO */}
              {searchFilter === 'todo' && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Top Result */}
                    {(() => {
                      const topArtist = searchResults.artists[0];
                      const isArtistTop =
                        topArtist &&
                        (searchQuery.toLowerCase().trim() === topArtist.name.toLowerCase().trim() ||
                          topArtist.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
                          searchQuery.toLowerCase().trim().includes(topArtist.name.toLowerCase()));

                      if (isArtistTop) {
                        return (
                          <div
                            onClick={() => {
                              if (onSelectPlaylistById) {
                                onSelectPlaylistById(topArtist.id, topArtist.name, topArtist.images?.[0]?.url);
                              }
                            }}
                            className="lg:col-span-5 bg-[#181818] hover:bg-[#282828] p-5 rounded-lg cursor-pointer transition-colors group relative flex flex-col justify-between"
                          >
                            <div>
                              <div className="w-28 h-28 rounded-full overflow-hidden mb-4 shadow-xl bg-[#242424]">
                                <img
                                  src={topArtist.images?.[0]?.url || 'https://i.scdn.co/image/ab6761610000e5eb4e015d3113dd88ee0cb71658'}
                                  alt={topArtist.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              </div>
                              <h3 className="text-3xl font-black text-white font-['SpotifyMixUITitle'] leading-tight">
                                {topArtist.name}
                              </h3>
                              <span className="inline-block px-2.5 py-1 bg-black/40 text-white font-bold text-xs rounded-full uppercase tracking-wider mt-2">
                                Artista
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectPlaylistById) {
                                  onSelectPlaylistById(topArtist.id, topArtist.name, topArtist.images?.[0]?.url);
                                }
                              }}
                              className="absolute bottom-5 right-5 w-12 h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-lg flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
                              title={`Reproducir ${topArtist.name}`}
                            >
                              <PlayNativeIcon size={20} className="text-black ml-0.5" />
                            </button>
                          </div>
                        );
                      }

                      const topTrack = searchResults.tracks[0];
                      if (!topTrack) return null;

                      return (
                        <div
                          onClick={() => handleTrackClick(topTrack)}
                          className="lg:col-span-5 bg-[#181818] hover:bg-[#282828] p-5 rounded-lg cursor-pointer transition-colors group relative flex flex-col justify-between"
                        >
                          <div>
                            <img
                              src={topTrack.album?.images[0]?.url}
                              alt={topTrack.name}
                              className="w-24 h-24 rounded-lg object-cover shadow-xl mb-4"
                            />
                            <h3 className={`text-3xl font-black leading-tight font-['SpotifyMixUITitle'] ${
                              currentTrack?.id === topTrack.id ? 'text-[#1ed760]' : 'text-white'
                            }`}>
                              {topTrack.name}
                            </h3>
                            <p className="text-sm text-[#b3b3b3] mt-1">
                              Canción • {topTrack.artists?.map((a: any) => a.name).join(', ')}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTrackClick(topTrack);
                            }}
                            className={`absolute bottom-5 right-5 w-12 h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-lg flex items-center justify-center transition-all ${
                              isPlaying && currentTrack?.id === topTrack.id
                                ? 'opacity-100 scale-100'
                                : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                            }`}
                            title={isPlaying && currentTrack?.id === topTrack.id ? "Pausar" : "Reproducir"}
                          >
                            {isPlaying && currentTrack?.id === topTrack.id ? (
                              <PauseNativeIcon size={20} className="text-black" />
                            ) : (
                              <PlayNativeIcon size={20} className="text-black ml-0.5" />
                            )}
                          </button>
                        </div>
                      );
                    })()}

                    {/* Matching Songs List */}
                    <div className="lg:col-span-7 space-y-1">
                      <h3 className="text-lg font-bold text-white mb-2 font-['SpotifyMixUITitle']">
                        Canciones
                      </h3>
                      {searchResults.tracks.slice(0, 4).map((track: any) => {
                        const isThisPlaying = isPlaying && currentTrack?.id === track.id;
                        const isThisSelected = currentTrack?.id === track.id;

                        return (
                          <div
                            key={track.id}
                            onClick={() => handleTrackClick(track)}
                            className={`group flex items-center justify-between p-2 rounded hover:bg-white/10 cursor-pointer transition-colors ${
                              isThisSelected ? 'bg-white/10' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={track.album?.images[0]?.url}
                                alt={track.name}
                                className="w-10 h-10 rounded object-cover shadow"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className={`font-medium truncate ${
                                  isThisPlaying ? 'text-[#1ed760]' : 'text-white group-hover:text-white'
                                }`}>
                                  {track.name}
                                </span>
                                <span className="text-xs text-[#b3b3b3] truncate">
                                  {track.artists?.map((a: any) => a.name).join(', ')}
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-[#b3b3b3] font-mono pr-4">
                              {formatDuration(track.duration_ms)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Artistas Row */}
                  {searchResults.artists.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4 font-['SpotifyMixUITitle']">
                        Artistas
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {searchResults.artists.slice(0, 6).map((artist: any) => (
                          <ArtistSearchCard
                            key={artist.id}
                            artist={artist}
                            onClick={() => {
                              if (onSelectPlaylistById) {
                                onSelectPlaylistById(artist.id, artist.name, artist.images?.[0]?.url);
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Álbumes Row */}
                  {searchResults.albums.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4 font-['SpotifyMixUITitle']">
                        Álbumes
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {searchResults.albums.slice(0, 6).map((album: any) => (
                          <AlbumSearchCard
                            key={album.id}
                            album={album}
                            onClick={() => {
                              if (onSelectPlaylistById) {
                                onSelectPlaylistById(album.id, album.name, album.images?.[0]?.url);
                              }
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Playlists Row */}
                  {searchResults.playlists.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4 font-['SpotifyMixUITitle']">
                        Playlists
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {searchResults.playlists.slice(0, 6).map((pl: any) => {
                          const cover = pl.images?.[0]?.url;
                          return (
                            <div
                              key={pl.id}
                              onClick={() => {
                                if (onSelectPlaylistById) {
                                  onSelectPlaylistById(pl.id, pl.name, cover);
                                }
                              }}
                              className="p-3.5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col shadow-md hover:shadow-xl relative"
                            >
                              <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 bg-[#242424] shadow-md">
                                {cover && (
                                  <img
                                    src={cover}
                                    alt={pl.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSelectPlaylistById) {
                                      onSelectPlaylistById(pl.id, pl.name, cover);
                                    }
                                  }}
                                  className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                                  title={`Reproducir ${pl.name}`}
                                >
                                  <PlayNativeIcon size={16} className="text-black ml-0.5" />
                                </button>
                              </div>
                              <span className="font-bold text-white text-sm truncate">
                                {pl.name}
                              </span>
                              <span className="text-xs text-[#b3b3b3] truncate mt-1">
                                De {pl.owner?.display_name || 'Spotify'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB: CANCIONES */}
              {searchFilter === 'canciones' && (
                <div className="space-y-1">
                  {searchResults.tracks.map((track: any) => {
                    const isThisPlaying = isPlaying && currentTrack?.id === track.id;
                    const isThisSelected = currentTrack?.id === track.id;

                    return (
                      <div
                        key={track.id}
                        onClick={() => handleTrackClick(track)}
                        className={`group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors ${
                          isThisSelected ? 'bg-white/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={track.album?.images[0]?.url}
                            alt={track.name}
                            className="w-11 h-11 rounded object-cover shadow"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className={`font-semibold text-sm truncate ${
                              isThisPlaying ? 'text-[#1ed760]' : 'text-white'
                            }`}>
                              {track.name}
                            </span>
                            <span className="text-xs text-[#b3b3b3] truncate mt-0.5">
                              {track.artists?.map((a: any) => a.name).join(', ')} • {track.album?.name}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-[#b3b3b3] font-mono pr-4">
                          {formatDuration(track.duration_ms)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB: ARTISTAS */}
              {searchFilter === 'artistas' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {searchResults.artists.map((artist: any) => (
                    <ArtistSearchCard
                      key={artist.id}
                      artist={artist}
                      onClick={() => {
                        if (onSelectPlaylistById) {
                          onSelectPlaylistById(artist.id, artist.name, artist.images?.[0]?.url);
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {/* TAB: ÁLBUMES */}
              {searchFilter === 'albumes' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {searchResults.albums.map((album: any) => (
                    <AlbumSearchCard
                      key={album.id}
                      album={album}
                      onClick={() => {
                        if (onSelectPlaylistById) {
                          onSelectPlaylistById(album.id, album.name, album.images?.[0]?.url);
                        }
                      }}
                    />
                  ))}
                </div>
              )}

              {/* TAB: PLAYLISTS */}
              {searchFilter === 'playlists' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {searchResults.playlists.map((pl: any) => {
                    const cover = pl.images?.[0]?.url;
                    return (
                      <div
                        key={pl.id}
                        onClick={() => {
                          if (onSelectPlaylistById) {
                            onSelectPlaylistById(pl.id, pl.name, cover);
                          }
                        }}
                        className="p-3.5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col shadow-md hover:shadow-xl relative"
                      >
                        <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 bg-[#242424] shadow-md">
                          {cover && (
                            <img
                              src={cover}
                              alt={pl.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectPlaylistById) {
                                onSelectPlaylistById(pl.id, pl.name, cover);
                              }
                            }}
                            className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                            title={`Reproducir ${pl.name}`}
                          >
                            <PlayNativeIcon size={16} className="text-black ml-0.5" />
                          </button>
                        </div>
                        <span className="font-bold text-white text-sm truncate">
                          {pl.name}
                        </span>
                        <span className="text-xs text-[#b3b3b3] truncate mt-1">
                          De {pl.owner?.display_name || 'Spotify'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : isSearching ? (
            <p className="text-[#b3b3b3] text-sm">Buscando en Spotify en tiempo real...</p>
          ) : hasSearched ? (
            <div className="py-12 text-center text-[#b3b3b3] space-y-2">
              <h3 className="text-xl font-bold text-white font-['SpotifyMixUITitle']">
                No se han encontrado resultados para «{searchQuery}»
              </h3>
              <p className="text-sm text-[#a7a7a7]">
                Asegúrate de que las palabras estén bien escritas o prueba a utilizar otras palabras clave.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
