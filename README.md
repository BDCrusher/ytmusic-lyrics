# BDCrusher YT-Music Lyrics

One Morphe source with two expandable patch categories, like HushFeed's category layout. Personal Better Lyrics providers, Braccato rendering, vocal agents and background vocals for original YouTube Music **9.42.52 / 94252240 arm64-v8a**. Unofficial derivative; phone acceptance is pending.

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music)** | [Release 0.2.4-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.4-beta.1)

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

0.2.4-beta.1 combines the former separate editions into one source and two native expandable categories. Runtime dependencies remain separate: choosing only the add-on injects its personal payload, while Full supplies its own infrastructure. The bundle contains both alternatives, but only selected dependencies are injected. Category conflicts fail explicitly. Published README text now uses explicit UTF-8 handling.

All injected runtime payloads and renderer assets are byte-identical to 0.2.3-beta.3. This is a packaging and patch-selection update; it does not claim another native button, themed-panel or provider correction.

## Verification

The exact combined MPP passed original-APK application for Full lyrics, Full defaults and add-on with official patches in both source orders. SDK DEX/reference/hierarchy, duplicate-class, asset identity and native compiled hook/CFG audits passed. Both-edition selections in both orders, add-on plus a non-lyrics Full patch, official lyrics conflict and missing official infrastructure rejected as expected. Loaded compiled metadata checks the categories and unchecked add-on. Exact identities and JVM results are in [verification.json](verification.json). Previous browser/lint checks apply only to unchanged runtime/renderer bytes.

**Actual phone behavior and Manager category presentation remain unverified.** Existing native button/panel/theme, authentication, accessibility/rotation and timing checks still need phone acceptance. Alternate audio/video timeline conversion remains unimplemented. No signing, installation or MuMu access was performed. Vendor APKs, credentials and private device state are excluded.

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Patch metadata](patches-list.json) | [Source pins](SOURCE-PINS.json) | [Notices](NOTICE) | [Third-party notices](THIRD-PARTY-NOTICES.txt)
