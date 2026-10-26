import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const unique = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../unique-svgs.json'), 'utf8'));

const needed = {
  spotify: unique['Spotify'],
  home: unique['Inicio'],
  search: unique['Buscar'],
  explore: unique['Explorar'],
  bell: unique['Novedades'],
  friends: unique['Actividad de reproducción'],
  collapseLibrary: unique['Contraer Tu biblioteca'],
  create: unique['Crear'],
  expandLibrary: unique['Ampliar Tu biblioteca'],
  searchLibrary: unique['Buscar en Tu biblioteca'],
  sortList: unique['Recientes, vista: Lista predeterminada'],
  nowPlayingView: unique['Vista Sonando'],
  addTrack: unique['Añadir a Canciones que te gustan'],
  shuffle: unique['Habilitar la reproducción aleatoria en el nuevo urbano'],
  prev: unique['Anterior'],
  play: unique['Reproducir'],
  next: unique['Siguiente'],
  repeat: unique['Activar repetir'],
  lyrics: unique['Letra'],
  queue: unique['Cola'],
  device: unique['Conectar a un dispositivo'],
  volume: unique['Volumen alto'],
  miniplayer: unique['Abrir el Minirreproductor'],
  fullscreen: unique['Abrir la pantalla completa'],
};

let output = `import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}
`;

for (const [name, icon] of Object.entries(needed)) {
  if (!icon) continue;
  const compName = name.charAt(0).toUpperCase() + name.slice(1) + 'NativeIcon';
  const paths = (icon.paths || []).filter(Boolean);
  
  output += `
export const ${compName}: React.FC<IconProps> = ({ size = ${icon.viewBox?.includes('24') ? 24 : 16}, className = 'text-[#b3b3b3]', ...props }) => (
  <svg width={size} height={size} viewBox="${icon.viewBox || '0 0 16 16'}" fill="currentColor" className={className} {...props}>
    ${paths.map(p => `<path d="${p}" />`).join('\n    ')}
  </svg>
);
`;
}

fs.writeFileSync(path.resolve(__dirname, '../src/components/icons/SpotifyNativeIcons.tsx'), output);
console.log('Generated SpotifyNativeIcons.tsx successfully!');
