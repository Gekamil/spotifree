package com.spotifree.music;

import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Iterator;

/**
 * Bridge between the web player and SpotifreeMediaService (Android Auto, notification, lock
 * screen, Bluetooth). The web layer pushes the library, playlists' songs, search results and
 * what is playing; the service sends back the user's commands as "command" events.
 * JS side: src/services/nativeMedia.ts (registerPlugin('SpotifreeMedia')).
 */
@CapacitorPlugin(name = "SpotifreeMedia")
public class SpotifreeMediaPlugin extends Plugin {

    private static SpotifreeMediaPlugin instance;
    private static JSObject pending;

    @Override
    public void load() {
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) instance = null;
        super.handleOnDestroy();
    }

    private static JSObject toEvent(String action, JSONObject data) {
        JSObject ev = new JSObject();
        ev.put("action", action);
        if (data != null) {
            Iterator<String> keys = data.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                ev.put(k, data.opt(k));
            }
        }
        return ev;
    }

    /** Sends a command to the web layer. False when the app UI is not running. */
    static boolean emit(String action, JSONObject data) {
        SpotifreeMediaPlugin p = instance;
        if (p == null || p.getBridge() == null) return false;
        p.notifyListeners("command", toEvent(action, data), true);
        return true;
    }

    static void setPending(String action, JSONObject data) {
        pending = toEvent(action, data);
    }

    /** A command that arrived from the car while the app was closed */
    @PluginMethod
    public void takePendingCommand(PluginCall call) {
        JSObject ret = new JSObject();
        if (pending != null) {
            ret.put("command", pending);
            pending = null;
        }
        call.resolve(ret);
    }

    private void kickService(boolean foreground) {
        Context ctx = getContext();
        Intent i = new Intent(ctx, SpotifreeMediaService.class).setAction(SpotifreeMediaService.ACTION_UPDATE);
        try {
            if (SpotifreeMediaService.current != null) {
                SpotifreeMediaService.current.refresh();
            } else if (foreground) {
                ContextCompat.startForegroundService(ctx, i);
            } else {
                ctx.startService(i);
            }
        } catch (Exception ignored) {}
    }

    private static JSONArray arr(PluginCall call, String key) {
        JSArray a = call.getArray(key, null);
        if (a == null) return null;
        try {
            return new JSONArray(a.toString());
        } catch (Exception e) {
            return null;
        }
    }

    /** playlists: [{id,name,subtitle,image}], home: [{title, items:[...]}], loggedIn */
    @PluginMethod
    public void setLibrary(PluginCall call) {
        JSONArray playlists = arr(call, "playlists");
        JSONArray home = arr(call, "home");
        JSONArray explore = arr(call, "explore");
        if (explore != null) SpotifreeMediaService.explore = explore;
        SpotifreeMediaService.loggedIn = Boolean.TRUE.equals(call.getBoolean("loggedIn", true));
        SpotifreeMediaService.saveLibrary(getContext(), playlists != null ? playlists : new JSONArray(), home);
        if (SpotifreeMediaService.current != null) SpotifreeMediaService.current.notifyLibraryChanged();
        call.resolve();
    }

    /** key, base64 (PNG): a cover made by the app, referenced as "local:<key>" */
    @PluginMethod
    public void cacheImage(PluginCall call) {
        String key = call.getString("key", "");
        String b64 = call.getString("base64", "");
        if (key == null || key.isEmpty() || b64 == null || b64.isEmpty()) {
            call.reject("missing key or data");
            return;
        }
        try {
            byte[] bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT);
            java.io.File f = SpotifreeArtProvider.localFile(getContext(), key);
            try (java.io.FileOutputStream out = new java.io.FileOutputStream(f)) {
                out.write(bytes);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("could not save image");
        }
    }

    /** id, tracks: [{id,title,artist,image}] (answer to a "loadPlaylist" command) */
    @PluginMethod
    public void setPlaylistTracks(PluginCall call) {
        String id = call.getString("id", "");
        JSONArray tracks = arr(call, "tracks");
        if (id != null && !id.isEmpty() && tracks != null) {
            if (SpotifreeMediaService.current != null) SpotifreeMediaService.current.onPlaylistTracks(id, tracks);
            else SpotifreeMediaService.playlistTracks.put(id, tracks);
        }
        call.resolve();
    }

    /** id, items: [{id,name,subtitle,image}] playlists of an Explorar category ("loadCategory") */
    @PluginMethod
    public void setCategoryItems(PluginCall call) {
        String id = call.getString("id", "");
        JSONArray items = arr(call, "items");
        if (id != null && !id.isEmpty() && items != null) {
            if (SpotifreeMediaService.current != null) SpotifreeMediaService.current.onCategoryItems(id, items);
            else SpotifreeMediaService.categoryItems.put(id, items);
        }
        call.resolve();
    }

    /** requestId, tracks: [...], playlists: [...] (answer to a "search" command) */
    @PluginMethod
    public void setSearchResults(PluginCall call) {
        String reqId = call.getString("requestId", "");
        if (SpotifreeMediaService.current != null) {
            SpotifreeMediaService.current.onSearchResults(reqId, arr(call, "tracks"), arr(call, "playlists"));
        }
        call.resolve();
    }

    @PluginMethod
    public void updateNowPlaying(PluginCall call) {
        SpotifreeMediaService.trackId = call.getString("trackId", "");
        SpotifreeMediaService.title = call.getString("title", "");
        SpotifreeMediaService.artist = call.getString("artist", "");
        SpotifreeMediaService.album = call.getString("album", "");
        SpotifreeMediaService.artworkUrl = call.getString("artworkUrl", "");
        SpotifreeMediaService.lyricLine = call.getString("lyricLine", "");
        SpotifreeMediaService.language = call.getString("language", "es");
        SpotifreeMediaService.repeat = call.getString("repeat", "off");
        SpotifreeMediaService.liked = Boolean.TRUE.equals(call.getBoolean("liked", false));
        SpotifreeMediaService.shuffle = Boolean.TRUE.equals(call.getBoolean("shuffle", false));
        SpotifreeMediaService.explicit = Boolean.TRUE.equals(call.getBoolean("explicit", false));
        Double dur = call.getDouble("durationMs");
        Double pos = call.getDouble("positionMs");
        SpotifreeMediaService.durationMs = dur == null ? 0 : dur.longValue();
        SpotifreeMediaService.positionMs = pos == null ? 0 : pos.longValue();
        boolean playing = Boolean.TRUE.equals(call.getBoolean("isPlaying", false));
        SpotifreeMediaService.playing = playing;
        JSONArray q = arr(call, "queue");
        if (q != null) {
            SpotifreeMediaService.queue = q;
            if (SpotifreeMediaService.current != null) SpotifreeMediaService.current.refreshQueue();
        }
        kickService(playing);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        SpotifreeMediaService.playing = false;
        if (SpotifreeMediaService.current != null) SpotifreeMediaService.current.refresh();
        call.resolve();
    }
}
