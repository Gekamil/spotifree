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
import android.support.v4.media.session.PlaybackStateCompat;
import android.view.View;
import android.widget.RemoteViews;

import androidx.media.session.MediaButtonReceiver;

/**
 * "Tocadiscos" home-screen widget: a turntable whose record turns while the song plays.
 *  - The record itself turns smoothly: an indeterminate ProgressBar animating a rotate drawable
 *    (the launcher runs it, so it costs the app nothing).
 *  - Its label is the song's cover, drawn here in 16 angles and shown in turn by a ViewFlipper
 *    (one turn every 1.8 s, like a 33 rpm record). Widgets can't rotate an image any other way.
 *  - The tonearm sits on the record while playing and goes back to its rest when paused.
 * Song, cover and colour come from SpotifreeWidget / SpotifreeMediaService, which call update().
 */
public class SpotifreeTurntableWidget extends AppWidgetProvider {

    private static final int FRAMES = 16;
    private static final int LABEL_PX = 112;
    /** Same black as the record (spotifree_vinyl_disc.xml), so the label frames' corners blend in */
    private static final int DISC_BLACK = 0xFF111111;
    private static final int[] FRAME_IDS = {
        R.id.tt_f0, R.id.tt_f1, R.id.tt_f2, R.id.tt_f3, R.id.tt_f4, R.id.tt_f5, R.id.tt_f6, R.id.tt_f7,
        R.id.tt_f8, R.id.tt_f9, R.id.tt_f10, R.id.tt_f11, R.id.tt_f12, R.id.tt_f13, R.id.tt_f14, R.id.tt_f15,
    };

    private static volatile Bitmap framesFor = null;
    private static volatile Bitmap[] frames = null;
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

    /** The cover as a round record label, in FRAMES angles (opaque, on the record's black) */
    private static Bitmap[] buildFrames(Bitmap cover) {
        if (cover == null) return null;
        try {
            int s = LABEL_PX;
            float c = s / 2f;
            Bitmap scaled = Bitmap.createScaledBitmap(cover, s, s, true);
            Bitmap label = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888);
            Canvas lc = new Canvas(label);
            Paint art = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
            art.setShader(new BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
            lc.drawCircle(c, c, c - 0.5f, art);
            // A thin darker edge and the spindle hole, like a real label
            Paint edge = new Paint(Paint.ANTI_ALIAS_FLAG);
            edge.setStyle(Paint.Style.STROKE);
            edge.setStrokeWidth(s * 0.035f);
            edge.setColor(0x66000000);
            lc.drawCircle(c, c, c - s * 0.02f, edge);
            Paint hole = new Paint(Paint.ANTI_ALIAS_FLAG);
            hole.setColor(0xFFDADADA);
            lc.drawCircle(c, c, s * 0.065f, hole);
            hole.setColor(0xFF0B0B0B);
            lc.drawCircle(c, c, s * 0.04f, hole);

            Bitmap[] out = new Bitmap[FRAMES];
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
            for (int i = 0; i < FRAMES; i++) {
                // RGB_565: half the memory (the widget has to carry all the frames)
                Bitmap f = Bitmap.createBitmap(s, s, Bitmap.Config.RGB_565);
                Canvas fc = new Canvas(f);
                fc.drawColor(DISC_BLACK);
                fc.save();
                fc.rotate(i * 360f / FRAMES, c, c);
                fc.drawBitmap(label, 0, 0, p);
                fc.restore();
                out[i] = f;
            }
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

    /** Redraws every turntable widget (cheap when nothing changed) */
    static void update(Context ctx) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SpotifreeTurntableWidget.class));
            if (ids == null || ids.length == 0) return;

            Bitmap cover = SpotifreeWidget.art(ctx);
            int card = SpotifreeWidget.currentCardColor();
            String[] song = SpotifreeWidget.song(ctx);
            String title = song[0];
            String artist = song[1];
            boolean hasSong = title != null && !title.isEmpty();
            boolean playing = SpotifreeMediaService.playing;
            boolean live = SpotifreeMediaService.current != null && SpotifreeMediaPlugin.isAppRunning();
            boolean spinning = playing && live && hasSong;

            String sig = title + "|" + artist + "|" + spinning + "|" + live + "|" + (cover == null ? 0 : cover.hashCode()) + "|" + card;
            if (sig.equals(lastSig)) return;
            lastSig = sig;

            if (cover != framesFor) {
                frames = buildFrames(cover);
                framesFor = cover;
            }
            Bitmap[] f = frames;
            PendingIntent open = openApp(ctx);

            for (int id : ids) {
                RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.spotifree_widget_turntable);
                v.setInt(R.id.widget_bg, "setColorFilter", card);
                v.setTextViewText(R.id.widget_title, hasSong ? title : "Spotifree");
                v.setTextViewText(R.id.widget_artist, hasSong ? artist : "Toca para abrir");
                v.setTextViewText(R.id.widget_state, !hasSong ? "Tocadiscos" : spinning ? "Sonando ahora" : live ? "En pausa" : "Lo último que escuchaste");

                // Record: turning while it plays, still when paused
                v.setViewVisibility(R.id.tt_spin, spinning ? View.VISIBLE : View.GONE);
                v.setViewVisibility(R.id.tt_disc, spinning ? View.GONE : View.VISIBLE);
                boolean turningLabel = spinning && f != null;
                v.setViewVisibility(R.id.tt_flipper, turningLabel ? View.VISIBLE : View.GONE);
                v.setViewVisibility(R.id.tt_label, turningLabel ? View.GONE : View.VISIBLE);
                if (turningLabel) {
                    for (int i = 0; i < FRAME_IDS.length && i < f.length; i++) v.setImageViewBitmap(FRAME_IDS[i], f[i]);
                }
                if (f != null && f.length > 0) v.setImageViewBitmap(R.id.tt_label, f[0]);
                else v.setImageViewResource(R.id.tt_label, R.drawable.spotifree_vinyl_label);
                v.setImageViewResource(R.id.tt_arm, spinning ? R.drawable.spotifree_tonearm_on : R.drawable.spotifree_tonearm_off);

                v.setImageViewResource(R.id.widget_play, playing ? R.drawable.ic_stat_pause : R.drawable.ic_stat_play);
                v.setInt(R.id.widget_play, "setColorFilter", Color.BLACK);
                v.setContentDescription(R.id.widget_play, playing ? "Pausar" : "Reproducir");

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
                    // App closed: the buttons open it (music needs the app)
                    v.setOnClickPendingIntent(R.id.widget_play, open);
                    v.setOnClickPendingIntent(R.id.widget_prev, open);
                    v.setOnClickPendingIntent(R.id.widget_next, open);
                }
                mgr.updateAppWidget(id, v);
            }
        } catch (Throwable ignored) {}
    }
}
