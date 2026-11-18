# Morphe 2.3.0 integration and compatibility

The worktree starts at the tracked personal 9.45.51 source and merges official Morphe Patches 2.3.0 (31234a8465683a389bcfba25ad636fd1cd38fd02). The published beta.2 changes were applied from the original local worktree, which remains available for the published version.

## Inputs

- Morphe Patcher 2.4.0 at 0aed87c4e3264cf9233feab7ed26cf2543a08b96 and Patch Library 2.2.0 at 3e56d653d9c00994f352abcdcfc5a4e077df421c.
- Supplied Google-signed Music 9.46.51 / 94651240, arm64-v8a, minSDK 28, SHA-256 aeab0dfc46d379490ee6ca772fd6d4cc68d2480ea7c29ad37299624362c171b6. The original is retained in app-home Inputs.
- The 9.45.51 / 94551240 original remains an explicit candidate target. Source compatibility guards require the exact tested version codes.
- Better Lyrics v3.0.2 at 793811faec8f2c3a10b847fbdd5df852e1be33f3. Its hotfix removes the browser provider for Musixmatch. This candidate retains Morphe's separate direct provider. Android renderer dependencies use Braccato core 1.21.5, Braccato parsers 0.4.3 and Kawarp 1.4.0, with integrity-checked packages.

## Integration choices

- New In-app downloads reuse YouTube Music's quality rows and submit through its native confirmation action. One shared personal Audio/Video sheet decorates supported pickers in either category. Other eligible flows use native UI. Both categories retain the Morphe export menu for exportable native saved files. External routing sends recognized actions to the chosen app.
- Saved media transport reads the Range header through Morphe's current media-header interface. Music 9.46.51 uses its own validated Lyrics recipe and artwork resource IDs. The personal volume hooks match the actual audio session and release callsites in both targets.
- Better Lyrics uses one renderer, provider catalogue, lyrics pull-out, and settings installer in both categories. Official Morphe supplies the native settings groups and timing callbacks in Singles. The personal tab and engagement panel use the same renderer. Native smooth scrolling and instrumental visibility settings control the personal renderer, with the existing Better Lyrics defaults.
- Remaining work from the earlier rebase includes retimed holds, AI section actions, external lyric sidecars and completed-download lyric association. The Full Collection can prefetch lyrics when an authorized response includes recording metadata. Samsung visual and playback acceptance requires a phone.

The app-home build entry point is build-music-230.ps1. The parity run is retained under Verification/music-parity-01.

## 0.11.0-beta.4 Better Lyrics provider access

Two crash exports from Music 9.46.51 with Morphe 2.4.0-dev.1 and personal
0.11.0-beta.3 Singles recorded `IllegalAccessError` at `LyricsCatalog.officialProvider`
after audio output started. The final beta.3 APKs show that Better Lyrics called a
private `LyricsProviders.providerFor` on both inspected official bundles. Full
Collection's locally compiled method had been public. Both categories now call
Morphe's public `providersInOrder` with an explicit single-provider list.
An unexpected provider linkage failure is recorded as a failed source so the
remaining providers and player can continue. The verifier checks method
visibility and invoke kind in the final APKs and detects the beta.3 call.

## 0.11.0-beta.3 playback crash and diagnostics

The supplied exception was `AbstractMethodError` at `Logger.LogMessage.buildMessageString()`
while Better Lyrics was discovering sources. The beta.2 Singles build passed Android's
SDK DEX verifier but lacked that method on three personal callback classes. R8 had
no compile-time copy of Morphe's `Logger.LogMessage` interface. The Singles build now
supplies the pinned shared extension library as compile-only input, and the verifier
checks every emitted personal callback's executable implementation in the payload
and patched APK. The official logger remains in the official runtime.

Both categories can add a separate capture path that records player stages while
Morphe debug logging is off. The patch wraps the Android process crash handler and
delegates to the existing handler. The audio hooks surround the actual `AudioTrack.play()`
call on each tested target. The recorder stores a bounded history and can export Java
crash stacks plus Android 11+ process exit records. See `PERSONAL-README.md` for controls.
The original crash reported before debug logging was enabled has no matching stack.

## Earlier rebase checks

Candidate MPP SHA-256: ad28adf629c517238e4280fe72368aa1789abe94f7a0487b7ac94254fc89bc82.
Full Collection with the optional Shaders selected patched both originals. SDK DEX and class hierarchy checks passed. The 9.46.51 receiver and return audit passed with 21 bridge methods and three constructor sites. Five JVM tests and five web lookup fixtures passed. Android lint reported zero errors and 27 warnings. No device acceptance run or publication was performed.

## Upstream releases checked November 17, 2026

- Morphe Patches 2.3.0 is the latest stable release. Morphe Patches 2.4.0-dev.1 adds 1080p, 1440p and 4K In-app video quality. This build uses the verified 2.3.0 hooks. [Stable](https://github.com/MorpheApp/morphe-patches/releases/tag/v2.3.0) · [Prerelease](https://github.com/MorpheApp/morphe-patches/releases/tag/v2.4.0-dev.1)
- Morphe Manager 2.6.0 and Better Lyrics 3.0.2 are the current stable releases. [Morphe Manager](https://github.com/MorpheApp/morphe-manager/releases/tag/v2.6.0) · [Better Lyrics](https://github.com/better-lyrics/better-lyrics/releases/tag/v3.0.2)

## Requested patch picker layout

Use one personal .mpp with two categories in Morphe Manager.

- **Full Collection** offers the combined personal setup, including Shaders, Volume Boost, Better Lyrics and Downloads.
- **Singles** offers Shaders, Volume Boost, Better Lyrics, Downloads and Diagnostics as individually selectable entries to use with official Morphe patches. A user can select just one or a supported combination.

The personal bundle names exactly two categories. The Full Collection and Singles use separate runtime entry points. Morphe's official Lyrics and Downloads features remain enabled when their corresponding Singles are selected. Each Single changes the relevant existing hook in place.
### Singles compatibility checks

- Test each Single as the only personal patch alongside official Morphe on each supported original APK. A Single may install its own required infrastructure automatically. It must work without selecting any other personal feature or Full Collection.
- Shaders alone must work with official Third-party lyrics enabled and disabled. Check cover and player backgrounds and the official Lyrics surface with official lyrics enabled. Check Volume Boost alone with official Third-party lyrics and official Downloads enabled.
- Check personal Downloads alone with official Lyrics and the rest of the official patch selection. Check personal Better Lyrics alone with official Downloads and the rest of the official patch selection. Each replacement must own its overlapping feature hooks once. Document any exact selection conflict and test its handling.
- Check supported combinations of Singles and both source orderings. Verify actual patch application, payload isolation, and hook ownership. Record phone checks separately from compiled compatibility. Keep the official patches in control of features outside the selected Single.
