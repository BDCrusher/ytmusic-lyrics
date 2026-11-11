/* Adapted from Better Lyrics 5721d210ab0439b8bb6613511798e4f02cbefa55. GPL-3.0. */
export function spicyContributors(attribution) {
  const credits = [{label: 'Spicy Lyrics', url: 'https://spicylyrics.org/'}];
  for (const [key, role] of [['uploader', 'Uploaded by'], ['maker', 'Made by']]) {
    const contributor = attribution?.[key];
    if (typeof contributor?.username !== 'string' || !contributor.username.trim()) continue;
    let url;
    try {
      const profile = new URL(contributor.url);
      if (profile.protocol === 'https:' && profile.hostname === 'spicylyrics.org' &&
          !profile.port && !profile.username && !profile.password) url = profile.href;
    } catch { /* Keep a supplied name if its link is unavailable. */ }
    credits.push({label: role + ' ' + contributor.username.trim().slice(0, 160), url});
  }
  return credits;
}
