/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.morphe.extension.music.patches.downloads

import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull

class PlaylistOccurrencesTest {
    @Test
    fun repeatedEntriesSurviveContinuationAndUnavailablePositions() {
        val repeated = "sN_tJ8d3c0I"
        val other = "MYal8NoVQXs"
        val rows = mutableListOf<PlaylistTracksRequest.Entry>()
        val first = JSONObject().put("contents", JSONArray().put(row(repeated)).put(row("", false)).put(next("page-2")))
        assertEquals("page-2", PlaylistTracksRequest.parseTracks(first, rows))

        val append = JSONObject().put("appendContinuationItemsAction",
            JSONObject().put("continuationItems", JSONArray().put(row(other)).put(row(repeated))))
        val second = JSONObject().put("onResponseReceivedActions", JSONArray().put(append))
        assertNull(PlaylistTracksRequest.parseContinuation(second, rows))
        assertEquals(listOf(repeated, "", other, repeated), rows.map { it.id() })
        assertFalse(rows[1].available())
        val result = PlaylistTracksRequest.Result("Ordered fixture", rows, true)
        assertEquals(listOf(repeated, other), result.videoIds())
        rows.clear()
        assertEquals(4, result.entries().size)
    }

    @Test
    fun malformedContinuationIsAnErrorWithoutReplacingPreviousRows() {
        val rows = mutableListOf(PlaylistTracksRequest.Entry("sN_tJ8d3c0I", "Track", true))
        assertFailsWith<JSONException> {
            PlaylistTracksRequest.parseContinuation(JSONObject().put("responseContext", JSONObject()), rows)
        }
        assertEquals(1, rows.size)
    }

    private fun row(id: String, available: Boolean = true): JSONObject =
        JSONObject().put("musicResponsiveListItemRenderer", JSONObject()
            .put("playlistItemData", JSONObject().put("videoId", id))
            .put("musicItemRendererDisplayPolicy", if (available) "" else "MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT"))

    private fun next(token: String): JSONObject =
        JSONObject().put("continuationItemRenderer",
            JSONObject().put("continuationEndpoint", JSONObject()
                .put("continuationCommand", JSONObject().put("token", token))))
}
