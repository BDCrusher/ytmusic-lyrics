/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic.diagnostics;

import static app.bdcrusher.ytmusic.diagnostics.CrashBreadcrumbs.Stage.MEDIA_STATE;
import static app.bdcrusher.ytmusic.diagnostics.CrashBreadcrumbs.Stage.PLAYER_RESPONSE;
import static org.junit.Assert.*;

import org.junit.Test;

public class CrashBreadcrumbsTest {
    @Test
    public void retainsLast96EventsInOrder() {
        var history = new CrashBreadcrumbs();
        for (int index = 0; index < 110; index++) {
            assertTrue(history.add(index, MEDIA_STATE, 3, index));
        }
        var events = history.snapshot(true);
        assertEquals(96, events.size());
        assertEquals(14, events.get(0).elapsedMs());
        assertEquals(109, events.get(events.size() - 1).detail());
    }

    @Test
    public void suppressesOnlyConsecutiveDuplicateEventsWithinOneSecond() {
        var history = new CrashBreadcrumbs();
        assertTrue(history.add(0, PLAYER_RESPONSE, 0, 0));
        assertFalse(history.add(999, PLAYER_RESPONSE, 0, 0));
        assertTrue(history.add(1000, PLAYER_RESPONSE, 0, 0));
        assertTrue(history.add(1001, MEDIA_STATE, 0, 0));
        assertTrue(history.add(1002, PLAYER_RESPONSE, 0, 0));
    }

    @Test
    public void previousSnapshotSurvivesDisablingCapture() {
        var history = new CrashBreadcrumbs();
        history.add(0, PLAYER_RESPONSE, 0, 0);
        var snapshot = history.snapshot(false);
        history.clear();
        assertTrue(history.snapshot(false).isEmpty());
        assertEquals(1, snapshot.size());
    }
}
