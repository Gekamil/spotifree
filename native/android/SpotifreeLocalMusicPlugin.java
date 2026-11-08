package com.spotifree.music;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;

/**
 * "Archivos locales" in the APK: the music already on the phone (Android's media index, which
 * includes the Download folder). Nothing is copied: the web player reads each file from its path
 * (Capacitor.convertFileSrc on the JS side).
 *
 *  - scan({ request }): asks for "Música y audio" when request is true, then lists the songs
 *  - artwork({ albumId, id }): a small JPEG of the album cover (data URL), or null
 *
 * JS side: src/utils/nativeLocalMusic.ts (registerPlugin('SpotifreeLocalMusic')).
 */
@CapacitorPlugin(
    name = "SpotifreeLocalMusic",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_MEDIA_AUDIO }, alias = "audio"),
        @Permission(strings = { Manifest.permission.READ_EXTERNAL_STORAGE }, alias = "storage")
    }
)
public class SpotifreeLocalMusicPlugin extends Plugin {

    private String alias() {
        return Build.VERSION.SDK_INT >= 33 ? "audio" : "storage";
    }

    private boolean granted() {
        return getPermissionState(alias()) == PermissionState.GRANTED;
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", true);
        r.put("granted", granted());
        call.resolve(r);
    }

    @PluginMethod
    public void scan(PluginCall call) {
        if (granted()) {
            doScan(call);
        } else if (call.getBoolean("request", false)) {
            requestPermissionForAlias(alias(), call, "permissionDone");
        } else {
            JSObject r = new JSObject();
            r.put("granted", false);
            r.put("tracks", new JSArray());
            call.resolve(r);
        }
    }

    @PermissionCallback
    private void permissionDone(PluginCall call) {
        if (granted()) {
            doScan(call);
        } else {
            JSObject r = new JSObject();
            r.put("granted", false);
            r.put("tracks", new JSArray());
            call.resolve(r);
        }
    }

    private void doScan(final PluginCall call) {
        new Thread(() -> {
            JSArray list = new JSArray();
            ContentResolver cr = getContext().getContentResolver();
            Uri collection = Build.VERSION.SDK_INT >= 29
                ? MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
                : MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
            String[] cols = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.ALBUM_ID,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.DATA,
                MediaStore.Audio.Media.SIZE,
                MediaStore.Audio.Media.DATE_ADDED,
                MediaStore.Audio.Media.MIME_TYPE
            };
            // Songs only (no ringtones, notifications or voice notes) of 30 s or more
            String where = MediaStore.Audio.Media.IS_MUSIC + " != 0 AND " + MediaStore.Audio.Media.DURATION + " >= 30000";
            try (Cursor c = cr.query(collection, cols, where, null, MediaStore.Audio.Media.DATE_ADDED + " DESC")) {
                if (c != null) {
                    while (c.moveToNext()) {
                        String path = c.getString(6);
                        if (path == null || path.isEmpty()) continue;
                        JSObject t = new JSObject();
                        t.put("id", c.getLong(0));
                        t.put("title", c.getString(1));
                        String artist = c.getString(2);
                        t.put("artist", artist == null || "<unknown>".equals(artist) ? "" : artist);
                        t.put("album", c.getString(3));
                        t.put("albumId", c.getLong(4));
                        t.put("durationMs", c.getLong(5));
                        t.put("path", path);
                        t.put("size", c.getLong(7));
                        t.put("dateAdded", c.getLong(8));
                        t.put("mime", c.getString(9));
                        list.put(t);
                    }
                }
            } catch (Exception e) {
                JSObject r = new JSObject();
                r.put("granted", true);
                r.put("tracks", list);
                r.put("error", String.valueOf(e.getMessage()));
                call.resolve(r);
                return;
            }
            JSObject r = new JSObject();
            r.put("granted", true);
            r.put("tracks", list);
            call.resolve(r);
        }).start();
    }

    @PluginMethod
    public void artwork(final PluginCall call) {
        final long albumId = call.getLong("albumId", -1L);
        final long id = call.getLong("id", -1L);
        new Thread(() -> {
            JSObject r = new JSObject();
            Bitmap bmp = null;
            try {
                ContentResolver cr = getContext().getContentResolver();
                if (Build.VERSION.SDK_INT >= 29) {
                    try {
                        if (albumId >= 0) {
                            Uri album = ContentUris.withAppendedId(MediaStore.Audio.Albums.EXTERNAL_CONTENT_URI, albumId);
                            bmp = cr.loadThumbnail(album, new Size(240, 240), null);
                        }
                    } catch (Exception ignored) {}
                    if (bmp == null && id >= 0) {
                        try {
                            Uri song = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                            bmp = cr.loadThumbnail(song, new Size(240, 240), null);
                        } catch (Exception ignored) {}
                    }
                } else if (albumId >= 0) {
                    try (Cursor c = cr.query(MediaStore.Audio.Albums.EXTERNAL_CONTENT_URI,
                            new String[] { MediaStore.Audio.Albums.ALBUM_ART },
                            MediaStore.Audio.Albums._ID + "=?", new String[] { String.valueOf(albumId) }, null)) {
                        if (c != null && c.moveToFirst()) {
                            String art = c.getString(0);
                            if (art != null && new File(art).exists()) {
                                BitmapFactory.Options o = new BitmapFactory.Options();
                                o.inSampleSize = 2;
                                bmp = BitmapFactory.decodeFile(art, o);
                            }
                        }
                    }
                }
                if (bmp != null) {
                    Bitmap small = Bitmap.createScaledBitmap(bmp, 240, 240 * bmp.getHeight() / Math.max(1, bmp.getWidth()), true);
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    small.compress(Bitmap.CompressFormat.JPEG, 80, out);
                    r.put("dataUrl", "data:image/jpeg;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                } else {
                    r.put("dataUrl", null);
                }
            } catch (Exception e) {
                r.put("dataUrl", null);
            }
            call.resolve(r);
        }).start();
    }
}
