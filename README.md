# BDCrusher YT-Music personal patches

One Morphe source with four expandable categories. Exact experimental target: original YouTube Music **9.42.52 / 94252240 arm64-v8a**.

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music)** | [Release 0.3.0-beta.2](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.3.0-beta.2)

## Fixes in this release

One native animated-cover decoder replaces competing HTML video players. Complete animation fitting and native timeline finalization address fragmented service files such as MAMMAMIA. Existing cached loops are repaired without downloading them again. Player/Lyrics backgrounds use Kawarp motion over still artwork or a first-frame fallback, capped at 960 pixels on the longest edge.

Fix settings text showing through the Morphe screen. Extend the native Lyrics body behind transparent navigation, apply safe insets once, place the collapsed opener at the bottom and keep the compact status popup above the controls. Preserve Braccato text motion and remove redundant host work and continuous control blur.

## Categories and selections

| Category | Selection |
| --- | --- |
| Full Collection | Use by itself; do not select Lyrics-only or official collection patches. |
| Lyrics-only Add-on | Deselect every Full patch. Use official Morphe 1.48.0 defaults with official Third-party lyrics OFF. |
| Shaders | Optional; works with either edition or official patches, including official lyrics. Does not enable personal lyrics. |
| Playlist downloads | Optional; requires compatible Downloads and follows its existing mode/app selection. |

Tap category headings to expand or collapse. Collapsing does not deselect patches. Add-on and new optional patches default OFF; review saved selections after updates.

## Add or update

1. Enable Expert mode in Morphe Manager 2.0.0 or newer.
2. Use [Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music), or add `https://github.com/BDCrusher/ytmusic-lyrics` under Sources > + > Remote. Reuse the existing root source.
3. Enable **Pre-release patches** and **Experimental app versions**, then refresh. This release advances dev; main retains its earlier bootstrap feed.
4. Repatch the original **9.42.52 / 94252240 arm64-v8a APK** with the selections above. A source update does not change an installed app.

Settings: **YouTube Music > Settings > Morphe > Lyrics / Shaders / Playlist downloads**. Existing credentials, offsets, source order and saved lyrics are retained.

## Verification limits

Build/JVM/lint, 23 compatibility cases, 16 feature audits, 12 native Lyrics audits and 220 actual-source checks pass: 86 fresh and 134 inherited only after source hashes match. Browser checks cover all 16 variants, reference Braccato transitions, dock/status layout, real Kawarp pacing/high DPI and graphics failure. Ordinary artwork verification/lookup succeeded for MAMMAMIA. Its reference-normalized service frames play and loop on desktop; production Android muxing/hardware playback remains unverified.

**Phone acceptance is still required.** Recording-free smoothness, Samsung navigation, native panel/video/graphics behavior and real playlist downloading need device checks. No universal zero-stutter claim. The previous combined-lyrics-service challenge timeout remains a limitation. No device, MuMu, signing or installation operations occurred. Permanent lyrics survive ordinary updates/restarts; clearing app data or uninstalling removes app-private data. Android may reclaim cover cache files.

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Implementation](IMPLEMENTATION.md) | [Exact checks](verification.json) | [Patch metadata](patches-list.json) | [Pins](SOURCE-PINS.json) | [Notices](THIRD-PARTY-NOTICES.txt)
