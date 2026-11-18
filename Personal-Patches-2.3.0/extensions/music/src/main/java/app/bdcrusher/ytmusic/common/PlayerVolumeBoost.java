/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.common;

import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioTrack;
import android.media.audiofx.LoudnessEnhancer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.SeekBar;
import android.widget.TextView;

import java.util.HashMap;
import java.util.Map;
import java.util.WeakHashMap;

import app.bdcrusher.ytmusic.lyrics.NativeActionModel;
import app.bdcrusher.ytmusic.lyrics.ProtoWire;
import app.morphe.extension.shared.Utils;
import app.morphe.extension.shared.patches.components.ByteArrayFilterGroup;
import app.morphe.extension.shared.theme.ThemeUtils;
import com.google.protobuf.MessageLite;

/** Applies an optional gain to the Music sink's Android audio session. */
public final class PlayerVolumeBoost {
    public static final String COMMAND_ID = "bdcrusher-music-volume-boost";
    private static final String ELEMENTS_SENDER_VIEW =
            "com.google.android.libraries.youtube.rendering.elements.sender_view";
    private static final ByteArrayFilterGroup VOLUME_COMMAND = new ByteArrayFilterGroup(null, COMMAND_ID);
    private static final int MAX_GAIN = 12;
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static final Map<AudioTrack, Integer> sessions = new WeakHashMap<>();
    private static final Map<Integer, LoudnessEnhancer> effects = new HashMap<>();
    private static PopupWindow popup;
    private static int gain;

    private PlayerVolumeBoost() {}

    public static int audioSession(AudioTrack track) {
        int session = track.getAudioSessionId();
        if (session > 0) main.post(() -> {
            if (track.getState() != AudioTrack.STATE_INITIALIZED) return;
            if (sessions.put(track, session) == null && gain > 0) refreshEffects();
        });
        return session;
    }

    public static void releaseAudioTrack(AudioTrack track) {
        try {
            track.release();
        } finally {
            main.post(() -> {
                if (sessions.remove(track) != null) refreshEffects();
            });
        }
    }

    private static void refreshEffects() {
        var entries = effects.entrySet().iterator();
        while (entries.hasNext()) {
            var entry = entries.next();
            if (gain == 0 || !sessions.containsValue(entry.getKey())) {
                entry.getValue().release();
                entries.remove();
            }
        }
        if (gain == 0) return;
        for (int session : java.util.Set.copyOf(sessions.values())) {
            LoudnessEnhancer effect = effects.get(session);
            try {
                if (effect == null) effect = new LoudnessEnhancer(session);
                effect.setTargetGain(gain * 100);
                if (effect.setEnabled(true) != 0) throw new IllegalStateException("Effect unavailable");
                effects.put(session, effect);
            } catch (RuntimeException failure) {
                if (effect != null) effect.release();
                effects.remove(session);
                FeatureDiagnostics.event("Volume boost", "The current audio output did not accept a session effect");
            }
        }
    }

    public static byte[] rewriteModel(byte[] model) {
        return NativeActionModel.withVolumeBoost(model);
    }

    // Replaced by VolumeBoostPatch with the host's typed model parser.
    public static Object nativeModel(Object model) { return model; }

    public static boolean handleCommand(Object command, Map<?,?> context) {
        if (!(command instanceof MessageLite message)) return false;
        // Only our synthetic show-panel identity is consumed by this resolver hook.
        try {
            byte[] bytes = message.toByteArray();
            if (!VOLUME_COMMAND.check(bytes).isFiltered()) return false;
            byte[] identity = new ProtoWire(bytes).child(138681778);
            identity = new ProtoWire(identity).child(10);
            byte[] id = new ProtoWire(identity).child(3);
            if (!COMMAND_ID.equals(new String(id, java.nio.charset.StandardCharsets.US_ASCII))) return false;
        } catch (IllegalArgumentException unrelated) {
            return false;
        }
        Object sender = context == null ? null : context.get(ELEMENTS_SENDER_VIEW);
        Utils.runOnMainThreadNowOrLater(() -> {
            View anchor = sender instanceof View view ? view : null;
            if (anchor != null && anchor.isAttachedToWindow()) show(anchor);
            else if (Utils.getActivity() != null) {
                View root = Utils.getActivity().findViewById(android.R.id.content);
                if (root != null && root.isAttachedToWindow()) show(root);
            }
        });
        return true;
    }

    private static void show(View anchor) {
        if (popup != null && popup.isShowing()) {
            popup.dismiss();
            return;
        }
        Context context = anchor.getContext();
        int foreground = ThemeUtils.getAppForegroundColor();
        int background = ThemeUtils.getAppBackgroundColor();
        LinearLayout content = new LinearLayout(context);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(anchor, 16), dp(anchor, 10), dp(anchor, 16), dp(anchor, 8));
        TextView title = new TextView(context);
        title.setTextSize(15);
        title.setTextColor(foreground);
        content.addView(title);
        SeekBar slider = new SeekBar(context);
        slider.setMax(MAX_GAIN);
        slider.setProgress(gain);
        slider.setContentDescription("Volume boost");
        content.addView(slider, new LinearLayout.LayoutParams(-1, dp(anchor, 48)));
        TextView status = new TextView(context);
        status.setTextColor(foreground);
        status.setTextSize(12);
        content.addView(status);
        Runnable update = () -> {
            String level = gain == 0 ? "Off" : "+" + gain + " dB";
            title.setText("Volume boost  ·  " + level);
            status.setVisibility(gain != 0 && effects.isEmpty() ? View.VISIBLE : View.GONE);
            status.setText("Waiting for a supported audio output");
            if (Build.VERSION.SDK_INT >= 30) {
                slider.setStateDescription(level);
            }
        };
        update.run();
        slider.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onStartTrackingTouch(SeekBar bar) {}
            @Override public void onStopTrackingTouch(SeekBar bar) {}
            @Override public void onProgressChanged(SeekBar bar, int value, boolean fromUser) {
                if (!fromUser) return;
                gain = value;
                refreshEffects();
                update.run();
            }
        });
        popup = new PopupWindow(content, dp(anchor, 240), -2, true);
        popup.setBackgroundDrawable(shape(anchor, background == Color.BLACK ? 0xff1b1b1b : background, 16));
        popup.setElevation(dp(anchor, 8));
        popup.setOutsideTouchable(true);
        popup.setOnDismissListener(() -> popup = null);
        if (anchor.getId() == android.R.id.content) {
            popup.showAtLocation(anchor, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL, 0, dp(anchor, 72));
        } else {
            popup.showAsDropDown(anchor, 0, dp(anchor, 5), Gravity.END);
        }
    }

    private static GradientDrawable shape(View view, int color, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(view, radius));
        return drawable;
    }

    private static int dp(View view, int amount) {
        return Math.round(amount * view.getResources().getDisplayMetrics().density);
    }

}
