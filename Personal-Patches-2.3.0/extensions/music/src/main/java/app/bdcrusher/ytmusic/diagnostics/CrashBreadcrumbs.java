/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.diagnostics;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;

/** Bounded playback history. Messages use fixed event names and numeric fields. */
final class CrashBreadcrumbs {
    private static final int LIMIT = 96;
    private static final long REPEAT_WINDOW_MS = 1_000;
    private final ReentrantLock lock = new ReentrantLock();
    private final ArrayDeque<Entry> entries = new ArrayDeque<>();

    enum Stage { APP_START, CAPTURE_RESUMED, PLAYER_RESPONSE, TRACK_METADATA, MEDIA_STATE, AUDIO_OUTPUT, AUDIO_STARTED }

    record Entry(long elapsedMs, Stage stage, long value, long detail) {}

    boolean add(long elapsedMs, Stage stage, long value, long detail) {
        lock.lock();
        try {
            Entry previous = entries.peekLast();
            if (previous != null && elapsedMs - previous.elapsedMs() < REPEAT_WINDOW_MS
                    && previous.stage() == stage && previous.value() == value && previous.detail() == detail) {
                return false;
            }
            if (entries.size() == LIMIT) entries.removeFirst();
            entries.addLast(new Entry(elapsedMs, stage, value, detail));
            return true;
        } finally {
            lock.unlock();
        }
    }

    List<Entry> snapshot(boolean fromCrashHandler) {
        if (fromCrashHandler) {
            if (!lock.tryLock()) return Collections.emptyList();
        } else {
            lock.lock();
        }
        try {
            return Collections.unmodifiableList(new ArrayList<>(entries));
        } finally {
            lock.unlock();
        }
    }

    void clear() {
        lock.lock();
        try {
            entries.clear();
        } finally {
            lock.unlock();
        }
    }
}
