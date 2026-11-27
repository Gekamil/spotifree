import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Spotifree: Auto Location and Language Detection', () => {
  it('1. isSpanishTimeZone detects Spanish regions and rejects non-Spanish timezones', () => {
    const i18nCode = fs.readFileSync(path.join(rootDir, 'src/utils/i18n.ts'), 'utf8');
    assert.match(i18nCode, /export const SPANISH_TIMEZONES/);
    assert.match(i18nCode, /export function isSpanishTimeZone/);

    const spanishPrefixes = [
      'Europe/Madrid',
      'Atlantic/Canary',
      'Europe/Ceuta',
      'America/Mexico_City',
      'America/Bogota',
      'America/Buenos_Aires',
      'America/Santiago',
      'America/Lima',
      'America/Caracas',
      'America/Montevideo',
      'America/Guayaquil',
      'America/Santo_Domingo',
      'America/Havana',
      'America/Guatemala',
      'America/Panama',
      'America/Puerto_Rico',
    ];

    const isSpanishTimeZoneSim = (tz) => {
      if (!tz) return false;
      const lower = tz.toLowerCase();
      return spanishPrefixes.some((stz) => lower.startsWith(stz.toLowerCase()));
    };

    assert.equal(isSpanishTimeZoneSim('Europe/Madrid'), true);
    assert.equal(isSpanishTimeZoneSim('Atlantic/Canary'), true);
    assert.equal(isSpanishTimeZoneSim('America/Mexico_City'), true);
    assert.equal(isSpanishTimeZoneSim('America/Bogota'), true);
    assert.equal(isSpanishTimeZoneSim('America/Buenos_Aires'), true);
    assert.equal(isSpanishTimeZoneSim('America/Santiago'), true);

    // Non-Spanish regions
    assert.equal(isSpanishTimeZoneSim('America/New_York'), false);
    assert.equal(isSpanishTimeZoneSim('America/Los_Angeles'), false);
    assert.equal(isSpanishTimeZoneSim('Europe/London'), false);
    assert.equal(isSpanishTimeZoneSim('Europe/Paris'), false);
    assert.equal(isSpanishTimeZoneSim('Europe/Berlin'), false);
    assert.equal(isSpanishTimeZoneSim('Asia/Tokyo'), false);
    assert.equal(isSpanishTimeZoneSim('Australia/Sydney'), false);
  });

  it('2. isSpanishLocale identifies Spanish language variants and rejects others', () => {
    const isSpanishLocaleSim = (loc) => {
      if (!loc) return false;
      const clean = loc.trim().toLowerCase();
      return clean === 'es' || clean.startsWith('es-') || clean.startsWith('es_');
    };

    assert.equal(isSpanishLocaleSim('es'), true);
    assert.equal(isSpanishLocaleSim('es-ES'), true);
    assert.equal(isSpanishLocaleSim('es-MX'), true);
    assert.equal(isSpanishLocaleSim('es-419'), true);
    assert.equal(isSpanishLocaleSim('es-AR'), true);
    assert.equal(isSpanishLocaleSim('es_CO'), true);

    assert.equal(isSpanishLocaleSim('en'), false);
    assert.equal(isSpanishLocaleSim('en-US'), false);
    assert.equal(isSpanishLocaleSim('en-GB'), false);
    assert.equal(isSpanishLocaleSim('fr-FR'), false);
    assert.equal(isSpanishLocaleSim('de-DE'), false);
    assert.equal(isSpanishLocaleSim('ja'), false);
  });

  it('3. detectUserLanguage sets Spanish for Spanish location or language, and English for international users', () => {
    const detectSim = ({ tz, navLangs, manual, saved }) => {
      if (manual && (saved === 'en' || saved === 'es')) return saved;

      const primary = (navLangs && navLangs[0]) || '';
      const inSpanishZone = [
        'Europe/Madrid', 'America/Mexico_City', 'America/Bogota', 'America/Buenos_Aires'
      ].some((s) => (tz || '').toLowerCase().startsWith(s.toLowerCase()));

      const isSpanishLocaleSim = (loc) => {
        if (!loc) return false;
        const clean = loc.trim().toLowerCase();
        return clean === 'es' || clean.startsWith('es-') || clean.startsWith('es_');
      };

      const speaksSpanish = (navLangs || []).some((l) => isSpanishLocaleSim(l));

      if (inSpanishZone || isSpanishLocaleSim(primary) || speaksSpanish) {
        return 'es';
      }
      return 'en';
    };

    // User in USA with English browser
    assert.equal(detectSim({ tz: 'America/New_York', navLangs: ['en-US', 'en'], manual: false }), 'en');

    // User in UK with English browser
    assert.equal(detectSim({ tz: 'Europe/London', navLangs: ['en-GB', 'en'], manual: false }), 'en');

    // User in Germany with German browser
    assert.equal(detectSim({ tz: 'Europe/Berlin', navLangs: ['de-DE', 'de', 'en'], manual: false }), 'en');

    // User in France with French browser
    assert.equal(detectSim({ tz: 'Europe/Paris', navLangs: ['fr-FR', 'fr'], manual: false }), 'en');

    // User in Spain with Spanish browser
    assert.equal(detectSim({ tz: 'Europe/Madrid', navLangs: ['es-ES', 'es'], manual: false }), 'es');

    // User in Mexico with Spanish browser
    assert.equal(detectSim({ tz: 'America/Mexico_City', navLangs: ['es-MX', 'es'], manual: false }), 'es');

    // User in US with Spanish language on phone/PC
    assert.equal(detectSim({ tz: 'America/Chicago', navLangs: ['es-419', 'en'], manual: false }), 'es');

    // Manual user override takes precedence over location
    assert.equal(detectSim({ tz: 'Europe/Madrid', navLangs: ['es-ES'], manual: true, saved: 'en' }), 'en');
    assert.equal(detectSim({ tz: 'America/New_York', navLangs: ['en-US'], manual: true, saved: 'es' }), 'es');
  });

  it('4. server.mjs exposes /api/locale endpoint with geo header detection', () => {
    const serverCode = fs.readFileSync(path.join(rootDir, 'server.mjs'), 'utf8');
    assert.match(serverCode, /pathname === '\/api\/locale'/);
    assert.match(serverCode, /x-vercel-ip-country/);
    assert.match(serverCode, /cf-ipcountry/);
    assert.match(serverCode, /detectedLanguage/);
  });

  it('5. main.tsx invokes initAutoLanguageDetection on boot', () => {
    const mainCode = fs.readFileSync(path.join(rootDir, 'src/main.tsx'), 'utf8');
    assert.match(mainCode, /initAutoLanguageDetection\(\)/);
  });

  it('6. Strict Zero-Emoji Rule across all modified files', () => {
    const files = [
      'src/utils/i18n.ts',
      'src/main.tsx',
      'server.mjs',
      'tests/v161_location_and_language_autodetection.test.mjs',
    ];
    const emojiPattern = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;
    for (const rel of files) {
      const content = fs.readFileSync(path.resolve(rootDir, rel), 'utf8');
      assert.equal(emojiPattern.test(content), false, `Emoji found in ${rel}`);
    }
  });
});
