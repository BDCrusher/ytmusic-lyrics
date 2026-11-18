/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.diagnostics;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.media.AudioTrack;
import android.media.MediaMetadata;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Process;
import android.os.SystemClock;
import android.util.AtomicFile;
import androidx.annotation.RequiresApi;
import app.morphe.extension.shared.Utils;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Pattern;
import app.bdcrusher.ytmusic.diagnostics.CrashBreadcrumbs.Stage;

/** Crash capture uses Android APIs directly and never calls Morphe's logger. */
public final class PlaybackCrashRecorder {
    @android.annotation.SuppressLint("StaticFieldLeak") // Retains the process application context only.
    private static volatile PlaybackCrashRecorder instance;
    private static final int MAX_READ_BYTES = 32_768;
    private static final long FLUSH_DELAY_MS = 750;
    private static final Pattern SYSTEM_FRAME = Pattern.compile(
            "[ \\t]+at [A-Za-z0-9_.$<>/-]+\\([A-Za-z0-9_.$:/ -]+\\)");
    private final AtomicBoolean scheduled = new AtomicBoolean();
    private final AtomicBoolean crashing = new AtomicBoolean();
    private final CrashBreadcrumbs breadcrumbs = new CrashBreadcrumbs();
    private final Context context;
    private final Handler worker;
    private final AtomicFile current;
    private final AtomicFile previous;
    private final AtomicFile lastCrash;
    private final long startElapsedMs = SystemClock.elapsedRealtime();
    private final long startWallMs = System.currentTimeMillis();
    private final String identity;
    private volatile boolean enabled;

    private PlaybackCrashRecorder(Context context) {
        this.context = context;
        File folder = new File(context.getNoBackupFilesDir(), "bdcrusher-crash");
        current = new AtomicFile(new File(folder, "current.txt"));
        previous = new AtomicFile(new File(folder, "previous.txt"));
        lastCrash = new AtomicFile(new File(folder, "last-crash.txt"));
        identity = readIdentity(context);
        enabled = context.getSharedPreferences("bdcrusher-crash", Context.MODE_PRIVATE).getBoolean("capture", true);
        HandlerThread thread = new HandlerThread("Music crash records", Process.THREAD_PRIORITY_BACKGROUND);
        thread.start();
        worker = new Handler(thread.getLooper());
        worker.post(() -> {
            try {
                String saved = read(current);
                if (!saved.isEmpty()) {
                    write(previous, saved);
                    current.delete();
                }
            } catch (IOException | RuntimeException ignored) {
                // Capture and the existing crash handler can still operate.
            }
        });
    }

    public static synchronized void install(Activity activity) {
        if (instance != null) return;
        try {
            var recorder = new PlaybackCrashRecorder(activity.getApplicationContext());
            instance = recorder;
            recorder.installHandler();
            event(Stage.APP_START, 0, 0);
        } catch (RuntimeException ignored) {
            // A diagnostics failure should never interrupt Music startup.
        }
    }

    private void installHandler() {
        Thread.UncaughtExceptionHandler original = Thread.getDefaultUncaughtExceptionHandler();
        if (original == null) return;
        Thread.setDefaultUncaughtExceptionHandler((thread, failure) -> {
            try {
                if (enabled && crashing.compareAndSet(false, true)) {
                    write(lastCrash, fatalReport(thread, failure));
                }
            } catch (Throwable ignored) {
                // Even an out-of-memory or linkage failure must reach Android.
            } finally {
                original.uncaughtException(thread, failure);
            }
        });
    }

    public static void onTrackResponse() {
        event(Stage.PLAYER_RESPONSE, 0, 0);
    }

    public static void onMetadata(MediaMetadata metadata) {
        try {
            if (captureEnabled() && metadata != null) {
                event(Stage.TRACK_METADATA, metadata.getLong(MediaMetadata.METADATA_KEY_DURATION), 0);
            }
        } catch (RuntimeException ignored) {}
    }

    public static void onPlayback(PlaybackState playback) {
        try {
            if (captureEnabled() && playback != null) event(Stage.MEDIA_STATE, playback.getState(), playback.getPosition());
        } catch (RuntimeException ignored) {}
    }

    public static void onAudioOutput(AudioTrack track) {
        try {
            if (captureEnabled() && track != null) event(Stage.AUDIO_OUTPUT, track.getSampleRate(), track.getChannelCount());
        } catch (RuntimeException ignored) {}
    }

    public static void onAudioStarted() {
        event(Stage.AUDIO_STARTED, 0, 0);
    }

