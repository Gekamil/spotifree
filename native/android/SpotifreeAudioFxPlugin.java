package com.spotifree.music;

import android.media.audiofx.DynamicsProcessing;
import android.media.audiofx.Equalizer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Real audio effects in the APK. The songs play inside the app's web player, which the web
 * layer cannot process, so the equalizer and the DJ filters are applied by Android's own
 * Equalizer effect on the audio output (session 0). Some phones do not allow apps to use it:
 * status() reports whether it works.
 *
 *  - setEqualizer: the app's 6-band EQ (60 Hz .. 15 kHz) mapped onto the phone's bands
 *  - sweep: DJ filter moves during a transition (filter build-up, bass swap dip, high cut)
 *
 * JS side: src/services/nativeAudioFx.ts (registerPlugin('SpotifreeAudioFx')).
 */
@CapacitorPlugin(name = "SpotifreeAudioFx")
public class SpotifreeAudioFxPlugin extends Plugin {

    private static final double[] APP_FREQS = { 60, 150, 400, 1000, 2400, 15000 };

    // Android 9+: DynamicsProcessing = 12-band EQ + limiter (no distortion with boosts / DJ moves)
    private static final float[] DP_CUTOFFS = { 45, 90, 160, 280, 500, 900, 1600, 2800, 5000, 8500, 13000, 20000 };
    private DynamicsProcessing dp;
    private float lastInputGain = 0f;

    private Equalizer eq;
    private String error = null;
    private int bands = 0;
    private double[] centersHz = new double[0];
    private short minMb = -1500, maxMb = 1500;
    private double[] baseDb = new double[0];
    private double[] fxDb = new double[0];
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable animator;

    private boolean tryDynamics() {
        if (Build.VERSION.SDK_INT < 28) return false;
        try {
            int n = DP_CUTOFFS.length;
            DynamicsProcessing.Config cfg = new DynamicsProcessing.Config.Builder(
                DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION, 2,
                true, n,      // pre-EQ
                false, 0,     // multi-band compressor
                false, 0,     // post-EQ
                true          // limiter
            ).build();
            DynamicsProcessing.Eq pre = new DynamicsProcessing.Eq(true, true, n);
            for (int i = 0; i < n; i++) pre.setBand(i, new DynamicsProcessing.EqBand(true, DP_CUTOFFS[i], 0f));
            cfg.setPreEqAllChannelsTo(pre);
            // Soft safety limiter just below 0 dBFS
            cfg.setLimiterAllChannelsTo(new DynamicsProcessing.Limiter(true, true, 0, 1f, 80f, 10f, -1f, 0f));
            DynamicsProcessing d = new DynamicsProcessing(1000, 0, cfg);
            d.setEnabled(true);
            bands = n;
            centersHz = new double[n];
            for (int i = 0; i < n; i++) {
                double lo = i == 0 ? 20 : DP_CUTOFFS[i - 1];
                centersHz[i] = Math.sqrt(lo * DP_CUTOFFS[i]); // each band ends at its cutoff
            }
            baseDb = new double[n];
            fxDb = new double[n];
            minMb = -3000;
            maxMb = 1500;
            dp = d;
            error = null;
            return true;
        } catch (Throwable t) {
            dp = null;
            error = t.getClass().getSimpleName() + ": " + t.getMessage();
            return false;
        }
    }

    private synchronized boolean ensure() {
        if (dp != null || eq != null) return true;
        if (tryDynamics()) return true;
        try {
            Equalizer e = new Equalizer(1000, 0);
            e.setEnabled(true);
            bands = e.getNumberOfBands();
            short[] range = e.getBandLevelRange();
            minMb = range[0];
            maxMb = range[1];
            centersHz = new double[bands];
            for (short i = 0; i < bands; i++) centersHz[i] = e.getCenterFreq(i) / 1000.0;
            baseDb = new double[bands];
            fxDb = new double[bands];
            eq = e;
            error = null;
            return true;
        } catch (Throwable t) {
            eq = null;
            error = t.getClass().getSimpleName() + ": " + t.getMessage();
            return false;
        }
    }

    /** Gain of the app's EQ curve at a frequency (interpolated on a log scale) */
    private static double curveAt(double[] gains, double hz) {
        if (hz <= APP_FREQS[0]) return gains[0];
        for (int i = 1; i < APP_FREQS.length; i++) {
            if (hz <= APP_FREQS[i]) {
                double a = Math.log(APP_FREQS[i - 1]), b = Math.log(APP_FREQS[i]);
                double t = (Math.log(hz) - a) / (b - a);
                return gains[i - 1] + (gains[i] - gains[i - 1]) * t;
            }
        }
        return gains[gains.length - 1];
    }

