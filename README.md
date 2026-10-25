# BDCrusher YT-Music Lyrics

One Morphe source with two expandable patch categories, like HushFeed's category layout. Personal Better Lyrics providers, Braccato rendering, vocal agents and background vocals for original YouTube Music **9.42.52 / 94252240 arm64-v8a**. Unofficial derivative; phone acceptance is pending.

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music)** | [Release 0.2.9-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.9-beta.1)

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

Additional lyric providers verify automatically while the app is active, without opening a connection dialog. Tokens renew with one hour left while the current token stays usable. A new token adds sources to the existing lyric session, preserving working lyrics and manual selection. Connect sources reveals the current verification if interaction is required.

Temporary source/network failures have up to three attempts with bounded backoff and Retry-After handling. Denial and not-found responses do not loop. Malformed stream events are skipped so other providers can continue; repeated results after retry do not rebuild the current lyrics.

## Verification

Four exact APK combinations and both official/add-on orders, five invalid-selection rejections, compiled native/SDK/isolation audits, JVM tests and lint pass.114 actual-source simulated Java checks plus11 verification-script checks pass. Fresh live requests retrieve Better Lyrics Wake Up, exact-recording Unison Love Me Dead and LRCLib Man Areas. Unchanged renderer/browser/native-host/navigation checks are explicitly inherited by source hash.

**Phone verification and stutter remain unverified.** Silent verification requires an active foreground app host; interactive verification may still be needed. There is no persistent background service and no guarantee every provider has a recording. Screen recording reportedly hides the stutter; no performance fix is claimed here. See [compatibility](COMPATIBILITY.md) and [exact evidence](verification.json).

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Patch metadata](patches-list.json) | [Source pins](SOURCE-PINS.json) | [Notices](NOTICE) | [Third-party notices](THIRD-PARTY-NOTICES.txt)