    private static void event(Stage stage, long value, long detail) {
        var recorder = instance;
        if (recorder == null || !recorder.enabled) return;
        try {
            if (recorder.breadcrumbs.add(SystemClock.elapsedRealtime() - recorder.startElapsedMs, stage, value, detail)
                    && recorder.scheduled.compareAndSet(false, true)) {
                recorder.worker.postDelayed(recorder::flush, FLUSH_DELAY_MS);
            }
        } catch (RuntimeException ignored) {
            // Recording an event must not change playback.
        }
    }

    private void flush() {
        scheduled.set(false);
        if (!enabled) return;
        try {
            write(current, identity + "\n" + timeline(breadcrumbs.snapshot(false)));
        } catch (IOException | RuntimeException ignored) {
            // The next event retries the snapshot.
        }
    }

    static boolean captureEnabled() {
        var recorder = instance;
        return recorder != null && recorder.enabled;
    }

    static void setCaptureEnabled(boolean enabled) {
        var recorder = instance;
        if (recorder == null) return;
        recorder.context.getSharedPreferences("bdcrusher-crash", Context.MODE_PRIVATE)
                .edit().putBoolean("capture", enabled).apply();
        recorder.enabled = enabled;
        if (enabled) event(Stage.CAPTURE_RESUMED, 0, 0);
        else {
            recorder.breadcrumbs.clear();
            recorder.worker.post(recorder.current::delete);
        }
    }

    private String fatalReport(Thread thread, Throwable failure) {
        var report = new StringBuilder(identity).append("\nCrash UTC epoch ms ").append(System.currentTimeMillis())
                .append("\nThread ").append(thread == android.os.Looper.getMainLooper().getThread() ? "main" : "background");
        var seen = Collections.newSetFromMap(new IdentityHashMap<Throwable, Boolean>());
        for (int depth = 0; failure != null && depth < 5 && seen.add(failure); depth++, failure = failure.getCause()) {
            report.append("\n").append(failure.getClass().getName()).append("\n");
            StackTraceElement[] stack = failure.getStackTrace();
            for (int i = 0; i < Math.min(stack.length, 32); i++) {
                var frame = stack[i];
                report.append("  at ").append(frame.getClassName()).append('.').append(frame.getMethodName())
                        .append(':').append(frame.getLineNumber()).append('\n');
            }
            if (report.length() >= MAX_READ_BYTES / 2) break;
        }
        return report.append("\n").append(timeline(breadcrumbs.snapshot(true))).toString();
    }

    private static String timeline(List<CrashBreadcrumbs.Entry> events) {
        var out = new StringBuilder("Playback steps (milliseconds since startup)\n");
        for (var event : events) {
            out.append('+').append(event.elapsedMs()).append("  ").append(event.stage());
            switch (event.stage()) {
                case TRACK_METADATA -> out.append(" durationMs=").append(event.value());
                case MEDIA_STATE -> out.append(' ').append(stateName(event.value())).append(" positionMs=").append(event.detail());
                case AUDIO_OUTPUT -> out.append(" sampleRate=").append(event.value()).append(" channels=").append(event.detail());
                default -> {}
            }
            out.append('\n');
        }
        return out.toString();
    }

    private static String stateName(long state) {
        return switch ((int) state) {
            case PlaybackState.STATE_NONE -> "none";
            case PlaybackState.STATE_STOPPED -> "stopped";
            case PlaybackState.STATE_PAUSED -> "paused";
            case PlaybackState.STATE_PLAYING -> "playing";
            case PlaybackState.STATE_BUFFERING -> "buffering";
            case PlaybackState.STATE_CONNECTING -> "connecting";
            case PlaybackState.STATE_ERROR -> "error";
            default -> Long.toString(state);
        };
    }

    static void saveReport(android.net.Uri uri, java.util.function.Consumer<Boolean> completion) {
        var recorder = instance;
        if (recorder == null) {
            completion.accept(false);
            return;
        }
        recorder.worker.post(() -> {
            boolean saved = false;
            try (var output = recorder.context.getContentResolver().openOutputStream(uri, "wt")) {
                if (output != null) {
                    output.write(recorder.report().getBytes(StandardCharsets.UTF_8));
                    saved = true;
                }
            } catch (IOException | RuntimeException ignored) {
                saved = false;
            }
            boolean result = saved;
            new Handler(android.os.Looper.getMainLooper()).post(() -> completion.accept(result));
        });
    }

