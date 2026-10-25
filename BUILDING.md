# Current0.2.11 build and verification

Use existing app-scoped build-local.ps1 with :lyrics-collection:buildAndroid :patches:test :extensions:music:lintRelease. Verification/verify_revision31.ps1 applies four exact combinations and rejects conflicts; check_revision31_navigation.py runs the actual window helper against simulated Android boundaries. Use fresh output paths. The compiled audit requires two-argument transparent-only navigation and rejects sampling/overlay/icon overrides.

Renderer/source/clock assets and code are unchanged from0.2.10 and prior evidence is reused by exact hashes. No new browser/provider/performance claim is made. Native original APK remains a private input. Real phone/One UI checks are separate; no device/MuMu/sign/install operations.

# Current 0.2.10 build and verification

Use app-scoped build-local.ps1 with :lyrics-collection:buildAndroid :patches:test :extensions:music:lintRelease. Verification/verify_revision30_delivery.ps1 applies the exact final bundle in four combinations and rejects conflicts. Earlier revision30 scratch is a candidate. Native clock hook count is exactly one per edition.

Actual-source checks: check_revision30_native_clock.py, check_revision30_connection.py, check_revision30_catalog.py, check_revision30_lifecycle.py and live transport helpers; JS clock/frame/probe scripts execute their actual sources. web/revision30-* scripts cover typed health, real broker decoding, CPU/RAF comparison and rich recordings. Reload between independent browser checks; use the current revision8 dock contract rather than historical revision7 geometry. Use fresh output paths; do not rerun completed reports. Native original APK/wire fixtures stay private.

check_revision30_java_service.py is a one-shot loopback test receiving a normally issued verification through stdin/memory; no credentials should be logged or persisted. It requires ordinary service verification, never bypasses it. Desktop/JVM results do not establish phone acceptance. No device/MuMu/sign/install operations.

# Current 0.2.9 build and verification

Use app-scoped build-local.ps1 with :lyrics-collection:buildAndroid :patches:test :extensions:music:lintRelease. Verification/verify_revision29.ps1 applies four combinations and rejects conflicts. Actual-source checks: check_revision29_connection.py, check_revision29_catalog.py, check_revision29_lifecycle.py and the live transport helpers. check_revision29_probe.js executes the actual browser exchange script. Use fresh report paths. No device/MuMu access.

# Current0.2.8 build and verification

JDK25.0.5.0.2 replaces the removed25.0.4.1 path. Use the existing app-scoped build-local/verify-stable wrappers. Current verification: Verification/verify_revision28_delivery.ps1; check_revision28_host.py, check_revision28_catalog_final.py, check_revision28_lifecycle.py and live transport checks. Use fresh output folders; do not rerun completed canonical reports. Original APK and native wire fixtures remain private inputs. The31-check revision27 navigation simulation is inherited only because its source hash is unchanged.

Browser: web/revision28-extension-scroll-check.js compares the same host against the untouched @braccato/core1.16.11 in the retained Research/Better-Lyrics/Packages/core-1.16.11. Bundle its dist/index.js with esbuild alias @braccato/core into Personal-Patches/output/playwright/revision28-reference-renderer.js first. Use the existing app-scoped Playwright wrapper/loopback server; reload between independent provider/renderer/dock/selection checks. The core patch script verifies/inverts known bookkeeping changes; it does not replace upstream visual scrolling. No device result is claimed.

## Previous build records

# Build 0.2.6-beta.1

Run build-local.ps1 with installed JDK25/JDK17 and Android SDK36. Its default task is now `:lyrics-collection:buildAndroid`. The combined output is `Personal-Patches/lyrics-collection/build/libs/lyrics-collection-0.2.6-beta.1.mpp`. Separate `:patches:buildAndroid` and `:lyrics-addon:buildAndroid` targets remain available for development.

The collection compiles the add-on entry once and incorporates Full patch code and shared hooks once. It includes both runtime alternatives as resources; selecting the add-on does not select Full or inject Full payloads. The add-on's own runtime remains personal-only. Existing source/dependency checkouts and notices are retained. No shared global tools are copied into this repository.

Run `:patches:test` for JVM tests. `Verification/verify_categories.ps1` applies four positive original-APK combinations and exports category metadata; `-NegativesOnly` checks five invalid combinations. Local original APK and official 1.48.0 bundle fixtures are required and excluded from Git. `verify-stable.ps1` uses the pinned stable Patcher2.0.0 source. Keep every verification output directory unused. Native compiled audits accept a plain UTF-8 manifest of output APK paths via the existing `auditModelEntry` task; never join APK filenames into shell commands.

The app-owned dependency bootstrap uses pinned public archive hashes and no npm lifecycle scripts. Caches/output remain inside this checkout. No SDK/JDK installation is automatic. Source ZIP is the complete reviewed raw Git tree; a clean-room full Android build is not claimed. Compilation and desktop checks do not prove phone behavior.

Keep the inherited Patcher-Version1.15.1 compatibility declaration: it preserves partial-string fingerprints on stable Patcher2.0.0. The newer engine was used for all final APK checks. The combined bundle carries its GPL license as COPYING-GPL.txt to avoid colliding with a dependency license/ directory.

For this native-entry correction use `Verification/verify_entry_replay.ps1`: it runs the catalog, four positive APK combinations, five invalid-selection checks and native compiled audits. Every output directory must be fresh. The original APK and native wire fixtures are private local inputs; tests deliberately refuse to overwrite prior evidence. `check_entry_replay.py` reuses only stub declarations from `check_native_host.py`, not that older helper's test execution. `check_lyrics_system_bars.py` simulates Android drawing/window state. These are not device tests. The source report records the exact Java hashes and 24/22 results. Run build-local.ps1 with `:lyrics-collection:buildAndroid :patches:test :extensions:music:lintRelease` before APK verification.

Current correction: Verification/verify_follow.ps1; source simulations: check_follow_host.py (29) and check_follow_bars.py (24). Browser: web/follow-transition-check.js plus the existing renderer/provider/dock checks, reloading between independent tests. The transition comparison needs the previous published renderer as a private local fixture. Native wire inputs remain private, and every report/output directory must be fresh. Old verification helpers are historical. No phone performance claim.

Current0.2.7 verification: Verification/verify_revision27.ps1; check_revision27_host.py, check_revision27_bars_final.py, check_revision27_catalog.py, check_revision27_lifecycle.py and the live transport checks. Use fresh output directories. Browser: web/revision27-motion-check.js and revision27-selection-check.js plus existing provider/renderer/dock checks. Live TTML is fetched directly by the motion check. web/patch_braccato.py verifies the original core hash before applying the bounded optional host-scroll sink and suppression clamp. No phone performance claim.
