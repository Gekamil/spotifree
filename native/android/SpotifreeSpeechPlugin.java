package com.spotifree.music;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

/**
 * The DJ's microphone in the APK: Android's own speech recognition (the WebView has no
 * SpeechRecognition). Events: "partial" {text}, "final" {text}, "end" {}, "error" {code}.
 * JS side: src/services/nativeSpeech.ts (registerPlugin('SpotifreeSpeech')).
 */
@CapacitorPlugin(
    name = "SpotifreeSpeech",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone") }
)
public class SpotifreeSpeechPlugin extends Plugin {

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;

    @PluginMethod
    public void available(PluginCall call) {
        JSObject ret = new JSObject();
        boolean ok = false;
        try {
            ok = SpeechRecognizer.isRecognitionAvailable(getContext());
        } catch (Exception ignored) {}
        ret.put("available", ok);
        call.resolve(ret);
    }

    /** lang: "es-ES" / "en-US" */
    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "afterPermission");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void afterPermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) begin(call);
        else call.reject("permission", "permission");
    }

    private void begin(final PluginCall call) {
        final String lang = call.getString("lang", "es-ES");
        main.post(() -> {
            try {
                destroyRecognizer();
                if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                    call.reject("unavailable", "unavailable");
                    return;
                }
                recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) {}
                    @Override public void onBeginningOfSpeech() {}
                    @Override public void onRmsChanged(float rmsdB) {
                        JSObject o = new JSObject();
                        o.put("level", Math.max(0, Math.min(1, (rmsdB + 2) / 12.0)));
                        notifyListeners("level", o);
                    }
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() {}
                    @Override public void onError(int error) {
                        JSObject o = new JSObject();
                        o.put("code", error);
                        notifyListeners("error", o);
                        notifyListeners("end", new JSObject());
                        destroyRecognizer();
                    }
                    @Override public void onResults(Bundle results) {
                        JSObject o = new JSObject();
                        o.put("text", first(results));
                        notifyListeners("final", o);
                        notifyListeners("end", new JSObject());
                        destroyRecognizer();
                    }
                    @Override public void onPartialResults(Bundle partial) {
                        JSObject o = new JSObject();
                        o.put("text", first(partial));
                        notifyListeners("partial", o);
                    }
                    @Override public void onEvent(int eventType, Bundle params) {}
                });
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                recognizer.startListening(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("failed", "failed");
            }
        });
    }

    private static String first(Bundle b) {
        if (b == null) return "";
        ArrayList<String> list = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return list != null && !list.isEmpty() && list.get(0) != null ? list.get(0) : "";
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            try {
                if (recognizer != null) recognizer.stopListening();
            } catch (Exception ignored) {}
        });
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        main.post(this::destroyRecognizer);
        call.resolve();
    }

    private void destroyRecognizer() {
        if (recognizer != null) {
            try {
                recognizer.cancel();
                recognizer.destroy();
            } catch (Exception ignored) {}
            recognizer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        main.post(this::destroyRecognizer);
        super.handleOnDestroy();
    }
}
