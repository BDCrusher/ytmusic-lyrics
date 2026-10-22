# BDCrusher YT-Music Lyrics

Personal Better Lyrics integration for Morphe and YouTube Music. Unofficial derivative; not an official Morphe or Better Lyrics release.

**[Add the lyrics add-on to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20YT-Music%20Lyrics&app=com.google.android.apps.youtube.music)**

Or paste **https://github.com/BDCrusher/ytmusic-lyrics** in Morphe → Sources → + → Remote.

## Setup

1. Use Morphe Manager 2.0.0 and official Morphe Patches **1.48.0**. Enable Expert mode to select both sources in the same patch run.
2. On this source, enable **Pre-release patches**, then **Experimental app versions**. The personal release is a beta even with stable Manager.
3. Select an original **YouTube Music 9.42.52 / 94252240, arm64-v8a** APK. Other versions are unverified.
4. Keep the official default Music patches, turn **official Third-party lyrics OFF**, and enable **Third-party lyrics — Better Lyrics add-on** here. Keep official Litho/settings/playback infrastructure selected.
5. Disable/remove the earlier local copy of this add-on and any personal Full collection source so it is injected once. Patch the original APK again to apply updates.

Open **YouTube Music → Settings → Morphe → Lyrics** for settings and normal source connection. Source updates download patch bundles; they do not automatically repatch or reinstall YouTube Music.

## What it adds

Braccato word/syllable highlights, background vocals, singer placement and letter wave; the 16 Better Lyrics provider variants and preference order; native inline sliders/switches; transparent lyrics over the song theme; floating glass controls and an animated source flyout. Seeking resumes lyric follow without the Android touch rectangle.

The three control layers are Copy / Translate / Romanize / Refresh, delay − / source / delay +, then the collapse chevron. Shaders, Tacet and floating windows are excluded.

## Full edition alternative

The default repository feed is **add-on only**. [Full collection download](https://github.com/BDCrusher/ytmusic-lyrics/releases/download/v0.2.1-beta.1/bdcrusher-ytmusic-lyrics-full-0.2.1-beta.1.mpp) is an alternative used by itself, with the official overlapping collection and add-on disabled. Its applied collection baseline remains Morphe dev.19. For a separate remotely updating Full source, paste this exact metadata URL into Morphe:

`https://raw.githubusercontent.com/BDCrusher/ytmusic-lyrics/main/full/patches-bundle.json`

Do not enable both editions together.

## Verification and limitations

Version **0.2.1-beta.1** passed stable Patcher 2.0.0 APK/DEX verification: Full defaults, Full lyrics alone, add-on + official stable patches in both source orders, and expected conflict/missing-runtime rejections. Browser tests cover 16 provider variants and UI interactions. The exact supplied music-video recording MYal8NoVQXs retrieves Unison TTML and decodes 50 lines in Java/browser checks.

**Phone acceptance remains pending:** native settings appearance/accessibility, WebView compositing/lifecycle, real audio synchronization, Android source authentication and performance. Automatic audio/video counterpart segment-map conversion is not implemented. Provider availability varies; use Source diagnostics when a lookup differs.

[Release and checksums](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.1-beta.1) · [Compatibility](COMPATIBILITY.md) · [Build source](BUILDING.md) · [Publication](PUBLISHING.md)

## Credits

MorpheApp/morphe-patches and Better Lyrics contributors; Braccato core/parsers; BDCrusher's personal Android integration. GPL-3.0 and retained Morphe Section 7 notices apply to their respective derivatives; third-party MIT/font notices are retained. See [LICENSE](LICENSE), [NOTICE](NOTICE), [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt) and Personal-Patches/third-party-notices.
