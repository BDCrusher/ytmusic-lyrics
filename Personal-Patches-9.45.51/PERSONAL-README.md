# BDCrusher YouTube Music 9.45.51

Personal Full Collection based on Morphe 2.3.0-dev.3 at
`dc84727f1c506af29e72190186bb913ca244a98c`.

The maintained source for this target is this worktree. The prior personal release and
its 9.42.52 and 9.43.51 source remain in the sibling `Personal-Patches` directory.

Select **Clone YouTube Music** with **GmsCore support**, then choose the
**BDCrusher side-by-side** package option to use `app.bdcrusher.android.apps.youtube.music`.
Android gives the new package its own settings, downloaded files and folder grants.
Leave the clone option at its default to retain the ordinary Morphe package when
patching with GmsCore support. Shaders remains independently selectable.

New authorized downloads use YouTube Music's quality picker, offline engine and
**Library → Downloads**. Account and subscription checks stay in place. Configure
external routing under **Morphe → Player → Downloads**. Use **Previous personal
downloads** on that settings page for files and groups from the older downloader
under the same package, or choose your YTDLnis folder there. Native groups and older
personal groups retain their own storage. Native export and automatic import of
previous files are outside this build.

Spicy Lyrics is available in the Lyrics source list when Better Lyrics returns a
community sync. Provider and contributor credits appear below the lyrics. Spicy results
are kept for the current recording session. Confirmed empty lookups show “No lyrics found.”
in the center of the panel. Unison displays the service and submitter links
when present in the response. Earlier saved entries pick up credits as they refresh.
The personal source list includes the official provider set. Drag directly from the
three-line handle to reorder it, or use the accessibility move actions. The existing
Better Lyrics scroll engine, instrumental notes and permanent lyric storage are used.

Volume boost appears as the speaker button in the player action row. It starts off
on each app launch and offers up to +12 dB for a supported Music audio session.
New native downloads use YouTube Music's progress and notifications.

## Build

Run the app-home `build-music-94551.ps1 :patches:buildAndroid`.
Local dependency configuration lives in `settings.gradle.kts`. Required source pins
are listed in COMPATIBILITY-9.45.51.md. Java 25 runs Gradle, and the Microsoft Java 17
toolchain compiles the patches. The wrapper directs supported caches and temporary
outputs into the app home.

## Verification

The app-home `Verification/revision48` directory contains exact-bundle patch logs,
desktop fixtures and compiled audit reports. The test entry points are
`verifyMusic94551`, `auditNativeMusic94551`, `PlaylistOccurrencesTest` and
`DownloadQualityTest`.

Device acceptance is separate from SDK checks. Run the renderer's status and provider
fixtures with `node --test web/tests/lyrics-lookup.test.mjs` after preparing the pinned
web dependencies with python -B web/prepare_vendor.py. Braccato core 1.21.5
supplies the scroll behavior directly. The 1.16.11 local compatibility script
and receipt document an earlier build.