    private String report() throws IOException {
        var out = new StringBuilder("BDCrusher Music crash report\n").append(identity);
        out.append("\n\nLatest captured Java crash\n").append(read(lastCrash));
        out.append("\nPrevious process playback steps\n").append(read(previous));
        out.append("\nCurrent process playback steps\n").append(timeline(breadcrumbs.snapshot(false)));
        if (Build.VERSION.SDK_INT >= 30) appendAndroidExits(out);
        return out.toString();
    }

    @RequiresApi(30)
    private void appendAndroidExits(StringBuilder out) {
        out.append("\nAndroid process exit records\n");
        try {
            ActivityManager manager = context.getSystemService(ActivityManager.class);
            if (manager == null) return;
            boolean includedTrace = false;
            for (ApplicationExitInfo exit : manager.getHistoricalProcessExitReasons(context.getPackageName(), 0, 5)) {
                int reason = exit.getReason();
                out.append("epochMs=").append(exit.getTimestamp()).append(" pid=").append(exit.getPid())
                        .append(" reason=").append(exitReason(reason)).append(" status=").append(exit.getStatus())
                        .append(" rssKiB=").append(exit.getRss()).append(" pssKiB=").append(exit.getPss()).append('\n');
                if (!includedTrace && reason == ApplicationExitInfo.REASON_ANR) {
                    includedTrace = appendAnrFrames(out, exit);
                }
            }
        } catch (RuntimeException unavailable) {
            out.append("Android exit records unavailable\n");
        }
    }

    @RequiresApi(30)
    private static boolean appendAnrFrames(StringBuilder out, ApplicationExitInfo exit) {
        try (InputStream trace = exit.getTraceInputStream()) {
            if (trace == null) return false;
            String text = readBounded(trace, MAX_READ_BYTES);
            var frames = new StringBuilder();
            for (String line : text.split("\\R")) {
                if (line.length() <= 300 && SYSTEM_FRAME.matcher(line).matches()) frames.append(line).append('\n');
                if (frames.length() >= 5_000) break;
            }
            if (frames.length() == 0) return false;
            out.append("ANR stack frames\n").append(frames);
            return true;
        } catch (IOException | RuntimeException unavailable) {
            return false;
        }
    }

    @RequiresApi(30)
    private static String exitReason(int reason) {
        return switch (reason) {
            case ApplicationExitInfo.REASON_CRASH -> "Java crash";
            case ApplicationExitInfo.REASON_CRASH_NATIVE -> "Native crash";
            case ApplicationExitInfo.REASON_ANR -> "App not responding";
            case ApplicationExitInfo.REASON_LOW_MEMORY -> "Low memory";
            case ApplicationExitInfo.REASON_SIGNALED -> "Signal";
            case ApplicationExitInfo.REASON_USER_REQUESTED -> "User requested";
            default -> Integer.toString(reason);
        };
    }

    private String readIdentity(Context context) {
        String patch = "unknown";
        try (var asset = context.getAssets().open("bdcrusher-features/crash-diagnostics.txt")) {
            patch = readBounded(asset, 256).trim();
        } catch (IOException ignored) {}
        String version = "unknown";
        try {
            var info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            version = info.versionName + "/" + code;
        } catch (android.content.pm.PackageManager.NameNotFoundException ignored) {}
        String runtime = "unknown";
        try {
            runtime = Utils.getPatchesReleaseVersion();
        } catch (LinkageError | RuntimeException ignored) {}
        return patch + "\nMorphe runtime " + runtime + "\nApp " + context.getPackageName() + " " + version
                + " · Android SDK " + Build.VERSION.SDK_INT + " · PID " + Process.myPid()
                + "\nProcess start UTC epoch ms " + startWallMs + "\n";
    }

    private static String read(AtomicFile file) throws IOException {
        try (var stream = file.openRead()) {
            return readBounded(stream, MAX_READ_BYTES);
        } catch (FileNotFoundException absent) {
            return "";
        }
    }

    private static String readBounded(InputStream input, int limit) throws IOException {
        byte[] buffer = new byte[limit];
        int total = 0;
        while (total < buffer.length) {
            int count = input.read(buffer, total, buffer.length - total);
            if (count <= 0) break;
            total += count;
        }
        return new String(buffer, 0, total, StandardCharsets.UTF_8);
    }

    private static void write(AtomicFile file, String content) throws IOException {
        byte[] data = content.getBytes(StandardCharsets.UTF_8);
        FileOutputStream stream = file.startWrite();
        boolean success = false;
        try {
            stream.write(data, 0, Math.min(data.length, MAX_READ_BYTES));
            success = true;
        } finally {
            if (success) file.finishWrite(stream);
            else file.failWrite(stream);
        }
    }
}