    private synchronized void apply() {
        if (dp != null) {
            double maxBoost = 0;
            for (int i = 0; i < bands; i++) maxBoost = Math.max(maxBoost, baseDb[i] + fxDb[i]);
            try {
                for (int i = 0; i < bands; i++) {
                    double db = Math.max(minMb / 100.0, Math.min(maxMb / 100.0, baseDb[i] + fxDb[i]));
                    dp.setPreEqBandAllChannelsTo(i, new DynamicsProcessing.EqBand(true, DP_CUTOFFS[i], (float) db));
                }
                // Headroom: when the curve boosts, lower the input a bit so the limiter barely works
                float inGain = (float) -Math.min(6, maxBoost * 0.5);
                if (Math.abs(inGain - lastInputGain) > 0.05f) {
                    dp.setInputGainAllChannelsTo(inGain);
                    lastInputGain = inGain;
                }
            } catch (Throwable ignored) {}
            return;
        }
        if (eq == null) return;
        for (short i = 0; i < bands; i++) {
            double db = baseDb[i] + fxDb[i];
            int mb = (int) Math.round(db * 100);
            mb = Math.max(minMb, Math.min(maxMb, mb));
            try { eq.setBandLevel(i, (short) mb); } catch (Throwable ignored) {}
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        boolean ok = ensure();
        JSObject ret = new JSObject();
        ret.put("available", ok);
        ret.put("engine", dp != null ? "dynamics" : eq != null ? "equalizer" : "none");
        JSArray c = new JSArray();
        for (double hz : centersHz) c.put(Math.round(hz));
        ret.put("bandsHz", c);
        if (error != null) ret.put("error", error);
        call.resolve(ret);
    }

    /** enabled, gains: 6 values in dB for 60 / 150 / 400 / 1k / 2.4k / 15k Hz */
    @PluginMethod
    public void setEqualizer(PluginCall call) {
        if (!ensure()) {
            call.reject(error != null ? error : "Equalizer not available");
            return;
        }
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", true));
        JSArray g = call.getArray("gains", new JSArray());
        double[] gains = new double[APP_FREQS.length];
        for (int i = 0; i < gains.length; i++) {
            try { gains[i] = enabled ? g.getDouble(i) : 0; } catch (Exception e) { gains[i] = 0; }
        }
        synchronized (this) {
            for (int i = 0; i < bands; i++) baseDb[i] = curveAt(gains, centersHz[i]);
        }
        apply();
        call.resolve();
    }

    /**
     * kind: "build"  low frequencies filtered out more and more until the swap point, then
     *                released at once (the drop)
     *       "bassdip" bass removed around the swap point (bass swap), then back
     *       "highcut" highs filtered out until the swap point (outgoing song fading into the
     *                 distance), then back
     * durationMs: whole transition, swapAt: 0..1, depthDb: strength (positive number)
     */
    @PluginMethod
    public void sweep(PluginCall call) {
        if (!ensure()) {
            call.reject(error != null ? error : "Equalizer not available");
            return;
        }
        final String kind = call.getString("kind", "build");
        final long dur = Math.max(400, call.getInt("durationMs", 4000));
        final double swapAt = Math.max(0.1, Math.min(0.97, call.getDouble("swapAt", 0.5)));
        // The advanced processor can cut deeper (a real filter feel); the basic one stops at 15 dB
        final double depth = Math.max(0, Math.min(dp != null ? 24 : 15, call.getDouble("depthDb", 12.0) * (dp != null ? 1.6 : 1.0)));
        final long start = SystemClock.uptimeMillis();
        if (animator != null) handler.removeCallbacks(animator);
        animator = new Runnable() {
            @Override
            public void run() {
                double p = (SystemClock.uptimeMillis() - start) / (double) dur;
                boolean done = p >= 1.0;
                synchronized (SpotifreeAudioFxPlugin.this) {
                    for (int i = 0; i < bands; i++) {
                        double hz = centersHz[i];
                        double amount = 0;
                        if ("build".equals(kind)) {
                            // weight: full at the lows, nothing from ~2 kHz up
                            double w = hz <= 250 ? 1 : hz >= 2000 ? 0 : 1 - (Math.log(hz / 250) / Math.log(2000.0 / 250));
                            double ramp = p < swapAt ? Math.pow(p / swapAt, 1.6) : Math.max(0, 1 - (p - swapAt) / 0.04);
                            amount = depth * w * ramp;
                        } else if ("bassdip".equals(kind)) {
                            double w = hz <= 150 ? 1 : hz >= 600 ? 0 : 1 - (Math.log(hz / 150) / Math.log(4));
                            double a = swapAt - 0.25, b = swapAt + 0.06;
                            double env = p < a ? 0 : p < swapAt ? (p - a) / 0.25 : p < b ? 1 : Math.max(0, 1 - (p - b) / 0.1);
                            amount = depth * w * env;
                        } else if ("highcut".equals(kind)) {
                            double w = hz >= 6000 ? 1 : hz <= 900 ? 0 : Math.log(hz / 900) / Math.log(6000.0 / 900);
                            double ramp = p < swapAt ? p / swapAt : Math.max(0, 1 - (p - swapAt) / 0.08);
                            amount = depth * w * ramp;
                        }
                        fxDb[i] = done ? 0 : -amount;
                    }
                }
                apply();
                if (!done) handler.postDelayed(this, 40);
                else animator = null;
            }
        };
        handler.post(animator);
        call.resolve();
    }

    /** Stops a running DJ filter move (seek, pause, skip) */
    @PluginMethod
    public void cancelSweep(PluginCall call) {
        if (animator != null) handler.removeCallbacks(animator);
        animator = null;
        synchronized (this) {
            for (int i = 0; i < fxDb.length; i++) fxDb[i] = 0;
        }
        apply();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (animator != null) handler.removeCallbacks(animator);
        synchronized (this) {
            if (eq != null) {
                try { eq.release(); } catch (Throwable ignored) {}
                eq = null;
            }
            if (dp != null) {
                try { dp.release(); } catch (Throwable ignored) {}
                dp = null;
            }
        }
        super.handleOnDestroy();
    }
}
