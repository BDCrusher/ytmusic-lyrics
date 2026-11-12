/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.common;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.media.AudioTrack;
import android.media.audiofx.LoudnessEnhancer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.SeekBar;
import android.widget.TextView;

import java.util.IdentityHashMap;
import java.util.HashMap;
import java.util.Map;
import java.util.WeakHashMap;

import app.morphe.extension.shared.theme.ThemeUtils;

/** Applies an optional gain to the Music sink's Android audio session. */
public final class PlayerVolumeBoost {
    private static final int MAX_GAIN = 12;
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static final Map<AudioTrack, Integer> sessions = new WeakHashMap<>();
    private static final Map<Integer, LoudnessEnhancer> effects = new HashMap<>();
    private static final Map<FrameLayout, java.lang.ref.WeakReference<Row>> rows = new WeakHashMap<>();
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

    public static void bind(View view) {
        if (!(view instanceof FrameLayout row) || rows.get(row) != null && rows.get(row).get() != null) return;
        Row binding = new Row(row);
        rows.put(row, new java.lang.ref.WeakReference<>(binding));
        row.addOnAttachStateChangeListener(binding);
        if (row.isAttachedToWindow()) binding.onViewAttachedToWindow(row);
    }

    private static final class Row implements View.OnAttachStateChangeListener,
            android.view.ViewTreeObserver.OnGlobalLayoutListener {
        final FrameLayout row;
        final Speaker chip;
        final Map<View, Integer> margins = new IdentityHashMap<>();
        android.view.ViewTreeObserver observer;
        PopupWindow popup;

        Row(FrameLayout row) {
            this.row = row;
            chip = new Speaker(row.getContext());
            chip.setContentDescription("Volume boost");
            chip.setFocusable(true);
            int foreground = ThemeUtils.getAppForegroundColor();
            chip.setBackground(new RippleDrawable(ColorStateList.valueOf((foreground & 0xffffff) | 0x33000000),
                    shape(chip, (foreground & 0xffffff) | 0x22000000, 24), null));
            chip.setOnClickListener(view -> show());
        }

        @Override public void onViewAttachedToWindow(View view) {
            observer = row.getViewTreeObserver();
            observer.addOnGlobalLayoutListener(this);
            onGlobalLayout();
        }

        @Override public void onViewDetachedFromWindow(View view) {
            if (observer != null && observer.isAlive()) observer.removeOnGlobalLayoutListener(this);
            if (popup != null) popup.dismiss();
            row.removeView(chip);
            for (var entry : margins.entrySet()) {
                if (entry.getKey().getLayoutParams() instanceof FrameLayout.LayoutParams params) {
                    params.setMarginEnd(entry.getValue());
                    entry.getKey().setLayoutParams(params);
                }
            }
            margins.clear();
        }

        @Override public void onGlobalLayout() {
            if (!row.isShown()) return;
            int width = dp(row, 58);
            margins.keySet().removeIf(child -> child.getParent() != row);
            boolean stockContent = false;
            for (int i = 0; i < row.getChildCount(); i++) {
                View child = row.getChildAt(i);
                if (child == chip || child.getVisibility() == View.GONE) continue;
                stockContent = true;
                if (!(child.getLayoutParams() instanceof FrameLayout.LayoutParams params)) continue;
                int original = margins.computeIfAbsent(child, key -> params.getMarginEnd());
                if (params.getMarginEnd() == original + width) continue;
                params.setMarginEnd(original + width);
                child.setLayoutParams(params);
            }
            if (!stockContent) {
                if (chip.getParent() == row) row.removeView(chip);
                return;
            }
            if (chip.getParent() == null) {
                FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(dp(row, 48), dp(row, 40),
                        Gravity.END | Gravity.CENTER_VERTICAL);
                params.setMarginEnd(dp(row, 5));
                row.addView(chip, params);
            } else if (row.getChildAt(row.getChildCount() - 1) != chip) chip.bringToFront();
        }

        private void show() {
            if (popup != null && popup.isShowing()) {
                popup.dismiss();
                return;
            }
            Context context = row.getContext();
            int foreground = ThemeUtils.getAppForegroundColor();
            int background = ThemeUtils.getAppBackgroundColor();
            LinearLayout content = new LinearLayout(context);
            content.setOrientation(LinearLayout.VERTICAL);
            content.setPadding(dp(row, 16), dp(row, 10), dp(row, 16), dp(row, 8));
            TextView title = new TextView(context);
            title.setTextSize(15);
            title.setTextColor(foreground);
            content.addView(title);
            SeekBar slider = new SeekBar(context);
            slider.setMax(MAX_GAIN);
            slider.setProgress(gain);
            slider.setContentDescription("Volume boost");
            content.addView(slider, new LinearLayout.LayoutParams(-1, dp(row, 48)));
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
                    chip.setStateDescription(level);
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
            popup = new PopupWindow(content, dp(row, 240), -2, true);
            popup.setBackgroundDrawable(shape(row, background == Color.BLACK ? 0xff1b1b1b : background, 16));
            popup.setElevation(dp(row, 8));
            popup.setOutsideTouchable(true);
            popup.showAsDropDown(chip, 0, dp(row, 5), Gravity.END);
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

    private static final class Speaker extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Path speaker = new Path();
        Speaker(Context context) {
            super(context);
            speaker.moveTo(3, 9);
            speaker.lineTo(7, 9);
            speaker.lineTo(12, 5);
            speaker.lineTo(12, 19);
            speaker.lineTo(7, 15);
            speaker.lineTo(3, 15);
            speaker.close();
        }
        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            float scale = dp(this, 22) / 24f;
            canvas.save();
            canvas.translate((getWidth() - 24 * scale) / 2, (getHeight() - 24 * scale) / 2);
            canvas.scale(scale, scale);
            paint.setColor(ThemeUtils.getAppForegroundColor());
            paint.setStyle(Paint.Style.FILL);
            canvas.drawPath(speaker, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(1.7f);
            paint.setStrokeCap(Paint.Cap.ROUND);
            canvas.drawArc(7, 7, 17, 17, -43, 86, false, paint);
            canvas.drawArc(3, 3, 21, 21, -45, 90, false, paint);
            canvas.restore();
        }
    }
}
