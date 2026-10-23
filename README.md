# BDCrusher YT-Music Lyrics

One Morphe source with two expandable patch categories, like HushFeed's category layout. Personal Better Lyrics providers, Braccato rendering, vocal agents and background vocals for original YouTube Music **9.42.52 / 94252240 arm64-v8a**. Unofficial derivative; phone acceptance is pending.

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music)** | [Release 0.2.5-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.5-beta.1)

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

0.2.5-beta.1 addresses the reported disabled/end-of-row Lyrics button. Native client-generated action rows do not always have the server-response object required by the old bridge. The patch now captures the video identity from both native paths, remembers the original model and replays it through the original native renderer when lyrics arrive. It edits the original Lyrics action's enabled state, command and position immediately after Like/Dislike. It adds no replacement button or tap overlay. Delayed panel definitions, multiple presenters and stale track results are handled separately.

The system navigation area now follows the drawn background of the visible native Lyrics panel, including edge-to-edge three-button and gesture insets. Native window styling is restored on closing, detachment or focus loss. The existing themed native menu, Better Lyrics renderer and bottom control dock remain; all 15 web assets are unchanged.

## Verification

Four exact-bundle applications passed on original 9.42.52: Full lyrics, Full defaults and add-on with official 1.48.0 in both orders. SDK DEX/reference/hierarchy, duplicate-class, asset identity and compiled native hook audits passed. Five incompatible selections rejected. The actual Java source passed 24 entry/model/host checks using a real wire fixture with simulated native callbacks, plus 22 system-navigation checks with simulated Android state. Build, JVM tests and Android lint passed with zero lint errors (six warnings). Exact identities and limits are in [verification.json](verification.json).

**Actual phone acceptance remains pending.** The user's previous phone test failed; these source, simulation and compiled checks are not a replacement for checking native button dispatch, position, Samsung navigation colors, orientation and timing on the phone. No signing, installation or MuMu access occurred. Alternate audio/video timeline conversion remains unimplemented. Vendor APKs and private connection/device data are excluded.

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Patch metadata](patches-list.json) | [Source pins](SOURCE-PINS.json) | [Notices](NOTICE) | [Third-party notices](THIRD-PARTY-NOTICES.txt)
