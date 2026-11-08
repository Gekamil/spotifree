package com.spotifree.music;

import android.content.Context;
import android.os.Build;
import android.util.AttributeSet;
import android.view.View;

import com.getcapacitor.CapacitorWebView;

/**
 * The app's WebView (replaces Capacitor's through res/layout/capacitor_bridge_layout_main.xml).
 *
 * Music keeps playing with the screen off or the app in the background: when the window is
 * hidden, the page would become "hidden" and the YouTube player pauses itself (and timers that
 * drive the mixes slow down). From the first song until the player is closed (notification swiped
 * away or app closed), also while paused, the page keeps seeing itself as visible, so play from
 * the car / Bluetooth / lock screen works at any time.
 * Screen on with the app open, it behaves exactly like a normal WebView.
 */
public class SpotifreeWebView extends CapacitorWebView {

    private static SpotifreeWebView instance;
    private int realVisibility = View.VISIBLE;

    public SpotifreeWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
        instance = this;
        getSettings().setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= 26) {
            // Don't let the system lower the page's process priority when it is not on screen
            setRendererPriorityPolicy(RENDERER_PRIORITY_IMPORTANT, false);
        }
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        realVisibility = visibility;
        apply();
    }

    private void apply() {
        boolean visible = realVisibility == View.VISIBLE || SpotifreeMediaService.keepAlive();
        super.onWindowVisibilityChanged(visible ? View.VISIBLE : realVisibility);
    }

    /** Playback state changed: re-evaluate (main thread) */
    static void sync() {
        final SpotifreeWebView w = instance;
        if (w != null) w.post(w::apply);
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        if (instance == this) instance = null;
    }
}
