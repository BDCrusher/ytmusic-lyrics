# Current candidate - 0.3.0-beta.1

This revision implements independently selectable Shaders and Download playlist, durable best-lyric storage, scheduled source recovery, native settings/storage cards and app-wide transparent navigation. The exact target remains original YouTube Music 9.42.52 / 94252240 arm64-v8a with official Morphe 1.48.0. Use Full Collection alone OR deselect every Full patch and use Lyrics-only Add-on with official Third-party lyrics disabled. Shaders and Download playlist are optional; either can be used with official patches and official lyrics. Download playlist requires Downloads. One root source has four native categories.

Settings: Morphe > Lyrics, Morphe > Shaders, Morphe > Playlist downloads. The playlist patch reads the existing Downloads mode/app at click time. Global transparent navigation is shared infrastructure, installed once with a personal feature. Existing private preferences and credentials are retained. Lyrics never expire automatically; cover media uses an adjustable 512 MiB LRU cache and only downloads new loops on unmetered Wi-Fi.

Read [the implementation report](../Research/FEATURES-0.3.0-2026-10-26.md), `dist/0.3.0-beta.1/verification.json` and the compatibility report for exact checks and limitations. Publication is complete only when `Verification/publication/v0.3.0-beta.1/publication-result.json` says published. Never rerun completed staging/publication generators or push the private checkout. Shared Toolkit stays in place. No MuMu/device/sign/install operations. Real phone smoothness, native presentation, Samsung navigation and Android graphics/download acceptance remain separate from compiled/simulated checks.

## Earlier records (historical)

# Published - 0.2.11-beta.1

[0.2.11-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.11-beta.1) is published. Public source, all 10 assets and the dev feed were verified against the preparation; 7421 source files matched. Source `577aeaff26e4fc11a6c22537130a086a7ddc02c6`, feed `bb1b4cb3b19b6d8dad9fe92a858e3213d3973a93`. MPP SHA256 `9d050a85ebcdec12f089f04754814448c249638dd0ab3d3d41c5546d3d0d746a`. Exact receipt: Verification/publication/v0.2.11-beta.1/publication-result.json. Shared Toolkit ran in place; private history was not pushed.

Lyrics system navigation is always transparent. The matching-color preference, background sampling and protection overlays are removed. Native icons and content insets are preserved, and previous native bar state is restored on close. Old private preferences are retained but cannot disable transparency. Both editions share this behavior.

Fresh build, patch tests, music lint, 47 navigation checks, four final APK combinations including both source orders, five conflicting-selection checks and compiled native/SDK/isolation audits passed. Unchanged source/renderer evidence is reused only with exact source hashes; see the compatibility report for provenance. These are compiled and simulated checks. Actual Samsung/OneUI transparency and phone smoothness remain unverified. No device, MuMu, signing, installation or uninstallation operations were performed.

Refresh the existing Morphe source with Pre-release patches and Experimental app versions enabled, then repatch original 9.42.52/94252240 arm64. Use Full alone OR deselect every Full patch and use Lyrics-only with official 1.48.0 defaults, official Third-party lyrics OFF. Settings remain Morphe > Lyrics. No copied globals.

## Build and prior records

# Current build - 0.2.11-beta.1

Lyrics system navigation is always transparent. Remove the matching toggle, color sampling and opaque protection overlays; ignore saved transparentNavigation=false. Preserve native navigation icons/insets and restore native window state on close. Source/renderer/timing/status-dot assets and other personal logic are unchanged from0.2.10.

47 fresh actual-helper window-state checks, four exact APK combinations/both source orders, five conflicts, compiled native/SDK/isolation audits, JVM/lint pass. The compiled audit requires the transparent-only two-argument API and rejects helper overlay/Bitmap/icon overrides. Prior browser/clock/source/service evidence is reused only after exact source and asset hashes match. Real Samsung/One UI transparency remains unverified; no new performance/provider acceptance claim. No device/MuMu/sign/install/uninstall operations or copied globals.

