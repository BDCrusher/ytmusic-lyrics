/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import app.morphe.extension.music.patches.lyrics.model.TrackInfo;
import org.junit.Test;

import static org.junit.Assert.*;

public class LyricsTrackBindingTest {
    private static final String A = "aaaaaaaaaaa";
    private static final String B = "bbbbbbbbbbb";
    private static final String C = "ccccccccccc";
    private static final TrackInfo FIRST = new TrackInfo("First", "Artist", "Album", 120);
    private static final TrackInfo SECOND = new TrackInfo("Second", "Artist", "", 180);

    @Test
    public void previousTitleDoesNotFollowNewPlaybackId() {
        var binding = new LyricsTrackBinding();
        binding.metadata(A, null, FIRST);
        assertEquals(FIRST, binding.track(A));
        assertNull(binding.track(B));
        binding.metadata(B, null, FIRST);
        assertNull(binding.track(B));
        binding.metadata(B, null, SECOND);
        assertEquals(SECOND, binding.track(B));
        binding.metadata(B, null, FIRST);
        assertEquals(SECOND, binding.track(B));
    }

    @Test
    public void taggedMetadataMayArriveBeforeItsPlaybackId() {
        var binding = new LyricsTrackBinding();
        binding.metadata(A, A, FIRST);
        binding.metadata(A, B, SECOND);
        binding.metadata(A, A, FIRST);
        assertEquals(FIRST, binding.track(A));
        assertEquals(SECOND, binding.track(B));
        assertNull(binding.track(C));
        binding.metadata(C, null, SECOND);
        assertNull(binding.track(C));
    }

    @Test
    public void aTagCanConfirmASecondRecordingOfTheSameSong() {
        var binding = new LyricsTrackBinding();
        binding.metadata(A, A, FIRST);
        TrackInfo otherVersion = new TrackInfo(FIRST.title(), FIRST.artist(), "", 0);
        binding.metadata(A, B, otherVersion);
        TrackInfo second = binding.track(B);
        assertEquals(FIRST, second);
        assertEquals(0, second.durationSeconds());
        assertEquals("", second.album());
    }

    @Test
    public void titleChangeWithoutATagCannotReassignActiveRecording() {
        var binding = new LyricsTrackBinding();
        binding.metadata(A, null, FIRST);
        binding.metadata(A, null, SECOND);
        assertEquals(FIRST, binding.track(A));
        binding.metadata(A, A, SECOND);
        assertEquals(SECOND, binding.track(A));
    }

    @Test
    public void emptyDurationAndAlbumDoNotEraseAnEarlierExactSample() {
        var binding = new LyricsTrackBinding();
        binding.metadata(A, A, FIRST);
        binding.metadata(A, A, new TrackInfo(FIRST.title(), FIRST.artist(), "", 0));
        TrackInfo track = binding.track(A);
        assertEquals(120, track.durationSeconds());
        assertEquals("Album", track.album());
    }
}
