# BDCrusher YT-Music personal patches

Full Collection with optional Shaders and Playlist downloads. Exact experimental target: original YouTube Music **9.42.52 / 94252240 arm64-v8a**.

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music&app=com.google.android.apps.youtube.music)** | [Release 0.4.0-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.4.0-beta.1)

## Update and selections

1. Enable Expert mode, then add or reuse this repository source in Morphe Manager 2.0.0 or newer.
2. Enable **Pre-release patches** and **Experimental app versions**, then refresh. Beta updates advance dev; main keeps its original bootstrap feed.
3. Review saved selections and use **Full Collection by itself**. Do not combine it with official Morphe or an old Lyrics-only Add-on source. The add-on is retired in this delivery; history remains available.
4. Repatch the original APK. Updating a source does not update an installed app.

| Expandable category | Selection |
| --- | --- |
| Full Collection | Use this collection by itself. Personal Third-party lyrics can be deselected. |
| Shaders | Optional; does not require personal lyrics. |
| Playlist downloads | Optional; requires Downloads and follows its existing mode/app selection. |

## Changes

Fix Lyrics inset ownership and settled panel geometry, move the resume-follow button with the expanding controls, and show compact inline source status in the same translucent dock. Preserve Braccato text motion. Shaders waits for a valid image, preserves native fallbacks and uses one silent cover decoder. Keep only artwork lookup/availability records and stream cover URLs; no retained animation-file library. Recognized old media cache files migrate out on initialization. Permanent best lyrics and private preferences remain.

Add **Lyrics and Shaders report** to Morphe Debugging: opt-in 60-second capture, Native/Fallback entry, source outcomes, line/callback timing, actual Android Window FrameMetrics and media/shader failures. Reports are bounded, redacted and private, with one saved last report. Swiping the Music task away from Recents requests pause/stop on this app's own media session; Home/Back keep ordinary background behavior.

Settings: **YouTube Music > Settings > Morphe > Lyrics / Shaders / Playlist downloads**. Debug capture: **Morphe > Miscellaneous > Debugging**, or the personal **Debugging** page when the native debugging patch is absent. Capture, reproduce without screen recording, then copy **Lyrics and Shaders report**. The Lyrics page also opens the report.

## Verification limits

Build/JVM/lint, nine catalog/application/invalid-selection cases, seven feature audits, four native Lyrics audits and 226 actual-source checks pass: 92 fresh and 134 inherited after exact source hashes match. Browser checks cover all 16 source formats, pinned reference Braccato motion/follow/seek, dock/status layout, actual Kawarp pacing/readiness/high DPI and graphics failure. Normal artwork verification/metadata lookup succeeded for MAMMAMIA; the final live test downloads no cover media.

**Phone acceptance is required.** Actual smoothness, Samsung navigation, panel/video/graphics behavior, streamed-cover looping, Recents audio-stop timing and real playlist downloading remain unverified. A raw fragmented-MP4 browser end-position assertion failed and is retained; it is not an Android streaming test. Previous combined-lyrics-service verification timeout remains a limitation. No universal zero-stutter claim; no device, MuMu, signing or installation operations occurred.

App-private permanent lyrics survive normal updates/restarts; clearing app data or uninstalling removes them. Artwork records remain small; normal native playback buffering can still occur.

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Implementation](IMPLEMENTATION.md) | [Exact checks](verification.json) | [Patch metadata](patches-list.json) | [Pins](SOURCE-PINS.json) | [Notices](THIRD-PARTY-NOTICES.txt)
