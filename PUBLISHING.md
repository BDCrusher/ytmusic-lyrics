# Morphe source publication

Canonical GitHub repository: https://github.com/BDCrusher/ytmusic-lyrics. Its default main/dev patches-bundle.json points only at the add-on. full/patches-bundle.json is the separately selectable Full feed. Both branches initially advertise the same beta so the first repository import works; users must enable Pre-release patches and Experimental app versions.

Morphe 2.0.0 reads version, download_url, created_at and description. created_at is UTC in ISO local-date-time form. signature_download_url is empty: no detached bundle signature is claimed. The GitHub release is marked prerelease. Published assets are immutable version-tag URLs, not moving latest URLs.

Keep release payload hashes tied to exact APK-combination evidence. Do not overwrite an existing version or substitute a CI rebuild while citing these local results. For future updates, change the version, complete the app-specific checks, publish new immutable assets, verify their public download hashes, then advance dev (beta) or main (stable). Do not advance feeds to missing assets. No automatic release workflow is enabled here.

The local development home remains the user's YT-Music workspace. This checkout is a reviewed publication snapshot, not a second development fork; changes should originate in the canonical private source and be deliberately exported. Private history, APKs, inputs, credentials, caches and scratch must never be pushed. Original upstream history remains in the development checkout; this public snapshot retains corresponding source, exact pins, licenses and notices.
