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

/**
 * Bridge between the web player and SpotifreeMediaService (Android Auto, notification, lock
 * screen, Bluetooth). The web layer pushes the library and what is playing; the service sends
 * back the user's commands as "command" events.
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

    /** Sends a command to the web layer. False when the app UI is not running. */
    static boolean emit(String action, JSONObject data) {
        SpotifreeMediaPlugin p = instance;
        if (p == null || p.getBridge() == null) return false;
        JSObject ev = new JSObject();
        ev.put("action", action);
        if (data != null) {
            java.util.Iterator<String> keys = data.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                ev.put(k, data.opt(k));
            }
        }
        p.notifyListeners("command", ev, true);
        return true;
    }

    static void setPending(String action, JSONObject data) {
        JSObject ev = new JSObject();
        ev.put("action", action);
        if (data != null) {
            java.util.Iterator<String> keys = data.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                ev.put(k, data.opt(k));
            }
        }
        pending = ev;
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

    @PluginMethod
    public void setLibrary(PluginCall call) {
        JSArray playlists = call.getArray("playlists", new JSArray());
        try {
            SpotifreeMediaService.saveLibrary(getContext(), new JSONArray(playlists.toString()));
        } catch (Exception ignored) {}
        if (SpotifreeMediaService.current != null) SpotifreeMediaService.current.notifyLibraryChanged();
        call.resolve();
    }

    @PluginMethod
    public void updateNowPlaying(PluginCall call) {
        SpotifreeMediaService.title = call.getString("title", "");
        SpotifreeMediaService.artist = call.getString("artist", "");
        SpotifreeMediaService.album = call.getString("album", "");
        SpotifreeMediaService.artworkUrl = call.getString("artworkUrl", "");
        SpotifreeMediaService.lyricLine = call.getString("lyricLine", "");
        SpotifreeMediaService.language = call.getString("language", "es");
        Double dur = call.getDouble("durationMs");
        Double pos = call.getDouble("positionMs");
        SpotifreeMediaService.durationMs = dur == null ? 0 : dur.longValue();
        SpotifreeMediaService.positionMs = pos == null ? 0 : pos.longValue();
        boolean playing = Boolean.TRUE.equals(call.getBoolean("isPlaying", false));
        SpotifreeMediaService.playing = playing;
        JSArray q = call.getArray("queue", null);
        if (q != null) {
            try {
                SpotifreeMediaService.queue = new JSONArray(q.toString());
                if (SpotifreeMediaService.current != null) SpotifreeMediaService.current.notifyChildrenChanged("queue");
            } catch (Exception ignored) {}
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
