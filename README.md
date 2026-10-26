# BDCrusher YT-Music personal patches

One Morphe source with four expandable categories. Exact experimental target: original YouTube Music **9.42.52 / 94252240 arm64-v8a**. Personal derivative; real phone acceptance remains pending.

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music)** | [Release 0.3.0-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.3.0-beta.1)

## Categories and selections

| Category | How to use it |
| --- | --- |
| Full Collection | Use by itself; leave Lyrics-only Add-on and official collection unselected. |
| Lyrics-only Add-on | Deselect **every Full patch**. Use with official Morphe 1.48.0 defaults, official **Third-party lyrics OFF**. |
| Shaders | Optional animated covers/artwork backgrounds. Works with either edition or official patches; does not enable personal lyrics. |
| Playlist downloads | Optional native Download playlist action. Requires compatible **Downloads**; follows its existing mode/app. Works with official lyrics. |

Tap category headings to expand/collapse. Collapsing does not deselect patches. Full keeps normal defaults; add-on/new optional patches default OFF. Review saved selections after updating. Conflicting editions and missing runtime requirements fail with guidance.

## Add or update

1. Enable Expert mode in Morphe Manager 2.0.0 or newer.
2. Open [Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music), or add `https://github.com/BDCrusher/ytmusic-lyrics` under Sources > + > Remote. Reuse the existing root source if already added.
3. Enable **Pre-release patches** and **Experimental app versions**, then refresh. This prerelease advances dev; main retains its earlier bootstrap feed.
4. Select the original **9.42.52 / 94252240 arm64-v8a APK**, review the categories above and repatch. A source update does not change an installed app.

Settings: **YouTube Music > Settings > Morphe > Lyrics / Shaders / Playlist downloads**.

## What changed

Shaders provides silent animated album covers and actual Kawarp backgrounds inside native containers. Three independent controls, 30 FPS default (24/30/60 choices), reduced motion, pause/visibility handling and a 512 MiB adjustable Wi-Fi-only media cache. Native music video remains native; no video/audio sampling, Tacet or floating windows.

Lyrics retain one best rich version per recording indefinitely, with timing-first or source-first ranking. Every source can contribute. Existing preferences/credentials remain. Four transports use scheduled retries: six transient attempts plus30/120/300-second recovery checks while current/active. Offline time consumes no budget. Valid/manual results survive refresh/late replies. Both entry paths retain the native panel shell and Braccato text motion; scrollbars stay hidden.

The native playlist-header action follows existing Default/In-app/External choices. In-app batches page through the native authenticated client, preserve order/duplicate positions, run at most two downloads and support pause/resume/cancel-remaining/retry plus ordered offline playlists. External apps receive one canonical playlist URL through normal review.

Navigation is transparent across the app, with native controls/icons and safe insets. Native settings add sliders/switches, source reordering, storage/quality bars and separate confirmed clearing actions. Clearing artwork/lyrics never removes downloaded music or credentials.

## Verification and limitations

Build/JVM/lint,23 compatibility cases,16 compiled API/hook/resource/duplicate audits and197 deterministic actual-source checks passed. Browser checks cover16 variants, reference Braccato transitions/follow/seek, real Kawarp, generated silent MP4 and graphics failure. Three live direct song lookups and normal artwork challenge/mint/lookup passed. The combined lyrics-service challenge timed out in a fresh browser check; it was not bypassed.

**No universal zero-stutter or phone acceptance claim.** Recording-free Android smoothness, Samsung navigation, native panel/graphics/video transitions and real playlist/download/offline playback need device checks. Automated checks launched no real downloads. No device/MuMu/sign/install/uninstall operations occurred. Permanent app-private lyrics survive normal restarts/updates; clearing app data/uninstall removes them. Android may reclaim cover cache files.

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Implementation](IMPLEMENTATION.md) | [Exact checks](verification.json) | [Patch metadata](patches-list.json) | [Pins](SOURCE-PINS.json) | [Notices](THIRD-PARTY-NOTICES.txt)
