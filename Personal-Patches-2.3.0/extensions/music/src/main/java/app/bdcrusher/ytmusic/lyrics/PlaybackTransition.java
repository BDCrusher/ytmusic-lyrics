/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

final class PlaybackTransition {
    private PlaybackTransition() {}

    static long anchor(long reported, long previous, boolean sameRecording, boolean stateChanged) {
        // Some MediaSession producers reuse their last periodic position in the
        // pause and resume callbacks. Use the projected position at the event time
        // when the reported position has only fallen back by one periodic sample.
        long behind = previous - reported;
        return sameRecording && stateChanged && behind > 0 && behind <= 750 ? previous : reported;
    }
}
