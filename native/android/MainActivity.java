package com.spotifree.music;

import android.app.SearchManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

/**
 * Main Android entry point for Spotifree.
 * Registers native plugins and handles:
 * 1. Voice commands from Google Assistant / Gemini / Android AI: "Pon música en Spotifree", "Reproduce Bad Bunny en Spotifree"
 * 2. Deep links and App Links: open.spotify.com, spotify: URI, spotifree://
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

        // 1. Voice commands from Google Assistant, Gemini & Android AI
        if (MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH.equals(action)
                || "android.media.action.MEDIA_PLAY_FROM_SEARCH".equals(action)
                || "android.media.action.PLAY_FROM_SEARCH".equals(action)
                || "android.intent.action.MEDIA_SEARCH".equals(action)) {

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
            if (query == null) query = "";

            JSONObject data = new JSONObject();
            try {
                data.put("query", query);
            } catch (Exception ignored) {}

            if (!SpotifreeMediaPlugin.emit("playFromSearch", data)) {
                SpotifreeMediaPlugin.setPending("playFromSearch", data);
            }
        }
        // 2. Open link: open.spotify.com, spotify: URI, or spotifree: link
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
