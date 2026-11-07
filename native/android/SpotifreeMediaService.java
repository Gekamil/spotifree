package com.spotifree.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.support.v4.media.MediaBrowserCompat;
import android.support.v4.media.MediaDescriptionCompat;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.MediaBrowserServiceCompat;
import androidx.media.session.MediaButtonReceiver;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Media session of the app: Android Auto browsing (your playlists in the car), the playback
 * notification, lock screen and Bluetooth/car controls. Playback itself happens in the app's
 * web layer; this service mirrors its state and forwards the user's commands to it through
 * SpotifreeMediaPlugin ("command" events).
 *
 * Browse tree:  root -> [lib "Tu biblioteca", queue "A continuación"]
 *               lib -> pl:<playlistId> (browsable) -> tr:<playlistId>:<index> (playable)
 *               queue -> q:<index> (playable)
 */
public class SpotifreeMediaService extends MediaBrowserServiceCompat {

    public static final String ACTION_UPDATE = "com.spotifree.music.MEDIA_UPDATE";
    private static final String CHANNEL_ID = "spotifree_playback";
    private static final int NOTIF_ID = 4711;
    private static final String PREFS = "spotifree_media";

    // State pushed by the web layer (see SpotifreeMediaPlugin)
    static volatile JSONArray library = null;     // [{id,name,subtitle,tracks:[{id,title,artist}]}]
    static volatile JSONArray queue = new JSONArray(); // [{id,title,artist}]
    static volatile String title = "";
    static volatile String artist = "";
    static volatile String album = "";
    static volatile String artworkUrl = "";
    static volatile String lyricLine = "";
    static volatile long durationMs = 0;
    static volatile long positionMs = 0;
    static volatile boolean playing = false;
    static volatile String language = "es";

    @Nullable static SpotifreeMediaService current;

    private MediaSessionCompat session;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private String loadedArtUrl = null;
    private Bitmap art = null;
    private boolean foreground = false;

    private boolean en() { return "en".equals(language); }

    static void saveLibrary(Context ctx, JSONArray lib) {
        library = lib;
        try {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("library", lib.toString()).apply();
        } catch (Exception ignored) {}
    }

    private void loadSavedLibrary() {
        if (library != null) return;
        try {
            SharedPreferences p = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String raw = p.getString("library", null);
            if (raw != null) library = new JSONArray(raw);
        } catch (Exception ignored) {}
    }

