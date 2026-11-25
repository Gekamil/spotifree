import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('v084: Android Auto & Audio Playback Resilience', () => {

  it('1. Strict Zero-Emoji Rule: No emojis in code, tests or comments', () => {
    const files = [
      'native/android/res/xml/automotive_app_desc.xml',
      'scripts/setup-android-native.mjs',
      'native/android/SpotifreeMediaService.java',
      'src/services/audioEngine.ts',
      'tests/v084_android_auto_and_playback_resilience.test.mjs'
    ];
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/u;

    for (const f of files) {
      const fullPath = path.resolve(f);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(!emojiRegex.test(content), `File ${f} must contain zero emojis`);
      }
    }
  });

  it('2. Automotive App Descriptor: Clean and compliant schema', () => {
    const descPath = path.resolve('native/android/res/xml/automotive_app_desc.xml');
    assert.ok(fs.existsSync(descPath), 'automotive_app_desc.xml must exist');
    const content = fs.readFileSync(descPath, 'utf8');
    assert.ok(content.includes('<automotiveApp>'), 'Must declare automotiveApp root');
    assert.ok(content.includes('<uses name="media" />'), 'Must declare media capability');
    assert.ok(!content.includes('<uses name="notification"'), 'Must not declare invalid uses tag');
  });

  it('3. Android Auto Media Service Declaration in Manifest Setup', () => {
    const setupNative = fs.readFileSync(path.resolve('scripts/setup-android-native.mjs'), 'utf8');
    assert.ok(
      setupNative.includes('android:name=".SpotifreeMediaService"'),
      'Must declare SpotifreeMediaService'
    );
    assert.ok(
      setupNative.includes('<action android:name="android.media.browse.MediaBrowserService" />'),
      'Must declare MediaBrowserService action'
    );
    assert.ok(
      setupNative.includes('android:icon="@mipmap/ic_launcher_app_default"'),
      'Media service must declare default app launcher icon for vehicle head units'
    );
    assert.ok(
      setupNative.includes('android:roundIcon="@mipmap/ic_launcher_app_default"'),
      'Media service must declare round icon for vehicle head units'
    );
    assert.ok(
      setupNative.includes('android:resource="@xml/automotive_app_desc"'),
      'Must declare automotive app descriptor meta-data'
    );
  });

  it('4. SpotifreeMediaService: Foreground retention and session persistence', () => {
    const mediaService = fs.readFileSync(path.resolve('native/android/SpotifreeMediaService.java'), 'utf8');
    assert.ok(
      mediaService.includes('exitForeground()'),
      'SpotifreeMediaService must implement exitForeground method'
    );
    assert.ok(
      mediaService.includes('sessionOpen = true;'),
      'Must maintain sessionOpen true during active playback and refresh'
    );
    assert.ok(
      mediaService.includes('keepAlive() && title != null && !title.isEmpty()'),
      'Must protect foreground service from premature teardown during track transitions'
    );
  });

  it('5. AudioEngine: Involuntary pause protection & watchdog stall recovery', () => {
    const audioEngine = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf8');
    assert.ok(
      audioEngine.includes('if (this.isExplicitlyPaused)'),
      'AudioEngine must check isExplicitlyPaused on YouTube pause state'
    );
    assert.ok(
      audioEngine.includes('stuckDurationMs > 28000'),
      'Stuck playback watchdog must contain 28s auto-skip fallback'
    );
    assert.ok(
      audioEngine.includes('Alternate resolve exhausted or failed, advancing to next song'),
      'Alternate resolve error must advance to next track when unplayable'
    );
  });

});
