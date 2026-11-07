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
 *   home   "Inicio"           sections (recent, made for you, shelves) -> pl:<id>
 *   lib    "Tu biblioteca"    Liked Songs + playlists                  -> pl:<id>
 *   queue  "A continuación"   upcoming songs                           -> q:<index>
 *   pl:<id> -> shuf:<id> ("Reproducir en aleatorio") + tr:<id>:<index>
 *   search  -> st:<requestId>:<index> songs, pl:<id> playlists
 */
public class SpotifreeMediaService extends MediaBrowserServiceCompat {

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
            @Override public void onCustomAction(String action, Bundle extras) { send(action, null); }
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

    private void setError(String msg) {
        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID | PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH)
            .setState(PlaybackStateCompat.STATE_ERROR, 0, 0f)
            .setErrorMessage(PlaybackStateCompat.ERROR_CODE_APP_ERROR, msg)
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
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, durationMs);
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
        // Spotify-style buttons on the car's "now playing" screen
        sb.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(ACT_LIKE,
            liked ? tr("Quitar de Me gusta", "Remove from Liked Songs") : tr("Me gusta", "Like"),
            liked ? R.drawable.ic_car_heart_filled : R.drawable.ic_car_heart).build());
        sb.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(ACT_SHUFFLE,
            shuffle ? tr("Desactivar aleatorio", "Shuffle off") : tr("Aleatorio", "Shuffle"),
            shuffle ? R.drawable.ic_car_shuffle_on : R.drawable.ic_car_shuffle).build());
        sb.addCustomAction(new PlaybackStateCompat.CustomAction.Builder(ACT_REPEAT,
            "one".equals(repeat) ? tr("Repetir una", "Repeat one") : "all".equals(repeat) ? tr("Repetir todo", "Repeat all") : tr("Repetir", "Repeat"),
            "one".equals(repeat) ? R.drawable.ic_car_repeat_one : "all".equals(repeat) ? R.drawable.ic_car_repeat_on : R.drawable.ic_car_repeat).build());
        session.setPlaybackState(sb.build());
        session.setShuffleMode(shuffle ? PlaybackStateCompat.SHUFFLE_MODE_ALL : PlaybackStateCompat.SHUFFLE_MODE_NONE);
        session.setRepeatMode("one".equals(repeat) ? PlaybackStateCompat.REPEAT_MODE_ONE
            : "all".equals(repeat) ? PlaybackStateCompat.REPEAT_MODE_ALL : PlaybackStateCompat.REPEAT_MODE_NONE);

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
        return new BrowserRoot("root", extras);
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
                out.add(tabItem("queue", tr("A continuación", "Up next"), R.drawable.ic_car_tab_queue, STYLE_LIST));
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
                    if (t != null) out.add(item("q:" + j, t.optString("title"), t.optString("artist"), t.optString("image", null), false, null));
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
            if (t != null) out.add(item("tr:" + plId + ":" + j, t.optString("title"), t.optString("artist"), t.optString("image", null), false, null));
        }
        if (out.isEmpty()) out.add(item("noop", tr("Esta playlist está vacía", "This playlist is empty"), "", null, false, null));
        return out;
    }

    /** Songs of a playlist arrived from the app */
    void onPlaylistTracks(String plId, JSONArray tracks) {
        playlistTracks.put(plId, tracks);
        main.post(() -> resolvePending("pl:" + plId));
    }

    private void resolvePending(String parentId) {
        List<Result<List<MediaBrowserCompat.MediaItem>>> list = pendingChildren.remove(parentId);
        if (list == null) return;
        String plId = parentId.substring(3);
        JSONArray tracks = playlistTracks.get(plId);
        List<MediaBrowserCompat.MediaItem> out = tracks != null ? playlistChildren(plId, tracks)
            : new ArrayList<>();
        if (tracks == null) out.add(hint(tr("No se pudieron cargar las canciones", "Could not load the songs")));
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
                Bundle ex = new Bundle();
                ex.putString(GROUP_TITLE, songs);
                out.add(item("st:" + reqId + ":" + i, t.optString("title"), t.optString("artist"), t.optString("image", null), false, ex));
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
                    out.add(item("tr:" + e.getKey() + ":" + j, t.optString("title"), t.optString("artist"), t.optString("image", null), false, null));
                }
            }
        }
        return out;
    }

    /** Tells Android Auto that the library / home changed */
    void notifyLibraryChanged() {
        notifyChildrenChanged("home");
        notifyChildrenChanged("lib");
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
