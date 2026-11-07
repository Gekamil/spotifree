#!/usr/bin/env node
/**
 * Installs the switchable launcher icons into the Capacitor Android project.
 * Runs automatically from `npm run build:apk` (after `cap sync android`). Idempotent.
 *
 *  1. Copies native/android-app-icons/SpotifreeAppIconPlugin.java into the app package
 *  2. Registers the plugin in MainActivity
 *  3. Writes adaptive launcher icons (mipmap) for every variant in public/app-icons/variants
 *  4. Replaces MainActivity's LAUNCHER intent-filter with one <activity-alias> per icon
 *
 * If the android/ folder does not exist yet (no `npx cap add android`), it does nothing.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidMain = path.join(root, 'android', 'app', 'src', 'main');
if (!fs.existsSync(androidMain)) {
  console.log('[app-icons] android/ no existe todavía (ejecuta "npx cap add android"). Nada que hacer.');
  process.exit(0);
}

const PKG = 'com.spotifree.music';
const ICONS = [
  { id: 'default', src: 'public/icon-mobile-512.png', label: 'Spotifree' },
  { id: 'disco-2026', src: 'public/app-icons/variants/disco-2026/icon-maskable-512.png' },
  { id: 'anniversary-20', src: 'public/app-icons/variants/anniversary-20/icon-maskable-512.png' },
  { id: 'black-2024', src: 'public/app-icons/variants/black-2024/icon-maskable-512.png' },
  { id: 'classic-2015', src: 'public/app-icons/variants/classic-2015/icon-maskable-512.png' },
  { id: 'retro-2013', src: 'public/app-icons/variants/retro-2013/icon-maskable-512.png' },
  { id: 'original-2008', src: 'public/app-icons/variants/original-2008/icon-maskable-512.png' },
];
const suffix = (id) => id.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const resName = (id) => `ic_launcher_app_${id.replace(/-/g, '_')}`;

// 1. Plugin source
const javaDir = path.join(androidMain, 'java', ...PKG.split('.'));
fs.mkdirSync(javaDir, { recursive: true });
fs.copyFileSync(path.join(root, 'native', 'android-app-icons', 'SpotifreeAppIconPlugin.java'), path.join(javaDir, 'SpotifreeAppIconPlugin.java'));

// 2. MainActivity registration
const mainActivity = path.join(javaDir, 'MainActivity.java');
if (fs.existsSync(mainActivity)) {
  let src = fs.readFileSync(mainActivity, 'utf8');
  if (!src.includes('SpotifreeAppIconPlugin')) {
    src = `package ${PKG};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SpotifreeAppIconPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`;
    fs.writeFileSync(mainActivity, src, 'utf8');
  }
}

// 3. Adaptive icons: foreground = the maskable icon (logo already padded on its background,
//    like the real Spotify icon) inset 10% so the logo is ~60% of the visible icon
const res = path.join(androidMain, 'res');
const anydpi = path.join(res, 'mipmap-anydpi-v26');
const xxxhdpi = path.join(res, 'mipmap-xxxhdpi');
fs.mkdirSync(anydpi, { recursive: true });
fs.mkdirSync(xxxhdpi, { recursive: true });
for (const icon of ICONS) {
  const src = path.join(root, icon.src);
  if (!fs.existsSync(src)) throw new Error(`[app-icons] Falta ${icon.src}`);
  const name = resName(icon.id);
  fs.copyFileSync(src, path.join(xxxhdpi, `${name}.png`)); // legacy (API < 26)
  fs.copyFileSync(src, path.join(xxxhdpi, `${name}_fg.png`));
  fs.writeFileSync(
    path.join(anydpi, `${name}.xml`),
    `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@android:color/black" />
    <foreground>
        <inset android:drawable="@mipmap/${name}_fg" android:inset="10%" />
    </foreground>
</adaptive-icon>
`,
    'utf8'
  );
}

// 4. Manifest aliases
const manifestPath = path.join(androidMain, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
const START = '<!-- spotifree-app-icons:start -->';
const END = '<!-- spotifree-app-icons:end -->';
manifest = manifest.replace(new RegExp(`\\s*${START}[\\s\\S]*?${END}`), '');

// Remove the MAIN/LAUNCHER intent-filter from MainActivity (the aliases provide it now)
manifest = manifest.replace(
  /(<activity[^>]*android:name="\.MainActivity"[\s\S]*?)<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN"\s*\/>\s*<category android:name="android\.intent\.category\.LAUNCHER"\s*\/>\s*<\/intent-filter>/,
  '$1'
);

const aliases = ICONS.map(
  (icon) => `        <activity-alias
            android:name=".Icon${suffix(icon.id)}"
            android:enabled="${icon.id === 'default' ? 'true' : 'false'}"
            android:exported="true"
            android:icon="@mipmap/${resName(icon.id)}"
            android:roundIcon="@mipmap/${resName(icon.id)}"
            android:label="@string/app_name"
            android:targetActivity=".MainActivity">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>`
).join('\n');

manifest = manifest.replace(/<\/application>/, `        ${START}\n${aliases}\n        ${END}\n    </application>`);

// The app's own icon (Android Auto, Settings → Apps, the install screen) was still Capacitor's
// placeholder: use Spotifree's default icon
manifest = manifest
  .replace(/(<application[^>]*?android:icon=")[^"]*(")/, `$1@mipmap/${resName('default')}$2`)
  .replace(/(<application[^>]*?android:roundIcon=")[^"]*(")/, `$1@mipmap/${resName('default')}$2`);
fs.writeFileSync(manifestPath, manifest, 'utf8');
console.log(`[app-icons] ${ICONS.length} iconos instalados en el proyecto Android.`);