Read [TRANSPARENT-NAVIGATION-2026-10-25.md](../Research/TRANSPARENT-NAVIGATION-2026-10-25.md) and app-home Personal-Patches/dist/0.2.11-beta.1/verification.json. MPP SHA256 9d050a85ebcdec12f089f04754814448c249638dd0ab3d3d41c5546d3d0d746a. Current helpers: Verification/check_revision31_navigation.py, verify_revision31.ps1, stage_revision31.py; use fresh outputs and never rerun completed generators. Publication receipts, once complete: Verification/publication/v0.2.11-beta.1/publication-result.json. Shared Toolkit runs in place; never push private Personal-Patches history.

Exact target stays original9.42.52/94252240 arm64, official1.48.0, engine2.0.0/inherited1.15.1 matching semantics. Use Full alone OR deselect all Full patches and use add-on with official defaults, official Third-party lyrics OFF. Same root feed/categories; enable Pre-release patches/Experimental app versions, refresh and repatch original APK. Settings: Morphe > Lyrics. Previous phone-performance/WebView/cold-panel/timeline limits remain. Scratch is retained/regenerable; cleanup was not authorized.

## Historical record

# Published - 0.2.10-beta.1

[0.2.10-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.10-beta.1) is published. Public source, all 10 assets and the dev feed were verified against the preparation; 7418 source files matched. Source `2fcfbf6095c68a27dbd81d0ab8fc3c6d8549f478`, feed `4d93cecd2a7859b0d61eeae2c92d86de974fdb65`. MPP SHA256 `ebeb65e0016c61271c8346b295366e03e42225c30dacd171c449f56118790533`. Exact receipt: Verification/publication/v0.2.10-beta.1/publication-result.json. Shared Toolkit ran in place; private history was not pushed.

Quiet typed source dot, timestamp-aware continuous timing, retained parsing/DOM/follow state, normal verification callback and bounded recording-free frame diagnostics are shared by both editions. Four final APK combinations/both orders, five conflicts, native hook/SDK/isolation audits, JVM/lint,143 fresh Java/81 JS checks and fresh16-format/browser checks pass. Actual Java HTTP with normal verification returned all six backends and9 positive payloads. No credentials persisted. All performance runs are retained, including concurrent-load variability; no universal zero-stutter or phone/WebView acceptance claim.

Refresh the existing source with Pre-release patches and Experimental app versions enabled, then repatch original9.42.52/94252240 arm64. Use Full alone OR deselect every Full patch and use add-on with official1.48.0 defaults, official Third-party lyrics OFF. Settings: Morphe > Lyrics; Frame-timing summaries appear in Source diagnostics without recording. No device/MuMu/sign/install/uninstall operations or copied globals.

## Build and prior records

# Current build - 0.2.10-beta.1

Replace automatic source banners with a typed green/orange/red dot right of delay; tap for details. Use a separate timestamp-aware native renderer clock and continuous bridge clock, retain actual Braccato curves, reduce native polling/window work, avoid repeated parsing/DOM resets and premature noLyrics hides, reset follow on tracks and respect hidden windows. Normal verification supports the service's message callback and Retry-After. Bounded Frame-timing summaries are in existing Source diagnostics without recording.

Exact original9.42.52/94252240 arm64, official1.48.0, engine2.0.0/inherited1.15.1 semantics. Four final APK combinations/both source orders, five conflicts, native hook/SDK/isolation audits, JVM/lint,143 fresh Java and81 JS checks pass. Each edition has exactly one timestamped clock hook;113 owned add-on classes, no foreign/duplicate definitions. All16 formats and fresh renderer/dock/selection/seek checks pass. Actual Java HTTP plus normal verification returned all six backends,9 positive payloads and healthy completed state; no credentials persisted. Desktop rich/clock stress evidence is retained, including an84ms concurrent-load case and later uncontended0-long-task cases. **No universal zero-stutter or Android phone/WebView acceptance claim.**

