package com.spotifree.music;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.support.v4.media.session.PlaybackStateCompat;
import android.widget.RemoteViews;

import androidx.media.session.MediaButtonReceiver;

/**
 * Home-screen widget, like Spotify's: cover, song, artist and previous / play / next.
 * SpotifreeMediaService updates it whenever the song, the cover or play / pause change. The last
 * song is remembered so the widget still shows it after the app is closed; then play opens the app.
 */
public class SpotifreeWidget extends AppWidgetProvider {

    private static final String PREFS = "spotifree_widget";
    private static volatile Bitmap art;          // rounded cover of the current song
    private static volatile String lastSig = "";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        lastSig = "";
        update(ctx);
    }

    /** New cover from the media service (any size; it is scaled and rounded here) */
    static void setArt(Bitmap source) {
        art = source == null ? null : rounded(source, 192, 18);
        lastSig = "";
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

    /** Redraws every Spotifree widget (cheap when nothing changed) */
    static void update(Context ctx) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SpotifreeWidget.class));
            if (ids == null || ids.length == 0) return;

            SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String title = SpotifreeMediaService.title;
            String artist = SpotifreeMediaService.artist;
            if (title != null && !title.isEmpty()) {
                prefs.edit().putString("title", title).putString("artist", artist == null ? "" : artist).apply();
            } else {
                title = prefs.getString("title", "");
                artist = prefs.getString("artist", "");
            }
            boolean playing = SpotifreeMediaService.playing;
            // The app is running (its media session can take the buttons)
            boolean live = SpotifreeMediaService.current != null && SpotifreeMediaPlugin.isAppRunning();
            Bitmap cover = art;
            String sig = title + "|" + artist + "|" + playing + "|" + live + "|" + (cover == null ? 0 : cover.hashCode());
            if (sig.equals(lastSig)) return;
            lastSig = sig;

            RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.spotifree_widget);
            boolean hasSong = title != null && !title.isEmpty();
            v.setTextViewText(R.id.widget_title, hasSong ? title : "Spotifree");
            v.setTextViewText(R.id.widget_artist, hasSong ? artist : "Toca para abrir");
            if (cover != null) v.setImageViewBitmap(R.id.widget_art, cover);
            else v.setImageViewResource(R.id.widget_art, R.mipmap.ic_launcher_app_default);
            v.setImageViewResource(R.id.widget_play, playing ? R.drawable.ic_stat_pause : R.drawable.ic_stat_play);
            v.setInt(R.id.widget_play, "setColorFilter", Color.BLACK);
            v.setContentDescription(R.id.widget_play, playing ? "Pausar" : "Reproducir");

            PendingIntent open = openApp(ctx);
            if (open != null) {
                v.setOnClickPendingIntent(R.id.widget_art, open);
                v.setOnClickPendingIntent(R.id.widget_text, open);
            }
            if (live) {
                v.setOnClickPendingIntent(R.id.widget_prev,
                    MediaButtonReceiver.buildMediaButtonPendingIntent(ctx, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS));
                v.setOnClickPendingIntent(R.id.widget_play,
                    MediaButtonReceiver.buildMediaButtonPendingIntent(ctx, playing ? PlaybackStateCompat.ACTION_PAUSE : PlaybackStateCompat.ACTION_PLAY));
                v.setOnClickPendingIntent(R.id.widget_next,
                    MediaButtonReceiver.buildMediaButtonPendingIntent(ctx, PlaybackStateCompat.ACTION_SKIP_TO_NEXT));
            } else if (open != null) {
                // App closed: the buttons open it (music needs the app)
                v.setOnClickPendingIntent(R.id.widget_prev, open);
                v.setOnClickPendingIntent(R.id.widget_play, open);
                v.setOnClickPendingIntent(R.id.widget_next, open);
            }
            mgr.updateAppWidget(ids, v);
        } catch (Throwable ignored) {}
    }
}
