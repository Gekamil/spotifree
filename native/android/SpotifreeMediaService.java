package com.spotifree.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.PowerManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
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

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Media session of the app: Android Auto (Spotify-like car UI), playback notification, lock
 * screen and Bluetooth/car controls. Playback happens in the app's web layer; this service
 * mirrors its state and forwards the user's commands to it (SpotifreeMediaPlugin "command"
 * events). Everything shown in the car has its cover (SpotifreeArtProvider).
 *
 * Browse tree (tabs):
 *   home    "Inicio"           sections (recent, favourites, shelves) -> pl:<id>
 *   lib     "Tu biblioteca"    Liked Songs + playlists                 -> pl:<id>
 *   explore "Explorar"         categories (same as the phone's)        -> ex:<id> -> pl:<id>
 *   pl:<id> -> shuf:<id> ("Reproducir en aleatorio") + tr:<id>:<index>
 *   search  -> st:<requestId>:<index> songs, pl:<id> playlists
 *   The queue ("A continuación") is the session queue: the queue button of the car's player.
 *
 * Declared once per app icon (the Icon* subclasses below, see scripts/setup-android-native.mjs):
 * Android Auto shows the icon of the media service, and only the one matching the icon chosen
 * in Ajustes is enabled. activeClass() is the one to start.
 */
public class SpotifreeMediaService extends MediaBrowserServiceCompat {

    // Keep in sync with ICON_IDS in SpotifreeAppIconPlugin.java / setup-android-native.mjs
    public static class IconDefault extends SpotifreeMediaService {}
    public static class IconDisco2026 extends SpotifreeMediaService {}
    public static class IconAnniversary20 extends SpotifreeMediaService {}
    public static class IconBlack2024 extends SpotifreeMediaService {}
    public static class IconClassic2015 extends SpotifreeMediaService {}
    public static class IconRetro2013 extends SpotifreeMediaService {}
    public static class IconOriginal2008 extends SpotifreeMediaService {}

    private static final Class<?>[] VARIANTS = {
        IconDefault.class, IconDisco2026.class, IconAnniversary20.class, IconBlack2024.class,
        IconClassic2015.class, IconRetro2013.class, IconOriginal2008.class
    };

    private static Class<?> variantFor(String iconId) {
        String suffix = "Icon" + SpotifreeAppIconPlugin.aliasSuffix(iconId == null ? "default" : iconId);
        for (Class<?> c : VARIANTS) if (c.getSimpleName().equals(suffix)) return c;
        return IconDefault.class;
    }

    /** The enabled media service (the one for the current app icon) */
    static Class<?> activeClass(Context ctx) {
        PackageManager pm = ctx.getPackageManager();
        for (Class<?> c : VARIANTS) {
            try {
                int st = pm.getComponentEnabledSetting(new ComponentName(ctx, c));
                if (st == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) return c;
            } catch (Exception ignored) {}
        }
        return IconDefault.class; // enabled in the manifest
    }

    /** The app icon changed: the car shows the media service with that icon */
    static void useIcon(Context ctx, String iconId) {
        Class<?> want = variantFor(iconId);
        if (want == activeClass(ctx)) return;
        PackageManager pm = ctx.getPackageManager();
        try {
            pm.setComponentEnabledSetting(new ComponentName(ctx, want),
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
            // Then the others: there is always exactly one (Android Auto and media buttons find it)
            for (Class<?> c : VARIANTS) {
                if (c == want) continue;
                pm.setComponentEnabledSetting(new ComponentName(ctx, c),
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            }
        } catch (Exception ignored) {}
        // The old one is stopped by the system: bring the notification / car session back
        if (playing || (title != null && !title.isEmpty())) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    Intent i = new Intent(ctx, activeClass(ctx)).setAction(ACTION_UPDATE);
                    if (playing) androidx.core.content.ContextCompat.startForegroundService(ctx, i);
                    else ctx.startService(i);
                } catch (Exception ignored) {}
            }, 800);
        }
    }

    /** Keep the page running as if on screen: while playing and for 10 min after a pause */
    static volatile long lastPlayingAt = 0;
    static final long KEEP_ALIVE_MS = 10 * 60 * 1000L;
    static boolean keepAlive() {
        return playing || (lastPlayingAt > 0 && SystemClock.elapsedRealtime() - lastPlayingAt < KEEP_ALIVE_MS);
    }

    public static final String ACTION_UPDATE = "com.spotifree.music.MEDIA_UPDATE";
    private static final String CHANNEL_ID = "spotifree_playback";
    private static final int NOTIF_ID = 4711;
    private static final String PREFS = "spotifree_media";
    private static final String GROUP_TITLE = "android.media.browse.CONTENT_STYLE_GROUP_TITLE_HINT";
    private static final String BROWSABLE_HINT = "android.media.browse.CONTENT_STYLE_BROWSABLE_HINT";
    private static final String PLAYABLE_HINT = "android.media.browse.CONTENT_STYLE_PLAYABLE_HINT";
    private static final int STYLE_LIST = 1;
    private static final int STYLE_GRID = 2;

    static final String ACT_LIKE = "toggleLike";
    static final String ACT_SHUFFLE = "toggleShuffle";
    static final String ACT_REPEAT = "cycleRepeat";

    // Android Auto "browse custom actions" (buttons on each song of a list) and other extras
    // (androidx.media.utils.MediaConstants)
    private static final String CBA_ROOT_LIST = "androidx.media.utils.extras.CUSTOM_BROWSER_ACTION_ROOT_LIST";
    private static final String CBA_ID = "androidx.media.utils.extras.KEY_CUSTOM_BROWSER_ACTION_ID";
    private static final String CBA_LABEL = "androidx.media.utils.extras.KEY_CUSTOM_BROWSER_ACTION_LABEL";
    private static final String CBA_ICON = "androidx.media.utils.extras.KEY_CUSTOM_BROWSER_ACTION_ICON_URI";
    private static final String CBA_ITEM_IDS = "androidx.media.utils.extras.KEY_CUSTOM_BROWSER_ACTION_ID_LIST";
    private static final String CBA_MEDIA_ID = "androidx.media.utils.extras.KEY_CUSTOM_BROWSER_ACTION_MEDIA_ITEM_ID";
    private static final String CBA_RESULT_MESSAGE = "androidx.media.utils.extras.KEY_CUSTOM_BROWSER_ACTION_RESULT_MESSAGE";
    private static final String IS_EXPLICIT = "android.media.IS_EXPLICIT";
    private static final String ERROR_ACTION_LABEL = "android.media.extras.ERROR_RESOLUTION_ACTION_LABEL";
    private static final String ERROR_ACTION_INTENT = "android.media.extras.ERROR_RESOLUTION_ACTION_INTENT";
    static final String CBA_QUEUE = "spotifree.addToQueue";
    static final String CBA_LIKE = "spotifree.likeItem";
    static final String CBA_SHUFFLE = "spotifree.shufflePlaylist";

    static volatile JSONArray explore = null;   // [{id,name,image}] genre tiles
    static final Map<String, JSONArray> categoryItems = new ConcurrentHashMap<>(); // ex id -> playlists
    static volatile boolean explicit = false;

    // ---- state pushed by the web layer (SpotifreeMediaPlugin)
    static volatile JSONArray library = null;  // [{id,name,subtitle,image}]
    static volatile JSONArray home = null;     // [{title, items:[{id,name,subtitle,image}]}]
    static final Map<String, JSONArray> playlistTracks = new ConcurrentHashMap<>(); // id -> [{id,title,artist,image}]
    static volatile JSONArray queue = new JSONArray();
    static volatile String trackId = "";
    static volatile String title = "";
    static volatile String artist = "";
    static volatile String album = "";
    static volatile String artworkUrl = "";
    static volatile String lyricLine = "";
    static volatile long durationMs = 0;
    static volatile long positionMs = 0;
    static volatile boolean playing = false;
    static volatile boolean liked = false;
    static volatile boolean shuffle = false;
    static volatile String repeat = "off";
    static volatile boolean loggedIn = true;
    static volatile String language = "es";

    @Nullable static SpotifreeMediaService current;

    private MediaSessionCompat session;
    private final ExecutorService io = Executors.newFixedThreadPool(2);
    private final Handler main = new Handler(Looper.getMainLooper());
    private String loadedArtUrl = null;
    private Bitmap art = null;
    private boolean foreground = false;
    private final Map<String, List<Result<List<MediaBrowserCompat.MediaItem>>>> pendingChildren = new ConcurrentHashMap<>();
    private final Map<String, Result<List<MediaBrowserCompat.MediaItem>>> pendingSearch = new ConcurrentHashMap<>();
    private int searchSeq = 0;

    // Screen off: keep the CPU and Wi-Fi awake while music plays (and between songs)
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private final Runnable releaseLocks = this::releaseLocksNow;

    @SuppressWarnings("deprecation")
    private void holdLocks(boolean on) {
        if (!on) {
            // A pause, or the gap between two songs: release a bit later
            main.removeCallbacks(releaseLocks);
            if ((wakeLock != null && wakeLock.isHeld()) || (wifiLock != null && wifiLock.isHeld())) {
                main.postDelayed(releaseLocks, 3 * 60 * 1000L);
            }
            return;
        }
        main.removeCallbacks(releaseLocks);
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Spotifree:playback");
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null) wakeLock.acquire(6 * 60 * 60 * 1000L);
        } catch (Exception ignored) {}
        try {
            if (wifiLock == null) {
                WifiManager wm = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
                if (wm != null) {
                    wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "Spotifree:stream");
                    wifiLock.setReferenceCounted(false);
                }
            }
            if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
        } catch (Exception ignored) {}
    }

    private void releaseLocksNow() {
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
        try { if (wifiLock != null && wifiLock.isHeld()) wifiLock.release(); } catch (Exception ignored) {}
    }

    private boolean en() { return "en".equals(language); }
    private String tr(String es, String enText) { return en() ? enText : es; }

    // ------------------------------------------------------------------ persistence

    static void saveLibrary(Context ctx, JSONArray lib, JSONArray homeSections) {
        library = lib;
        if (homeSections != null) home = homeSections;
        try {
            SharedPreferences.Editor e = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
            e.putString("library", lib.toString());
            if (homeSections != null) e.putString("home", homeSections.toString());
            e.apply();
        } catch (Exception ignored) {}
    }

    private void loadSaved() {
        try {
            SharedPreferences p = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            if (library == null) {
                String raw = p.getString("library", null);
                if (raw != null) library = new JSONArray(raw);
            }
            if (home == null) {
                String raw = p.getString("home", null);
                if (raw != null) home = new JSONArray(raw);
            }
        } catch (Exception ignored) {}
    }

    // ------------------------------------------------------------------ lifecycle

    @Override
    public void onCreate() {
        super.onCreate();
        current = this;
        loadSaved();
        session = new MediaSessionCompat(this, "Spotifree");
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) {
            session.setSessionActivity(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { send("play", null); }
            @Override public void onPause() { send("pause", null); }
            @Override public void onStop() { send("pause", null); }
            @Override public void onSkipToNext() { send("next", null); }
            @Override public void onSkipToPrevious() { send("previous", null); }
            @Override public void onSeekTo(long pos) { send("seek", obj("positionMs", pos)); }
            @Override public void onSkipToQueueItem(long id) { send("playQueueIndex", obj("index", id)); }
            @Override public void onSetShuffleMode(int mode) { send(ACT_SHUFFLE, null); }
            @Override public void onSetRepeatMode(int mode) { send(ACT_REPEAT, null); }
            // "toggleShuffle:on" -> "toggleShuffle" (one id per state, see refresh())
            @Override public void onCustomAction(String action, Bundle extras) {
                int cut = action == null ? -1 : action.indexOf(':');
                send(cut > 0 ? action.substring(0, cut) : action, null);
            }
            @Override public void onPlayFromMediaId(String mediaId, Bundle extras) {
                if ("noop".equals(mediaId)) { openApp(); return; }
                sendOrOpen("playFromMediaId", obj("mediaId", mediaId));
            }
            @Override public void onPlayFromSearch(String query, Bundle extras) {
                sendOrOpen("playFromSearch", obj("query", query == null ? "" : query));
            }
            @Override public void onPrepare() { /* the app keeps the session ready */ }
        });
        session.setActive(true);
        setSessionToken(session.getSessionToken());
        createChannel();
        refresh();
    }

    private static JSONObject obj(String k, Object v) {
        JSONObject o = new JSONObject();
        try { o.put(k, v); } catch (Exception ignored) {}
        return o;
    }

    private void send(String action, JSONObject data) {
        if (!SpotifreeMediaPlugin.emit(action, data)) setError(tr("Abre Spotifree en el móvil", "Open Spotifree on your phone"));
    }

    private void sendOrOpen(String action, JSONObject data) {
        if (!SpotifreeMediaPlugin.emit(action, data)) {
            // App UI not running: open it, the command is delivered when it loads
            SpotifreeMediaPlugin.setPending(action, data);
            openApp();
        }
    }

    private void openApp() {
        try {
            Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
                startActivity(launch);
                return;
            }
        } catch (Exception ignored) {}
        setError(tr("Abre Spotifree en el móvil", "Open Spotifree on your phone"));
    }

    /** Error on the car screen, with an "Abrir Spotifree" button that opens the app on the phone */
    private void setError(String msg) {
        setError(msg, PlaybackStateCompat.ERROR_CODE_APP_ERROR);
    }

    private void setError(String msg, int code) {
        Bundle extras = new Bundle();
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) {
            extras.putString(ERROR_ACTION_LABEL, tr("Abrir Spotifree", "Open Spotifree"));
            extras.putParcelable(ERROR_ACTION_INTENT, PendingIntent.getActivity(this, 1, launch,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID | PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH)
            .setState(PlaybackStateCompat.STATE_ERROR, 0, 0f)
            .setErrorMessage(code, msg)
            .setExtras(extras)
            .build());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && Intent.ACTION_MEDIA_BUTTON.equals(intent.getAction())) {
            MediaButtonReceiver.handleIntent(session, intent);
        }
        refresh();
        return START_NOT_STICKY;
    }

    // ------------------------------------------------------------------ now playing

    /** Re-reads the static state into the session, the notification and the foreground status. */
    void refresh() {
        if (session == null) return;
        if (!loggedIn && (title == null || title.isEmpty())) {
            setError(tr("Inicia sesión en Spotifree en el móvil", "Sign in to Spotifree on your phone"),
                PlaybackStateCompat.ERROR_CODE_AUTHENTICATION_EXPIRED);
            return;
        }
        boolean hasLyric = lyricLine != null && !lyricLine.trim().isEmpty();
        // Car screens / Bluetooth stereos show title + artist: the lyric line goes in the artist slot
        String shownArtist = hasLyric ? "♪ " + lyricLine.trim() : artist;
        String shownAlbum = hasLyric ? artist : album;
        Uri artUri = SpotifreeArtProvider.uriFor(this, artworkUrl);

        MediaMetadataCompat.Builder mb = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_MEDIA_ID, trackId)
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, shownArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, shownArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, shownAlbum)
            .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, shownAlbum)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs)
            .putLong(IS_EXPLICIT, explicit ? 1L : 0L);
        if (artUri != null) {
            mb.putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, artUri.toString());
            mb.putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI, artUri.toString());
        }
        if (art != null && artworkUrl != null && artworkUrl.equals(loadedArtUrl)) {
            mb.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art);
        }
        session.setMetadata(mb.build());

        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            | PlaybackStateCompat.ACTION_SEEK_TO | PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID
            | PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH | PlaybackStateCompat.ACTION_SKIP_TO_QUEUE_ITEM
            | PlaybackStateCompat.ACTION_SET_SHUFFLE_MODE | PlaybackStateCompat.ACTION_SET_REPEAT_MODE
            | PlaybackStateCompat.ACTION_STOP;

        PlaybackStateCompat.Builder sb = new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                positionMs, playing ? 1f : 0f, SystemClock.elapsedRealtime())
            .setActiveQueueItemId(-1);
        // Spotify-style buttons on the car's "now playing" screen. Each state has its own action
        // id: Android Auto keeps the icon of an id it already knows, so with a single id the
        // shuffle / repeat / like buttons did not show the phone's state.
        sb.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(ACT_LIKE + (liked ? ":on" : ":off"),
            liked ? tr("Quitar de Me gusta", "Remove from Liked Songs") : tr("Me gusta", "Like"),
            liked ? R.drawable.ic_car_heart_filled : R.drawable.ic_car_heart).build());
        sb.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(ACT_SHUFFLE + (shuffle ? ":on" : ":off"),
            shuffle ? tr("Desactivar aleatorio", "Shuffle off") : tr("Aleatorio", "Shuffle"),
            shuffle ? R.drawable.ic_car_shuffle_on : R.drawable.ic_car_shuffle).build());
        sb.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(ACT_REPEAT + ":" + repeat,
            "one".equals(repeat) ? tr("Repetir una", "Repeat one") : "all".equals(repeat) ? tr("Repetir todo", "Repeat all") : tr("Repetir", "Repeat"),
            "one".equals(repeat) ? R.drawable.ic_car_repeat_one : "all".equals(repeat) ? R.drawable.ic_car_repeat_on : R.drawable.ic_car_repeat).build());
        session.setPlaybackState(sb.build());
        session.setShuffleMode(shuffle ? PlaybackStateCompat.SHUFFLE_MODE_ALL : PlaybackStateCompat.SHUFFLE_MODE_NONE);
        session.setRepeatMode("one".equals(repeat) ? PlaybackStateCompat.REPEAT_MODE_ONE
            : "all".equals(repeat) ? PlaybackStateCompat.REPEAT_MODE_ALL : PlaybackStateCompat.REPEAT_MODE_NONE);

        holdLocks(playing);
        maybeLoadArt();
        updateNotification();
    }

    /** Upcoming songs as the session queue (the car's queue button) */
    void refreshQueue() {
        if (session == null) return;
        List<MediaSessionCompat.QueueItem> items = new ArrayList<>();
        JSONArray q = queue;
        for (int i = 0; q != null && i < q.length() && i < 40; i++) {
            JSONObject t = q.optJSONObject(i);
            if (t == null) continue;
            MediaDescriptionCompat d = new MediaDescriptionCompat.Builder()
                .setMediaId("q:" + i)
                .setTitle(t.optString("title"))
                .setSubtitle(t.optString("artist"))
                .setIconUri(SpotifreeArtProvider.uriFor(this, t.optString("image", null)))
                .build();
            items.add(new MediaSessionCompat.QueueItem(d, i));
        }
        session.setQueue(items);
        session.setQueueTitle(tr("A continuación", "Up next"));
        notifyChildrenChanged("queue");
    }

    private void maybeLoadArt() {
        final String url = artworkUrl;
        if (url == null || url.isEmpty() || url.equals(loadedArtUrl)) return;
        loadedArtUrl = url;
        art = null;
        io.execute(() -> {
            Bitmap bmp = null;
            try {
                File f = SpotifreeArtProvider.cachedFile(getApplicationContext(), url);
                if (f != null) bmp = BitmapFactory.decodeFile(f.getAbsolutePath());
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
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, tr("Reproducción", "Playback"), NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification() {
        boolean hasLyric = lyricLine != null && !lyricLine.trim().isEmpty();
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_spotifree)
            .setContentTitle(title == null || title.isEmpty() ? "Spotifree" : title)
            .setContentText(hasLyric ? "♪ " + lyricLine.trim() : artist)
            .setSubText(hasLyric ? artist : null)
            .setLargeIcon(art)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(session.getController().getSessionActivity())
            .setDeleteIntent(MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_STOP))
            .addAction(new NotificationCompat.Action(R.drawable.ic_stat_prev, tr("Anterior", "Previous"),
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)))
            .addAction(playing
                ? new NotificationCompat.Action(R.drawable.ic_stat_pause, tr("Pausar", "Pause"),
                    MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PAUSE))
                : new NotificationCompat.Action(R.drawable.ic_stat_play, tr("Reproducir", "Play"),
                    MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PLAY)))
            .addAction(new NotificationCompat.Action(R.drawable.ic_stat_next, tr("Siguiente", "Next"),
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_NEXT)))
            .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(session.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2));
        return b.build();
    }

    private void updateNotification() {
        if (title == null || title.isEmpty()) return;
        Notification n = buildNotification();
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (playing) {
            try {
                int type = Build.VERSION.SDK_INT >= 29 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0;
                ServiceCompat.startForeground(this, NOTIF_ID, n, type);
                foreground = true;
            } catch (Exception e) {
                // Not allowed to go foreground right now (app in background on Android 12+)
                if (nm != null) nm.notify(NOTIF_ID, n);
            }
        } else {
            if (foreground) {
                ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_DETACH);
                foreground = false;
            }
            if (nm != null) nm.notify(NOTIF_ID, n);
        }
    }

    // ------------------------------------------------------------------ browsing (Android Auto)

    @Nullable
    @Override
    public BrowserRoot onGetRoot(@NonNull String clientPackageName, int clientUid, @Nullable Bundle rootHints) {
        loadSaved();
        Bundle extras = new Bundle();
        extras.putBoolean("android.media.browse.CONTENT_STYLE_SUPPORTED", true);
        extras.putInt(BROWSABLE_HINT, STYLE_GRID);
        extras.putInt(PLAYABLE_HINT, STYLE_LIST);
        extras.putBoolean("android.media.browse.SEARCH_SUPPORTED", true);
        // Buttons on the items of a list: queue / like on songs, shuffle on playlists
        ArrayList<Bundle> actions = new ArrayList<>();
        actions.add(browseAction(CBA_QUEUE, tr("Añadir a la cola", "Add to queue"), R.drawable.ic_car_queue_add));
        actions.add(browseAction(CBA_LIKE, tr("Me gusta", "Like"), R.drawable.ic_car_heart));
        actions.add(browseAction(CBA_SHUFFLE, tr("Reproducir en aleatorio", "Shuffle play"), R.drawable.ic_car_shuffle));
        extras.putParcelableArrayList(CBA_ROOT_LIST, actions);
        return new BrowserRoot("root", extras);
    }

    private Bundle browseAction(String id, String label, int iconRes) {
        Bundle b = new Bundle();
        b.putString(CBA_ID, id);
        b.putString(CBA_LABEL, label);
        b.putString(CBA_ICON, "android.resource://" + getPackageName() + "/" + iconRes);
        return b;
    }

    /** A browse button was pressed on an item (Android Auto) */
    @Override
    public void onCustomAction(@NonNull String action, Bundle extras, @NonNull Result<Bundle> result) {
        String mediaId = extras != null ? extras.getString(CBA_MEDIA_ID, "") : "";
        Bundle out = new Bundle();
        if (CBA_QUEUE.equals(action)) {
            send("addToQueue", obj("mediaId", mediaId));
            out.putString(CBA_RESULT_MESSAGE, tr("Añadida a la cola", "Added to queue"));
        } else if (CBA_LIKE.equals(action)) {
            send("likeItem", obj("mediaId", mediaId));
            out.putString(CBA_RESULT_MESSAGE, tr("Guardada en Canciones que te gustan", "Saved to Liked Songs"));
        } else if (CBA_SHUFFLE.equals(action)) {
            sendOrOpen("playFromMediaId", obj("mediaId", "shuf:" + (mediaId.startsWith("pl:") ? mediaId.substring(3) : mediaId)));
        } else {
            result.sendError(null);
            return;
        }
        result.sendResult(out);
    }

    /** A song in a list: cover, explicit badge, queue / like buttons */
    private MediaBrowserCompat.MediaItem trackItem(String mediaId, JSONObject t, @Nullable String group) {
        Bundle ex = new Bundle();
        if (t.optBoolean("explicit", false)) ex.putLong(IS_EXPLICIT, 1L);
        ArrayList<String> ids = new ArrayList<>();
        ids.add(CBA_QUEUE);
        ids.add(CBA_LIKE);
        ex.putStringArrayList(CBA_ITEM_IDS, ids);
        if (group != null) ex.putString(GROUP_TITLE, group);
        return item(mediaId, t.optString("title"), t.optString("artist"), t.optString("image", null), false, ex);
    }

    private MediaBrowserCompat.MediaItem item(String id, String t, String sub, @Nullable String image, boolean browsable, @Nullable Bundle extras) {
        MediaDescriptionCompat.Builder d = new MediaDescriptionCompat.Builder().setMediaId(id).setTitle(t).setSubtitle(sub);
        Uri icon = SpotifreeArtProvider.uriFor(this, image);
        if (icon != null) d.setIconUri(icon);
        if (extras != null) d.setExtras(extras);
        return new MediaBrowserCompat.MediaItem(d.build(), browsable ? MediaBrowserCompat.MediaItem.FLAG_BROWSABLE : MediaBrowserCompat.MediaItem.FLAG_PLAYABLE);
    }

    private MediaBrowserCompat.MediaItem tabItem(String id, String t, int iconRes, int browsableStyle) {
        Bundle ex = new Bundle();
        ex.putInt(BROWSABLE_HINT, browsableStyle);
        ex.putInt(PLAYABLE_HINT, STYLE_LIST);
        MediaDescriptionCompat d = new MediaDescriptionCompat.Builder()
            .setMediaId(id).setTitle(t)
            .setIconUri(Uri.parse("android.resource://" + getPackageName() + "/" + iconRes))
            .setExtras(ex).build();
        return new MediaBrowserCompat.MediaItem(d, MediaBrowserCompat.MediaItem.FLAG_BROWSABLE);
    }

    /** A playlist folder: its songs are shown as a list */
    private MediaBrowserCompat.MediaItem playlistItem(JSONObject p, @Nullable String group) {
        Bundle ex = new Bundle();
        ex.putInt(PLAYABLE_HINT, STYLE_LIST);
        if (group != null) ex.putString(GROUP_TITLE, group);
        ArrayList<String> ids = new ArrayList<>();
        ids.add(CBA_SHUFFLE);
        ex.putStringArrayList(CBA_ITEM_IDS, ids);
        return item("pl:" + p.optString("id"), p.optString("name"), p.optString("subtitle", null), p.optString("image", null), true, ex);
    }

    private MediaBrowserCompat.MediaItem hint(String text) {
        return item("noop", text, tr("Abre Spotifree en el móvil", "Open Spotifree on your phone"), null, false, null);
    }

    @Override
    public void onLoadChildren(@NonNull String parentId, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        loadSaved();
        List<MediaBrowserCompat.MediaItem> out = new ArrayList<>();
        try {
            if ("root".equals(parentId)) {
                out.add(tabItem("home", tr("Inicio", "Home"), R.drawable.ic_car_tab_home, STYLE_GRID));
                out.add(tabItem("lib", tr("Tu biblioteca", "Your Library"), R.drawable.ic_car_tab_library, STYLE_GRID));
                out.add(tabItem("explore", tr("Explorar", "Browse"), R.drawable.ic_car_tab_explore, STYLE_GRID));
                // "A continuación" is the queue button of the player (session queue), like Spotify
            } else if ("explore".equals(parentId)) {
                JSONArray ex = explore;
                for (int i = 0; ex != null && i < ex.length(); i++) {
                    JSONObject g = ex.optJSONObject(i);
                    if (g == null) continue;
                    Bundle b = new Bundle();
                    b.putInt(BROWSABLE_HINT, STYLE_GRID);
                    out.add(item("ex:" + g.optString("id"), g.optString("name"), null, g.optString("image", null), true, b));
                }
                if (out.isEmpty()) out.add(hint(tr("Cargando…", "Loading…")));
            } else if (parentId.startsWith("ex:")) {
                String exId = parentId.substring(3);
                JSONArray items = categoryItems.get(exId);
                if (items == null && SpotifreeMediaPlugin.emit("loadCategory", obj("id", exId))) {
                    result.detach();
                    List<Result<List<MediaBrowserCompat.MediaItem>>> list = pendingChildren.get(parentId);
                    if (list == null) {
                        list = new ArrayList<>();
                        pendingChildren.put(parentId, list);
                    }
                    list.add(result);
                    main.postDelayed(() -> resolvePending(parentId), 9000);
                    return;
                }
                for (int i = 0; items != null && i < items.length(); i++) {
                    JSONObject p = items.optJSONObject(i);
                    if (p != null) out.add(playlistItem(p, null));
                }
                if (out.isEmpty()) out.add(hint(tr("No se pudo cargar", "Could not load")));
            } else if ("home".equals(parentId)) {
                JSONArray h = home;
                for (int s = 0; h != null && s < h.length(); s++) {
                    JSONObject sec = h.optJSONObject(s);
                    if (sec == null) continue;
                    JSONArray items = sec.optJSONArray("items");
                    for (int i = 0; items != null && i < items.length(); i++) {
                        JSONObject p = items.optJSONObject(i);
                        if (p != null) out.add(playlistItem(p, sec.optString("title")));
                    }
                }
                if (out.isEmpty()) out.add(hint(loggedIn ? tr("Cargando tu música…", "Loading your music…") : tr("Inicia sesión en Spotifree", "Sign in to Spotifree")));
            } else if ("lib".equals(parentId)) {
                JSONArray lib = library;
                for (int i = 0; lib != null && i < lib.length(); i++) {
                    JSONObject p = lib.optJSONObject(i);
                    if (p != null) out.add(playlistItem(p, null));
                }
                if (out.isEmpty()) out.add(hint(loggedIn ? tr("Tu biblioteca está vacía", "Your library is empty") : tr("Inicia sesión en Spotifree", "Sign in to Spotifree")));
            } else if ("queue".equals(parentId)) {
                JSONArray q = queue;
                for (int j = 0; q != null && j < q.length() && j < 40; j++) {
                    JSONObject t = q.optJSONObject(j);
                    if (t != null) out.add(trackItem("q:" + j, t, null));
                }
                if (out.isEmpty()) out.add(item("noop", tr("No hay nada en la cola", "Nothing up next"), tr("Elige una playlist", "Pick a playlist"), null, false, null));
            } else if (parentId.startsWith("pl:")) {
                String plId = parentId.substring(3);
                JSONArray tracks = playlistTracks.get(plId);
                if (tracks == null) {
                    // Songs not known yet: ask the app, answer when they arrive (or after 8 s)
                    if (SpotifreeMediaPlugin.emit("loadPlaylist", obj("id", plId))) {
                        result.detach();
                        List<Result<List<MediaBrowserCompat.MediaItem>>> list = pendingChildren.get(parentId);
                        if (list == null) {
                            list = new ArrayList<>();
                            pendingChildren.put(parentId, list);
                        }
                        list.add(result);
                        main.postDelayed(() -> resolvePending(parentId), 8000);
                        return;
                    }
                    out.add(hint(tr("Abre Spotifree para ver las canciones", "Open Spotifree to see the songs")));
                } else {
                    out.addAll(playlistChildren(plId, tracks));
                }
            }
        } catch (Exception ignored) {}
        result.sendResult(out);
    }

    private List<MediaBrowserCompat.MediaItem> playlistChildren(String plId, JSONArray tracks) {
        List<MediaBrowserCompat.MediaItem> out = new ArrayList<>();
        if (tracks.length() > 1) {
            out.add(item("shuf:" + plId, tr("Reproducir en aleatorio", "Shuffle play"),
                tracks.length() + tr(" canciones", " songs"),
                null, false, null));
        }
        for (int j = 0; j < tracks.length() && j < 300; j++) {
            JSONObject t = tracks.optJSONObject(j);
            if (t != null) out.add(trackItem("tr:" + plId + ":" + j, t, null));
        }
        if (out.isEmpty()) out.add(item("noop", tr("Esta playlist está vacía", "This playlist is empty"), "", null, false, null));
        return out;
    }

    /** Songs of a playlist arrived from the app */
    void onPlaylistTracks(String plId, JSONArray tracks) {
        playlistTracks.put(plId, tracks);
        main.post(() -> resolvePending("pl:" + plId));
    }

    /** Playlists of an Explorar category arrived from the app */
    void onCategoryItems(String exId, JSONArray items) {
        categoryItems.put(exId, items);
        main.post(() -> resolvePending("ex:" + exId));
    }

    private void resolvePending(String parentId) {
        List<Result<List<MediaBrowserCompat.MediaItem>>> list = pendingChildren.remove(parentId);
        if (list == null) return;
        String id = parentId.substring(3);
        List<MediaBrowserCompat.MediaItem> out = new ArrayList<>();
        if (parentId.startsWith("ex:")) {
            JSONArray items = categoryItems.get(id);
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject p = items.optJSONObject(i);
                if (p != null) out.add(playlistItem(p, null));
            }
            if (out.isEmpty()) out.add(hint(tr("No se pudo cargar", "Could not load")));
        } else {
            JSONArray tracks = playlistTracks.get(id);
            if (tracks != null) out.addAll(playlistChildren(id, tracks));
            else out.add(hint(tr("No se pudieron cargar las canciones", "Could not load the songs")));
        }
        for (Result<List<MediaBrowserCompat.MediaItem>> r : list) {
            try { r.sendResult(out); } catch (Exception ignored) {}
        }
    }

    @Override
    public void onSearch(@NonNull String query, Bundle extras, @NonNull Result<List<MediaBrowserCompat.MediaItem>> result) {
        final String reqId = "s" + (++searchSeq);
        JSONObject o = new JSONObject();
        try {
            o.put("requestId", reqId);
            o.put("query", query);
        } catch (Exception ignored) {}
        if (SpotifreeMediaPlugin.emit("search", o)) {
            result.detach();
            pendingSearch.put(reqId, result);
            main.postDelayed(() -> {
                Result<List<MediaBrowserCompat.MediaItem>> r = pendingSearch.remove(reqId);
                if (r != null) r.sendResult(localSearch(query));
            }, 9000);
            return;
        }
        result.sendResult(localSearch(query));
    }

    /** Search results from the app: songs (playable) and playlists (browsable) */
    void onSearchResults(String reqId, JSONArray tracks, JSONArray playlists) {
        main.post(() -> {
            Result<List<MediaBrowserCompat.MediaItem>> r = pendingSearch.remove(reqId);
            if (r == null) return;
            List<MediaBrowserCompat.MediaItem> out = new ArrayList<>();
            String songs = tr("Canciones", "Songs");
            String lists = tr("Playlists", "Playlists");
            for (int i = 0; tracks != null && i < tracks.length() && i < 25; i++) {
                JSONObject t = tracks.optJSONObject(i);
                if (t == null) continue;
                out.add(trackItem("st:" + reqId + ":" + i, t, songs));
            }
            for (int i = 0; playlists != null && i < playlists.length() && i < 15; i++) {
                JSONObject p = playlists.optJSONObject(i);
                if (p != null) out.add(playlistItem(p, lists));
            }
            r.sendResult(out);
        });
    }

    private List<MediaBrowserCompat.MediaItem> localSearch(String query) {
        List<MediaBrowserCompat.MediaItem> out = new ArrayList<>();
        String q = query == null ? "" : query.toLowerCase();
        JSONArray lib = library;
        for (int i = 0; lib != null && i < lib.length() && out.size() < 30; i++) {
            JSONObject p = lib.optJSONObject(i);
            if (p != null && p.optString("name").toLowerCase().contains(q)) out.add(playlistItem(p, tr("Playlists", "Playlists")));
        }
        for (Map.Entry<String, JSONArray> e : playlistTracks.entrySet()) {
            JSONArray tracks = e.getValue();
            for (int j = 0; j < tracks.length() && out.size() < 40; j++) {
                JSONObject t = tracks.optJSONObject(j);
                if (t != null && (t.optString("title") + " " + t.optString("artist")).toLowerCase().contains(q)) {
                    out.add(trackItem("tr:" + e.getKey() + ":" + j, t, null));
                }
            }
        }
        return out;
    }

    /** Tells Android Auto that the library / home changed */
    void notifyLibraryChanged() {
        notifyChildrenChanged("home");
        notifyChildrenChanged("lib");
        notifyChildrenChanged("explore");
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
        main.removeCallbacks(releaseLocks);
        releaseLocksNow();
        if (current == this) current = null;
        if (session != null) {
            session.setActive(false);
            session.release();
        }
        io.shutdownNow();
        super.onDestroy();
    }
}
