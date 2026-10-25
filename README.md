# BDCrusher YT-Music Lyrics

One Morphe source with two expandable patch categories, like HushFeed's category layout. Personal Better Lyrics providers, Braccato rendering, vocal agents and background vocals for original YouTube Music **9.42.52 / 94252240 arm64-v8a**. Unofficial derivative; phone acceptance is pending.

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music)** | [Release 0.2.10-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.10-beta.1)

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

A small green/orange/red dot beside the delay replaces the automatic source warning banner. Green means checks completed without unresolved failures and usable lyrics exist; orange means loading/partial/verification needed; red means no usable lyrics. Tap for details, Connect sources or Settings. No automatic popup and no viewport jump when status changes.

Android callback positions now use their native timestamps through one isolated personal clock hook per edition. The bridge clock stays continuous through ordinary jitter; real seeks, pauses and rates stay immediate. Reduce bridge/window work, preserve equivalent lyric DOM, avoid repeated parsing and wait for parsing before noLyrics. Actual Braccato scroll curves, highlighting, BG vocals, agents and letter wave remain.

## Sources and verification

Ordinary service verification now supports the page message callback plus getResponse fallback and Retry-After. Actual Java Catalog/Network access with a normally issued memory-only test JWT returned all six backends and9 positive payloads, with healthy completed state. Android storage was simulated; phone WebView verification still needs acceptance. No credentials were printed or saved by testing. Connecting cannot guarantee a recording exists at every provider.

Four final APK combinations/both source orders and five rejected conflicts, compiled native/SDK/isolation audits, JVM/lint,143 fresh Java and81 JS checks pass. All16 provider variants and fresh rich-lyrics/control/selection/seek checks pass. A controlled desktop4x CPU comparison had0 reverse steps/long tasks; real-song runs and concurrent-load variability are retained in [exact evidence](verification.json).

**No universal zero-stutter or phone acceptance claim.** Bounded Frame-timing summaries now appear in existing Source diagnostics without screen recording. They measure WebView callback gaps, not GPU/display dropped frames. Native cold presentation and alternate recording-time limits remain. [Compatibility](COMPATIBILITY.md).

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Patch metadata](patches-list.json) | [Source pins](SOURCE-PINS.json) | [Notices](NOTICE) | [Third-party notices](THIRD-PARTY-NOTICES.txt)
