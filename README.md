# BDCrusher YT-Music Lyrics

One Morphe source with two expandable patch categories, like HushFeed's category layout. Personal Better Lyrics providers, Braccato rendering, vocal agents and background vocals for original YouTube Music **9.42.52 / 94252240 arm64-v8a**. Unofficial derivative; phone acceptance is pending.

**[Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music)** | [Release 0.2.8-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.8-beta.1)

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

The cold fallback now mirrors this APK's native Lyrics factory defaults, including its native header/background/persistence behavior, instead of cloning Related. A supplied native Lyrics definition is preserved byte-for-byte, including its native snap/theme/header settings; late native registrations are captured. The native controller, header, close, mini-player and content body remain in charge. **Exact phone/pixel parity remains unverified.**

Actual Better Lyrics/Braccato per-line scrolling is restored: additive line movement, varied duration/stagger, easing and catch-up. The previous750ms custom viewport path is removed. Only expected-event bookkeeping and explicit gesture recognition are adapted; native timestamp/rate sampling remains. The browser comparison matches8 scroll animations/keyframes/timings against the untouched core package.

The real native Lyrics action is second by default, including before metadata/provider completion. Positive results enable it; confirmed all-not-found moves it explicitly to the end. Unknown connection errors are distinct from empty lookup, and switching the feature off restores the native model. No label/button is painted over it.

Lookup conservatively removes Official Video/Audio labels and Topic suffixes while retaining cover/live/remix qualifiers. LRCLib get404/empty results can use search only with exact normalized title/artist and a maximum2-second duration difference when known. Wrong versions/artists reject; access/rate failures cannot invoke fallback. Existing positive rich-result preservation, manual selection and normal authentication remain.

## Connect sources explained

This is normal Cloudflare verification for Better Lyrics' additional-provider broker, not a Google/YouTube login or account link. It sends recording ID/title/artist/album/duration for lookup and stores an expiring verification token in app-private preferences. Public Better Lyrics, Unison, LRCLib and native sources run independently. Additional broker results include BiniLyrics, Musixmatch, Portato/QQ and Legato/KuGou. Connecting permits those queries; it does not guarantee lyrics exist for every song. Renew when verification expires. Settings and the verification dialog now explain this, and connection status can remain visible beside a working public result.

## Verification

Four original-APK combinations, both official/add-on orders, five invalid-selection rejections, fresh compiled native/SDK/reference/hierarchy/duplicate-class/asset checks, JVM tests and Android lint passed. Isolated add-on108 owned classes, no foreign/duplicate runtime classes. Actual-source Java:39 host,33 catalog,23 lifecycle checks; the unchanged31-check navigation simulation is reused by exact source identity. Live Java fetches Better Lyrics Wake Up, Unison Love Me Dead and LRCLib Man Areas.

Browser checks compare the unmodified extension engine, actual rich TTML, manual scroll/resume/seek,16 variants, vocals/agents/letter wave, source selection, glass dock/flyout, themes/sizes and reduced motion. The301-frame visual trace has no reverse steps. Exact hashes and limits: [verification.json](verification.json).

**No Samsung phone/pixel-parity/performance acceptance is claimed.** Cold fallback uses the APK's built-in Lyrics defaults rather than a captured online server definition. Check theme/gesture/snap/button and next-line movement on the phone. Alternate video/audio timeline conversion and Shaders remain absent. No signing, installation, MuMu or device operations occurred.

[Build](BUILDING.md) | [Compatibility](COMPATIBILITY.md) | [Patch metadata](patches-list.json) | [Source pins](SOURCE-PINS.json) | [Notices](NOTICE) | [Third-party notices](THIRD-PARTY-NOTICES.txt)
