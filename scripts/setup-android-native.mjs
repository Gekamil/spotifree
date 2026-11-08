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

// 3. MainActivity: every plugin of the app + voice intent & deep links handling
const plugins = ['SpotifreeAppIconPlugin', 'SpotifreeLoginPlugin', 'SpotifreeMediaPlugin', 'SpotifreeAudioFxPlugin', 'SpotifreeSpeechPlugin', 'SpotifreeLocalMusicPlugin'].filter((p) =>
  fs.existsSync(path.join(javaDir, `${p}.java`))
);
fs.writeFileSync(
  path.join(javaDir, 'MainActivity.java'),
  `package ${PKG};

import android.app.SearchManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
${plugins.map((p) => `        registerPlugin(${p}.class);`).join('\n')}
        super.onCreate(savedInstanceState);
        handleIncomingIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        // 1. Explicit media control commands from Automations / Routines (Samsung Modes & Routines, Tasker)
        String cmd = intent.getStringExtra("command");
        if (cmd == null) cmd = intent.getStringExtra("action");
        if ("play".equalsIgnoreCase(cmd) || "com.spotifree.music.ACTION_PLAY".equals(action)) {
            if (!SpotifreeMediaPlugin.emit("play", null)) SpotifreeMediaPlugin.setPending("play", null);
            return;
        } else if ("pause".equalsIgnoreCase(cmd) || "com.spotifree.music.ACTION_PAUSE".equals(action)) {
            SpotifreeMediaPlugin.emit("pause", null);
            return;
        } else if ("next".equalsIgnoreCase(cmd) || "skip".equalsIgnoreCase(cmd) || "com.spotifree.music.ACTION_NEXT".equals(action)) {
            SpotifreeMediaPlugin.emit("next", null);
            return;
        } else if ("previous".equalsIgnoreCase(cmd) || "prev".equalsIgnoreCase(cmd) || "com.spotifree.music.ACTION_PREVIOUS".equals(action)) {
            SpotifreeMediaPlugin.emit("previous", null);
            return;
        } else if ("toggle".equalsIgnoreCase(cmd) || "togglepause".equalsIgnoreCase(cmd) || "com.spotifree.music.ACTION_TOGGLE".equals(action)) {
            if (!SpotifreeMediaPlugin.emit("toggle", null)) SpotifreeMediaPlugin.setPending("toggle", null);
            return;
        }

        // 2. Hardware media button intents (Bluetooth headset, car, routine key event)
        if (Intent.ACTION_MEDIA_BUTTON.equals(action)) {
            KeyEvent event = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
            if (event != null && event.getAction() == KeyEvent.ACTION_DOWN) {
                int code = event.getKeyCode();
                if (code == KeyEvent.KEYCODE_MEDIA_PLAY) {
                    if (!SpotifreeMediaPlugin.emit("play", null)) SpotifreeMediaPlugin.setPending("play", null);
                } else if (code == KeyEvent.KEYCODE_MEDIA_PAUSE) {
                    SpotifreeMediaPlugin.emit("pause", null);
                } else if (code == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE || code == KeyEvent.KEYCODE_HEADSETHOOK) {
                    if (!SpotifreeMediaPlugin.emit("toggle", null)) SpotifreeMediaPlugin.setPending("toggle", null);
                } else if (code == KeyEvent.KEYCODE_MEDIA_NEXT) {
                    SpotifreeMediaPlugin.emit("next", null);
                } else if (code == KeyEvent.KEYCODE_MEDIA_PREVIOUS) {
                    SpotifreeMediaPlugin.emit("previous", null);
                }
            }
            return;
        }

        // 3. Voice playback: Google Assistant, Gemini & Android AI ("Pon música en Spotifree", "Reproduce Bad Bunny en Spotifree")
        if (MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH.equals(action)
                || "android.media.action.MEDIA_PLAY_FROM_SEARCH".equals(action)
                || "android.media.action.PLAY_FROM_SEARCH".equals(action)
                || "android.intent.action.MEDIA_SEARCH".equals(action)
                || intent.getBooleanExtra("play", false)
                || intent.hasExtra("spotifree_play")) {

            String query = intent.getStringExtra(SearchManager.QUERY);
            if (query == null || query.trim().isEmpty()) {
                query = intent.getStringExtra(MediaStore.EXTRA_MEDIA_TITLE);
            }
            if (query == null || query.trim().isEmpty()) {
                query = intent.getStringExtra(MediaStore.EXTRA_MEDIA_ARTIST);
            }
            if (query == null || query.trim().isEmpty()) {
                query = intent.getStringExtra(MediaStore.EXTRA_MEDIA_ALBUM);
            }
            if (query == null || query.trim().isEmpty()) {
                query = intent.getStringExtra("query");
            }
            if (query == null || query.trim().isEmpty()) {
                query = intent.getStringExtra("audio.name");
            }
            if (query == null || query.trim().isEmpty()) {
                query = intent.getStringExtra("musicRecording.name");
            }
            if (query == null || query.trim().isEmpty()) {
                query = intent.getStringExtra("artist.name");
            }
            if (query == null || query.trim().isEmpty()) {
                query = intent.getStringExtra("album.name");
            }
            if (query == null || query.trim().isEmpty()) {
                query = intent.getStringExtra("playlist.name");
            }
            if (query == null) query = "";

            JSONObject data = new JSONObject();
            try {
                data.put("query", query);
            } catch (Exception ignored) {}

            if (!SpotifreeMediaPlugin.emit("playFromSearch", data)) {
                SpotifreeMediaPlugin.setPending("playFromSearch", data);
            }
        }
        // 4. Open link: open.spotify.com, spotify: URI, or spotifree: link
        else if (Intent.ACTION_VIEW.equals(action)) {
            Uri uri = intent.getData();
            if (uri != null) {
                String uriStr = uri.toString();
                JSONObject payload = new JSONObject();
                try {
                    payload.put("url", uriStr);
                } catch (Exception ignored) {}

                if (!SpotifreeMediaPlugin.emit("openUrl", payload)) {
                    SpotifreeMediaPlugin.setPending("openUrl", payload);
                }
            }
        }
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
                <action android:name="com.spotifree.music.ACTION_PLAY" />
                <action android:name="com.spotifree.music.ACTION_PAUSE" />
                <action android:name="com.spotifree.music.ACTION_NEXT" />
                <action android:name="com.spotifree.music.ACTION_PREVIOUS" />
                <action android:name="com.spotifree.music.ACTION_TOGGLE" />
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

// Activity Intent Filters & Meta-Data for Voice Commands & Deep Links
const ACT_START = '<!-- spotifree-activity-intents:start -->';
const ACT_END = '<!-- spotifree-activity-intents:end -->';
manifest = manifest.replace(new RegExp(`\\s*${ACT_START}[\\s\\S]*?${ACT_END}`), '');

const activityIntents = `            ${ACT_START}
            <!-- 1. Voice playback via Google Assistant, Gemini & Android AI: "Pon música en Spotifree", "Reproduce Bad Bunny en Spotifree" -->
            <intent-filter>
                <action android:name="android.media.action.MEDIA_PLAY_FROM_SEARCH" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.MEDIA_SEARCH" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.media.action.PLAY_FROM_SEARCH" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>

            <!-- 2. Custom URI schemes: spotifree:// and spotify:// (spotify:track:..., spotify:playlist:...) -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="spotifree" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="spotify" />
            </intent-filter>

            <!-- 3. Web App Links: spotifreeweb.vercel.app (verified App Links) -->
            <intent-filter android:autoVerify="true">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="spotifreeweb.vercel.app" />
                <data android:scheme="http" android:host="spotifreeweb.vercel.app" />
            </intent-filter>

            <!-- 4. Open Spotify web links in Spotifree: open.spotify.com -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="open.spotify.com" />
                <data android:scheme="http" android:host="open.spotify.com" />
            </intent-filter>

            <!-- 5. Media Control Intents for Automations & Routines (Samsung Modes & Routines, Tasker) -->
            <intent-filter>
                <action android:name="com.spotifree.music.ACTION_PLAY" />
                <action android:name="com.spotifree.music.ACTION_PAUSE" />
                <action android:name="com.spotifree.music.ACTION_NEXT" />
                <action android:name="com.spotifree.music.ACTION_PREVIOUS" />
                <action android:name="com.spotifree.music.ACTION_TOGGLE" />
                <action android:name="android.intent.action.MEDIA_BUTTON" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>

            <!-- Google Assistant App Actions & In-App Searchable -->
            <meta-data
                android:name="android.app.shortcuts"
                android:resource="@xml/shortcuts" />
            <meta-data
                android:name="android.app.searchable"
                android:resource="@xml/searchable" />
            ${ACT_END}`;

manifest = manifest.replace(/(<activity\b[^>]*android:name="\.MainActivity"[^>]*>[\s\S]*?)(<\/activity>)/, `$1\n${activityIntents}\n        $2`);

if (!manifest.includes('android.app.default_searchable')) {
  manifest = manifest.replace(/<\/application>/, `        <meta-data android:name="android.app.default_searchable" android:value=".MainActivity" />\n    </application>`);
}

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
