/* Copyright 2026 BDCrusher. GPL-3.0. */
const origin = 'https://unison.betterlyrics.org';

export function unisonContributors(data) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(data?.videoId ?? '')) return [];
  const credits = [{label: 'Lyrics from Unison', url: origin + '/song/' + data.videoId}];
  const {displayName, keyId} = data.submitter ?? {};
  if (typeof displayName === 'string' && displayName.trim() && /^[A-Za-z0-9_-]{1,128}$/.test(keyId ?? '')) {
    credits.push({label: 'Submitted by ' + displayName.trim().slice(0, 160), url: origin + '/curator/' + keyId});
  }
  return credits;
}
