#!/usr/bin/env node
/**
 * Installs Spotifree's native Android parts into the Capacitor project (android/).
 * Runs from `npm run build:apk` and the GitHub APK build, after `cap sync android` and
 * setup-android-app-icons.mjs. Idempotent.
 *
 *  - native/android/*.java      -> app package (Spotify login, media session / Android Auto)
 *  - native/android/res/**      -> app resources (notification icons, Android Auto descriptor)
 *  - MainActivity registers every plugin
 *  - AndroidManifest: media service, media button receiver, Android Auto metadata, permissions
 *  - app/build.gradle: androidx.media dependency
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appDir = path.join(root, 'android', 'app');
const androidMain = path.join(appDir, 'src', 'main');
if (!fs.existsSync(androidMain)) {
  console.log('[android-native] android/ no existe todavía (ejecuta "npx cap add android"). Nada que hacer.');
  process.exit(0);
}
const PKG = 'com.spotifree.music';
const javaDir = path.join(androidMain, 'java', ...PKG.split('.'));
fs.mkdirSync(javaDir, { recursive: true });

// 1. Java sources
const nativeDir = path.join(root, 'native', 'android');
const javaFiles = fs.readdirSync(nativeDir).filter((f) => f.endsWith('.java'));
for (const f of javaFiles) fs.copyFileSync(path.join(nativeDir, f), path.join(javaDir, f));

// 2. Resources
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
copyDir(path.join(nativeDir, 'res'), path.join(androidMain, 'res'));

// 3. MainActivity: every plugin of the app
const plugins = ['SpotifreeAppIconPlugin', 'SpotifreeLoginPlugin', 'SpotifreeMediaPlugin', 'SpotifreeAudioFxPlugin', 'SpotifreeSpeechPlugin', 'SpotifreeLocalMusicPlugin'].filter((p) =>
  fs.existsSync(path.join(javaDir, `${p}.java`))
);
fs.writeFileSync(
  path.join(javaDir, 'MainActivity.java'),
  `package ${PKG};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
${plugins.map((p) => `        registerPlugin(${p}.class);`).join('\n')}
        super.onCreate(savedInstanceState);
    }
}
`,
  'utf8'
);

// 4. Manifest
const manifestPath = path.join(androidMain, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
const PERMS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.WAKE_LOCK',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  // "Allow Spotifree to always run in the background?" (Ajustes → Reproducción en segundo plano)
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  // The DJ's microphone (asked the first time it is used)
  'android.permission.RECORD_AUDIO',
  // "Archivos locales": the music on the phone (Android 13+; asked when the user opens it)
  'android.permission.READ_MEDIA_AUDIO',
];
for (const p of PERMS) {
  if (!manifest.includes(`"${p}"`)) {
    manifest = manifest.replace(/<application/, `<uses-permission android:name="${p}" />\n    <application`);
  }
}
// Same, Android 12 and older
if (!manifest.includes('"android.permission.READ_EXTERNAL_STORAGE"')) {
  manifest = manifest.replace(
    /<application/,
    `<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />\n    <application`
  );
}
// Android 10: read the songs straight from their files (later versions allow it with the permission)
if (!manifest.includes('requestLegacyExternalStorage')) {
  manifest = manifest.replace(/<application\b/, '<application android:requestLegacyExternalStorage="true"');
}
// Android 11+: the app must declare that it uses the speech recognition service to see it
if (!manifest.includes('android.speech.RecognitionService')) {
  manifest = manifest.replace(
    /<application/,
    `<queries>\n        <intent>\n            <action android:name="android.speech.RecognitionService" />\n        </intent>\n    </queries>\n    <application`
  );
}
const START = '<!-- spotifree-media:start -->';
const END = '<!-- spotifree-media:end -->';
manifest = manifest.replace(new RegExp(`\\s*${START}[\\s\\S]*?${END}`), '');
// One media service per app icon (Android Auto shows the service's icon); only the one of the
// chosen icon is enabled (SpotifreeMediaService.useIcon). Keep in sync with ICONS in
// setup-android-app-icons.mjs and VARIANTS in SpotifreeMediaService.java.
const ICON_IDS = ['default', 'disco-2026', 'anniversary-20', 'black-2024', 'classic-2015', 'retro-2013', 'original-2008'];
const suffix = (id) => id.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const services = ICON_IDS.map(
  (id) => `        <service
            android:name=".SpotifreeMediaService$Icon${suffix(id)}"
            android:enabled="${id === 'default' ? 'true' : 'false'}"
            android:exported="true"
            android:icon="@mipmap/ic_launcher_app_${id.replace(/-/g, '_')}"
            android:foregroundServiceType="mediaPlayback">
            <intent-filter>
                <action android:name="android.media.browse.MediaBrowserService" />
                <action android:name="android.intent.action.MEDIA_BUTTON" />
            </intent-filter>
        </service>`
).join('\n');
const media = `        ${START}
${services}
        <provider
            android:name=".SpotifreeArtProvider"
            android:authorities="\${applicationId}.art"
            android:exported="true" />
        <provider
            android:name=".SpotifreeShareProvider"
            android:authorities="\${applicationId}.share"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/spotifree_share_paths" />
        </provider>
        <receiver
            android:name=".SpotifreeWidget"
            android:exported="false"
            android:label="Spotifree">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/spotifree_widget_info" />
        </receiver>
        <receiver
            android:name="androidx.media.session.MediaButtonReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MEDIA_BUTTON" />
            </intent-filter>
        </receiver>
        <meta-data
            android:name="com.google.android.gms.car.application"
            android:resource="@xml/automotive_app_desc" />
        <meta-data
            android:name="com.google.android.gms.car.notification.SmallIcon"
            android:resource="@drawable/ic_stat_spotifree" />
        ${END}`;
manifest = manifest.replace(/<\/application>/, `${media}\n    </application>`);
fs.writeFileSync(manifestPath, manifest, 'utf8');

// 5. Gradle dependency
const gradlePath = path.join(appDir, 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
if (!gradle.includes('androidx.media:media')) {
  gradle = gradle.replace(/dependencies\s*\{/, (m) => `${m}\n    implementation "androidx.media:media:1.7.0"`);
}
// Release lint is advisory here (a lint warning must not block the APK)
if (!gradle.includes('checkReleaseBuilds')) {
  gradle = gradle.replace(/android\s*\{/, (m) => `${m}\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }`);
}
fs.writeFileSync(gradlePath, gradle, 'utf8');

console.log(`[android-native] ${javaFiles.length} clases nativas, ${plugins.length} plugins registrados, servicio multimedia y Android Auto configurados.`);
