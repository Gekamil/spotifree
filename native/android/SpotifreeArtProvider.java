package com.spotifree.music;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.provider.OpenableColumns;
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

    /** A drawable of the app (tab icons) served as a PNG: content://<pkg>.art/res/<id> */
    @Nullable
    static Uri resUri(Context ctx, int resId) {
        if (resId == 0) return null;
        return new Uri.Builder().scheme("content").authority(ctx.getPackageName() + ".art")
            .appendPath("res").appendPath(String.valueOf(resId)).build();
    }

    /** The app's logo: shown when a cover cannot be downloaded, so the car never shows a blank */
    @Nullable
    static Uri logoUri(Context ctx) {
        return new Uri.Builder().scheme("content").authority(ctx.getPackageName() + ".art").appendPath("logo").build();
    }

    @Nullable
    private static File renderDrawable(Context ctx, @Nullable Drawable d, String name, int size) {
        if (d == null) return null;
        File dir = new File(ctx.getCacheDir(), "car_art");
        if (!dir.exists() && !dir.mkdirs()) return null;
        File f = new File(dir, name);
        if (f.exists() && f.length() > 0) return f;
        try {
            Bitmap b = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas cv = new Canvas(b);
            d.setBounds(0, 0, size, size);
            d.draw(cv);
            try (OutputStream out = new FileOutputStream(f)) {
                b.compress(Bitmap.CompressFormat.PNG, 100, out);
            }
            return f.length() > 0 ? f : null;
        } catch (Exception e) {
            return null;
        }
    }

    @Nullable
    private static File logoFile(Context ctx) {
        try {
            return renderDrawable(ctx, ctx.getPackageManager().getApplicationIcon(ctx.getPackageName()), "app_logo.png", 512);
        } catch (Exception e) {
            return null;
        }
    }

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
            c.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14) Spotifree");
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
        if (ctx == null) throw new FileNotFoundException("no context");
        String first = uri.getPathSegments().isEmpty() ? "" : uri.getPathSegments().get(0);
        File f = null;
        if ("res".equals(first) && uri.getPathSegments().size() > 1) {
            try {
                int id = Integer.parseInt(uri.getPathSegments().get(1));
                f = renderDrawable(ctx, ctx.getDrawable(id), "res_" + id + ".png", 192);
            } catch (Exception ignored) {}
        } else if ("logo".equals(first)) {
            f = logoFile(ctx);
        } else {
            String url = uri.getQueryParameter("u");
            if (url == null) throw new FileNotFoundException("no url");
            f = cachedFile(ctx, url);
            if (f == null) f = logoFile(ctx); // cover not available: the app's logo instead of nothing
        }
        if (f == null) throw new FileNotFoundException("not available: " + uri);
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
        // Some car / media apps ask for the openable columns before opening the image
        String[] cols = projection != null ? projection : new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE };
        MatrixCursor mc = new MatrixCursor(cols);
        Object[] row = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) row[i] = "cover.img";
        mc.addRow(row);
        return mc;
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
