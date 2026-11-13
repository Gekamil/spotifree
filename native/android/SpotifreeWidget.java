package com.spotifree.music;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Bundle;
import android.os.SystemClock;
import android.support.v4.media.session.PlaybackStateCompat;
import android.view.View;
import android.widget.RemoteViews;

import androidx.media.session.MediaButtonReceiver;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Locale;

/**
 * Home-screen widget, modern frosted glass Spotify style:
 * Blurred album artwork backdrop + dual-tone vibrant gradient + subtle specular glass border,
 * live spinning green ring, native launcher Chronometer timer, track progress bar & synced lyrics.
 * Responsive across 4x1 bar, 4x2+ large, and 2x2 small layouts.
 */
public class SpotifreeWidget extends AppWidgetProvider {

    private static final String PREFS = "spotifree_widget";
    private static final int DEFAULT_PRIMARY = 0xFF1A5B36;
    private static final int DEFAULT_SECONDARY = 0xFF0C1A13;
    private static final int DEFAULT_ACCENT = 0xFF1ED760;

    private static volatile Bitmap source;     // square cover (360 px)
    private static volatile int primaryColor = 0;
    private static volatile int secondaryColor = 0;
    private static volatile int accentColor = 0;

    private static volatile Bitmap cachedArtFor = null;
    private static volatile Bitmap cachedArtBar = null;
    private static volatile Bitmap cachedArtBig = null;
    private static volatile Bitmap cachedBgWide = null;
    private static volatile Bitmap cachedBgBar = null;
    private static volatile Bitmap cachedBgSquare = null;
    private static volatile Bitmap defaultBgWide = null;
    private static volatile Bitmap defaultBgBar = null;
    private static volatile Bitmap defaultBgSquare = null;

