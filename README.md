# BDCrusher YT-Music personal patches

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music&app=com.google.android.apps.youtube.music)** | [Release 0.8.0-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.8.0-beta.1)

Original arm64-v8a Music **9.42.52/94252240** and **9.43.51/94351240**, minSDK26. Full Collection only; Shaders and Download playlist optional. In-app playlist batches require Downloads and Download playlist. Jam remains 9.42.52-only. Do not combine complete collections. MPP SHA256 `295e7be5d92ce91d5064b75d30e9c6cd1067ff5f4fd18c78d872b1fe880d0101`.

Fixes the constructor receiver clobber and invalid-owner poisoning. Adds the Audio/Video sheet, dual-stream saved media, durable range recovery, shared progress/status icons and native-watch playback. Owned downloads render inside the existing Library Downloads destination using the approved native-component fallback. The native offline database/provider is not altered. Default account handling and native authorization rejection are preserved. Existing files, lyrics, credentials, preferences and chosen-folder grants remain.

Build/JVM/lint, **12 positive selections** and **2 missing-Downloads rejections**, catalog/Jam guards, compiled feature/access/reference, Lyrics, media, settings, target/context and receiver-flow audits pass. **820 source/harness checks: 549 fresh, 271 inherited after source-hash validation.** The receiver audit reproduces the broken previous release on both targets. Android views/codecs/auth/client and launch boundaries are simulated in fixtures; actual APK contracts are audited separately. This is not phone acceptance.

Phone acceptance remains for quality-sheet appearance/insets, Library, native mini-player expansion, actual decoding/Audio-Video switching, queue shuffle/repeat, online/offline transitions and native offline network-action states. Existing Samsung navigation/Shaders and recording-free Lyrics performance remain device checks. No universal zero-stutter or pixel-parity claim. No MuMu, signing, installation, actual media downloading or cleanup.

Refresh the source with Pre-release patches and Experimental app versions enabled, then repatch an original supported APK. **Morphe → Player → Downloads → In-app** opens the quality sheet; External keeps the selected app's review flow. Enable Download playlist for whole-playlist batches. **Library → Downloads** opens the integrated destination. Use the existing Enable debug logging / Export debug logs; no timer.

Three expandable categories: Full Collection, Shaders and Playlist downloads. The old Lyrics-only Add-on is retired. Do not combine two complete collections.

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Implementation](IMPLEMENTATION.md) | [Exact verification](verification.json) | [Patch metadata](patches-list.json) | [Pins](SOURCE-PINS.json) | [Notices](THIRD-PARTY-NOTICES.txt)
