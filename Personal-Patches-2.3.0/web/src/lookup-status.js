/* Copyright 2026 BDCrusher. GPL-3.0. */
export function lookupMessage(recording, health, parsing, slow, decodingFailed) {
  if (!recording) return 'Play a song to see lyrics.';
  if (parsing || health.pending > 0 && !slow && health.waiting < health.pending) return 'Looking for lyrics…';
  if (health.pending > 0) return 'Still checking for lyrics…';
  if (health.connectionNeeded) return 'Some lyric sources are still verifying.';
  if (health.metadataMissing) return 'Track details unavailable. Lyrics couldn’t be checked.';
  if (decodingFailed || health.found) return 'No readable lyrics available.';
  if (health.failed) return 'Couldn’t check all lyric sources. Try refreshing.';
  return 'No lyrics found.';
}