    @Override
    public void onCreate() {
        super.onCreate();
        current = this;
        loadSavedLibrary();
        session = new MediaSessionCompat(this, "Spotifree");
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) {
            session.setSessionActivity(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { SpotifreeMediaPlugin.emit("play", null); }
            @Override public void onPause() { SpotifreeMediaPlugin.emit("pause", null); }
            @Override public void onStop() { SpotifreeMediaPlugin.emit("pause", null); }
            @Override public void onSkipToNext() { SpotifreeMediaPlugin.emit("next", null); }
            @Override public void onSkipToPrevious() { SpotifreeMediaPlugin.emit("previous", null); }
            @Override public void onSeekTo(long pos) {
                JSONObject o = new JSONObject();
                try { o.put("positionMs", pos); } catch (Exception ignored) {}
                SpotifreeMediaPlugin.emit("seek", o);
            }
            @Override public void onPlayFromMediaId(String mediaId, Bundle extras) {
                JSONObject o = new JSONObject();
                try { o.put("mediaId", mediaId); } catch (Exception ignored) {}
                boolean delivered = SpotifreeMediaPlugin.emit("playFromMediaId", o);
                if (!delivered) {
                    // The app UI is not running: open it, the command is delivered when it loads
                    SpotifreeMediaPlugin.setPending("playFromMediaId", o);
                    openApp();
                }
            }
            @Override public void onPlayFromSearch(String query, Bundle extras) {
                JSONObject o = new JSONObject();
                try { o.put("query", query == null ? "" : query); } catch (Exception ignored) {}
                if (!SpotifreeMediaPlugin.emit("playFromSearch", o)) {
                    SpotifreeMediaPlugin.setPending("playFromSearch", o);
                    openApp();
                }
            }
        });
        session.setActive(true);
        setSessionToken(session.getSessionToken());
        createChannel();
        refresh();
    }

    private void openApp() {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                startActivity(launch);
            }
        } catch (Exception ignored) {
            setError(en() ? "Open Spotifree on your phone" : "Abre Spotifree en el móvil");
        }
    }

    private void setError(String msg) {
        PlaybackStateCompat st = new PlaybackStateCompat.Builder()
            .setState(PlaybackStateCompat.STATE_ERROR, 0, 0f)
            .setErrorMessage(PlaybackStateCompat.ERROR_CODE_APP_ERROR, msg)
            .build();
        session.setPlaybackState(st);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && Intent.ACTION_MEDIA_BUTTON.equals(intent.getAction())) {
            MediaButtonReceiver.handleIntent(session, intent);
        }
        refresh();
        return START_NOT_STICKY;
    }

    /** Re-reads the static state into the session, the notification and the foreground status. */
    void refresh() {
        if (session == null) return;
        String shownArtist = artist;
        String shownAlbum = album;
        if (lyricLine != null && !lyricLine.trim().isEmpty()) {
            // Car screens and Bluetooth stereos show title + artist: the lyric line goes there
            shownArtist = "♪ " + lyricLine.trim();
            shownAlbum = artist;
        }
        MediaMetadataCompat.Builder mb = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, shownArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, shownArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, shownAlbum)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);
        if (art != null && artworkUrl != null && artworkUrl.equals(loadedArtUrl)) {
            mb.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art);
        }
        session.setMetadata(mb.build());

        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            | PlaybackStateCompat.ACTION_SEEK_TO | PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID
            | PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH | PlaybackStateCompat.ACTION_STOP;
        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                positionMs, playing ? 1f : 0f, SystemClock.elapsedRealtime())
            .build());

        maybeLoadArt();
        updateNotification();
    }

    private void maybeLoadArt() {
        final String url = artworkUrl;
        if (url == null || url.isEmpty() || url.equals(loadedArtUrl)) return;
        loadedArtUrl = url;
        art = null;
        io.execute(() -> {
            Bitmap bmp = null;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(6000);
                c.setReadTimeout(8000);
                try (InputStream in = c.getInputStream()) {
                    bmp = BitmapFactory.decodeStream(in);
                }
            } catch (Exception ignored) {}
            final Bitmap result = bmp;
            main.post(() -> {
                if (url.equals(loadedArtUrl)) {
                    art = result;
                    refresh();
                }
            });
        });
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, en() ? "Playback" : "Reproducción", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification() {
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_spotifree)
            .setContentTitle(title == null || title.isEmpty() ? "Spotifree" : title)
            .setContentText(lyricLine != null && !lyricLine.trim().isEmpty() ? "♪ " + lyricLine.trim() : artist)
            .setSubText(lyricLine != null && !lyricLine.trim().isEmpty() ? artist : null)
            .setLargeIcon(art)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(session.getController().getSessionActivity())
            .setDeleteIntent(MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_STOP))
            .addAction(new NotificationCompat.Action(R.drawable.ic_stat_prev, en() ? "Previous" : "Anterior",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)))
            .addAction(playing
                ? new NotificationCompat.Action(R.drawable.ic_stat_pause, en() ? "Pause" : "Pausar",
                    MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PAUSE))
                : new NotificationCompat.Action(R.drawable.ic_stat_play, en() ? "Play" : "Reproducir",
                    MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PLAY)))
            .addAction(new NotificationCompat.Action(R.drawable.ic_stat_next, en() ? "Next" : "Siguiente",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_NEXT)))
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(session.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));
        return b.build();
    }

    private void updateNotification() {
        if (title == null || title.isEmpty()) return;
        Notification n = buildNotification();
        if (playing) {
            try {
                int type = Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
                ServiceCompat.startForeground(this, NOTIF_ID, n, type);
                foreground = true;
            } catch (Exception e) {
                // Not allowed to go foreground right now (app in background on Android 12+): plain notification
                NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
                if (nm != null) nm.notify(NOTIF_ID, n);
            }
        } else {
            if (foreground) {
                ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH);
                foreground = false;
            }
            NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(NOTIF_ID, n);
        }
    }

    // ------------------------------------------------------------------ browsing (Android Auto)

    @Nullable
    @Override
    public BrowserRoot onGetRoot(@NonNull String clientPackageName, int clientUid, @Nullable Bundle rootHints) {
        loadSavedLibrary();
        Bundle extras = new Bundle();
        extras.putBoolean("android.media.browse.CONTENT_STYLE_SUPPORTED", true);
        extras.putInt("android.media.browse.CONTENT_STYLE_BROWSABLE_HINT", 2); // grid for playlists
        extras.putInt("android.media.browse.CONTENT_STYLE_PLAYABLE_HINT", 1);  // list for songs
        extras.putBoolean("android.media.browse.SEARCH_SUPPORTED", true);
        return new BrowserRoot("root", extras);
    }

    private static MediaBrowserCompat.MediaItem item(String id, String t, String sub, boolean browsable) {
        MediaDescriptionCompat d = new MediaDescriptionCompat.Builder().setMediaId(id).setTitle(t).setSubtitle(sub).build();
        return new MediaBrowserCompat.MediaItem(d, browsable ? MediaBrowserCompat.MediaItem.FLAG_BROWSABLE : MediaBrowserCompat.MediaItem.FLAG_PLAYABLE);
    }

    @Override
    public void onLoadChildren(@NonNull String parentId, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        loadSavedLibrary();
        List<MediaBrowserCompat.MediaItem> out = new ArrayList<>();
        try {
            if ("root".equals(parentId)) {
                out.add(item("lib", en() ? "Your Library" : "Tu biblioteca", null, true));
                out.add(item("queue", en() ? "Up next" : "A continuación", null, true));
            } else if ("lib".equals(parentId)) {
                JSONArray lib = library;
                if (lib != null) {
                    for (int i = 0; i < lib.length(); i++) {
                        JSONObject p = lib.getJSONObject(i);
                        out.add(item("pl:" + p.optString("id"), p.optString("name"), p.optString("subtitle", null), true));
                    }
                }
            } else if (parentId.startsWith("pl:")) {
                String plId = parentId.substring(3);
                JSONArray lib = library;
                if (lib != null) {
                    for (int i = 0; i < lib.length(); i++) {
                        JSONObject p = lib.getJSONObject(i);
                        if (!plId.equals(p.optString("id"))) continue;
                        JSONArray tracks = p.optJSONArray("tracks");
                        if (tracks == null) break;
                        for (int j = 0; j < tracks.length(); j++) {
                            JSONObject t = tracks.getJSONObject(j);
                            out.add(item("tr:" + plId + ":" + j, t.optString("title"), t.optString("artist"), false));
                        }
                        break;
                    }
                }
            } else if ("queue".equals(parentId)) {
                JSONArray q = queue;
                for (int j = 0; q != null && j < q.length(); j++) {
                    JSONObject t = q.getJSONObject(j);
                    out.add(item("q:" + j, t.optString("title"), t.optString("artist"), false));
                }
            }
        } catch (Exception ignored) {}
        result.sendResult(out);
    }

    @Override
    public void onSearch(@NonNull String query, Bundle extras, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        loadSavedLibrary();
        List<MediaBrowserCompat.MediaItem> out = new ArrayList<>();
        String q = query.toLowerCase();
        try {
            JSONArray lib = library;
            for (int i = 0; lib != null && i < lib.length() && out.size() < 40; i++) {
                JSONObject p = lib.getJSONObject(i);
                if (p.optString("name").toLowerCase().contains(q)) {
                    out.add(item("pl:" + p.optString("id"), p.optString("name"), p.optString("subtitle", null), true));
                }
                JSONArray tracks = p.optJSONArray("tracks");
                for (int j = 0; tracks != null && j < tracks.length() && out.size() < 40; j++) {
                    JSONObject t = tracks.getJSONObject(j);
                    if ((t.optString("title") + " " + t.optString("artist")).toLowerCase().contains(q)) {
                        out.add(item("tr:" + p.optString("id") + ":" + j, t.optString("title"), t.optString("artist"), false));
                    }
                }
            }
        } catch (Exception ignored) {}
        result.sendResult(out);
    }

    /** Tells Android Auto that the library / queue changed */
    void notifyLibraryChanged() {
        notifyChildrenChanged("lib");
        notifyChildrenChanged("queue");
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        // The app was swiped away: playback (in the web layer) is gone too
        playing = false;
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        foreground = false;
        stopSelf();
    }

    @Override
    public void onDestroy() {
        current = null;
        if (session != null) {
            session.setActive(false);
            session.release();
        }
        io.shutdownNow();
        super.onDestroy();
    }
}
