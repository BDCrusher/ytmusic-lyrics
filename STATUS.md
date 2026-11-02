# YT-Music personal patches 0.7.0-beta.3

Fixes native download buttons opening the Premium sheet in External/In-app mode by decoding the exact native offline command's song or playlist identity. Uses the existing selected mode/app, accepts executor-dispatched callbacks, consumes duplicates and never substitutes Now Playing for a playlist. Default retains native account/eligibility handling. Whole-playlist In-app downloading requires Downloads and Download playlist.

Fixes unreadable personal quality-choice labels by explicitly binding dialog rows to the host foreground. Downloads storage now measures an existing volume before the first download, with actual owned audio/cover/metadata/temporary-file bytes, available space, colored segments, legends and accessible anchored callouts. External YTDLnis files remain read-only and excluded from owned bytes. Broken storage separators are corrected.

Exact original arm64 Music **9.42.52/94252240** and **9.43.51/94351240**, minSDK26. Full Collection alone; Shaders and Download playlist optional. Jam remains9.42.52-only. Refresh with Pre-release patches and Experimental app versions enabled, review selections and repatch an original APK.

Build/JVM/lint, six positive two-target configurations, two expected missing-Downloads rejections, catalog/Jam guards, six feature/access/reference audits, four native Lyrics audits, six native media audits and six new download/settings audits pass. **578 source/harness checks:100 fresh,478 inherited only after exact source-hash validation.** New fixtures use retained real native command bytes with simulated Android/app-launch boundaries. Browser/provider results are inherited from unchanged executable sources; NOTICE version separately reviewed. Previous14-case matrix belongs to beta.2 only.

Actual phone button handoff, native decoding/queue/SAF, Samsung appearance, shaders/video and recording-free lyric smoothness still need acceptance. No device/MuMu/sign/install/uninstall, real media downloads or cleanup. Existing external format/metadata and SponsorBlock sidecar limitations remain. No zero-stutter claim. No credentials, offsets, lyrics, downloaded files, folder grants or preferences cleared. Existing Enable debug logging / Export debug logs, no timer. Shared Toolkit runs in place; no globals copied.

Settings: **Morphe > Player > Downloads** for mode/app, quality, Ask each time, chapters and storage. Playlist downloads for batches/chosen folder; Shaders for effects.