Read [QUIET-SOURCE-STATUS-AND-TIMING-2026-10-25.md](../Research/QUIET-SOURCE-STATUS-AND-TIMING-2026-10-25.md) and app-home Personal-Patches/dist/0.2.10-beta.1/verification.json. MPP SHA256 ebeb65e0016c61271c8346b295366e03e42225c30dacd171c449f56118790533. Authoritative application evidence uses revision30-delivery; earlier revision30 scratch/candidate MPP is not delivery. Current checks: verify_revision30_delivery.ps1, check_revision30_*.py/js and web/revision30-*.js; use new output paths, not completed generators. Existing public history is reviewed/exported with Toolkit in place; never push private Personal-Patches. Publication receipts, once complete: Verification/publication/v0.2.10-beta.1/publication-result.json.

Use Full alone OR deselect every Full patch and use Lyrics-only Add-on with official defaults, official Third-party lyrics OFF. Same root source/categories; enable Pre-release patches/Experimental app versions, refresh and repatch original APK. Settings: Morphe > Lyrics. Existing cold native presentation/alternate timeline limits remain. MuMu/devices/sign/install untouched, no copied globals. Two bounded matrices/CPU artifacts remain retained and regenerable; cleanup was not authorized.

## Historical record

# Published - 0.2.9-beta.1

[0.2.9-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.9-beta.1) is published and the public assets/source/dev feed were verified. Source `0f9e028862f517b8580be981f4525691ec60d0de`, feed `08082caa55aa5d698c5ceba12ee191d4f321e25b`. All 10 release assets and 7396 source files match the reviewed preparation. MPP SHA256 `623e9a05734145b9f948e74df4ecd9227a453cd16bd469d48aa322afcec243ce`. Exact receipt: Verification/publication/v0.2.9-beta.1/publication-result.json.

Automatic source verification, one-hour renewal, retained lyrics/selection and bounded retries are shared by both editions. Four APK combinations and five rejected conflicts, native/SDK/payload audits, JVM/lint,114 fresh simulated Java checks,11 verification-script checks and three live song lookups pass. Inherited browser/native-host/navigation evidence is explicitly tied to unchanged source hashes. **Live Android verification and phone stutter remain unverified.** No device/MuMu/sign/install operations or copied globals. Refresh the existing Morphe source with Pre-release patches and Experimental app versions enabled, then repatch the original APK. Settings: Morphe > Lyrics.

## Build and prior records

# Current build - 0.2.9-beta.1

Additional sources verify quietly during active foreground playback UI, before opening Lyrics. Tokens renew with one hour left while keeping the valid token. The normal same-origin browser exchange preserves cookies and browser identity without a native JS bridge. Connect sources reveals the same challenge when requested. Renewal adds broker results without clearing lyrics, resetting selection or rebuilding the native entry. Temporary failures have up to three attempts with Retry-After; malformed stream events cannot block later providers and duplicate results are suppressed.

Exact target: original9.42.52/94252240 arm64, official1.48.0, engine2.0.0 with inherited1.15.1 semantics. Four APK combinations, both source orders, five conflict rejections, compiled native/SDK/isolation audits, JVM/lint,114 fresh simulated Java checks and11 verification-script checks pass. Three fresh live song lookups pass. Unchanged renderer/browser and70 native-host/navigation checks are inherited by exact source hashes. **No live WebView verification or phone performance acceptance.** Screen recording reportedly suppresses stutter; no stutter fix is claimed. This is active-app background work, not a persistent Android service. Manual verification may still be needed.

Read [AUTOMATIC-SOURCES-2026-10-25.md](../Research/AUTOMATIC-SOURCES-2026-10-25.md) and app-home Personal-Patches/dist/0.2.9-beta.1/verification.json. MPP SHA256 623e9a05734145b9f948e74df4ecd9227a453cd16bd469d48aa322afcec243ce. Current helpers: Verification/verify_revision29.ps1; check_revision29_connection.py, check_revision29_catalog.py, check_revision29_lifecycle.py, check_revision29_probe.js and live transport helpers. Use new output paths; do not rerun completed generators. Publication receipts, once complete: Verification/publication/v0.2.9-beta.1/publication-result.json. Never push private Personal-Patches history. Shared Toolkit runs in place; no globals copied.

