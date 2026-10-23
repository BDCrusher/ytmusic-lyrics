# Build

Use build-local.ps1 with installed JDK25/JDK17, SDK36 and the pinned local Gradle/dependency source. All caches and output remain under this checkout's BuildCache and project directories. No Android SDK/JDK installation is automatic. scripts/prepare_tools.py restores integrity-pinned public web dependencies and esbuild without lifecycle scripts; web/patch_braccato.py applies the checked local scroll correction before bundling. Generated node_modules are not tracked.

Outputs: Personal-Patches/patches/build/libs/patches-0.2.3-beta.3.mpp and Personal-Patches/lyrics-addon/build/libs/lyrics-addon-0.2.3-beta.3.mpp. Source includes shared-lyrics-patches; both editions use the same native integration/runtime/web inputs. Original vendor APKs and private fixture responses are deliberately excluded. Do not run legacy one-time integration generators.

Checks: :patches:test :extensions:music:lintRelease. Original-APK integration requires your own unmodified9.42.52/94252240 arm64 input and exact official1.48.0 bundle. Run stable verifier with explicit bundle/official paths and unused output directories. Never sign, install or distribute vendor/prepatched APKs as part of source checks. Native/SDK/browser results do not establish real phone behavior.

The release distributes locally tested bytes, not a substituted CI build. This public snapshot adapts build/documentation paths and generated-dependency preparation; runtime/patch/web inputs are checked against the tested canonical source. No clean-room full Android rebuild is claimed by publication.
