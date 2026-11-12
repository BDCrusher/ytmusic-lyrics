# Compatibility and acceptance record for 0.9.0-beta.3

## Exact inputs

| Item | Pin |
| --- | --- |
| Upstream patches | Morphe 2.2.0, 44031c561ea048c8f196877f30a49c13bfd6afb6 |
| Patcher | 2.3.0, d19545e8505e0329cc640723cb8ff91eddd3cd05 |
| Patch library | 2.2.0-dev.3, 538d9a6574cbacb4ca66d8b687c44d93b2d8d470 |
| Gradle plugin | 2.1.0, 5b7e4619931a8c78b7858e598e002222d37021b9 |
| ARSCLib | 675bed2de397097400ba6f0c808e28005ae5aa53 |
| Original APK | com.google.android.apps.youtube.music, 9.45.51 / 94551240, arm64-v8a, minSDK 28 |
| Original SHA-256 | ad8963959890b6b23a0b332cf9829ee7d6ea6f3a0a61e386d7c34c51a2dd99f7 |

Google signing certificates were verified with apksigner. Personal patch application
checks the version and Google signing certificate. Experimental compatibility remains
restricted to this target. Older APKs use the retained prior release.

## Implemented

- Upstream single/batch download routing, account handling, catalogue, retry, progress
  and downloaded mark. The old owner registry, extra playlist
  action, secondary playback service and custom mini/full player are retired.
- Audio-first bottom sheet with available Opus choices, conditional compatible video,
  separate remembered choices, truthful combined sizes, ripple presses and animation
  setting support. Playlist video choices wait for the foreground and cancel per song.
- Saved audio substitution in the native player, preserving response authorization and
  explicit available video streams. Native transport/paired playback bridges are installed.
  Stored format bytes retain protobuf unknown fields, including supplied seek metadata.
- In-place reuse of saved files and format sidecars. Missing metadata can be rebuilt
  asynchronously from a unique online format only after matching owned-file length,
  container codec and duration. Ambiguous files retain their original data.
- Atomic source group records and one-time legacy group adoption. Repeated/unavailable
  rows retain positions. Complete source reads replace snapshots. Partial refreshes
  preserve an existing snapshot. Large source lists use visible-row rendering.
- In-app mode uses Morphe's owned catalogue inside the stock Library → Downloads destination.
  The stock browse command still runs, and the Library header, app navigation and native
  playback session remain in use. Default and External retain stock Downloads navigation.
- Native watch playback from Downloads and source groups, source playlist identity,
  settings, accessible storage bars and retained read-only external-folder grants.
- Ported personal Lyrics and Shaders hooks. The target's artwork and background IDs are
  0x7f0b0957 and 0x7f0b094d. Native Lyrics protocol schemas and factory recipe are pinned.
- Existing lyric/offset/connection namespaces and user settings remain in use.
  Morphe's debug-level setting and export handle the personal diagnostics.
- The Lyrics panel subscribes to the current recording and replays the latest lookup state
  after attachment. Missing track details time out after 12 seconds and can recover on a
  late metadata callback. The panel centers the empty message after confirmed absence and
  distinguishes pending verification, incomplete requests and unparseable results.
- Spicy Lyrics line and rich TTML use the existing Better Lyrics broker, with provider and
  contributor credits. Spicy results are kept for the current recording session. The durable
  library continues to retain eligible lyrics from other sources.

## Changes in beta.3

- The catalogue waits for the native Library content frame to lay out and follows
  its stock Downloads selection. The exact Library back callback returns from an
  open saved group before native back resets the Downloads filter.
- The Audio/Video quality sheet protects its actions with the actual navigation
  inset. Its handle supports expansion, collapse and dismissal.
- The lyric action can open a prepared native panel during discovery. Playback
  identity gates native lyric availability and stale results. The renderer fades
  in the first lyric and coalesces results arriving in the same animation frame.
- Braccato core 1.21.5, parsers 0.4.2 and types 1.1.0 use pinned registry integrity.
  Unison credits follow the displayed song and submitter across live and saved
  results. Missing submitter fields in previously saved lyrics require a refresh.
- Shaders use the visible player container's alpha and verify panel ownership
  before binding. Inactive activities release their foreground state.
- Music settings group the branded Morphe entry. Personal preference rows,
  switches and sliders use a flatter, denser layout.
- Online playback waits for the merged media response before replacing the stream
  list with saved audio. Native video formats remain available through the merge.
- The Volume boost patch adds a speaker control to the exact native action row.
  Gain starts at 0 dB on each launch and can be raised to +12 dB on a supported
  playback audio session.
- Download notifications use song artwork when available, the themed accent when
  resolved, and transfer progress. Batches show the current song and a separate
  count of saved items. Android 16 and later use the platform progress style.

## Desktop verification

Exact checks and hashes are retained in the delivery report and Verification/revision48.
The suite includes source-order/duplicate/unavailable fixtures, malformed continuations,
actual-format quality ranking, device-format filtering, combined-size estimates,
SDK DEX/resource compilation, duplicate-class checks and native receiver/reference-return
audits. The native Library content bridge is checked for its FrameLayout return and
its lifecycle callbacks for the original presenter receiver. The retired Downloads
redirect and playback service are absent. Node fixtures exercise Spicy TTML decoding,
attribution links and lyric status transitions. A Chrome fixture also runs the
packaged WebView code through a timed line transition, reopening after a paused
seek, large type with reduced motion, and a song change with a stale result.

The inspected Library fragment is `Lgme;` in the exact original. Its native `DOWNLOADS`
state is held in `ar:Lgmh;`. The `browse_content` resource is `0x7f0b01d4`, inside
`library_browse_fragment`, with the Library header in a separate view. The stock
`FEmusic_offline` command and account-scoped offline provider are retained. App-owned
downloads use Morphe's catalogue in that content frame and have no entries written
into Google's offline catalogue. The original DEX evidence is retained in
`Verification/revision47/library-native.txt`.

## Remaining acceptance and implementation limits

- Device acceptance remains open for stock Library rendering and navigation, live Spicy
  responses, zero audio-stream requests, airplane-mode cold playback, seeking, mini-player
  expansion, theme appearance, sheet gestures, decoder behavior and download cancellation. Volume boost needs route checks for
  speaker, wired and Bluetooth playback and any sink modes that skip the observed
  AudioTrack callback.
- Source groups preserve the captured row order. Play all currently opens the original
  native playlist watch context at the first playable source position. Offline, it
  skips rows whose local file or native position metadata is unavailable when
  choosing where to start. Next and Previous still follow the native queue.
  The native queue is not yet frozen to the saved playable-row snapshot.
- Actual account-specific multi-page playlists, interrupted/exhausted storage,
  on-device legacy migration and YTDLnis folder playback still require runtime tests.
- Samsung's Now Bar controls eligibility independently. Download notifications use
  Android's standard progress surfaces. Now Bar promotion remains unverified.
- Signing, installation, MuMu and publication were outside this local delivery.

## References

- https://github.com/MorpheApp/morphe-patches/releases/tag/v2.2.0
- https://github.com/MorpheApp/morphe-patches/pull/4398
- https://github.com/MorpheApp/morphe-patches/pull/4414
- https://github.com/better-lyrics/better-lyrics/blob/5721d210ab0439b8bb6613511798e4f02cbefa55/src/modules/lyrics/providers/unified.ts
- https://github.com/better-lyrics/cf-api/blob/27eb4c5742ef0d9ca0a2521b91de72864103ed5c/src/endpoints/LyricsV2.ts

- [Android Live Updates requirements](https://developer.android.com/develop/ui/views/notifications/live-update)
