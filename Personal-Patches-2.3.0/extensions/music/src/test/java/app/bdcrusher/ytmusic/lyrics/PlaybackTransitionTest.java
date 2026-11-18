/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.lyrics;

import static org.junit.Assert.assertEquals;
import org.junit.Test;

public class PlaybackTransitionTest {
    @Test public void keepsProjectedTimeAtBoundaryIfHostReportsCoarsePosition() {
        assertEquals(4500, PlaybackTransition.anchor(4000, 4500, true, true));
    }

    @Test public void preservesNewRecordingAndLargeBackwardSeeks() {
        assertEquals(4000, PlaybackTransition.anchor(4000, 4500, false, true));
        assertEquals(3200, PlaybackTransition.anchor(3200, 4500, true, true));
    }

    @Test public void preservesNewerPositionsAndOrdinaryUpdates() {
        assertEquals(4600, PlaybackTransition.anchor(4600, 4500, true, true));
        assertEquals(4000, PlaybackTransition.anchor(4000, 4500, true, false));
    }
}
