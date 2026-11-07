package com.spotifree.music;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Signs in to Spotify inside the app and hands the session cookie (sp_dc) to the web layer,
 * so the user never has to copy it by hand.
 *
 * Opens Spotify's own login page (accounts.spotify.com) in a full-screen WebView. The user
 * types their credentials there, on Spotify's page; the app only reads the resulting
 * open.spotify.com session cookie from the WebView cookie store once the login finished.
 * JS side: src/services/nativeSpotifyLogin.ts (registerPlugin('SpotifreeLogin')).
 */
@CapacitorPlugin(name = "SpotifreeLogin")
public class SpotifreeLoginPlugin extends Plugin {

    private Dialog dialog;
    private PluginCall pending;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable poller;

    private static String readSpDc() {
        CookieManager cm = CookieManager.getInstance();
        for (String url : new String[] { "https://open.spotify.com", "https://spotify.com", "https://accounts.spotify.com" }) {
            String all = cm.getCookie(url);
            if (TextUtils.isEmpty(all)) continue;
            for (String part : all.split(";")) {
                String p = part.trim();
                if (p.startsWith("sp_dc=")) {
                    String v = p.substring(6).trim();
                    if (v.length() > 20) return v;
                }
            }
        }
        return null;
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getContext().getResources().getDisplayMetrics());
    }

    @SuppressLint("SetJavaScriptEnabled")
    @PluginMethod
    public void login(PluginCall call) {
        if (pending != null) {
            call.reject("A login is already open");
            return;
        }
        pending = call;
        call.setKeepAlive(true);
        final String lang = "en".equals(call.getString("language", "es")) ? "en" : "es";

        getActivity().runOnUiThread(() -> {
            CookieManager cm = CookieManager.getInstance();
            cm.setAcceptCookie(true);

            dialog = new Dialog(getActivity(), android.R.style.Theme_Black_NoTitleBar_Fullscreen);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

            LinearLayout root = new LinearLayout(getContext());
            root.setOrientation(LinearLayout.VERTICAL);
            root.setBackgroundColor(Color.parseColor("#121212"));

            // Header: title + close
            LinearLayout bar = new LinearLayout(getContext());
            bar.setOrientation(LinearLayout.HORIZONTAL);
            bar.setGravity(Gravity.CENTER_VERTICAL);
            bar.setPadding(dp(16), dp(10), dp(8), dp(10));
            bar.setBackgroundColor(Color.parseColor("#121212"));

            TextView title = new TextView(getContext());
            title.setText("en".equals(lang) ? "Sign in to Spotify" : "Iniciar sesión en Spotify");
            title.setTextColor(Color.WHITE);
            title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
            title.setTypeface(Typeface.DEFAULT_BOLD);
            bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

            TextView close = new TextView(getContext());
            close.setText("✕");
            close.setTextColor(Color.parseColor("#B3B3B3"));
            close.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
            close.setGravity(Gravity.CENTER);
            close.setOnClickListener(v -> finish(null, "cancelled"));
            bar.addView(close, new LinearLayout.LayoutParams(dp(44), dp(44)));
            root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            FrameLayout body = new FrameLayout(getContext());
            final WebView web = new WebView(getContext());
            WebSettings s = web.getSettings();
            s.setJavaScriptEnabled(true);
            s.setDomStorageEnabled(true);
            // Same browser identity as Chrome on this phone (without the WebView marker), so the
            // login page offers its normal options
            String ua = s.getUserAgentString();
            if (ua != null) s.setUserAgentString(ua.replace("; wv", "").replaceAll("Version/\\d+\\.\\d+ ", ""));
            cm.setAcceptThirdPartyCookies(web, true);
            web.setBackgroundColor(Color.parseColor("#121212"));

            final ProgressBar spinner = new ProgressBar(getContext());
            FrameLayout.LayoutParams sp = new FrameLayout.LayoutParams(dp(40), dp(40), Gravity.CENTER);

            web.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    return false;
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    spinner.setVisibility(android.view.View.GONE);
                    check();
                }

                @Override
                public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
                    check();
                }
            });

            body.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            body.addView(spinner, sp);
            root.addView(body, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

            dialog.setContentView(root);
            dialog.setOnCancelListener(d -> finish(null, "cancelled"));
            Window w = dialog.getWindow();
            if (w != null) {
                w.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
                w.setStatusBarColor(Color.parseColor("#121212"));
            }
            dialog.show();

            String cont = "https%3A%2F%2Fopen.spotify.com%2F";
            web.loadUrl("https://accounts.spotify.com/" + ("en".equals(lang) ? "en" : "es") + "/login?continue=" + cont);

            // The cookie can arrive without a navigation event (XHR login): poll as well
            poller = new Runnable() {
                @Override
                public void run() {
                    if (pending == null) return;
                    check();
                    handler.postDelayed(this, 1000);
                }
            };
            handler.postDelayed(poller, 1500);
        });
    }

    private void check() {
        if (pending == null) return;
        CookieManager.getInstance().flush();
        String spDc = readSpDc();
        if (spDc != null) finish(spDc, null);
    }

    private void finish(String cookie, String error) {
        handler.post(() -> {
            if (poller != null) handler.removeCallbacks(poller);
            poller = null;
            if (dialog != null) {
                try { dialog.dismiss(); } catch (Exception ignored) {}
                dialog = null;
            }
            PluginCall call = pending;
            pending = null;
            if (call == null) return;
            if (cookie != null) {
                JSObject ret = new JSObject();
                ret.put("cookie", cookie);
                call.resolve(ret);
            } else {
                call.reject(error != null ? error : "cancelled");
            }
            try { getBridge().releaseCall(call); } catch (Exception ignored) {}
        });
    }

    /** Forgets the Spotify session of the in-app login (next login asks for the account again). */
    @PluginMethod
    public void logout(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            CookieManager cm = CookieManager.getInstance();
            for (String url : new String[] { "https://open.spotify.com", "https://accounts.spotify.com", "https://spotify.com" }) {
                String all = cm.getCookie(url);
                if (TextUtils.isEmpty(all)) continue;
                for (String part : all.split(";")) {
                    String name = part.split("=")[0].trim();
                    cm.setCookie(url, name + "=; Max-Age=0; Path=/; Domain=.spotify.com");
                }
            }
            cm.flush();
            call.resolve();
        });
    }
}
