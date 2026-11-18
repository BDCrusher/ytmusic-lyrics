/* Copyright 2026 BDCrusher. GPL-3.0. */
package app.bdcrusher.ytmusic

import app.bdcrusher.ytmusic.playlists.AudioQuality
import app.bdcrusher.ytmusic.playlists.MediaSelection
import app.morphe.extension.shared.innertube.PlayerResponseOuterClass.Format
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class DownloadQualityTest {
    @Test
    fun rememberedAudioTierChoosesOnlyRealOpusStreams() {
        val low = sound(249, 48000)
        val standard = sound(250, 96000)
        val high = sound(251, 160000)
        val aac = sound(140, 256000).toBuilder().setMimeType("audio/mp4; codecs=mp4a.40.2").build()
        val formats = listOf(aac, high, low, standard)
        assertEquals(high, AudioQuality.select(formats, AudioQuality.Tier.HIGH))
        assertEquals(standard, AudioQuality.select(formats, AudioQuality.Tier.STANDARD))
        assertEquals(low, AudioQuality.select(formats, AudioQuality.Tier.LOW))
        assertNull(AudioQuality.select(listOf(aac), AudioQuality.Tier.HIGH))
    }

    @Test
    fun videoDefaultUses1080OrTheHighestCompatibleLowerResolution() {
        val selection = MediaSelection(MediaSelection.Kind.VIDEO, AudioQuality.Tier.HIGH, 1080)
        val small = picture(720)
        val full = picture(1080)
        val larger = picture(2160)
        assertEquals(full, selection.chooseVideo(listOf(small, larger, full)) { true })
        assertEquals(small, selection.chooseVideo(listOf(small, larger)) { true })
        assertNull(selection.chooseVideo(listOf(small, larger)) { false })
    }

    @Test
    fun sizesIncludeBothStreamsAndUnknownSizesRemainUnknown() {
        val audio = sound(251, 160000).toBuilder().setContentLength(1000).build()
        val video = picture(1080).toBuilder().setContentLength(9000).build()
        val selection = MediaSelection(MediaSelection.Kind.VIDEO, AudioQuality.Tier.HIGH, 1080)
        assertEquals(10000L, selection.estimate(listOf(audio, video), 10) { true })
        assertEquals(200000L, AudioQuality.estimate(sound(251, 160000), 10))
        assertEquals(-1L, AudioQuality.estimate(sound(251, 0), 10))
    }

    private fun sound(itag: Int, bitrate: Int): Format = Format.newBuilder()
        .setItag(itag).setMimeType("audio/webm; codecs=opus")
        .setBitrate(bitrate).setUrl("https://fixture.invalid/stream").build()

    private fun picture(height: Int): Format = Format.newBuilder()
        .setItag(height).setMimeType("video/webm; codecs=vp9").setWidth(height * 16 / 9)
        .setHeight(height).setUrl("https://fixture.invalid/video").build()
}
