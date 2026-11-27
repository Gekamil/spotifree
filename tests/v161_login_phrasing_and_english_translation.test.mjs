import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Spotifree: Web login phrasing and English translation', () => {
  it('1. DesktopHomeView uses open login phrasing without forcing Spotify account on web', () => {
    const desktopHome = fs.readFileSync(path.join(rootDir, 'src/components/desktop/DesktopHomeView.tsx'), 'utf8');
    assert.match(desktopHome, /Inicia sesión o crea tu cuenta de Spotifree/);
    assert.match(desktopHome, /<span>Iniciar sesión o registrarse<\/span>/);
    assert.doesNotMatch(desktopHome, /<span>Conectar cuenta de Spotify<\/span>/);
  });

  it('2. DesktopTopNav uses clean Iniciar sesión in guest view', () => {
    const topNav = fs.readFileSync(path.join(rootDir, 'src/components/desktop/DesktopTopNav.tsx'), 'utf8');
    assert.match(topNav, /title="Iniciar sesión"/);
    assert.match(topNav, /<span>Iniciar sesión<\/span>/);
    assert.doesNotMatch(topNav, /title="Conectar con Spotify"/);
    assert.doesNotMatch(topNav, /<span>Conectar cuenta<\/span>/);
  });

  it('3. MobileLayout uses open login phrasing on mobile home when unauthenticated', () => {
    const mobileLayout = fs.readFileSync(path.join(rootDir, 'src/components/mobile/MobileLayout.tsx'), 'utf8');
    assert.match(mobileLayout, /Inicia sesión o crea tu cuenta de Spotifree/);
    assert.match(mobileLayout, />\s*Iniciar sesión o registrarse\s*</);
    assert.doesNotMatch(mobileLayout, /Inicia sesión con tu cuenta de Spotify/);
  });

  it('4. i18nDictionary contains translations for the updated login and account phrases', () => {
    const dict = fs.readFileSync(path.join(rootDir, 'src/utils/i18nDictionary.ts'), 'utf8');
    assert.match(dict, /'Iniciar sesión o registrarse': 'Log in or sign up'/);
    assert.match(dict, /'Inicia sesión o crea tu cuenta de Spotifree para acceder a tu biblioteca, playlists y recomendaciones personalizadas\.': 'Log in or create your Spotifree account to access your library, playlists and personalized recommendations\.'/);
  });

  it('5. i18nDictionaryExtra contains translations for profile stats, discography, shared playlist and mixes', () => {
    const extra = fs.readFileSync(path.join(rootDir, 'src/utils/i18nDictionaryExtra.ts'), 'utf8');
    assert.match(extra, /'Artistas escuchados': 'Artists listened'/);
    assert.match(extra, /'Canciones reproducidas': 'Songs played'/);
    assert.match(extra, /'Tiempo en música': 'Time listening'/);
    assert.match(extra, /'\{0\} listas públicas': '\{0\} public playlists'/);
    assert.match(extra, /'\{0\} min escuchados': '\{0\} min listened'/);
    assert.match(extra, /'\{0\} horas escuchadas': '\{0\} hours listened'/);
    assert.match(extra, /'Fans también escuchan': 'Fans Also Like'/);
    assert.match(extra, /'Remixes, Leaks y Slowed': 'Remixes, Leaks and Slowed'/);
    assert.match(extra, /'Cargando playlist compartida\.\.\.': 'Loading shared playlist\.\.\.'/);
    assert.match(extra, /'Invitación colaborativa': 'Collaborative invite'/);
    assert.match(extra, /'Playlist compartida': 'Shared playlist'/);
    assert.match(extra, /'Similares a tus gustos': 'Similar to your taste'/);
    assert.match(extra, /'Mixes de tus artistas': 'Your artist mixes'/);
  });

  it('6. domTranslator has dynamic regex patterns for numbers and units', () => {
    const translator = fs.readFileSync(path.join(rootDir, 'src/utils/domTranslator.ts'), 'utf8');
    assert.ok(translator.includes('listas públicas$/i'), 'Missing listas publicas pattern');
    assert.ok(translator.includes('min escuchados$/i'), 'Missing min escuchados pattern');
    assert.ok(translator.includes('horas escuchadas$/i'), 'Missing horas escuchadas pattern');
    assert.ok(translator.includes('participantes$/i'), 'Missing participantes pattern');
  });

  it('7. Strict Zero-Emoji Rule across all modified translation and UI files', () => {
    const files = [
      'src/components/desktop/DesktopHomeView.tsx',
      'src/components/desktop/DesktopTopNav.tsx',
      'src/components/mobile/MobileLayout.tsx',
      'src/utils/i18nDictionary.ts',
      'src/utils/i18nDictionaryExtra.ts',
      'src/utils/domTranslator.ts',
      'tests/v161_login_phrasing_and_english_translation.test.mjs',
    ];
    const emojiPattern = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;
    for (const rel of files) {
      const content = fs.readFileSync(path.resolve(rootDir, rel), 'utf8');
      assert.equal(emojiPattern.test(content), false, `Emoji found in ${rel}`);
    }
  });
});
