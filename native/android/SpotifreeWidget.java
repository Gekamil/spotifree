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
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.Bundle;
import android.support.v4.media.session.PlaybackStateCompat;
import android.view.View;
import android.widget.RemoteViews;

import androidx.media.session.MediaButtonReceiver;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Home-screen widget, Spotify style: the card takes the colour of the song's cover.
 * Three layouts, picked by the widget's size (the user can resize it):
 *  - bar (4x1):       cover, song, artist, previous / play / next
 *  - large (4x2+):    big cover, app icon + state, song, artist, big controls
 *  - small (2x2):     the cover fills it, song at the bottom, play in the corner
 * SpotifreeMediaService updates it whenever the song, the cover or play / pause change. The last
 * song, cover and colour are remembered so the widget still shows them after the app is closed;
 * then the buttons open the app.
 */
public class SpotifreeWidget extends AppWidgetProvider {

    private static final String PREFS = "spotifree_widget";
    private static final int DEFAULT_COLOR = 0xFF2A2A2A;
    private static volatile Bitmap source;   // current cover (square, 360 px)
    private static volatile int color = 0;   // card colour taken from the cover
    private static volatile boolean artDirty = false;
    private static volatile String lastSig = "";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        lastSig = "";
        update(ctx);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, Bundle options) {
        // Resized: maybe another layout
        lastSig = "";
        update(ctx);
    }

    /** New cover from the media service (any size) */
    static void setArt(Bitmap src) {
        if (src == null) {
            source = null;
            color = 0;
        } else {
            try {
                int s = Math.min(src.getWidth(), src.getHeight());
                Bitmap sq = Bitmap.createBitmap(src, (src.getWidth() - s) / 2, (src.getHeight() - s) / 2, s, s);
                source = Bitmap.createScaledBitmap(sq, 360, 360, true);
                color = cardColor(source);
            } catch (Throwable t) {
                source = null;
                color = 0;
            }
        }
        artDirty = true;
        lastSig = "";
    }

    /** The cover's most colourful tone, darkened so white text always reads well */
    private static int cardColor(Bitmap bmp) {
        try {
            Bitmap tiny = Bitmap.createScaledBitmap(bmp, 24, 24, true);
            float[] hsv = new float[3];
            float bestScore = -1f;
            float[] best = { 0f, 0f, 0.2f };
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
                    // Colourful and neither near-black nor near-white
                    float v = hsv[2];
                    float score = hsv[1] * (v < 0.18f ? 0.2f : v > 0.95f ? 0.6f : 1f) * (0.6f + 0.4f * v);
                    if (score > bestScore) {
                        bestScore = score;
                        best = new float[] { hsv[0], hsv[1], hsv[2] };
                    }
                }
            }
            if (bestScore < 0.12f) {
                // Grey / black & white covers: their average tone
                int avg = Color.rgb((int) (sumR / n), (int) (sumG / n), (int) (sumB / n));
                Color.colorToHSV(avg, best);
            }
            best[1] = Math.min(1f, best[1] * 1.05f);
            best[2] = Math.max(0.22f, Math.min(best[2], 0.46f));
            return Color.HSVToColor(255, best);
        } catch (Throwable t) {
            return DEFAULT_COLOR;
        }
    }

    private static Bitmap rounded(Bitmap src, int size, float radius) {
        try {
            Bitmap scaled = Bitmap.createScaledBitmap(src, size, size, true);
            Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas c = new Canvas(out);
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
            c.drawRoundRect(new RectF(0, 0, size, size), radius, radius, p);
            return out;
        } catch (Throwable t) {
            return null;
        }
    }

    private static PendingIntent openApp(Context ctx) {
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch == null) return null;
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return PendingIntent.getActivity(ctx, 7, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Keeps the last cover + colour on disk, so a restarted widget still shows them */
    private static void persistArt(Context ctx, SharedPreferences prefs) {
        if (!artDirty) return;
        artDirty = false;
        File f = new File(ctx.getFilesDir(), "widget_art.png");
        Bitmap s = source;
        try {
            if (s == null) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
                prefs.edit().remove("color").apply();
            } else {
                try (FileOutputStream out = new FileOutputStream(f)) {
                    s.compress(Bitmap.CompressFormat.PNG, 100, out);
                }
                prefs.edit().putInt("color", color).apply();
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
                    color = prefs.getInt("color", cardColor(b));
                }
            }
        } catch (Throwable ignored) {}
    }

    /** Which layout fits a widget of this size (dp) */
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

    /** Current cover (restored from disk after a restart); shared with the turntable widget */
    static Bitmap art(Context ctx) {
        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            persistArt(ctx, prefs);
            restoreArt(ctx, prefs);
        } catch (Throwable ignored) {}
        return source;
    }

    /** Card colour taken from the current cover */
    static int currentCardColor() {
        return color != 0 ? color : DEFAULT_COLOR;
    }

    /** {title, artist} of the song playing, or the last one (remembered after the app closes) */
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

    /** Redraws every Spotifree widget (cheap when nothing changed) */
    static void update(Context ctx) {
        // The turntable widget follows the same song, cover and play state
        SpotifreeTurntableWidget.update(ctx);
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SpotifreeWidget.class));
            if (ids == null || ids.length == 0) return;

            art(ctx);
            String[] song = song(ctx);
            String title = song[0];
            String artist = song[1];
            String lyrics = SpotifreeMediaService.lyricLine;
            boolean playing = SpotifreeMediaService.playing;
            // The app is running (its media session can take the buttons)
            boolean live = SpotifreeMediaService.current != null && SpotifreeMediaPlugin.isAppRunning();
            Bitmap cover = source;
            int card = color != 0 ? color : DEFAULT_COLOR;
            StringBuilder layouts = new StringBuilder();
            for (int id : ids) layouts.append(layoutFor(mgr, id)).append(',');
            String sig = title + "|" + artist + "|" + (lyrics == null ? "" : lyrics) + "|" + playing + "|" + live + "|" + (cover == null ? 0 : cover.hashCode()) + "|" + card + "|" + layouts;
            if (sig.equals(lastSig)) return;
            lastSig = sig;

            boolean hasSong = title != null && !title.isEmpty();
            PendingIntent open = openApp(ctx);
            Bitmap artBar = cover == null ? null : rounded(cover, 192, 22);
            Bitmap artBig = cover == null ? null : rounded(cover, 360, 30);

            for (int id : ids) {
                int layout = layoutFor(mgr, id);
                boolean small = layout == R.layout.spotifree_widget_small;
                boolean large = layout == R.layout.spotifree_widget_large;
                RemoteViews v = new RemoteViews(ctx.getPackageName(), layout);

                v.setInt(R.id.widget_bg, "setColorFilter", card);
                v.setTextViewText(R.id.widget_title, hasSong ? title : "Spotifree");
                v.setTextViewText(R.id.widget_artist, hasSong ? artist : "Toca para abrir");
                if (!small) {
                    if (hasSong && lyrics != null && !lyrics.trim().isEmpty()) {
                        v.setViewVisibility(R.id.widget_lyrics, View.VISIBLE);
                        v.setTextViewText(R.id.widget_lyrics, "♫ " + lyrics.trim());
                    } else {
                        v.setViewVisibility(R.id.widget_lyrics, View.GONE);
                    }
                }
                Bitmap art = small || large ? artBig : artBar;
                if (art != null) v.setImageViewBitmap(R.id.widget_art, art);
                else v.setImageViewResource(R.id.widget_art, R.mipmap.ic_launcher_app_default);
                v.setImageViewResource(R.id.widget_play, playing ? R.drawable.ic_stat_pause : R.drawable.ic_stat_play);
                v.setInt(R.id.widget_play, "setColorFilter", Color.BLACK);
                v.setContentDescription(R.id.widget_play, playing ? "Pausar" : "Reproducir");
                if (large) {
                    v.setTextViewText(R.id.widget_state, !hasSong ? "Spotifree" : playing ? "Sonando ahora" : live ? "En pausa" : "Lo último que escuchaste");
                }

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
                    // App closed: the buttons open it (music needs the app)
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
