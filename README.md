# BDCrusher YouTube Music patches

One personal Morphe patch bundle for original arm64-v8a YouTube Music **9.45.51** and **9.46.51**.

- **Full Collection** contains the complete personal setup, including Crash diagnostics.
- **Singles** contains personal Shaders, Volume Boost, Better Lyrics, Downloads and Diagnostics. Official Morphe Patches 2.3.0 passed in either source order. With 2.4.0-dev.1, list the official source first.

Better Lyrics keeps the personal renderer, animations, pull-out and providers in both categories. Downloads uses the personal Audio/Video pop-out where the native quality picker supplies choices, with native confirmation, Library and export support.

Enable **Expert mode**, **Pre-release patches** and **Experimental app versions** in Morphe Manager. For Singles, select official **Third-party lyrics** alongside Better Lyrics and official **Downloads** alongside the Downloads Single. Select **Diagnostics (Single)** on its own or with other Singles. For side-by-side install, select **Clone YouTube Music** and **GmsCore support** in Full Collection.

0.11.0-beta.4 fixes a Better Lyrics provider crash triggered after a song starts. To export a crash report, reopen Music and use **Settings → Morphe → Crash diagnostics → Save crash report**. Playback capture works with the debug, verbose and Litho switches off.

[Current prerelease and compatibility report](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.11.0-beta.4) · [Add the source to Morphe Manager](https://morphe.software/add-source?github=BDCrusher%2Fytmusic-lyrics) · [Build instructions](BUILDING.md)
