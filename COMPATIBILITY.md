# Compatibility - 0.2.11-beta.1

Experimental original YouTube Music9.42.52/94252240 arm64-v8a,minSDK26 only. APK SHA256 9c38d63907362715f6172545bcb36f11ddbd45f014938626068016f06dcc3c56. MPP SHA256 9d050a85ebcdec12f089f04754814448c249638dd0ab3d3d41c5546d3d0d746a. Official Morphe1.48.0; engine2.0.0/inherited1.15.1 matching semantics.

Use Full alone OR uncheck every Full patch and use Lyrics-only Add-on with official defaults, official Third-party lyrics OFF. Same root feed/categories. Enable Pre-release patches and Experimental app versions, refresh and repatch original APK. Settings: Morphe > Lyrics.

The system navigation bar/divider is always transparent while Lyrics owns the current window. Contrast scrim is disabled where supported; no matching-color option, background sampling, protection painting or icon override remains. Old transparentNavigation=false is ignored. Native icons and normal insets remain; closing Lyrics restores native window state. Transparency reveals the native app beneath it rather than drawing a replacement background.

47 fresh actual-helper window-state simulations cover API26/28/29/30/36, side/gesture/bottom bars, themes, focus, cross-activity ownership, repeated writes and restoration. Four exact APK combinations/both source orders, five conflicts, compiled native/SDK/isolation audits, JVM tests and lint pass. The two-argument navigation API is audited and helper overlay/Bitmap/icon override calls are rejected.

Lyrics rendering and source logic/web assets are byte-identical to0.2.10 except this native navigation integration/settings change. Prior source/clock/browser/live-service evidence is explicitly reused after exact source/asset hashes match. No new performance or provider coverage claim is made. Real Samsung/One UI transparency still needs phone acceptance; previous stutter/WebView-verification/native-cold-panel/timeline limits remain. No device/MuMu/sign/install/uninstall, global tool copies or global inset changes.
