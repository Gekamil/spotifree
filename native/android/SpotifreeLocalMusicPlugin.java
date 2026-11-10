package com.spotifree.music;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
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
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

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

    private File offlineTracksDir() {
        File dir = new File(getContext().getFilesDir(), "spotifree_offline");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private File offlinePlaylistsDir() {
        File dir = new File(getContext().getFilesDir(), "spotifree_offline_playlists");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private static String safeFileKey(String id) {
        if (id == null) return "";
        return id.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    private boolean writePublicMusicBytes(byte[] bytes, String fileName, String mimeType) {
        if (bytes == null || bytes.length == 0 || fileName == null || fileName.isEmpty()) return false;
        String safeName = fileName.replaceAll("[/\\\\?%*:|\"<>]", "_").trim();
        if (safeName.isEmpty()) safeName = "cancion.m4a";
        String safeMime = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "audio/mp4";

        if (Build.VERSION.SDK_INT >= 29) {
            try {
                ContentResolver cr = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Audio.Media.DISPLAY_NAME, safeName);
                values.put(MediaStore.Audio.Media.MIME_TYPE, safeMime);
                values.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/Spotifree");
                values.put(MediaStore.Audio.Media.IS_MUSIC, 1);
                values.put(MediaStore.Audio.Media.IS_PENDING, 1);

                Uri itemUri = cr.insert(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
                if (itemUri != null) {
                    try (OutputStream out = cr.openOutputStream(itemUri)) {
                        if (out != null) {
                            out.write(bytes);
                            out.flush();
                        }
                    }
                    ContentValues done = new ContentValues();
                    done.put(MediaStore.Audio.Media.IS_PENDING, 0);
                    cr.update(itemUri, done, null, null);
                    return true;
                }
            } catch (Exception ignored) {}
        } else {
            try {
                File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC), "Spotifree");
                if (!dir.exists()) dir.mkdirs();
                File target = new File(dir, safeName);
                try (FileOutputStream fos = new FileOutputStream(target)) {
                    fos.write(bytes);
                    fos.flush();
                }
                return true;
            } catch (Exception ignored) {}
        }
        return false;
    }

    @PluginMethod
    public void saveOfflineTrack(final PluginCall call) {
        final String rawId = call.getString("id", "");
        final String safeId = safeFileKey(rawId);
        final String base64 = call.getString("base64", "");
        final String ext = call.getString("ext", "m4a").replaceAll("[^a-zA-Z0-9]", "");
        final String mimeType = call.getString("mimeType", "audio/mp4");
        final String metadataJson = call.getString("metadataJson", "{}");
        final String fileName = call.getString("fileName", safeId + "." + ext);
        final boolean savePublic = call.getBoolean("savePublic", false);

        if (safeId.isEmpty() || base64 == null || base64.isEmpty()) {
            call.reject("Missing id or audio base64");
            return;
        }

        new Thread(() -> {
            try {
                String cleanB64 = base64;
                int commaIdx = cleanB64.indexOf(',');
                if (commaIdx >= 0 && cleanB64.startsWith("data:")) {
                    cleanB64 = cleanB64.substring(commaIdx + 1);
                }
                byte[] bytes = Base64.decode(cleanB64, Base64.DEFAULT);
                if (bytes.length < 16384) {
                    call.reject("Audio payload too small");
                    return;
                }

                File dir = offlineTracksDir();
                for (String candidateExt : new String[]{"m4a", "mp3", "webm", "ogg"}) {
                    File oldFile = new File(dir, safeId + "." + candidateExt);
                    if (oldFile.exists()) oldFile.delete();
                }

                String finalExt = ext.isEmpty() ? "m4a" : ext;
                File audioFile = new File(dir, safeId + "." + finalExt);
                try (FileOutputStream fos = new FileOutputStream(audioFile)) {
                    fos.write(bytes);
                    fos.flush();
                }

                File metaFile = new File(dir, safeId + ".json");
                try (FileOutputStream mfos = new FileOutputStream(metaFile)) {
                    mfos.write(metadataJson.getBytes(StandardCharsets.UTF_8));
                    mfos.flush();
                }

                boolean savedPublic = false;
                if (savePublic) {
                    savedPublic = writePublicMusicBytes(bytes, fileName, mimeType);
                }

                JSObject res = new JSObject();
                res.put("ok", true);
                res.put("path", audioFile.getAbsolutePath());
                res.put("size", bytes.length);
                res.put("savedPublic", savedPublic);
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Failed saving offline audio: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void savePublicMusicFile(final PluginCall call) {
        final String base64 = call.getString("base64", "");
        final String fileName = call.getString("fileName", "cancion.m4a");
        final String mimeType = call.getString("mimeType", "audio/mp4");
        if (base64 == null || base64.isEmpty()) {
            call.reject("Missing base64");
            return;
        }
        new Thread(() -> {
            try {
                String cleanB64 = base64;
                int commaIdx = cleanB64.indexOf(',');
                if (commaIdx >= 0 && cleanB64.startsWith("data:")) {
                    cleanB64 = cleanB64.substring(commaIdx + 1);
                }
                byte[] bytes = Base64.decode(cleanB64, Base64.DEFAULT);
                boolean ok = writePublicMusicBytes(bytes, fileName, mimeType);
                JSObject res = new JSObject();
                res.put("ok", ok);
                call.resolve(res);
            } catch (Exception e) {
                JSObject res = new JSObject();
                res.put("ok", false);
                res.put("error", e.getMessage());
                call.resolve(res);
            }
        }).start();
    }

    @PluginMethod
    public void getOfflineTrackPath(final PluginCall call) {
        final String safeId = safeFileKey(call.getString("id", ""));
        if (safeId.isEmpty()) {
            JSObject r = new JSObject();
            r.put("exists", false);
            call.resolve(r);
            return;
        }
        File dir = offlineTracksDir();
        for (String candidateExt : new String[]{"m4a", "mp3", "webm", "ogg"}) {
            File f = new File(dir, safeId + "." + candidateExt);
            if (f.exists() && f.length() >= 16384) {
                JSObject r = new JSObject();
                r.put("exists", true);
                r.put("path", f.getAbsolutePath());
                r.put("ext", candidateExt);
                r.put("size", f.length());
                call.resolve(r);
                return;
            }
        }
        JSObject r = new JSObject();
        r.put("exists", false);
        call.resolve(r);
    }

    @PluginMethod
    public void deleteOfflineTrack(final PluginCall call) {
        final String safeId = safeFileKey(call.getString("id", ""));
        if (!safeId.isEmpty()) {
            File dir = offlineTracksDir();
            for (String ext : new String[]{"m4a", "mp3", "webm", "ogg", "json"}) {
                File f = new File(dir, safeId + "." + ext);
                if (f.exists()) f.delete();
            }
        }
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    @PluginMethod
    public void saveOfflinePlaylist(final PluginCall call) {
        final String safeId = safeFileKey(call.getString("id", ""));
        final String metadataJson = call.getString("metadataJson", "{}");
        if (safeId.isEmpty()) {
            call.resolve(new JSObject());
            return;
        }
        new Thread(() -> {
            try {
                File f = new File(offlinePlaylistsDir(), safeId + ".json");
                try (FileOutputStream fos = new FileOutputStream(f)) {
                    fos.write(metadataJson.getBytes(StandardCharsets.UTF_8));
                    fos.flush();
                }
                JSObject r = new JSObject();
                r.put("ok", true);
                call.resolve(r);
            } catch (Exception e) {
                JSObject r = new JSObject();
                r.put("ok", false);
                call.resolve(r);
            }
        }).start();
    }

    @PluginMethod
    public void deleteOfflinePlaylist(final PluginCall call) {
        final String safeId = safeFileKey(call.getString("id", ""));
        if (!safeId.isEmpty()) {
            File f = new File(offlinePlaylistsDir(), safeId + ".json");
            if (f.exists()) f.delete();
        }
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    @PluginMethod
    public void listOfflineData(final PluginCall call) {
        new Thread(() -> {
            JSArray tracks = new JSArray();
            JSArray playlists = new JSArray();
            File tDir = offlineTracksDir();
            File[] files = tDir.listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.getName().endsWith(".json")) {
                        String safeId = f.getName().substring(0, f.getName().length() - 5);
                        File audioFile = null;
                        for (String ext : new String[]{"m4a", "mp3", "webm", "ogg"}) {
                            File cand = new File(tDir, safeId + "." + ext);
                            if (cand.exists() && cand.length() >= 16384) {
                                audioFile = cand;
                                break;
                            }
                        }
                        if (audioFile == null) continue;
                        try (FileInputStream fis = new FileInputStream(f)) {
                            byte[] data = new byte[(int) f.length()];
                            int read = fis.read(data);
                            if (read > 0) {
                                JSObject item = new JSObject(new String(data, 0, read, StandardCharsets.UTF_8));
                                item.put("_nativePath", audioFile.getAbsolutePath());
                                item.put("_nativeSize", audioFile.length());
                                tracks.put(item);
                            }
                        } catch (Exception ignored) {}
                    }
                }
            }
            File pDir = offlinePlaylistsDir();
            File[] pFiles = pDir.listFiles();
            if (pFiles != null) {
                for (File f : pFiles) {
                    if (f.getName().endsWith(".json")) {
                        try (FileInputStream fis = new FileInputStream(f)) {
                            byte[] data = new byte[(int) f.length()];
                            int read = fis.read(data);
                            if (read > 0) {
                                playlists.put(new JSObject(new String(data, 0, read, StandardCharsets.UTF_8)));
                            }
                        } catch (Exception ignored) {}
                    }
                }
            }
            JSObject r = new JSObject();
            r.put("tracks", tracks);
            r.put("playlists", playlists);
            call.resolve(r);
        }).start();
    }
}
