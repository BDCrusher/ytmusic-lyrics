# BDCrusher YouTube Music patches

One personal bundle for YouTube Music 9.45.51 and 9.46.51, based on
Morphe Patches 2.3.0 at `31234a8465683a389bcfba25ad636fd1cd38fd02`.

## Choose a category in Morphe Manager

- **Full Collection** contains the complete personal setup, including the optional
  Shaders and Clone YouTube Music patches. Select this setup from the personal source.
- **Singles** contains exactly **Shaders**, **Volume Boost**, **Better Lyrics** and
  **Downloads**. With the official Morphe source enabled, deselect the personal
  Full Collection entries and choose any of the four personal Singles. Leave official
  **Third-party lyrics** enabled with Better Lyrics (Single) and official **Downloads**
  enabled with Downloads (Single). Shaders and Volume Boost require no other personal
  selection.

Better Lyrics uses the same personal renderer, lyrics pull-out, source catalogue,
and settings in both categories. The source list includes Morphe's providers,
Spicy Lyrics and Unison, with the existing drag-to-reorder controls. Shaders and
Volume Boost also use shared personal feature code.

Select **Clone YouTube Music** with **GmsCore support**, then choose the
**BDCrusher side-by-side** package option to use `app.bdcrusher.android.apps.youtube.music`.
Android gives the new package its own settings, downloaded files and folder grants.
Leave the clone option at its default to retain the ordinary Morphe package when
patching with GmsCore support. Shaders remains independently selectable.

In-app downloads use the personal Audio/Video pop-out when YouTube Music returns
a supported quality picker. It shows the native quality options and size information
and submits the chosen row to the original confirmation action. Other eligible flows
use YouTube Music's picker. Account and subscription checks remain in the native flow.
**Library → Downloads** shows native downloads and Morphe supplies **Export to device**
for eligible saved files in either category. Configure
external routing under **Morphe → Player → Downloads**. Set **Download mode → External** to send the player and song-menu actions to the selected downloader. Use **Previous personal
downloads** on that settings page for files and groups from the older downloader
under the same package, or choose your YTDLnis folder there. Native groups and older
personal groups retain their own storage. Full Collection attempts to prefetch lyrics when an
authorized offline response includes matching recording metadata. External downloaders
receive the resolved URL.

Spicy Lyrics is available in the Lyrics source list when Better Lyrics returns a
community sync. Provider and contributor credits appear below the lyrics. Spicy results
are kept for the current recording session. Confirmed empty lookups show “No lyrics found.”
in the center of the panel. Unison displays the service and submitter links
when present in the response. Earlier saved entries pick up credits as they refresh.
The personal source list includes the official provider set. Drag directly from the
three-line handle to reorder it, or use the accessibility move actions. The existing
Better Lyrics scroll engine, instrumental notes and permanent lyric storage are used.

**Morphe → Lyrics** contains the personal and upstream controls in one page. **Shaders** appears directly below it when selected.

Volume boost appears as a speaker button that scrolls with the player actions. It starts off
on each app launch and offers up to +12 dB for a supported Music audio session.
New native downloads use YouTube Music's progress and notifications.

## Build

Run the app-home `build-music-230.ps1 :patches:buildAndroid`.
Local dependency configuration lives in `settings.gradle.kts`. Required source pins
are listed in REBASE-2.3.0.md. Java 25 runs Gradle, and the Microsoft Java 17
toolchain compiles the patches. The wrapper directs supported caches and temporary
outputs into the app home.

## Verification

The app-home `Verification/music-parity-01` directory contains exact-bundle patch logs,
desktop fixtures and compiled audit reports. The test entry points are
`verifyMusicSingles`, `verifyMusic94551`, `auditNativeMusic94551`, `PlaylistOccurrencesTest` and
`DownloadQualityTest`.

Device acceptance is separate from SDK checks. Run the renderer's status and provider
fixtures with `node --test web/tests/lyrics-lookup.test.mjs` after preparing the pinned
web dependencies with python -B web/prepare_vendor.py. Braccato core 1.21.5
supplies the scroll behavior directly. The 1.16.11 local compatibility script
and receipt document an earlier build.