Use Full alone OR deselect every Full patch and use Lyrics-only Add-on with official defaults, official Third-party lyrics OFF. Settings: Morphe > Lyrics. Enable Pre-release patches/Experimental app versions, refresh source and repatch original APK. MuMu/devices/sign/install/uninstall untouched. Retained scratch is bounded and regenerable; cleanup was not authorized.

## Historical record

# Current correction - 0.2.8-beta.1

Published [0.2.8-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.8-beta.1). Native Lyrics factory defaults replace cold Related cloning; supplied native definitions remain byte-for-byte intact and late native registrations are captured. Restore actual extension per-line motion/stagger/easing; remove the0.2.7 custom viewport path. Native Lyrics is second before metadata/lookup and explicitly last on confirmed empty. Conservative metadata cleanup and exact-matched LRCLib search strengthen retrieval. Native settings/dialog explain additional-source verification; working public lyrics do not hide connection status.

Exact target remains original9.42.52/94252240 arm64, official1.48.0 and stable patcher2.0.0 with inherited1.15.1 matching semantics. Four APK combinations, five invalid selections, compiled/SDK/isolation/JVM/lint,95 source Java checks plus unchanged31-check navigation evidence and browser comparison pass. **No phone/pixel-parity/performance acceptance.** Cold fallback reproduces the APK built-in profile rather than a captured online definition; alternate video/audio timing and Shaders remain absent. MuMu/devices/sign/install/uninstall untouched; no copied globals.

Read [NATIVE-LYRICS-AND-EXTENSION-SCROLL-2026-10-25.md](../Research/NATIVE-LYRICS-AND-EXTENSION-SCROLL-2026-10-25.md), app-home Personal-Patches/dist/0.2.8-beta.1/verification.json and Verification/publication/v0.2.8-beta.1/publication-result.json. MPP `f938863a742cc77af0c14a59b9982fde391752b81d7aeed289544d41719bc29d`; source `aceee259761d4a3ebff47a9159df2e21aab03aea`, feed `ce9eeaa808a9fe2995e78cc4a4b0380e80fb0046`. Settings: Morphe > Lyrics. Refresh the existing source with Pre-release patches/Experimental app versions, then repatch original APK. Use Full alone OR deselect every Full patch and use add-on with official defaults, official Third-party lyrics OFF. JDK25.0.5.0.2 replaces the removed25.0.4.1 path in app-owned wrappers. Current helpers use revision28-delivery and fresh outputs; do not rerun completed generators or push private history. Shared Toolkit stays in place. Candidate/final scratch is bounded and regenerable; cleanup was not authorized.

## Historical record

# Current correction - 0.2.7-beta.1

Published [0.2.7-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.7-beta.1). One timed host viewport animation, late rich-result preservation, bounded Better Lyrics404/empty-metadata retry, manual candidate retention, native Lyrics second while pending, and transparent system navigation (default on; native matching remains selectable). Braccato highlighting/vocals/agents/letter wave remain. Source `a9fdb450c2632b8278d34ebb72e03a28aa1ce2d3`; dev feed `533a39fc18be1407a16212ec3b7bf75bf4c11968`. Bundle `88b11336f38ec163e6cbf03e8d2de34be39db6420aa836808dc716bc6201d255`.

Four exact original9.42.52/94252240 arm64 APK combinations and five invalid selections passed, with compiled/SDK/duplicate-class/asset audits.111 actual-source simulated Java checks, live Java transport and final browser regressions passed. **Phone jitter/native panel/navigation acceptance remains pending.** Cold Related-derived fallback and alternate video/audio timing limits remain. No device/MuMu/sign/install/uninstall operations or global tool copies. Shaders is research only.

