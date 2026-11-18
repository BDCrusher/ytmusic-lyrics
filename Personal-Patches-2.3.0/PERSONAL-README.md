# BDCrusher YouTube Music patches

One personal bundle for YouTube Music 9.45.51 and 9.46.51, based on
Morphe Patches 2.3.0 at `31234a8465683a389bcfba25ad636fd1cd38fd02`.

## Choose a category in Morphe Manager

- **Full Collection** contains the complete personal setup, including the optional
  Shaders and Clone YouTube Music patches. Select this setup from the personal source.
- **Singles** contains **Shaders**, **Volume Boost**, **Better Lyrics**, **Downloads**
  and **Diagnostics**. With the official Morphe source enabled, deselect the personal
  Full Collection entries and choose the personal Singles you want. Leave official
  **Third-party lyrics** enabled with Better Lyrics (Single) and official **Downloads**
  enabled with Downloads (Single). Shaders, Volume Boost and Diagnostics require
  no other personal selection.

Official Morphe 2.3.0 passed with either source order. With official 2.4.0-dev.1,
list the official Morphe source first. The reverse order can prevent patching when
Downloads is selected because the official 4K settings resources are unavailable.

Better Lyrics uses the same personal renderer, lyrics pull-out, source catalogue,
and settings in both categories. The source list includes Morphe's providers,
Spicy Lyrics and Unison, with the existing drag-to-reorder controls. Shaders and
Volume Boost also use shared personal feature code.

**Better Lyrics Web** is the upstream browser extension. **Better Lyrics Patch**
is the Android integration in this bundle. **Web Shaders** is the upstream
companion extension. **Android Shaders** uses its Kawarp effect and animated
artwork service with the native player and Lyrics surfaces. The Android port
is based on Shaders 1.5.1 with its own settings and motion limits. Audio-reactive
beat detection and the browser's browse-page glass treatment are specific to
[Web Shaders](https://github.com/better-lyrics/shaders).
When WebGL is unavailable, Android Shaders can display a softly moving blurred
version of the cover. The effect follows playback and the reduced-motion setting.

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
in the center of the panel. The active search has a 25-second limit. A timeout or
connection failure has its own message. The lyrics clock updates when playback
pauses or resumes and keeps the source's TTML timestamps. Unison displays the service and submitter links
when present in the response. Earlier saved entries pick up credits as they refresh.
The personal source list includes the official provider set. Drag directly from the
three-line handle to reorder it, or use the accessibility move actions. The existing
Better Lyrics scroll engine, instrumental notes and permanent lyric storage are used.

Enabling **YouTube Captions**, **Spotify** or **Deezer** without credentials opens
the corresponding setup dialog. The switch stays off until validation succeeds.
An unverified entry is available in the same dialog when you retry. Tap an
**Apple Music** or **Musixmatch direct** source name to edit its optional
credential, or use **Morphe → Lyrics → Provider credentials**.

**Morphe → Lyrics** contains the personal and upstream controls in one page. **Shaders** appears directly below it when selected.

On track changes, the personal renderer starts a new lookup for the active recording.
Metadata that arrives with a different recording ID can wait for its own playback.
Unconfirmed metadata waits before it starts title and artist based searches.

Volume boost appears as a speaker button that scrolls with the player actions. It starts off
on each app launch and offers up to +12 dB for a supported Music audio session.
New native downloads use YouTube Music's progress and notifications.

## Crash diagnostics

Full Collection includes **Crash diagnostics** by default. With official Morphe,
select **Diagnostics (Single)**. It works alongside Morphe's **Enable debugging**
patch and its crash reporter. You can leave the runtime debug, verbose and Litho
logging switches off.

When a crash occurs, reopen Music and go to **Settings → Morphe → Crash diagnostics →
Save crash report**. The report contains the app and patch versions, the last captured
Java exception type and stack frames, player and audio output events, and Android's
recent process exit records (Android 11 and above). It includes a limited stack
excerpt for an ANR when Android supplies one. The short history stays on the device
until exported through the Android file picker. The report omits exception messages,
account data, URLs, song titles, video IDs, lyrics and raw debug logs.

Use **Record playback steps** to pause new capture. Previously saved crash and
previous-session records remain available. The file identifies Java crashes captured
after installing the patch and can show recent Android exit records for the same
app package. On 0.11.0-beta.3, two phone reports recorded the same Better Lyrics
provider access error after audio started. The 0.11.0-beta.4 build fixes that call.

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
`DownloadQualityTest`. `VerifyLyricsProviderAccessKt` checks Better Lyrics method
access against the actual bundled Morphe extension. The 0.11.0-beta.3 crash regression, original and patched DEX
checks, and crash history tests are retained in `Verification/music-crash-01`.

Device acceptance is separate from SDK checks. Run the renderer's status and provider
fixtures with `node --test web/tests/lyrics-lookup.test.mjs` after preparing the pinned
web dependencies with python -B web/prepare_vendor.py. Braccato core 1.21.5
supplies the scroll behavior directly. The 1.16.11 local compatibility script
and receipt document an earlier build.
