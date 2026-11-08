package com.spotifree.music;

import android.app.SearchManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

/**
 * Main Android entry point for Spotifree.
 * Registers native plugins and handles:
 * 1. Media control intents from Automations / Routines (Samsung Modes & Routines, Tasker, Macrodroid)
 * 2. Voice commands from Google Assistant / Gemini / Android AI: "Pon música en Spotifree", "Reproduce Bad Bunny en Spotifree"
 * 3. Deep links and App Links: open.spotify.com, spotify: URI, spotifree://
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SpotifreeAppIconPlugin.class);
        registerPlugin(SpotifreeLoginPlugin.class);
        registerPlugin(SpotifreeMediaPlugin.class);
        registerPlugin(SpotifreeAudioFxPlugin.class);
        registerPlugin(SpotifreeSpeechPlugin.class);
        registerPlugin(SpotifreeLocalMusicPlugin.class);
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

        // 3. Voice playback commands from Google Assistant, Gemini & Android AI / Shortcuts
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
