package com.spotifree.music;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Shader;
import android.os.Bundle;
import android.os.SystemClock;
import android.support.v4.media.session.PlaybackStateCompat;
import android.view.View;
import android.widget.RemoteViews;

import androidx.media.session.MediaButtonReceiver;

/**
 * "Tocadiscos" home-screen widget:
 *  - Blurred album artwork + dynamic gradient glass card backdrop (shared with SpotifreeWidget).
 *  - Native 60 FPS smooth launcher rotation on both the vinyl platter/grooves (tt_spin) and an
 *    optical specular highlight sweep over the center label (tt_label_sheen), replacing the old
 *    choppy ViewFlipper 16-frame swap.
 *  - High-res crisp circular cover label (192 px ARGB_8888) + brushed metallic center spindle.
 *  - Tonearm, live Chronometer elapsed timer, lyrics line, and track progress bar.
 */
public class SpotifreeTurntableWidget extends AppWidgetProvider {

    private static final int LABEL_PX = 192;
    private static volatile Bitmap labelFor = null;
    private static volatile Bitmap labelBmp = null;
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

    /** Crisp 192px ARGB circular album cover label with chrome bezel & vinyl spindle hole */
    private static Bitmap buildLabel(Bitmap cover) {
        if (cover == null) return null;
        try {
            int s = LABEL_PX;
            float c = s / 2f;
            Bitmap scaled = Bitmap.createScaledBitmap(cover, s, s, true);
            Bitmap out = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888);
            Canvas lc = new Canvas(out);

            Paint art = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
            art.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
            lc.drawCircle(c, c, c - 2f, art);

            // Outer dark metallic rim separating grooves & cover label
            Paint edge = new Paint(Paint.ANTI_ALIAS_FLAG);
            edge.setStyle(Paint.Style.STROKE);
            edge.setStrokeWidth(s * 0.04f);
            edge.setColor(0x9908080A);
            lc.drawCircle(c, c, c - s * 0.02f, edge);

            Paint innerRim = new Paint(Paint.ANTI_ALIAS_FLAG);
            innerRim.setStyle(Paint.Style.STROKE);
            innerRim.setStrokeWidth(2f);
            innerRim.setColor(0x4DFFFFFF);
            lc.drawCircle(c, c, c - s * 0.04f, innerRim);

            // Center brushed aluminum collar + spindle hole
            Paint hole = new Paint(Paint.ANTI_ALIAS_FLAG);
            hole.setColor(0x66000000);
            lc.drawCircle(c, c, s * 0.115f, hole);
            hole.setColor(0xFFE6E6EA);
            lc.drawCircle(c, c, s * 0.085f, hole);
            hole.setColor(0xFF0A0A0C);
            lc.drawCircle(c, c, s * 0.045f, hole);
            return out;
        } catch (Throwable t) {
            return null;
        }
    }

    private static PendingIntent openApp(Context ctx) {
        Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (launch == null) return null;
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return PendingIntent.getActivity(ctx, 8, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static void update(Context ctx) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SpotifreeTurntableWidget.class));
            if (ids == null || ids.length == 0) return;

            Bitmap cover = SpotifreeWidget.art(ctx);
            Bitmap backdrop = SpotifreeWidget.wideBackdrop(ctx);
            int card = SpotifreeWidget.currentCardColor();
            String[] song = SpotifreeWidget.song(ctx);
            String title = song[0];
            String artist = song[1];
            String lyrics = SpotifreeMediaService.lyricLine;
            boolean hasSong = title != null && !title.isEmpty();
            boolean playing = SpotifreeMediaService.playing;
            boolean live = SpotifreeMediaService.current != null && SpotifreeMediaPlugin.isAppRunning();
            boolean spinning = playing && live && hasSong;

            long durMs = SpotifreeMediaService.durationMs;
            long posMs = SpotifreeMediaService.positionMs;
            int progPermille = (durMs > 0) ? (int) Math.max(0L, Math.min(1000L, (posMs * 1000L) / durMs)) : 0;
            int progBucket = progPermille / 5;

            String sig = title + "|" + artist + "|" + (lyrics == null ? "" : lyrics) + "|" + spinning + "|" + playing + "|" + live + "|" + progBucket + "|" + durMs + "|" + (cover == null ? 0 : cover.hashCode()) + "|" + card;
            if (sig.equals(lastSig)) return;
            lastSig = sig;

            if (cover != labelFor) {
                labelBmp = buildLabel(cover);
                labelFor = cover;
            }
            Bitmap lbl = labelBmp;
            PendingIntent open = openApp(ctx);
            long safePos = Math.max(0L, durMs > 0 ? Math.min(posMs, durMs) : posMs);
            long chronoBase = SystemClock.elapsedRealtime() - safePos;
            String durText = SpotifreeWidget.formatDuration(durMs);

            for (int id : ids) {
                RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.spotifree_widget_turntable);
                v.setInt(R.id.widget_bg, "setColorFilter", card);
                if (backdrop != null) {
                    v.setImageViewBitmap(R.id.widget_bg_art, backdrop);
                    v.setViewVisibility(R.id.widget_bg_art, View.VISIBLE);
                } else {
                    v.setViewVisibility(R.id.widget_bg_art, View.GONE);
                }

                v.setTextViewText(R.id.widget_title, hasSong ? title : "Spotifree");
                v.setTextViewText(R.id.widget_artist, hasSong ? artist : "Toca para abrir");
                v.setTextViewText(R.id.widget_state, !hasSong ? "Tocadiscos" : spinning ? "Sonando ahora" : live ? "En pausa" : "Lo último que escuchaste");
                v.setViewVisibility(R.id.widget_live_ring, spinning ? View.VISIBLE : View.GONE);

                if (hasSong && lyrics != null && !lyrics.trim().isEmpty()) {
                    v.setViewVisibility(R.id.widget_lyrics, View.VISIBLE);
                    v.setTextViewText(R.id.widget_lyrics, "♫ " + lyrics.trim());
                    v.setBoolean(R.id.widget_lyrics, "setSelected", true);
                } else {
                    v.setViewVisibility(R.id.widget_lyrics, View.GONE);
                    v.setBoolean(R.id.widget_lyrics, "setSelected", false);
                }

                v.setProgressBar(R.id.widget_progress, 1000, hasSong ? progPermille : 0, false);
                if (hasSong && durMs > 0) {
                    v.setViewVisibility(R.id.widget_chronometer, View.VISIBLE);
                    v.setChronometer(R.id.widget_chronometer, chronoBase, null, spinning);
                    if (!durText.isEmpty()) {
                        v.setViewVisibility(R.id.widget_duration, View.VISIBLE);
                        v.setTextViewText(R.id.widget_duration, " / " + durText);
                    } else {
                        v.setViewVisibility(R.id.widget_duration, View.GONE);
                    }
                } else {
                    v.setViewVisibility(R.id.widget_chronometer, View.GONE);
                    v.setViewVisibility(R.id.widget_duration, View.GONE);
                }

                // Platter & glossy optical sheen spin smoothly at native launcher 60 FPS; center cover stays razor sharp
                v.setViewVisibility(R.id.tt_spin, spinning ? View.VISIBLE : View.GONE);
                v.setViewVisibility(R.id.tt_disc, spinning ? View.GONE : View.VISIBLE);
                v.setViewVisibility(R.id.tt_label_sheen, spinning ? View.VISIBLE : View.GONE);

                if (lbl != null) v.setImageViewBitmap(R.id.tt_label, lbl);
                else v.setImageViewResource(R.id.tt_label, R.drawable.spotifree_vinyl_label);
                v.setImageViewResource(R.id.tt_arm, spinning ? R.drawable.spotifree_tonearm_on : R.drawable.spotifree_tonearm_off);

                v.setImageViewResource(R.id.widget_play, playing ? R.drawable.ic_stat_pause : R.drawable.ic_stat_play);
                v.setInt(R.id.widget_play, "setColorFilter", Color.BLACK);
                v.setContentDescription(R.id.widget_play, playing ? "Pausar" : "Reproducir");
                v.setContentDescription(R.id.tt_deck, hasSong ? "Tocadiscos: " + title + (artist == null || artist.isEmpty() ? "" : ", " + artist) : "Tocadiscos de Spotifree");

                if (open != null) {
                    v.setOnClickPendingIntent(R.id.tt_deck, open);
                    v.setOnClickPendingIntent(R.id.widget_text, open);
                }
                if (live) {
                    v.setOnClickPendingIntent(R.id.widget_play,
                        MediaButtonReceiver.buildMediaButtonPendingIntent(ctx, playing ? PlaybackStateCompat.ACTION_PAUSE : PlaybackStateCompat.ACTION_PLAY));
                    v.setOnClickPendingIntent(R.id.widget_prev,
                        MediaButtonReceiver.buildMediaButtonPendingIntent(ctx, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS));
                    v.setOnClickPendingIntent(R.id.widget_next,
                        MediaButtonReceiver.buildMediaButtonPendingIntent(ctx, PlaybackStateCompat.ACTION_SKIP_TO_NEXT));
                } else if (open != null) {
                    v.setOnClickPendingIntent(R.id.widget_play, open);
                    v.setOnClickPendingIntent(R.id.widget_prev, open);
                    v.setOnClickPendingIntent(R.id.widget_next, open);
                }
                mgr.updateAppWidget(id, v);
            }
        } catch (Throwable ignored) {}
    }
}
