# BDCrusher YouTube Music 9.45.51

Personal Full Collection based on Morphe 2.2.0 at
`44031c561ea048c8f196877f30a49c13bfd6afb6`.

The maintained source for this target is this worktree. The prior personal release and
its 9.42.52 and 9.43.51 source remain in the sibling `Personal-Patches` directory.

Select Downloads in Full Collection for Morphe's in-app or external downloading.
Configure it under Morphe → Player → Downloads. Its existing playlist/album download
action starts the upstream batch flow. The retired personal Download playlist patch
is absent from this build. Shaders remains independently selectable.

The Audio/Video sheet starts on Audio and exposes Video after compatible formats resolve.
“Ask about video during playlist and album downloads” defaults off. Enabling it asks per
unique video-capable recording. A cancelled choice skips that recording. Background
choices wait for the foreground activity.

In-app downloads live under Library → Downloads. Saved groups appear under Playlists. Their saved rows retain source
positions, repeated occurrences and unavailable entries. Native playback is used for
downloaded tracks. See COMPATIBILITY-9.45.51.md for acceptance limits.

Spicy Lyrics is available in the Lyrics source list when Better Lyrics returns a
community sync. Provider and contributor credits appear below the lyrics. Spicy results
are kept for the current recording session. Confirmed empty lookups show “No lyrics found.”
in the center of the panel.

## Build

Run the app-home `build-music-94551.ps1 :patches:buildAndroid`.
Local dependency configuration lives in `settings.gradle.kts`. Required source pins
are listed in COMPATIBILITY-9.45.51.md. Java 25 runs Gradle, and the Microsoft Java 17
toolchain compiles the patches. The wrapper directs supported caches and temporary
outputs into the app home.

## Verification

The app-home `Verification/revision47` directory contains exact-bundle patch logs,
desktop fixtures and compiled audit reports. The test entry points are
`verifyMusic94551`, `auditNativeMusic94551`, `PlaylistOccurrencesTest` and
`DownloadQualityTest`.

Device acceptance is separate from SDK checks. Run the renderer's status and provider
fixtures with `node --test web/tests/lyrics-lookup.test.mjs` after preparing the pinned
web dependencies.
