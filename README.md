# BDCrusher YT-Music Lyrics

One Morphe source with two expandable patch categories, like HushFeed's category layout. Personal Better Lyrics providers, Braccato rendering, vocal agents and background vocals for original YouTube Music **9.42.52 / 94252240 arm64-v8a**. Unofficial derivative; phone acceptance is pending.

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music)** | [Release 0.2.7-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.7-beta.1)

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

Timed lyrics now move through one host-owned viewport animation instead of multiple per-line scroll transforms. Braccato still renders word/syllable highlights, background vocals, singer positions and letter wave. Manual follow pause/resume, seek, plain passive scrolling and reduced motion are retained. Native snapshot timestamps and playback rate are extrapolated once on a monotonic clock.

Valid rich results survive later empty/less-detailed replies. Automatic text matching still protects against wrong songs; received candidates remain manually selectable. Better Lyrics retries once without album/duration after404 or empty metadata, while access/rate/authentication failures use their ordinary error/renewal paths. Unison is not persistently cached.

The actual native Lyrics action is second while lookup is pending; this ordering does not enable an unavailable command. A positive result enables it, definite all-not-found restores the original placement, and connection failures remain unknown. No text/button is drawn over the native action.

**Transparent system navigation** is enabled by default under Morphe > Lyrics. It removes the scoped navigation fill/contrast scrim and restores the prior window on close. Switch it off to match the actual Lyrics-panel color. Transparency reveals whatever the native host draws beneath the bar; it does not change the app's inset layout.

Checked Better Lyrics v3.0.1: its provider/renderer code already matches our inspected source. [Shaders feasibility](Research/SHADERS-ANDROID-FEASIBILITY-2026-10-23.md) covers moving artwork backgrounds and animated album loops; these effects are research only in this release.

## Verification

Four original-APK patching combinations, both official/add-on source orders, five invalid-selection rejections, compiled native/SDK/duplicate-class/asset checks, JVM tests and Android lint passed. The isolated add-on has107 owned classes and no foreign or duplicate runtime classes. Actual-source Java tests:34 host,31 navigation,23 catalog and23 lifecycle checks, with explicit Android/native/HTTP simulations. Actual Java transport fetched Better Lyrics for Wake Up, Unison for the supplied Love Me Dead video, and LRCLib for Man Areas.

Browser checks use real TTML for the first two recordings: five active-group changes each, no physical reverse steps/false manual pauses; late-result preservation, manual selection, wheel during motion, seek/back-seek, delayed2x snapshots, plain passive mode,16 variants, vocals, dock/flyout, sizes/themes and reduced motion passed. Exact identities are in [verification.json](verification.json).

**Samsung phone jitter and native-panel acceptance remain unverified.** A cold session without a real Lyrics definition still uses the Related-derived native fallback. Some metadata requests to the public Better Lyrics endpoint return401; normal combined-service verification is retained. Alternate music-video/audio timeline conversion is not implemented. No signing, installation, MuMu or device operations occurred.

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Patch metadata](patches-list.json) | [Source pins](SOURCE-PINS.json) | [Notices](NOTICE) | [Third-party notices](THIRD-PARTY-NOTICES.txt)
