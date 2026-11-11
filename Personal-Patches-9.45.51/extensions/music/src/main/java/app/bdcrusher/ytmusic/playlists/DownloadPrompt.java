/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.playlists;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.app.Dialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.os.Handler;
import android.os.Looper;
import android.text.format.Formatter;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.CheckBox;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.RadioButton;
import android.widget.ScrollView;
import android.widget.TextView;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import app.bdcrusher.ytmusic.common.PersonalRuntime;
import app.morphe.extension.music.patches.downloads.LocalDownloadManager;
import app.morphe.extension.music.patches.downloads.LocalDownloadManager.Choice;
import app.morphe.extension.music.patches.downloads.LocalDownloadManager.MediaOptions;
import app.morphe.extension.shared.Utils;
import app.morphe.extension.shared.innertube.PlayerResponseOuterClass.Format;
import app.morphe.extension.shared.theme.ThemeUtils;

/** Formats are resolved once per song. The sheet only submits choices from that response. */
public final class DownloadPrompt {
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final int ACCENT = 0xff3ea6ff;
    private static final long ANIMATION_MS = 180;
    private static WeakReference<Activity> foreground = new WeakReference<>(null);
    private static BatchChoice pending;
    private static Sheet single;

    private DownloadPrompt() {}

    public static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("bdcrusher_audio_downloads", Context.MODE_PRIVATE);
    }

    public static AudioQuality.Tier selected(Context context) {
        return AudioQuality.Tier.parse(preferences(context).getString("quality", "HIGH"));
    }

    public static MediaSelection selection(Context context) {
        return new MediaSelection(MediaSelection.Kind.AUDIO, selected(context), 1080);
    }

    /** Older batch records use their persisted media selection when explicitly resumed. */
    public static void playlist(Activity activity, String id, String title, Consumer<MediaSelection> start) {
        start.accept(selection(activity));
    }

    public static void playlist(Activity activity, String id, String title, Runnable start) {
        start.run();
    }

    public static boolean askBatchVideo(Context context) {
        return app.morphe.extension.music.settings.Settings.ASK_BATCH_DOWNLOAD_VIDEO.get();
    }

    public static void activityResumed(Activity activity) {
        foreground = new WeakReference<>(activity);
        showPending();
    }

    public static void activityPaused(Activity activity) {
        if (foreground.get() != activity) return;
        foreground.clear();
        if (pending != null && pending.sheet != null) {
            pending.sheet.close();
            pending.sheet = null;
        }
        if (single != null) {
            single.close();
            single = null;
        }
    }

    public static void song(String id) {
        MAIN.post(() -> {
            Activity activity = foreground.get();
            if (!usable(activity) || single != null || pending != null) return;
            Sheet sheet = new Sheet(activity, options -> LocalDownloadManager.enqueue(id, options.options, options.choice),
                    () -> single = null);
            single = sheet;
            sheet.show();
            Utils.submitOnBackgroundThread(() -> {
                MediaOptions options = LocalDownloadManager.mediaOptions(id, true);
                MAIN.post(() -> {
                    if (single == sheet) sheet.populate(options);
                });
                return null;
            });
        });
    }

    /** Called by the foreground download service. A background activity cannot launch a sheet. */
    public static Choice awaitBatchChoice(MediaOptions options, BooleanSupplier stopped) throws InterruptedException {
        BatchChoice request = new BatchChoice(options);
        MAIN.post(() -> {
            if (request.answer.isDone()) return;
            if (pending != null) {
                request.answer.complete(null);
                return;
            }
            pending = request;
            showPending();
        });
        try {
            while (!stopped.getAsBoolean()) {
                try {
                    return request.answer.get(300, TimeUnit.MILLISECONDS);
                } catch (TimeoutException waiting) {
                    // The batch is still running and will resume after a foreground choice.
                } catch (ExecutionException failure) {
                    return null;
                }
            }
            return null;
        } finally {
            request.answer.complete(null);
            MAIN.post(() -> {
                if (pending != request) return;
                if (request.sheet != null) request.sheet.close();
                pending = null;
            });
        }
    }

    private static boolean usable(Activity activity) {
        return activity != null && !activity.isFinishing() && !activity.isDestroyed();
    }

    private static void showPending() {
        Activity activity = foreground.get();
        BatchChoice request = pending;
        if (!usable(activity) || request == null || request.sheet != null || request.answer.isDone()) return;
        if (single != null) {
            single.close();
            single = null;
        }
        request.sheet = new Sheet(activity, selected -> request.answer.complete(selected.choice),
                () -> request.answer.complete(null));
        request.sheet.show();
        request.sheet.populate(request.options);
    }

    private static final class BatchChoice {
        final MediaOptions options;
        final CompletableFuture<Choice> answer = new CompletableFuture<>();
        Sheet sheet;

        BatchChoice(MediaOptions options) {
            this.options = options;
        }
    }

    private record Selection(MediaOptions options, Choice choice) {}
    private record Quality(String label, Choice choice, String size) {}

    private static final class Sheet {
        final Activity activity;
        final Dialog dialog;
        final LinearLayout root;
        final FrameLayout tabArea;
        final LinearLayout tabs;
        final View indicator;
        final LinearLayout rows;
        final TextView download;
        final CheckBox remember;
        final Consumer<Selection> accept;
        final Runnable cancel;
        final int foregroundColor = ThemeUtils.getAppForegroundColor();
        final int background = ThemeUtils.getAppBackgroundColor();
        final List<Quality> audio = new ArrayList<>();
        final List<Quality> video = new ArrayList<>();
        MediaOptions options;
        Quality selected;
        boolean showingVideo;

        Sheet(Activity activity, Consumer<Selection> accept, Runnable cancel) {
            this.activity = activity;
            this.accept = accept;
            this.cancel = cancel;
            dialog = new Dialog(activity);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);
            dialog.setOnCancelListener(ignored -> cancel.run());

            root = new LinearLayout(activity);
            root.setOrientation(LinearLayout.VERTICAL);
            root.setPadding(dp(20), dp(10), dp(20), dp(16));
            root.setBackground(shape(background, 24, 0));
            TextView handle = text("", 0, foregroundColor);
            handle.setBackground(shape(foregroundColor & 0x55ffffff, 3, 0));
            LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(dp(36), dp(4));
            handleParams.gravity = Gravity.CENTER_HORIZONTAL;
            root.addView(handle, handleParams);
            TextView heading = text("Download quality", 24, foregroundColor);
            heading.setPadding(0, dp(18), 0, dp(12));
            if (android.os.Build.VERSION.SDK_INT >= 28) heading.setAccessibilityHeading(true);
            root.addView(heading);
            tabArea = new FrameLayout(activity);
            tabs = new LinearLayout(activity);
            tabArea.addView(tabs, new FrameLayout.LayoutParams(-1, -2));
            indicator = new View(activity);
            indicator.setBackground(shape(ACCENT, 2, 0));
            indicator.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            tabArea.addView(indicator, new FrameLayout.LayoutParams(0, dp(3), Gravity.BOTTOM));
            root.addView(tabArea);
            tabArea.setVisibility(View.GONE);
            tabArea.addOnLayoutChangeListener((view, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
                if (right - left != oldRight - oldLeft) moveIndicator(false);
            });
            ScrollView scroll = new ScrollView(activity) {
                @Override protected void onMeasure(int width, int height) {
                    int limit = (int) (getResources().getDisplayMetrics().heightPixels * .48f);
                    super.onMeasure(width, MeasureSpec.makeMeasureSpec(limit, MeasureSpec.AT_MOST));
                }
            };
            rows = new LinearLayout(activity);
            rows.setOrientation(LinearLayout.VERTICAL);
            scroll.addView(rows);
            root.addView(scroll);
            ProgressBar loading = new ProgressBar(activity);
            loading.setContentDescription("Loading download qualities");
            LinearLayout.LayoutParams loadingParams = new LinearLayout.LayoutParams(dp(32), dp(48));
            loadingParams.gravity = Gravity.CENTER_HORIZONTAL;
            rows.addView(loading, loadingParams);

            remember = new CheckBox(activity);
            divider();
            remember.setText("Remember my settings");
            remember.setTextColor(foregroundColor);
            root.addView(remember);
            divider();
            LinearLayout actions = new LinearLayout(activity);
            TextView cancelButton = button("Cancel", ACCENT, background, foregroundColor & 0x44ffffff);
            download = button("Download", Color.BLACK, ACCENT, 0);
            download.setEnabled(false);
            addAction(actions, cancelButton);
            addAction(actions, download);
            cancelButton.setOnClickListener(view -> { cancel.run(); close(); });
            download.setOnClickListener(view -> {
                if (selected == null) return;
                if (remember.isChecked()) preferences(activity).edit()
                        .putInt(showingVideo ? "videoItag" : "audioItag",
                                showingVideo ? selected.choice.video().getItag() : selected.choice.audio().getItag()).apply();
                accept.accept(new Selection(options, selected.choice));
                close();
                if (single == this) single = null;
            });
            root.addView(actions);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                root.setPadding(dp(20), dp(10), dp(20), dp(16) + insets.getSystemWindowInsetBottom());
                return insets;
            });
            dialog.setContentView(root);
        }

        void show() {
            Window window = dialog.getWindow();
            if (window != null) {
                window.setBackgroundDrawableResource(android.R.color.transparent);
                window.setGravity(Gravity.BOTTOM);
                window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
                window.setDimAmount(.45f);
            }
            dialog.show();
            PersonalRuntime.dialog(dialog);
            if (window != null) window.setLayout(-1, -2);
        }

        void close() {
            dialog.dismiss();
        }

        void populate(MediaOptions options) {
            this.options = options;
            List<Format> sounds = options.formats().stream()
                    .filter(AudioQuality::opus)
                    .sorted(Comparator.comparingInt(Format::getBitrate).reversed())
                    .collect(java.util.stream.Collectors.toList());
            for (Format f : sounds) {
                String codec = f.getMimeType().contains("webm") ? "Opus" : "AAC";
                String label = f.getBitrate() > 0 ? codec + " · " + Math.round(f.getBitrate() / 1000f) + " kbps" : codec;
                audio.add(new Quality(label, new Choice(f, null), size(f, null)));
            }
            Format selectedAudio = AudioQuality.select(sounds, DownloadPrompt.selected(activity));
            if (selectedAudio == null) {
                selectedAudio = LocalDownloadManager.bestAudio(options);
            }
            if (selectedAudio != null) {
                int rememberedAudio = preferences(activity).getInt("audioItag", -1);
                for (Format f : sounds) if (f.getItag() == rememberedAudio) selectedAudio = f;
                for (Format f : MediaSelection.videos(options.formats(), DownloadCatalog::videoSupported)) {
                    video.add(new Quality(MediaSelection.height(f) + "p", new Choice(selectedAudio, f), size(selectedAudio, f)));
                }
            }
            switchTab(false, false);
        }

        private String size(Format sound, Format picture) {
            long bytes = AudioQuality.estimate(sound, options.seconds());
            long extra = picture == null ? 0 : AudioQuality.estimate(picture, options.seconds());
            if (bytes <= 0 || extra < 0) return "Size unavailable";
            boolean estimate = sound.getContentLength() <= 0 || picture != null && picture.getContentLength() <= 0;
            return (estimate ? "≈ " : "") + Formatter.formatShortFileSize(activity, bytes + extra);
        }

        private void switchTab(boolean useVideo, boolean animate) {
            showingVideo = useVideo;
            tabArea.setVisibility(View.VISIBLE);
            if (tabs.getChildCount() == 0) {
                addTab("Audio", false);
                if (!video.isEmpty()) addTab("Video", true);
            }
            for (int i = 0; i < tabs.getChildCount(); i++) tabs.getChildAt(i).setSelected(i == (useVideo ? 1 : 0));
            moveIndicator(animate);
            rows.removeAllViews();
            List<Quality> choices = useVideo ? video : audio;
            selected = choices.isEmpty() ? null : choices.get(0);
            int remembered = preferences(activity).getInt(useVideo ? "videoItag" : "audioItag", -1);
            Format preferred = useVideo ? null : AudioQuality.select(options.formats(), DownloadPrompt.selected(activity));
            if (useVideo) {
                int height = preferences(activity).getInt("videoHeight", 1080);
                for (Quality row : choices) {
                    if (MediaSelection.height(row.choice.video()) <= height) {
                        selected = row;
                        break;
                    }
                }
            }
            for (Quality row : choices) {
                Format stream = useVideo ? row.choice.video() : row.choice.audio();
                if (stream.getItag() == (remembered >= 0 ? remembered : preferred == null ? -1 : preferred.getItag())) selected = row;
            }
            List<RadioButton> buttons = new ArrayList<>();
            if (selected == null) rows.addView(text("No compatible Opus download available", 16, foregroundColor));
            for (Quality quality : choices) addQuality(quality, buttons);
            download.setEnabled(selected != null);
            if (animate && ValueAnimator.areAnimatorsEnabled()) {
                rows.animate().cancel();
                rows.setAlpha(0.35f);
                rows.animate().alpha(1f).setDuration(ANIMATION_MS).start();
            }
        }

        private void addTab(String label, boolean forVideo) {
            TextView tab = button(label, foregroundColor, background, 0);
            tab.setSelected(forVideo == showingVideo);
            tab.setOnClickListener(view -> {
                if (showingVideo != forVideo) switchTab(forVideo, true);
            });
            addAction(tabs, tab);
        }

        private void moveIndicator(boolean animate) {
            int width = tabArea.getWidth();
            if (width == 0 || tabArea.getVisibility() != View.VISIBLE) return;
            indicator.animate().cancel();
            android.view.ViewGroup.LayoutParams layout = indicator.getLayoutParams();
            int targetWidth = Math.max(0, width / Math.max(1, tabs.getChildCount()) - dp(8));
            if (layout.width != targetWidth) {
                layout.width = targetWidth;
                indicator.setLayoutParams(layout);
            }
            View activeTab = tabs.getChildAt(showingVideo ? 1 : 0);
            float target = activeTab == null ? dp(4) : activeTab.getLeft();
            if (animate && ValueAnimator.areAnimatorsEnabled()) {
                indicator.animate().translationX(target).setDuration(ANIMATION_MS).start();
            } else {
                indicator.setTranslationX(target);
            }
        }

        private void divider() {
            View line = new View(activity);
            line.setBackgroundColor(foregroundColor & 0x28ffffff);
            root.addView(line, new LinearLayout.LayoutParams(-1, dp(1)));
        }

        private void addQuality(Quality quality, List<RadioButton> buttons) {
            LinearLayout row = new LinearLayout(activity);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setMinimumHeight(dp(56));
            row.setBackground(ripple(Color.TRANSPARENT, 12, 0));
            RadioButton radio = new RadioButton(activity);
            radio.setButtonTintList(ColorStateList.valueOf(ACCENT));
            radio.setChecked(quality == selected);
            buttons.add(radio);
            row.addView(radio);
            row.addView(text(quality.label, 17, foregroundColor), new LinearLayout.LayoutParams(0, -2, 1));
            row.addView(text(quality.size, 15, foregroundColor));
            row.setContentDescription(quality.label + ", " + quality.size);
            radio.setContentDescription(quality.label + ", " + quality.size);
            View.OnClickListener select = view -> {
                selected = quality;
                for (RadioButton button : buttons) button.setChecked(button == radio);
            };
            row.setOnClickListener(select);
            radio.setOnClickListener(select);
            rows.addView(row);
        }

        private void addAction(LinearLayout row, TextView action) {
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, dp(48), 1);
            params.setMargins(dp(4), dp(4), dp(4), dp(4));
            row.addView(action, params);
        }

        private TextView button(String title, int textColor, int fill, int stroke) {
            TextView button = text(title, 16, textColor);
            button.setGravity(Gravity.CENTER);
            button.setBackground(ripple(fill, 24, stroke));
            return button;
        }

        private TextView text(String value, int size, int color) {
            TextView view = new TextView(activity);
            view.setText(value);
            view.setTextSize(size);
            view.setTextColor(color);
            return view;
        }

        private RippleDrawable ripple(int fill, int radius, int stroke) {
            return new RippleDrawable(ColorStateList.valueOf(foregroundColor & 0x28ffffff),
                    shape(fill, radius, stroke), shape(Color.WHITE, radius, 0));
        }

        private GradientDrawable shape(int color, int radius, int stroke) {
            GradientDrawable shape = new GradientDrawable();
            shape.setColor(color);
            shape.setCornerRadius(dp(radius));
            if (stroke != 0) shape.setStroke(dp(1), stroke);
            return shape;
        }

        private int dp(int value) {
            return Math.round(value * activity.getResources().getDisplayMetrics().density);
        }
    }
}
