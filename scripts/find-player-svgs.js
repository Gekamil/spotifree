import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../extracted-svgs.json'), 'utf8'));

console.log(`Total SVGs: ${svgs.length}`);

// Group by aria-label or find player SVGs
const playerKeywords = [
  'añadir', 'guardar', 'favoritos', 'play', 'pausa', 'reproducir',
  'siguiente', 'anterior', 'aleatoria', 'repetir', 'silenciar',
  'cola', 'letras', 'dispositivo', 'pantalla', 'minirreproductor'
];

const found = [];
for (const s of svgs) {
  const label = s.ariaLabel.toLowerCase();
  const matched = playerKeywords.some(k => label.includes(k));
  if (matched || s.allPaths.length > 0) {
    found.push({
      label: s.ariaLabel,
      viewBox: s.viewBox,
      paths: s.allPaths,
    });
  }
}

console.log(`Found ${found.length} interesting SVGs:`);
const uniqueLabels = {};
for (const f of found) {
  if (f.label && !uniqueLabels[f.label]) {
    uniqueLabels[f.label] = f;
  }
}

fs.writeFileSync(path.resolve(__dirname, '../unique-svgs.json'), JSON.stringify(uniqueLabels, null, 2));
console.log('Saved unique labeled SVGs:', Object.keys(uniqueLabels));
