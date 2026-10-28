# YT-Music personal patches 0.3.0-beta.2

Fix animated-cover playback, overlaid settings text and Lyrics footer layout. Covers now use one native silent looping decoder with complete-frame fitting. Fragmented artwork files get a complete timeline/index without re-encoding; existing cached files are repaired locally. Backgrounds use Kawarp over still artwork or the cover's first frame, with a 960-pixel cap and no competing HTML video decoders.

Bind an opaque native settings root, extend the verified Lyrics body behind transparent navigation, apply control insets once, restore the collapsed opener to the bottom, and move the smaller status popup above the whole dock. Keep Braccato's own text motion and reduce redundant host work.

Build/JVM/lint, 23 catalog/application/conflict cases, 16 compiled feature audits, 12 native Lyrics audits and 220 actual-source checks passed (86 fresh, 134 inherited with matching source hashes). Browser provider/reference-motion/dock/Kawarp/high-DPI/fallback checks pass. Normal artwork verification and lookup succeeded for MAMMAMIA. A desktop reference-normalized service clip played and looped; the production Android muxer and hardware playback still need phone verification. Earlier failed raw fragmented-file tests remain recorded.

No universal zero-stutter claim. Recording-free phone smoothness, Samsung navigation, native video/panel behavior and actual playlist downloading still need device acceptance. Existing combined-source verification timeout remains a limitation. No device, MuMu, signing or installation operations occurred.

Exact experimental target: original 9.42.52 / 94252240 arm64-v8a. Four categories and selection rules are unchanged. Refresh the source with Pre-release patches and Experimental app versions enabled, then repatch the original APK. Settings: Morphe > Lyrics / Shaders / Playlist downloads.
