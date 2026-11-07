package com.spotifree.music;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Cover art for Android Auto. The car only loads artwork from content:// URIs, so every cover
 * (Spotify / Deezer / YouTube image URL) is served through this provider:
 *   content://com.spotifree.music.art/img?u=<https url>
 * The image is downloaded once and kept in the app cache. Only image hosts used by the app
 * are allowed, so the provider cannot be used to fetch anything else.
 */
public class SpotifreeArtProvider extends ContentProvider {

    private static final String[] ALLOWED_HOST_SUFFIXES = {
        "scdn.co", "spotifycdn.com", "dzcdn.net", "ytimg.com", "ggpht.com", "googleusercontent.com", "deezer.com",
        "mzstatic.com" // photos of the Explorar categories
    };

    /** Images made by the app itself (e.g. an SVG cover turned into PNG): "local:<key>" */
    static File localFile(Context ctx, String key) {
        File dir = new File(ctx.getCacheDir(), "car_art");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, "local_" + key.replaceAll("[^A-Za-z0-9_-]", "_") + ".img");
    }

    @Nullable
    static Uri uriFor(Context ctx, @Nullable String url) {
        if (url == null || url.isEmpty()) return null;
        if (!url.startsWith("https://") && !url.startsWith("local:")) return null;
        return new Uri.Builder().scheme("content").authority(ctx.getPackageName() + ".art")
            .appendPath("img").appendQueryParameter("u", url).build();
    }

    private static boolean allowed(String url) {
        try {
            URL u = new URL(url);
            if (!"https".equals(u.getProtocol())) return false;
            String host = u.getHost().toLowerCase();
            for (String s : ALLOWED_HOST_SUFFIXES) if (host.equals(s) || host.endsWith("." + s)) return true;
        } catch (Exception ignored) {}
        return false;
    }

    private static String sha1(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            byte[] d = md.digest(s.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(s.hashCode());
        }
    }

    /** Downloads (once) and returns the cached file of an image URL, or null. */
    @Nullable
    static File cachedFile(Context ctx, String url) {
        if (url != null && url.startsWith("local:")) {
            File lf = localFile(ctx, url.substring(6));
            return lf.exists() && lf.length() > 0 ? lf : null;
        }
        if (url == null || !allowed(url)) return null;
        File dir = new File(ctx.getCacheDir(), "car_art");
        if (!dir.exists() && !dir.mkdirs()) return null;
        File f = new File(dir, sha1(url) + ".img");
        if (f.exists() && f.length() > 0) return f;
        File tmp = new File(dir, f.getName() + ".tmp" + Thread.currentThread().getId());
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(7000);
            c.setReadTimeout(10000);
            c.setInstanceFollowRedirects(true);
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(tmp)) {
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
            if (!tmp.renameTo(f)) {
                tmp.delete();
                return f.exists() ? f : null;
            }
            return f;
        } catch (Exception e) {
            tmp.delete();
            return null;
        }
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Nullable
    @Override
    public ParcelFileDescriptor openFile(@NonNull Uri uri, @NonNull String mode) throws FileNotFoundException {
        Context ctx = getContext();
        String url = uri.getQueryParameter("u");
        if (ctx == null || url == null) throw new FileNotFoundException("no url");
        File f = cachedFile(ctx, url);
        if (f == null) throw new FileNotFoundException("not available: " + url);
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Nullable
    @Override
    public String getType(@NonNull Uri uri) {
        return "image/jpeg";
    }

    @Nullable
    @Override
    public Cursor query(@NonNull Uri uri, @Nullable String[] projection, @Nullable String selection, @Nullable String[] selectionArgs, @Nullable String sortOrder) {
        return null;
    }

    @Nullable
    @Override
    public Uri insert(@NonNull Uri uri, @Nullable ContentValues values) {
        return null;
    }

    @Override
    public int delete(@NonNull Uri uri, @Nullable String selection, @Nullable String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(@NonNull Uri uri, @Nullable ContentValues values, @Nullable String selection, @Nullable String[] selectionArgs) {
        return 0;
    }
}