Read [LYRICS-RETRIEVAL-AND-MOTION-2026-10-23.md](../Research/LYRICS-RETRIEVAL-AND-MOTION-2026-10-23.md), app-home Personal-Patches/dist/0.2.7-beta.1/verification.json and Verification/publication/v0.2.7-beta.1/publication-result.json. Settings: Morphe > Lyrics, including Transparent system navigation. Refresh the existing root source with Pre-release patches and Experimental app versions enabled; repatch original APK. Use Full alone OR deselect every Full patch and use add-on with official1.48.0 defaults, official Third-party lyrics OFF. Current verification/staging helpers use revision27 names and fresh outputs. Do not rerun completed publication scripts or push private Personal-Patches history. Shared tools stay in Toolkit. All scratch remains retained in bounded revision27 output folders; cleanup was not authorized.

## Historical record

# Current scroll/presentation correction - 0.2.6-beta.1

Published [0.2.6-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.6-beta.1). Hide native/Web scrollbars, deduplicate visibility/layout work, settle dock clearance, reuse navigation sampling and prefer genuine native Lyrics presentation (including unloaded definitions). Cold fallback still needs Related if no real native Lyrics definition is available. **Phone jitter/panel feel remain unverified.** Four exact APK combinations, five rejected invalid selections, compiled/SDK/isolation audits,29 native-host Java checks,24 simulated navigation checks and browser regressions passed. Original target remains9.42.52/94252240 arm64-v8a. No signing, installation or MuMu access.

Use Full alone OR deselect all Full patches and use add-on with official1.48.0 defaults, official Third-party lyrics OFF. Enable prerelease/experimental source settings, refresh and repatch. Settings remain Morphe > Lyrics. Bundle SHA256 06df4eb3a6b76bfeccf2c3a0871f408ea27ecd48f812b4ccfccfaf3f6529c756; source 061ddfe37fc390c181e71e67668a6cce9178c853; dev feed 8a2a0446f03a4ca2ae8ccd9151b2b75a24abe1af. Artifacts remain in app-home Personal-Patches/dist/0.2.6-beta.1. Read [LYRICS-SCROLL-AND-PRESENTATION-2026-10-23.md](../Research/LYRICS-SCROLL-AND-PRESENTATION-2026-10-23.md) and ../Verification/publication/v0.2.6-beta.1/publication-result.json before future work. Current helpers: Verification/verify_follow.ps1 and stage_follow.py; older generators below are historical. Shared tools remain in Toolkit. Never rerun completed publication helpers or push private history.

## Historical record

# Current native-entry correction - 0.2.5-beta.1

