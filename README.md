# BDCrusher YT-Music Lyrics

Personal Better Lyrics sources, rendering, vocal agents and background vocals for YouTube Music. Unofficial derivative. Current prerelease: **0.2.3-beta.3**, for original **9.42.52 / 94252240 arm64-v8a** only. Phone acceptance is pending.

## Choose your Morphe source tab

| Tab | Source address | Use it with |
| --- | --- | --- |
| **BDCrusher Full Collection** | [Full source metadata](https://raw.githubusercontent.com/BDCrusher/ytmusic-lyrics/main/full/patches-bundle.json) | Use alone; disable official Morphe and the lyrics-only add-on for this patch run. |
| **BDCrusher Lyrics-only Add-on** | [Add to Morphe](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20Lyrics-only%20Add-on&app=com.google.android.apps.youtube.music) or `https://github.com/BDCrusher/ytmusic-lyrics` | Official Morphe 1.48.0 default Music patches, with official **Third-party lyrics OFF**. |

Both sources live in this repository and download separate MPP files. Morphe Expert mode makes a tab for each source you add. Adding the repository once adds only Lyrics-only; add Full separately if you want that alternative available too. Keep only the appropriate combination selected for a patch run.

### Add both tabs

1. Enable **Expert mode** in Morphe Manager 2.0.0.
2. [Add Lyrics-only Add-on](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics&name=BDCrusher%20Lyrics-only%20Add-on&app=com.google.android.apps.youtube.music). If this repository is already added, reuse it and rename its source card **BDCrusher Lyrics-only Add-on**.
3. For Full, open **Sources ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ + ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Remote** and paste this exact second address:

   ```text
   https://raw.githubusercontent.com/BDCrusher/ytmusic-lyrics/main/full/patches-bundle.json
   ```

4. Rename that source card **BDCrusher Full Collection**. Morphe's one-tap GitHub links address only a repository's root feed; the Full subfolder uses this direct JSON address instead.
5. On each personal source, enable **Pre-release patches**, then **Experimental app versions**, and update it. Latest beta feeds live on dev; main retains the earlier bootstrap version until a stable release. Morphe recognizes branch switching even for the Full JSON URL.
6. Select the original APK. Choose **Full alone**, or **official patches plus Lyrics-only**, with official Third-party lyrics disabled. Never combine both personal editions. Repatching is required; refreshing a source does not change an installed app.

[Latest release](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.3-beta.3) ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· [Direct add-on MPP](https://github.com/BDCrusher/ytmusic-lyrics/releases/download/v0.2.3-beta.3/bdcrusher-ytmusic-lyrics-addon-0.2.3-beta.3.mpp) ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· [Direct Full MPP](https://github.com/BDCrusher/ytmusic-lyrics/releases/download/v0.2.3-beta.3/bdcrusher-ytmusic-lyrics-full-0.2.3-beta.3.mpp)

## Changes in this release

- Native Lyrics action model: enablement, original Music command, and placement immediately after Like/Dislike. No additional Lyrics label or personal click overlay.
- Native Music Lyrics presentation: existing panel preferred, with native palette/header contracts and mini-player snap retained; transparent Better Lyrics rendering stays inside native content.
- Collapsed controls opener at the bottom. Opening expands upward with collapse above the source/delay and four action buttons. Glass controls, centered icons, source flyout and reduced motion remain supported.

## Verification and limitations

Exact released MPP bytes passed four positive original-APK applications, both add-on source orders, SDK DEX/reference/hierarchy audits, native hook audits and duplicate-class checks. Conflicting lyrics integration and missing official runtime reject explicitly. JVM tests: 6 executed,5 APK-dependent skipped. Android lint:0 errors,6 warnings. Native model/host/entry Java:45 checks with real native fixtures and explicitly simulated proxies. Fresh browser checks cover all 16 provider variants, voices/background vocals/highlighting, live Better Lyrics and exact-recording Unison, source controls, seek/follow and dock behavior.

**Phone behavior is not yet verified.** Native button appearance, actual panel extent/theme/mini-player, Android authentication, accessibility/rotation and timing need phone acceptance. Native app experiments/palette can affect presentation. Alternate audio/video timeline conversion is not implemented. Nothing is signed or installed by this repository.

Settings: **YouTube Music ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Settings ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Morphe ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Lyrics**. Existing preferences/private connection data remain in the app. APKs, private credentials and device state are excluded from this repository and releases.

[Build](BUILDING.md) ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· [Compatibility](COMPATIBILITY.md) ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· [Source pins](SOURCE-PINS.json) ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· [Verification](verification.json) ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· [Notices](NOTICE) ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· [Third-party notices](THIRD-PARTY-NOTICES.txt)
