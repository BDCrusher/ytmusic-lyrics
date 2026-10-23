# BDCrusher YT-Music Lyrics

One Morphe source with two expandable patch categories, like HushFeed's category layout. Personal Better Lyrics providers, Braccato rendering, vocal agents and background vocals for original YouTube Music **9.42.52 / 94252240 arm64-v8a**. Unofficial derivative; phone acceptance is pending.

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music)** | [Release 0.2.6-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.6-beta.1)

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

0.2.6-beta.1 hides the native WebView and page scrollbars while preserving scrolling. It removes repeated lyric measurements from duplicate native visibility messages, settles dock clearance once after animation, coalesces native attachment work and reuses the navigation pixel sampler without unchanged window writes. Braccato's highlighting, BG vocals, singer placement, letter wave and follow timing remain.

Native Lyrics definitions are preserved even before their content loads. When YouTube Music supplies a real Lyrics presentation during this process, the fallback now prefers that native layout, with prior lyric content removed and the current panel palette applied. **A cold session without a supplied native Lyrics definition still uses the Related-derived native fallback.** This improves reuse; it does not establish identical phone feel.

## Verification

The actual Java source passed 29 entry/host and 24 simulated navigation checks. Browser comparison reproduced repeated full-line measurements in the previous visibility handler and eliminated them in the new one. The tested line transitions had no reverse steps. All 16 provider variants, vocal layout, hidden bars, manual scroll/resume, reduced motion and bottom dock checks passed. Four exact original-APK applications, five invalid selections, compiled native/SDK/isolation audits, JVM tests and Android lint passed. Exact identities and limits are in [verification.json](verification.json).

**The reported Samsung jitter has not been reproduced on a phone.** These are verified reductions in unnecessary work and browser checks, not proof that phone line-transition jitter is eliminated. Native button, cold/warm panel feel, actual bars, navigation, orientation and timing need phone acceptance. No signing, installation or MuMu operations occurred. Alternate audio/video timeline conversion remains unimplemented.

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Patch metadata](patches-list.json) | [Source pins](SOURCE-PINS.json) | [Notices](NOTICE) | [Third-party notices](THIRD-PARTY-NOTICES.txt)