Published [0.2.5-beta.1](https://github.com/BDCrusher/ytmusic-lyrics/releases/tag/v0.2.5-beta.1): native client/server video identity and original-model replay replace optional-response/panel-ready availability gates. Native Lyrics VM is enabled/reordered immediately after Like/Dislike when valid current lyrics arrive. System navigation color follows the visible native Lyrics panel and restores on close; window-token scoped. Source completion, four exact APK applications, five rejected invalid selections, compiled/SDK/payload audits,24 Java entry checks and22 simulated Android-navigation checks passed. **Phone acceptance pending.** No signing, installation or MuMu access.

One root source retains Full Collection and Lyrics-only Add-on categories. Use Full alone OR uncheck every Full patch and select add-on plus official1.48.0 defaults, official Third-party lyrics OFF. Enable Pre-release patches and Experimental app versions, update source and repatch original9.42.52/94252240 arm64. Settings: Morphe > Lyrics. Bundle SHA256 7657adb5984ff9e6f8a12024f94f07ef79d7bf281db27d813d5aee433b0892c6. Artifacts: ../Personal-Patches/dist/0.2.5-beta.1 (from app home). Source 792832d76a32b7c8939961f45706ba1f04ff83e1; feed ee2ccbf52ff1a0e3ff4922a29fe76a77c12b100a.

Read [NATIVE-ENTRY-AND-NAVIGATION-2026-10-23.md](../Research/NATIVE-ENTRY-AND-NAVIGATION-2026-10-23.md) and exact ../Verification/publication/v0.2.5-beta.1/publication-result.json. Current build target remains :lyrics-collection:buildAndroid; staging/verification helpers for this revision are Verification/stage_native_replay.py and verify_entry_replay.ps1. Completed generators must not be rerun; future outputs require fresh directories. Canonical private source/history is preserved; publish only reviewed snapshots. Shared tools remain in Toolkit, with no copied globals. Earlier records below are historical.

## Historical record

# Build 0.2.4-beta.1: combined categories

Run app-home build-local.ps1; default task is :lyrics-collection:buildAndroid. Output: lyrics-collection/build/libs/lyrics-collection-0.2.4-beta.1.mpp. Shared hooks are included once; alternative MPEs are injected only by selected dependencies. The standalone targets remain available. Keep inherited manifest compatibility semantics for partial-string fingerprints; verify using stable2.0.0. Verification/verify_categories.ps1, its -NegativesOnly option and audit_category_outputs.ps1 cover the combined bundle; each output directory must be new. See ../Research/CATEGORIES-2026-10-22.md. Older revision8 staging below is historical for0.2.3-beta.3; do not use it to stage this version.

## Historical record

# Build and verify 0.2.3-beta.3

Canonical home C:/Morphe/App's/YT-Music; all writes/caches/outputs stay there. Preserve existing dirty source and local BuildSources dependencies. Shared Toolkit is read/run in place. Leave MuMu untouched.

Run app-home build-local.ps1 with :patches:buildAndroid :lyrics-addon:buildAndroid :patches:test :patches:generatePatchesList :extensions:music:lintRelease. Reuse installed JDK25/JDK17 and SDK36. No SDK/JDK installation is enabled. This applies the hash-checked local Braccato correction and bundles the shared web source.

Outputs: patches/build/libs/patches-0.2.3-beta.3.mpp and lyrics-addon/build/libs/lyrics-addon-0.2.3-beta.3.mpp. Add-on D8 input contains only personal classes; official contracts are compile-only. Full source retains applied dev.19 over initial dev.18; it was not rebased to the stable collection.

Verification/check_model_entry.py executes actual model/wire/host/entry source with real native Inputs fixtures, Android stubs and explicit native proxy simulation. Repository/coordinator and public transport reports are reused only after exact source hashes match. Only host.css and index.html changed; renderer JavaScript, catalog, fonts and vendor assets remain byte-identical. Fresh browser/provider/control/interaction/dock-position reports are required by staging. Reload between independent checks to reset settings. Use playwright-local.ps1 run-code --filename with the prepared web/revision8-*-check.js and web/revision8-dock-position-check.js. Local Inputs (original APK and public response fixtures) are deliberately excluded from source ZIP; fixture hashes are retained.

Verification/verify_revision8.ps1 applies six selections with stable Patcher2.0.0. Output directories must be new; never overwrite prior evidence. Check free disk first. Verification/audit_final_entry.ps1 audits four positive outputs through one plain-text manifest; never shell-join APK paths. It checks current model hooks, proxy visibility, native lifecycle return coverage, palette/snap protocol contracts and isolation. Inspect original contracts with inspectModelContracts using verify-stable.ps1 -x verifyBundle. Verification/prepare_model_audits.py prepares these new audits; it does not edit product source.

Stage once with Verification/stage_final_delivery.py after exact-artifact checks. This script requires an unused delivery directory. Old stage_native_delivery.py, verify_revision5.ps1 and view-binder tests describe the rejected0.2.2-beta.3 and must not stage current source. Source ZIP includes pinned dependencies, build wrappers, shared native hooks and verifier; excludes Inputs/APKs, credentials, Git, caches, build output and scratch. It is a private development snapshot, not a reviewed public export.

Build/SDK/JVM/simulation checks do not establish phone UI. Signing, installation, MuMu access and publication are outside these commands. Use Toolkit's publication workflow only after explicit authorization; never push the private checkout.