    private static volatile boolean artDirty = false;
    private static volatile String lastSig = "";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        lastSig = "";
        update(ctx);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle options) {
        lastSig = "";
        update(ctx);
    }

    /** New cover from SpotifreeMediaService */
    static void setArt(Bitmap src) {
        if (src == null) {
            source = null;
            primaryColor = 0;
            secondaryColor = 0;
            accentColor = 0;
        } else {
            try {
                int s = Math.min(src.getWidth(), src.getHeight());
                Bitmap sq = Bitmap.createBitmap(src, (src.getWidth() - s) / 2, (src.getHeight() - s) / 2, s, s);
                source = Bitmap.createScaledBitmap(sq, 360, 360, true);
                extractPalette(source);
            } catch (Throwable t) {
                source = null;
                primaryColor = 0;
                secondaryColor = 0;
                accentColor = 0;
            }
        }
        invalidateBitmaps();
        artDirty = true;
        lastSig = "";
    }

    private static void invalidateBitmaps() {
        cachedArtFor = null;
        cachedArtBar = null;
        cachedArtBig = null;
        cachedBgWide = null;
        cachedBgBar = null;
        cachedBgSquare = null;
    }

    /** Extracts primary vibrant color, complementary deep shade, and glowing accent from the album cover */
    private static void extractPalette(Bitmap bmp) {
        try {
            Bitmap tiny = Bitmap.createScaledBitmap(bmp, 24, 24, true);
            float[] hsv = new float[3];
            float bestScore = -1f;
            float[] best = { 145f, 0.45f, 0.36f };
            double sumR = 0, sumG = 0, sumB = 0;
            int n = 0;

            for (int y = 0; y < 24; y++) {
                for (int x = 0; x < 24; x++) {
                    int p = tiny.getPixel(x, y);
                    sumR += Color.red(p);
                    sumG += Color.green(p);
                    sumB += Color.blue(p);
                    n++;
                    Color.colorToHSV(p, hsv);
                    float v = hsv[2];
                    float score = hsv[1] * (v < 0.16f ? 0.25f : v > 0.96f ? 0.55f : 1f) * (0.55f + 0.45f * v);
                    if (score > bestScore) {
                        bestScore = score;
                        best = new float[] { hsv[0], hsv[1], hsv[2] };
                    }
                }
            }
            if (bestScore < 0.12f) {
                int avg = Color.rgb((int) (sumR / n), (int) (sumG / n), (int) (sumB / n));
                Color.colorToHSV(avg, best);
            }

            // Secondary tone: seek distinct hue quadrant or cool shift from primary
            float bestSecScore = -1f;
            float[] sec = { (best[0] + 34f) % 360f, Math.max(0.25f, best[1] * 0.85f), Math.max(0.16f, best[2] * 0.55f) };
            for (int y = 0; y < 24; y += 2) {
                for (int x = 0; x < 24; x += 2) {
                    int p = tiny.getPixel(x, y);
                    Color.colorToHSV(p, hsv);
                    float hueDist = Math.abs(hsv[0] - best[0]);
                    if (hueDist > 180f) hueDist = 360f - hueDist;
                    if (hueDist >= 28f) {
                        float score = hsv[1] * (0.5f + 0.5f * hsv[2]) * Math.min(1f, hueDist / 70f);
                        if (score > bestSecScore) {
                            bestSecScore = score;
                            sec = new float[] { hsv[0], hsv[1], hsv[2] };
                        }
                    }
                }
            }

            float[] pNorm = { best[0], Math.min(1f, Math.max(0.18f, best[1] * 1.08f)), Math.max(0.28f, Math.min(0.56f, best[2])) };
            float[] sNorm = { sec[0], Math.min(0.95f, Math.max(0.15f, sec[1] * 0.95f)), Math.max(0.14f, Math.min(0.32f, sec[2] * 0.72f)) };
            float[] aNorm = { best[0], Math.min(1f, Math.max(0.45f, best[1] * 1.15f)), Math.max(0.68f, Math.min(0.92f, best[2] * 1.35f)) };

            primaryColor = Color.HSVToColor(255, pNorm);
            secondaryColor = Color.HSVToColor(255, sNorm);
            accentColor = bestScore >= 0.14f ? Color.HSVToColor(255, aNorm) : DEFAULT_ACCENT;
        } catch (Throwable t) {
            primaryColor = DEFAULT_PRIMARY;
            secondaryColor = DEFAULT_SECONDARY;
            accentColor = DEFAULT_ACCENT;
        }
    }

    private static int withAlpha(int color, int alpha) {
        return (color & 0x00FFFFFF) | ((alpha & 0xFF) << 24);
    }

    /** Fast 2-pass separable box blur over a small bitmap -> smooth bokeh in <3ms */
    private static Bitmap blurSmall(Bitmap src, int targetSize, int radius) {
        Bitmap small = Bitmap.createScaledBitmap(src, targetSize, targetSize, true);
        Bitmap out = small.copy(Bitmap.Config.ARGB_8888, true);
        int w = out.getWidth();
        int h = out.getHeight();
        int[] pix = new int[w * h];
        int[] tmp = new int[w * h];
        out.getPixels(pix, 0, w, 0, 0, w, h);

        int div = radius * 2 + 1;
        for (int pass = 0; pass < 2; pass++) {
            // Horizontal pass
            for (int y = 0; y < h; y++) {
                int row = y * w;
                int sumR = 0, sumG = 0, sumB = 0;
                for (int i = -radius; i <= radius; i++) {
                    int px = pix[row + Math.max(0, Math.min(w - 1, i))];
                    sumR += (px >> 16) & 0xFF;
                    sumG += (px >> 8) & 0xFF;
                    sumB += px & 0xFF;
                }
                for (int x = 0; x < w; x++) {
                    tmp[row + x] = 0xFF000000 | ((sumR / div) << 16) | ((sumG / div) << 8) | (sumB / div);
                    int addX = Math.min(w - 1, x + radius + 1);
                    int subX = Math.max(0, x - radius);
                    int addP = pix[row + addX];
                    int subP = pix[row + subX];
                    sumR += ((addP >> 16) & 0xFF) - ((subP >> 16) & 0xFF);
                    sumG += ((addP >> 8) & 0xFF) - ((subP >> 8) & 0xFF);
                    sumB += (addP & 0xFF) - (subP & 0xFF);
                }
            }
            // Vertical pass
            for (int x = 0; x < w; x++) {
                int sumR = 0, sumG = 0, sumB = 0;
                for (int i = -radius; i <= radius; i++) {
                    int py = Math.max(0, Math.min(h - 1, i));
                    int px = tmp[py * w + x];
                    sumR += (px >> 16) & 0xFF;
                    sumG += (px >> 8) & 0xFF;
                    sumB += px & 0xFF;
                }
                for (int y = 0; y < h; y++) {
                    pix[y * w + x] = 0xFF000000 | ((sumR / div) << 16) | ((sumG / div) << 8) | (sumB / div);
                    int addY = Math.min(h - 1, y + radius + 1);
                    int subY = Math.max(0, y - radius);
                    int addP = tmp[addY * w + x];
                    int subP = tmp[subY * w + x];
                    sumR += ((addP >> 16) & 0xFF) - ((subP >> 16) & 0xFF);
                    sumG += ((addP >> 8) & 0xFF) - ((subP >> 8) & 0xFF);
                    sumB += (addP & 0xFF) - (subP & 0xFF);
                }
            }
        }
        out.setPixels(pix, 0, w, 0, 0, w, h);
        return out;
    }

    /** Renders rounded frosted-glass blurred album cover + multi-stop gradient + rim sheen */
    private static Bitmap renderBackdrop(Bitmap cover, int width, int height, float cornerRadius, int c1, int c2, int cAcc) {
        try {
            Bitmap scene = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas sc = new Canvas(scene);

            if (cover != null) {
                Bitmap blurred = blurSmall(cover, 72, 6);
                // Center-crop scale blurred artwork across full card
                float scale = Math.max((float) width / blurred.getWidth(), (float) height / blurred.getHeight());
                float dw = blurred.getWidth() * scale;
                float dh = blurred.getHeight() * scale;
                RectF dst = new RectF((width - dw) / 2f, (height - dh) / 2f, (width + dw) / 2f, (height + dh) / 2f);
                Paint artPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
                sc.drawBitmap(blurred, new Rect(0, 0, blurred.getWidth(), blurred.getHeight()), dst, artPaint);

                // Diagonal atmospheric palette gradient so blurred artwork stays rich & readable
                Paint gradPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
                gradPaint.setShader(new LinearGradient(
                        0f, 0f, width, height,
                        new int[] { withAlpha(c1, 125), withAlpha(c2, 165), withAlpha(0xFF0A0B0E, 195) },
                        new float[] { 0f, 0.55f, 1f },
                        Shader.TileMode.CLAMP
                ));
                sc.drawRect(0f, 0f, width, height, gradPaint);

                // Subtle radial accent glow near cover / turntable focal point
                Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
                float gx = width * 0.22f;
                float gy = height * 0.42f;
                float gr = Math.max(width, height) * 0.65f;
                glow.setShader(new RadialGradient(gx, gy, gr, withAlpha(cAcc, 68), 0x00000000, Shader.TileMode.CLAMP));
                sc.drawCircle(gx, gy, gr, glow);
            } else {
                // Default dark emerald aurora theme when no song is cached yet
                Paint base = new Paint(Paint.ANTI_ALIAS_FLAG);
                base.setShader(new LinearGradient(
                        0f, 0f, width, height,
                        new int[] { 0xFF195131, 0xFF10241A, 0xFF0A0B0E },
                        new float[] { 0f, 0.52f, 1f },
                        Shader.TileMode.CLAMP
                ));
                sc.drawRect(0f, 0f, width, height, base);
                Paint orb = new Paint(Paint.ANTI_ALIAS_FLAG);
                float r = Math.max(width, height) * 0.58f;
                orb.setShader(new RadialGradient(width * 0.18f, height * 0.28f, r, 0x501ED760, 0x001ED760, Shader.TileMode.CLAMP));
                sc.drawCircle(width * 0.18f, height * 0.28f, r, orb);
            }

            // Mask onto clean rounded output + draw specular inner rim stroke
            Bitmap roundedOut = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas oc = new Canvas(roundedOut);
            Paint maskPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            maskPaint.setShader(new BitmapShader(scene, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
            RectF cardRect = new RectF(0f, 0f, width, height);
            oc.drawRoundRect(cardRect, cornerRadius, cornerRadius, maskPaint);

            Paint border = new Paint(Paint.ANTI_ALIAS_FLAG);
            border.setStyle(Paint.Style.STROKE);
            border.setStrokeWidth(2f);
            border.setShader(new LinearGradient(
                    0f, 0f, width, height,
                    new int[] { 0x66FFFFFF, 0x1AFFFFFF, 0x33FFFFFF },
                    new float[] { 0f, 0.45f, 1f },
                    Shader.TileMode.CLAMP
            ));
            oc.drawRoundRect(new RectF(1f, 1f, width - 1f, height - 1f), cornerRadius - 1f, cornerRadius - 1f, border);
            return roundedOut;
        } catch (Throwable t) {
            return null;
        }
    }

    private static Bitmap rounded(Bitmap src, int size, float radius) {
        try {
            Bitmap scaled = Bitmap.createScaledBitmap(src, size, size, true);
            Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(out);
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
            p.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
            c.drawRoundRect(new RectF(0, 0, size, size), radius, radius, p);

            Paint rim = new Paint(Paint.ANTI_ALIAS_FLAG);
            rim.setStyle(Paint.Style.STROKE);
            rim.setStrokeWidth(1.5f);
            rim.setColor(0x36FFFFFF);
            c.drawRoundRect(new RectF(0.75f, 0.75f, size - 0.75f, size - 0.75f), radius, radius, rim);
            return out;
        } catch (Throwable t) {
            return null;
        }
    }

    private static void ensureCoverAssets() {
        Bitmap cover = source;
        if (cover == null) {
            if (defaultBgWide == null) defaultBgWide = renderBackdrop(null, 400, 188, 30f, DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_ACCENT);
            if (defaultBgBar == null) defaultBgBar = renderBackdrop(null, 400, 140, 28f, DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_ACCENT);
            if (defaultBgSquare == null) defaultBgSquare = renderBackdrop(null, 320, 320, 30f, DEFAULT_PRIMARY, DEFAULT_SECONDARY, DEFAULT_ACCENT);
            return;
        }
        if (cachedArtFor == cover && cachedBgWide != null) return;
        int c1 = primaryColor != 0 ? primaryColor : DEFAULT_PRIMARY;
        int c2 = secondaryColor != 0 ? secondaryColor : DEFAULT_SECONDARY;
        int cAcc = accentColor != 0 ? accentColor : DEFAULT_ACCENT;
        cachedArtBar = rounded(cover, 172, 22f);
        cachedArtBig = rounded(cover, 248, 24f);
        cachedBgWide = renderBackdrop(cover, 400, 188, 30f, c1, c2, cAcc);
        cachedBgBar = renderBackdrop(cover, 400, 140, 28f, c1, c2, cAcc);
        cachedBgSquare = renderBackdrop(cover, 320, 320, 30f, c1, c2, cAcc);
        cachedArtFor = cover;
    }

    /** Wide blurred album cover + gradient backdrop shared with SpotifreeTurntableWidget */
    static Bitmap wideBackdrop(Context ctx) {
        art(ctx);
        ensureCoverAssets();
        return source != null && cachedBgWide != null ? cachedBgWide : defaultBgWide;
    }

    private static PendingIntent openApp(Context ctx) {
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch == null) return null;
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return PendingIntent.getActivity(ctx, 7, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static void persistArt(Context ctx, SharedPreferences prefs) {
        if (!artDirty) return;
        artDirty = false;
        File f = new File(ctx.getFilesDir(), "widget_art.png");
        Bitmap s = source;
        try {
            if (s == null) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
                prefs.edit().remove("color").remove("secColor").remove("accColor").apply();
            } else {
                try (FileOutputStream out = new FileOutputStream(f)) {
                    s.compress(Bitmap.CompressFormat.PNG, 100, out);
                }
                prefs.edit()
                        .putInt("color", primaryColor)
                        .putInt("secColor", secondaryColor)
                        .putInt("accColor", accentColor)
                        .apply();
            }
        } catch (Throwable ignored) {}
    }

    private static void restoreArt(Context ctx, SharedPreferences prefs) {
        if (source != null) return;
        try {
            File f = new File(ctx.getFilesDir(), "widget_art.png");
            if (f.exists()) {
                Bitmap b = BitmapFactory.decodeFile(f.getAbsolutePath());
                if (b != null) {
                    source = b;
                    int savedP = prefs.getInt("color", 0);
                    int savedS = prefs.getInt("secColor", 0);
                    int savedA = prefs.getInt("accColor", 0);
                    if (savedP != 0 && savedS != 0 && savedA != 0) {
                        primaryColor = savedP;
                        secondaryColor = savedS;
                        accentColor = savedA;
                    } else {
                        extractPalette(b);
                    }
                    invalidateBitmaps();
                }
            }
        } catch (Throwable ignored) {}
    }

    private static int layoutFor(AppWidgetManager mgr, int id) {
        try {
            Bundle o = mgr.getAppWidgetOptions(id);
            int w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
            int h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 56));
            if (w < 200) return R.layout.spotifree_widget_small;
            if (h >= 120) return R.layout.spotifree_widget_large;
        } catch (Throwable ignored) {}
        return R.layout.spotifree_widget;
    }

    static Bitmap art(Context ctx) {
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            persistArt(ctx, prefs);
            restoreArt(ctx, prefs);
        } catch (Throwable ignored) {}
        return source;
    }

    static int currentCardColor() {
        return primaryColor != 0 ? primaryColor : DEFAULT_PRIMARY;
    }

    static String formatDuration(long ms) {
        if (ms <= 0) return "";
        long sec = ms / 1000L;
        long m = sec / 60L;
        long s = sec % 60L;
        return String.format(Locale.US, "%d:%02d", m, s);
    }

    static String[] song(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String title = SpotifreeMediaService.title;
        String artist = SpotifreeMediaService.artist;
        if (title != null && !title.isEmpty()) {
            prefs.edit().putString("title", title).putString("artist", artist == null ? "" : artist).apply();
            return new String[] { title, artist == null ? "" : artist };
        }
        return new String[] { prefs.getString("title", ""), prefs.getString("artist", "") };
    }

    static void update(Context ctx) {
        SpotifreeTurntableWidget.update(ctx);
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SpotifreeWidget.class));
            if (ids == null || ids.length == 0) return;

            art(ctx);
            ensureCoverAssets();
            String[] song = song(ctx);
            String title = song[0];
            String artist = song[1];
            String lyrics = SpotifreeMediaService.lyricLine;
            boolean playing = SpotifreeMediaService.playing;
            boolean live = SpotifreeMediaService.current != null && SpotifreeMediaPlugin.isAppRunning();
            long durMs = SpotifreeMediaService.durationMs;
            long posMs = SpotifreeMediaService.positionMs;
            int progPermille = (durMs > 0) ? (int) Math.max(0L, Math.min(1000L, (posMs * 1000L) / durMs)) : 0;
            int progBucket = progPermille / 5;

            Bitmap cover = source;
            int card = primaryColor != 0 ? primaryColor : DEFAULT_PRIMARY;
            StringBuilder layouts = new StringBuilder();
            for (int id : ids) layouts.append(layoutFor(mgr, id)).append(',');
            String sig = title + "|" + artist + "|" + (lyrics == null ? "" : lyrics) + "|" + playing + "|" + live + "|" + progBucket + "|" + durMs + "|" + (cover == null ? 0 : cover.hashCode()) + "|" + card + "|" + layouts;
            if (sig.equals(lastSig)) return;
            lastSig = sig;

            boolean hasSong = title != null && !title.isEmpty();
            PendingIntent open = openApp(ctx);
            boolean activeSpin = playing && live && hasSong;
            long safePos = Math.max(0L, durMs > 0 ? Math.min(posMs, durMs) : posMs);
            long chronoBase = SystemClock.elapsedRealtime() - safePos;
            String durText = formatDuration(durMs);

            for (int id : ids) {
                int layout = layoutFor(mgr, id);
                boolean small = layout == R.layout.spotifree_widget_small;
                boolean large = layout == R.layout.spotifree_widget_large;
                RemoteViews v = new RemoteViews(ctx.getPackageName(), layout);

                v.setInt(R.id.widget_bg, "setColorFilter", card);
                Bitmap bgBmp = small
                        ? (cover != null && cachedBgSquare != null ? cachedBgSquare : defaultBgSquare)
                        : large
                        ? (cover != null && cachedBgWide != null ? cachedBgWide : defaultBgWide)
                        : (cover != null && cachedBgBar != null ? cachedBgBar : defaultBgBar);
                if (bgBmp != null) {
                    v.setImageViewBitmap(R.id.widget_bg_art, bgBmp);
                    v.setViewVisibility(R.id.widget_bg_art, View.VISIBLE);
                } else {
                    v.setViewVisibility(R.id.widget_bg_art, View.GONE);
                }

                v.setTextViewText(R.id.widget_title, hasSong ? title : "Spotifree");
                v.setTextViewText(R.id.widget_artist, hasSong ? artist : "Toca para abrir");
                v.setViewVisibility(R.id.widget_live_ring, activeSpin ? View.VISIBLE : View.GONE);
                v.setProgressBar(R.id.widget_progress, 1000, hasSong ? progPermille : 0, false);

                if (!small) {
                    if (hasSong && lyrics != null && !lyrics.trim().isEmpty()) {
                        v.setViewVisibility(R.id.widget_lyrics, View.VISIBLE);
                        v.setTextViewText(R.id.widget_lyrics, "♫ " + lyrics.trim());
                        v.setBoolean(R.id.widget_lyrics, "setSelected", true);
                    } else {
                        v.setViewVisibility(R.id.widget_lyrics, View.GONE);
                        v.setBoolean(R.id.widget_lyrics, "setSelected", false);
                    }
                }

                if (large || small) {
                    if (hasSong && durMs > 0) {
                        v.setViewVisibility(R.id.widget_chronometer, View.VISIBLE);
                        v.setChronometer(R.id.widget_chronometer, chronoBase, null, activeSpin);
                    } else {
                        v.setViewVisibility(R.id.widget_chronometer, View.GONE);
                    }
                }
                if (large) {
                    v.setTextViewText(R.id.widget_state, !hasSong ? "Spotifree" : activeSpin ? "Sonando ahora" : live ? "En pausa" : "Lo último que escuchaste");
                    if (hasSong && !durText.isEmpty()) {
                        v.setViewVisibility(R.id.widget_duration, View.VISIBLE);
                        v.setTextViewText(R.id.widget_duration, " / " + durText);
                    } else {
                        v.setViewVisibility(R.id.widget_duration, View.GONE);
                    }
                }

                Bitmap art = small || large ? cachedArtBig : cachedArtBar;
                if (cover != null && art != null) v.setImageViewBitmap(R.id.widget_art, art);
                else v.setImageViewResource(R.id.widget_art, R.mipmap.ic_launcher_app_default);

                v.setImageViewResource(R.id.widget_play, playing ? R.drawable.ic_stat_pause : R.drawable.ic_stat_play);
                v.setInt(R.id.widget_play, "setColorFilter", Color.BLACK);
                v.setContentDescription(R.id.widget_play, playing ? "Pausar" : "Reproducir");

                if (open != null) {
                    v.setOnClickPendingIntent(R.id.widget_art, open);
                    v.setOnClickPendingIntent(R.id.widget_text, open);
                }
                if (live) {
                    v.setOnClickPendingIntent(R.id.widget_play,
                        MediaButtonReceiver.buildMediaButtonPendingIntent(ctx, playing ? PlaybackStateCompat.ACTION_PAUSE : PlaybackStateCompat.ACTION_PLAY));
                    if (!small) {
                        v.setOnClickPendingIntent(R.id.widget_prev,
                            MediaButtonReceiver.buildMediaButtonPendingIntent(ctx, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS));
                        v.setOnClickPendingIntent(R.id.widget_next,
                            MediaButtonReceiver.buildMediaButtonPendingIntent(ctx, PlaybackStateCompat.ACTION_SKIP_TO_NEXT));
                    }
                } else if (open != null) {
                    v.setOnClickPendingIntent(R.id.widget_play, open);
                    if (!small) {
                        v.setOnClickPendingIntent(R.id.widget_prev, open);
                        v.setOnClickPendingIntent(R.id.widget_next, open);
                    }
                }
                mgr.updateAppWidget(id, v);
            }
        } catch (Throwable ignored) {}
    }
}
