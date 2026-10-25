# BDCrusher YT-Music Lyrics

One Morphe source with two expandable patch categories, like HushFeed's category layout. Personal Better Lyrics providers, Braccato rendering, vocal agents and background vocals for original YouTube Music **9.42.52 / 94252240 arm64-v8a**. Unofficial derivative; phone acceptance is pending.

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music)** | [Release 0.2.11-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.11-beta.1)

## Expandable categories

| Category | What to select |
| --- | --- |
| **Full Collection** | Use its normal patch choices by themselves. Keep Lyrics-only Add-on and the official source unselected. |
| **Lyrics-only Add-on** | Uncheck every Full Collection patch. Select the personal add-on plus official Morphe 1.48.0 default Music patches, with official **Third-party lyrics OFF**. |

Both groups are inside one bundle. Tap a category heading to expand or collapse it; its selection control changes that group's patches. Full preserves its original defaults. The add-on defaults to unchecked to avoid conflicting defaults. Existing saved selections may persist, so review both groups after updating. Selecting patches from both groups is rejected with instructions, including when the Full selection is a non-lyrics setting. Collapsing a group does not deselect its patches.

## Setup

1. Use Morphe Manager **2.0.0 or newer** and enable **Expert mode**.
2. Open [Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music), or paste `https://github.com/BDCrusher/ytmusic-lyrics` into **Sources → + → Remote**. If already added, reuse the existing root source; do not add a duplicate. You can rename it **BDCrusher YT-Music Lyrics**.
3. Enable **Pre-release patches**, then **Experimental app versions**, and update this source. This beta is on dev; main retains its earlier bootstrap feed until a stable release.
4. Select the original **9.42.52 / 94252240 arm64-v8a APK** and choose one category's edition using the table above. Expand/collapse only changes what you see, so check the selected counts.
5. Disable the old separately added **Full Collection** source when using this combined source. Official Morphe remains selected only for the add-on combination, with its Third-party lyrics disabled.
6. Repatch the original APK. Updating a source alone does not update an installed app.

Settings: **YouTube Music → Settings → Morphe → Lyrics**.

## What changed

Navigation is now always transparent while Lyrics is open. The bar/divider uses zero alpha, contrast scrim is disabled where supported, and the matching-color mode/toggle and protection overlays are removed. Old saved matching preferences cannot turn it back on. Native navigation buttons, icon appearance and normal content insets remain under native control; closing Lyrics restores native window state.

Lyrics rendering, timing, source retrieval and the status dot are unchanged from0.2.10. The same Full and Lyrics-only categories and source connection link remain.

## Verification

47 fresh helper window-state checks cover API26/28/29/30/36, gestures/side/bottom bars, themes, focus, renderer ownership, repeated writes and restoration. Four exact APK combinations/both source orders, five rejected conflicts, compiled native/SDK/isolation audits, JVM tests and lint pass. Prior browser/clock/source results are reused only after exact source/asset hashes match.

**Real Samsung/One UI transparency still needs phone acceptance.** Transparency reveals the native app underneath; this patch does not hide navigation buttons or globally change window insets. Previous phone-performance/WebView/native-cold-panel/timeline limitations remain. [Compatibility](COMPATIBILITY.md) | [Exact verification](verification.json).

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Patch metadata](patches-list.json) | [Source pins](SOURCE-PINS.json) | [Notices](NOTICE) | [Third-party notices](THIRD-PARTY-NOTICES.txt)
